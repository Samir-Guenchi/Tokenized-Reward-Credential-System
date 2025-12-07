// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;

/**
 * @title TRCSCredential
 * @author Samir Guenchi - TRCS Project
 * @notice ERC721 NFT for issuing verifiable credentials in the TRCS ecosystem
 * @dev This contract issues non-transferable (soulbound) credentials as NFTs.
 *
 * =============================================================================
 * LEARNING PATH - Understanding Credential NFTs
 * =============================================================================
 *
 * WHY NFTs FOR CREDENTIALS?
 * -------------------------
 * 1. Unique identification: Each credential has a unique token ID
 * 2. On-chain verification: Anyone can verify ownership and validity
 * 3. Metadata flexibility: Store rich data in IPFS/Arweave
 * 4. Standard tooling: Works with all NFT explorers and wallets
 * 5. Revocation: Built-in mechanism to invalidate credentials
 *
 * SOULBOUND TOKENS (SBTs):
 * -----------------------
 * This implementation makes credentials "soulbound" - non-transferable.
 * 
 * WHY NON-TRANSFERABLE?
 * - Credentials represent achievements/identity of a specific person
 * - Transferring defeats the purpose (e.g., degree, certification)
 * - Prevents credential marketplace/fraud
 *
 * CREDENTIAL LIFECYCLE:
 * 1. ISSUANCE: Issuer mints credential to recipient
 * 2. ACTIVE: Credential is valid and verifiable
 * 3. EXPIRED: Optional expiration date passed
 * 4. REVOKED: Explicitly invalidated by revoker
 *
 * METADATA STRUCTURE (stored on IPFS):
 * {
 *   "name": "Blockchain Developer Certificate",
 *   "description": "Awarded for completing the blockchain course",
 *   "image": "ipfs://...",
 *   "attributes": [
 *     {"trait_type": "issuer", "value": "TRCS Academy"},
 *     {"trait_type": "course", "value": "Solidity 101"},
 *     {"trait_type": "grade", "value": "A"},
 *     {"trait_type": "issued_date", "value": "2024-01-15"}
 *   ],
 *   "credential": {
 *     "type": "CourseCompletion",
 *     "schema": "https://example.com/schemas/course-completion.json",
 *     "evidence": ["ipfs://..."]
 *   }
 * }
 *
 * SECURITY CONSIDERATIONS:
 * -----------------------
 * 1. Only ISSUER_ROLE can mint credentials
 * 2. Only REVOKER_ROLE can revoke credentials
 * 3. Transfers are disabled (soulbound)
 * 4. Metadata URI can be updated (for corrections)
 * 5. Expiration is enforced at query time
 *
 * =============================================================================
 */

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Import our access control manager interface
import {IAccessControlManager} from "./AccessControlManager.sol";

/**
 * @title ITRCSCredential
 * @notice Interface for the TRCS Credential contract
 */
interface ITRCSCredential {
    struct CredentialData {
        uint256 tokenId;
        address holder;
        address issuer;
        uint256 issuedAt;
        uint256 expiresAt;      // 0 = never expires
        bool revoked;
        bytes32 credentialType;  // Keccak256 hash of credential type name
        bytes32 dataHash;        // Hash of off-chain data for integrity
    }

    function issueCredential(
        address to,
        string calldata uri,
        bytes32 credentialType,
        uint256 expiresAt,
        bytes32 dataHash
    ) external returns (uint256);

    function revokeCredential(uint256 tokenId, bytes32 reason) external;
    function isCredentialValid(uint256 tokenId) external view returns (bool);
    function getCredentialData(uint256 tokenId) external view returns (CredentialData memory);
}

