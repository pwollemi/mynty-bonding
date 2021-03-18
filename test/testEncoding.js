const LAND = artifacts.require("LANDRegistry");

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
    it("decodes test case 1:",async function(){
        let decoded=await land.decodeTokenId(110011001)
        console.log(decoded.x.toString())
        console.log(decoded.y.toString())
        console.log(decoded.w.toString())
    })
    it("encodes test case 2:",async function(){
        let token=await land.encodeTokenId(0, 0,1)
        assert.equal(token.toString(),'110001000',"correct encoding for case 1")
    })
    it("decodes test case 2:",async function(){
        let decoded=await land.decodeTokenId(110001000)
        console.log(decoded.x.toString())
        console.log(decoded.y.toString())
        console.log(decoded.w.toString())
    })
    it("encodes test case 3:",async function(){
        let token=await land.encodeTokenId(-1, -1,1)
        assert.equal(token.toString(),'109990999',"correct encoding for case 1")
    })
    it("decodes test case 3:",async function(){
        let decoded=await land.decodeTokenId(109990999)
        assert.equal(decoded.x,-1,"correc decode of x for case 4")
        assert.equal(decoded.y,-1,"correc decode of y for case 4")
        assert.equal(decoded.w, 1 ,"correc decode of w for case 4")
    })
    it("encodes test case 4:",async function(){
        let token=await land.encodeTokenId(-1000, -1000,1)
        assert.equal(token.toString(),'100000000',"correct encoding for case 1")
    })
    it("decodes test case 4:",async function(){
        let decoded=await land.decodeTokenId(100000000)
       
        assert.equal(decoded.x,-1000,"correc decode of x for case 4")
        assert.equal(decoded.y,-1000,"correc decode of y for case 4")
        assert.equal(decoded.w, 1 ,"correc decode of w for case 4")
    })
    it("reverts with invalid x encoding:",async function(){
        await expectRevert(land.encodeTokenId(-1001, -1000,1),"invalid coordinate values")
    })
    it("reverts with invalid y encoding:",async function(){
        await expectRevert(land.encodeTokenId(-1000, -1001,1),"invalid coordinate values")
    })
    it("reverts with invalid w encoding:",async function(){
        await expectRevert(land.encodeTokenId(-1000, -1000,1000001),"invalid coordinate values")
    })
})