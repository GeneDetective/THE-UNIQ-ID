// blockchain.js
require('dotenv').config();

// Import exactly what we need from ethers v6
const { JsonRpcProvider, Wallet, Contract } = require('ethers');

// 1️⃣ Connect to Sepolia via RPC URL
const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

// 2️⃣ Create a signer (your deployer wallet)
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);

// 3️⃣ Minimal ABI for our UNIQID contract
const UNIQID_ABI = [
  "function register(bytes32 emailHash, bytes32 paraHash, bytes32 salt) external",
  "function getUser(uint256 id) external view returns (bytes32,bytes32,bytes32,bool)",
  "function emailToId(bytes32) external view returns (uint256)"
];

// 4️⃣ Your deployed contract address
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS.trim();

// 5️⃣ Instantiate the contract
const contract = new Contract(CONTRACT_ADDRESS, UNIQID_ABI, wallet);

module.exports = { provider, wallet, contract };
