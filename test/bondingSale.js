const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const BN = require('bn.js');

chai.use(solidity);
chai.use(require('chai-bn')(BN));
const { assert, expect } = chai;

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
  let sale, metaTxWithSaleAddress;
  let admin;
  let game;
  let accounts, signers;
  let feeReceiver;
  let creatorId;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    accounts = signers.map((signer) => signer.address)
    feeReceiver = accounts[6];
    creatorId = accounts[9];

    const mockToken = await ethers.getContractFactory("mockToken");
    game = await mockToken.deploy();
    await game.deployed();

    const mockAdmin = await ethers.getContractFactory("mockAdmin");
    admin = await mockAdmin.deploy();
    await admin.deployed();

    const WorkerMetaTransactions = await ethers.getContractFactory("WorkerMetaTransactions");
    const workerMetaTransactions = await WorkerMetaTransactions.deploy();
    await workerMetaTransactions.deployed();
  
    const diamondCut = [
      [workerMetaTransactions.address, FacetCutAction.Add, getSelectors(workerMetaTransactions)]
    ]
    const BondingSale = await ethers.getContractFactory("BondingSale");
    sale = await BondingSale.deploy(diamondCut, [game.address, admin.address, accounts[9], feeReceiver]);
    await sale.deployed();
  
    metaTxWithSaleAddress = new ethers.Contract(sale.address, WorkerMetaTransactions.interface, ethers.provider)

    // add all accounts as operators
    for (let i = 0; i < 5; i++){
      await admin.addOperator(accounts[i])
    }

    // transfer specific amount of tokens to accounts 1 ~ 4
    await game.transfer(accounts[1], '100000000000000000000000')
    await game.transfer(accounts[2], '100000000000000000000000')
    await game.transfer(accounts[3], '100000000000000000000000')
    await game.transfer(accounts[4], '100000000000000000000000')

    // set fee receiver
    await sale.setFEERECEIVER(feeReceiver)
  });

  describe("Security:", function () {
    it("setUniswapRouter", async() => {
      await expect(sale.connect(signers[6]).setUniswapRouter("0x0")).to.be.reverted;
    })

    it("setFEERECEIVER", async() => {
      await expect(sale.connect(signers[6]).setFEERECEIVER("0x0")).to.be.reverted;
    })

    it("toggleTokenMinting", async() => {
      await expect(sale.connect(signers[6]).toggleTokenMinting()).to.be.reverted;
    })

    it("toggleTokenBurning", async() => {
      await expect(sale.connect(signers[6]).toggleTokenBurning()).to.be.reverted;
    })
  })

  describe("createToken:", function () {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Curve number fails if 0 or 21+; succeeds otherwise", async () =>  {
      await expect(sale.createToken(creatorId, "json data", 0, multiplier)).to.be.revertedWith("invalid curve and multipliers")
      await expect(sale.createToken(creatorId, "json data", 21, multiplier)).to.be.revertedWith("invalid curve and multipliers")
    })

    it("Multiplier fails if 0 or 1000001; succeeds otherwise", async () =>  {
      await expect(sale.createToken(creatorId, "json data", curve, 0)).to.be.revertedWith("invalid curve and multipliers")
      await expect(sale.createToken(creatorId, "json data", curve, 1000001)).to.be.revertedWith("invalid curve and multipliers")
    })

    it("Json fails if there’s no string; succeeds otherwise", async () =>  {
      await expect(sale.createToken(creatorId, "", curve, multiplier)).to.be.revertedWith("json must non null")
    })

    it("Security", async () =>  {
      await expect(sale.connect(signers[7]).createToken(creatorId, "json data", curve, multiplier)).to.be.revertedWith("sender must be operator or minion")
    })

    it("Curve/Multiplier is set correctly", async () => {
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier);
      assert.equal(await sale.curves(tokenID), curve, "token id is updated to 7")
      assert.equal(await sale.multipliers(tokenID), multiplier,"token id is updated to 7") 
    })

    it("TokenData event is emitted, with correct data", async () => {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.createToken(creatorId, "json data", curve, multiplier))
        .to.emit(sale, "TokenData")
        .withArgs(tokenID, "json data", curve, multiplier)
    })
  })

  describe("getPrintPrice:", function () {
    let data = [
      [1, 1, 1, "51000000000000000"],
      [1, 2, 1, "52000000000000000"],
      [1, 10, 1, "171000000000000000"],
      [1, 100, 1, "111261000000000000000"],
      [1, 997, 1, "110115155000000000000000"],
      [1, 1571, 1, "430811888000000000000000"],
      [4, 1, 1, "12000000000000000"],
      [4, 2, 1, "12000000000000000"],
      [4, 10, 1, "13000000000000000"],
      [4, 100, 1, "56000000000000000"],
      [4, 997, 1, "37836000000000000000"],
      [4, 1571, 1, "147850000000000000000"],
      [10, 1, 1, "5000000000000000"],
      [10, 2, 1, "5000000000000000"],
      [10, 10, 1, "5000000000000000"],
      [10, 100, 1, "6000000000000000"],
      [10, 997, 1, "14000000000000000"],
      [10, 1571, 1, "20000000000000000"],
      [1, 1, 1001, "51162000000000000000"],
      [1, 2, 1001, "52940000000000000000"],
      [1, 10, 1001, "171282000000000000000"],
      [1, 100, 1001, "111372372000000000000000"],
      [1, 997, 1001, "110225270266000000000000000"],
      [1, 1571, 1001, "431242700776000000000000000"],
      [4, 1, 1001, "12574000000000000000"],
      [4, 2, 1001, "12637000000000000000"],
      [4, 10, 1001, "13176000000000000000"],
      [4, 100, 1001, "56909000000000000000"],
      [4, 997, 1001, "37874688000000000000000"],
      [4, 1571, 1001, "147998684000000000000000"],
      [10, 1, 1001, "5015000000000000000"],
      [10, 2, 1001, "5025000000000000000"],
      [10, 10, 1001, "5105000000000000000"],
      [10, 100, 1001, "6006000000000000000"],
      [10, 997, 1001, "15012000000000000000"],
      [10, 1571, 1001, "20841000000000000000"],
      [1, 1, 999999, '51110948000000000000000'],
      [1, 2, 999999, "52887947000000000000000"],
      [1, 10, 999999, "171110828000000000000000"],
      [1, 100, 999999, "111260999738000000000000000"],
      [1, 997, 999999, "110115044995844000000000000000"],
      [1, 1571, 999999, "430811458076111000000000000000"],
      [4, 1, 999999, "12561987000000000000000"],
      [4, 2, 999999, "12624987000000000000000"],
      [4, 10, 999999, "13162986000000000000000"],
      [4, 100, 999999, "56852943000000000000000"],
      [4, 997, 999999, "37836814163000000000000000"],
      [4, 1571, 999999, "147850686149000000000000000"],
      [10, 1, 999999, "5009994000000000000000"],
      [10, 2, 999999, "5019994000000000000000"],
      [10, 10, 999999, "5099994000000000000000"],
      [10, 100, 999999, "5999994000000000000000"],
      [10, 997, 999999, "14997985000000000000000"],
      [10, 1571, 999999, "20820979000000000000000"]
    ]

    let curves = [1, 4, 10]
    let tokenN = [1, 2, 10, 100, 997, 1571]
    let multipliers = [1, 1001, 999999]

    let printPrices = {}
    for (let i = 0; i < data.length; i++) {
      let curve = printPrices[data[i][0]] || {}
      let token = curve[data[i][1]] || {}
      token[data[i][2]] = data[i][3]
      curve[data[i][1]] = token
      printPrices[data[i][0]] = curve
    }

    it("Print price matches expected prices for curves,token and mutlipliers", async () => {
      let tokenID = await sale.getTokenID(accounts[9], 1)
      await sale.createToken(accounts[9], "json data", 20, 1)
      let printPrice = await sale.getPrintPrice(tokenID, 1)
      assert.equal(printPrice.toString(), "2000000000000000", "print price expectations should be matched")

      tokenID = await sale.getTokenID(creatorId, 1)
      await sale.createToken(creatorId, "json data", 1, 1)
      for (let i = 0; i < tokenN.length; i ++) {
        let printNumber = tokenN[i]
        for (let j = 0; j < curves.length; j++) {
          let curve = curves[j]
          for (let k = 0; k < multipliers.length; k++) {
            let multiplier = multipliers[k]

            await sale.updateTokenData(tokenID, "json data", curve, multiplier)
            let printPrice = await sale.getPrintPrice(tokenID, printNumber)
            assert.equal(printPrice.toString(), printPrices[curve][printNumber][multiplier], "print price expectations should be matched")
          }
        }
      }
    })
  })

  describe("updateTokenData:", function () {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Can’t be called if a token has been minted", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID,initPrice)
      await expect(sale.updateTokenData(tokenID, "new new json data", 11, 6)).to.be.revertedWith("token has not been minted")
    })

    it("Fails if createToken hasn’t been called for the token", async () =>  {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.updateTokenData(tokenID, "new json data", 10, 5)).to.be.revertedWith("curve must be set")
    })

    it("All tests from createToken should be used here too, in the same way", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
  
      await expect(sale.updateTokenData(tokenID, "json data", 0, multiplier)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.updateTokenData(tokenID, "json data", 21, multiplier)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.updateTokenData(tokenID, "json data", curve, 0)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.updateTokenData(tokenID, "json data", curve, 1000001)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.updateTokenData(tokenID, "", curve, multiplier)).to.be.revertedWith("json must non null")
      await expect(sale.connect(signers[7]).updateTokenData(tokenID, "json data", 11, 6)).to.be.revertedWith("sender must be operator or minion")
  
      await expect(sale.updateTokenData(tokenID, "new new json data", 11, 6))
        .to.emit(sale, "TokenData")
        .withArgs(tokenID, "new new json data", 11, 6)
    })
  })

  describe("setTokenOnSaleDate", async () =>  {
    let token = 1
    let curve = 5
    let multiplier = 9
    
    it("Can’t be called if a token has been minted", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID,initPrice)
      let newTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      await expect(sale.setTokenOnSaleDate(tokenID, newTimeStamp)).to.be.revertedWith("token has not been minted")
    })

    it("Fails if createToken hasn’t been called for the token", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.setTokenOnSaleDate(tokenID, currentTimeStamp)).to.be.revertedWith("curve must be set")
    })

    it("Security", async () =>  {
      let tokenID = await sale.getTokenID(creatorId, token)
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await expect(sale.connect(signers[7]).setTokenOnSaleDate(tokenID, currentTimeStamp)).to.be.revertedWith("sender must be operator or minion")
    })

    it("TokenOnSale is emitted, with correct data", async () => {
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      
      // onSaleDate
      await sale.setTokenOnSaleDate(tokenID, 0)
      assert.equal(await sale.saleStarts(tokenID), 0, "zero should be set")
  
      // TokenOnSale
      let currentTimeStamp = new BN((await ethers.provider.getBlock("latest")).timestamp).add(new BN(1000))
      await expect(sale.setTokenOnSaleDate(tokenID, currentTimeStamp.toString()))
        .to.emit(sale, "TokenOnSale")
        .withArgs(tokenID, currentTimeStamp)
    })
  })

  describe("buyNFTwithGAME", async () =>  {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Can’t buy if timestamp is before saleStarts, or timestamp is equal to zero ", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp

      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, 0)
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID,initPrice)).to.be.revertedWith("sale has not started yet")

      await sale.setTokenOnSaleDate(tokenID, new BN(currentTimeStamp).add(new BN(10000)).toString())
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)).to.be.revertedWith("sale has not started yet")
    })

    it("If I set maxPrice below the current price, it fails", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice.sub(1).toString())).to.be.revertedWith("invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      console.log("Price of token:", initPrice.toString())

      const creatorBalanceBefore = await game.balanceOf(creatorId)
      const feeReceiverBalanceBefore = await game.balanceOf(feeReceiver)
      const lockedUpBefore = await game.balanceOf(sale.address)
      console.log(creatorBalanceBefore, feeReceiverBalanceBefore, lockedUpBefore)

      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)

      const creatorBalanceAfter = await game.balanceOf(creatorId)
      const feeReceiverBalanceAfter = await game.balanceOf(feeReceiver)
      const lockedUpAfter = await game.balanceOf(sale.address)
      console.log(creatorBalanceAfter, feeReceiverBalanceAfter, lockedUpAfter)
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
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)
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
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)

      await sale.connect(signers[2]).safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [])
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, secondPrice)
    })

    it("Emits TokenBought, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice))
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

  describe("Burn", async () =>  {
    let token = 1
    let curve = 5
    let multiplier = 9

    // it("If I mint 100 of one token then burn all 100, the bonding contract balance ends at 0 (you’ll need 100 different eth addresses to do this one)", async () => {
    // })

    it("My token balance ends at 0", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)
      let tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.toggleTokenBurning()
      await sale.connect(signers[2]).burn(tokenID)
      
      tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 0, "should be zero")
    })

    it("I receive the correct amount ", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)
      let tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      const userBalanceBeforeBurn = await game.balanceOf(accounts[2])
      await sale.toggleTokenBurning()
      await sale.connect(signers[2]).burn(tokenID)
      const userBalanceAfterBurn = await game.balanceOf(accounts[2])
      
      let sellPrice = await sale.getSellPrice(tokenID)
      tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 0, "should be zero")
      assert.equal(sellPrice.eq(userBalanceAfterBurn.sub(userBalanceBeforeBurn)), true)
    })

    it("Emits TokenBurned, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.createToken(creatorId, "json data", curve, multiplier)
      await sale.setTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)
      await sale.toggleTokenBurning()

      await expect(sale.connect(signers[2]).burn(tokenID))
        .to.emit(sale, "TokenBurned")
        .withArgs(
          accounts[2],
          tokenID,
          new BN((initPrice * 0.9).toString()),
          await sale.getBuyPrice(tokenID),
          await sale.getSellPrice(tokenID),
          0,
          new BN((initPrice * 0.9).toString()),
        )
    })
  })
})