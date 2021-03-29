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
let sale;
let admin;
let game;
/**
    * W:1 X: 1 Y: 1 encodes to:		110011001
    W:1 X: 0 Y: 0 encodes to:		110001000
    W:1 X:-1 Y:-1 encodes to:		109990999
    W:1 X:-1000 Y:-1000 encodes to:	100000000
    W:0 X: 1 Y: 1 encodes to:		  10011001 (this is the most tricky one, but it’s still relatively easy to parse)
 */

contract("encoderTests", accounts => {
    
    beforeEach(async function() {
     let tokens='1000000000000000000000'
     admin =await ADMIN.new()
     game=await GAME.new()
     sale = await SALE.new(game.address,admin.address)
     
     game.transfer(accounts[1],tokens,{from:accounts[0]})
     game.transfer(accounts[2],tokens,{from:accounts[0]})
     game.transfer(accounts[3],tokens,{from:accounts[0]})
     await sale.setFEERECEIVER(accounts[6],{from:accounts[0]})
    });
    it("encode test case 1:",async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(2,1)
      console.log(tokenID.toString())
      await sale.CreateToken(2,"json data",5,9 )
      await sale.SetTokenOnSaleDate(tokenID,currentTimeStamp)
      await time.increase(100)
      let initPrice= await sale.getPrintPrice(tokenID, 2)
      console.log("the price is")
      console.log(initPrice.toString())

      await sale.buyNFTwithGAME(tokenID,initPrice,{from:accounts[2]})
     
    })
    
})