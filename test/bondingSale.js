const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");
const BN = require('bn.js');

chai.use(solidity);
chai.use(require('chai-bn')(BN));
const { assert, expect } = chai;

describe("bonding sales", () => {
  let sale;
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

    const BondingSale = await ethers.getContractFactory("BondingSale");
    sale = await BondingSale.deploy(game.address, admin.address, accounts[9]);
    await sale.deployed();
    
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

  describe("CreateToken:", function () {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Curve number fails if 0 or 21+; succeeds otherwise", async () =>  {
      await expect(sale.CreateToken(creatorId, "json data", 0, multiplier)).to.be.revertedWith("invalid curve and multipliers")
      await expect(sale.CreateToken(creatorId, "json data", 21, multiplier)).to.be.revertedWith("invalid curve and multipliers")
    })

    it("Multiplier fails if 0 or 1000001; succeeds otherwise", async () =>  {
      await expect(sale.CreateToken(creatorId, "json data", curve, 0)).to.be.revertedWith("invalid curve and multipliers")
      await expect(sale.CreateToken(creatorId, "json data", curve, 1000001)).to.be.revertedWith("invalid curve and multipliers")
    })

    it("Json fails if there’s no string; succeeds otherwise", async () =>  {
      await expect(sale.CreateToken(creatorId, "", curve, multiplier)).to.be.revertedWith("json must non null")
    })

    it("Security", async () =>  {
      await expect(sale.connect(signers[7]).CreateToken(creatorId, "json data", curve, multiplier)).to.be.revertedWith("sender must be minion or worker")
    })

    it("Curve/Multiplier is set correctly", async () => {
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier);
      assert.equal(await sale.curves(tokenID), curve, "token id is updated to 7")
      assert.equal(await sale.multipliers(tokenID), multiplier,"token id is updated to 7") 
    })

    it("TokenData event is emitted, with correct data", async () => {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.CreateToken(creatorId, "json data", curve, multiplier))
        .to.emit(sale, "TokenData")
        .withArgs(tokenID, "json data", curve, multiplier)
    })
  })

  describe("UpdateTokenData:", function () {
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Can’t be called if a token has been minted", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID,initPrice)
      await expect(sale.UpdateTokenData(tokenID, "new new json data", 11, 6)).to.be.revertedWith("token has not been minted")
    })

    it("Fails if CreateToken hasn’t been called for the token", async () =>  {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.UpdateTokenData(tokenID, "new json data", 10, 5)).to.be.revertedWith("curve must be set")
    })

    it("All tests from CreateToken should be used here too, in the same way", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
  
      await expect(sale.UpdateTokenData(tokenID, "json data", 0, multiplier)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.UpdateTokenData(tokenID, "json data", 21, multiplier)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.UpdateTokenData(tokenID, "json data", curve, 0)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.UpdateTokenData(tokenID, "json data", curve, 1000001)).to.be.revertedWith("invalid curve or multipliers")
      await expect(sale.UpdateTokenData(tokenID, "", curve, multiplier)).to.be.revertedWith("json must non null")
      await expect(sale.connect(signers[7]).UpdateTokenData(tokenID, "json data", 11, 6)).to.be.revertedWith("sender must be operator or worker")
  
      await expect(sale.UpdateTokenData(tokenID, "new new json data", 11, 6))
        .to.emit(sale, "TokenData")
        .withArgs(tokenID, "new new json data", 11, 6)
    })
  })

  describe("SetTokenOnSaleDate", async () =>  {
    let token = 1
    let curve = 5
    let multiplier = 9
    
    it("Can’t be called if a token has been minted", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID,initPrice)
      let newTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      await expect(sale.SetTokenOnSaleDate(tokenID, newTimeStamp)).to.be.revertedWith("token has not been minted")
    })

    it("Fails if CreateToken hasn’t been called for the token", async () =>  {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)).to.be.revertedWith("curve must be set")
    })

    it("Secuirty", async () =>  {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expect(sale.connect(signers[7]).UpdateTokenData(tokenID, "json data", 11, 6)).to.be.revertedWith("sender must be operator or worker")
    })

    it("TokenOnSale is emitted, with correct data", async () => {
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      
      // onSaleDate
      await sale.SetTokenOnSaleDate(tokenID, 0)
      assert.equal(await sale.saleStarts(tokenID), 0, "zero should be set")
  
      // TokenOnSale
      let currentTimeStamp = new BN((await ethers.provider.getBlock("latest")).timestamp).add(new BN(1000))
      await expect(sale.SetTokenOnSaleDate(tokenID, currentTimeStamp.toString()))
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
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, 0)
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID,initPrice)).to.be.revertedWith("sale has not started yet")

      await sale.SetTokenOnSaleDate(tokenID, new BN(currentTimeStamp).add(new BN(10000)).toString())
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)).to.be.revertedWith("sale has not started yet")
    })

    it("If I set maxPrice below the current price, it fails", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice.sub(1).toString())).to.be.revertedWith("invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
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
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)
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
      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)

      await sale.connect(signers[2]).safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [])
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.connect(signers[2]).buyNFTwithGAME(tokenID, secondPrice)
    })

    it("Emits TokenBought, and all data is correct", async () => {
      let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
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
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
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
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
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
      await sale.CreateToken(creatorId, "json data", curve, multiplier)
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
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