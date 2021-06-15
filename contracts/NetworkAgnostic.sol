// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./openzeppelin/contracts/math/SafeMath.sol";
import "./EIP712Base.sol";
import "./libraries/LibDiamond.sol";
//import "hardhat/console.sol";

//import "./Context.sol";

abstract contract NetworkAgnostic is EIP712Base {
    using SafeMath for uint256;

    bytes32 internal constant META_TRANSACTION_TYPEHASH =
        keccak256(
            bytes(
                "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
            )
        );

    event MetaTransactionExecuted(
        address userAddress,
        address payable relayerAddress,
        bytes functionSignature
    );

    /*
     * Meta transaction structure.
     * No point of including value field here as if user is doing value transfer then he has the funds to pay for gas
     * He should call the desired function directly in that case.
     */
    struct MetaTransaction {
        uint256 nonce;
        address from;
        bytes functionSignature;
    }

    function CONTRACT_ERC712_VERSION() public view returns (string memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.CONTRACT_ERC712_VERSION;
    }

    function CONTRACT_ERC712_NAME() public view returns (string memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.CONTRACT_ERC712_NAME;
    }

    function executeMetaTransaction(
        address userAddress,
        bytes memory functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) public payable returns (bytes memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        MetaTransaction memory metaTx =
            MetaTransaction({
                nonce: ds.nonces[userAddress],
                from: userAddress,
                functionSignature: functionSignature
            });

        require(
            verify(userAddress, metaTx, sigR, sigS, sigV),
            "Signer and signature do not match"
        );

        // increase nonce for user (to avoid re-use)
        ds.nonces[userAddress] = ds.nonces[userAddress].add(1);

        emit MetaTransactionExecuted(
            userAddress,
            msg.sender,
            functionSignature
        );

        // Append userAddress and relayer address at the end to extract it from calling context
        (bool success, bytes memory returnData) =
            address(this).call(
                abi.encodePacked(functionSignature, userAddress)
            );
        require(success, "Function call not successful");

        return returnData;
    }

    function hashMetaTransaction(MetaTransaction memory metaTx)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    META_TRANSACTION_TYPEHASH,
                    metaTx.nonce,
                    metaTx.from,
                    keccak256(metaTx.functionSignature)
                )
            );
    }

    function getNonce(address user) public view returns (uint256 nonce) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        nonce = ds.nonces[user];
    }

    function verify(
        address signer,
        MetaTransaction memory metaTx,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) internal view returns (bool) {
        return
            signer != address(0) &&
            signer ==
            ecrecover(
                toTypedMessageHash(hashMetaTransaction(metaTx)),
                sigV,
                sigR,
                sigS
            );
    }
}
