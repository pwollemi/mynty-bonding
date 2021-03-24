// SPDX-License-Identifier: MIT
// Matic Contract

pragma solidity ^0.7.0;

interface iChildToken {
    function deposit(address user, bytes calldata depositData) external;
}