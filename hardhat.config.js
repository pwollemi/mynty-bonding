require("@nomiclabs/hardhat-truffle5");
require('hardhat-gas-reporter')
require("hardhat-tracer");
require('hardhat-contract-sizer')

module.exports = {
  
  solidity: {
    compilers: [{ version: "0.7.3", settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    } }, { version: "0.6.6", settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    }}],
    
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 150,
  },
};

