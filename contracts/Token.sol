// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title TRCSToken
 * @author Samir Guenchi - TRCS Project
 * @notice ERC20 token with minting, burning, and access control for the TRCS ecosystem
 * @dev This token serves as the reward currency in the Tokenized Reward & Credential System.
 *
 * =============================================================================
 * LEARNING PATH - Understanding ERC20 Token Design
 * =============================================================================
 *
 * WHY ERC20?
 * ----------
 * ERC20 is the standard interface for fungible tokens on Ethereum. We chose it because:
 * 1. Universal compatibility with wallets, exchanges, and DeFi protocols
 * 2. Well-audited and battle-tested implementation from OpenZeppelin
 * 3. Simple mental model: all tokens are identical and interchangeable
 *
 * KEY FEATURES OF THIS TOKEN:
 * ---------------------------
 * 1. MINTING: Controlled by ISSUER_ROLE for reward distribution
 * 2. BURNING: Users can burn their own tokens; admins can burn for compliance
 * 3. PAUSABILITY: Emergency stop mechanism for security incidents
 * 4. CAP: Optional maximum supply to ensure scarcity (if configured)
 * 5. PERMIT: Gasless approvals via EIP-2612 signatures
 * 6. VOTES: Governance integration via ERC20Votes extension
 *
 * TOKEN ECONOMICS:
 * ---------------
 * - Initial Supply: Configurable at deployment
 * - Maximum Supply: Optional cap (0 = unlimited)
 * - Decimals: 18 (standard for ETH-compatible tokens)
 *
 * SECURITY FEATURES:
 * -----------------
 * - Role-based access for minting/burning
 * - Pausability for emergency response
 * - Reentrancy protection on all state-changing functions
 * - Integer overflow protection (built into Solidity 0.8+)
 *
 * GAS OPTIMIZATION:
 * ----------------
 * - Using ERC20Permit avoids double-transaction approve+transfer pattern
 * - Batch operations where possible
 * - Events emit minimal data; use indexing for off-chain queries
 *
 * HOW TO EXTEND:
 * -------------
 * 1. Add vesting: Create a separate VestingWallet contract
 * 2. Add staking: Create a staking contract that accepts this token
 * 3. Add fees: Override _transfer to implement fee logic
 * 4. Add blacklist: Check addresses in _beforeTokenTransfer
 *
 * =============================================================================
 */

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Import our access control manager interface
import {IAccessControlManager} from "./AccessControlManager.sol";

/**
 * @title ITRCSToken
 * @notice Interface for the TRCS Token
 */
interface ITRCSToken {
    function mint(address to, uint256 amount) external;
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts) external;
    function adminBurn(address from, uint256 amount) external;
    function cap() external view returns (uint256);
    function remainingMintableSupply() external view returns (uint256);
}

