const { ethers } = require("hardhat");
const { solidity } = require("ethereum-waffle");
const chai = require("chai");

chai.use(solidity);
const { assert, expect } = chai;

const baseURI = "https://test.com/"

describe("Admin function test", () => {
  let base;
  let sale;
  let admin;
  let game;
  let accounts, signers;
  let feeReceiver;

  beforeEach(async function() {
    signers = await ethers.getSigners();
    accounts = signers.map((signer) => signer.address)
    feeReceiver = accounts[6];

    const BASE = await ethers.getContractFactory("NFTbase");
    base = await BASE.deploy(baseURI);
    await base.deployed();

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
    for (let i = 0;i < 9; i++){
      await admin.addOperator(accounts[i])
    }

    // transfer specific amount of tokens to accounts 1 ~ 4
    game.transfer(accounts[1], '100000000000000000000000')
    game.transfer(accounts[2], '100000000000000000000000')
    game.transfer(accounts[3], '100000000000000000000000')
    game.transfer(accounts[4], '100000000000000000000000')

    // set fee receiver
    await sale.setFEERECEIVER(feeReceiver)
  });

  it("MetadataAdmin can change uri (and someone with no roles cannot)", async function(){
    let tokenID = 1

    await base.setURI("new uri", tokenID)
    await base.setBaseURI("new uri")

    await expect(base.connect(signers[1]).setURI("new uri", tokenID)).to.be.reverted
    await expect(base.connect(signers[1]).setBaseURI("new uri")).to.be.reverted
  })

  it("GlobalAdmin can change metadata admin (and other roles cannot)", async function(){
    let tokenID = 1
    const METADATA_ADMIN = await base.METADATA_ADMIN()
    
    await base.setURI("new uri", tokenID)
    await base.setBaseURI("new uri")

    await base.grantRole(METADATA_ADMIN, accounts[1])
    await expect(base.connect(signers[3]).grantRole(METADATA_ADMIN, accounts[2])).to.be.reverted

    await base.connect(signers[1]).setURI("new uri", tokenID)
    await base.connect(signers[1]).setBaseURI("new uri")

    await expect(base.connect(signers[2]).setURI("new uri", tokenID)).to.be.reverted
    await expect(base.connect(signers[2]).setBaseURI("new uri")).to.be.reverted
  })

  it("GlobalAdmin can toggle token minted (and other roles cannot)", async function(){
    await sale.toggleTokenMinting()
    await expect(sale.connect(signers[1]).toggleTokenMinting()).to.be.reverted
  })

  it("GlobalAdmin can set fee receiver (and other roles cannot)", async function(){
    await sale.setFEERECEIVER(feeReceiver)
    await expect(sale.connect(signers[1]).setFEERECEIVER(feeReceiver)).to.be.reverted
  })

  it("toggleTokenBurning/toggleTokenMinting prevents minting (but can be reactivated)", async function(){
    let currentTimeStamp = (await ethers.provider.getBlock("latest")).timestamp
    let creatorId = 2
    let token = 1
    let curve = 5
    let multiplier = 9

    let tokenID = await sale.getTokenID(creatorId, token)

    await sale.CreateToken(creatorId, "json data", curve, multiplier)
    await sale.SetTokenOnSaleDate(tokenID, currentTimeStamp)

    let initPrice = await sale.getPrintPrice(tokenID, 1)

    await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)).to.be.revertedWith("minting is not active")
    await sale.toggleTokenMinting()
    await sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)
    await sale.toggleTokenMinting()
    await expect(sale.connect(signers[2]).buyNFTwithGAME(tokenID, initPrice)).to.be.revertedWith("minting is not active")

    await expect(sale.connect(signers[2]).burn(tokenID)).to.be.revertedWith("burning is not active")
    await sale.toggleTokenBurning()
    await sale.connect(signers[2]).burn(tokenID)
    await sale.toggleTokenBurning()
    await expect(sale.connect(signers[2]).burn(tokenID)).to.be.revertedWith("burning is not active")
  })
})