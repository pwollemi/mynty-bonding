// SPDX-License-Identifier: MIT
// Matic Contract

pragma solidity ^0.7.0;

abstract contract EIP712Base {
    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            )
        );
    bytes32 internal domainSeperator;
    bytes32 internal workerDomainSeperator;

    constructor(string memory name, string memory version) {
        domainSeperator = encodeDomainSeperator(name, version);
        workerDomainSeperator = encodeWorkerDomainSeperator(name, version);
    }

    function getChainId() public pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function getDomainSeperator() public view returns (bytes32) {
        return domainSeperator;
    }

    function getWorkerDomainSeperator() public view returns (bytes32) {
        return workerDomainSeperator;
    }

    function encodeDomainSeperator(string memory name, string memory version)
        public
        view
        returns (bytes32)
    {
        uint256 chainId = getChainId();
        require(chainId != 0, "chain ID must not be zero");
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    keccak256(bytes(name)),
                    keccak256(bytes(version)),
                    chainId,
                    address(this)
                )
            );
    }

    // This encodes the domain separator to the root chain, rather than the main chain.
    function encodeWorkerDomainSeperator(
        string memory name,
        string memory version
    ) public view returns (bytes32) {
        uint256 chainId = getChainId();

        // 1 == truffle test; 1 == Ethereum
        // 137 == matic mainnet; 1 == Ethereum
        // 80001 == matic mumbai; 5 == Goerli
        chainId = chainId == 137 || chainId == 1 ? 1 : chainId == 80001
            ? 5
            : 31337;
        require(chainId != 0, "chain ID must not be zero");
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    keccak256(bytes(name)),
                    keccak256(bytes(version)),
                    chainId,
                    address(this)
                )
            );
    }

    /**
     * Accept message hash and returns hash message in EIP712 compatible form
     * So that it can be used to recover signer from signature signed using EIP712 formatted data
     * https://eips.ethereum.org/EIPS/eip-712
     * "\\x19" makes the encoding deterministic
     * "\\x01" is the version byte to make it compatible to EIP-191
     */
    function toTypedMessageHash(bytes32 messageHash)
        internal
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked("\x19\x01", getDomainSeperator(), messageHash)
            );
    }
}
