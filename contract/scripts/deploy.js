// contract/scripts/deploy.js
const hre = require("hardhat");

async function main() {
  // Safety: ensure we are running inside Hardhat with the ethers plugin
  if (!hre || !hre.ethers || typeof hre.ethers.getContractFactory !== "function") {
    console.error("\nERROR: `hre.ethers` is not available.\n" +
      "Make sure you run this script with Hardhat: `npx hardhat run scripts/deploy.js --network sepolia`\n" +
      "Also ensure you have `@nomicfoundation/hardhat-toolbox` (or hardhat-ethers) required in hardhat.config.js\n");
    process.exit(1);
  }

  console.log("Deploying UNIQID contract...");

  // Get contract factory
  const UNIQID = await hre.ethers.getContractFactory("UNIQID");

  // Deploy
  const uniq = await UNIQID.deploy(); // .deploy() returns a Contract (v5/v6 differences exist)

  // Wait for deployment to finish (works across versions)
  try {
    if (typeof uniq.waitForDeployment === "function") {
      // ethers v6 hardhat helper
      await uniq.waitForDeployment();
    } else if (typeof uniq.deployed === "function") {
      await uniq.deployed();
    } else {
      // fallback tiny wait
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    console.warn("Warning: waiting for deployment failed or is not needed:", e && e.message ? e.message : e);
  }

  // Read the contract address in multiple ways (compatible with ethers v5/v6)
  const address =
    uniq.address ||
    (uniq.target ? uniq.target : null) ||
    (typeof uniq.getAddress === "function" ? await uniq.getAddress() : null);

  if (!address) {
    console.error("ERROR: Could not determine contract address after deploy. Inspect `uniq` object.");
    console.log("Raw contract object:", uniq);
    process.exit(1);
  }

  console.log("UNIQID deployed to:", address);
  console.log("Important: add CONTRACT_ADDR=" + address + " to your app .env (server) and restart server.");
}

// Run
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Deploy script failed:", err && err.stack ? err.stack : err);
    process.exit(1);
  });
