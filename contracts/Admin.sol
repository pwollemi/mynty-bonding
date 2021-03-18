pragma solidity >=0.6.0 <0.8.0;

import "./openzeppelin/contracts/access/AccessControl.sol";

contract Admin is AccessControl {
    bytes32 public constant METADATA_ADMIN = keccak256("METADATA_ADMIN");
    bytes32 public constant MINTER = keccak256("MINTER");
    bytes32 public constant BURNER = keccak256("BURNER");

    modifier isMetadataAdmin(){
       require(hasRole(METADATA_ADMIN,msg.sender));
    _;
    }
   modifier isMinter(){
       require(hasRole(MINTER,msg.sender));
    _;
    }
      modifier isBurner(){
       require(hasRole(BURNER,msg.sender));
    _;
    }
    modifier isGlobalAdmin(){
       require(hasRole(DEFAULT_ADMIN_ROLE,msg.sender));
    _;
    }
    constructor() public {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(METADATA_ADMIN, _msgSender());
        _setupRole(MINTER, _msgSender());
        _setRoleAdmin(DEFAULT_ADMIN_ROLE,MINTER);
        _setRoleAdmin(DEFAULT_ADMIN_ROLE,METADATA_ADMIN);
    }

    
}