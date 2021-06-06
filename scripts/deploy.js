const { ethers } = require("hardhat");

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

function getSelectors (contract) {
  const selectors = Object.keys(contract.interface.functions).map(v => ethers.utils.id(v).slice(0, 10));
  return selectors
}

const uniswapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
const gameToken = "0x8d1566569d5b695d44a9a234540f68D393cDC40D"
const gameAdmin =  "0x1d01438aa932e95e31b2585e3e27b855e6f380f7"
const gameMaster = "0x2550aa5c84edb92a66125a85527c151923be35e1"

async function main() {
  const WorkerMetaTransactions = await ethers.getContractFactory("WorkerMetaTransactions");
  const workerMetaTransactions = await WorkerMetaTransactions.deploy();
  await workerMetaTransactions.deployed();
  console.log("WorkerMetaTransactions address:", workerMetaTransactions.address);

  const diamondCut = [
    [workerMetaTransactions.address, FacetCutAction.Add, getSelectors(workerMetaTransactions)]
  ]
  const BondingSale = await ethers.getContractFactory("BondingSale");
  const bondingSale = await BondingSale.deploy(diamondCut, [gameToken, gameAdmin, gameMaster]);
  await bondingSale.deployed();
  await bondingSale.setUniswapRouter(uniswapRouter);
  console.log("BondingSale address:", bondingSale.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
