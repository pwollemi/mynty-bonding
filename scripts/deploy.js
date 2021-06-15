const { ethers } = require("hardhat");

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

const isMumbai = true;

// Addresses for Matic Mumbai contracts
const mumbai_gateway = "0xb5505a6d998549090530911180f38aC5130101c6"; // used for deploying testtokens
const mumbai_wmatic = "0xd8b90bb9253980967dE87A23009e56E6CC8B7cE6"; // Used for deploying uniswap router
const mumbai_uniswap_factory = "0x5418dc4506481407FdfcAdE334374DF4fC221c23";
const mumbai_uniswap_router = "0x1e860A6870ae89Ecd74a0fdF8EeF3b606946f339";
const mumbai_game_erc20 = "0xa1FB4a6474661114cf865B062B7C669d936b0896";
const mumbai_game_game = "0xf6c213D3076bc22dAC297Bbad7A6d134ebea8025";
const mumbai_game_master = "0x9f84EaeA0155A17C5eea7F3579ac4783a51E7B14";
const mumbai_fee_receiver = mumbai_game_erc20; // having the erc20 as the fee receiver allows our cfo role to withdraw funds
const mumbai_quick_testtoken = "0x7aD20222E855CD854B15364f55896599eBbC769B";
const mumbai_usdc_testtoken = "0xA0fb4A353B60B6Ef6ef9BA87F4B09680605a7932";
const mumbai_usdt_testtoken = "0xD7De69D7e1ecf87f8dE45E017f7C9fDf24F14d8E";

// DEPLOYED WorkerMetaTransactions:    0x6e6d713364A151EedAc47738723ddfB34AB07A84
// DEPLOYED BondingSale:               0xAdEdf50F693f03D8bfE73e67C7D4Af06d782e803

const mumbai_addresses = [mumbai_game_erc20, mumbai_game_game, mumbai_game_master, mumbai_fee_receiver];

// Addresses for testnet
const mainnet_uniswap_router = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
const mainnet_game_erc20 = "0x8d1566569d5b695d44a9a234540f68D393cDC40D"
const mainnet_game_game =  "0x1d01438aa932e95e31b2585e3e27b855e6f380f7"
const mainnet_game_master = "0x2550aa5c84edb92a66125a85527c151923be35e1"
const mainnet_fee_receiver = mainnet_game_erc20;

// Select addresses based on target network
const erc20Address = isMumbai ? mumbai_game_erc20 : mainnet_game_erc20;
const gameDataAddress = isMumbai ? mumbai_game_game : mainnet_game_game;
const masterAddress = isMumbai ? mumbai_game_master : mainnet_game_master;
const feeAddress = erc20Address;
const routerAddress = isMumbai ? mumbai_uniswap_router : mainnet_uniswap_router;

function getSelectors (contract) {
  const selectors = Object.keys(contract.interface.functions).map(v => ethers.utils.id(v).slice(0, 10));
  return selectors
}

// WARNING: This deploys from the flattened files (BondedNFT.sol and WorkerMetaTX.sol)
// To update flattened files, run "npm run flatten", then clean out the SPDX identifiers and pragmas, then copy the code
// into BondedNFT.sol and WorkerMetaTX.sol (the flattener does not automatically overwrite those files)
const metaTxArtifact = isMumbai ? "WorkerMetaTx" : "WorkerMetaTransactions";
const bondedNFTArtifact = isMumbai ? "BondedNFT" : "BondingSale";

async function main() {
  const WorkerMetaTransactions = await ethers.getContractFactory(metaTxArtifact);
  const workerMetaTransactions = await WorkerMetaTransactions.deploy();
  await workerMetaTransactions.deployed();
  console.log("WorkerMetaTransactions address:", workerMetaTransactions.address);

  const BondingSale = await ethers.getContractFactory(bondedNFTArtifact);
  const bondingSale = await BondingSale.deploy(erc20Address, gameDataAddress, masterAddress, feeAddress);
  await bondingSale.deployed();
  await bondingSale.setFacet(workerMetaTransactions.address, FacetCutAction.Add, getSelectors(workerMetaTransactions));
  await bondingSale.setUniswapRouter(routerAddress);
  console.log("BondingSale address:", bondingSale.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
