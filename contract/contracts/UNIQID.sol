// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title UNIQID — anchor Merkle roots and assign a numeric UNIQ id
/// @notice Simple registry: anchorRoot assigns a numeric id and stores the root. verifyUser verifies a leaf with proof.
contract UNIQID {
    // next numeric id to assign (starts at 1 when first anchored)
    uint256 public nextId;

    // id => merkle root
    mapping(uint256 => bytes32) public roots;

    // optional reverse lookup root => id
    mapping(bytes32 => uint256) public rootToId;

    // emits when a root is anchored and assigned an id
    event RootAnchored(uint256 indexed uniqId, bytes32 indexed root, address indexed submitter);

    constructor() {
        nextId = 0;
    }

    /// @notice Anchor a merkle root and return the assigned numeric id
    /// @param root The merkle root (bytes32)
    /// @return id The assigned numeric id (1,2,3,...)
    function anchorRoot(bytes32 root) external returns (uint256) {
        require(root != bytes32(0), "root cannot be zero");

        // assign next id
        nextId += 1;
        roots[nextId] = root;
        rootToId[root] = nextId;

        emit RootAnchored(nextId, root, msg.sender);
        return nextId;
    }

    /// @notice Verify a leaf against the stored root for uniqId using a Merkle proof
    /// @param uniqId the numeric id previously assigned when anchoring
    /// @param leaf the hashed leaf (bytes32)
    /// @param proof merkle proof array (bytes32[])
    /// @return true if proof verifies
    function verifyUser(uint256 uniqId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool) {
        require(uniqId > 0 && uniqId <= nextId, "invalid uniqId");
        bytes32 root = roots[uniqId];
        return MerkleProof.verify(proof, root, leaf);
    }

    /// @notice Get root assigned to an id
    function getRoot(uint256 uniqId) external view returns (bytes32) {
        return roots[uniqId];
    }
}
