// handlers.js — Merkle-anchored MVP edition (Poseidon hashing replacing Argon2)

require('dotenv').config();
const crypto    = require('crypto');
const validator = require('validator');
const jwt       = require('jsonwebtoken');
const { ethers } = require('ethers');

const { leafFromFields, singleLeafTree, hex, buildPayloadString } = require('./merkle');
const { sendVerificationEmail } = require('./emailService'); // must return Promise

// Poseidon
const { buildPoseidon } = require('circomlibjs');
const keccak256 = require('keccak256');

// minimal ABI we use
const CONTRACT_ABI = [
  "function anchorRoot(bytes32 root) external returns (uint256)",
  "function rootToId(bytes32 root) external view returns (uint256)",
  "function verifyUser(uint256 uniqId, bytes32 leaf, bytes32[] calldata proof) external view returns (bool)"
];

// --- Robust env resolution (support multiple variable names) ---
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const TOKEN_EXPIRY = process.env.VERIFY_TOKEN_EXPIRY || '1h';

const SEP_RPC = process.env.SEP_RPC
             || process.env.SEPOLIA_RPC
             || process.env.SEPOLIA_RPC_URL
             || process.env.SEP_RPC_URL
             || null;

const CONTRACT_ADDR = process.env.CONTRACT_ADDR
                   || process.env.CONTRACT_ADDRESS
                   || process.env.CONTRACT_ADDR0
                   || null;

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY
                         || process.env.PRIVATE_KEY
                         || process.env.DEPLOYER_KEY
                         || null;

// Debug print (do NOT print private keys; only show presence)
console.log('[handlers] env check:',
  { SEP_RPC: !!SEP_RPC, CONTRACT_ADDR: !!CONTRACT_ADDR, DEPLOYER_PRIVATE_KEY: !!DEPLOYER_PRIVATE_KEY }
);

if (!SEP_RPC || !CONTRACT_ADDR || !DEPLOYER_PRIVATE_KEY) {
  console.warn('[handlers] WARNING: SEP_RPC, CONTRACT_ADDR or DEPLOYER_PRIVATE_KEY not set in .env — contract calls will fail.');
}

// ethers provider & wallet used to anchor + sign
const provider = SEP_RPC ? new ethers.JsonRpcProvider(SEP_RPC) : null;
const wallet = (DEPLOYER_PRIVATE_KEY && provider) ? new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider) : null;
const signerAddress = wallet ? wallet.address : null;
const contract = (wallet && CONTRACT_ADDR) ? new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, wallet) : null;

// Poseidon instance promise (build once, reuse)
const poseidonPromise = buildPoseidon(); // returns a promise

// Helper: compute Poseidon hash hex string (0x...) from utf8 string (existing)
async function poseidonHashHexFromUtf8(inputString) {
  // canonicalize input
  const s = String(inputString || '');
  // Pre-hash UTF-8 -> keccak256 to create a fixed-size integer input to Poseidon
  const k = keccak256(Buffer.from(s, 'utf8')); // Buffer
  const big = BigInt('0x' + k.toString('hex')); // BigInt
  const poseidon = await poseidonPromise; // await poseidon builder
  const F = poseidon.F;
  const out = poseidon([big]); // poseidon output field element
  // convert to hex string
  const outHex = '0x' + F.toString(out, 16);
  return outHex;
}

// ----------------- NEW HELPERS (Poseidon combine, padding, decimal conversion) ---------------

// pad a 0x hex string to 32 bytes (0x + 64 hex chars)
function to0xPadded32(hexStr) {
  if (!hexStr) return null;
  let s = String(hexStr || '').replace(/^0x/, '');
  if (s.length > 64) {
    // Should not normally happen; Poseidon outputs should fit < field size; but guard.
    // If longer, keep rightmost 64 (not ideal) — better to throw in prod.
    s = s.slice(-64);
  }
  while (s.length < 64) s = '0' + s;
  return '0x' + s.toLowerCase();
}

// convert a 0x-prefixed hex string to decimal string (BigInt)
function hexToDecString(hexStr) {
  if (!hexStr) return null;
  return BigInt(hexStr).toString(10);
}

