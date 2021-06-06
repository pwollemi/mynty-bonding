// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

//import "./SafeMath.sol";
import "./NetworkAgnostic.sol";
import "./interfaces/iLocalContract.sol";
import "./libraries/LibDiamond.sol";

contract WorkerMetaTransactions is NetworkAgnostic, iLocalContract {
    using SafeMath for uint256;
    bytes32 private constant WORKER_META_TRANSACTION_TYPEHASH =
        keccak256(
            bytes(
                "WorkerMetaTransaction(bytes32 replayPrevention,address from,bytes functionSignature)"
            )
        );

    /*
     * Meta transaction structure.
     * No point of including value field here as a user who is doing value transfer has the funds to pay for gas
     *   and should call the desired function directly in that case.
     */
    struct WorkerMetaTransaction {
        bytes32 replayPrevention;
        address from;
        bytes functionSignature;
    }

    function metaTxSenderIsWorkerOrMinion() internal override returns (bool) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        return ds.masterContract.makeFundedCall(msg.sender);
    }

    function updateLocalContract(address contract_, bool isLocal_) external override {
        //require(contract_ != address(masterContract), "can't reset the master contract");
        //require(contract_ != address(erc721Contract), "can't reset the erc721 contract");
        // require(contract_ != address(0), "can't be the zero address");
        //localContracts[contract_] = isLocal_;
    }

    function workerExecuteMetaTransaction(
        address userAddress_,
        bytes32 replayPrevention_,
        bytes memory functionSignature_,
        bytes32 sigR_,
        bytes32 sigS_,
        uint8 sigV_
    ) public payable returns (bytes memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        require(
            metaTxSenderIsWorkerOrMinion(),
            "Worker Meta-Transaction sent by account other than a worker/minion"
        );
        WorkerMetaTransaction memory metaTx =
            WorkerMetaTransaction({
                replayPrevention: replayPrevention_,
                from: userAddress_,
                functionSignature: functionSignature_
            });

        require(
            workerVerify(userAddress_, metaTx, sigR_, sigS_, sigV_),
            "Signer and signature do not match"
        );

        require(
            ds.playedTransactions[userAddress_][replayPrevention_] == false,
            "REPLAY of a previous transaction"
        );
        ds.playedTransactions[userAddress_][replayPrevention_] = true;

        emit MetaTransactionExecuted(
            userAddress_,
            msg.sender,
            functionSignature_
        );

        // Append userAddress and relayer address at the end to extract it from calling context
        (bool success, bytes memory returnData) =
            address(this).call(
                abi.encodePacked(functionSignature_, userAddress_)
            );
        require(success, "Function call not successful");

        return returnData;
    }

    function hashWorkerMetaTransaction(WorkerMetaTransaction memory metaTx_)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    WORKER_META_TRANSACTION_TYPEHASH,
                    metaTx_.replayPrevention,
                    metaTx_.from,
                    keccak256(metaTx_.functionSignature)
                )
            );
    }

    function workerVerify(
        address signer_,
        WorkerMetaTransaction memory metaTx_,
        bytes32 sigR_,
        bytes32 sigS_,
        uint8 sigV_
    ) internal view returns (bool) {
        return
            signer_ != address(0) &&
            signer_ ==
            ecrecover(
                toWorkerTypedMessageHash(hashWorkerMetaTransaction(metaTx_)),
                sigV_,
                sigR_,
                sigS_
            );
    }

    /**
     * Accept message hash and returns hash message in EIP712 compatible form
     * So that it can be used to recover signer from signature signed using EIP712 formatted data
     * https://eips.ethereum.org/EIPS/eip-712
     * "\\x19" makes the encoding deterministic
     * "\\x01" is the version byte to make it compatible to EIP-191
     */
    function toWorkerTypedMessageHash(bytes32 messageHash_)
        internal
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    getWorkerDomainSeperator(),
                    messageHash_
                )
            );
    }
}
