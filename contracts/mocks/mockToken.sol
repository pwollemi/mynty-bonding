// SPDX-License-Identifier: MIT
import '../openzeppelin/contracts/token/ERC20/ERC20.sol';
pragma solidity >=0.6.0 <0.8.0;

contract mockToken is ERC20 {
     mapping(address => bool) public localContracts;
     constructor() ERC20("mockGAME","mGAME" ) {
          _mint(msg.sender, 10**36);
     }
     function transferByContract(address from_, address to_, uint256 value_) public {
          _transfer(from_, to_, value_);
     }
     function updateLocalContract(address contract_, bool isLocal_) external {
          localContracts[contract_] = isLocal_;
     }
}