// compute Poseidon(fieldA, fieldB) where fieldA/fieldB are hex strings "0x..." representing field elems
// returns 0x-prefixed hex string padded to 32 bytes
async function poseidonHashHexFromFieldHex(hexA, hexB) {
  const poseidon = await poseidonPromise;
  const F = poseidon.F;

  // make sure hex inputs are strings with 0x
  const aHex = String(hexA || '').startsWith('0x') ? String(hexA) : '0x' + String(hexA || '');
  const bHex = String(hexB || '').startsWith('0x') ? String(hexB) : '0x' + String(hexB || '');

  // convert to BigInt directly (0x... form supported)
  const aBig = BigInt(aHex);
  const bBig = BigInt(bHex);

  // run poseidon on the two field elements
  const out = poseidon([aBig, bBig]);

  // convert to hex string
  let outHex = F.toString(out, 16); // hex WITHOUT 0x
  // pad left to 64 chars
  while (outHex.length < 64) outHex = '0' + outHex;
  outHex = '0x' + outHex;
  return outHex.toLowerCase();
}

// Normalize email
function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }

// ------------------------- Handlers -------------------------

// 1) POST /api/register-email
// Accepts { email } -> sends verification email containing a signed JWT. Stateless.
async function registerEmailHandler(req, res) {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(String(email))) {
      return res.status(400).json({ success:false, error:'Invalid email.' });
    }
    const norm = normalizeEmail(email);
    const token = jwt.sign({ email: norm }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    try {
      await sendVerificationEmail(norm, token);
    } catch (err) {
      console.error('[handlers] sendVerificationEmail error:', err && err.message ? err.message : err);
      return res.status(500).json({ success:false, error:'Failed to send verification email.' });
    }

    console.log(`[handlers] Sent verification token to ${norm}`);
    return res.json({ success:true, message:'Verification email sent.' });
  } catch (err) {
    console.error('[handlers] registerEmailHandler err:', err);
    return res.status(500).json({ success:false, error:'Server error' });
  }
}

// 2) POST /api/verify-email
// Accepts { token } -> verifies token signature/expiry (no storage)
function verifyEmailHandler(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success:false, error:'Missing token.' });
    try {
      jwt.verify(token, JWT_SECRET);
      return res.json({ success:true, message:'Email verified.' });
    } catch (err) {
      return res.status(400).json({ success:false, error:'Invalid or expired token.' });
    }
  } catch (err) {
    console.error('[handlers] verifyEmailHandler err:', err);
    return res.status(500).json({ success:false, error:'Server error' });
  }
}

