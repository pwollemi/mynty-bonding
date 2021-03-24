pragma solidity ^0.7.0;


// @title ERC-721 Non-Fungible Token Standard
// @dev Interface for contracts conforming to ERC-721: Non-Fungible Tokens
// @dev See https://github.com/ethereum/EIPs/blob/master/EIPS/eip-721.md
//  Note: the ERC-165 identifier for this interface is 0x80ac58cd
// SPDX-License-Identifier: UNLICENSED
interface iERC721 {

  // @notice Count all NFTs assigned to an owner
  // @dev NFTs assigned to the zero address are considered invalid, and this
  //  function throws for queries about the zero address.
  // @param owner_ An address for whom to query the balance
  // @return The number of NFTs owned by `owner_`, possibly zero
  function balanceOf(address owner_) external view returns (uint);

  // @notice Find the owner of an NFT
  // @param tokenId_ The identifier for an NFT
  // @dev NFTs assigned to zero address are considered invalid, and queries
  //  about them do throw.
  // @return The address of the owner of the NFT
  function ownerOf(uint tokenId_) external view returns (address);

  // @notice Transfers the ownership of an NFT from one address to another address
  // @dev Throws unless `msg.sender` is the current owner, an authorized
  //  operator, or the approved address for this NFT. Throws if `from_` is
  //  not the current owner. Throws if `to_` is the zero address. Throws if
  //  `tokenId_` is not a valid NFT. When transfer is complete, this function
  //  checks if `to_` is a smart contract (code size > 0). If so, it calls
  //  `onERC721Received` on `to_` and throws if the return value is not
  //  `bytes4(keccak256("onERC721Received(address,address,uint,bytes)"))`.
  // @param from_ The current owner of the NFT
  // @param to_ The new owner
  // @param tokenId_ The NFT to transfer
  // @param data Additional data with no specified format, sent in call to `to_`
  function safeTransferFrom(address from_, address to_, uint tokenId_, bytes calldata data_) external;

  // @notice Transfers the ownership of an NFT from one address to another address
  // @dev This works identically to the other function with an extra data parameter,
  //  except this function just sets data to ""
  // @param from_ The current owner of the NFT
  // @param to_ The new owner
  // @param tokenId_ The NFT to transfer
  function safeTransferFrom(address from_, address to_, uint tokenId_) external;

  // @notice Transfer ownership of an NFT -- THE CALLER IS RESPONSIBLE
  //  TO CONFIRM THAT `to_` IS CAPABLE OF RECEIVING NFTS OR ELSE
  //  THEY MAY BE PERMANENTLY LOST
  // @dev Throws unless `msg.sender` is the current owner, an authorized
  //  operator, or the approved address for this NFT. Throws if `from_` is
  //  not the current owner. Throws if `to_` is the zero address. Throws if
  //  `tokenId_` is not a valid NFT.
  // @param from_ The current owner of the NFT
  // @param to_ The new owner
  // @param tokenId_ The NFT to transfer
  function transferFrom(address from_, address to_, uint tokenId_) external;

  // @notice Set or reaffirm the approved address for an NFT
  // @dev The zero address indicates there is no approved address.
  // @dev Throws unless `msg.sender` is the current NFT owner, or an authorized
  //  operator of the current owner.
  // @param approved_ The new approved NFT controller
  // @param tokenId_ The NFT to approve
  function approve(address approved_, uint tokenId_) external;

  // @notice Enable or disable approval for a third party ("operator") to manage
  //  all your assets.
  // @dev Throws unless `msg.sender` is the current NFT owner.
  // @dev Emits the ApprovalForAll event
  // @param operator_ Address to add to the set of authorized operators.
  // @param approved_ True if the operators is approved, false to revoke approval
  function setApprovalForAll(address operator_, bool approved_) external;

  // @notice Get the approved address for a single NFT
  // @dev Throws if `tokenId_` is not a valid NFT
  // @param tokenId_ The NFT to find the approved address for
  // @return The approved address for this NFT, or the zero address if there is none
  function getApproved(uint tokenId_) external view returns (address);

  // @notice Query if an address is an authorized operator for another address
  // @param owner_ The address that owns the NFTs
  // @param operator_ The address that acts on behalf of the owner
  // @return True if `operator_` is an approved operator for `owner_`, false otherwise
  function isApprovedForAll(address owner_, address operator_) external view returns (bool);
}