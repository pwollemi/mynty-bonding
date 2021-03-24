pragma solidity ^0.7.0;

import "./iGAME_Master.sol";

// @title iLocalContract
// @dev The interface for the main Token Manager contract
//  Only methods required for calling by sibling contracts are required here
// @author GAME Credits (gamecredits.org)
// (c) 2020 GAME Credits All Rights Reserved. This code is not open source.
// SPDX-License-Identifier: UNLICENSED
abstract contract iLocalContract {

  function updateLocalContract(address contract_, bool isLocal_) virtual external;

  function metaTxSenderIsWorkerOrMinion() internal virtual returns (bool);

  function isLocalContract()
    external
    virtual
    pure
  returns(bool) {
    return true;
  }
}