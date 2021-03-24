pragma solidity ^0.7.0;


// @title iGAME_ERC721
// @dev The interface for the main Token Manager contract
//  Only methods required for calling by sibling contracts are required here
// @author GAME Credits (gamecredits.org)
// (c) 2020 GAME Credits All Rights Reserved. This code is not open source.
// SPDX-License-Identifier: UNLICENSED
abstract contract iGAME_ERC721 {

  function auctionTransfer(address from_, address to_, uint tokenId_) virtual external;

  function inGameOwnerOf(uint tokenId_) virtual external view returns (bytes32 owner_);

  function revokeToken(uint game_, uint tokenId_, bytes32 purchaseId_)
    virtual external returns (bool _isRevoked);

  function transferNewToken(bytes32 recipient_, uint tokenId_, uint tradeLockTime_)
    virtual external;

  function getCryptoAccount(uint game_, bytes32 inGameAccount_)
    virtual public view returns(address cryptoAccount);

  function getValidCryptoAccount(uint game_, bytes32 inGameAccount_)
    virtual public view returns(address cryptoAccount);

  function getInGameAccount(uint game_, address cryptoAccount_)
    virtual public view returns(bytes32 inGameAccount);

  function getValidInGameAccount(uint game_, address cryptoAccount_)
    virtual public view returns(bytes32 inGameAccount);

  function getOrCreateInGameAccount(uint game_, address cryptoAccount_)
    virtual external returns(bytes32 inGameAccount);

  function linkContracts(address gameContract_, address erc20Contract_) virtual external;

  function generateCollectible(uint tokenId_, uint xp_, uint xpPerHour_, uint creationTime_) virtual external;
}