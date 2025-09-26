// server.js (privacy-first, Merkle-anchored MVP)
require('dotenv').config();
const express     = require('express');
const path        = require('path');

const {
  registerEmailHandler,
  verifyEmailHandler,
  completeRegistrationHandler,
  loginHandler
} = require('./handlers');

const app = express();
app.use(express.json());

// DEV: CORS for local demo
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });
}

// Serve static demo UI from ./public
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.post('/api/register-email', registerEmailHandler);
app.post('/api/verify-email', verifyEmailHandler);
app.post('/api/complete-registration', completeRegistrationHandler);
app.post('/api/login', loginHandler);

// legacy SDK verify route (keeps compatibility for demo sites that call /sdk/verify)
app.post('/sdk/verify', (req, res) => {
  return res.status(410).json({ success:false, error:'/sdk/verify deprecated. Use on-chain verify with signed package.' });
});

// Debug route (dev only)
if (process.env.DEBUG_CHAIN === 'true') {
  app.get('/debug/health', (req, res) => {
    const envOk = {
      rpc: !!(process.env.SEP_RPC || process.env.SEPOLIA_RPC || process.env.SEPOLIA_RPC_URL || process.env.SEP_RPC_URL),
      contract: !!(process.env.CONTRACT_ADDR || process.env.CONTRACT_ADDRESS),
      deployer: !!(process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY)
    };
    res.json({ success:true, msg:'Server alive', env: envOk });
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