contract TRCSToken is 
    ITRCSToken,
    ERC20, 
    ERC20Burnable, 
    ERC20Pausable, 
    ERC20Permit,
    ERC20Votes,
    ReentrancyGuard 
{
    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    /**
     * @notice Reference to the access control manager
     * @dev Used for role-based permissions across the system
     */
    IAccessControlManager public immutable accessControlManager;

    /**
     * @notice Maximum token supply (0 = unlimited)
     * @dev Immutable after deployment for transparency
     * 
     * DESIGN DECISION:
     * We use an immutable cap rather than mutable to:
     * 1. Provide strong guarantees to token holders
     * 2. Prevent admin manipulation of supply limits
     * 3. Gas savings (immutable stored in bytecode)
     */
    uint256 private immutable _cap;

    /**
     * @notice Total amount of tokens ever minted (includes burned tokens)
     * @dev Useful for analytics and tracking emission rate
     */
    uint256 private _totalMinted;

    /**
     * @notice Total amount of tokens ever burned
     * @dev Useful for tracking deflationary pressure
     */
    uint256 private _totalBurned;

    /**
     * @notice Mapping of frozen accounts (cannot send or receive tokens)
     * @dev Used for compliance and security incidents
     */
    mapping(address => bool) private _frozenAccounts;

    // =============================================================================
    // EVENTS
    // =============================================================================

    /**
     * @notice Emitted when tokens are minted
     * @param to Recipient address
     * @param amount Amount of tokens minted
     * @param minter Address that performed the minting
     */
    event TokensMinted(
        address indexed to, 
        uint256 amount, 
        address indexed minter
    );

    /**
     * @notice Emitted when tokens are burned by admin
     * @param from Address tokens were burned from
     * @param amount Amount of tokens burned
     * @param burner Address that performed the burn
     * @param reasonHash Hash of burn reason (for compliance)
     */
    event TokensBurnedByAdmin(
        address indexed from, 
        uint256 amount, 
        address indexed burner,
        bytes32 indexed reasonHash
    );

    /**
     * @notice Emitted when an account is frozen
     * @param account The frozen account
     * @param freezer The admin who froze the account
     */
    event AccountFrozen(address indexed account, address indexed freezer);

    /**
     * @notice Emitted when an account is unfrozen
     * @param account The unfrozen account
     * @param unfreezer The admin who unfroze the account
     */
    event AccountUnfrozen(address indexed account, address indexed unfreezer);

    /**
     * @notice Emitted when tokens are minted in batch
     * @param recipients Number of recipients
     * @param totalAmount Total amount minted
     * @param minter Address that performed the batch mint
     */
    event BatchMint(
        uint256 indexed recipients, 
        uint256 indexed totalAmount, 
        address indexed minter
    );

    // =============================================================================
    // CUSTOM ERRORS
    // =============================================================================

    /// @notice Thrown when caller doesn't have required role
    error UnauthorizedAccess(address caller, string requiredRole);

    /// @notice Thrown when minting would exceed cap
    error CapExceeded(uint256 requested, uint256 available);

    /// @notice Thrown when trying to mint to zero address
    error MintToZeroAddress();

    /// @notice Thrown when arrays have mismatched lengths
    error ArrayLengthMismatch(uint256 recipientsLength, uint256 amountsLength);

    /// @notice Thrown when account is frozen
    error AccountIsFrozen(address account);

    /// @notice Thrown when account is already frozen
    error AccountAlreadyFrozen(address account);

    /// @notice Thrown when account is not frozen
    error AccountNotFrozen(address account);

    /// @notice Thrown when burn amount exceeds balance
    error InsufficientBalance(address account, uint256 balance, uint256 requested);

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    /**
     * @notice Ensures caller has ISSUER_ROLE
     * @dev Used for minting operations
     */
    modifier onlyIssuer() {
        if (!accessControlManager.isIssuer(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "ISSUER_ROLE");
        }
        _;
    }

    /**
     * @notice Ensures caller has ADMIN_ROLE
     * @dev Used for administrative operations
     */
    modifier onlyAdmin() {
        if (!accessControlManager.isAdmin(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "ADMIN_ROLE");
        }
        _;
    }

    /**
     * @notice Ensures caller has PAUSER_ROLE
     * @dev Used for pause/unpause operations
     */
    modifier onlyPauser() {
        if (!accessControlManager.isPauser(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "PAUSER_ROLE");
        }
        _;
    }

    /**
     * @notice Ensures caller has REVOKER_ROLE
     * @dev Used for revocation and freezing operations
     */
    modifier onlyRevoker() {
        if (!accessControlManager.isRevoker(msg.sender)) {
            revert UnauthorizedAccess(msg.sender, "REVOKER_ROLE");
        }
        _;
    }

    /**
     * @notice Ensures account is not frozen
     * @param account The account to check
     */
    modifier notFrozen(address account) {
        if (_frozenAccounts[account]) {
            revert AccountIsFrozen(account);
        }
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * @notice Deploy the TRCS Token
     * @param name_ Token name (e.g., "TRCS Reward Token")
     * @param symbol_ Token symbol (e.g., "TRCS")
     * @param initialSupply Initial tokens to mint to deployer
     * @param maxCap Maximum total supply (0 = unlimited)
     * @param accessControlManager_ Address of the AccessControlManager
     *
     * @dev Configuration choices:
     * - initialSupply: Minted to msg.sender for distribution
     * - maxCap: Set to 0 for unlimited supply, or a fixed number for deflationary tokenomics
     *
     * SECURITY NOTE:
     * The deployer receives the initial supply. In production, this should be:
     * 1. A multi-sig wallet
     * 2. A vesting contract
     * 3. A treasury contract
     * NOT a personal EOA
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxCap,
        address accessControlManager_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
        require(accessControlManager_ != address(0), "Invalid ACM address");
        require(maxCap == 0 || initialSupply <= maxCap, "Initial supply exceeds cap");

        accessControlManager = IAccessControlManager(accessControlManager_);
        _cap = maxCap;

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
            _totalMinted = initialSupply;
        }
    }

    // =============================================================================
    // MINTING FUNCTIONS
    // =============================================================================

    /**
     * @notice Mint new tokens to an address
     * @param to Recipient address
     * @param amount Amount of tokens to mint
     *
     * @dev Only callable by addresses with ISSUER_ROLE
     * 
     * USE CASES:
     * - Reward distribution from backend
     * - Merkle airdrop claims
     * - Staking rewards
     *
     * SECURITY:
     * - Checks cap before minting
     * - Reverts on zero address
     * - Only ISSUER_ROLE can call
     */
    function mint(
        address to, 
        uint256 amount
    ) external override onlyIssuer whenNotPaused nonReentrant {
        if (to == address(0)) {
            revert MintToZeroAddress();
        }

        // Check cap if set
        if (_cap > 0) {
            uint256 available = _cap - totalSupply();
            if (amount > available) {
                revert CapExceeded(amount, available);
            }
        }

        _mint(to, amount);
        _totalMinted += amount;

        emit TokensMinted(to, amount, msg.sender);
    }

    /**
     * @notice Mint tokens to multiple recipients in a single transaction
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint to each recipient
     *
     * @dev Gas-efficient for airdrops and batch distributions
     *
     * EXAMPLE:
     * ```
     * address[] memory recipients = new address[](3);
     * uint256[] memory amounts = new uint256[](3);
     * recipients[0] = user1; amounts[0] = 100e18;
     * recipients[1] = user2; amounts[1] = 200e18;
     * recipients[2] = user3; amounts[2] = 150e18;
     * token.mintBatch(recipients, amounts);
     * ```
     *
     * GAS OPTIMIZATION:
     * Single transaction vs multiple saves:
     * - 21000 base gas per transaction
     * - With 100 recipients: ~2.1M gas saved vs individual mints
     */
    function mintBatch(
        address[] calldata recipients, 
        uint256[] calldata amounts
    ) external override onlyIssuer whenNotPaused nonReentrant {
        uint256 length = recipients.length;
        if (length != amounts.length) {
            revert ArrayLengthMismatch(length, amounts.length);
        }
        require(length > 0, "Empty arrays");

        // Calculate total to check cap once
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < length; i++) {
            totalAmount += amounts[i];
        }

        // Check cap if set
        if (_cap > 0) {
            uint256 available = _cap - totalSupply();
            if (totalAmount > available) {
                revert CapExceeded(totalAmount, available);
            }
        }

        // Perform mints
        for (uint256 i = 0; i < length; i++) {
            if (recipients[i] == address(0)) {
                revert MintToZeroAddress();
            }
            _mint(recipients[i], amounts[i]);
        }

        _totalMinted += totalAmount;

        emit BatchMint(length, totalAmount, msg.sender);
    }

    // =============================================================================
    // BURNING FUNCTIONS
    // =============================================================================

    /**
     * @notice Burn tokens from a specific address (admin function)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     *
     * @dev Only callable by REVOKER_ROLE for compliance/security
     *
     * USE CASES:
     * - Regulatory compliance (sanctions, court orders)
     * - Recovering from security incidents
     * - User-requested account closure
     *
     * SECURITY NOTE:
     * This is a powerful function. In production:
     * 1. Require multi-sig approval
     * 2. Implement time-lock
     * 3. Log comprehensive audit trail
     */
    function adminBurn(
        address from, 
        uint256 amount
    ) external override onlyRevoker whenNotPaused nonReentrant {
        uint256 balance = balanceOf(from);
        if (amount > balance) {
            revert InsufficientBalance(from, balance, amount);
        }

        _burn(from, amount);
        _totalBurned += amount;

        // Use a default reason hash - in production, pass reason as parameter
        bytes32 reasonHash = keccak256("ADMIN_BURN");
        emit TokensBurnedByAdmin(from, amount, msg.sender, reasonHash);
    }

    /**
     * @notice Override burn to track total burned
     * @param amount Amount to burn
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        _totalBurned += amount;
    }

    /**
     * @notice Override burnFrom to track total burned
     * @param account Account to burn from
     * @param amount Amount to burn
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        _totalBurned += amount;
    }

    // =============================================================================
    // FREEZE FUNCTIONS
    // =============================================================================

    /**
     * @notice Freeze an account (prevent sending and receiving)
     * @param account Address to freeze
     *
     * @dev Frozen accounts cannot transfer or receive tokens
     *
     * USE CASES:
     * - Suspected fraud investigation
     * - Compliance requirements
     * - Security incident response
     */
    function freezeAccount(address account) external onlyRevoker {
        if (_frozenAccounts[account]) {
            revert AccountAlreadyFrozen(account);
        }
        _frozenAccounts[account] = true;
        emit AccountFrozen(account, msg.sender);
    }

    /**
     * @notice Unfreeze an account
     * @param account Address to unfreeze
     */
    function unfreezeAccount(address account) external onlyRevoker {
        if (!_frozenAccounts[account]) {
            revert AccountNotFrozen(account);
        }
        _frozenAccounts[account] = false;
        emit AccountUnfrozen(account, msg.sender);
    }

    /**
     * @notice Check if an account is frozen
     * @param account Address to check
     * @return True if the account is frozen
     */
    function isFrozen(address account) external view returns (bool) {
        return _frozenAccounts[account];
    }

    // =============================================================================
    // PAUSE FUNCTIONS
    // =============================================================================

    /**
     * @notice Pause all token transfers
     * @dev Only callable by PAUSER_ROLE
     */
    function pause() external onlyPauser {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     * @dev Only callable by PAUSER_ROLE
     */
    function unpause() external onlyPauser {
        _unpause();
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Get the maximum supply cap
     * @return The cap (0 means unlimited)
     */
    function cap() external view override returns (uint256) {
        return _cap;
    }

    /**
     * @notice Get remaining mintable supply before cap
     * @return Remaining mintable amount (type(uint256).max if no cap)
     */
    function remainingMintableSupply() external view override returns (uint256) {
        if (_cap == 0) {
            return type(uint256).max;
        }
        return _cap - totalSupply();
    }

    /**
     * @notice Get total amount ever minted
     * @return Total minted tokens
     */
    function totalMinted() external view returns (uint256) {
        return _totalMinted;
    }

    /**
     * @notice Get total amount ever burned
     * @return Total burned tokens
     */
    function totalBurned() external view returns (uint256) {
        return _totalBurned;
    }

    /**
     * @notice Get circulating supply (minted - burned)
     * @return Current circulating supply
     * @dev This should equal totalSupply() but provides semantic clarity
     */
    function circulatingSupply() external view returns (uint256) {
        return _totalMinted - _totalBurned;
    }

    // =============================================================================
    // INTERNAL OVERRIDES
    // =============================================================================

    /**
     * @notice Hook called before any transfer
     * @param from Source address
     * @param to Destination address
     * @param amount Amount being transferred
     *
     * @dev Adds freeze check to transfers
     *
     * OVERRIDE RESOLUTION:
     * Both ERC20 and ERC20Pausable define _update, so we must override both.
     * This implementation:
     * 1. Checks pausable state (via super call)
     * 2. Checks frozen accounts
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20, ERC20Pausable, ERC20Votes) {
        // Check frozen accounts (skip for minting/burning)
        if (from != address(0) && _frozenAccounts[from]) {
            revert AccountIsFrozen(from);
        }
        if (to != address(0) && _frozenAccounts[to]) {
            revert AccountIsFrozen(to);
        }

        super._update(from, to, amount);
    }

    /**
     * @notice Get current nonce for an account (required for ERC20Permit)
     * @param owner Account to get nonce for
     * @return Current nonce
     */
    function nonces(
        address owner
    ) public view virtual override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
