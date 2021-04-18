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
let sale;
let admin;
let game;


contract("bonding Test", accounts => {
    console.log(accounts)
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
    it("test case 1:buy and sell",async function(){
      let currentTimeStamp = await time.latest()
      let tokenID = await sale.getTokenID(2,1)
      console.log(tokenID.toString())
      let creator=await sale.creatorAddress(2)
      await sale.CreateToken(2,"json data",5,9 )
      await sale.SetTokenOnSaleDate(tokenID,currentTimeStamp)
      await time.increase(100)
      let initPrice= await sale.getPrintPrice(tokenID, 1)
      let secondPrice=await sale.getPrintPrice(tokenID, 2)
      let thirdPrice=await sale.getPrintPrice(tokenID,3)
      console.log("the price is")
      console.log(initPrice.toString())
      console.log(secondPrice.toString())
      console.log(thirdPrice.toString())
   
      let tx=await sale.buyNFTwithGAME(tokenID,initPrice,{from:accounts[2]})
      await sale.buyNFTwithGAME(tokenID,secondPrice,{from:accounts[3]})
      await sale.buyNFTwithGAME(tokenID,thirdPrice,{from:accounts[4]})
      //console.log(tx.receipt.logs)
      let user2Balance=await game.balanceOf(accounts[2])
      let saleBalance=await game.balanceOf(sale.address)
      let feeBalance= await game.balanceOf(accounts[6])
      let CreatorBalance=await game.balanceOf(creator)
      
      console.log(CreatorBalance.toString())
      console.log(saleBalance.toString())
      console.log(feeBalance.toString())
      await sale.burn(tokenID,{from:accounts[2]})
      await sale.burn(tokenID,{from:accounts[3]})
      await sale.burn(tokenID,{from:accounts[4]})
      //console.log(tx.receipt)
    })
    it("checks creation and update permissions",async function(){
      let currentTimeStamp = await time.latest()
      currentTimeStamp=currentTimeStamp.add(time.duration.seconds(100))
      
      let tokenID = await sale.getTokenID(2,1)
      console.log(tokenID.toString())
      let creator=await sale.creatorAddress(2)
      await sale.CreateToken(2,"json data",5,9 )
      assert.equal(await sale.curves(tokenID),5,"token id is updated to 7")
      assert.equal(await sale.multipliers(tokenID),9,"token id is updated to 7") 
      await sale.SetTokenOnSaleDate(tokenID,currentTimeStamp)
      await sale.UpdateTokenData(
        tokenID,
        "new json data",
        10,
        7
    )
    assert.equal(await sale.curves(tokenID),10,"token id is updated to 7")
    assert.equal(await sale.multipliers(tokenID),7,"token id is updated to 7") 
    
    
    let TIME= (await sale.saleStarts(tokenID)).toString()
    console.log(TIME)
    assert.equal(TIME,currentTimeStamp.toString(),"sale start equal to current timestamp")
    let update=currentTimeStamp.add(time.duration.seconds(200))
    await sale.SetTokenOnSaleDate(tokenID,update)
    TIME=(await sale.saleStarts(tokenID)).toString()
    assert.equal(TIME,update,"sale start equal to new timestamp")
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
      let initPrice= await sale.getPrintPrice(tokenID, 1)
      let latestStart=await sale.saleStarts(tokenID)
      console.log(latestStart.toString())
      console.log((await time.latest()).toString())
      await sale.buyNFTwithGAME(tokenID,initPrice,{from:accounts[2]})
      await expectRevert(sale.SetTokenOnSaleDate(tokenID,update),"token has not been minted")

      await expectRevert( sale.UpdateTokenData(
        tokenID,
        "new json data",
        10,
        5
        ),"token has not been minted")
      let nonCreatedToken = await sale.getTokenID(2,2)
      await expectRevert( sale.UpdateTokenData(
          nonCreatedToken,
          "new json data",
          3,
          7
         ),"curve must be set")
    })
    
   
})