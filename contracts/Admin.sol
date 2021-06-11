// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "./AccessControl.sol";

contract Admin is AccessControl {
    bytes32 public constant METADATA_ADMIN = keccak256("METADATA_ADMIN");

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
    }
}
