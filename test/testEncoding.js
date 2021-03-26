const LAND = artifacts.require("bondingSale");

let utils=require('web3-utils')
const {
  BN,           // Big Number support 
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert,
  increase,
  increastTo, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');
let land;
/**
    * W:1 X: 1 Y: 1 encodes to:		110011001
    W:1 X: 0 Y: 0 encodes to:		110001000
    W:1 X:-1 Y:-1 encodes to:		109990999
    W:1 X:-1000 Y:-1000 encodes to:	100000000
    W:0 X: 1 Y: 1 encodes to:		  10011001 (this is the most tricky one, but it’s still relatively easy to parse)
 */

contract("encoderTests", accounts => {
    
    before(async function() {
     land = await LAND.new()
      
    });
    it("encode test case 1:",async function(){
       let token=await land.encodeTokenId(1, 1,1)
       assert.equal(token.toString(),'110011001',"correct encoding for case 1")
    })
    
})