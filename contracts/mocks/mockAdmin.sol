pragma solidity >=0.6.0 <0.8.0;

contract mockAdmin {
    function isOperatorOrMinion(uint256 c, address account_)
        external
        view
        virtual
        returns (bool)
    {
        return true;
    }
}
