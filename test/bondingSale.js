const SALE = artifacts.require("bondingSale");
const ADMIN= artifacts.require("mockAdmin")
const GAME = artifacts.require("mockToken")

let utils=require('web3-utils')
const {
  BN,           // Big Number support 
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert,
  increase,
  increastTo,
  time, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');
const { assert, expect } = require('hardhat');

contract("bonding sales", accounts => {
  let sale;
  let admin;
  let game;
  let feeReceiver = accounts[6];

  beforeEach(async function() {
    game = await GAME.new()
    admin = await ADMIN.new()
    sale = await SALE.new(game.address,admin.address,accounts[9])

    // add all accounts as operators
    for (let i = 0;i < 5; i++){
      await admin.addOperator(accounts[i])
    }

    // transfer specific amount of tokens to accounts 1 ~ 4
    game.transfer(accounts[1], '100000000000000000000000', { from:accounts[0] })
    game.transfer(accounts[2], '100000000000000000000000', { from:accounts[0] })
    game.transfer(accounts[3], '100000000000000000000000', { from:accounts[0] })
    game.transfer(accounts[4], '100000000000000000000000', { from:accounts[0] })

    // set fee receiver
    await sale.setFEERECEIVER(feeReceiver, { from:accounts[0] })
  });

  it("test case 1:buy and sell",async function(){
    let currentTimeStamp = await time.latest()
    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9

    let tokenID = await sale.getTokenID(creatorId, token)

    await sale.CreateToken(creatorId, "json data", curve, multiplier)
    await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
    await time.increase(100)

    let initPrice = await sale.getPrintPrice(tokenID, 1)
    let secondPrice = await sale.getPrintPrice(tokenID, 2)
    let thirdPrice = await sale.getPrintPrice(tokenID,3)

    await sale.toggleTokenMinting()
    await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })
    await sale.buyNFTwithGAME(tokenID, secondPrice, { from: accounts[3] })
    await sale.buyNFTwithGAME(tokenID, thirdPrice, { from: accounts[4] })

    await sale.toggleTokenBurning()
    await sale.burn(tokenID, { from: accounts[2] })
    await sale.burn(tokenID, { from: accounts[3] })
    await sale.burn(tokenID, { from: accounts[4] })
  })

  it("checks creation and update permissions",async function(){
    let currentTimeStamp = await time.latest()
    currentTimeStamp = currentTimeStamp.add(time.duration.seconds(100))

    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9
    
    let tokenID = await sale.getTokenID(creatorId, token)

    await sale.CreateToken(creatorId, "json data", curve, multiplier)
    assert.equal(await sale.curves(tokenID), curve, "token id is updated to 7")
    assert.equal(await sale.multipliers(tokenID), multiplier,"token id is updated to 7") 
    await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

    await sale.UpdateTokenData(tokenID, "new json data", 10, 7)
    assert.equal(await sale.curves(tokenID), 10, "token id is updated to 7")
    assert.equal(await sale.multipliers(tokenID), 7, "token id is updated to 7") 

    let TIME = (await sale.saleStarts(tokenID)).toString()
    assert.equal(TIME,currentTimeStamp.toString(), "sale start equal to current timestamp")

    let update=currentTimeStamp.add(time.duration.seconds(200))
    await sale.SetTokenOnSaleDate(tokenID, update)

    TIME = (await sale.saleStarts(tokenID)).toString()
    assert.equal(TIME,update, "sale start equal to new timestamp")
    await expectRevert( sale.UpdateTokenData(
      tokenID,
      "new json data",
      0,
      7
      ),"invalid curve or multipliers")
    await expectRevert( sale.UpdateTokenData(
      tokenID,
      "new json data",
      0,
      1000001
      ),"invalid curve or multipliers")
    await expectRevert( sale.UpdateTokenData(
      tokenID,
      "new json data",
      21,
      10000
      ),"invalid curve or multipliers")
    await expectRevert( sale.UpdateTokenData(
      tokenID,
      "new json data",
      10,
      0
      ),"invalid curve or multipliers")
    await expectRevert(sale.UpdateTokenData(
      tokenID,
      "",
      10,
      4
      ),"json must non null")
    
    await time.increase(time.duration.seconds(500))
    await sale.toggleTokenMinting()
    let initPrice = await sale.getPrintPrice(tokenID, 1)
    await sale.buyNFTwithGAME(tokenID,initPrice, { from: accounts[2] })
    await expectRevert(sale.SetTokenOnSaleDate(tokenID,update), "token has not been minted")

    await expectRevert(sale.UpdateTokenData(
      tokenID,
      "new json data",
      10,
      5
      ),"token has not been minted")
    let nonCreatedToken = await sale.getTokenID(2,2)
    await expectRevert(sale.UpdateTokenData(
        nonCreatedToken,
        "new json data",
        3,
        7
        ),"curve must be set")
  })

  describe("CreateToken:", function () {
    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Curve number fails if 0 or 21+; succeeds otherwise", async function() {
      await expectRevert(sale.CreateToken(creatorId, "json data", 0, multiplier), "invalid curve and multipliers")
      await expectRevert(sale.CreateToken(creatorId, "json data", 21, multiplier), "invalid curve and multipliers")
    })

    it("Multiplier fails if 0 or 1000001; succeeds otherwise", async function() {
      await expectRevert(sale.CreateToken(creatorId, "json data", curve, 0), "invalid curve and multipliers")
      await expectRevert(sale.CreateToken(creatorId, "json data", curve, 1000001), "invalid curve and multipliers")
    })

    it("Json fails if there’s no string; succeeds otherwise", async function() {
      await expectRevert(sale.CreateToken(creatorId, "", curve, multiplier), "json must non null")
    })

    it("Security", async function() {
      await expectRevert(sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[7] }), "sender must be minion or worker")
    })

    it("Security", async function() {
      await expectRevert(sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[7] }), "sender must be minion or worker")
    })

    it("Curve/Multiplier is set correctly", async function(){
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier);
      assert.equal(await sale.curves(tokenID), curve, "token id is updated to 7")
      assert.equal(await sale.multipliers(tokenID), multiplier,"token id is updated to 7") 
    })

    it("TokenData event is emitted, with correct data", async function(){
      let result = await sale.CreateToken(creatorId, "json data", curve, multiplier);
      let tokenID = await sale.getTokenID(creatorId, token)
      let TokenData = await sale.getPastEvents('TokenData', {
        filter: {tokenId: tokenID}, 
        fromBlock: result.receipt.blockNumber, 
        toBlock: 'latest' 
      });
      assert.equal(TokenData.length, 1, "TokenData event should be triggered only once")
      assert.equal(TokenData[0].returnValues.tokenId, tokenID)
      assert.equal(TokenData[0].returnValues.json, "json data")
      assert.equal(TokenData[0].returnValues.curve, curve)
      assert.equal(TokenData[0].returnValues.multiplier, multiplier)
    })
  })

  describe("UpdateTokenData:", async function () {
    let currentTimeStamp = await time.latest()
    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Can’t be called if a token has been minted", async function() {
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await sale.buyNFTwithGAME(tokenID,initPrice, { from: accounts[2] })
      await expectRevert(sale.UpdateTokenData(tokenID, "new new json data", 11, 6), "token has not been minted")
    })

    it("Fails if CreateToken hasn’t been called for the token", async function() {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expectRevert(sale.UpdateTokenData(tokenID, "new json data", 10, 5), "curve must be set")
    })

    it("All tests from CreateToken should be used here too, in the same way", async function(){
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
  
      await expectRevert(sale.UpdateTokenData(tokenID, "json data", 0, multiplier), "invalid curve or multipliers")
      await expectRevert(sale.UpdateTokenData(tokenID, "json data", 21, multiplier), "invalid curve or multipliers")
      await expectRevert(sale.UpdateTokenData(tokenID, "json data", curve, 0), "invalid curve or multipliers")
      await expectRevert(sale.UpdateTokenData(tokenID, "json data", curve, 1000001), "invalid curve or multipliers")
      await expectRevert(sale.UpdateTokenData(tokenID, "", curve, multiplier), "json must non null")
      await expectRevert(sale.UpdateTokenData(tokenID, "json data", 11, 6, { from: accounts[7] }), "sender must be operator or worker")
  
      let result = await sale.UpdateTokenData(tokenID, "new new json data", 11, 6)
      let TokenData = await sale.getPastEvents('TokenData', {
        filter: {tokenId: tokenID}, 
        fromBlock: result.receipt.blockNumber, 
        toBlock: 'latest' 
      });
      assert.equal(TokenData.length, 1, "TokenData event should be triggered only once")
      expect(TokenData[0].args.tokenId).to.be.a.bignumber.that.equals(tokenID)
      assert.equal(TokenData[0].args.json, "new new json data")
      assert.equal(TokenData[0].args.curve, 11)
      assert.equal(TokenData[0].args.multiplier, 6)
      assert.equal(await sale.curves(tokenID), 11, "curve should be updated correctly.")
      assert.equal(await sale.multipliers(tokenID), 6,"multiplier should be updated correctly.") 
    })
  })

  describe("SetTokenOnSaleDate", async function() {
    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9
    
    it("Can’t be called if a token has been minted", async function() {
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await sale.buyNFTwithGAME(tokenID,initPrice, { from: accounts[2] })
      let newTimeStamp = await time.latest()
      await expectRevert(sale.SetTokenOnSaleDate(tokenID, newTimeStamp), "token has not been minted")
    })

    it("Fails if CreateToken hasn’t been called for the token", async function() {
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await expectRevert(sale.SetTokenOnSaleDate(tokenID, currentTimeStamp), "curve must be set")
    })

    it("Secuirty", async function() {
      let tokenID = await sale.getTokenID(creatorId, token)
      await expectRevert(sale.UpdateTokenData(tokenID, "json data", 11, 6, { from: accounts[7] }), "sender must be operator or worker")
    })

    it("TokenOnSale is emitted, with correct data", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      
      // onSaleDate
      await sale.SetTokenOnSaleDate(tokenID, 0)
      assert.equal(await sale.saleStarts(tokenID), 0, "zero should be set")
  
      // TokenOnSale
      let result = await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      let TokenOnSale = await sale.getPastEvents('TokenOnSale', {
        filter: {tokenId: tokenID}, 
        fromBlock: result.receipt.blockNumber, 
        toBlock: 'latest' 
      });
      assert.equal(TokenOnSale.length, 1, "TokenOnSale event should be triggered only once")
      expect(TokenOnSale[0].args.id).to.be.a.bignumber.that.equals(tokenID)
      let futureTimeStamp = await time.latest()
      assert.equal(TokenOnSale[0].args.date.toString(), futureTimeStamp.toString())
    })
  })

  describe("buyNFTwithGAME", async function() {
    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9

    it("Can’t buy if timestamp is before saleStarts, or timestamp is equal to zero ", async function(){
      let currentTimeStamp = await time.latest()

      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, 0)
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.toggleTokenMinting()
      await expectRevert(sale.buyNFTwithGAME(tokenID,initPrice, { from: accounts[2] }), "sale has not started yet")

      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp.add(new BN(10000)))
      await expectRevert(sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] }), "sale has not started yet")
    })

    // it("I cannot buy a token if I already own a copy of that token", async function(){
    //   let currentTimeStamp = await time.latest()
    //   let tokenID = await sale.getTokenID(creatorId, token)
    //   await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
    //   await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
    //   await sale.toggleTokenMinting()
    //   let initPrice = await sale.getPrintPrice(tokenID, 1)
    //   let secondPrice = await sale.getPrintPrice(tokenID, 2)
    //   sale.buyNFTwithGAME(tokenID,initPrice, { from: accounts[2] })
    //   await expectRevert(sale.buyNFTwithGAME(tokenID, secondPrice, { from: accounts[2] }), "already own a copy of that token")
    // })

    it("If I set maxPrice below the current price, it fails", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await expectRevert(sale.buyNFTwithGAME(tokenID, initPrice.sub(new BN(1)), { from: accounts[2] }), "invalid price")
    })

    it("Fees go to the correct user accounts (90% into the contract for bonding lockup, 8% into the creator’s account, 2% into our fee receiver), and each amount is correct", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      console.log("Price of token:", initPrice)     

      const creatorBalanceBefore = await game.balanceOf(creatorId)
      const feeReceiverBalanceBefore = await game.balanceOf(feeReceiver)
      const lockedUpBefore = await game.balanceOf(sale.address)
      console.log(creatorBalanceBefore, feeReceiverBalanceBefore, lockedUpBefore)

      await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })

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

    it("I now own one token", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })
      const tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")
    })

    it("I can transfer my token to another address, and then buy a new one", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let secondPrice = await sale.getPrintPrice(tokenID, 2)
      await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })

      await sale.safeTransferFrom(accounts[2], accounts[3], tokenID, 1, [], { from: accounts[2] })
      const tokenCount = await sale.balanceOf(accounts[3], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.buyNFTwithGAME(tokenID, secondPrice, { from: accounts[2] })
    })

    it("Emits TokenBought, and all data is correct", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      let result = await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })

      let TokenBought = await sale.getPastEvents('TokenBought', {
        filter: {tokenId: tokenID}, 
        fromBlock: result.receipt.blockNumber, 
        toBlock: 'latest' 
      });
      assert.equal(TokenBought.length, 1, "TokenBought event should be triggered only once")
      expect(TokenBought[0].args.id).to.be.a.bignumber.that.equals(tokenID)
      expect(TokenBought[0].args.pricePaid).to.be.a.bignumber.that.equals(initPrice)
      expect(TokenBought[0].args.reserve).to.be.a.bignumber.that.equals(initPrice)
      expect(TokenBought[0].args.royaltyPaid).to.be.a.bignumber.that.equals(new BN(initPrice * 0.08))
      assert.equal(TokenBought[0].args.tokenSupply, 1)
      assert.equal(TokenBought[0].args.royaltyRecipient, creatorId)
    })
  })

  describe("Burn", async function() {
    let creatorId = accounts[9]
    let token = 1
    let curve = 5
    let multiplier = 9

    // it("If I mint 100 of one token then burn all 100, the bonding contract balance ends at 0 (you’ll need 100 different eth addresses to do this one)", async function(){
    // })

    it("My token balance ends at 0", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })
      let tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      await sale.toggleTokenBurning()
      await sale.burn(tokenID, { from: accounts[2] })
      
      tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 0, "should be zero")
    })

    it("I receive the correct amount ", async function() {
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })
      let tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 1, "should own one token")

      const userBalanceBeforeBurn = await game.balanceOf(accounts[2])
      await sale.toggleTokenBurning()
      await sale.burn(tokenID, { from: accounts[2] })
      const userBalanceAfterBurn = await game.balanceOf(accounts[2])
      
      let sellPrice = await sale.getSellPrice(tokenID)
      tokenCount = await sale.balanceOf(accounts[2], tokenID)
      assert.equal(tokenCount, 0, "should be zero")
      expect(sellPrice).be.a.bignumber.that.equals(new BN(userBalanceAfterBurn.sub(userBalanceBeforeBurn)))
    })

    it("Emits TokenBurned, and all data is correct", async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(creatorId, token)
      await sale.CreateToken(creatorId, "json data", curve, multiplier, { from: accounts[0] })
      await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
      await sale.toggleTokenMinting()
      let initPrice = await sale.getPrintPrice(tokenID, 1)
      await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })
      await sale.toggleTokenBurning()
      let result = await sale.burn(tokenID, { from: accounts[2] })

      let TokenBurned = await sale.getPastEvents('TokenBurned', {
        filter: {tokenId: tokenID}, 
        fromBlock: result.receipt.blockNumber, 
        toBlock: 'latest' 
      });
      let sellPrice = await sale.getSellPrice(tokenID)
      assert.equal(TokenBurned.length, 1, "TokenBurned event should be triggered only once")
      expect(TokenBurned[0].args.id).to.be.a.bignumber.that.equals(tokenID)
      expect(TokenBurned[0].args.priceReceived).to.be.a.bignumber.that.equals(sellPrice)
      assert.equal(TokenBurned[0].args.printsSupply, 0)
    })    
  })
})