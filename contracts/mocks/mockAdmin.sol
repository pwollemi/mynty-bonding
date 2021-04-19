pragma solidity >=0.6.0 <0.8.0;

contract mockAdmin {
    mapping(address => bool) public operators;

    function isOperatorOrMinion(uint256 c, address account_)
        external
        view
        virtual
        returns (bool)
    {
        return operators[account_];
    }

    function addOperator(address a) public {
        operators[a] = true;
    }
}
