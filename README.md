# THE-UNIQ-ID — Quickstart & Deployment Guide

> Privacy-first decentralized identity (UNIQ ID). This repo contains the smart contract, deployment scripts, and a local node server used to register/verify identity roots on Sepolia testnet.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Clone repository](#clone-repository)
3. [Create accounts & secrets (Infura, wallet, SendGrid)](#create-accounts--secrets)
4. [Prepare `.env`](#prepare-env)
5. [Install dependencies](#install-dependencies)
6. [Compile & deploy the contract (Hardhat)](#compile--deploy-the-contract-hardhat)
7. [Run the server & test web flows](#run-the-server--test-web-flows)
8. [Check contract on Sepolia Etherscan](#check-contract-on-sepolia-etherscan)
9. [Security checklist before publishing / pushing to GitHub](#security-checklist-before-publishing--pushing-to-github)
10. [Link to SDK demo repo](#link-to-sdk-demo-repo)
11. [Troubleshooting & notes](#troubleshooting--notes)

---

## Prerequisites

* Node.js (v16+ recommended) and `npm` installed.
* `git` installed.
* A wallet (MetaMask recommended) with Sepolia test ETH (faucet) for gas.
* Hardhat & Ethers (the project already includes Hardhat config and scripts).
* Optional: `npx`, `curl` / `wget` for downloading files.

---

## Clone repository

Open a shell and clone:

```bash
# clone
git clone https://github.com/GeneDetective/THE-UNIQ-ID.git
cd THE-UNIQ-ID
```

---

## Create accounts & secrets

You will need:

1. **Infura (Sepolia RPC URL)**

   * Create an Infura account at [https://infura.io/](https://infura.io/) → Projects → Create Project.
   * Under your project settings, copy the Sepolia endpoint (format):
     `https://sepolia.infura.io/v3/YOUR_INFURA_KEY`
   * Replace `YOUR_INFURA_KEY` below with that key.

2. **Wallet & Deployer private key**

   * Create an account in MetaMask (or use an existing one).
   * Fund it with Sepolia test ETH (use a Sepolia faucet).
   * Export the **private key** for the account you will use to deploy the contract: MetaMask → Account details → Export Private Key → copy.
   * **Important:** never share this key. Use it only in your local `.env` and never commit the `.env` to GitHub.

3. **SendGrid (for verification emails used by the server)**

   * Sign up at [https://sendgrid.com](https://sendgrid.com) and create an API key (Full Access or Restricted as needed).
   * Use the email you control as the `SENDER_EMAIL` (SendGrid requires verifying the sender).

---

## Prepare `.env`

A `.env.example` is provided. Create a `.env` (local only) and fill with your values:

```text
# copy .env.example -> .env
cp .env.example .env   # or create manually

# Example values (do not commit .env)

# SendGrid
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY
SENDER_EMAIL=YOUR_SENDGRID_SENDER_EMAIL
BASE_URL=http://localhost:3001

# Ethereum / Hardhat
SEP_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
DEPLOYER_PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY
CONTRACT_ADDR=0xYOUR_CONTRACT_ADDR
```

## Install dependencies

From the repo root:

```bash
# install top-level (server + utilities)
npm install

# if contract folder has its own package.json (some setups do):
cd contract
npm install
cd ..
```
## Compile & deploy the contract (Hardhat)

> The contract is located at `contract/contracts/UNIQID.sol`. The deploy script is `contract/scripts/deploy.js` and `contract/hardhat.config.js` should be present.

1. Set `SEP_RPC` and `DEPLOYER_PRIVATE_KEY` in `.env` (see above).

2. From the `contract/` folder run:

```bash
cd contract

# compile
npx hardhat compile

# deploy to Sepolia
npx hardhat run --network sepolia scripts/deploy.js
```

3. After success, the deploy script will print the deployed contract address. Copy this address and paste it into your `.env` as `CONTRACT_ADDR` (or update the server config where required).

## Run the server & test web flows

Back in the repo root:

```bash
# ensure .env is present
node server.js
```

Open `http://localhost:3001`and use the registration / verify pages:

* `public/register.html` → register & email verification flow (the server will use SendGrid).
* `public/verify.html` → verify or check anchored roots.
* `public/index.html` → demo landing page.

The server will use the `CONTRACT_ADDR` you put into `.env` to anchor roots or query roots on Sepolia.

---

## Check contract on Sepolia Etherscan

Once deployed you can view the contract directly:

```
https://sepolia.etherscan.io/address/<YOUR_CONTRACT_ADDR>
```

Open the link and confirm the `anchorRoot` transactions or events (e.g., `RootAnchored`) show up. This proves the root(s) were stored on-chain.

---
> To test a full integration (sign up/login using the UNIQ ID SDK and example website) clone the demo SDK repo:
> follow this repository: https://github.com/GeneDetective/THE-UNIQ-ID-DEMO-SDK-WEBSITE.git
---

## Troubleshooting & notes

* **If hardhat network errors appear** — check `SEP_RPC` value and that your deployer has Sepolia ETH (faucet).
* **If Email not sent** — check SendGrid sender verification and API key scope.
---
## Resources
**Demo video**: 
https://www.youtube.com/watch?v=RINw12L6YXY

**Whitepaper**:
https://drive.google.com/file/d/1IsAA9BgKbUrA_gF57MCKD-zel5nuD9GO/view

