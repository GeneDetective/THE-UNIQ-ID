// merkle.js — Poseidon-based version (no keccak).
// CommonJS, compatible with handlers.js expectations.

const circomlibjs = require("circomlibjs");
const { Buffer } = require("buffer");

// Poseidon instance is async (init once)
let poseidonInstance = null;
async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await circomlibjs.buildPoseidon();
  }
  return poseidonInstance;
}

/**
 * Canonical payload builder — still useful if you want deterministic signing.
 * For Poseidon, we won’t hash this string, but keep it for signatures if needed.
 */
function buildPayloadString({ uniq_id, email_hash, parahash, salt, timestamp, root = "" }) {
  const parts = [
    String(uniq_id || ""),
    String(email_hash || "").toLowerCase(),
    String(parahash || "").toLowerCase(),
    String(salt || "").toLowerCase(),
    String(timestamp || "")
  ];
  if (root) parts.push(String(root || "").toLowerCase());
  return parts.join("|");
}

/**
 * Create a Poseidon leaf = Poseidon([emailHash, paraHash]).
 * Inputs must be decimal strings or BigInt.
 */
async function leafFromFields({ email_hash, parahash }) {
  const poseidon = await getPoseidon();

  // normalize to BigInt
  const emailDec = BigInt(email_hash);
  const paraDec = BigInt(parahash);

  const leaf = poseidon.F.toObject(poseidon([emailDec, paraDec]));
  return BigInt(leaf);
}

/**
 * Build single-leaf "Merkle tree" root = Poseidon([leaf]).
 * This mimics depth=0 ZoKrates flow.
 */
async function singleLeafRoot(leafBigInt) {
  const poseidon = await getPoseidon();
  const root = poseidon.F.toObject(poseidon([BigInt(leafBigInt)]));
  return BigInt(root);
}

/* --------------------- Helpers --------------------- */

/**
 * Convert BigInt/decimal to 0x hex string (no padding).
 */
function decToHex(dec) {
  return "0x" + BigInt(dec).toString(16);
}

/**
 * Convert 0x hex string to decimal string.
 */
function hexToDecString(hexStr) {
  if (!hexStr) return null;
  return BigInt(hexStr).toString(10);
}

/**
 * Ensure hex is 32-byte padded (for solidity bytes32).
 */
function to0xPadded32(hexStr) {
  if (!hexStr) return null;
  let s = String(hexStr).replace(/^0x/, "");
  if (s.length > 64) {
    s = s.slice(-64); // trim if longer
  }
  while (s.length < 64) s = "0" + s;
  return "0x" + s.toLowerCase();
}

/**
 * Buffer helpers (useful if you still need UI/proof interop).
 */
function hexToBuffer(hexStr) {
  if (!hexStr) return null;
  const s = String(hexStr).replace(/^0x/, "");
  const even = s.length % 2 ? "0" + s : s;
  return Buffer.from(even, "hex");
}

function bufferToHex(buf) {
  return "0x" + Buffer.from(buf).toString("hex");
}

/* --------------------- exports --------------------- */

module.exports = {
  buildPayloadString,
  leafFromFields,     // Poseidon leaf builder
  singleLeafRoot,     // Poseidon root builder

  // helpers
  decToHex,
  hexToDecString,
  to0xPadded32,
  hexToBuffer,
  bufferToHex
};
