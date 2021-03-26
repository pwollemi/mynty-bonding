import '../openzeppelin/contracts/token/ERC20/ERC20.sol';
pragma solidity >=0.6.0 <0.8.0;


contract mockToken is ERC20{
    constructor() ERC20("mockGAME","mGAME" ) public{
         _mint(msg.sender, 10**36);
    }
    function transferByContract(address from_, address to_, uint256 value_) public {
         _transfer(from_, to_, value_);
    }
}