pragma solidity ^0.7.0;

import './iERC20.sol';
// @title iGAME_ERC20
// @dev The interface for the Auction & ERC-20 contract
//  Only methods required for calling by sibling contracts are required here
// @author GAME Credits (gamecredits.org)
// (c) 2020 GAME Credits All Rights Reserved. This code is not open source.
// SPDX-License-Identifier: UNLICENSED
abstract contract iGAME_ERC20 is iERC20{
    function cancelAuctionByManager(uint256 tokenId_) external virtual;

  

    function transferByContract(
        address from_,
        address to_,
        uint256 value_
    ) external virtual;

    function linkContracts(address gameContract_, address erc721Contract_)
        external
        virtual;

    function getGameBalance(uint256 game_)
        public
        view
        virtual
        returns (uint256 balance);

    function getLoyaltyPointsGranted(uint256 game_, address account_)
        public
        view
        virtual
        returns (uint256 currentPoints);

    function getLoyaltyPointSpends(uint256 game_, address account_)
        public
        view
        virtual
        returns (uint256 currentPoints);

    function getLoyaltyPointsTotal(uint256 game_, address account_)
        public
        view
        virtual
        returns (uint256 currentPoints);

    function thirdPartySpendLoyaltyPoints(
        uint256 game_,
        address account_,
        uint256 pointsToSpend_
    ) external virtual;
}
