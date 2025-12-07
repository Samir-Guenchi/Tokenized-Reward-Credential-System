// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title AccessControlManager
 * @author Samir Guenchi - TRCS Project
 * @notice Centralized role-based access control for the TRCS ecosystem
 * @dev This contract manages all roles and permissions across the system.
 *
 * =============================================================================
 * LEARNING PATH - Understanding Role-Based Access Control (RBAC)
 * =============================================================================
 *
 * WHY RBAC?
 * ---------
 * Role-based access control is essential for enterprise and production systems
 * because it provides:
 * 1. Separation of concerns - Different roles for different responsibilities
 * 2. Principle of least privilege - Each role has minimum necessary permissions
 * 3. Auditability - Clear tracking of who can do what
 * 4. Flexibility - Easy to add/remove roles without changing contract logic
 *
 * ROLES IN THIS SYSTEM:
 * --------------------
 * - DEFAULT_ADMIN_ROLE: Super admin, can grant/revoke all roles
 * - ADMIN_ROLE: Administrative functions (pause, upgrade, configure)
 * - ISSUER_ROLE: Can issue credentials and mint tokens
 * - PAUSER_ROLE: Can pause/unpause contracts in emergencies
 * - UPGRADER_ROLE: Can upgrade proxy contracts (if using UUPS)
 * - REVOKER_ROLE: Can revoke credentials and freeze tokens
 *
 * SECURITY CONSIDERATIONS:
 * -----------------------
 * 1. The DEFAULT_ADMIN_ROLE is extremely powerful - protect it with multi-sig
 * 2. Consider time-locks for admin actions in production
 * 3. Implement role hierarchies carefully to prevent privilege escalation
 * 4. Log all role changes for off-chain monitoring
 *
 * GAS OPTIMIZATION NOTES:
 * ----------------------
 * - Using bytes32 for role identifiers (hashed strings) is more gas-efficient
 *   than string comparisons
 * - The OpenZeppelin AccessControl uses mappings which are O(1) for lookups
 * - Events are cheap and crucial for indexing - we emit on every role change
 *
 * HOW TO EXTEND:
 * -------------
 * 1. Define new role: bytes32 public constant NEW_ROLE = keccak256("NEW_ROLE");
 * 2. Add role to _setupInitialRoles if needed at deployment
 * 3. Use the role in other contracts via the hasRole check
 *
 * =============================================================================
 */

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IAccessControlManager
 * @notice Interface for the AccessControlManager contract
 */
interface IAccessControlManager {
    function isAdmin(address account) external view returns (bool);
    function isIssuer(address account) external view returns (bool);
    function isPauser(address account) external view returns (bool);
    function isRevoker(address account) external view returns (bool);
    function isUpgrader(address account) external view returns (bool);
}

