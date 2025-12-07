// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title RewardDistributor
 * @author Samir Guenchi - TRCS Project
 * @notice Manages token reward distribution with vesting, merkle airdrops, and claims
 * @dev This contract handles all reward distribution logic for the TRCS ecosystem.
 *
 * =============================================================================
 * LEARNING PATH - Understanding Reward Distribution Patterns
 * =============================================================================
 *
 * DISTRIBUTION METHODS:
 * --------------------
 * 1. DIRECT TRANSFER: Admin sends tokens directly to recipients
 *    - Simple but gas-expensive for many recipients
 *    - Use case: Individual rewards, small groups
 *
 * 2. MERKLE AIRDROP: Users claim from a Merkle tree
 *    - Extremely gas-efficient for large distributions
 *    - Users pay gas to claim (self-service)
 *    - Use case: Large-scale airdrops, community distributions
 *
 * 3. VESTING: Tokens released over time
 *    - Linear or cliff vesting schedules
 *    - Prevents immediate sell pressure
 *    - Use case: Team tokens, long-term incentives
 *
 * MERKLE TREE EXPLANATION:
 * -----------------------
 * A Merkle tree is a hash-based data structure that allows efficient verification
 * of large datasets. For airdrops:
 *
 * 1. Off-chain: Create list of (address, amount) pairs
 * 2. Hash each pair: leaf = keccak256(abi.encodePacked(address, amount))
 * 3. Build tree: Combine hashes pairwise until reaching root
 * 4. On-chain: Store only the root (32 bytes)
 * 5. Claim: User provides proof (path from leaf to root)
 * 6. Verify: Contract reconstructs root from leaf + proof
 *
 * GAS COMPARISON:
 * - Direct transfer to 1000 users: ~21,000 * 1000 = 21M gas
 * - Merkle airdrop: ~30,000 gas per claim * actual claimers
 * - If only 300 claim: 9M gas total (users pay, not admin)
 *
 * VESTING SCHEDULES:
 * -----------------
 * LINEAR: Tokens release continuously over time
 *   Amount = totalAllocation * (timePassed / vestingDuration)
 *
 * CLIFF: No tokens until cliff date, then linear or full release
 *   if (now < cliffDate) return 0;
 *   else return linearVesting();
 *
 * SECURITY CONSIDERATIONS:
 * -----------------------
 * 1. Double-claim prevention via claimed mapping
 * 2. Expiration for unclaimed rewards (prevents infinite liability)
 * 3. Pausability for emergency response
 * 4. Role-based access for admin functions
 * 5. Reentrancy protection on all claims
 *
 * =============================================================================
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IAccessControlManager} from "./AccessControlManager.sol";
import {ITRCSToken} from "./Token.sol";

/**
 * @title IRewardDistributor
 * @notice Interface for the Reward Distributor contract
 */
interface IRewardDistributor {
    struct VestingSchedule {
        uint256 totalAmount;        // Total tokens to vest
        uint256 releasedAmount;     // Already released tokens
        uint256 startTime;          // Vesting start timestamp
        uint256 cliffDuration;      // Cliff period (no release)
        uint256 vestingDuration;    // Total vesting duration
        bool revocable;             // Can admin revoke unvested tokens?
        bool revoked;               // Has it been revoked?
    }

    struct MerkleDistribution {
        bytes32 merkleRoot;         // Root of the Merkle tree
        uint256 totalAmount;        // Total tokens in this distribution
        uint256 claimedAmount;      // Already claimed tokens
        uint256 expiresAt;          // Expiration timestamp
        bool active;                // Is distribution active?
        string ipfsHash;            // IPFS hash of the full distribution data
    }

    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external;

    function releaseVested(address beneficiary) external returns (uint256);
    function getVestedAmount(address beneficiary) external view returns (uint256);
    
    function createMerkleDistribution(
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 duration,
        string calldata ipfsHash
    ) external returns (uint256);

    function claimMerkle(
        uint256 distributionId,
        uint256 amount,
        bytes32[] calldata proof
    ) external;
}