// 3) POST /api/complete-registration
// Accepts { token, paraphrase } -> returns a minimal signed package + anchorTxHash + message
async function completeRegistrationHandler(req, res) {
  try {
    const { token, paraphrase } = req.body;
    if (!token) return res.status(400).json({ success:false, error:'Missing token.' });
    if (!paraphrase) return res.status(400).json({ success:false, error:'Missing paraphrase.' });

    // verify token -> get email
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch (e) {
      return res.status(400).json({ success:false, error:'Invalid or expired token.' });
    }
    const email = normalizeEmail(payload.email || '');
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success:false, error:'Invalid email in token.' });
    }

    // paraphrase strength check (basic)
    const errs = [];
    if (paraphrase.length < 8)         errs.push('≥8 chars');
    if (!/[A-Z]/.test(paraphrase))      errs.push('uppercase');
    if (!/[a-z]/.test(paraphrase))      errs.push('lowercase');
    if (!/[0-9]/.test(paraphrase))      errs.push('digit');
    if (!/[!@#$%^&*]/.test(paraphrase)) errs.push('special');

    if (errs.length) return res.status(400).json({ success:false, error:'Paraphrase needs: '+errs.join(', ') });

    // generate salt and timestamp
    const saltBuf = crypto.randomBytes(16);
    const saltHex = '0x' + saltBuf.toString('hex');
    const timestampIso = new Date().toISOString();

    // ===== POSEIDON HASHING (replaces Argon2)
    // We create deterministic Poseidon hashes from the UTF-8 inputs:
    //  - email_hash: Poseidon( keccak256(email) )
    //  - parahash:  Poseidon( keccak256(paraphrase) )
    // These are returned as 0x-prefixed hex strings to be used by merkle leaf builder.
    let emailHashHex, paraHashHex;
    try {
      emailHashHex = await poseidonHashHexFromUtf8(email);
      paraHashHex  = await poseidonHashHexFromUtf8(paraphrase);
    } catch (e) {
      console.error('[handlers] Poseidon hashing failed:', e && e.message ? e.message : e);
      return res.status(500).json({ success:false, error:'Hashing failed.' });
    }

    // internal client tag (keeps leaf unique) — NOT included in final package
    const clientTag = `RND-${crypto.randomBytes(6).toString('hex')}-${Date.now()}`;

    // ----------------- REPLACED: Build leaf & root (use Poseidon combine, single-leaf MVP) ------------
    // Previously: leafFromFields() + keccak-based MerkleTree
    // Now: compute leaf = Poseidon(emailHashField, paraHashField) and set root = leaf (single-leaf)
    let leafHex, rootHex, proofHexArr = [];
    try {
      // combine the two Poseidon field hexes to produce the leaf (Poseidon)
      const combined = await poseidonHashHexFromFieldHex(emailHashHex, paraHashHex); // 0x...
      leafHex = combined; // leaf is the Poseidon of the two field values
      rootHex = leafHex;  // single-leaf tree -> root = leaf
      proofHexArr = [];   // no merkle proof for single leaf
    } catch (e) {
      console.error('[handlers] Poseidon leaf combine failed:', e && e.message ? e.message : e);
      return res.status(500).json({ success:false, error:'Failed to compute leaf/root.' });
    }

    // ----------------- END replacement -----------------------------------------------------------

    // Build canonical payload to sign — include root so signed package matches anchored root
    const canonical = buildPayloadString({
      leaf: leafHex,
      root: rootHex,
      email_hash: emailHashHex,
      parahash: paraHashHex,
      salt: saltHex,
      timestamp: timestampIso
    });

    // Sign the canonical payload if wallet present
    const signature = wallet ? await wallet.signMessage(canonical) : null;

    // Prepare decimal forms for zokrates Playground convenience
    const emailHashDec = hexToDecString(emailHashHex);
    const paraHashDec  = hexToDecString(paraHashHex);
    const leafDec      = hexToDecString(leafHex);
    const rootDec      = hexToDecString(rootHex);

    // Minimal package (fields the user will *download*)
    const minimalPackage = {
      // uniq_id will be filled below if anchored (UNIQ-<N>), otherwise null
      uniq_id: null,
      email_hash: emailHashHex,
      email_hash_dec: emailHashDec,
      parahash: paraHashHex,
      parahash_dec: paraHashDec,
      salt: saltHex,
      timestamp: timestampIso,
      root: rootHex,
      root_dec: rootDec,
      leaf: leafHex,
      leaf_dec: leafDec,
      proof: proofHexArr,
      signer: signerAddress || null,
      signature
    };

    // If contract/wallet NOT configured — return package (anchored=false)
    if (!contract || !wallet) {
      const note = 'Contract/wallet not configured; root not anchored. Set SEP_RPC, CONTRACT_ADDR, DEPLOYER_PRIVATE_KEY in .env for on-chain anchoring.';
      return res.json({
        success: true,
        message: note,
        anchorTxHash: null,
        package: minimalPackage
      });
    }

    // Anchor root on Sepolia using contract.anchorRoot(root)
    // Ensure root is padded to 32 bytes for bytes32 parameter
    const paddedRootHex = to0xPadded32(rootHex);
    let txResponse = null;
    let receipt = null;
    try {
      txResponse = await contract.anchorRoot(paddedRootHex);
      // ensure txResponse is a transaction response
      if (txResponse && typeof txResponse.wait === 'function') {
        receipt = await txResponse.wait();
      }
    } catch (e) {
      console.error('[handlers] anchorRoot tx failed:', e && e.message ? e.message : e);
      // return package with signature but anchored false
      return res.status(500).json({ success:false, error:'Failed to anchor root on-chain.' });
    }

    // anchorTxHash for UI (top-level)
    const anchorTxHash = receipt ? receipt.transactionHash : (txResponse && txResponse.hash ? txResponse.hash : null);

    // Try to read assigned numeric ID from contract mapping rootToId(root)
    let assignedNumId = null;
    try {
      // call view function: rootToId
      const bn = await contract.rootToId(paddedRootHex);
      if (bn && !bn.isZero && (typeof bn.toString === 'function')) {
        const s = bn.toString();
        if (s !== '0') assignedNumId = s;
      }
    } catch (e) {
      // fallback: try to parse logs for the event RootAnchored
      try {
        for (const log of receipt.logs || []) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === 'RootAnchored') {
              assignedNumId = parsed.args[0].toString();
              break;
            }
          } catch (_) { /* ignore non-contract logs */ }
        }
      } catch (ee) {
        console.warn('[handlers] could not determine assignedNumId:', ee && ee.message ? ee.message : ee);
      }
    }

    const uniqAssignedString = assignedNumId ? `UNIQ-${String(assignedNumId).padStart(6,'0')}` : null;
    if (uniqAssignedString) minimalPackage.uniq_id = uniqAssignedString;

    // Build response message
    const message = receipt
      ? `✅ Root successfully anchored on-chain. Tx Hash: ${anchorTxHash}`
      : `Root was submitted (tx created). Tx Hash: ${anchorTxHash || 'N/A'}`;

    // IMPORTANT: the **downloaded package** (minimalPackage) intentionally DOES NOT include internal clientTag.
    // The server returns anchorTxHash & message at top-level so the UI can present the tx hash to the user.
    console.log(`[handlers] Anchored root for leaf=${leafHex} -> assignedNumId=${assignedNumId} tx=${anchorTxHash}`);

    return res.json({
      success: true,
      message,
      anchorTxHash,
      package: minimalPackage
    });

  } catch (err) {
    console.error('[handlers] completeRegistrationHandler err:', err && err.stack ? err.stack : err);
    return res.status(500).json({ success:false, error:'Server error' });
  }
}


