pragma solidity >=0.6.0 <0.8.0;

import "../interfaces/iERC20.sol";
import "../interfaces/iERC20Contract.sol";
import "./ERC20Base.sol";

// @title ERC20Access
// @dev ERC20Access contract for controlling access to ERC20 contract functions
// @author GAME Credits Platform (https://www.gamecredits.org)
// (c) 2020 GAME Credits. All Rights Reserved. This code is not open source.
contract ERC20Access is iERC20Contract,ERC20Base{

  event OwnershipTransferred(address previousOwner, address newOwner);

  // The Owner can perform all admin tasks, including setting the recovery account.
  address public owner;

  // The Recovery account can change the Owner account.
  address public recoveryAddress;


  // @dev The original `owner` of the contract is the contract creator.
  // @dev Internal constructor to ensure this contract can't be deployed alone
  constructor()
   public
  {
    owner = msg.sender;
  }

  // @dev Access control modifier to limit access to the Owner account
  modifier onlyOwner() {
    require(msg.sender == owner, "sender must be owner");
    _;
  }

  // @dev Access control modifier to limit access to the Recovery account
  modifier onlyRecovery() {
    require(msg.sender == recoveryAddress, "sender must be recovery");
    _;
  }

  // @dev Access control modifier to limit access to the Owner or Recovery account
  modifier ownerOrRecovery() {
    require(msg.sender == owner || msg.sender == recoveryAddress, "sender must be owner or recovery");
    _;
  }

  // Used to check if an account is treated as official by this contract
  // @param _account - the account to check
  // @returns true if _account equals the owner or recoveryAccount, false otherwise
  function isOfficialAccount(address _account)
    external
    view
     override
  returns(bool)
  {
    return _account == owner || _account == recoveryAddress;
  }

  // @dev Assigns a new address to act as the Owner.
  // @notice Can only be called by the recovery account
  // @param _newOwner The address of the new Owner
  function setOwner(address _newOwner)
    external
    onlyRecovery
  {
    require(_newOwner != address(0), "new owner must be a non-zero address");
    require(_newOwner != recoveryAddress, "new owner can't be the recovery address");

    owner = _newOwner;
    emit OwnershipTransferred(owner, _newOwner);
  }

  // @dev Assigns a new address to act as the Recovery address.
  // @notice Can only be called by the Owner account
  // @param _newRecovery The address of the new Recovery account
  function setRecovery(address _newRecovery)
    external
    onlyOwner
  {
    require(_newRecovery != address(0), "new owner must be a non-zero address");
    require(_newRecovery != owner, "new recovery can't be the owner address");

    recoveryAddress = _newRecovery;
  }

  // @dev allows recovery of ERC20 tokens accidentally sent to this address
  // @param tokenAddress - The address of the erc20 token
  // @param tokens - The number of tokens to transfer
  function transferAnyERC20Token(address tokenAddress, uint tokens)
    public
    ownerOrRecovery
  returns (bool success)
  {
    return iERC20(tokenAddress).transfer(owner, tokens);
  }
}
