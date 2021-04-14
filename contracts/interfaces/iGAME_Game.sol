
pragma solidity ^0.7.0;


// @title iGAME_Game
// @dev The interface for the GAME Credits Game Data contract
//  Only methods required for calling by sibling contracts are required here
// @author GAME Credits (gamecredits.org)
// (c) 2020 GAME Credits All Rights Reserved. This code is not open source.
// SPDX-License-Identifier: UNLICENSED
abstract contract iGAME_Game {
  mapping(uint => mapping(address => bool)) public gameAdmins;
  mapping(uint => mapping(address => bool)) public gameOperators;

  function getCardPrice(uint game_, uint set_, uint card_) virtual external view returns(uint256);
  function getCardLoyaltyPrice(uint game_, uint set_, uint card_) virtual external view returns(uint256);
  function isGameAdmin(uint game_, address admin_) virtual external view returns(bool);
  function linkContracts(address erc721Contract_, address erc20Contract_) virtual external;
  function isOperatorOrMinion(uint game_, address sender_) virtual external returns(bool);
  function isValidCaller(address account_, bool isMinion_, uint game_) virtual external view returns(bool isValid);
  function burnToken(uint tokenId_) virtual external;
  function createTokenFromCard(uint game_, uint set_, uint card_) virtual external returns(uint tokenId, uint tradeLockTime, uint fixedXp);
}