// 4) POST /api/login
// Accepts { package: <the downloaded signed json> } and verifies:
// - signature (signed by server signer) using canonical (leaf + root + hashes + timestamp)
// - then calls contract.verifyUser(numericId, leaf, proof)
async function loginHandler(req, res) {
  try {
    const pkg = req.body.package;
    if (!pkg) return res.status(400).json({ success:false, error:'Missing package in request body.' });

    // Required fields (minimal)
    const required = ['uniq_id','email_hash','parahash','salt','timestamp','root','leaf','proof','signer','signature'];
    for (const f of required) {
      if (pkg[f] === undefined || pkg[f] === null) {
        return res.status(400).json({ success:false, error:`Missing package field: ${f}` });
      }
    }

    // Rebuild canonical string we signed earlier
    const canonical = buildPayloadString({
      leaf: pkg.leaf,
      root: pkg.root,
      email_hash: pkg.email_hash,
      parahash: pkg.parahash,
      salt: pkg.salt,
      timestamp: pkg.timestamp
    });

    // verify signature (EIP-191 / personal_sign)
    let recovered;
    try {
      recovered = ethers.verifyMessage(canonical, pkg.signature);
    } catch (e) {
      console.error('[handlers] verifyMessage error:', e && e.message ? e.message : e);
      return res.status(400).json({ success:false, error:'Invalid signature format.' });
    }
    if (recovered.toLowerCase() !== String(pkg.signer).toLowerCase()) {
      return res.status(400).json({ success:false, error:'Signature not issued by expected signer.' });
    }

    // parse numeric id from pkg.uniq_id ("UNIQ-000123")
    const idMatch = String(pkg.uniq_id || '').match(/^UNIQ-(\d+)$/);
    if (!idMatch) return res.status(400).json({ success:false, error:'Invalid or missing uniq_id (anchored id required for on-chain verification).' });
    const numericId = Number(idMatch[1]);
    if (!numericId || numericId <= 0) return res.status(400).json({ success:false, error:'Invalid numeric uniq id in package.' });

    if (!provider || !CONTRACT_ADDR) {
      return res.status(500).json({ success:false, error:'Contract/provider not configured on server.' });
    }

    const readContract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, provider);

    const proof = Array.isArray(pkg.proof) ? pkg.proof : [];
    let ok;
    try {
      ok = await readContract.verifyUser(numericId, pkg.leaf, proof);
    } catch (e) {
      console.error('[handlers] readContract.verifyUser error:', e && e.message ? e.message : e);
      return res.status(500).json({ success:false, error:'On-chain verification failed.' });
    }

    if (!ok) return res.status(400).json({ success:false, error:'Proof not valid against on-chain root.' });

    // success — issue a short-lived JWT for session
    const sessionToken = jwt.sign({ uniq_id: pkg.uniq_id, uniq_num: numericId }, JWT_SECRET, { expiresIn: '1h' });

    console.log(`[handlers] Login success: uniq_id=${pkg.uniq_id} uniq_num=${numericId}`);
    return res.json({ success:true, message:'Login verified on-chain.', uniq_id: pkg.uniq_id, uniq_num: numericId, token: sessionToken });

  } catch (err) {
    console.error('[handlers] loginHandler err:', err && err.stack ? err.stack : err);
    return res.status(500).json({ success:false, error:'Server error' });
  }
}

module.exports = {
  registerEmailHandler,
  verifyEmailHandler,
  completeRegistrationHandler,
  loginHandler
};
