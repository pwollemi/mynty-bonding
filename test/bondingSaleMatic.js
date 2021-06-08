const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const BN = require('bn.js');

chai.use(solidity);
chai.use(require('chai-bn')(BN));
const { assert, expect } = chai;

const nativeMetaTx = require('./metaTXUtils');

const uniswapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
const gameToken = "0x8d1566569d5b695d44a9a234540f68D393cDC40D"
const gameAdmin =  "0x1d01438aa932e95e31b2585e3e27b855e6f380f7"
const gameMaster = "0x2550aa5c84edb92a66125a85527c151923be35e1"
const chainLink = "0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39"
// these are addresses on matic network, please ensure that they have enough tokens or eth
const chainLinkHoder = "0xe68b21Fa8DED7202f86d2c16911414998cA7c123"
const gameTokenHolder = "0x07FE2E1e843E73c955f1c176B4f20E7AC342d1d4"

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

function getSelectors (contract) {
  const selectors = Object.keys(contract.interface.functions).map(v => ethers.utils.id(v).slice(0, 10));
  return selectors
}

describe("bonding sales", () => {
  let sale;
  let admin;
  let game;
  let accounts, signers;
  let feeReceiver;
  let creatorId;
  let chainLinkToken

  before(async () => {
    signers = await ethers.getSigners();
    accounts = signers.map((signer) => signer.address)
    feeReceiver = accounts[6];
    creatorId = accounts[9];

    // game token (from matic)
    const mockToken = await ethers.getContractFactory("mockToken");
    game = new ethers.Contract(gameToken, mockToken.interface, ethers.provider);

    // game admin (from matic)
    const mockAdmin = await ethers.getContractFactory("mockAdmin");
    admin = new ethers.Contract(gameAdmin, mockAdmin.interface, ethers.provider);

    // get LINK for test
    const ERC20 = await ethers.getContractFactory("ERC20");
    chainLinkToken = new ethers.Contract(chainLink, ERC20.interface, ethers.provider);

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [chainLinkHoder]}
    )

    const signedLINKHolder = await ethers.provider.getSigner(chainLinkHoder);
    await chainLinkToken.connect(signedLINKHolder).transfer(accounts[2], ethers.utils.parseUnits("100", 18));

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [chainLinkHoder]}
    )

    // transfer specific amount of tokens to accounts 1 ~ 4
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [gameTokenHolder]}
    )

    const signedGAMEHolder = await ethers.provider.getSigner(gameTokenHolder);
    await game.connect(signedGAMEHolder).transfer(accounts[1], ethers.utils.parseUnits("1000", 18))
    await game.connect(signedGAMEHolder).transfer(accounts[2], ethers.utils.parseUnits("1000", 18))
    await game.connect(signedGAMEHolder).transfer(accounts[3], ethers.utils.parseUnits("1000", 18))
    await game.connect(signedGAMEHolder).transfer(accounts[4], ethers.utils.parseUnits("1000", 18))

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [gameTokenHolder]}
    )

    // add workers
    const mockMaster = await ethers.getContractFactory("mockMaster");
    let master = new ethers.Contract(gameMaster, mockMaster.interface, ethers.provider);
    const owner = await master.owner();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner]}
    )

    const signedOwner = await ethers.provider.getSigner(owner);
    for (let i = 0; i < 5; i++){
      await master.connect(signedOwner).assignWorker(accounts[i], true);
    }

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [owner]}
    )
  })

  beforeEach(async () => {
    // worker meta tx facet
    const WorkerMetaTransactions = await ethers.getContractFactory("WorkerMetaTransactions");
    const workerMetaTransactions = await WorkerMetaTransactions.deploy();
    await workerMetaTransactions.deployed();

    const diamondCut = [
      [workerMetaTransactions.address, FacetCutAction.Add, getSelectors(workerMetaTransactions)]
    ]

    // bonding sale contract
    const BondingSale = await ethers.getContractFactory("BondingSale");
    sale = await BondingSale.deploy(diamondCut, [game.address, admin.address, gameMaster]);
    await sale.deployed();
    await sale.setUniswapRouter(uniswapRouter);

    // bonding sale contract with meta tx interface
    metaTxWithSaleAddress = new ethers.Contract(sale.address, WorkerMetaTransactions.interface, ethers.provider.getSigner())

    // update local contract
    const mockMaster = await ethers.getContractFactory("mockMaster");
    let master = new ethers.Contract(gameMaster, mockMaster.interface, ethers.provider);
    const owner = await master.owner();

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [owner]}
    )

    const signedOwner = await ethers.provider.getSigner(owner);
    await metaTxWithSaleAddress.updateLocalContract(sale.address, true)
    await master.connect(signedOwner).updateLocalContract(sale.address, true);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [owner]}
    )

    // approve spending chainlink
    await chainLinkToken.connect(signers[2]).approve(sale.address, ethers.utils.parseUnits("100", 18));

    // set fee receiver
    await sale.setFEERECEIVER(feeReceiver)
  })

  describe("buyNFTwithMatic", async () =>  {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("If I set maxPrice below the current price, it fails", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithMatic(tokenID, initPrice.sub(1).toString())).to.be.revertedWith("invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      const maticBalanceBefore = await signers[2].getBalance()
      const creatorBalanceBefore = await game.balanceOf(creatorId)
      const feeReceiverBalanceBefore = await game.balanceOf(feeReceiver)
      const lockedUpBefore = await game.balanceOf(sale.address)

      await sale.toggleTokenMinting()
      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, initPrice, { value: ethers.utils.parseEther("1") });

      const maticBalanceAfter = await signers[2].getBalance()
      const creatorBalanceAfter = await game.balanceOf(creatorId)
      const feeReceiverBalanceAfter = await game.balanceOf(feeReceiver)
      const lockedUpAfter = await game.balanceOf(sale.address)
      console.log("Mint cost(Matic)", maticBalanceAfter - maticBalanceBefore)
      console.log("Creator Balance increase:", creatorBalanceAfter - creatorBalanceBefore)     
      console.log("Fee Receiver Balance increase:", feeReceiverBalanceAfter - feeReceiverBalanceBefore)     
      console.log("Bonding Lockedup Balance increase:", lockedUpAfter - lockedUpBefore)

      assert.equal(initPrice * 0.9, lockedUpAfter - lockedUpBefore, "90% should go into the contract for bonding lockup")
      assert.equal(initPrice * 0.08, creatorBalanceAfter - creatorBalanceBefore, "8% should go into the creator’s account")
      assert.equal(initPrice * 0.02, feeReceiverBalanceAfter - feeReceiverBalanceBefore, "2% should go into our fee receiver")

      const sellPrice = await sale.getSellPrice(tokenID)
      assert.equal(initPrice * 0.9, sellPrice, "must equal to getSellPrice")
    })

    it("I now own one token", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, initPrice, { value: ethers.utils.parseEther("1") })
      const tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")
    })

    it("I can transfer my token to another address, and then buy a new one", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let secondPrice = await sale.getPrintPrice(tokenID, 2)
      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, initPrice, { value: ethers.utils.parseEther("1") })

      await sale.connect(signers[2]).safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [])
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, secondPrice, { value: ethers.utils.parseEther("1") })
    })

    it("Emits TokenBought, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithMatic(tokenID, initPrice, { value: ethers.utils.parseEther("1") }))
        .to.emit(sale, "TokenBought")
        .withArgs(
          accounts[2],
          tokenID,
          initPrice,
          await sale.getBuyPrice(tokenID),
          await sale.getSellPrice(tokenID),
          1,
          new BN(initPrice * 0.08),
          initPrice,
          creatorId)
    })
  })

  describe("buyNFTwithERC20", async () =>  {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("If I set maxPrice below the current price, it fails", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithERC20(tokenID, initPrice.sub(1).toString(), chainLink)).to.be.revertedWith("invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      const maticBalanceBefore = await signers[2].getBalance()
      const creatorBalanceBefore = await game.balanceOf(creatorId)
      const feeReceiverBalanceBefore = await game.balanceOf(feeReceiver)
      const lockedUpBefore = await game.balanceOf(sale.address)

      await sale.toggleTokenMinting()
      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, initPrice, chainLink);

      const maticBalanceAfter = await signers[2].getBalance()
      const creatorBalanceAfter = await game.balanceOf(creatorId)
      const feeReceiverBalanceAfter = await game.balanceOf(feeReceiver)
      const lockedUpAfter = await game.balanceOf(sale.address)
      console.log("Mint cost(Matic)", maticBalanceBefore - maticBalanceAfter)
      console.log("Creator Balance increase:", creatorBalanceAfter - creatorBalanceBefore)     
      console.log("Fee Receiver Balance increase:", feeReceiverBalanceAfter - feeReceiverBalanceBefore)     
      console.log("Bonding Lockedup Balance increase:", lockedUpAfter - lockedUpBefore)

      assert.equal(initPrice * 0.9, lockedUpAfter - lockedUpBefore, "90% should go into the contract for bonding lockup")
      assert.equal(initPrice * 0.08, creatorBalanceAfter - creatorBalanceBefore, "8% should go into the creator’s account")
      assert.equal(initPrice * 0.02, feeReceiverBalanceAfter - feeReceiverBalanceBefore, "2% should go into our fee receiver")

      const sellPrice = await sale.getSellPrice(tokenID)
      assert.equal(initPrice * 0.9, sellPrice, "must equal to getSellPrice")
    })

    it("I now own one token", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, initPrice, chainLink)
      const tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")
    })

    it("I can transfer my token to another address, and then buy a new one", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let secondPrice = await sale.getPrintPrice(tokenID, 2)
      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, initPrice, chainLink)

      await sale.connect(signers[2]).safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [])
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, secondPrice, chainLink)
    })

    it("Emits TokenBought, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithERC20(tokenID, initPrice, chainLink))
        .to.emit(sale, "TokenBought")
        .withArgs(
          accounts[2],
          tokenID,
          initPrice,
          await sale.getBuyPrice(tokenID),
          await sale.getSellPrice(tokenID),
          1,
          new BN(initPrice * 0.08),
          initPrice,
          creatorId)
    })
  })

  describe("Meta Tx", async () => {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("makes meta tx calls", async function () {
      const sender = 0;
      const relayer = 1;
      const isWorker = true;

      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      const create = sale.interface.encodeFunctionData("CreateToken", [creatorId, "json data", curve, multiplier])
      const setDate = sale.interface.encodeFunctionData("SetTokenOnSaleDate", [tokenID, currentTimeStamp])
      const toggleTokenMinting = sale.interface.encodeFunctionData("toggleTokenMinting", [])
      const buy = sale.interface.encodeFunctionData("buyNFTwithGAME", [tokenID, ethers.utils.parseUnits("10", 18)])

      let funcs = [create, setDate, toggleTokenMinting]

      for(let i = 0; i < funcs.length; i++) {
          console.log(`making call ${i}`)
          const { from, r, s, v, replayProtection } = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, funcs[i], sender, isWorker);
          console.log(`call is from ${from}`)
          await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, funcs[i], from, r, s, v, relayer, isWorker, replayProtection);
      }

      console.log(`making call ${3}`)
      const { from, r, s, v, replayProtection } = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, buy, 2, isWorker);
      console.log(`call is from ${from}`)
      await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, buy, from, r, s, v, relayer, isWorker, replayProtection);
    });
  })  
})