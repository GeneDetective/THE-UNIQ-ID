// contract/hardhat.config.js
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (root .env first, then contract/.env to allow overrides)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Load Hardhat Toolbox (this also registers `hre.ethers`)
require('@nomicfoundation/hardhat-toolbox');

// Accept multiple env names for compatibility
const SEP_RPC =
  process.env.SEP_RPC ||
  process.env.SEPOLIA_RPC_URL ||
  process.env.SEPOLIA_RPC ||
  process.env.INFURA_SEPOLIA_URL ||
  '';

let DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.PRIVATE_KEY ||
  process.env.DEPLOYER_PK ||
  process.env.PRIVATE_KEY_0 ||
  '';

// Normalize private key (add 0x if missing)
if (DEPLOYER_PRIVATE_KEY && !DEPLOYER_PRIVATE_KEY.startsWith('0x')) {
  DEPLOYER_PRIVATE_KEY = '0x' + DEPLOYER_PRIVATE_KEY;
}

// Build accounts array only if key exists (Hardhat expects array of strings)
const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

// Final exported config
module.exports = {
  solidity: {
    compilers: [
      { version: '0.8.20' }, // keep newest for OZ compatibility
      { version: '0.8.19' },
      { version: '0.8.18' }
    ]
  },

  networks: {
    sepolia: {
      url: SEP_RPC || '',
      accounts: accounts
    },

    // local dev network (optional)
    hardhat: {
      // default options
    }
  },

  // Optional: increase default mocha timeout if you run slow integration tests
  mocha: {
    timeout: 200000
  }
};