contract TRCSCredential is 
    ITRCSCredential,
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    ERC721Pausable,
    ReentrancyGuard
{
    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    /**
     * @notice Reference to the access control manager
     */
    IAccessControlManager public immutable accessControlManager;

    /**
     * @notice Counter for token IDs
     * @dev Starts at 1 so tokenId 0 can indicate "no token"
     */
    uint256 private _tokenIdCounter;

    /**
     * @notice Mapping from tokenId to credential data
     */
    mapping(uint256 => CredentialData) private _credentials;

    /**
     * @notice Mapping from credential type hash to description
     * @dev Allows looking up what each credential type means
     */
    mapping(bytes32 => string) private _credentialTypeDescriptions;

    /**
     * @notice Mapping from holder to array of their credential IDs
     * @dev For efficient querying of all credentials for a user
     */
    mapping(address => uint256[]) private _holderCredentials;

    /**
     * @notice Base URI for metadata
     */
    string private _baseTokenURI;

    // =============================================================================
    // EVENTS
    // =============================================================================

    /**
     * @notice Emitted when a credential is issued
     * @param tokenId The unique credential ID
     * @param holder The recipient address
     * @param issuer The issuing address
     * @param credentialType Hash of the credential type
     * @param expiresAt Expiration timestamp (0 = never)
     */
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed holder,
        address indexed issuer,
        bytes32 credentialType,
        uint256 expiresAt
    );

    /**
     * @notice Emitted when a credential is revoked
     * @param tokenId The credential ID
     * @param revoker The address performing revocation
     * @param reason Hash of the revocation reason
     */
    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        bytes32 indexed reason
    );

    /**
     * @notice Emitted when a credential's URI is updated
     * @param tokenId The credential ID
     * @param oldUri Previous URI
     * @param newUri New URI
     * @param updater Address that performed the update
     */
    event CredentialURIUpdated(
        uint256 indexed tokenId,
        string oldUri,
        string newUri,
        address indexed updater
    );

    /**
     * @notice Emitted when a new credential type is registered
     * @param typeHash Hash of the credential type
     * @param description Human-readable description
     */
    event CredentialTypeRegistered(
        bytes32 indexed typeHash,
        string description
    );

    // =============================================================================
    // CUSTOM ERRORS
    // =============================================================================

    /// @notice Thrown when caller lacks required role
    error UnauthorizedAccess(address caller, string requiredRole);

    /// @notice Thrown when trying to issue to zero address
    error InvalidRecipient();

    /// @notice Thrown when token doesn't exist
    error TokenDoesNotExist(uint256 tokenId);

    /// @notice Thrown when credential is already revoked
    error CredentialAlreadyRevoked(uint256 tokenId);

    /// @notice Thrown when trying to transfer a soulbound token
    error SoulboundTokenCannotBeTransferred();

    /// @notice Thrown when credential has expired
    error CredentialExpired(uint256 tokenId, uint256 expiresAt);

    /// @notice Thrown when expiration is in the past
    error InvalidExpiration(uint256 expiresAt);

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

    modifier tokenExists(uint256 tokenId) {
        if (_ownerOf(tokenId) == address(0)) {
            revert TokenDoesNotExist(tokenId);
        }
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    /**
     * @notice Deploy the TRCS Credential contract
     * @param name_ NFT collection name
     * @param symbol_ NFT collection symbol
     * @param baseUri_ Base URI for token metadata
     * @param accessControlManager_ Address of the AccessControlManager
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseUri_,
        address accessControlManager_
    ) ERC721(name_, symbol_) {
        require(accessControlManager_ != address(0), "Invalid ACM address");
        
        accessControlManager = IAccessControlManager(accessControlManager_);
        _baseTokenURI = baseUri_;
        _tokenIdCounter = 0;

        // Register some default credential types
        _registerCredentialType("COURSE_COMPLETION", "Completion of an educational course");
        _registerCredentialType("SKILL_CERTIFICATION", "Verification of a specific skill");
        _registerCredentialType("MEMBERSHIP", "Membership in an organization");
        _registerCredentialType("ACHIEVEMENT", "Recognition of an achievement");
        _registerCredentialType("IDENTITY_VERIFICATION", "Verified identity credential");
    }

    // =============================================================================
    // CREDENTIAL ISSUANCE
    // =============================================================================

    /**
     * @notice Issue a new credential to a recipient
     * @param to Recipient address
     * @param uri Metadata URI (IPFS hash or full URL)
     * @param credentialType Hash of the credential type
     * @param expiresAt Expiration timestamp (0 = never expires)
     * @param dataHash Hash of off-chain credential data for integrity verification
     * @return tokenId The ID of the newly minted credential
     *
     * @dev Creates a soulbound NFT representing the credential
     *
     * EXAMPLE USAGE:
     * ```
     * bytes32 typeHash = keccak256("COURSE_COMPLETION");
     * bytes32 dataHash = keccak256(abi.encodePacked(courseName, grade, date));
     * uint256 tokenId = credential.issueCredential(
     *     studentAddress,
     *     "ipfs://QmXyz...",
     *     typeHash,
     *     0, // Never expires
     *     dataHash
     * );
     * ```
     */
    function issueCredential(
        address to,
        string calldata uri,
        bytes32 credentialType,
        uint256 expiresAt,
        bytes32 dataHash
    ) external override onlyIssuer whenNotPaused nonReentrant returns (uint256) {
        if (to == address(0)) {
            revert InvalidRecipient();
        }
        if (expiresAt != 0 && expiresAt <= block.timestamp) {
            revert InvalidExpiration(expiresAt);
        }

        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;

        // Store credential data
        _credentials[tokenId] = CredentialData({
            tokenId: tokenId,
            holder: to,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            credentialType: credentialType,
            dataHash: dataHash
        });

        // Track holder's credentials
        _holderCredentials[to].push(tokenId);

        // Mint the NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit CredentialIssued(tokenId, to, msg.sender, credentialType, expiresAt);

        return tokenId;
    }

    /**
     * @notice Issue multiple credentials in a single transaction
     * @param recipients Array of recipient addresses
     * @param uris Array of metadata URIs
     * @param credentialTypes Array of credential type hashes
     * @param expirations Array of expiration timestamps
     * @param dataHashes Array of data hashes
     * @return tokenIds Array of newly created token IDs
     */
    function issueBatchCredentials(
        address[] calldata recipients,
        string[] calldata uris,
        bytes32[] calldata credentialTypes,
        uint256[] calldata expirations,
        bytes32[] calldata dataHashes
    ) external onlyIssuer whenNotPaused nonReentrant returns (uint256[] memory tokenIds) {
        uint256 length = recipients.length;
        require(
            length == uris.length &&
            length == credentialTypes.length &&
            length == expirations.length &&
            length == dataHashes.length,
            "Array length mismatch"
        );
        require(length > 0, "Empty arrays");

        tokenIds = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            if (recipients[i] == address(0)) {
                revert InvalidRecipient();
            }
            if (expirations[i] != 0 && expirations[i] <= block.timestamp) {
                revert InvalidExpiration(expirations[i]);
            }

            _tokenIdCounter++;
            uint256 tokenId = _tokenIdCounter;
            tokenIds[i] = tokenId;

            _credentials[tokenId] = CredentialData({
                tokenId: tokenId,
                holder: recipients[i],
                issuer: msg.sender,
                issuedAt: block.timestamp,
                expiresAt: expirations[i],
                revoked: false,
                credentialType: credentialTypes[i],
                dataHash: dataHashes[i]
            });

            _holderCredentials[recipients[i]].push(tokenId);
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, uris[i]);

            emit CredentialIssued(
                tokenId, 
                recipients[i], 
                msg.sender, 
                credentialTypes[i], 
                expirations[i]
            );
        }

        return tokenIds;
    }

    // =============================================================================
    // CREDENTIAL REVOCATION
    // =============================================================================

    /**
     * @notice Revoke a credential
     * @param tokenId The credential to revoke
     * @param reason Hash of the revocation reason (store full reason off-chain)
     *
     * @dev Revoked credentials remain on-chain but are marked invalid
     *
     * WHY NOT BURN?
     * - Maintains audit trail
     * - Holder can prove they once had the credential
     * - Easier compliance (record retention requirements)
     */
    function revokeCredential(
        uint256 tokenId, 
        bytes32 reason
    ) external override onlyRevoker whenNotPaused tokenExists(tokenId) {
        CredentialData storage cred = _credentials[tokenId];
        
        if (cred.revoked) {
            revert CredentialAlreadyRevoked(tokenId);
        }

        cred.revoked = true;

        emit CredentialRevoked(tokenId, msg.sender, reason);
    }

    /**
     * @notice Revoke multiple credentials in batch
     * @param tokenIds Array of credentials to revoke
     * @param reasons Array of reason hashes
     */
    function revokeBatchCredentials(
        uint256[] calldata tokenIds,
        bytes32[] calldata reasons
    ) external onlyRevoker whenNotPaused {
        require(tokenIds.length == reasons.length, "Array length mismatch");
        require(tokenIds.length > 0, "Empty arrays");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            if (_ownerOf(tokenId) == address(0)) {
                revert TokenDoesNotExist(tokenId);
            }
            
            CredentialData storage cred = _credentials[tokenId];
            if (!cred.revoked) {
                cred.revoked = true;
                emit CredentialRevoked(tokenId, msg.sender, reasons[i]);
            }
        }
    }

    // =============================================================================
    // CREDENTIAL QUERIES
    // =============================================================================

    /**
     * @notice Check if a credential is currently valid
     * @param tokenId The credential to check
     * @return True if credential exists, is not revoked, and not expired
     *
     * @dev This is the primary verification function for external systems
     *
     * VERIFICATION FLOW:
     * 1. Check token exists
     * 2. Check not revoked
     * 3. Check not expired (if expiration is set)
     */
    function isCredentialValid(
        uint256 tokenId
    ) external view override returns (bool) {
        if (_ownerOf(tokenId) == address(0)) {
            return false;
        }

        CredentialData storage cred = _credentials[tokenId];

        if (cred.revoked) {
            return false;
        }

        if (cred.expiresAt != 0 && cred.expiresAt <= block.timestamp) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get full credential data
     * @param tokenId The credential to query
     * @return CredentialData struct with all credential information
     */
    function getCredentialData(
        uint256 tokenId
    ) external view override tokenExists(tokenId) returns (CredentialData memory) {
        return _credentials[tokenId];
    }

    /**
     * @notice Get all credentials for a holder
     * @param holder The address to query
     * @return Array of token IDs belonging to the holder
     */
    function getHolderCredentials(
        address holder
    ) external view returns (uint256[] memory) {
        return _holderCredentials[holder];
    }

    /**
     * @notice Get valid credentials for a holder (filters out revoked/expired)
     * @param holder The address to query
     * @return tokenIds Array of valid credential token IDs
     */
    function getValidHolderCredentials(
        address holder
    ) external view returns (uint256[] memory tokenIds) {
        uint256[] memory allCredentials = _holderCredentials[holder];
        uint256 validCount = 0;

        // First pass: count valid credentials
        for (uint256 i = 0; i < allCredentials.length; i++) {
            if (this.isCredentialValid(allCredentials[i])) {
                validCount++;
            }
        }

        // Second pass: collect valid credentials
        tokenIds = new uint256[](validCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allCredentials.length; i++) {
            if (this.isCredentialValid(allCredentials[i])) {
                tokenIds[index] = allCredentials[i];
                index++;
            }
        }

        return tokenIds;
    }

    /**
     * @notice Verify data integrity of a credential
     * @param tokenId The credential to verify
     * @param data The original data to verify against stored hash
     * @return True if the data hash matches
     */
    function verifyCredentialData(
        uint256 tokenId,
        bytes calldata data
    ) external view tokenExists(tokenId) returns (bool) {
        return keccak256(data) == _credentials[tokenId].dataHash;
    }

    // =============================================================================
    // CREDENTIAL TYPE MANAGEMENT
    // =============================================================================

    /**
     * @notice Register a new credential type
     * @param typeName Human-readable type name
     * @param description Description of this credential type
     * @return typeHash The keccak256 hash of the type name
     */
    function registerCredentialType(
        string calldata typeName,
        string calldata description
    ) external onlyAdmin returns (bytes32 typeHash) {
        return _registerCredentialType(typeName, description);
    }

    /**
     * @notice Get description for a credential type
     * @param typeHash Hash of the credential type
     * @return Description string
     */
    function getCredentialTypeDescription(
        bytes32 typeHash
    ) external view returns (string memory) {
        return _credentialTypeDescriptions[typeHash];
    }

    /**
     * @notice Get hash for a credential type name
     * @param typeName The type name
     * @return typeHash The keccak256 hash
     */
    function getCredentialTypeHash(
        string calldata typeName
    ) external pure returns (bytes32) {
        return keccak256(bytes(typeName));
    }

    // =============================================================================
    // URI MANAGEMENT
    // =============================================================================

    /**
     * @notice Update the metadata URI for a credential
     * @param tokenId The credential to update
     * @param newUri The new URI
     *
     * @dev Only admins can update URIs (for corrections/updates)
     */
    function updateTokenURI(
        uint256 tokenId,
        string calldata newUri
    ) external onlyAdmin tokenExists(tokenId) {
        string memory oldUri = tokenURI(tokenId);
        _setTokenURI(tokenId, newUri);
        emit CredentialURIUpdated(tokenId, oldUri, newUri, msg.sender);
    }

    /**
     * @notice Set the base URI for all tokens
     * @param baseUri_ New base URI
     */
    function setBaseURI(string calldata baseUri_) external onlyAdmin {
        _baseTokenURI = baseUri_;
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
     * @notice Get the total number of credentials issued
     * @return Current token counter value
     */
    function totalCredentialsIssued() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice Check if a credential exists
     * @param tokenId The credential ID to check
     * @return True if the credential exists
     */
    function credentialExists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    // =============================================================================
    // SOULBOUND ENFORCEMENT
    // =============================================================================

    /**
     * @notice Override to prevent transfers (soulbound)
     * @dev Allows minting and burning, blocks transfers
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal virtual override(ERC721, ERC721Enumerable, ERC721Pausable) returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block all other transfers
        if (from != address(0) && to != address(0)) {
            revert SoulboundTokenCannotBeTransferred();
        }

        return super._update(to, tokenId, auth);
    }

    // =============================================================================
    // REQUIRED OVERRIDES
    // =============================================================================

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _increaseBalance(
        address account,
        uint128 amount
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, amount);
    }

    // =============================================================================
    // INTERNAL FUNCTIONS
    // =============================================================================

    function _registerCredentialType(
        string memory typeName,
        string memory description
    ) internal returns (bytes32 typeHash) {
        typeHash = keccak256(bytes(typeName));
        _credentialTypeDescriptions[typeHash] = description;
        emit CredentialTypeRegistered(typeHash, description);
        return typeHash;
    }
}