contract RewardDistributor is 
    IRewardDistributor,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    /**
     * @notice The token being distributed
     */
    ITRCSToken public immutable rewardToken;

    /**
     * @notice Access control manager
     */
    IAccessControlManager public immutable accessControlManager;

    /**
     * @notice Vesting schedules by beneficiary
     */
    mapping(address => VestingSchedule) private _vestingSchedules;

    /**
     * @notice Merkle distributions by ID
     */
    mapping(uint256 => MerkleDistribution) private _merkleDistributions;

    /**
     * @notice Counter for distribution IDs
     */
    uint256 private _distributionIdCounter;

    /**
     * @notice Claimed status: distributionId => claimer => claimed
     */
    mapping(uint256 => mapping(address => bool)) private _merkleClaimed;

    /**
     * @notice Total tokens locked in vesting
     */
    uint256 private _totalVestingLocked;

    /**
     * @notice Total tokens reserved for active distributions
     */
    uint256 private _totalDistributionReserved;

    // =============================================================================
    // EVENTS
    // =============================================================================

    /**
     * @notice Emitted when a vesting schedule is created
     */
    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    );

    /**
     * @notice Emitted when vested tokens are released
     */
    event VestedTokensReleased(
        address indexed beneficiary,
        uint256 amount
    );

    /**
     * @notice Emitted when a vesting schedule is revoked
     */
    event VestingRevoked(
        address indexed beneficiary,
        uint256 unvestedAmount,
        address indexed revoker
    );

    /**
     * @notice Emitted when a Merkle distribution is created
     */
    event MerkleDistributionCreated(
        uint256 indexed distributionId,
        bytes32 indexed merkleRoot,
        uint256 totalAmount,
        uint256 expiresAt,
        string ipfsHash
    );

    /**
     * @notice Emitted when tokens are claimed from Merkle distribution
     */
    event MerkleClaimed(
        uint256 indexed distributionId,
        address indexed claimer,
        uint256 amount
    );

    /**
     * @notice Emitted when a Merkle distribution expires and is closed
     */
    event MerkleDistributionClosed(
        uint256 indexed distributionId,
        uint256 unclaimedAmount,
        address indexed closedBy
    );

    /**
     * @notice Emitted when tokens are directly distributed
     */
    event DirectDistribution(
        address indexed recipient,
        uint256 amount,
        address indexed distributor,
        bytes32 indexed reason
    );

    // =============================================================================
    // CUSTOM ERRORS
    // =============================================================================

    error UnauthorizedAccess(address caller, string requiredRole);
    error ZeroAddress();
    error ZeroAmount();
    error VestingAlreadyExists(address beneficiary);
    error NoVestingSchedule(address beneficiary);
    error VestingNotRevocable(address beneficiary);
    error VestingAlreadyRevoked(address beneficiary);
    error NoTokensToRelease(address beneficiary);
    error InvalidMerkleProof();
    error AlreadyClaimed(uint256 distributionId, address claimer);
    error DistributionNotActive(uint256 distributionId);
    error DistributionExpired(uint256 distributionId);
    error DistributionNotExpired(uint256 distributionId);
    error InvalidDuration();
    error InsufficientBalance(uint256 required, uint256 available);
    error ArrayLengthMismatch();

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyIssuer() {
        if (!accessControlManager.isIssuer(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "ISSUER_ROLE");
        }
        _;
    }

    modifier onlyAdmin() {
        if (!accessControlManager.isAdmin(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "ADMIN_ROLE");
        }
        _;
    }

    modifier onlyPauser() {
        if (!accessControlManager.isPauser(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "PAUSER_ROLE");
        }
        _;
    }

    modifier onlyRevoker() {
        if (!accessControlManager.isRevoker(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "REVOKER_ROLE");
        }
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * @notice Deploy the Reward Distributor
     * @param rewardToken_ Address of the reward token
     * @param accessControlManager_ Address of the access control manager
     */
    constructor(
        address rewardToken_,
        address accessControlManager_
    ) {
        require(rewardToken_ != address(0), "Invalid token address");
        require(accessControlManager_ != address(0), "Invalid ACM address");

        rewardToken = ITRCSToken(rewardToken_);
        accessControlManager = IAccessControlManager(accessControlManager_);
        _distributionIdCounter = 0;
    }

    // =============================================================================
    // DIRECT DISTRIBUTION
    // =============================================================================

    /**
     * @notice Distribute tokens directly to a recipient
     * @param recipient Address to receive tokens
     * @param amount Amount of tokens to distribute
     * @param reason Hash of distribution reason (for audit trail)
     *
     * @dev Mints new tokens to the recipient
     * 
     * USE CASE: Individual rewards, bounties, one-off distributions
     */
    function distributeDirectly(
        address recipient,
        uint256 amount,
        bytes32 reason
    ) external onlyIssuer whenNotPaused nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        // Mint tokens directly to recipient
        rewardToken.mint(recipient, amount);

        emit DirectDistribution(recipient, amount, msg.sender, reason);
    }

    /**
     * @notice Distribute tokens to multiple recipients
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts for each recipient
     * @param reason Common reason hash for all distributions
     */
    function distributeBatch(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 reason
    ) external onlyIssuer whenNotPaused nonReentrant {
        if (recipients.length != amounts.length) revert ArrayLengthMismatch();
        if (recipients.length == 0) revert ZeroAmount();

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();

            rewardToken.mint(recipients[i], amounts[i]);
            emit DirectDistribution(recipients[i], amounts[i], msg.sender, reason);
        }
    }

    // =============================================================================
    // VESTING FUNCTIONS
    // =============================================================================

    /**
     * @notice Create a vesting schedule for a beneficiary
     * @param beneficiary Address that will receive vested tokens
     * @param amount Total tokens to vest
     * @param cliffDuration Seconds until first tokens are available
     * @param vestingDuration Total vesting period in seconds
     * @param revocable Whether admin can revoke unvested tokens
     *
     * @dev Creates a linear vesting schedule with optional cliff
     *
     * EXAMPLE - 1 year vesting with 3 month cliff:
     *
     * distributor.createVestingSchedule(
     *     teamMember,
     *     1_000_000e18,           // 1M tokens
     *     90 days,                 // 3 month cliff
     *     365 days,                // 1 year total
     *     true                     // Revocable if they leave
     * );
     *
     * VESTING MATH:
     * At cliff (90 days): 90/365 * 1M = ~246,575 tokens available
     * At 6 months: 180/365 * 1M = ~493,150 tokens available
     * At 1 year: 365/365 * 1M = 1,000,000 tokens available
     */
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 vestingDuration,
        bool revocable
    ) external override onlyAdmin whenNotPaused nonReentrant {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (vestingDuration == 0) revert InvalidDuration();
        if (cliffDuration > vestingDuration) revert InvalidDuration();
        if (_vestingSchedules[beneficiary].totalAmount > 0) {
            revert VestingAlreadyExists(beneficiary);
        }

        _vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            releasedAmount: 0,
            startTime: block.timestamp,
            cliffDuration: cliffDuration,
            vestingDuration: vestingDuration,
            revocable: revocable,
            revoked: false
        });

        _totalVestingLocked += amount;

        // Mint tokens to this contract for vesting
        rewardToken.mint(address(this), amount);

        emit VestingScheduleCreated(
            beneficiary,
            amount,
            cliffDuration,
            vestingDuration,
            revocable
        );
    }

    /**
     * @notice Release vested tokens to beneficiary
     * @param beneficiary Address to release tokens to
     * @return released Amount of tokens released
     *
     * @dev Anyone can call this (gas sponsor pattern)
     */
    function releaseVested(
        address beneficiary
    ) external override whenNotPaused nonReentrant returns (uint256 released) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary];
        
        if (schedule.totalAmount == 0) {
            revert NoVestingSchedule(beneficiary);
        }

        uint256 releasable = _computeReleasableAmount(beneficiary);
        
        if (releasable == 0) {
            revert NoTokensToRelease(beneficiary);
        }

        schedule.releasedAmount += releasable;
        _totalVestingLocked -= releasable;

        // Transfer tokens from this contract to beneficiary
        IERC20(address(rewardToken)).safeTransfer(beneficiary, releasable);

        emit VestedTokensReleased(beneficiary, releasable);

        return releasable;
    }

    /**
     * @notice Revoke a vesting schedule (for revocable schedules only)
     * @param beneficiary Address whose vesting to revoke
     *
     * @dev Releases any vested tokens and returns unvested to admin
     */
    function revokeVesting(
        address beneficiary
    ) external onlyRevoker whenNotPaused nonReentrant {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary];
        
        if (schedule.totalAmount == 0) {
            revert NoVestingSchedule(beneficiary);
        }
        if (!schedule.revocable) {
            revert VestingNotRevocable(beneficiary);
        }
        if (schedule.revoked) {
            revert VestingAlreadyRevoked(beneficiary);
        }

        // Calculate what's vested and what's not
        uint256 vestedAmount = _computeVestedAmount(beneficiary);
        uint256 releasable = vestedAmount - schedule.releasedAmount;
        uint256 unvested = schedule.totalAmount - vestedAmount;

        schedule.revoked = true;
        schedule.releasedAmount = vestedAmount;
        _totalVestingLocked -= (releasable + unvested);

        // Release vested portion to beneficiary
        if (releasable > 0) {
            IERC20(address(rewardToken)).safeTransfer(beneficiary, releasable);
        }

        // Return unvested to sender (revoker should be treasury or multi-sig)
        if (unvested > 0) {
            IERC20(address(rewardToken)).safeTransfer(msg.sender, unvested);
        }

        emit VestingRevoked(beneficiary, unvested, msg.sender);
    }

    /**
     * @notice Get current vested amount for a beneficiary
     * @param beneficiary Address to check
     * @return Vested token amount
     */
    function getVestedAmount(
        address beneficiary
    ) external view override returns (uint256) {
        return _computeVestedAmount(beneficiary);
    }

    /**
     * @notice Get releasable (vested but not claimed) amount
     * @param beneficiary Address to check
     * @return Releasable token amount
     */
    function getReleasableAmount(
        address beneficiary
    ) external view returns (uint256) {
        return _computeReleasableAmount(beneficiary);
    }

    /**
     * @notice Get full vesting schedule details
     * @param beneficiary Address to query
     * @return VestingSchedule struct
     */
    function getVestingSchedule(
        address beneficiary
    ) external view returns (VestingSchedule memory) {
        return _vestingSchedules[beneficiary];
    }

    // =============================================================================
    // MERKLE DISTRIBUTION FUNCTIONS
    // =============================================================================

    /**
     * @notice Create a new Merkle distribution
     * @param merkleRoot Root of the Merkle tree
     * @param totalAmount Total tokens in this distribution
     * @param duration How long the distribution is active (seconds)
     * @param ipfsHash IPFS hash of the full distribution data
     * @return distributionId ID of the created distribution
     *
     * @dev The admin must ensure the Merkle tree matches the committed root
     *
     * MERKLE TREE CREATION (off-chain):
     * Use StandardMerkleTree from openzeppelin/merkle-tree package:
     * 
     * const values = [
     *   ["0x1111...", "1000000000000000000"], // address, amount as string
     *   ["0x2222...", "2000000000000000000"],
     * ];
     * 
     * const tree = StandardMerkleTree.of(values, ["address", "uint256"]);
     * console.log('Root:', tree.root);
     * 
     * // Save tree for users to generate proofs
     * fs.writeFileSync("tree.json", JSON.stringify(tree.dump()));
     */
    function createMerkleDistribution(
        bytes32 merkleRoot,
        uint256 totalAmount,
        uint256 duration,
        string calldata ipfsHash
    ) external override onlyAdmin whenNotPaused nonReentrant returns (uint256) {
        if (totalAmount == 0) revert ZeroAmount();
        if (duration == 0) revert InvalidDuration();
        if (merkleRoot == bytes32(0)) revert ZeroAmount();

        _distributionIdCounter++;
        uint256 distributionId = _distributionIdCounter;

        _merkleDistributions[distributionId] = MerkleDistribution({
            merkleRoot: merkleRoot,
            totalAmount: totalAmount,
            claimedAmount: 0,
            expiresAt: block.timestamp + duration,
            active: true,
            ipfsHash: ipfsHash
        });

        _totalDistributionReserved += totalAmount;

        // Mint tokens to this contract for distribution
        rewardToken.mint(address(this), totalAmount);

        emit MerkleDistributionCreated(
            distributionId,
            merkleRoot,
            totalAmount,
            block.timestamp + duration,
            ipfsHash
        );

        return distributionId;
    }

    /**
     * @notice Claim tokens from a Merkle distribution
     * @param distributionId ID of the distribution
     * @param amount Amount the claimer is entitled to
     * @param proof Merkle proof for the claim
     *
     * @dev Users generate proofs off-chain from the saved Merkle tree
     *
     * CLAIMING (off-chain):
     *
     * const tree = StandardMerkleTree.load(JSON.parse(fs.readFileSync("tree.json")));
     * 
     * for (const [i, v] of tree.entries()) {
     *   if (v[0] === userAddress) {
     *     const proof = tree.getProof(i);
     *     console.log('Amount:', v[1]);
     *     console.log('Proof:', proof);
     *   }
     * }
     */
    function claimMerkle(
        uint256 distributionId,
        uint256 amount,
        bytes32[] calldata proof
    ) external override whenNotPaused nonReentrant {
        MerkleDistribution storage dist = _merkleDistributions[distributionId];
        
        if (!dist.active) {
            revert DistributionNotActive(distributionId);
        }
        if (block.timestamp > dist.expiresAt) {
            revert DistributionExpired(distributionId);
        }
        if (_merkleClaimed[distributionId][msg.sender]) {
            revert AlreadyClaimed(distributionId, msg.sender);
        }

        // Verify the Merkle proof
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
        
        if (!MerkleProof.verify(proof, dist.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        // Mark as claimed and transfer
        _merkleClaimed[distributionId][msg.sender] = true;
        dist.claimedAmount += amount;
        _totalDistributionReserved -= amount;

        IERC20(address(rewardToken)).safeTransfer(msg.sender, amount);

        emit MerkleClaimed(distributionId, msg.sender, amount);
    }

    /**
     * @notice Close an expired distribution and recover unclaimed tokens
     * @param distributionId ID of the distribution to close
     *
     * @dev Can only be called after expiration
     */
    function closeExpiredDistribution(
        uint256 distributionId
    ) external onlyAdmin whenNotPaused nonReentrant {
        MerkleDistribution storage dist = _merkleDistributions[distributionId];
        
        if (!dist.active) {
            revert DistributionNotActive(distributionId);
        }
        if (block.timestamp <= dist.expiresAt) {
            revert DistributionNotExpired(distributionId);
        }

        uint256 unclaimed = dist.totalAmount - dist.claimedAmount;
        dist.active = false;
        _totalDistributionReserved -= unclaimed;

        // Return unclaimed tokens to admin
        if (unclaimed > 0) {
            IERC20(address(rewardToken)).safeTransfer(msg.sender, unclaimed);
        }

        emit MerkleDistributionClosed(distributionId, unclaimed, msg.sender);
    }

    /**
     * @notice Check if an address has claimed from a distribution
     * @param distributionId Distribution to check
     * @param account Address to check
     * @return True if already claimed
     */
    function hasClaimed(
        uint256 distributionId,
        address account
    ) external view returns (bool) {
        return _merkleClaimed[distributionId][account];
    }

    /**
     * @notice Get Merkle distribution details
     * @param distributionId Distribution to query
     * @return MerkleDistribution struct
     */
    function getMerkleDistribution(
        uint256 distributionId
    ) external view returns (MerkleDistribution memory) {
        return _merkleDistributions[distributionId];
    }

    /**
     * @notice Verify a Merkle claim without executing it
     * @param distributionId Distribution to verify against
     * @param account Address to verify
     * @param amount Amount to verify
     * @param proof Merkle proof
     * @return valid True if the proof is valid
     * @return claimable True if valid AND not already claimed AND not expired
     */
    function verifyMerkleClaim(
        uint256 distributionId,
        address account,
        uint256 amount,
        bytes32[] calldata proof
    ) external view returns (bool valid, bool claimable) {
        MerkleDistribution storage dist = _merkleDistributions[distributionId];
        
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))));
        valid = MerkleProof.verify(proof, dist.merkleRoot, leaf);
        
        claimable = valid && 
                    dist.active && 
                    block.timestamp <= dist.expiresAt &&
                    !_merkleClaimed[distributionId][account];
    }

    // =============================================================================
    // PAUSE FUNCTIONS
    // =============================================================================

    function pause() external onlyPauser {
        _pause();
    }

    function unpause() external onlyPauser {
        _unpause();
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Get total tokens locked in vesting schedules
     */
    function totalVestingLocked() external view returns (uint256) {
        return _totalVestingLocked;
    }

    /**
     * @notice Get total tokens reserved for active distributions
     */
    function totalDistributionReserved() external view returns (uint256) {
        return _totalDistributionReserved;
    }

    /**
     * @notice Get the next distribution ID that will be assigned
     */
    function nextDistributionId() external view returns (uint256) {
        return _distributionIdCounter + 1;
    }

    // =============================================================================
    // INTERNAL FUNCTIONS
    // =============================================================================

    /**
     * @notice Compute total vested amount for a beneficiary
     * @param beneficiary Address to compute for
     * @return Total vested tokens
     */
    function _computeVestedAmount(
        address beneficiary
    ) internal view returns (uint256) {
        VestingSchedule storage schedule = _vestingSchedules[beneficiary];
        
        if (schedule.totalAmount == 0) {
            return 0;
        }
        if (schedule.revoked) {
            return schedule.releasedAmount;
        }

        uint256 elapsed = block.timestamp - schedule.startTime;

        // Still in cliff period
        if (elapsed < schedule.cliffDuration) {
            return 0;
        }

        // Past vesting period
        if (elapsed >= schedule.vestingDuration) {
            return schedule.totalAmount;
        }

        // Linear vesting
        return (schedule.totalAmount * elapsed) / schedule.vestingDuration;
    }

    /**
     * @notice Compute releasable (vested - already released) amount
     * @param beneficiary Address to compute for
     * @return Releasable tokens
     */
    function _computeReleasableAmount(
        address beneficiary
    ) internal view returns (uint256) {
        uint256 vested = _computeVestedAmount(beneficiary);
        uint256 released = _vestingSchedules[beneficiary].releasedAmount;
        
        if (vested <= released) {
            return 0;
        }
        
        return vested - released;
    }
}
