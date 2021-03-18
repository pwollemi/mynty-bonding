// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

import "./openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./openzeppelin/contracts/utils/Strings.sol";
import "./Admin.sol";

/**
 * @title ERC1155Mock
 * This mock just publicizes internal functions for testing purposes
 */
contract NFT is ERC1155,Admin{
    string _baseURI;
    using Strings for uint256;
    constructor (string memory uri) ERC1155() {
        _baseURI=uri;
        // solhint-disable-previous-line no-empty-blocks
    }
    mapping(uint=>string) public _tokenURIs;

    function setURI(string memory newuri,uint id) public isMetadataAdmin() {
        _tokenURIs[id]=newuri;
    }
    function setBaseURI(string memory newuri) public isMetadataAdmin() {
        _baseURI=newuri;
    }
    function uri(uint tokenid)   public view returns(string memory){
        string memory _tokenURI = _tokenURIs[tokenid];

        // If there is no base URI, return the token URI.
        if (bytes(_baseURI).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(_baseURI, _tokenURI));
        }
        // If there is a baseURI but no tokenURI, concatenate the tokenID to the baseURI.
        return string(abi.encodePacked(_baseURI, tokenid.toString()));
    }

    function mint(address to, uint256 id, uint256 value, bytes memory data) public isMinter()  {
        _mint(to, id, value, data);
    }

    function mintBatch(address to, uint256[] memory ids, uint256[] memory values, bytes memory data) public isMinter() {
        _mintBatch(to, ids, values, data);
    }

    function burn( uint256 id, uint256 value) public  {
        _burn(msg.sender, id, value);
    }

    function burnBatch( uint256[] memory ids, uint256[] memory values) public {
        _burnBatch(msg.sender, ids, values);
    }
  // require(_exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        
}