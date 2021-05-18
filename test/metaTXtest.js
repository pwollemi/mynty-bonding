const SALE = artifacts.require("bondingSale");
const ADMIN= artifacts.require("mockAdmin")
const GAME = artifacts.require("mockToken")

let utils=require('web3-utils')
let nativeMetaTx= require('./metaTXUtils.js')
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

contract("bonding Test", accounts => {
  let sale;
  let admin;
  let game;
  let feeReceiver = accounts[6];


  beforeEach(async function() {
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

  // it("makes meta tx calls", async function () {
  //   const sender = 1;
  //   const relayer = 2;
  //   const isWorker = false;
  //   let currentTimeStamp = await time.latest()
  //   let creatorId = 2
  //   let token = 1
  //   let curve = 5
  //   let multiplier = 9

  //   let tokenID = await sale.getTokenID(creatorId, token)

  //   const create = sale.contract.methods.CreateToken(creatorId, "json data", curve, multiplier).encodeABI();
  //   const setDate = sale.contract.methods.SetTokenOnSaleDate(tokenID, currentTimeStamp).encodeABI()
  //   const toggleTokenMinting = sale.contract.methods.toggleTokenMinting().encodeABI();
  //   const buy= sale.contract.methods.buyNFTwithGAME(tokenID,utils.toBN('100000000000000000')).encodeABI()

  //   let funcs=[create,setDate,toggleTokenMinting,buy]

  //   for(let i=0;i<funcs.length;i++){
  //       console.log(`making call ${i}`)
  //       await time.increase(time.duration.seconds(100000))
  //       const { from, r, s, v, replayProtection } = await nativeMetaTx.getMetaTxSignature(sale.contract, funcs[i], sender, isWorker);
  //       console.log(`call is from ${from}`)
  //       await nativeMetaTx.sendWorkerOrNormalTx(sale.contract, funcs[i], from, r, s, v, relayer, isWorker);
  //   }
  // });

})