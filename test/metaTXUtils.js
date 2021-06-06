const { ethers } = require("hardhat");
const sigUtil = require('eth-sig-util');
const Web3 = require('web3');
const utilWeb3 = new Web3();
const bip39 = require('bip39');

const { wallet, hdkey } = require('ethereumjs-wallet');
var ethUtil = require("ethereumjs-util");
const mnemonic = "test test test test test test test test test test test junk"; // 12 word mnemonic

const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" }
];

const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" }
];

const workerMetaTransactionType = [
  { name: "replayPrevention", type: "bytes32" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" }
];

const getDomainData = async (contract) => {
  const contractName = await contract.CONTRACT_ERC712_NAME();
  const contractVersion = await contract.CONTRACT_ERC712_VERSION();
  const chainId = (await contract.getChainId()).toString();
  let domainData = {
    name: contractName,
    version: contractVersion,
    chainId: chainId,
    verifyingContract: contract.address,
  };
  return domainData;
};



// 0xf2c5d2ed
// 000000000000000000000000168808c470ac580861b1ed26215a6a0bc3116c82
// 0000000000000000000000000000000000000000000000000000000000000001

const getKeys = async (accountNumber) => {
  const seed = await bip39.mnemonicToSeed(mnemonic); // mnemonic is the string containing the words
  const hdk = hdkey.fromMasterSeed(seed);
  const addr_node = hdk.derivePath(`m/44'/60'/0'/0/${accountNumber}`); //m/44'/60'/0'/0/0 is derivation path for the first account. m/44'/60'/0'/0/1 is the derivation path for the second account and so on
  const addr = addr_node.getWallet().getAddressString(); //check that this is the same with the address that ganache list for the first account to make sure the derivation is correct
  const privateKey = addr_node.getWallet().getPrivateKey();
  return { address: addr, privateKey: privateKey };
}

const generateDataToSign = async (
  functionSignature,
  contract,
  from,
  isWorker) => {

  const domainData = await getDomainData(contract);
  let userAddress = from;
  const replayProtection = utilWeb3.utils.randomHex(32);
  let dataToSign = {};
  if (isWorker) {
    let message = {};
    message['replayPrevention'] = replayProtection;
    message['from'] = userAddress;
    message['functionSignature'] = functionSignature;
    dataToSign = {
      types: {
        EIP712Domain: domainType,
        WorkerMetaTransaction: workerMetaTransactionType,
      },
      domain: domainData,
      primaryType: "WorkerMetaTransaction",
      message: message,
    };
  } else {
    let message = {};
    let nonce = await contract.getNonce(userAddress);
    message['nonce'] = parseInt(nonce);
    message['from'] = userAddress;
    message['functionSignature'] = functionSignature;
    dataToSign = {
      types: {
        EIP712Domain: domainType,
        MetaTransaction: metaTransactionType,
      },
      domain: domainData,
      primaryType: "MetaTransaction",
      message: message,
    };
  }
  return { dataToSign, replayProtection };
}


const generateBadDataToSign = async (
  functionSignature,
  contract,
  from,
  isWorker, nonce) => {

  const domainData = await getDomainData(contract);
  let userAddress = from;
  let dataToSign = {};
  const replayProtection = utilWeb3.utils.randomHex(32);
  if (isWorker) {
    let message = {};
    message['replayPrevention'] = replayProtection;
    message['from'] = userAddress;
    message['functionSignature'] = functionSignature;
    dataToSign = {
      types: {
        EIP712Domain: domainType,
        WorkerMetaTransaction: workerMetaTransactionType,
      },
      domain: domainData,
      primaryType: "WorkerMetaTransaction",
      message: message,
    };
  } else {
    let message = {};
    message['nonce'] = parseInt(nonce);
    message['from'] = userAddress;
    message['functionSignature'] = functionSignature;
    dataToSign = {
      types: {
        EIP712Domain: domainType,
        MetaTransaction: metaTransactionType,
      },
      domain: domainData,
      primaryType: "MetaTransaction",
      message: message,
    };
  }
  return { dataToSign, replayProtection };
}

const signTypedData = async (privateKey, from, dataToSign) => {
  const signature = sigUtil.signTypedData_v4(privateKey, { data: dataToSign });

  let { r, s, v } = getSignatureParameters(signature);

  const recovered = sigUtil.recoverTypedSignature_v4({
    data: dataToSign,
    sig: signature,
  });
  if (recovered.toLowerCase() != from.toLowerCase()) {
    throw `recovered address ${recovered} must match user address ${from}`
  }
  //console.log(`signed: ${r} / ${s} / ${v}`);
  return { r, s, v };
}

const getMetaTxSignature = async (
  contract,
  functionSignature,
  senderAccountIndex,
  isWorker
) => {
  const { address, privateKey } = await getKeys(senderAccountIndex);
  const from = address;
  const { dataToSign, replayProtection } = await generateDataToSign(functionSignature, contract, from, isWorker);
  const { r, s, v } = await signTypedData(privateKey, from, dataToSign);
  //console.log(replayProtection);
  //console.log(dataToSign);
  return { from, r, s, v, replayProtection };
}

const executeMetaTx = async (
  contract,
  functionSignature,
  senderAccountIndex,
  relayerAccountIndex,
  isWorker
) => {
  const { from, r, s, v, replayProtection } = await getMetaTxSignature(contract, functionSignature, senderAccountIndex, isWorker);

  //console.log(`execute: ${from}`);
  await sendWorkerOrNormalTx(contract, functionSignature, from, r, s, v, relayerAccountIndex, isWorker, replayProtection);
};

const sendWorkerOrNormalTx = async (
  contract,
  functionSignature,
  from,
  r, s, v,
  relayerAccountIndex,
  isWorker,
  replayProtection
) => {
  if (isWorker) {
    await sendWorkerMetaTx(contract, from, functionSignature, r, s, v, relayerAccountIndex, replayProtection);
  } else {
    await sendMetaTx(contract, from, functionSignature, r, s, v, relayerAccountIndex);
  }
}

const sendWorkerMetaTx = async (contract, from, functionSignature, r, s, v, relayerAccountIndex, replayProtection) => {
  const relayer = (await ethers.getSigners())[relayerAccountIndex];
  const gas = await contract
    .connect(relayer)
    .estimateGas
    .workerExecuteMetaTransaction(from, replayProtection, functionSignature, r, s, v);
  let tx = await contract
    .connect(relayer)
    .workerExecuteMetaTransaction(from, replayProtection, functionSignature, r, s, v, { gasLimit: gas })
}

const sendMetaTx = async (contract, from, functionSignature, r, s, v, relayerAccountIndex) => {
  const relayer = (await ethers.getSigners())[relayerAccountIndex];
  const gas = await contract
    .connect(relayer)
    .estimateGas
    .executeMetaTransaction(from, functionSignature, r, s, v, { from: relayer })
  let tx = await contract
    .connect(relayer)
    .executeMetaTransaction(from, functionSignature, r, s, v, { gasLimit: gas })
}

// this is solid
const getSignatureParameters = (signature) => {
  var sigBuffer = ethUtil.toBuffer(signature);
  var sigParams = ethUtil.fromRpcSig(sigBuffer);
  return {
    r: "0x"+sigParams.r.toString('hex'),
    s: "0x"+sigParams.s.toString('hex'),
    v: sigParams.v
  };
};
  
module.exports = {
  getMetaTxSignature,
  sendWorkerMetaTx,
  sendMetaTx,
  sendWorkerOrNormalTx,
  executeMetaTx,
  generateBadDataToSign,
  getKeys,
  signTypedData,
};