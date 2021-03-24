pragma solidity ^0.7.0;


// @title iGAME_ERC20
// @dev The interface for the Auction & ERC-20 contract
//  Only methods required for calling by sibling contracts are required here
// @author GAME Credits (gamecredits.org)
// (c) 2020 GAME Credits All Rights Reserved. This code is not open source.
// SPDX-License-Identifier: UNLICENSED
abstract contract iGAME_ERC20 {

  function cancelAuctionByManager(uint tokenId_) virtual external;

  function transferByContract(address from_, address to_, uint256 value_) virtual external;

  function linkContracts(address gameContract_, address erc721Contract_) virtual external;

  function getGameBalance(uint game_) virtual public view returns(uint balance);

  function getLoyaltyPointsGranted(uint game_, address account_) virtual public view returns(uint currentPoints);

  function getLoyaltyPointSpends(uint game_, address account_) virtual public view returns(uint currentPoints);

  function getLoyaltyPointsTotal(uint game_, address account_) virtual public view returns(uint currentPoints);

  function thirdPartySpendLoyaltyPoints(uint game_, address account_, uint pointsToSpend_) virtual external;
}