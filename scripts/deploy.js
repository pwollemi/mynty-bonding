const { ethers } = require("hardhat");

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

function getSelectors (contract) {
  const selectors = Object.keys(contract.interface.functions).map(v => ethers.utils.id(v).slice(0, 10));
  // const selectors = contract.abi.reduce((acc, val) => {
  //   if (val.type === 'function') {
  //     acc.push(val.signature)
  //     return acc
  //   } else {
  //     return acc
  //   }
  // }, [])
  return selectors
}

async function main() {
  const [deployer ] = await ethers.getSigners();

  const addr = await deployer.getAddress() 
  console.log(await deployer.getAddress());
  console.log((await deployer.getBalance()).toString());
  console.log("1 --------");
  const WorkerMetaTransactions = await ethers.getContractFactory("WorkerMetaTransactions");
  console.log("2 --------");
  const workerMetaTransactions = await WorkerMetaTransactions.deploy();
  console.log("3 --------");
  await workerMetaTransactions.deployed();
  console.log("WorkerMetaTransactions address:", workerMetaTransactions.address);

  const diamondCut = [
    [workerMetaTransactions.address, FacetCutAction.Add, getSelectors(workerMetaTransactions)]
  ]
  const BondingSale = await ethers.getContractFactory("BondingSale");
  const bondingSale = await BondingSale.deploy(diamondCut, [addr, addr, addr]);
  await bondingSale.deployed();
  console.log("BondingSale address:", bondingSale.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
