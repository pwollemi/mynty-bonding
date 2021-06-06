// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

contract mockMaster {
  mapping(address => bool) public localContracts;
  address public owner;

  function updateLocalContract(address contract_, bool isLocal_)
    external
  {
    _updateLocalContract(contract_, isLocal_);
  }

  function _updateLocalContract(address contract_, bool isLocal_)
    internal
  {
    localContracts[contract_] = isLocal_;
  }

  function assignWorker(address worker_, bool isWorker_)
    external
  {
  }
}