contract AccessControlManager is 
    IAccessControlManager,
    AccessControlEnumerable, 
    Pausable, 
    ReentrancyGuard 
{
    // =============================================================================
    // ROLE DEFINITIONS
    // =============================================================================
    
    /**
     * @notice Role for administrative functions
     * @dev Admins can configure system parameters and manage non-admin roles
     * 
     * SECURITY: Admins cannot grant DEFAULT_ADMIN_ROLE to prevent privilege escalation
     */
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /**
     * @notice Role for credential issuers
     * @dev Issuers can mint credentials and tokens to eligible users
     * 
     * USE CASE: Backend services, verified partners, DAOs
     */
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /**
     * @notice Role for emergency pause functionality
     * @dev Pausers can halt contract operations in case of security incidents
     * 
     * BEST PRACTICE: Separate from admin to allow quick response by security team
     */
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /**
     * @notice Role for credential and token revocation
     * @dev Revokers can invalidate credentials and freeze token holdings
     * 
     * USE CASE: Compliance requirements, detected fraud, user requests
     */
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    /**
     * @notice Role for upgrading proxy contracts (UUPS pattern)
     * @dev Upgraders can authorize new implementations
     * 
     * SECURITY: Should be protected by multi-sig and time-lock in production
     */
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    /**
     * @notice Tracks whether an address is permanently banned
     * @dev Banned addresses cannot receive any roles
     */
    mapping(address => bool) private _bannedAddresses;

    /**
     * @notice Timestamp when an address was banned
     * @dev Useful for audit trails and potential appeals
     */
    mapping(address => uint256) private _banTimestamps;

    /**
     * @notice Counter for total role grants (useful for analytics)
     */
    uint256 private _totalRoleGrants;

    // =============================================================================
    // EVENTS
    // =============================================================================

    /**
     * @notice Emitted when an address is banned
     * @param account The banned address
     * @param banner The address that performed the ban
     * @param reasonHash Hash of the ban reason (stored off-chain)
     */
    event AddressBanned(
        address indexed account, 
        address indexed banner, 
        bytes32 indexed reasonHash
    );

    /**
     * @notice Emitted when a ban is lifted
     * @param account The unbanned address
     * @param unbanner The address that lifted the ban
     */
    event AddressUnbanned(address indexed account, address indexed unbanner);

    /**
     * @notice Emitted when multiple roles are granted in batch
     * @param account The address receiving roles
     * @param roles Array of role identifiers granted
     * @param granter The address granting the roles
     */
    event BatchRolesGranted(
        address indexed account, 
        bytes32[] roles, 
        address indexed granter
    );

    // =============================================================================
    // CUSTOM ERRORS (Gas-efficient error handling)
    // =============================================================================

    /// @notice Thrown when trying to grant a role to a banned address
    error AddressIsBanned(address account);

    /// @notice Thrown when trying to ban the zero address
    error CannotBanZeroAddress();

    /// @notice Thrown when trying to ban an address that's already banned
    error AlreadyBanned(address account);

    /// @notice Thrown when trying to unban an address that's not banned
    error NotBanned(address account);

    /// @notice Thrown when an empty array is provided
    error EmptyArray();

    /// @notice Thrown when array lengths don't match
    error ArrayLengthMismatch();

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    /**
     * @notice Ensures the target address is not banned
     * @param account The address to check
     */
    modifier notBanned(address account) {
        if (_bannedAddresses[account]) {
            revert AddressIsBanned(account);
        }
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * @notice Deploys the AccessControlManager with an initial admin
     * @param initialAdmin The address that will receive all initial roles
     * 
     * @dev The initialAdmin receives:
     * - DEFAULT_ADMIN_ROLE: Can manage all other roles
     * - ADMIN_ROLE: Administrative functions
     * - PAUSER_ROLE: Emergency pause capability
     * 
     * SECURITY NOTE:
     * In production, the initialAdmin should be a multi-sig wallet, not an EOA.
     * After deployment, consider:
     * 1. Setting up proper role distribution
     * 2. Revoking PAUSER_ROLE from admin if separate security team exists
     * 3. Implementing time-locks for sensitive operations
     */
    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "Invalid admin address");

        // Grant the deployer full control initially
        // In production, transfer these to multi-sig wallets
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
        _grantRole(UPGRADER_ROLE, initialAdmin);
        _grantRole(REVOKER_ROLE, initialAdmin);
        _grantRole(ISSUER_ROLE, initialAdmin);

        _totalRoleGrants = 6;
    }

    // =============================================================================
    // ROLE CHECK FUNCTIONS (IAccessControlManager implementation)
    // =============================================================================

    /**
     * @notice Check if an address has admin role
     * @param account The address to check
     * @return True if the address has ADMIN_ROLE
     */
    function isAdmin(address account) external view override returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }

    /**
     * @notice Check if an address has issuer role
     * @param account The address to check
     * @return True if the address has ISSUER_ROLE
     */
    function isIssuer(address account) external view override returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }

    /**
     * @notice Check if an address has pauser role
     * @param account The address to check
     * @return True if the address has PAUSER_ROLE
     */
    function isPauser(address account) external view override returns (bool) {
        return hasRole(PAUSER_ROLE, account);
    }

    /**
     * @notice Check if an address has revoker role
     * @param account The address to check
     * @return True if the address has REVOKER_ROLE
     */
    function isRevoker(address account) external view override returns (bool) {
        return hasRole(REVOKER_ROLE, account);
    }

    /**
     * @notice Check if an address has upgrader role
     * @param account The address to check
     * @return True if the address has UPGRADER_ROLE
     */
    function isUpgrader(address account) external view override returns (bool) {
        return hasRole(UPGRADER_ROLE, account);
    }

    // =============================================================================
    // ROLE MANAGEMENT FUNCTIONS
    // =============================================================================

    /**
     * @notice Grant a role to an account (overrides OZ to add ban check)
     * @param role The role identifier to grant
     * @param account The address receiving the role
     * 
     * @dev This override adds:
     * 1. Ban check - banned addresses cannot receive roles
     * 2. Counter increment for analytics
     * 
     * SECURITY: Only role admins can grant roles (enforced by parent contract)
     */
    function grantRole(
        bytes32 role, 
        address account
    ) public virtual override(AccessControl, IAccessControl) notBanned(account) {
        super.grantRole(role, account);
        _totalRoleGrants++;
    }

    /**
     * @notice Grant multiple roles to an account in a single transaction
     * @param account The address receiving the roles
     * @param roles Array of role identifiers to grant
     * 
     * @dev Gas-efficient for onboarding new team members or services
     * 
     * EXAMPLE:
     * ```
     * bytes32[] memory roles = new bytes32[](2);
     * roles[0] = ISSUER_ROLE;
     * roles[1] = PAUSER_ROLE;
     * accessControlManager.grantRoles(newTeamMember, roles);
     * ```
     */
    function grantRoles(
        address account, 
        bytes32[] calldata roles
    ) external notBanned(account) {
        if (roles.length == 0) {
            revert EmptyArray();
        }

        for (uint256 i = 0; i < roles.length; i++) {
            // This will check permissions for each role
            grantRole(roles[i], account);
        }

        emit BatchRolesGranted(account, roles, msg.sender);
    }

    /**
     * @notice Revoke multiple roles from an account in a single transaction
     * @param account The address losing the roles
     * @param roles Array of role identifiers to revoke
     */
    function revokeRoles(address account, bytes32[] calldata roles) external {
        if (roles.length == 0) {
            revert EmptyArray();
        }

        for (uint256 i = 0; i < roles.length; i++) {
            revokeRole(roles[i], account);
        }
    }

    // =============================================================================
    // BAN MANAGEMENT
    // =============================================================================

    /**
     * @notice Ban an address from receiving any roles
     * @param account The address to ban
     * @param reasonHash Keccak256 hash of the ban reason (store full reason off-chain)
     * 
     * @dev When an address is banned:
     * 1. They cannot receive any new roles
     * 2. Existing roles are NOT automatically revoked (call revokeRoles separately)
     * 3. The ban is permanent unless explicitly lifted
     * 
     * SECURITY CONSIDERATION:
     * In production, consider adding a time-lock or multi-sig requirement for bans.
     * Bans should be logged and auditable.
     */
    function banAddress(
        address account, 
        bytes32 reasonHash
    ) external onlyRole(ADMIN_ROLE) {
        if (account == address(0)) {
            revert CannotBanZeroAddress();
        }
        if (_bannedAddresses[account]) {
            revert AlreadyBanned(account);
        }

        _bannedAddresses[account] = true;
        _banTimestamps[account] = block.timestamp;

        emit AddressBanned(account, msg.sender, reasonHash);
    }

    /**
     * @notice Lift a ban from an address
     * @param account The address to unban
     * 
     * @dev Only DEFAULT_ADMIN can unban (more restrictive than banning)
     */
    function unbanAddress(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!_bannedAddresses[account]) {
            revert NotBanned(account);
        }

        _bannedAddresses[account] = false;
        // Note: We keep the ban timestamp for historical records

        emit AddressUnbanned(account, msg.sender);
    }

    /**
     * @notice Check if an address is banned
     * @param account The address to check
     * @return banned True if the address is banned
     * @return banTimestamp When the address was banned (0 if never banned)
     */
    function isBanned(address account) external view returns (bool banned, uint256 banTimestamp) {
        return (_bannedAddresses[account], _banTimestamps[account]);
    }

    // =============================================================================
    // PAUSE FUNCTIONALITY
    // =============================================================================

    /**
     * @notice Pause all pausable contracts that reference this manager
     * @dev Emits a Paused event. All contracts checking whenNotPaused will revert.
     * 
     * USE CASES:
     * - Security incident detected
     * - Preparing for upgrade
     * - Regulatory compliance requirement
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause all pausable contracts
     * @dev Emits an Unpaused event. Normal operations resume.
     * 
     * SECURITY: Consider requiring multi-sig or time-lock for unpausing
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Get the total number of role grants ever made
     * @return The total count of role grants
     * 
     * @dev Useful for analytics and monitoring
     */
    function totalRoleGrants() external view returns (uint256) {
        return _totalRoleGrants;
    }

    /**
     * @notice Get all members of a specific role (custom implementation)
     * @param role The role identifier
     * @return members Array of addresses with this role
     * 
     * @dev Gas-expensive for large sets - prefer off-chain indexing for production
     */
    function getAllRoleMembers(bytes32 role) external view returns (address[] memory members) {
        uint256 count = getRoleMemberCount(role);
        members = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            members[i] = getRoleMember(role, i);
        }
        
        return members;
    }

    /**
     * @notice Check if an account has any administrative role
     * @param account The address to check
     * @return True if account has any admin-level role
     */
    function hasAnyAdminRole(address account) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, account) || hasRole(ADMIN_ROLE, account);
    }

    /**
     * @notice Get all roles held by an account
     * @param account The address to query
     * @return roles Array of role identifiers held by the account
     * 
     * @dev Checks all defined roles - extend this if you add new roles
     */
    function getAccountRoles(address account) external view returns (bytes32[] memory) {
        // Pre-count roles for proper array sizing
        uint256 roleCount = 0;
        bytes32[6] memory allRoles = [
            DEFAULT_ADMIN_ROLE,
            ADMIN_ROLE,
            ISSUER_ROLE,
            PAUSER_ROLE,
            REVOKER_ROLE,
            UPGRADER_ROLE
        ];

        for (uint256 i = 0; i < allRoles.length; i++) {
            if (hasRole(allRoles[i], account)) {
                roleCount++;
            }
        }

        bytes32[] memory roles = new bytes32[](roleCount);
        uint256 index = 0;

        for (uint256 i = 0; i < allRoles.length; i++) {
            if (hasRole(allRoles[i], account)) {
                roles[index] = allRoles[i];
                index++;
            }
        }

        return roles;
    }
}
