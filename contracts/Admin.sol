// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "./AccessControl.sol";

contract Admin is AccessControl {
    bytes32 public constant METADATA_ADMIN = keccak256("METADATA_ADMIN");
    bytes32 public constant MINTER = keccak256("MINTER");
    bytes32 public constant BURNER = keccak256("BURNER");

    modifier isMetadataAdmin() {
        require(hasRole(METADATA_ADMIN, _msgSender()));
        _;
    }
    modifier isGlobalAdmin() {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()));
        _;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(METADATA_ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
        _setRoleAdmin(MINTER, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(METADATA_ADMIN, DEFAULT_ADMIN_ROLE);
    }
}
