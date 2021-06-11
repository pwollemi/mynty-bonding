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
const wMatic = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const quick = "0x831753DD7087CaC61aB5644b308642cc1c33Dc13";
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
  let swapRouter;
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
    game = await ethers.getContractAt("mockToken", gameToken);

    // game admin (from matic)
    admin = await ethers.getContractAt("mockAdmin", gameAdmin);

    // get LINK for test
    chainLinkToken = await ethers.getContractAt("ERC20", chainLink);

    // get uniswap router
    swapRouter = await ethers.getContractAt("IUniswapV2Router02", uniswapRouter)

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
    sale = await BondingSale.deploy(diamondCut, [game.address, admin.address, gameMaster, feeReceiver]);
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
    let path = [wMatic, quick, gameToken];

    it("If I set maxPrice below the current price, it fails", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInMatic = amountsIn[0]
      await expect(sale.connect(signers[2]).buyNFTwithMatic(tokenID, priceInMatic.div(2).toString(), path)).to.be.revertedWith("invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInMatic = amountsIn[0]

      await sale.toggleTokenMinting()

      const maticBalanceBefore = await signers[2].getBalance()
      const creatorBalanceBefore = await game.balanceOf(creatorId)
      const feeReceiverBalanceBefore = await game.balanceOf(feeReceiver)
      const lockedUpBefore = await game.balanceOf(sale.address)

      let tx = await sale.connect(signers[2]).buyNFTwithMatic(tokenID, priceInMatic, path, { value: ethers.utils.parseEther("1") });
      let txReceipt = await tx.wait()

      const gasUsed = txReceipt.gasUsed.mul(tx.gasPrice)
      const estCost = gasUsed.add(priceInMatic)
      const maticBalanceAfter = await signers[2].getBalance()
      const creatorBalanceAfter = await game.balanceOf(creatorId)
      const feeReceiverBalanceAfter = await game.balanceOf(feeReceiver)
      const lockedUpAfter = await game.balanceOf(sale.address)
      const realCost = maticBalanceBefore.sub(maticBalanceAfter)
      console.log("Price(Matic)", priceInMatic.toString())
      console.log("Est total cost", estCost.toString())
      console.log("Real cost(Matic)", realCost.toString())
      console.log("Creator Balance increase:", creatorBalanceAfter - creatorBalanceBefore)     
      console.log("Fee Receiver Balance increase:", feeReceiverBalanceAfter - feeReceiverBalanceBefore)     
      console.log("Bonding Lockedup Balance increase:", lockedUpAfter - lockedUpBefore)

      assert.equal(estCost.toString(), realCost.toString(), "Cost should be the same")
      assert.equal(initPrice * 0.9, lockedUpAfter - lockedUpBefore, "90% should go into the contract for bonding lockup")
      assert.equal(initPrice * 0.08, creatorBalanceAfter - creatorBalanceBefore, "8% should go into the creator’s account")
      assert.equal(initPrice * 0.02, feeReceiverBalanceAfter - feeReceiverBalanceBefore, "2% should go into our fee receiver")

      const sellPrice = await sale.getSellPrice(tokenID)
      assert.equal(initPrice * 0.9, sellPrice, "must equal to getSellPrice")
    })

    it("I now own one token", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInMatic = amountsIn[0]
      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, priceInMatic, path, { value: ethers.utils.parseEther("1") })
      const tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")
    })

    it("I can transfer my token to another address, and then buy a new one", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let secondPrice = await sale.getPrintPrice(tokenID, 2)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInMatic = amountsIn[0]
      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, priceInMatic, path, { value: priceInMatic })

      await sale.connect(signers[2]).safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [])
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      amountsIn = await swapRouter.getAmountsIn(secondPrice, path)
      let secondPriceInMatic = amountsIn[0]
      await sale.connect(signers[2]).buyNFTwithMatic(tokenID, secondPriceInMatic, path, { value: secondPriceInMatic })
    })

    it("Emits TokenBought, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInMatic = amountsIn[0]
      await expect(sale.connect(signers[2]).buyNFTwithMatic(tokenID, priceInMatic, path, { value: ethers.utils.parseEther("1") }))
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
    let path = [chainLink, quick, gameToken]

    it("If I set maxPrice below the current price, it fails", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInERC20 = amountsIn[0]
      await expect(sale.connect(signers[2]).buyNFTwithERC20(tokenID, priceInERC20.div(2).toString(), path)).to.be.revertedWith("invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInERC20 = amountsIn[0]

      await sale.toggleTokenMinting()

      const erc20BalanceBefore = await chainLinkToken.balanceOf(accounts[2])
      const creatorBalanceBefore = await game.balanceOf(creatorId)
      const feeReceiverBalanceBefore = await game.balanceOf(feeReceiver)
      const lockedUpBefore = await game.balanceOf(sale.address)

      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, priceInERC20, path);

      const erc20BalanceAfter = await chainLinkToken.balanceOf(accounts[2])
      const erc20Cost = erc20BalanceBefore.sub(erc20BalanceAfter)
      const creatorBalanceAfter = await game.balanceOf(creatorId)
      const feeReceiverBalanceAfter = await game.balanceOf(feeReceiver)
      const lockedUpAfter = await game.balanceOf(sale.address)
      console.log("Price(ERC20)", priceInERC20.toString())
      console.log("Mint cost(ERC20)", erc20Cost.toString())
      console.log("Creator Balance increase:", creatorBalanceAfter - creatorBalanceBefore)     
      console.log("Fee Receiver Balance increase:", feeReceiverBalanceAfter - feeReceiverBalanceBefore)     
      console.log("Bonding Lockedup Balance increase:", lockedUpAfter - lockedUpBefore)

      assert.equal(priceInERC20.toString(), erc20Cost.toString(), "cost should be the same")
      assert.equal(initPrice * 0.9, lockedUpAfter - lockedUpBefore, "90% should go into the contract for bonding lockup")
      assert.equal(initPrice * 0.08, creatorBalanceAfter - creatorBalanceBefore, "8% should go into the creator’s account")
      assert.equal(initPrice * 0.02, feeReceiverBalanceAfter - feeReceiverBalanceBefore, "2% should go into our fee receiver")

      const sellPrice = await sale.getSellPrice(tokenID)
      assert.equal(initPrice * 0.9, sellPrice, "must equal to getSellPrice")
    })

    it("I now own one token", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInERC20 = amountsIn[0]
      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, priceInERC20, path)
      const tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")
    })

    it("I can transfer my token to another address, and then buy a new one", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInERC20 = amountsIn[0]
      let secondPrice = await sale.getPrintPrice(tokenID, 2)
      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, priceInERC20, path)

      await sale.connect(signers[2]).safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [])
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      amountsIn = await swapRouter.getAmountsIn(secondPrice, path)
      let secondPriceInERC20 = amountsIn[0]
      await sale.connect(signers[2]).buyNFTwithERC20(tokenID, secondPriceInERC20, path)
    })

    it("Emits TokenBought, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let amountsIn = await swapRouter.getAmountsIn(initPrice, path)
      let priceInERC20 = amountsIn[0]
      await expect(sale.connect(signers[2]).buyNFTwithERC20(tokenID, priceInERC20, path))
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
      const create = sale.interface.encodeFunctionData("createToken", [creatorId, "json data", curve, multiplier])
      const setDate = sale.interface.encodeFunctionData("setTokenOnSaleDate", [tokenID, currentTimeStamp])
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

    it("permission check", async function () {
      const admin = 0;
      const sender = 7;
      const relayer = 1;
      const isWorker = true;

      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      const create = sale.interface.encodeFunctionData("createToken", [creatorId, "json data", curve, multiplier])
      const setDate = sale.interface.encodeFunctionData("setTokenOnSaleDate", [tokenID, currentTimeStamp])
      const toggleTokenMinting = sale.interface.encodeFunctionData("toggleTokenMinting", [])

      console.log("createToken should fail")
      let sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("revert Function call not successful");

      console.log("createToken should success")
      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, admin, isWorker);
      await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection);

      console.log("setTokenOnSaleDate should fail")
      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, setDate, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, setDate, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("revert Function call not successful");

      console.log("toggleTokenMinting")
      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, toggleTokenMinting, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, toggleTokenMinting, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection)).to.be.reverted;
    });

    it("wrong r, s", async () => {
      const sender = 0;
      const relayer = 1;
      const isWorker = true;

      const create = sale.interface.encodeFunctionData("createToken", [creatorId, "json data", curve, multiplier])

      let sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.s, sig.s, sig.v, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.r, sig.v, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection);
    });

    it("wrong v", async () => {
      const sender = 0;
      const relayer = 1;
      const isWorker = true;

      const create = sale.interface.encodeFunctionData("createToken", [creatorId, "json data", curve, multiplier])

      let sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v + 1, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v - 1, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, 0, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, 1, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, 2, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v == 27 ? 28: 27, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection);
    });

    it("wrong from", async () => {
      const sender = 0;
      const relayer = 1;
      const isWorker = true;

      const create = sale.interface.encodeFunctionData("createToken", [creatorId, "json data", curve, multiplier])

      let sig = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, accounts[9], sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection)).to.be.revertedWith("Signer and signature do not match");

      await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, sig.from, sig.r, sig.s, sig.v, relayer, isWorker, sig.replayProtection);
    });

    it("replay protection", async () => {
      const sender = 0;
      const relayer = 1;
      const isWorker = true;

      const create = sale.interface.encodeFunctionData("createToken", [creatorId, "json data", curve, multiplier])
      const { from, r, s, v, replayProtection } = await nativeMetaTx.getMetaTxSignature(metaTxWithSaleAddress, create, sender, isWorker);

      await nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, from, r, s, v, relayer, isWorker, replayProtection);
      await expect(nativeMetaTx.sendWorkerOrNormalTx(metaTxWithSaleAddress, create, from, r, s, v, relayer, isWorker, replayProtection)).to.be.revertedWith("REPLAY of a previous transaction");
    })
  })
})