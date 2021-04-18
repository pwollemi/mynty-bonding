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
let sale;
let admin;
let game;


contract("bonding Test", accounts => {
    
    beforeEach(async function() {
     let tokens='100000000000000000000000'
     admin =await ADMIN.new()
     game=await GAME.new()
     sale = await SALE.new(game.address,admin.address,accounts[9])
     
     game.transfer(accounts[1],tokens,{from:accounts[0]})
     game.transfer(accounts[2],tokens,{from:accounts[0]})
     game.transfer(accounts[3],tokens,{from:accounts[0]})
     game.transfer(accounts[4],tokens,{from:accounts[0]})
     await sale.setFEERECEIVER(accounts[6],{from:accounts[0]})
    });
    it("makes meta tx calls", async function () {
        const sender = 1;
        const relayer = 2;
        const isWorker = false;
        let currentTimeStamp = await time.latest()
        let tokenID = await sale.getTokenID(2,1)
        console.log(`token id ${tokenID}`)
       
        

        
        let creator=await sale.creatorAddress(2)
        //console.log(sale.methods)
       // 
        const create= sale.contract.methods.CreateToken(2,"json data",5,9 ).encodeABI();
        const setDate= sale.contract.methods.SetTokenOnSaleDate(tokenID,currentTimeStamp).encodeABI()
        const buy= sale.contract.methods.buyNFTwithGAME(tokenID,utils.toBN('100000000000000000')).encodeABI()
        
        let funcs=[create,setDate,buy]
    
        for(let i=0;i<funcs.length;i++){
            console.log(`making call ${i}`)
            await time.increase(time.duration.seconds(100000))
            const { from, r, s, v, replayProtection } = await nativeMetaTx.getMetaTxSignature(sale.contract, funcs[i], sender, isWorker);
            
            const result = await nativeMetaTx.sendWorkerOrNormalTx(sale.contract, funcs[i], from, r, s, v, relayer, isWorker);
        }
        
        
      });

})