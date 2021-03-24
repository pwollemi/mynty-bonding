pragma solidity ^0.7.0;


// @title Minion Manager
// @dev Contract for managing minions for other contracts in the GAME ecosystem
// @author GAME Credits (gamecredits.org)
// (c) 2020 GAME Credits All Rights Reserved. This code is not open source.
// SPDX-License-Identifier: UNLICENSED
abstract contract iMinionManager {

  function isMinion(address account_) virtual external view returns(bool);
  function isWorker(address account_) virtual external view returns(bool);
  function isWorkerOrMinion(address account_) virtual external view returns(bool);

  function getMinionGroup(bytes32 groupId_) virtual external view returns(address[] memory);
  function addMinionGroup(bytes32 groupId_, address[] calldata minionList_) virtual external;
  function removeMinionGroup(bytes32 groupId_) virtual external;

  function assignWorker(address worker_, bool isWorker_) virtual external returns(bool);

  function isMinionManager()
    external
    pure
  returns(bool) {
    return true;
  }
}