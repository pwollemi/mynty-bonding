
pragma solidity >=0.6.0 <0.8.0;

contract mockAdmin{


      function isWorkerOrMinion(address account_) virtual external view returns (bool){
          return true;
      }
}