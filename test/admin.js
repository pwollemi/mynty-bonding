const BASE = artifacts.require("NFTbase");
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
const { assert } = require('hardhat');
const baseURI = "https://test.com/"

contract("NFTbase", accounts => {
  let base;
  let sale;
  let admin;
  let game;
  let feeReceiver = accounts[6];

  beforeEach(async function() {
    base = await BASE.new(baseURI, { from: accounts[0] })
    game = await GAME.new()
    admin = await ADMIN.new()
    sale = await SALE.new(game.address,admin.address,accounts[9])

    // add all accounts as operators
    for (let i = 0;i < 9; i++){
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

  it("MetadataAdmin can change uri (and someone with no roles cannot)", async function(){
    let tokenID = 1

    await base.setURI("new uri", tokenID, { from: accounts[0] })
    await base.setBaseURI("new uri", { from: accounts[0] })

    await expectRevert.unspecified(base.setURI("new uri", tokenID, { from: accounts[1] }))
    await expectRevert.unspecified(base.setBaseURI("new uri", { from: accounts[1] }))
  })

  it("GlobalAdmin can change metadata admin (and other roles cannot)", async function(){
    let tokenID = 1
    const METADATA_ADMIN = await base.METADATA_ADMIN()
    
    await base.setURI("new uri", tokenID, { from: accounts[0] })
    await base.setBaseURI("new uri", { from: accounts[0] })

    await base.grantRole(METADATA_ADMIN, accounts[1], { from: accounts[0] })
    await expectRevert.unspecified(base.grantRole(METADATA_ADMIN, accounts[2], { from: accounts[3] }))

    await base.setURI("new uri", tokenID, { from: accounts[1] })
    await base.setBaseURI("new uri", { from: accounts[1] })

    await expectRevert.unspecified(base.setURI("new uri", tokenID, { from: accounts[2] }))
    await expectRevert.unspecified(base.setBaseURI("new uri", { from: accounts[2] }))
  })

  it("GlobalAdmin can toggle token minted (and other roles cannot)", async function(){
    await sale.toggleTokenMinting({ from: accounts[0]})
    await expectRevert.unspecified(sale.toggleTokenMinting({ from: accounts[1]}), { from: accounts[1] })
  })

  it("GlobalAdmin can set fee receiver (and other roles cannot)", async function(){
    await sale.setFEERECEIVER(feeReceiver, { from:accounts[0] })
    await expectRevert.unspecified(sale.setFEERECEIVER(feeReceiver, { from:accounts[1] }))
  })

  it("toggleTokenBurning/toggleTokenMinting prevents minting (but can be reactivated)", async function(){
    let currentTimeStamp = await time.latest()
    let creatorId = 2
    let token = 1
    let curve = 5
    let multiplier = 9

    let tokenID = await sale.getTokenID(creatorId, token)

    await sale.CreateToken(creatorId, "json data", curve, multiplier)
    await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)
    await time.increase(100)

    let initPrice = await sale.getPrintPrice(tokenID, 1)

    await expectRevert(sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] }), "minting is not active")
    await sale.toggleTokenMinting()
    await sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] })
    await sale.toggleTokenMinting()
    await expectRevert(sale.buyNFTwithGAME(tokenID, initPrice, { from: accounts[2] }), "minting is not active")

    await expectRevert(sale.burn(tokenID, { from: accounts[2] }), "burning is not active")
    await sale.toggleTokenBurning()
    await sale.burn(tokenID, { from: accounts[2] })
    await sale.toggleTokenBurning()
    await expectRevert(sale.burn(tokenID, { from: accounts[2] }), "burning is not active")
  })
})