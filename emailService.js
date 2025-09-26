// emailService.js
require('dotenv').config();
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send a verification email containing a one-click link.
 * @param {string} to
 * @param {string} token
 */
async function sendVerificationEmail(to, token) {
  const link = `${process.env.BASE_URL}/verify.html?email=${encodeURIComponent(to)}&token=${token}`;
  const msg = {
    to,
    from: process.env.SENDER_EMAIL,
    subject: '🔐 Verify Your Email for UNIQ ID',
    html: `
      <div style="font-family:sans-serif;max-width:600px;">
        <h2>Confirm Your Email Address</h2>
        <p>Click the button below to verify your email and complete registration:</p>
        <a href="${link}" style="
          display:inline-block;
          padding:10px 20px;
          background:#28a745;
          color:white;
          text-decoration:none;
          border-radius:4px;
        ">Verify Email</a>
        <p>If you did not request this, please ignore.</p>
        <p>– The UNIQ ID Team</p>
      </div>
    `
  };
  await sgMail.send(msg);
}

module.exports = { sendVerificationEmail };
