const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load variables
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const emailTranslations = require('./email-translations');

// ─── Gmail SMTP Transporter ──────────────────────────────────────────────────
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendEmail({ to, subject, html, text, headers, attachments = [] }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[Email] Gmail credentials not configured — skipping email to:', to);
    return null;
  }
  try {
    const finalAttachments = [...attachments];
    if (html && html.includes('cid:sahaplay-logo')) {
      finalAttachments.push({
        filename: 'trans_webl.png',
        path: path.join(__dirname, '../frontend/public/logos/trans_webl.png'),
        cid: 'sahaplay-logo'
      });
    }
    const info = await gmailTransporter.sendMail({
      from: `"SahaPlay" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: text || subject,
      html,
      headers: headers || {},
      attachments: finalAttachments,
    });
    console.log('[Email] Sent successfully to:', to, '| Message ID:', info.messageId);
    return info;
  } catch (err) {
    console.error('[Email] Failed to send to:', to, '| Error:', err.message);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Inline logo for emails — base64 embedded so no attachment is created ───
let EMAIL_LOGO_DATA_URI = '';
try {
  const logoBuf = fs.readFileSync(path.join(__dirname, '../frontend/public/logos/trans_webl.png'));
  EMAIL_LOGO_DATA_URI = `data:image/png;base64,${logoBuf.toString('base64')}`;
} catch (e) {
  console.warn('[Email] Logo not found, emails will have no logo image:', e.message);
}
// ─────────────────────────────────────────────────────────────────────────────

async function sendReporterConfirmationEmail(reportId, reporterUsername, reportedUsername, reason, knownEmail) {
  try {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    let toEmail = knownEmail || null;
    if (!toEmail) {
      const userRes = await pool.query('SELECT email FROM users WHERE LOWER(username) = LOWER($1)', [reporterUsername]);
      toEmail = userRes.rows[0]?.email;
    }
    if (!toEmail) {
      console.log(`[Email] Reporter @${reporterUsername} has no email — skipping confirmation`);
      return;
    }

    const reasonLabel = {
      harassment: 'Harassment / Abuse',
      spam: 'Spam / Advertising',
      hate_speech: 'Hate Speech / Discrimination',
      inappropriate_content: 'Inappropriate / Explicit Content',
      threats: 'Threats / Violence',
      inappropriate_profile: 'Inappropriate Username, Avatar, or Bio',
      other: 'Other'
    }[reason] || reason || 'Other';

    const subject = `[SahaPlay Support] Report Filed Successfully (Ticket #${reportId})`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="cid:sahaplay-logo" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px">SahaPlay Support</div>
        <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px">We have received your report</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700">Report Filed Successfully</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">Hello <strong style="color:#111827">@${esc(reporterUsername)}</strong>,</p>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      Thank you for submitting a report. We have successfully registered your report regarding the user <strong style="color:#111827">@${esc(reportedUsername)}</strong> for <strong>${esc(reasonLabel)}</strong>.
    </p>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      Our moderation team is currently reviewing the details and screenshots you submitted. Once we resolve this issue, we will notify you immediately.
    </p>
    <!-- Ticket Info Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px">
        <p style="margin:0 0 10px;color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Ticket Information</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;line-height:1.6">
          <tr><td style="width:120px;color:#6b7280;font-weight:600">Ticket ID:</td><td>#${reportId}</td></tr>
          <tr><td style="color:#6b7280;font-weight:600">Reported User:</td><td>@${esc(reportedUsername)}</td></tr>
          <tr><td style="color:#6b7280;font-weight:600">Reason:</td><td>${esc(reasonLabel)}</td></tr>
        </table>
      </td></tr>
    </table>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
      If you have any additional information, please contact us at <a href="mailto:sahaaplay@gmail.com" style="color:#6366f1;text-decoration:none;font-weight:600">sahaaplay@gmail.com</a>.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated confirmation from <strong>SahaPlay</strong>. Please do not reply directly to this email.</p>
    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    await sendEmail({
      to: toEmail,
      subject,
      html,
      text: `Hello @${reporterUsername},\n\nWe have received your report regarding @${reportedUsername} for ${reasonLabel} (Ticket #${reportId}).\n\nOur team is currently reviewing it.\n\nSahaPlay Moderation Team`
    });
  } catch (err) {
    console.error('[Email] Failed to send report confirmation:', err.message);
  }
}

async function sendReporterResolutionEmail(reportId, resolverAdminUsername, adminNotes) {
  try {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const reportRes = await pool.query('SELECT "reporterUsername", "reportedUsername", reason, status FROM reports WHERE id = $1', [reportId]);
    const report = reportRes.rows[0];
    if (!report) return;

    const { reporterUsername, reportedUsername, reason, status } = report;
    const userRes = await pool.query('SELECT email FROM users WHERE LOWER(username) = LOWER($1)', [reporterUsername]);
    const toEmail = userRes.rows[0]?.email;
    if (!toEmail) return;

    const reasonLabel = {
      harassment: 'Harassment / Abuse',
      spam: 'Spam / Advertising',
      hate_speech: 'Hate Speech / Discrimination',
      inappropriate_content: 'Inappropriate / Explicit Content',
      threats: 'Threats / Violence',
      inappropriate_profile: 'Inappropriate Username, Avatar, or Bio',
      other: 'Other'
    }[reason] || reason || 'Other';

    const isResolved = status === 'resolved';
    const statusText = isResolved ? 'Resolved' : 'Dismissed';
    const subject = `[SahaPlay Support] Report Status Update: ${statusText} (Ticket #${reportId})`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="cid:sahaplay-logo" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px">SahaPlay Support</div>
        <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px">Report Status Update: ${statusText}</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700">Your Report Has Been ${statusText}</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">Hello <strong style="color:#111827">@${esc(reporterUsername)}</strong>,</p>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      This is a notification that the report you filed regarding the user <strong style="color:#111827">@${esc(reportedUsername)}</strong> (Ticket #${reportId}) has been marked as <strong>${statusText.toLowerCase()}</strong> by our moderation team.
    </p>
    ${adminNotes ? `
    <!-- Notes Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px">
        <p style="margin:0 0 10px;color:#10b981;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Moderation Notes</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.75">${esc(adminNotes)}</p>
      </td></tr>
    </table>
    ` : ''}
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      Thank you for helping us keep SahaPlay a safe and welcoming platform for everyone.
    </p>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
      Best regards,<br>
      <strong>SahaPlay Moderation Team</strong>
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated confirmation from <strong>SahaPlay</strong>. Please do not reply directly to this email.</p>
    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    await sendEmail({
      to: toEmail,
      subject,
      html,
      text: `Hello @${reporterUsername},\n\nYour report regarding @${reportedUsername} (Ticket #${reportId}) has been resolved.\n\n${adminNotes ? 'Notes: ' + adminNotes : ''}\n\nSahaPlay Moderation Team`
    });
  } catch (err) {
    console.error('[Email] Failed to send report resolution email:', err.message);
  }
}


// ─── Detect LAN IP at startup ───
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip loopback and non-IPv4
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1'; // fallback
}
const LAN_IP = getLanIp();
console.log(`[Server] Detected LAN IP: ${LAN_IP}`);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('[FATAL] JWT_SECRET environment variable is not set. Server cannot start.'); process.exit(1); }

// Initialize Supabase (replaces SQLite)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE'; // In a real app, use dotenv
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// Initialize DB
const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// ─── Server-side message encryption ───
const CHAT_ENCRYPTION_SECRET = process.env.CHAT_ENCRYPTION_SECRET || process.env.JWT_SECRET;
const chatKey = crypto.createHash('sha256').update(CHAT_ENCRYPTION_SECRET).digest();

function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false;
  if (str.startsWith('🔒') || str.startsWith('🎥') || str.startsWith('📷')) return false;
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ');
}

function truncateToWordLimit(text, limit = 250) {
  if (!text || typeof text !== 'string') return text;
  if (looksLikeCiphertext(text)) return text;
  const parts = text.split(/(\s+)/);
  let wordCount = 0;
  const truncatedParts = [];
  for (const part of parts) {
    if (part.trim() !== '') {
      wordCount++;
    }
    if (wordCount > limit) {
      break;
    }
    truncatedParts.push(part);
  }
  return truncatedParts.join('');
}

function encryptServerText(text) {
  if (!text) return text;
  try {
    const IV_LENGTH = 16;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', chatKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return 'encv1:' + iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    console.error('[encryptServerText] Error:', e.message);
    return text;
  }
}

function decryptServerText(text) {
  if (!text || typeof text !== 'string') return text;
  if (!text.startsWith('encv1:')) return text;
  try {
    const parts = text.split(':');
    if (parts.length < 3) return text;
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-cbc', chatKey, iv);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[decryptServerText] Failed to decrypt:', e.message);
    return text;
  }
}

function encryptParamsInQuery(sql, params) {
  if (!params || params.length === 0) return params;
  const isInsert = /insert\s+into\s+messages/i.test(sql);
  if (isInsert) {
    const match = sql.match(/insert\s+into\s+messages\s*\(([^)]+)\)/i);
    if (match) {
      const columns = match[1].split(',').map(c => c.trim().replace(/['"`]/g, ''));
      const msgIdx = columns.indexOf('message');
      const senderMsgIdx = columns.indexOf('senderMessage');
      
      const nonceIdx = columns.indexOf('nonce');
      const hasNonce = nonceIdx !== -1 && params[nonceIdx] !== null && params[nonceIdx] !== undefined && params[nonceIdx] !== '';
      
      if (!hasNonce) {
        if (msgIdx !== -1 && typeof params[msgIdx] === 'string' && params[msgIdx]) {
          params[msgIdx] = encryptServerText(params[msgIdx]);
        }
        if (senderMsgIdx !== -1 && typeof params[senderMsgIdx] === 'string' && params[senderMsgIdx]) {
          params[senderMsgIdx] = encryptServerText(params[senderMsgIdx]);
        }
      }
    }
  }
  return params;
}

const originalQuery = pool.query;
pool.query = function (sql, params, callback) {
  let actualSql = sql;
  let actualParams = params;
  let actualCallback = callback;

  if (typeof actualParams === 'function') {
    actualCallback = actualParams;
    actualParams = [];
  }

  if (actualSql && typeof actualSql === 'object' && typeof actualSql.text === 'string') {
    actualSql.values = encryptParamsInQuery(actualSql.text, actualSql.values);
  } else if (typeof actualSql === 'string') {
    actualParams = encryptParamsInQuery(actualSql, actualParams);
  }

  const decryptResult = (result) => {
    if (result && result.rows && Array.isArray(result.rows)) {
      result.rows.forEach(row => {
        if (row.message && typeof row.message === 'string' && row.message.startsWith('encv1:')) {
          row.message = decryptServerText(row.message);
        }
        if (row.senderMessage && typeof row.senderMessage === 'string' && row.senderMessage.startsWith('encv1:')) {
          row.senderMessage = decryptServerText(row.senderMessage);
        }
      });
    }
    return result;
  };

  if (actualCallback) {
    return originalQuery.call(pool, actualSql, actualParams, (err, result) => {
      if (err) return actualCallback(err, null);
      actualCallback(null, decryptResult(result));
    });
  } else {
    return originalQuery.call(pool, actualSql, actualParams).then(result => {
      return decryptResult(result);
    });
  }
};

class SupabaseAdapter {
  constructor() {
    this.serialize = (cb) => { if (cb) cb(); };
    this.close = () => pool.end();
  }
  
  _convertSql(sql, params) {
    let p = params || [];
    if (!Array.isArray(p)) p = [p];
    
    let _idx = 0;
    let pgSql = sql.replace(/\?/g, () => '$' + (++_idx));
    
    const camelCols = [
        'roomId', 'senderId', 'senderName', 'targetId', 'targetName', 
        'ephemeralPublicKey', 'replyTo', 'hiddenFor', 'mediaType', 'mediaUrl', 
        'roomName', 'hostUsername', 'isPublic', 'thumbnailPath', 
        'followerId', 'followingId', 'createdAt', 'isVerified', 
        'verificationToken', 'resetToken', 'resetTokenExpiry', 'displayName', 
        'avatarPath', 'notifyApp', 'notifyJoin', 'notifyMessages', 
        'notifyFriendRequests', 'notifyLeave', 'notifyJoinRequests', 'showCountry', 'pinnedRooms', 
        'lastSeen', 'firstJoined', 'senderAvatar', 'senderAvatarPath', 'senderMessage', 'myFollowStatus'
    ];
    
    const q = String.fromCharCode(34); // actual double-quote character
    camelCols.forEach(col => {
      // Match camelCase column names not already quoted
      const regex = new RegExp('(?<!["\\w])' + col + '(?!["\\w])', 'g');
      pgSql = pgSql.replace(regex, q + col + q);
    });
    
    pgSql = pgSql.replace(/INSERT OR IGNORE/gi, 'INSERT');
    pgSql = pgSql.replace(/AUTOINCREMENT/gi, '');
    pgSql = pgSql.replace(/COLLATE NOCASE/gi, ''); // Postgres handles case insensitivity differently
    
    return { pgSql, p };
  }

  run(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const { pgSql, p } = this._convertSql(sql, params);
    
    let finalSql = pgSql;
    if (sql.match(/INSERT OR IGNORE/i) && !finalSql.includes('ON CONFLICT')) {
      finalSql += ' ON CONFLICT DO NOTHING';
    }

    console.log("[DB EXEC RUN] ", finalSql.substring(0, 100));
    pool.query(finalSql, p)
      .then(res => {
        if (callback) callback.call({ changes: res.rowCount, lastID: res.rows?.[0]?.id }, null);
      })
      .catch(err => {
        if (err.code === '23505' && sql.match(/INSERT OR IGNORE/i)) {
          if (callback) callback.call({ changes: 0 }, null);
        } else {
          console.error("Database Engine Error [RUN]:", err.message, "\nSQL:", finalSql);
          if (callback) callback(err);
        }
      });
  }

  get(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const { pgSql, p } = this._convertSql(sql, params);
    console.log("[DB EXEC GET] ", pgSql.substring(0, 100));
    pool.query(pgSql, p)
      .then(res => { if (callback) callback(null, res.rows[0] || null); })
      .catch(err => { console.error("Database Engine Error [GET]:", err.message, "\nSQL:", pgSql); if (callback) callback(err, null); });
  }

  all(sql, params, callback) {
    if (typeof params === 'function') { callback = params; params = []; }
    const { pgSql, p } = this._convertSql(sql, params);
    console.log("[DB EXEC ALL] ", pgSql.substring(0, 100));
    pool.query(pgSql, p)
      .then(res => { if (callback) callback(null, res.rows || []); })
      .catch(err => { 
        console.error("Database Engine Error [ALL]:", err.message, "\nSQL:", pgSql, "\nParams:", p, "\nStack:", err.stack); 
        if (callback) callback(err, null); 
      });
  }
}


const db = new SupabaseAdapter();


const app = express();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
const server = http.createServer(app);

// Keep track of rooms in memory
// roomID => { currentMedia: string, currentTime: number, isPlaying: boolean, uploaderSocketId: string, timestampUpdatedAt: number }
const rooms = new Map();
const deletingRooms = new Set(); // roomIds currently being deleted — blocks race-condition re-join

// ─── Hyperbeam Cloud Browser sessions: roomId → { session_id, embed_url, createdAt } ───
// Using Hyperbeam TEST key — switch to production key in .env once all 7 tests pass
const activeHyperbeamSessions = new Map();

// Audio Ducking: tracks which users are currently speaking per room
// roomId -> Set(socketId)
const roomSpeakingUsers = new Map();

function detectMediaTypeServer(url) {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('twitch.tv/videos')) return 'twitch_vod';
  if (/\.(mp4|webm|mkv|m3u8|avi|mov)(\?|$)/i.test(url)) return 'direct';
  return null;
}

// Global map: username -> Set of socketIds (all connected sockets for that user)
const connectedSockets = new Map();
function registerSocket(username, socketId) {
  if (!username || username === 'Anonymous') return;
  const key = username.toLowerCase();
  if (!connectedSockets.has(key)) connectedSockets.set(key, new Set());
  connectedSockets.get(key).add(socketId);
}
function unregisterSocket(username, socketId) {
  if (!username) return;
  const key = username.toLowerCase();
  if (!connectedSockets.has(key)) return;
  connectedSockets.get(key).delete(socketId);
  if (connectedSockets.get(key).size === 0) connectedSockets.delete(key);
}
function emitToUser(username, event, data) {
  const sids = connectedSockets.get((username || '').toLowerCase());
  if (!sids) return;
  sids.forEach(sid => io.to(sid).emit(event, data));
}

function getRoomIdForChat(chatId, username, isDm) {
  return new Promise((resolve) => {
    if (!chatId) {
      resolve('');
      return;
    }
    if (chatId.toLowerCase().startsWith('dm-')) {
      resolve(chatId);
      return;
    }
    if (isDm === true) {
      const sorted = [username.toLowerCase(), chatId.toLowerCase()].sort();
      resolve('dm-' + sorted.join('-'));
      return;
    }
    db.get('SELECT "roomId" FROM room_names WHERE LOWER("roomId") = LOWER(?)', [chatId], (err, row) => {
      if (row) {
        resolve(row.roomId); // It's a group room
      } else {
        if (isDm === false) {
          resolve(chatId);
        } else {
          // It's a DM partner username
          const sorted = [username.toLowerCase(), chatId.toLowerCase()].sort();
          resolve('dm-' + sorted.join('-'));
        }
      }
    });
  });
}

// ─── Zero Latency Cache ───
const memoryCache = new Map();

/**
 * Generates a unique cache key based on route and user
 */
function getCacheKey(req) {
  const user = req.user ? req.user.username : 'anon';
  return `${req.method}:${req.baseUrl || ''}${req.path}:${JSON.stringify(req.query)}:${user}`;
}

/**
 * Middleware to intercept database results and store them in RAM
 */
function apiCacheMiddleware(req, res, next) {
  const key = getCacheKey(req);
  const cached = memoryCache.get(key);
  
  if (cached && (Date.now() - cached.timestamp < 60000)) { // 60s TTL
    // console.log(`[CACHE HIT] ${key}`);
    return res.json(cached.data);
  }

  // Intercept res.json
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 200 && data && !data.error) {
      memoryCache.set(key, { data, timestamp: Date.now(), user: req.user?.username });
    }
    return originalJson.call(this, data);
  };
  next();
}

function invalidateCacheForUser(username) {
  if (!username) return;
  const lowerUser = username.toLowerCase();
  for (const key of memoryCache.keys()) {
    const val = memoryCache.get(key);
    if (key.toLowerCase().includes(lowerUser) || (val && val.user && val.user.toLowerCase() === lowerUser)) {
      memoryCache.delete(key);
    }
  }
}

// Fetch avatar and emit message utility
function broadcastMessage(roomId, msg, senderSocketId, senderUsername) {
  db.get('SELECT avatarPath FROM users WHERE username = ?', [senderUsername], (err, row) => {
    const avatar = row ? row.avatarPath : null;
    db.get('SELECT roomName, permissions, settings FROM room_names WHERE roomId = ?', [roomId], (err, roomRow) => {
      let roomPerms = null;
      let roomSettings = null;
      let rName = roomRow ? roomRow.roomName : null;
      if (roomRow) {
        try { roomPerms = JSON.parse(roomRow.permissions); } catch(e){}
        try { roomSettings = JSON.parse(roomRow.settings); } catch(e){}
      }

      const enrichedMsg = { ...msg, senderAvatar: avatar, roomPermissions: roomPerms, roomSettings, roomName: rName };
      
      if (enrichedMsg.type === 'group' && roomId) {
        // Send chat_message to everyone in room socket
        io.in(roomId).emit('chat_message', enrichedMsg);
        
        // Enhance: Send new_chat_message to ALL connected sockets of anyone who might be in this room's context
        // This ensures the "Global Chat" widget gets it even if the user isn't physically in the room tab.
        // We broadcast to everyone except the sender's current socket.
        if (senderSocketId) {
          io.emit('global_new_chat_message', { ...enrichedMsg, senderName: senderUsername });
        } else {
          io.emit('global_new_chat_message', { ...enrichedMsg, senderName: senderUsername });
        }
      } else if (enrichedMsg.type === 'private') {
        emitToUser(enrichedMsg.senderName, 'private_message', { ...enrichedMsg, isMe: true });
        emitToUser(enrichedMsg.targetName, 'private_message', { ...enrichedMsg, isMe: false });
        emitToUser(enrichedMsg.targetName, 'new_chat_message', { ...enrichedMsg, senderName: senderUsername });
        
        invalidateCacheForUser(enrichedMsg.senderName);
        invalidateCacheForUser(enrichedMsg.targetName);
      }
    });
  });
}

function broadcastAdminBadges() {
  io.to('admins').emit('admin_badges_updated');
}

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Required for correct req.ip when behind any proxy layer (localhost, Railway, Render, nginx, etc.)
app.set('trust proxy', 1);

// ─── Rate Limiters (all applied BEFORE route definitions) ────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const skipRoutes = [
      '/api/chats/recent',
      '/api/profile/notifications',
      '/api/rooms/list',
      '/api/messages',
      '/api/follow/requests',
      '/api/follow/status',
      '/api/settings',
      '/api/profile',
      '/api/stream/',
      '/api/blocks',
      '/api/chat-lock/',
    ];
    const url = req.originalUrl || req.url || '';
    return skipRoutes.some(route => url.startsWith(route));
  },
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Try again later.' });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many login attempts. Wait 15 minutes.' });
  }
});

const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Upload limit reached. Wait a few minutes.' });
  }
});

const roomCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many rooms created. Please wait before creating more.' });
  }
});

// Apply limiters — order matters: specific limits before global
app.use('/api/login', loginLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/signup', loginLimiter);
app.use('/api/register', loginLimiter);
app.use('/api/forgot-password', loginLimiter);
app.use('/api/reset-password', loginLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api/', globalLimiter);

// Test endpoint — verify the global limiter fires at request 101
app.get('/api/test-limit', (req, res) => {
  res.json({ message: 'ok', ip: req.ip });
});

// ─────────────────────────────────────────────────────────────────────────────


const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  connectTimeout: 20000,
  allowEIO3: true
});

// Multer setup — disk storage kept for room media streaming (/api/upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });


async function checkBucket() {
  try {
    const { error } = await supabase.storage
      .from('encrypted-media')
      .list('', { limit: 1 });
    if (error) {
      console.error('[BUCKET] Access error:', error.message);
      console.error('[BUCKET] Check Supabase key has storage permissions');
    } else {
      console.log('[BUCKET] encrypted-media accessible ✅');
    }
  } catch (e) {
    console.error('[BUCKET] Check failed:', e.message);
  }
}
checkBucket();

// Ensure stream upload directory exists at startup
fs.mkdirSync(path.join(__dirname, 'uploads', 'streams'), { recursive: true });

// Run on startup: add columns that may not exist in older DB schemas
// Stored as a promise so cleanupExpiredMedia() can await it before querying media_expires_at
const migrationsReady = (async () => {
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_expires_at TIMESTAMPTZ`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] media_expires_at:', e.message);
  });
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS "senderMessage" TEXT`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] senderMessage:', e.message);
  });
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_unsent BOOLEAN DEFAULT FALSE`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] is_unsent:', e.message);
  });
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_file_name TEXT`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] media_file_name:', e.message);
  });
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_file_size BIGINT`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] media_file_size:', e.message);
  });
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_duration INTEGER`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] media_duration:', e.message);
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_seen (
      message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
      room_id VARCHAR(255),
      username VARCHAR(255),
      seen_at BIGINT,
      PRIMARY KEY (message_id, username)
    )
  `).catch(e => console.error('[Migration] message_seen table:', e.message));
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_message_seen_room_id ON message_seen(room_id)
  `).catch(e => console.error('[Migration] message_seen index:', e.message));
  // room_theme column for Custom Room Themes feature
  await pool.query(`ALTER TABLE room_names ADD COLUMN IF NOT EXISTS room_theme TEXT DEFAULT 'default'`)
    .then(() => console.log('[Migration] room_theme column OK'))
    .catch(e => console.error('[Migration] room_theme column error:', e.message));
  // sender_public_key: stores the sender's NaCl public key at message-send time so history
  // can always decrypt even after key rotation or server restart (in-memory map is empty).
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_public_key TEXT`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] sender_public_key:', e.message);
  });
  // country_code: ISO 3166-1 alpha-2 code (e.g. "IN") for emoji flag display
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] country_code:', e.message);
  });
  // firstJoined: JSON object mapping roomId -> join timestamp
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "firstJoined" TEXT DEFAULT '{}'`).catch(e => {
    if (!e.message?.includes('already exists')) console.warn('[Migration] firstJoined:', e.message);
  });
  // Backfill country_code for existing users who have a country name but no code
  try {
    const COUNTRY_NAME_TO_CODE = {
      'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Argentina':'AR','Armenia':'AM',
      'Australia':'AU','Austria':'AT','Azerbaijan':'AZ','Bahrain':'BH','Bangladesh':'BD',
      'Belarus':'BY','Belgium':'BE','Bolivia':'BO','Bosnia and Herzegovina':'BA','Brazil':'BR',
      'Bulgaria':'BG','Cambodia':'KH','Canada':'CA','Chile':'CL','China':'CN',
      'Colombia':'CO','Croatia':'HR','Cuba':'CU','Czech Republic':'CZ','Denmark':'DK',
      'Ecuador':'EC','Egypt':'EG','Ethiopia':'ET','Finland':'FI','France':'FR',
      'Georgia':'GE','Germany':'DE','Ghana':'GH','Greece':'GR','Guatemala':'GT',
      'Honduras':'HN','Hong Kong':'HK','Hungary':'HU','India':'IN','Indonesia':'ID',
      'Iran':'IR','Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT',
      'Japan':'JP','Jordan':'JO','Kazakhstan':'KZ','Kenya':'KE','Kuwait':'KW',
      'Lebanon':'LB','Libya':'LY','Lithuania':'LT','Luxembourg':'LU','Malaysia':'MY',
      'Mexico':'MX','Moldova':'MD','Morocco':'MA','Myanmar':'MM','Nepal':'NP',
      'Netherlands':'NL','New Zealand':'NZ','Nicaragua':'NI','Nigeria':'NG','North Korea':'KP',
      'Norway':'NO','Oman':'OM','Pakistan':'PK','Palestine':'PS','Panama':'PA',
      'Paraguay':'PY','Peru':'PE','Philippines':'PH','Poland':'PL','Portugal':'PT',
      'Qatar':'QA','Romania':'RO','Russia':'RU','Saudi Arabia':'SA','Serbia':'RS',
      'Singapore':'SG','Slovakia':'SK','Slovenia':'SI','Somalia':'SO','South Africa':'ZA',
      'South Korea':'KR','Spain':'ES','Sri Lanka':'LK','Sudan':'SD','Sweden':'SE',
      'Switzerland':'CH','Syria':'SY','Taiwan':'TW','Tajikistan':'TJ','Tanzania':'TZ',
      'Thailand':'TH','Tunisia':'TN','Turkey':'TR','Turkmenistan':'TM','Uganda':'UG',
      'Ukraine':'UA','United Arab Emirates':'AE','United Kingdom':'GB','United States':'US',
      'Uruguay':'UY','Uzbekistan':'UZ','Venezuela':'VE','Vietnam':'VN','Yemen':'YE',
      'Zimbabwe':'ZW'
    };
    const toBackfill = await pool.query(`SELECT id, country FROM users WHERE country IS NOT NULL AND country_code IS NULL`);
    for (const row of toBackfill.rows) {
      const code = COUNTRY_NAME_TO_CODE[row.country];
      if (code) {
        await pool.query(`UPDATE users SET country_code = $1 WHERE id = $2`, [code, row.id]).catch(() => {});
      }
    }
    if (toBackfill.rows.length > 0) console.log(`[Migration] Backfilled country_code for ${toBackfill.rows.length} users`);
  } catch (e) {
    console.warn('[Migration] country_code backfill error (non-fatal):', e.message);
  }

  // ─── Admin System Migrations ─────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_permanently_banned BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS ban_reason TEXT,
      ADD COLUMN IF NOT EXISTS terminated BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
  `).catch(e => console.warn('[Migration] admin user columns:', e.message));

  await pool.query(`
    ALTER TABLE room_names
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()
  `).catch(e => console.warn('[Migration] room_names created_at:', e.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      banned_by_admin_id TEXT NOT NULL,
      ban_type TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      room_id TEXT,
      reason TEXT NOT NULL,
      starts_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(e => console.warn('[Migration] bans table:', e.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      admin_user_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_user_id TEXT,
      room_id TEXT,
      details JSONB,
      reason TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(e => console.warn('[Migration] admin_audit_logs table:', e.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      "roomId" TEXT,
      "reporterUsername" TEXT NOT NULL,
      "reportedUsername" TEXT DEFAULT 'Unknown',
      message TEXT NOT NULL,
      resolved BOOLEAN DEFAULT FALSE,
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(e => console.warn('[Migration] reports table:', e.message));

  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE`)
    .catch(e => console.warn('[Migration] reports.resolved column:', e.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS support_requests (
      id SERIAL PRIMARY KEY,
      request_type VARCHAR(50) NOT NULL DEFAULT 'contact',
      subject VARCHAR(500) NOT NULL,
      message TEXT NOT NULL,
      submitted_by_user_id TEXT,
      submitted_by_email VARCHAR(255),
      submitted_by_name VARCHAR(255),
      room_id VARCHAR(255),
      target_user_id TEXT,
      priority VARCHAR(20) NOT NULL DEFAULT 'medium',
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      attachments JSONB,
      metadata JSONB,
      admin_notes TEXT,
      assigned_to_admin_id TEXT,
      resolved_by_admin_id TEXT,
      resolved_at TIMESTAMPTZ,
      attachment_deleted BOOLEAN DEFAULT FALSE,
      attachment_deleted_at TIMESTAMPTZ,
      email_notification_status VARCHAR(20) DEFAULT 'pending',
      email_notification_error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(e => console.warn('[Migration] support_requests table:', e.message));

  // Add resolution_message column (confidential user-facing message, separate from internal admin_notes)
  await pool.query(`ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS resolution_message TEXT`)
    .catch(e => console.warn('[Migration] resolution_message column:', e.message));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_invites (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'moderator',
      token_hash VARCHAR(255) NOT NULL UNIQUE,
      invited_by_admin_id TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(e => console.warn('[Migration] admin_invites table:', e.message));

  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS target_email TEXT`)
    .catch(e => console.warn('[Migration] admin_audit_logs.target_email column:', e.message));
  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS support_request_id TEXT`)
    .catch(e => console.warn('[Migration] admin_audit_logs.support_request_id column:', e.message));

  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'open'`)
    .catch(e => console.warn('[Migration] reports.status column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS admin_notes TEXT`)
    .catch(e => console.warn('[Migration] reports.admin_notes column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by_admin_id TEXT`)
    .catch(e => console.warn('[Migration] reports.resolved_by_admin_id column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ`)
    .catch(e => console.warn('[Migration] reports.resolved_at column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'`)
    .catch(e => console.warn('[Migration] reports.priority column:', e.message));

  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reason VARCHAR(50)`)
    .catch(e => console.warn('[Migration] reports.reason column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS description TEXT`)
    .catch(e => console.warn('[Migration] reports.description column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS attachments JSONB`)
    .catch(e => console.warn('[Migration] reports.attachments column:', e.message));
  await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS assigned_to_admin_id TEXT`)
    .catch(e => console.warn('[Migration] reports.assigned_to_admin_id column:', e.message));

  // ─── Performance Indexes ──────────────────────────────────────────────────
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_roomid_timestamp ON messages ("roomId", timestamp DESC)`)
    .catch(e => console.warn('[Migration] idx_messages_roomid_timestamp:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages (type, LOWER("senderName"), LOWER("targetName"), timestamp DESC)`)
    .catch(e => console.warn('[Migration] idx_messages_dm:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users (LOWER(username))`)
    .catch(e => console.warn('[Migration] idx_users_lower_username:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_followingid_status ON follows ("followingId", status)`)
    .catch(e => console.warn('[Migration] idx_follows_followingid_status:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_follows_followerid_status ON follows ("followerId", status)`)
    .catch(e => console.warn('[Migration] idx_follows_followerid_status:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at)`)
    .catch(e => console.warn('[Migration] idx_users_created_at:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs (created_at DESC)`)
    .catch(e => console.warn('[Migration] idx_audit_logs_created_at:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reports_createdat ON reports ("createdAt" DESC)`)
    .catch(e => console.warn('[Migration] idx_reports_createdat:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users ("verificationToken")`)
    .catch(e => console.warn('[Migration] idx_users_verification_token:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users ("resetToken")`)
    .catch(e => console.warn('[Migration] idx_users_reset_token:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_bans_user_active ON bans (user_id, active)`)
    .catch(e => console.warn('[Migration] idx_bans_user_active:', e.message));
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
    .catch(e => console.warn('[Migration] pg_trgm extension:', e.message));
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username_trgm ON users USING GIN (username gin_trgm_ops)`)
    .catch(e => console.warn('[Migration] idx_users_username_trgm:', e.message));

  console.log('[Migration] Admin system migrations complete');
})();

function computeMediaExpiry(mediaType) {
  if (!mediaType) return null;
  if (mediaType.startsWith('image/')) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  if (mediaType.startsWith('video/')) return new Date(Date.now() + 7  * 24 * 60 * 60 * 1000);
  if (mediaType.startsWith('audio/')) return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // documents / other
}

// â"€â"€ YouTube Search Proxy (via yt-search) â"€â"€
const ytSearch = require('yt-search');

app.get('/api/youtube/search', async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json([]);
  
  try {
    const r = await ytSearch(q);
    const results = r.videos.slice(0, 20).map(v => ({
      videoId: v.videoId,
      title: v.title,
      author: v.author.name,
      lengthSeconds: v.seconds,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`
    }));
    return res.json(results);
  } catch (error) {
    console.error('YouTube search error:', error);
    res.status(502).json({ error: 'YouTube search unavailable. Try again shortly.' });
  }
});

// --- Twitch Discovery (Simulated Mode) ---
const SIMULATED_TWITCH_CHANNELS = [
  { id: 'xqc', name: 'xQc', title: 'Reacting to Daily Dose of Internet', category: 'Just Chatting' },
  { id: 'kaicenat', name: 'KaiCenat', title: 'MAFIATHON 2.0 - 24/7 LIVE', category: 'Just Chatting' },
  { id: 'ibai', name: 'ibai', title: 'KINGS LEAGUE MUNDIAL!', category: 'Sports' },
  { id: 'auronplay', name: 'auronplay', title: 'Hablando un poco', category: 'Just Chatting' },
  { id: 'gaules', name: 'gaules', title: 'MAJOR CS coverage - Gaules TV', category: 'Counter-Strike 2' },
  { id: 'ninja', name: 'Ninja', title: 'Fortnite OG Season is back!', category: 'Fortnite' },
  { id: 'shroud', name: 'shroud', title: 'Playing everything new', category: 'Gaming' },
  { id: 'riotgames', name: 'Riot Games', title: 'LEC Spring Split Playoffs', category: 'Esports' },
  { id: 'tarik', name: 'tarik', title: 'VCT Watchparty w/ friends', category: 'Valorant' },
  { id: 'hasanabi', name: 'HasanAbi', title: 'News, Politics & Culture', category: 'Just Chatting' },
  { id: 'pokimane', name: 'pokimane', title: 'Cozy gaming & chat', category: 'Just Chatting' },
  { id: 'asmongold', name: 'Asmongold', title: 'The state of gaming in 2024', category: 'Just Chatting' },
  { id: 'chess', name: 'Chess', title: 'Champions Chess Tour', category: 'Gaming' },
  { id: 'monstercat', name: 'monstercat', title: '24/7 Music Radio', category: 'Music' },
  { id: 'chillhop', name: 'chillhop', title: 'Lofi hip hop radio - beats to relax/study to', category: 'Music' },
  { id: 'ludwig', name: 'ludwig', title: 'The Biggest Event of the Year', category: 'Just Chatting' },
  { id: 'sypherpk', name: 'SypherPK', title: 'Fortnite Fashion Show!', category: 'Fortnite' },
  { id: 'clix', name: 'Clix', title: 'FNCS Finals Day 2', category: 'Fortnite' },
  { id: 'valkyrae', name: 'Valkyrae', title: 'Among Us with Friends!', category: 'Gaming' },
  { id: 'disguisedtoast', name: 'DisguisedToast', title: 'Team DSG Watchparty', category: 'Esports' },
  { id: 'lilypichu', name: 'LilyPichu', title: 'Art & Piano', category: 'Art' },
  { id: 'tenz', name: 'TenZ', title: 'Aim Lab then Ranked', category: 'Valorant' },
  { id: 's1mple', name: 's1mple', title: 'CS2 Pro Grind', category: 'Counter-Strike 2' },
  { id: 'esl_csgo', name: 'ESL_CSGO', title: 'Pro League Season 20', category: 'Esports' },
  { id: 'bobross', name: 'BobRoss', title: 'The Joy of Painting', category: 'Art' },
  { id: 'beyondthesummit', name: 'BeyondTheSummit', title: 'Dota 2 Pro Circuit', category: 'Esports' },
  { id: 'rocketleague', name: 'RocketLeague', title: 'RLCS Major Finals', category: 'Esports' },
  { id: 'speedrun', name: 'Speedrun', title: 'GDQ Any% Runs', category: 'Esports' },
  { id: 'marcrebillet', name: 'MarcRebillet', title: 'Improv Live Session', category: 'Music' },
  { id: 'deadmau5', name: 'deadmau5', title: 'Studio Session', category: 'Music' }
].map(c => ({
  ...c,
  thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${c.id.toLowerCase()}-440x248.jpg`
}));

async function getLiveTwitchStreams() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = process.env.TWITCH_ACCESS_TOKEN;
  if (!clientId || !token || clientId.includes('your_client_id')) return null;

  try {
    const r = await fetch('https://api.twitch.tv/helix/streams?first=40', {
      headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const { data } = await r.json();
    return data.map(s => ({
      id: s.user_login,
      name: s.user_name,
      title: s.title,
      category: s.game_name,
      thumbnail: s.thumbnail_url.replace('{width}', '440').replace('{height}', '248')
    }));
  } catch (err) {
    console.error('Twitch API error:', err);
    return null;
  }
}

async function searchTwitchChannels(query) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = process.env.TWITCH_ACCESS_TOKEN;
  if (!clientId || !token || clientId.includes('your_client_id')) return null;

  try {
    const r = await fetch(`https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=20`, {
      headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) return null;
    const { data } = await r.json();
    return data.map(c => ({
      id: c.broadcaster_login,
      name: c.display_name,
      title: c.title,
      category: c.game_name,
      thumbnail: c.thumbnail_url.replace('{width}', '440').replace('{height}', '248'),
      isLive: c.is_live
    }));
  } catch (err) {
    console.error('Twitch Search error:', err);
    return null;
  }
}

app.get('/api/twitch/top', async (req, res) => {
  const live = await getLiveTwitchStreams();
  res.json(live || SIMULATED_TWITCH_CHANNELS);
});

app.get('/api/twitch/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const live = await searchTwitchChannels(q);
  if (live) return res.json(live);

  const query = q.toLowerCase();
  const matches = SIMULATED_TWITCH_CHANNELS.filter(c => 
    c.id.toLowerCase().includes(query) || 
    c.name.toLowerCase().includes(query) ||
    c.title.toLowerCase().includes(query) ||
    c.category.toLowerCase().includes(query)
  );
  if (matches.length > 0) return res.json(matches);
  
  res.json([{
    id: q.replace(/\s+/g, ''),
    name: q,
    title: 'Watch Live Content',
    category: 'Twitch Search',
    thumbnail: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${q.replace(/\s+/g, '').toLowerCase()}-440x248.jpg`
  }]);
});

// --- Vimeo Discovery (Simulated Staff Picks) ---
const SIMULATED_VIMEO_VIDEOS = [
  { id: '118671603', name: 'The Last Knit', title: 'Award Winning Animation', category: 'Animation' },
  { id: '119421832', name: 'Alike', title: 'Emotional Story of Life', category: 'Creative' },
  { id: '221532151', name: 'The Present', title: 'A Boy and a Gift', category: 'Cinema' },
  { id: '269661571', name: 'In a Heartbeat', title: 'Animated Short Film', category: 'Animation' },
  { id: '231791807', name: 'The Maker', title: 'Stop Motion Masterpiece', category: 'Arts' },
  { id: '8354924', name: 'Falling', title: 'Cinematography Showcase', category: 'Cinema' },
  { id: '7127490', name: 'Mortimer', title: 'Short Film Selection', category: 'Experimental' },
  { id: '27246366', name: 'The Elephant\'s Garden', title: 'Surreal Visual Voyage', category: 'Experimental' },
  { id: '2475184', name: 'Address Is Approximate', title: 'Google Maps Journey', category: 'Creative' },
  { id: '22439234', name: 'Symmetry', title: 'The Beauty of Math', category: 'Arts' },
  { id: '137885456', name: 'The Old Man and the Sea', title: 'Classic Animation', category: 'Animation' },
  { id: '10829255', name: 'Pioneer', title: 'Historical Drama', category: 'Cinema' },
  { id: '22439234', name: 'Oscillation', title: 'Visual Physics', category: 'Experimental' }
].map(v => ({
  ...v,
  thumbnail: `https://vumbnail.com/${v.id}.jpg`
}));

app.get('/api/vimeo/top', (req, res) => {
  res.json(SIMULATED_VIMEO_VIDEOS);
});

app.get('/api/vimeo/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const query = q.toLowerCase();
  const matches = SIMULATED_VIMEO_VIDEOS.filter(v => 
    v.id.toLowerCase().includes(query) || 
    v.name.toLowerCase().includes(query) ||
    v.title.toLowerCase().includes(query) ||
    v.category.toLowerCase().includes(query)
  );
  if (matches.length > 0) return res.json(matches);
  
  // Fallback for direct ID join
  res.json([{
    id: q.replace(/\D/g, ''), // Keep only digits for Vimeo IDs
    name: `Video ${q}`,
    title: 'Watch Professional Video',
    category: 'Vimeo Search',
    thumbnail: `https://vumbnail.com/${q.replace(/\D/g, '')}.jpg`
  }]);
});


// POST /api/report-message — full message report with mandatory proof images + email
app.post('/api/report-message', async (req, res) => {
  const { roomId, reporterUsername, reportedUsername, message, reason, description, images } = req.body;

  // ── Validation ──────────────────────────────────────────────
  if (!reporterUsername || !reportedUsername || !message) {
    return res.status(400).json({ success: false, error: 'reporterUsername, reportedUsername, and message are required.' });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ success: false, error: 'At least 1 proof image is required to submit a report.' });
  }
  if (images.length > 5) {
    return res.status(400).json({ success: false, error: 'Maximum 5 images allowed.' });
  }

  // ── Image validation ─────────────────────────────────────────
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const attachments = [];
  const dbAttachments = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || !img.data || !img.type) continue;
    if (!OK_TYPES.includes(img.type))
      return res.status(400).json({ success: false, error: `Image ${i + 1}: only JPG, PNG, GIF, WEBP allowed.` });
    const raw = img.data.replace(/^data:[^;]+;base64,/, '');
    const bytes = Math.ceil((raw.length * 3) / 4);
    if (bytes > 5 * 1024 * 1024)
      return res.status(400).json({ success: false, error: `Image ${i + 1} exceeds the 5 MB limit.` });
    attachments.push({ filename: img.name || `proof-${i + 1}`, content: raw, encoding: 'base64', contentType: img.type });
    dbAttachments.push({ filename: img.name || `proof-${i + 1}`, type: img.type, data: img.data });
  }

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  const reasonLabel = {
    harassment: 'Harassment / Abuse', spam: 'Spam / Advertising',
    hate_speech: 'Hate Speech / Discrimination', inappropriate_content: 'Inappropriate / Explicit Content',
    threats: 'Threats / Violence', other: 'Other',
  }[reason] || reason || 'Not specified';

  // ── Save to reports DB ─────────────────────────────────────────────────────
  let reportId = null;
  try {
    const dbInsert = await pool.query(
      `INSERT INTO reports ("roomId", "reporterUsername", "reportedUsername", message, reason, description, attachments, status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 'high') RETURNING id`,
      [
        roomId || null,
        reporterUsername,
        reportedUsername,
        (message || '').substring(0, 1000),
        reason || 'other',
        (description || '').substring(0, 2000),
        JSON.stringify(dbAttachments),
      ]
    );
    reportId = dbInsert.rows[0]?.id;
    if (reportId) {
      broadcastAdminBadges();
      sendReporterConfirmationEmail(reportId, reporterUsername, reportedUsername, reason);
    }
  } catch (dbErr) {
    console.error('[report-message] DB save error:', dbErr.message);
    return res.status(500).json({ success: false, error: 'Failed to save report. Please try again.' });
  }

  // ── Email notification ─────────────────────────────────────────────────────
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const msgSnippet = (message || '').slice(0, 400) + ((message || '').length > 400 ? '…' : '');
    const notifyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#09090b">
<div style="max-width:600px;margin:40px auto;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:28px 36px;text-align:center">
    <img src="cid:sahaplay-logo" alt="SahaPlay" width="48" height="48" style="width:48px;height:48px;margin:0 auto 12px;display:block;" />
    <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0">🚩 Message Report #${reportId}</h1>
    <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">via SahaPlay Group Chat</p>
  </div>
  <div style="padding:28px 36px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px;width:120px">Reporter</td>
          <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#fff;font-size:14px;font-weight:600">@${esc(reporterUsername)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Reported User</td>
          <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#f87171;font-size:14px;font-weight:700">@${esc(reportedUsername)}</td></tr>
      <tr><td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Room</td>
          <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#fff;font-size:14px">${esc(roomId || 'Global Chat')}</td></tr>
      <tr><td style="padding:9px 0;color:#9ca3af;font-size:13px">Reason</td>
          <td style="padding:9px 0;color:#fbbf24;font-size:14px;font-weight:700">${esc(reasonLabel)}</td></tr>
    </table>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">Reported Message</p>
      <p style="color:#e5e7eb;font-size:14px;line-height:1.7;margin:0;font-style:italic">"${esc(msgSnippet)}"</p>
    </div>
    ${description ? `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:16px;margin-bottom:16px">
      <p style="color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">Reporter Notes</p>
      <p style="color:#e5e7eb;font-size:14px;line-height:1.7;margin:0">${esc(description)}</p>
    </div>` : ''}
    <p style="color:#9ca3af;font-size:13px;margin:0">📎 ${attachments.length} proof image${attachments.length > 1 ? 's' : ''} attached</p>
  </div>
</div>
</body></html>`;

    sendEmail({
      to: process.env.GMAIL_USER,
      subject: `[SahaPlay Report] ${reasonLabel} — @${reporterUsername} reported @${reportedUsername}`,
      html: notifyHtml,
      text: `Message Report #${reportId}\nReporter: @${reporterUsername}\nReported: @${reportedUsername}\nRoom: ${roomId || 'Global Chat'}\nReason: ${reasonLabel}\nMessage: "${(message || '').slice(0, 400)}"\nNotes: ${description || 'None'}`,
      attachments,
    }).catch(err => console.warn('[report-message] Email failed (non-fatal):', err.message));
  }

  return res.json({ success: true, reportId });
});

// Auth Endpoints
app.post('/api/signup', async (req, res) => {
  const { username: rawUsername, email, password } = req.body;
  if (!rawUsername || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character' });
  }
  const username = rawUsername.toLowerCase();

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Detect country from IP
    let detectedCountry = null;
    let detectedCountryCode = null;
    try {
      const headerCode = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'];
      if (headerCode && headerCode !== 'XX') {
        detectedCountryCode = headerCode;
      } else {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const cleanIp = ip.replace('::ffff:', '');
        const geoRes = await fetch(`http://ip-api.com/json/${cleanIp === '127.0.0.1' || cleanIp === '::1' ? '' : cleanIp}?fields=country,countryCode`);
        const geoData = await geoRes.json();
        if (geoData && geoData.country) {
          detectedCountry = geoData.country;
          detectedCountryCode = geoData.countryCode || null;
        }
      }
    } catch (e) { /* silent */ }

    // Generate secure verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      'INSERT INTO users (username, email, password, "isVerified", "verificationToken", country, country_code) VALUES ($1, $2, $3, 0, $4, $5, $6) RETURNING id',
      [username, email, hashedPassword, verificationToken, detectedCountry, detectedCountryCode]
    );
    const newUserId = result.rows[0].id;

    // Return a short-lived token so the client can immediately call /api/auth/setup-keys
    const setupToken = jwt.sign({ id: newUserId, username }, JWT_SECRET, { expiresIn: '10m' });

    // Send Verification Email
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${verificationToken}`;
    const verifyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Email Verification</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">Welcome, ${rawUsername}!</h1>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      Thank you for signing up for SahaPlay. Please verify your email address to activate your account and start watching with friends.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${verifyLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(99,102,241,0.2)">Verify Email Address</a>
    </div>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
      If you did not create this account, you can safely ignore this email.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
    sendEmail({
      to: email,
      subject: `Verify your SahaPlay account`,
      text: `Hi ${rawUsername},\n\nPlease verify your email by clicking: ${verifyLink}\n\nThe SahaPlay Team`,
      html: verifyHtml,
    });

    return res.json({ message: 'Account created! Please check your email to verify your account.', token: setupToken });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    console.error('[signup] Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.get('/api/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const result = await pool.query('SELECT id FROM users WHERE "verificationToken" = $1', [token]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token' });

    const user = result.rows[0];
    await pool.query('UPDATE users SET "isVerified" = 1, "verificationToken" = NULL WHERE id = $1', [user.id]);
    
    res.json({ message: 'Email successfully verified. You can now login.' });
  } catch (err) {
    console.error('[verify] Error:', err);
    res.status(500).json({ error: 'Database error during verification' });
  }
});

app.post('/api/resend-verification', loginLimiter, async (req, res) => {
  const { email } = req.body;
  // Always return generic response to prevent email enumeration
  res.json({ message: 'If that email has a pending verification, we have sent a new link.' });
  if (!email) return;
  try {
    const result = await pool.query(
      'SELECT id, username, "isVerified" FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user || user.isVerified !== 0) return;
    const newToken = crypto.randomBytes(32).toString('hex');
    await pool.query('UPDATE users SET "verificationToken" = $1 WHERE id = $2', [newToken, user.id]);
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${newToken}`;
    const resendHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr><td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
            ${EMAIL_LOGO_DATA_URI ? `<img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />` : '<span style="color:#fff;font-size:24px;font-weight:800">S</span>'}
          </td></tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Email Verification</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">Verify your email, ${user.username}!</h1>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      You requested a new verification link. Click the button below to verify your email address and activate your SahaPlay account.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${verifyLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(99,102,241,0.2)">Verify Email Address</a>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">If you did not request this, you can safely ignore this email.</p>
  </td></tr>
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
    await sendEmail({
      to: email,
      subject: 'Verify your SahaPlay account',
      text: `Hi ${user.username},\n\nHere is your new verification link: ${verifyLink}\n\nThe SahaPlay Team`,
      html: resendHtml,
    });
  } catch (err) {
    console.error('[resend-verification] Error:', err);
  }
});

app.post('/api/login', async (req, res) => {
  const { username: rawUsername, password } = req.body;
  const username = rawUsername ? rawUsername.toLowerCase() : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, email, password, role, "isVerified", terminated, is_permanently_banned,
              banned_until, ban_reason, "encryptedPrivateKey", "publicKey"
       FROM users WHERE username = $1 OR email = $1`,
      [username]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    
    const user = result.rows[0];
    
    if (user.isVerified === 0) {
      return res.status(400).json({ error: 'Invalid credentials', needsVerification: true });
    }
    
    // If the user originated from Google, they might not have a password
    if (!user.password && password) {
       return res.status(400).json({ error: 'Please sign in with Google' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) return res.status(400).json({ error: 'Invalid credentials' });

    // ─── Ban / termination enforcement ───
    if (user.terminated) {
      return res.status(403).json({
        error: `Your account has been permanently terminated by an admin.\nReason: ${user.ban_reason || 'Policy violation'}\nYou can no longer use this account.`,
        code: 'ACCOUNT_TERMINATED',
        reason: user.ban_reason || 'Policy violation',
      });
    }
    if (user.is_permanently_banned) {
      return res.status(403).json({
        error: `Your account has been permanently banned by an admin.\nReason: ${user.ban_reason || 'Policy violation'}`,
        code: 'ACCOUNT_BANNED_PERMANENT',
        reason: user.ban_reason || 'Policy violation',
      });
    }
    if (user.banned_until && new Date(user.banned_until) > new Date()) {
      const expiry = new Date(user.banned_until).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
      return res.status(403).json({
        error: `Your account has been banned until ${expiry}.\nReason: ${user.ban_reason || 'Policy violation'}`,
        code: 'ACCOUNT_BANNED_TEMP',
        bannedUntil: user.banned_until,
        reason: user.ban_reason || 'Policy violation',
      });
    }


    // ─── Track last login ───
    pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: 'Login successful',
      token,
      username: user.username,
      role: user.role || 'user',
      encryptedPrivateKey: user.encryptedPrivateKey || null,
      publicKey: user.publicKey || null
    });
  } catch (err) {
    console.error('[LOGIN] DB Error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name } = payload;
    
    // Check if user exists
    const existingUser = await pool.query(
      `SELECT id, username, email, role, "isVerified", terminated, is_permanently_banned, banned_until, ban_reason
       FROM users WHERE email = $1`,
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.isVerified === 0) {
        return res.status(403).json({ error: 'Account not verified. Please check your email to verify your account.' });
      }

      // ─── Ban / termination enforcement ───
      if (user.terminated) {
        return res.status(403).json({
          error: `Your account has been permanently terminated by an admin.\nReason: ${user.ban_reason || 'Policy violation'}\nYou can no longer use this account.`,
          code: 'ACCOUNT_TERMINATED',
          reason: user.ban_reason || 'Policy violation',
        });
      }
      if (user.is_permanently_banned) {
        return res.status(403).json({
          error: `Your account has been permanently banned by an admin.\nReason: ${user.ban_reason || 'Policy violation'}`,
          code: 'ACCOUNT_BANNED_PERMANENT',
          reason: user.ban_reason || 'Policy violation',
        });
      }
      if (user.banned_until && new Date(user.banned_until) > new Date()) {
        const expiry = new Date(user.banned_until).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
        return res.status(403).json({
          error: `Your account has been banned until ${expiry}.\nReason: ${user.ban_reason || 'Policy violation'}`,
          code: 'ACCOUNT_BANNED_TEMP',
          bannedUntil: user.banned_until,
          reason: user.ban_reason || 'Policy violation',
        });
      }


      // ─── Track last login ───
      pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
      return res.json({ message: 'Login successful', token, username: user.username, role: user.role || 'user' });
    } else {
      // User does not exist, create them
      const baseUsername = (name || 'user').replace(/\s+/g, '').toLowerCase();
      const randSuffix = Math.floor(Math.random() * 10000);
      const finalUsername = `${baseUsername}${randSuffix}`;
      
      const verificationToken = crypto.randomBytes(32).toString('hex');

      const insertResult = await pool.query(
        'INSERT INTO users (username, email, password, "isVerified", "verificationToken") VALUES ($1, $2, NULL, 0, $3) RETURNING id',
        [finalUsername, email, verificationToken]
      );
      
      const newId = insertResult.rows[0]?.id;
      // Setup token for keys
      const token = jwt.sign({ id: newId, username: finalUsername }, JWT_SECRET, { expiresIn: '10m' });

      // Send verification email to new Google user
      const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${verificationToken}`;
      const verifyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Email Verification</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">Welcome, ${finalUsername}!</h1>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      Thank you for signing up for SahaPlay. Please verify your email address to activate your account and start watching with friends.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${verifyLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(99,102,241,0.2)">Verify Email Address</a>
    </div>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
      If you did not create this account, you can safely ignore this email.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

      sendEmail({
        to: email,
        subject: 'Verify your SahaPlay account',
        text: `Hi ${finalUsername},\n\nPlease verify your email by clicking: ${verifyLink}\n\nThe SahaPlay Team`,
        html: verifyHtml
      });

      return res.json({ message: 'Signup successful', token, username: finalUsername });
    }

  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  const { email, lang } = req.body;
  const userLang = lang || 'en';
  const L = emailTranslations[userLang] || emailTranslations['en'] || {};

  if (!email) return res.status(400).json({ error: L.apiResetEmailOrUsernameRequired || 'Email or username is required' });

  try {
    // Accept either email OR username lookup — use pool.query directly
    const result = await pool.query(
      'SELECT id, email FROM users WHERE email = $1 OR LOWER(username) = LOWER($2)',
      [email, email]
    );
    const user = result.rows[0];

    // If user doesn't exist, return generic success (prevent email enumeration)
    if (!user) {
      return res.json({ message: L.apiResetSuccessGeneric || 'If an account matches that email, a password reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = Date.now() + 600000; // 10 minutes from now

    // Update reset token in DB using pool.query directly (proper PostgreSQL)
    await pool.query(
      'UPDATE users SET "resetToken" = $1, "resetTokenExpiry" = $2 WHERE id = $3',
      [resetToken, resetExpiry, user.id]
    );

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Send real email via Gmail SMTP
    const resetHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">${L.emailResetTagline || 'SahaPlay. Anywhere.'}</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">${L.emailResetHeading || 'Reset Your Password'}</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.75">
      ${L.emailResetBody1 || 'We received a request to reset the password for your SahaPlay account associated with'} <strong style="color:#7c3aed;">${user.email}</strong>.
      ${L.emailResetBody2 || 'Click the button below to create a new password. This link expires in'} <strong style="color:#111827;">${L.emailResetExpiry || '10 minutes'}</strong>.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(124,58,237,0.2)">${L.emailResetBtn || 'Reset My Password'}</a>
    </div>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0 0 12px;color:#9ca3af;font-size:13px;line-height:1.6">
      ${L.emailResetIgnore || "If you did not request a password reset, you can safely ignore this email — your password will remain unchanged."}
    </p>
    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6">
      ${L.emailResetCopyLink || 'Or copy and paste this link in your browser:'}<br>
      <a href="${resetLink}" style="color:#7c3aed;word-break:break-all;">${resetLink}</a>
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    const textVersion = `Hello ${user.username},

${L.emailResetHeading || 'Reset Your Password'}

${L.emailResetBody1 || 'We received a request to reset the password for your SahaPlay account associated with'} ${user.email}.
${L.emailResetBody2 || 'Click the button below to create a new password. This link expires in'} ${L.emailResetExpiry || '10 minutes'}:
${resetLink}

${L.emailResetIgnore || "If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged."}

${L.emailResetFooter || '© 2026 SahaPlay · All rights reserved'}`;

    await sendEmail({
      to: user.email,
      subject: L.emailResetSubject || 'Reset your SahaPlay password',
      text: textVersion,
      html: resetHtml,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'SahaPlay Mailer',
        'List-Unsubscribe': `<mailto:${process.env.GMAIL_USER}>`,
      }
    });

    return res.json({ message: L.apiResetSuccess || 'Password reset link sent to your email!' });

  } catch (err) {
    console.error('[forgot-password] Error:', err);
    return res.status(500).json({ error: L.apiErrorFallback || 'Something went wrong. Please try again.' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword, publicKey, encryptedPrivateKey, recoveryKeyHash } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include an uppercase letter, a number, and a special character' });
  }

  try {
    // Look up user by reset token
    const result = await pool.query(
      'SELECT id, username, "resetToken", "resetTokenExpiry" FROM users WHERE "resetToken" = $1',
      [token]
    );
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    if (Date.now() > Number(user.resetTokenExpiry)) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear token
    if (publicKey && encryptedPrivateKey && recoveryKeyHash) {
      await pool.query(
        'UPDATE users SET password = $1, "resetToken" = NULL, "resetTokenExpiry" = NULL, "publicKey" = $2, "encryptedPrivateKey" = $3, "recoveryKeyHash" = $4 WHERE id = $5',
        [hashedPassword, publicKey, encryptedPrivateKey, recoveryKeyHash, user.id]
      );
    } else {
      await pool.query(
        'UPDATE users SET password = $1, "resetToken" = NULL, "resetTokenExpiry" = NULL WHERE id = $2',
        [hashedPassword, user.id]
      );

      // The user failed to provide a recovery key. As requested, clear all their messages to ensure safety and start fresh.
      await pool.query(
        'DELETE FROM messages WHERE "senderName" = $1 OR "targetName" = $1',
        [user.username]
      );
    }

    console.log(`[RESET] Password successfully reset for @${user.username}`);

    // Return a short-lived token so ResetPassword.jsx can call /api/auth/rekey immediately
    const rekeyToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '10m' });
    return res.json({ message: 'Password has been successfully reset. You can now login.', token: rekeyToken });

  } catch (err) {
    console.error('[reset-password] Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});



// ─── E2EE Key Management Endpoints ──────────────────────────────────────────

/**
 * POST /api/auth/setup-keys
 * Called after signup (or first login for legacy accounts).
 * Stores the user's public key and PBKDF2+AES-wrapped private key.
 * The raw private key NEVER reaches the server.
 */
app.post('/api/auth/setup-keys', authenticateToken, async (req, res) => {
  const { publicKey, encryptedPrivateKey, recoveryKeyHash } = req.body;
  if (!publicKey || !encryptedPrivateKey) {
    return res.status(400).json({ error: 'publicKey and encryptedPrivateKey are required' });
  }

  try {
    await pool.query(
      'UPDATE users SET "publicKey" = $1, "encryptedPrivateKey" = $2, "recoveryKeyHash" = $3 WHERE id = $4',
      [publicKey, encryptedPrivateKey, recoveryKeyHash || null, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[setup-keys] DB error:', err);
    res.status(500).json({ error: 'Failed to store keys' });
  }
});

/**
 * POST /api/auth/rekey
 * Called after a password reset to re-wrap private key with new password.
 * Only updates encryptedPrivateKey — the public key stays the same.
 */
app.post('/api/auth/rekey', async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }
  const tok = authHeader.split(' ')[1];
  let decoded;
  try { decoded = jwt.verify(tok, JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }

  const { encryptedPrivateKey, publicKey, recoveryKeyHash } = req.body;
  if (!encryptedPrivateKey) return res.status(400).json({ error: 'encryptedPrivateKey required' });

  try {
    const updates = ['"encryptedPrivateKey" = $1'];
    const params = [encryptedPrivateKey];
    if (publicKey) { updates.push(`"publicKey" = $${params.length + 1}`); params.push(publicKey); }
    if (recoveryKeyHash) { updates.push(`"recoveryKeyHash" = $${params.length + 1}`); params.push(recoveryKeyHash); }
    params.push(decoded.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ success: true });
  } catch (err) {
    console.error('[rekey] DB error:', err);
    res.status(500).json({ error: 'Failed to re-key' });
  }
});

/**
 * POST /api/auth/save-public-key
 * Lightweight endpoint for clients to persist their own public key to the database.
 * Called on Room join to ensure encryption works for DMs even for older accounts.
 */
app.post('/api/auth/save-public-key', authenticateToken, async (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: 'publicKey required' });
  try {
    await pool.query('UPDATE users SET "publicKey" = $1 WHERE id = $2', [publicKey, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[save-public-key] DB error:', err);
    res.status(500).json({ error: 'Failed to save key' });
  }
});

/**
 * GET /api/auth/public-key/:username
 * Returns the public key for a given user so other users can encrypt messages for them.
 * This endpoint is intentionally unauthenticated (public keys are meant to be shared).
 */
app.get('/api/auth/public-key/:username', (req, res) => {
  const username = req.params.username ? req.params.username.toLowerCase() : '';
  pool.query('SELECT "publicKey" FROM users WHERE LOWER(username) = $1', [username])
    .then(r => {
      if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
      res.json({ publicKey: r.rows[0].publicKey || null });
    })
    .catch(err => {
      console.error('[public-key] DB error:', err);
      res.status(500).json({ error: 'Database error' });
    });
});

/**
 * GET /api/users/:username/public-key
 * Alias for public-key fetch (requested by frontend/Claude)
 */
app.get('/api/users/:username/public-key', (req, res) => {
  const username = req.params.username ? req.params.username.toLowerCase() : '';
  pool.query('SELECT "publicKey" FROM users WHERE LOWER(username) = $1', [username])
    .then(r => {
      if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
      res.json({ publicKey: r.rows[0].publicKey || null });
    })
    .catch(err => {
      console.error('[public-key-alias] DB error:', err);
      res.status(500).json({ error: 'Database error' });
    });
});

// ─── Fetch Active Room Participant Public Keys ───
// Falls back to DB when room is not in-memory (e.g. sent from GlobalChatWidget without Room.jsx open)
app.get('/api/rooms/:roomId/public-keys', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const normalizedId = (roomId || '').toLowerCase();
  const room = rooms.get(normalizedId);

  // Build keys from in-memory room first (most accurate — includes users currently connected)
  const keyMap = {}; // username -> publicKey string
  if (room) {
    for (const [socketId, pk] of Object.entries(room.publicKeys || {})) {
      const userObj = room.users.find(u => u.socketId === socketId);
      if (userObj && pk) keyMap[userObj.username] = pk;
    }
  }

  // DB fallback: for users who recently participated but may not be connected right now
  try {
    const recentSenders = await new Promise((resolve, reject) =>
      db.all(
        `SELECT senderName FROM (
          SELECT "senderName", MAX(timestamp) as max_ts 
          FROM messages 
          WHERE "roomId" = ? AND (type = 'room' OR type = 'group') 
          GROUP BY "senderName"
        ) as sub 
        ORDER BY max_ts DESC 
        LIMIT 50`,
        [normalizedId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      )
    );

    const reqUsername = req.user.username;
    const missingNames = [
      ...recentSenders.map(r => r.senderName).filter(n => !keyMap[n]),
      ...(keyMap[reqUsername] ? [] : [reqUsername])
    ];
    if (missingNames.length > 0) {
      try {
        const pgResult = await pool.query(
          `SELECT username, "publicKey" FROM users WHERE LOWER(username) = ANY($1)`,
          [missingNames.map(n => n.toLowerCase())]
        );
        for (const row of pgResult.rows) {
          if (row.publicKey) keyMap[row.username] = row.publicKey;
        }
      } catch (e) {
        console.error('[public-keys] DB batch fallback error:', e);
      }
    }
  } catch (e) {
    console.error('[public-keys] DB fallback error:', e);
  }

  const connectedKeys = Object.entries(keyMap).map(([username, publicKey]) => ({ username, publicKey }));
  // Always return 200 (even if empty) so frontend can decide whether to abort
  return res.json({ keys: connectedKeys });
});

// ─── Fetch Active Room Participant Public Keys (Legacy/Direct Fallback) ───
app.get('/api/:roomId/public-keys', authenticateToken, async (req, res) => {
  const { roomId } = req.params;
  const normalizedId = (roomId || '').toLowerCase();
  const room = rooms.get(normalizedId);

  const keyMap = {};
  if (room) {
    for (const [socketId, pk] of Object.entries(room.publicKeys || {})) {
      const userObj = room.users.find(u => u.socketId === socketId);
      if (userObj && pk) keyMap[userObj.username] = pk;
    }
  }

  try {
    const recentSenders = await new Promise((resolve, reject) =>
      db.all(
        `SELECT senderName FROM (
          SELECT "senderName", MAX(timestamp) as max_ts 
          FROM messages 
          WHERE "roomId" = ? AND (type = 'room' OR type = 'group') 
          GROUP BY "senderName"
        ) as sub 
        ORDER BY max_ts DESC 
        LIMIT 50`,
        [normalizedId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      )
    );
    const missingNames = recentSenders.map(r => r.senderName).filter(n => !keyMap[n]);
    if (missingNames.length > 0) {
      try {
        const pgResult = await pool.query(
          `SELECT username, "publicKey" FROM users WHERE LOWER(username) = ANY($1)`,
          [missingNames.map(n => n.toLowerCase())]
        );
        for (const row of pgResult.rows) {
          if (row.publicKey) keyMap[row.username] = row.publicKey;
        }
      } catch (e) {
        console.error('[public-keys-legacy] DB batch fallback error:', e);
      }
    }
  } catch (e) {
    console.error('[public-keys-legacy] DB fallback error:', e);
  }

  const connectedKeys = Object.entries(keyMap).map(([username, publicKey]) => ({ username, publicKey }));
  return res.json({ keys: connectedKeys });
});

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/my-keys
 * Returns the encrypted private key blob for the currently authenticated user.
 * Used by the frontend after a browser tab close clears sessionStorage, so the
 * user can re-enter their password and re-derive the key without a full logout/login.
 * The raw private key NEVER leaves the client.
 */
app.get('/api/auth/my-keys', authenticateToken, (req, res) => {
  pool.query(
    'SELECT "encryptedPrivateKey", "publicKey" FROM users WHERE id = $1',
    [req.user.id]
  )
    .then(r => {
      if (!r.rows[0]) return res.status(404).json({ error: 'User not found' });
      res.json({
        encryptedPrivateKey: r.rows[0].encryptedPrivateKey || null,
        publicKey: r.rows[0].publicKey || null
      });
    })
    .catch(err => {
      console.error('[my-keys] DB error:', err);
      res.status(500).json({ error: 'Database error' });
    });
});

// ─── JWT Auth Middleware ───
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('[AUTH MIDDLEWARE] Rejected request to:', req.path, 'token present:', !!req.headers.authorization);
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (!user || !user.username) {
      console.log('[AUTH MIDDLEWARE] Rejected request to:', req.path, 'token present:', !!req.headers.authorization);
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    // Normalize username to lowercase to ensure database joins work correctly
    req.user = { ...user, username: user.username.toLowerCase() };
    next();
  });
}

function authenticateTokenOptional(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    req.user = { id: 0, username: 'guest', isGuest: true };
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err || !user || !user.username) {
      req.user = { id: 0, username: 'guest', isGuest: true };
      return next();
    }
    req.user = { ...user, username: user.username.toLowerCase() };
    next();
  });
}

// ─── Admin Authorization Middleware ──────────────────────────────────────────
const ALL_ADMIN_ROLES = ['super_admin', 'admin', 'moderator', 'support'];

async function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const result = await pool.query('SELECT role, email FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !ALL_ADMIN_ROLES.includes(user.role)) {
      console.warn('[ADMIN] Unauthorized attempt by', req.user.id, 'on', req.path);
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.adminRole = user.role;
    req.adminEmail = user.email;
    next();
  } catch (err) {
    console.error('[ADMIN] requireAdmin error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

function requireAdminRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.adminRole || !allowedRoles.includes(req.adminRole)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

// ─── /api/me — lightweight role check for frontend ──────────────────────────
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role || 'user' });
  } catch (err) {
    console.error('[/api/me] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── Avatar upload storage ───
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'avatars');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  }
});
const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const roomThumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads', 'room_thumbnails');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `room-${Date.now()}${ext}`);
  }
});
const roomThumbnailUpload = multer({ storage: roomThumbnailStorage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use('/uploads/room_thumbnails', express.static(path.join(__dirname, 'uploads', 'room_thumbnails')));

app.post('/api/rooms/thumbnail', authenticateToken, roomThumbnailUpload.single('thumbnail'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { roomId } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  const thumbnailPath = `/uploads/room_thumbnails/${req.file.filename}`;
  db.run('UPDATE room_names SET thumbnailPath = ? WHERE roomId = ?', [thumbnailPath, roomId], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    // Sync in-memory room if it exists
    const room = rooms.get(roomId);
    if (room) {
      room.thumbnailPath = thumbnailPath;
    }
    
    // Broadcast to all users in the room so the UI updates immediately
    io.in(roomId).emit('room_thumbnail_updated', { thumbnailPath });
    
    res.json({ thumbnailPath });
  });
});

// Serve avatars statically
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

// â"€â"€ GET Profile (own) â"€â"€
const queryAll = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const queryGet = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));

app.get('/api/profile', authenticateToken, apiCacheMiddleware, async (req, res) => {
  try {
    if (req.user.id === 0 || req.user.isGuest) {
      // Return a generic guest profile for TV/Guest sessions
      return res.json({
        id: 0,
        username: req.user.username,
        displayName: 'Guest User',
        avatarPath: null,
        bio: 'Viewing via Cast',
        followersCount: 0,
        followingCount: 0,
        isGuest: true
      });
    }

    const user = await queryGet('SELECT id, username, email, displayName, avatarPath, bio, country, country_code, showCountry, pinnedRooms FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const [followersRow, followingRow] = await Promise.all([
      queryGet('SELECT COUNT(*) as count FROM follows WHERE followingId = ? AND status = ?', [user.username, 'accepted']),
      queryGet('SELECT COUNT(*) as count FROM follows WHERE followerId = ? AND status = ?', [user.username, 'accepted'])
    ]);

    res.json({
      ...user,
      followersCount: followersRow?.count || 0,
      followingCount: followingRow?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Notifications stub ──
app.get('/api/profile/notifications', authenticateToken, (_req, res) => {
  res.json([]);
});

// â"€â"€ UPDATE Pinned Rooms â"€â"€
app.post('/api/profile/pinned-rooms', authenticateToken, (req, res) => {
  const { pinnedRooms } = req.body;
  if (!Array.isArray(pinnedRooms)) return res.status(400).json({ error: 'pinnedRooms must be an array' });
  let jsonStr = '[]';
  try {
    jsonStr = JSON.stringify(pinnedRooms);
  } catch(e) {}
  db.run('UPDATE users SET pinnedRooms = ? WHERE id = ?', [jsonStr, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    invalidateCacheForUser(req.user.username);
    res.json({ message: 'Pinned rooms updated', pinnedRooms: jsonStr });
  });
});

// â"€â"€ Search Users Worldwide (exclude deleted/non-existent and blocked) â"€â"€
app.get('/api/users/search', authenticateTokenOptional, async (req, res) => {
  const query = req.query.q;
  const myUsername = req.user.username.toLowerCase();
  if (!query) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT username, "displayName", "avatarPath", bio FROM users 
       WHERE (LOWER(username) LIKE LOWER($1) OR LOWER("displayName") LIKE LOWER($1)) 
       AND LOWER(username) != $2 
       AND LOWER(username) NOT IN (SELECT LOWER(blocked) FROM blocks WHERE LOWER(blocker) = $2) 
       AND LOWER(username) NOT IN (SELECT LOWER(blocker) FROM blocks WHERE LOWER(blocked) = $2) 
       LIMIT 20`,
      [`%${query}%`, myUsername]
    );
    res.json(result.rows || []);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// â"€â"€ GET Public Profile by username â"€â"€
app.get('/api/users/:username', authenticateTokenOptional, apiCacheMiddleware, async (req, res) => {
  const { username } = req.params;
  const viewerUsername = req.user.username;
  
  try {
    const myUserLow = viewerUsername.toLowerCase();
    const targetUserLow = username.toLowerCase();
    
    const [myBlock, theirBlock] = await Promise.all([
      pool.query('SELECT 1 FROM blocks WHERE LOWER(blocker) = $1 AND LOWER(blocked) = $2', [myUserLow, targetUserLow]),
      pool.query('SELECT 1 FROM blocks WHERE LOWER(blocker) = $1 AND LOWER(blocked) = $2', [targetUserLow, myUserLow])
    ]);
    
    if (myBlock.rows.length > 0) return res.json({ isBlockedByMe: true, username });
    if (theirBlock.rows.length > 0) return res.status(404).json({ error: 'User not found' });
    
    const user = await queryGet('SELECT id, username, email, displayName, avatarPath, bio, country, country_code, showCountry FROM users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSelf = viewerUsername.toLowerCase() === (user.username || '').toLowerCase();
    if (!isSelf && (!user.showCountry || user.showCountry == 0 || user.showCountry === '0' || user.showCountry === false)) {
      user.country = null;
      user.country_code = null;
    }
    delete user.showCountry;
    
    const [followersRow, followingRow, followRow, theyFollowMeRow] = await Promise.all([
      queryGet('SELECT COUNT(*) as count FROM follows WHERE LOWER(followingId) = LOWER(?) AND status = ?', [user.username, 'accepted']),
      queryGet('SELECT COUNT(*) as count FROM follows WHERE LOWER(followerId) = LOWER(?) AND status = ?', [user.username, 'accepted']),
      queryGet('SELECT status FROM follows WHERE LOWER(followerId) = LOWER(?) AND LOWER(followingId) = LOWER(?)', [viewerUsername, user.username]),
      queryGet('SELECT status FROM follows WHERE LOWER(followerId) = LOWER(?) AND LOWER(followingId) = LOWER(?)', [user.username, viewerUsername])
    ]);
    
    res.json({
      ...user,
      followersCount: followersRow?.count || 0,
      followingCount: followingRow?.count || 0,
      followStatus: followRow?.status || null,
      isFollowingMe: theyFollowMeRow?.status === 'accepted'
    });
  } catch (err) {
    console.error('Error in /api/users/:username:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// â"€â"€ Promisify queries locally for cleaner async/await â"€â"€
// (queryGet and queryAll moved above)

// â"€â"€ GET Recent Chats â"€â"€
app.get('/api/chats/recent', authenticateToken, async (req, res) => {
  const username = req.user.username;
  let lastSeen = {};
  if (req.query.lastSeen) {
    try { lastSeen = JSON.parse(decodeURIComponent(req.query.lastSeen)); } catch{}
  }
  let localRooms = [];
  if (req.query.localRooms) {
    try { localRooms = JSON.parse(decodeURIComponent(req.query.localRooms)); } catch{}
  }

  try {
    // 1. Private chats: get latest message per partner
    const privateRows = await queryAll(`
      SELECT DISTINCT ON (partner)
        m.timestamp as lastTimestamp,
        CASE WHEN LOWER(m.senderName) = LOWER($1) THEN m.targetName ELSE m.senderName END as partner,
        m.roomId,
        m.message,
        m."senderMessage" as "senderMessage",
        m.nonce,
        m."ephemeralPublicKey" as "ephemeralPublicKey",
        m."mediaUrl" as "mediaUrl",
        m."mediaType" as "mediaType",
        m.media_file_name as "mediaFileName",
        m.media_duration as "mediaDuration",
        'private' as type,
        LOWER(m.senderName) = LOWER($2) as "isMyLastMessage"
      FROM messages m
      WHERE m.type = 'private' 
        AND (LOWER(m."senderName") = LOWER($3) OR LOWER(m."targetName") = LOWER($4))
        AND (m.hiddenFor IS NULL OR m.hiddenFor NOT LIKE '%' || $5 || '%')
      ORDER BY partner, m.timestamp DESC, m.id DESC
    `, [username, username, username, username, `"${username}"`]);

    const finalPrivate = await Promise.all(privateRows.map(async (row) => {
      const partnerLower = row.partner.toLowerCase();
      const u = await queryGet('SELECT "displayName", "avatarPath", "publicKey" FROM users WHERE username = ?', [partnerLower]);
      
      let seenTs = 0;
      for (const k in lastSeen) {
        if (k.toLowerCase() === partnerLower) {
          seenTs = lastSeen[k] || 0;
          break;
        }
      }
      const countRow = await queryGet(`SELECT COUNT(*) as c FROM messages WHERE type = 'private' AND LOWER(senderName) = LOWER(?) AND LOWER(targetName) = LOWER(?) AND timestamp > ? AND (hiddenFor IS NULL OR hiddenFor NOT LIKE '%' || ? || '%')`, [row.partner, username, seenTs, `"${username}"`]);
      
      const isMedia = !!row.mediaUrl || !!row.mediaType;
      const mediaPreview = isMedia
        ? (row.mediaType && row.mediaType.startsWith('video')
            ? 'Video'
            : row.mediaType && row.mediaType.startsWith('audio')
              ? 'Voice Note'
              : row.mediaType && row.mediaType.startsWith('image')
                ? 'Photo'
                : 'File')
        : null;
      return {
        id: row.partner,
        partner: row.partner,
        displayName: u?.displayName || row.partner,
        partnerAvatar: u?.avatarPath || null,
        message: mediaPreview || row.message || '',
        senderMessage: isMedia ? null : (row.senderMessage || null),
        nonce: isMedia ? null : (row.nonce || null),
        ephemeralPublicKey: isMedia ? null : (row.ephemeralPublicKey || null),
        partnerPublicKey: u?.publicKey || null,
        lastTimestamp: row.lastTimestamp,
        lastMediaType: row.mediaType || null,
        lastMediaFileName: row.mediaFileName || null,
        lastMediaDuration: row.mediaDuration || null,
        type: 'private',
        isMyLastMessage: !!row.isMyLastMessage,
        unread: countRow ? Number(countRow.c) : 0
      };
    }));

    // 2. Group chats — rooms where user sent messages or is in DB room_names with messages
    const groupRows = await queryAll(`
      SELECT DISTINCT ON (m."roomId")
        m.timestamp as "lastTimestamp",
        m."roomId",
        m.message,
        m.mediaUrl,
        m.mediaType,
        m.media_file_name as "mediaFileName",
        m.media_duration as "mediaDuration",
        m."senderName" as "lastSenderName",
        m."nonce",
        m."ephemeralPublicKey",
        u."publicKey" as "senderPublicKey",
        'room' as type,
        (m.senderName = $1) as "isMyLastMessage"
      FROM messages m
      LEFT JOIN users u ON LOWER(u.username) = LOWER(m.senderName)
      WHERE m.type IN ('room', 'group') 
        AND (m."hiddenFor" IS NULL OR m."hiddenFor" NOT LIKE '%' || $2 || '%')
        AND m."roomId" IN (
          SELECT DISTINCT "roomId" FROM messages 
          WHERE LOWER("senderName") = LOWER($3) AND type IN ('room', 'group')
          AND ("hiddenFor" IS NULL OR "hiddenFor" NOT LIKE '%' || $4 || '%')
        )
      ORDER BY m."roomId", m.timestamp DESC, m.id DESC
    `, [username, `"${username}"`, username, `"${username}"`]);
    
    // Fill in room names + unread counts
    const finalGroup = await Promise.all(groupRows.map(async (row) => {
      const dbRoom = await queryGet('SELECT roomName, hostUsername, thumbnailPath, permissions, settings FROM room_names WHERE roomId = ?', [row.roomId]);
      const memRoom = rooms.get(row.roomId);
      const displayName = memRoom?.roomName || dbRoom?.roomName || row.roomId;
      const hostUsername = memRoom?.hostUsername || dbRoom?.hostUsername;
      const thumbnailPath = memRoom?.thumbnailPath || dbRoom?.thumbnailPath || null;
      let permissions = null;
      let settings = null;
      try { 
        if (dbRoom?.permissions) {
          permissions = typeof dbRoom.permissions === 'string' ? JSON.parse(dbRoom.permissions) : dbRoom.permissions;
        } else {
          permissions = memRoom?.permissions || null;
        }
      } catch(e){}
      try { 
        if (dbRoom?.settings) {
          settings = typeof dbRoom.settings === 'string' ? JSON.parse(dbRoom.settings) : dbRoom.settings;
        } else {
          settings = memRoom?.settings || null;
        }
      } catch(e){}
      
      // Count unread messages since lastSeen
      const ls = lastSeen[row.roomId] || 0;
      const unreadRow = await queryGet(
        `SELECT COUNT(*) as c FROM messages WHERE type IN ('room','group') AND roomId = ? AND timestamp > ? AND senderName != ? AND (hiddenFor IS NULL OR hiddenFor NOT LIKE '%' || ? || '%')`,
        [row.roomId, ls, username, `"${username}"`]
      );

      const e2ee = (row.nonce && row.ephemeralPublicKey) ? {
        nonce: row.nonce,
        keys: (() => { try { const p = JSON.parse(row.ephemeralPublicKey); return (typeof p === 'object' && !Array.isArray(p)) ? p : null; } catch(e){ return null; } })(),
        senderPublicKey: row.senderPublicKey || null
      } : null;

      return {
        id: row.roomId,
        partner: row.roomId,
        displayName: displayName,
        partnerAvatar: thumbnailPath,
        e2ee: e2ee,
        message: row.message || '',
        lastTimestamp: row.lastTimestamp,
        lastMediaType: row.mediaType || null,
        lastMediaFileName: row.mediaFileName || null,
        lastMediaDuration: row.mediaDuration || null,
        lastSenderName: row.lastSenderName || null,
        type: 'room',
        isMyLastMessage: !!row.isMyLastMessage,
        isHost: hostUsername && username && hostUsername.toLowerCase() === username.toLowerCase(),
        unread: unreadRow ? Number(unreadRow.c) : 0
      };
    }));

    // 3. Pinned rooms: show even if no messages
    const userRow = await queryGet('SELECT pinnedRooms FROM users WHERE username = ?', [username]);
    let pinnedIds = [];
    try { pinnedIds = JSON.parse(userRow?.pinnedRooms || '[]'); } catch(e) { console.error('Error parsing pinnedRooms:', e); }

    const groupRoomIds = new Set(finalGroup.map(g => g.id));
    for (const rid of pinnedIds) {
      if (!groupRoomIds.has(rid)) {
        const dbRoom = await queryGet('SELECT roomName, thumbnailPath, settings FROM room_names WHERE roomId = ?', [rid]);
        const memRoom = rooms.get(rid);
        const displayName = memRoom?.roomName || dbRoom?.roomName || rid;
        const thumbnailPath = memRoom?.thumbnailPath || dbRoom?.thumbnailPath || null;
        let settings = null;
        try { settings = dbRoom?.settings ? JSON.parse(dbRoom.settings) : (memRoom?.settings || null); } catch(e){}

        const hostUsername = memRoom?.hostUsername || dbRoom?.hostUsername;

        const lastMsg = await queryGet('SELECT message, mediaUrl, mediaType, media_file_name, media_duration, timestamp, senderName FROM messages WHERE roomId = ? AND type IN (?::text, ?::text) ORDER BY timestamp DESC LIMIT 1', [rid, 'room', 'group']);
        finalGroup.push({
          id: rid,
          partner: rid,
          displayName: displayName,
          partnerAvatar: thumbnailPath,
          message: lastMsg ? lastMsg.message : '',
          lastTimestamp: lastMsg ? lastMsg.timestamp : 0,
          lastMediaType: lastMsg?.mediaType || null,
          lastMediaFileName: lastMsg?.media_file_name || null,
          lastMediaDuration: lastMsg?.media_duration || null,
          lastSenderName: lastMsg?.senderName || null,
          type: 'room',
          isMyLastMessage: lastMsg ? (lastMsg.senderName || '').toLowerCase() === (username || '').toLowerCase() : false,
          isHost: (hostUsername || '').toLowerCase() === (username || '').toLowerCase() || !!settings?.newMembersAdmins
        });
      }
    }

    // 4. In-memory connected rooms: user is currently in room but may not have sent messages
    // This ensures receivers always see the group room in their conversation list
    const allGroupIds = new Set(finalGroup.map(g => g.id));
    for (const [rid, room] of rooms.entries()) {
      if (allGroupIds.has(rid)) continue; // already included
      const isInRoom = room.users && room.users.some(u => u.username === username);
      if (!isInRoom) continue;
      // Get last message from in-memory or DB
      const lastMsg = room.groupMessages.length > 0 
        ? room.groupMessages[room.groupMessages.length - 1]
        : await queryGet('SELECT message, mediaUrl, mediaType, media_duration, timestamp, senderName FROM messages WHERE roomId = ? AND type IN (?::text, ?::text) ORDER BY timestamp DESC LIMIT 1', [rid, 'room', 'group']);
      // Count unread from DB + in-memory messages since lastSeen
      const ls = lastSeen[rid] || 0;
      const dbUnreadRow = await queryGet(
        `SELECT COUNT(*) as c FROM messages WHERE type IN ('room','group') AND roomId = ? AND timestamp > ? AND senderName != ?`,
        [rid, ls, username]
      );
      const memUnread = room.groupMessages.filter(m => m.timestamp > ls && m.username !== username).length;
      const roomUnread = Math.max(dbUnreadRow ? Number(dbUnreadRow.c) : 0, memUnread);
      const lmPreview = lastMsg && (!lastMsg.message && lastMsg.mediaUrl)
        ? (lastMsg.mediaType?.startsWith('video') ? '🎥 Video' : '📷 Photo')
        : (lastMsg?.message || '');
      finalGroup.push({
        id: rid,
        partner: rid,
        displayName: room.roomName || rid,
        partnerAvatar: room.thumbnailPath || null,
        message: lmPreview || 'Group conversation',
        lastTimestamp: lastMsg ? lastMsg.timestamp : 0,
        lastMediaType: lastMsg?.mediaType || null,
        lastMediaDuration: lastMsg?.media_duration || lastMsg?.mediaDuration || null,
        type: 'room',
        isMyLastMessage: lastMsg ? ((lastMsg.username || '').toLowerCase() === (username || '').toLowerCase() || (lastMsg.senderName || '').toLowerCase() === (username || '').toLowerCase()) : false,
        isHost: (room.hostUsername || '').toLowerCase() === (username || '').toLowerCase() || !!room.settings?.newMembersAdmins,
        unread: roomUnread
      });
    }
    const deletedRooms = [];
    if (Array.isArray(localRooms) && localRooms.length > 0) {
      for (const rid of localRooms) {
        if (!rid) continue;
        const memRoom = rooms.get(rid);
        if (memRoom) continue;
        const dbRoom = await queryGet('SELECT 1 FROM room_names WHERE "roomId" = $1', [rid]);
        if (!dbRoom) {
          deletedRooms.push({
            id: rid,
            partner: rid,
            type: 'room',
            isDeleted: true
          });
        }
      }
    }

    let finalArr = [...finalPrivate, ...finalGroup, ...deletedRooms];

    // Handle blocks (case-insensitive)
    const blockRows = await queryAll('SELECT blocker, blocked FROM blocks WHERE LOWER(blocker) = LOWER($1) OR LOWER(blocked) = LOWER($1)', [username]);
    if (blockRows.length > 0) {
      finalArr = finalArr.map(c => {
        if (c.type === 'private') {
          const amIBlocked = blockRows.find(b => b.blocker.toLowerCase() === c.partner.toLowerCase() && b.blocked.toLowerCase() === username.toLowerCase());
          const didIBlock = blockRows.find(b => b.blocker.toLowerCase() === username.toLowerCase() && b.blocked.toLowerCase() === c.partner.toLowerCase());
          if (amIBlocked || didIBlock) {
            return { ...c, isBlocked: !!didIBlock, amIBlocked: !!amIBlocked };
          }
        }
        return c;
      });
    }

    finalArr.sort((a,b) => b.lastTimestamp - a.lastTimestamp);
    res.json(finalArr);
  } catch(err) {
    console.error('Recent chats error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── GET Chat History ──
app.get('/api/chats/history', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const { type, partner } = req.query; 
  
  if (!type || !partner) return res.status(400).json({ error: 'type and partner required' });

  const before = req.query.before ? parseInt(req.query.before, 10) : null;
  const limit = parseInt(req.query.limit, 10) || (before ? 200 : 100);

  try {
    if (type === 'private') {
      let queryStr = `
        SELECT m.*, u."avatarPath" as "senderAvatarPath", u."publicKey" as "senderPublicKey"
        FROM messages m
        LEFT JOIN users u ON LOWER(u.username) = LOWER(m."senderName")
        WHERE m.type = 'private'
          AND ((LOWER(m."senderName") = LOWER($1) AND LOWER(m."targetName") = LOWER($2))
            OR (LOWER(m."senderName") = LOWER($3) AND LOWER(m."targetName") = LOWER($4)))
          AND (m.is_unsent IS NULL OR m.is_unsent = FALSE)
      `;
      const queryParams = [username, partner, partner, username];
      if (before) {
        queryStr += ` AND m.timestamp < $5 `;
        queryParams.push(before);
      }
      queryStr += ` ORDER BY m.timestamp DESC LIMIT $${queryParams.length + 1} `;
      queryParams.push(limit);

      const rows = await pool.query(queryStr, queryParams).then(r => r.rows);
      rows.reverse(); // chronological

      const filtered = rows
        .filter(r => {
          if (!r.hiddenFor) return true;
          const hStr = typeof r.hiddenFor === 'string' ? r.hiddenFor : JSON.stringify(r.hiddenFor);
          return !hStr.includes('"' + username + '"');
        })
        .map(r => ({
          id: r.id.toString(),
          isMe: (r.senderName || '').toLowerCase() === (username || '').toLowerCase(),
          senderId: r.senderId,
          senderName: r.senderName,
          senderAvatar: r.senderAvatarPath || null,
          targetId: r.targetId,
          targetName: r.targetName,
          message: r.message,
          senderMessage: r.senderMessage || null,
          nonce: r.nonce || null,
          ephemeralPublicKey: r.ephemeralPublicKey || null,
          mediaUrl: r.mediaUrl || null,
          mediaType: r.mediaType || null,
          mediaFileName: r.media_file_name || null,
          mediaFileSize: r.media_file_size || null,
          mediaDuration: r.media_duration || null,
          mediaExpiresAt: r.media_expires_at || null,
          timestamp: r.timestamp,
          reactions: r.reactions ? JSON.parse(r.reactions) : {},
          replyTo: r.replyTo ? JSON.parse(r.replyTo) : null
        }));
      const messageIds = filtered.map(r => Number(r.id)).filter(Boolean);
      const seenMap = {};
      if (messageIds.length > 0) {
        try {
          const seenResult = await pool.query(`
            SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as avatar
            FROM message_seen ms
            LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
            WHERE ms.message_id = ANY($1::bigint[])
          `, [messageIds]);
          seenResult.rows.forEach(r => {
            const msgId = String(r.message_id);
            if (!seenMap[msgId]) seenMap[msgId] = [];
            seenMap[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatar });
          });
        } catch (seenErr) {
          console.warn('[chats/history] seenBy fetch failed:', seenErr.message);
        }
      }
      res.json(filtered.map(r => ({ ...r, seenBy: seenMap[r.id] || [] })));
    } else if (type === 'room') {
      const joinTs = await getOrInitFirstJoined(username, partner);
      let queryStr = `
        SELECT m.*, u."avatarPath" as "senderAvatarPath", u."publicKey" as "senderPublicKey"
        FROM messages m
        LEFT JOIN users u ON u.username = m."senderName"
        WHERE m."roomId" = $1 AND (m.type = 'room' OR m.type = 'group')
          AND (m."hiddenFor" IS NULL OR m."hiddenFor" NOT LIKE $2)
          AND (m.is_unsent IS NULL OR m.is_unsent = FALSE)
      `;
      const queryParams = [partner, `%"${username}"%`];
      if (joinTs) {
        queryStr += ` AND m.timestamp >= $3 `;
        queryParams.push(joinTs);
      }
      if (before) {
        queryStr += ` AND m.timestamp < $${queryParams.length + 1} `;
        queryParams.push(before);
      }
      queryStr += ` ORDER BY m.timestamp DESC LIMIT $${queryParams.length + 1} `;
      queryParams.push(limit);

      const rows = await pool.query(queryStr, queryParams).then(r => r.rows);
      rows.reverse(); // chronological

      const mapped = rows.map(r => {
        let e2ee = null;
        if (r.nonce && r.ephemeralPublicKey) {
          try {
            const parsed = JSON.parse(r.ephemeralPublicKey);
            if (typeof parsed === 'object' && !Array.isArray(parsed)) {
              e2ee = { nonce: r.nonce, keys: parsed, senderPublicKey: r.senderPublicKey || null };
            } else {
              e2ee = { nonce: r.nonce, keys: null, senderPublicKey: r.ephemeralPublicKey };
            }
          } catch {
            e2ee = { nonce: r.nonce, keys: null, senderPublicKey: r.ephemeralPublicKey };
          }
        }
        return {
          id: r.id.toString(),
          isMe: (r.senderName || '').toLowerCase() === (username || '').toLowerCase(),
          userId: r.senderId,
          senderName: r.senderName,
          username: r.senderName,
          senderAvatar: r.senderAvatarPath || null,
          message: r.message,
          nonce: r.nonce || null,
          ephemeralPublicKey: r.ephemeralPublicKey || null,
          e2ee,
          mediaUrl: r.mediaUrl || null,
          mediaType: r.mediaType || null,
          mediaFileName: r.media_file_name || null,
          mediaFileSize: r.media_file_size || null,
          mediaDuration: r.media_duration || null,
          mediaExpiresAt: r.media_expires_at || null,
          timestamp: r.timestamp,
          reactions: r.reactions ? JSON.parse(r.reactions) : {},
          replyTo: r.replyTo ? JSON.parse(r.replyTo) : null
        };
      });
      const msgIds = mapped.map(r => Number(r.id)).filter(Boolean);
      const seenMap2 = {};
      if (msgIds.length > 0) {
        try {
          const seenResult2 = await pool.query(`
            SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as avatar
            FROM message_seen ms
            LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
            WHERE ms.message_id = ANY($1::bigint[])
          `, [msgIds]);
          seenResult2.rows.forEach(r => {
            const msgId = String(r.message_id);
            if (!seenMap2[msgId]) seenMap2[msgId] = [];
            seenMap2[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatar });
          });
        } catch (seenErr2) {
          console.warn('[chats/history] seenBy fetch failed:', seenErr2.message);
        }
      }
      res.json(mapped.map(r => ({ ...r, seenBy: seenMap2[r.id] || [] })));
    } else {
      res.status(400).json({ error: 'invalid type' });
    }
  } catch (err) {
    console.error('[chats/history] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── POST Toggle Chat Reaction ───
app.post('/api/chats/react', authenticateToken, async (req, res) => {
  const username = req.user.username;
  const { messageId, emoji } = req.body;
  if (!messageId || !emoji) return res.status(400).json({ error: 'invalid payload' });

  const matchId = String(messageId);
  let tsFromId = null;
  const tsMatch = matchId.match(/\b(\d{13})\b/);
  if (tsMatch) tsFromId = tsMatch[1];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // SELECT FOR UPDATE locks the row so concurrent reactions for the same message serialize
    const qWhere = tsFromId
      ? `id::text = $1 OR timestamp::text = $1 OR timestamp::text = $2`
      : `id::text = $1 OR timestamp::text = $1`;
    const qParams = tsFromId ? [matchId, tsFromId] : [matchId];
    const { rows } = await client.query(
      `SELECT id, type, "senderName", "targetName", "roomId", reactions, timestamp FROM messages WHERE ${qWhere} LIMIT 1 FOR UPDATE`,
      qParams
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Message not found' });
    }

    const msgSender = (row.senderName || '').toLowerCase();
    if (msgSender && username && msgSender !== username.toLowerCase()) {
      const bCheck = await client.query(
        `SELECT 1 FROM blocks WHERE (LOWER(blocker) = $1 AND LOWER(blocked) = $2) OR (LOWER(blocker) = $2 AND LOWER(blocked) = $1) LIMIT 1`,
        [username.toLowerCase(), msgSender]
      );
      if (bCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'You cannot react to this message at this time.' });
      }
    }

    let rx = {};
    try { rx = row.reactions ? JSON.parse(row.reactions) : {}; } catch {}

    const hadThisEmoji = rx[emoji] && rx[emoji].includes(username);
    for (const em of Object.keys(rx)) {
      rx[em] = rx[em].filter(u => u !== username);
    }
    if (!hadThisEmoji) {
      if (!rx[emoji]) rx[emoji] = [];
      rx[emoji].push(username);
    }
    for (const em of Object.keys(rx)) {
      if (rx[em].length === 0) delete rx[em];
    }

    await client.query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(rx), row.id]);
    await client.query('COMMIT');

    if (row.type === 'private') {
      const otherUser = (row.senderName || '').toLowerCase() === (username || '').toLowerCase() ? row.targetName : row.senderName;
      const payload = { messageId: String(row.id), timestampId: String(row.timestamp), reactions: rx, senderName: username, emoji, targetName: otherUser, originalSenderName: row.senderName };
      emitToUser(username, 'chat:private_reaction', payload);
      emitToUser(otherUser, 'chat:private_reaction', payload);
    } else if (row.type === 'group') {
      const normalizedRoomId = (row.roomId || '').toLowerCase();
      const ioRoom = rooms.get(normalizedRoomId);
      if (ioRoom) {
        const msg = ioRoom.groupMessages.find(m => String(m.id) === String(row.id) || String(m.timestamp) === String(row.timestamp));
        if (msg) msg.reactions = rx;
      }
      const reactionPayload = { messageId: String(row.id), timestampId: String(row.timestamp), reactions: rx, senderUsername: username, roomId: normalizedRoomId, emoji, originalSenderName: row.senderName };
      io.in(normalizedRoomId).emit('chat:reaction', reactionPayload);
    }

    invalidateCacheForUser(username);
    if (row.type === 'private') {
      const otherUser = (row.senderName || '').toLowerCase() === (username || '').toLowerCase() ? row.targetName : row.senderName;
      invalidateCacheForUser(otherUser);
    }

    res.json({ success: true, reactions: rx });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[/api/chats/react] error:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    client.release();
  }
});

app.post('/api/chats/send', authenticateToken, async (req, res) => {
  const username = req.user.username.toLowerCase();
  const { type, partner: rawPartner, message, replyTo, mediaUrl, mediaType, tempId,
          nonce, ephemeralPublicKey, e2eeKeys, senderMessage,
          mediaFileName, mediaFileSize, mediaDuration } = req.body;
  const partner = rawPartner ? rawPartner.toLowerCase() : '';
  // message can be empty if there's a media attachment
  if (!type || !partner || (!message && !mediaUrl)) return res.status(400).json({ error: 'invalid payload' });

  let actualMessage = message || '';
  actualMessage = truncateToWordLimit(actualMessage, 250);
  let senderMessageVal = senderMessage || null;
  if (senderMessageVal) {
    senderMessageVal = truncateToWordLimit(senderMessageVal, 250);
  }
  const ts = Date.now();
  try {
    const senderUser = await queryGet('SELECT "avatarPath" FROM users WHERE username = ?', [username]);
    const senderAvatar = senderUser ? senderUser.avatarPath : null;

    if (type === 'private') {
      const rel1 = await queryGet('SELECT status FROM follows WHERE followerId = ? AND followingId = ?', [username, partner]);
      const rel2 = await queryGet('SELECT status FROM follows WHERE followerId = ? AND followingId = ?', [partner, username]);
      const areFriends = (rel1?.status === 'accepted') && (rel2?.status === 'accepted');

      if (!areFriends) {
        return res.status(403).json({ error: 'You must be mutual friends to send messages.' });
      }

      // Check for blocks (case-insensitive)
      const blockCheck = await queryGet('SELECT blocker, blocked FROM blocks WHERE (LOWER(blocker) = LOWER($1) AND LOWER(blocked) = LOWER($2)) OR (LOWER(blocker) = LOWER($2) AND LOWER(blocked) = LOWER($1))', [username, partner]);
      if (blockCheck) {
        return res.status(403).json({ error: 'You cannot message this user at this time.' });
      }

      // Fetch targetId for the message
      const targetUser = await queryGet('SELECT id FROM users WHERE username = ?', [partner]);
      const targetId = targetUser ? String(targetUser.id) : null;

      const dmUsers = [username, partner].sort();
      const roomId = 'dm-' + dmUsers.join('-');

      // Store message + sender-readable copy (senderMessage) so sender can decrypt history
      const dmInsert = await pool.query(
        `INSERT INTO messages ("roomId", type, "senderId", "senderName", "targetId", "targetName", message, "senderMessage", "mediaUrl", "mediaType", timestamp, "replyTo", nonce, "ephemeralPublicKey", media_expires_at, media_file_name, media_file_size, media_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
        [roomId, 'private', String(req.user.id || 'http_client'), username, targetId, partner,
         actualMessage, senderMessageVal,
         mediaUrl || null, mediaType || null, ts,
         replyTo ? JSON.stringify(replyTo) : null,
         nonce || null, ephemeralPublicKey || null,
         mediaUrl ? computeMediaExpiry(mediaType) : null,
         mediaFileName || null, mediaFileSize || null,
         mediaDuration ? Number(mediaDuration) : null]
      );
      const dmDbId = String(dmInsert.rows[0]?.id || ts);

      // Save sender seen status to database
      await pool.query('INSERT INTO message_seen (message_id, room_id, username, seen_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [Number(dmDbId), roomId, username, ts])
        .catch(err => console.error('[REST send] message_seen error:', err.message));

      const dmExpiry = mediaUrl ? computeMediaExpiry(mediaType) : null;
      const payload = {
        id: dmDbId,
        dbId: dmDbId,
        senderId: req.user.id || 'http_client',
        senderName: username,
        senderAvatar: senderAvatar,
        targetName: partner,
        message: actualMessage,
        senderMessage: senderMessageVal,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaFileName: mediaFileName || null,
        mediaFileSize: mediaFileSize || null,
        mediaDuration: mediaDuration ? Number(mediaDuration) : null,
        mediaExpiresAt: dmExpiry ? dmExpiry.toISOString() : null,
        timestamp: ts,
        isMe: false,
        replyTo: replyTo || null,
        tempId: tempId || null,
        nonce: nonce || null,
        ephemeralPublicKey: ephemeralPublicKey || null,
        seenBy: [{ username: username, seenAt: ts, avatar: senderAvatar }]
      };

      emitToUser(partner, 'private_message', payload);
      
      // Emit back to sender so other active components (e.g. Room.jsx or across tabs) receive it.
      // We pass isMe: true so the sender correctly plots the UI bubbles and uses senderMessage for decryption.
      const senderPayload = { ...payload, isMe: true };
      emitToUser(username, 'private_message', senderPayload);

      invalidateCacheForUser(username);
      invalidateCacheForUser(partner);

      res.json({ success: true, timestamp: ts, id: dmDbId });
    } else if (type === 'room') {
      // ─── Room Permissions Check ───
      const roomRow = await queryGet('SELECT hostUsername, permissions FROM room_names WHERE roomId = ?', [partner]);
      if (roomRow) {
        const perms = roomRow.permissions ? JSON.parse(roomRow.permissions) : {};
        // Admins have the same send privileges as the host.
        // Use in-memory room.admins Set (the authoritative source) rather than room.users[].isAdmin
        const memRoom = rooms.get(partner.toLowerCase());
        // isUserAdmin robustly checks for BOTH host (by case-insensitive username) AND admins.
        const isRoomAdminOrHost = memRoom ? isUserAdmin(memRoom, { username }) : (roomRow.hostUsername && roomRow.hostUsername.toLowerCase() === username.toLowerCase());

        if (perms.chat === 'host' && !isRoomAdminOrHost) {
          return res.status(400).json({ error: 'Only the host can send messages in this room.' });
        }

        const hasLink = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/g.test(actualMessage);
        if (hasLink && perms.allowLinks === false && !isRoomAdminOrHost) {
          return res.status(400).json({ error: 'Links are not allowed in this room.' });
        }

        if (mediaUrl && perms.allowMedia === false && !isRoomAdminOrHost) {
          return res.status(400).json({ error: 'Media uploads are not allowed in this room.' });
        }
      }

      // Store: ephemeralPublicKey column = JSON key-map {username: keyWrap, ...}
      // The sender's own publicKey is fetched from users table on history read
      const ephemText = e2eeKeys ? JSON.stringify(e2eeKeys) : null;

      const roomInsert = await pool.query(
        `INSERT INTO messages ("roomId", type, "senderId", "senderName", message, "mediaUrl", "mediaType", timestamp, "replyTo", nonce, "ephemeralPublicKey", media_expires_at, media_file_name, media_file_size, media_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
        [partner, 'group', String(req.user.id || 'http_client'), username,
         actualMessage, mediaUrl || null, mediaType || null, ts,
         replyTo ? JSON.stringify(replyTo) : null,
         nonce || null,
         ephemText || null,
         mediaUrl ? computeMediaExpiry(mediaType) : null,
         mediaFileName || null, mediaFileSize || null,
         mediaDuration ? Number(mediaDuration) : null]
      );
      const roomDbId = String(roomInsert.rows[0]?.id || ts);

      // Build e2ee broadcast payload — include senderPublicKey (= ephemeralPublicKey from frontend for group)
      // plus the key-map so every recipient can decrypt their own copy
      const senderPubKeyForGroup = ephemeralPublicKey || null;
      const e2eeBroadcast = (nonce && e2eeKeys)
        ? { nonce, keys: e2eeKeys, senderPublicKey: senderPubKeyForGroup }
        : null;

      const roomExpiry = mediaUrl ? computeMediaExpiry(mediaType) : null;
      const msg = {
        id: roomDbId,
        userId: req.user.id || 'http_client',
        username,
        senderName: username,
        senderAvatar: senderAvatar,
        message: actualMessage,
        roomId: partner,
        type: 'group',
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        mediaFileName: mediaFileName || null,
        mediaFileSize: mediaFileSize || null,
        mediaDuration: mediaDuration ? Number(mediaDuration) : null,
        mediaExpiresAt: roomExpiry ? roomExpiry.toISOString() : null,
        timestamp: ts,
        reactions: {},
        replyTo: replyTo || null,
        tempId: tempId || null,
        nonce: nonce || null,
        e2ee: e2eeBroadcast,
      };

      const ioRoom = rooms.get(partner);
      if (ioRoom) {
        ioRoom.groupMessages.push(msg);
        if (ioRoom.groupMessages.length > 200) ioRoom.groupMessages.shift();
      }

      let roomPerms = null;
      try { roomPerms = roomRow?.permissions ? JSON.parse(roomRow.permissions) : null; } catch(e){}

      io.in(partner).emit('chat_message', { ...msg, roomPermissions: roomPerms });
      io.emit('global_new_chat_message', { ...msg, roomPermissions: roomPerms });

      invalidateCacheForUser(username);
      res.json({ success: true, timestamp: ts, id: roomDbId });
    }
  } catch (err) {
    console.error('[chats/send] error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});



app.post('/api/upload/chat', authenticateTokenOptional, (req, res) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 55 * 1024 * 1024 }
  }).any();

  upload(req, res, async function(err) {
    if (err) {
      console.error('[UPLOAD] multer err:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Videos larger than 50MB cannot be sent in chat.' });
      }
      return res.status(400).json({ error: err.message });
    }

    console.log('[UPLOAD] files received:', req.files?.length ?? 0);

    const file = req.files && req.files[0];
    if (!file) {
      return res.status(400).json({ error: 'No file was received.' });
    }

    const ts = Date.now();
    const safe = (file.originalname || 'f').replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `chat/${ts}_${safe}`;

    const { error: upErr } = await supabase.storage
      .from('encrypted-media')
      .upload(filePath, file.buffer, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (upErr) {
      console.error('[UPLOAD] supabase:', upErr);
      return res.status(500).json({ error: 'Unable to save file. Please try again.' });
    }

    const { data } = supabase.storage
      .from('encrypted-media')
      .getPublicUrl(filePath);

    console.log('[UPLOAD] done:', filePath);
    return res.json({
      success: true,
      url: data.publicUrl,
      path: filePath,
      fileName: file.originalname,
      mimeType: file.mimetype
    });
  });
});

// ─── DELETE Chat Message ───
app.delete('/api/chats/message/:id', authenticateToken, async (req, res) => {
  const messageId = req.params.id; // Could be database ID or timestamp (for optimistic messages)
  const username = req.user.username;
  const action = req.query.action; // 'local' or undefined
  console.log(`[DELETE] user=${username} msgId=${messageId} action=${action}`);

  try {
    const isIdNumeric = !isNaN(messageId) && !messageId.toString().includes('opt-') && !messageId.toString().includes('http-');
    
    let msg = null;
    if (isIdNumeric) {
        msg = await queryGet('SELECT * FROM messages WHERE id = ?', [messageId]);
      } else {
        // Robust pattern match to find the 13-digit Unix timestamp
        const matchStr = messageId.toString();
        let tsFromId = null;
        const tsMatch = matchStr.match(/\b(\d{13})\b/);
        if (tsMatch) tsFromId = tsMatch[1];
        
        // Use COALESCE or exact checks for BIGINT timestamp
        msg = await queryGet('SELECT * FROM messages WHERE id::text = $1 OR timestamp::text = $2 OR (timestamp IS NOT NULL AND timestamp = $3)', 
          [messageId, messageId, Number(tsFromId) || 0]);
      }

    console.log(`[DELETE] isIdNumeric=${isIdNumeric} msgFound=${!!msg}${msg ? ` msgId=${msg.id} senderName=${msg.senderName} type=${msg.type}` : ''}`);

    if (!msg) {
      // It might be a group message stored entirely in memory cache (volatile)
      let memoryMsgFound = false;
      for (const [roomId, room] of rooms.entries()) {
        const idx = room.groupMessages.findIndex(m =>
          String(m.id) === String(messageId) ||
          String(m.dbId) === String(messageId) ||
          String(m.timestamp) === String(messageId) ||
          (m.id && m.id.toString() === messageId)
        );
        if (idx !== -1) {
          const m = room.groupMessages[idx];
          if ((m.senderName || '').toLowerCase() === (username || '').toLowerCase() && action !== 'local') {
             // Global Unsend — remove from memory AND delete from DB
             const removedMsg = room.groupMessages.splice(idx, 1)[0];
             const dbIdForDelete = removedMsg.dbId || removedMsg.id;
             // Best-effort DB delete
             if (dbIdForDelete && !String(dbIdForDelete).includes('-')) {
               pool.query('DELETE FROM messages WHERE id = $1', [dbIdForDelete]).catch(() => {});
             } else {
               pool.query('DELETE FROM messages WHERE "roomId" = $1 AND timestamp = $2', [roomId, removedMsg.timestamp]).catch(() => {});
             }
             const deletePayload = { roomId, messageId: removedMsg.id.toString(), originalId: messageId, timestampId: removedMsg.timestamp.toString() };
             io.in(roomId).emit('chat:message_deleted', deletePayload);
             io.emit('chat:message_deleted', deletePayload);
             room.users.forEach(u => emitToUser(u.username, 'chat:message_deleted', deletePayload));
             memoryMsgFound = true;
             return res.json({ success: true, deletedId: removedMsg.id });
          } else {
             // Local delete — update memory AND update DB
             m.hiddenFor = m.hiddenFor || [];
             if (!m.hiddenFor.includes(username)) m.hiddenFor.push(username);
             const dbIdForUpdate = m.dbId || m.id;
             if (dbIdForUpdate && !String(dbIdForUpdate).includes('-')) {
               pool.query('UPDATE messages SET "hiddenFor" = $1 WHERE id = $2', [JSON.stringify(m.hiddenFor), dbIdForUpdate]).catch(() => {});
             } else {
               pool.query('UPDATE messages SET "hiddenFor" = $1 WHERE "roomId" = $2 AND timestamp = $3', [JSON.stringify(m.hiddenFor), roomId, m.timestamp]).catch(() => {});
             }
             emitToUser(username, 'chat:message_deleted', { messageId: m.id.toString(), originalId: messageId, timestampId: m.timestamp.toString() });
             memoryMsgFound = true;
             return res.json({ success: true, hiddenId: m.id });
          }
        }
      }

      if (!memoryMsgFound) {
        return res.status(404).json({ error: 'Message not found' });
      }
    }

    // Now working with a DB message
    if (action === 'local' || (msg.senderName || '').toLowerCase() !== (username || '').toLowerCase()) {
       // Local Hide Delete
       let hidden = [];
       try { hidden = JSON.parse(msg.hiddenFor || '[]'); } catch(e){}
       if (!hidden.includes(username)) hidden.push(username);
       await queryAll('UPDATE messages SET "hiddenFor" = ? WHERE id = ?', [JSON.stringify(hidden), msg.id]);
       
       // Tell just this user to remove it from UI
       emitToUser(username, 'chat:message_deleted', { messageId: msg.id.toString(), originalId: messageId, timestampId: msg.timestamp.toString() });
       return res.json({ success: true, hiddenId: msg.id });
    } else {
       // Global Unsend (msg.senderName === username)
       await queryAll('DELETE FROM messages WHERE id = ?', [msg.id]);

       if (msg.type === 'private') {
         emitToUser(msg.senderName, 'chat:message_deleted', { messageId: msg.id.toString(), originalId: messageId, timestampId: msg.timestamp.toString() });
         if (msg.targetName) emitToUser(msg.targetName, 'chat:message_deleted', { messageId: msg.id.toString(), originalId: messageId, timestampId: msg.timestamp.toString() });
       } else if (msg.type === 'group') {
         const payload = { messageId: msg.id.toString(), originalId: messageId, timestampId: msg.timestamp.toString(), roomId: msg.roomId };
         io.in(msg.roomId).emit('chat:message_deleted', payload);
         io.emit('chat:message_deleted', payload);
         
         const ioRoom = rooms.get(msg.roomId);
         if (ioRoom) {
           ioRoom.groupMessages = ioRoom.groupMessages.filter(m => String(m.id) !== String(msg.id) && String(m.timestamp) !== String(msg.timestamp));
         }
       }
       invalidateCacheForUser(username);
       if (msg.targetName) invalidateCacheForUser(msg.targetName);

       return res.json({ success: true, deletedId: msg.id });
    }
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// â"€â"€ BLOCKS endpoints â"€â"€
app.post('/api/block/:username', authenticateTokenOptional, async (req, res) => {
  if (!req.user || req.user.isGuest || req.user.id === 0) {
    return res.status(401).json({ error: 'login_required', message: 'Please log in to use this feature' });
  }
  const blocker = req.user.username;
  const blocked = req.params.username;
  if (blocker.toLowerCase() === blocked.toLowerCase()) return res.status(400).json({ error: 'Cannot block yourself' });
  
  try {
    const blockerLow = blocker.toLowerCase();
    const blockedLow = blocked.toLowerCase();
    console.log(`[BLOCK] ${blockerLow} is blocking ${blockedLow}`);
    
    // Standardize storage as lowercased to ensure all queries match easily
    const result = await pool.query('INSERT INTO blocks (blocker, blocked) VALUES ($1, $2) ON CONFLICT DO NOTHING', [blockerLow, blockedLow]);
    console.log(`[BLOCK] Insert result for ${blockerLow} blocking ${blockedLow}:`, result.rowCount);
    
    // Also unfollow each other explicitly (case-insensitive)
    await pool.query('DELETE FROM follows WHERE (LOWER("followerId") = $1 AND LOWER("followingId") = $2) OR (LOWER("followerId") = $2 AND LOWER("followingId") = $1)', [blockerLow, blockedLow]);
    
    invalidateCacheForUser(blockerLow);
    invalidateCacheForUser(blockedLow);
    
    // Emit real-time update
    emitToUser(blockedLow, 'blocking_updated', { blocker: blockerLow, blocked: blockedLow, isBlocked: true });
    emitToUser(blockerLow, 'blocking_updated', { blocker: blockerLow, blocked: blockedLow, isBlocked: true });

    res.json({ success: true, blocked: true });
  } catch (err) {
    console.error('Block error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/block/:username', authenticateTokenOptional, async (req, res) => {
  if (!req.user || req.user.isGuest || req.user.id === 0) {
    return res.status(401).json({ error: 'login_required', message: 'Please log in to use this feature' });
  }
  const blocker = req.user.username;
  const blocked = req.params.username;
  try {
    await pool.query('DELETE FROM blocks WHERE LOWER(blocker) = LOWER($1) AND LOWER(blocked) = LOWER($2)', [blocker, blocked]);
    invalidateCacheForUser(blocker);
    invalidateCacheForUser(blocked);

    // Emit real-time update
    emitToUser(blocked, 'blocking_updated', { blocker, blocked, isBlocked: false });
    emitToUser(blocker, 'blocking_updated', { blocker, blocked, isBlocked: false });

    res.json({ success: true, unblocked: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/blocks', authenticateToken, async (req, res) => {
  const username = req.user.username.toLowerCase();
  try {
    const result = await pool.query(
      `SELECT u.username, u."displayName", u."avatarPath" 
       FROM blocks b 
       JOIN users u ON LOWER(b.blocked) = LOWER(u.username) 
       WHERE LOWER(b.blocker) = $1`,
      [username]
    );
    console.log(`[BLOCKS] Fetched ${result.rows.length} blocks for ${username}`);
    res.json(result.rows || []);
  } catch (err) {
    console.error('Fetch blocks error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── FOLLOW a user ───
app.post('/api/follow/:username', authenticateTokenOptional, async (req, res) => {
  if (!req.user || req.user.isGuest || req.user.id === 0) {
    return res.status(401).json({ error: 'login_required', message: 'Please log in to use this feature' });
  }
  const follower = req.user.username;
  const following = req.params.username;
  if (follower.toLowerCase() === following.toLowerCase()) return res.status(400).json({ error: 'Cannot follow yourself' });
  
  try {
    // Check if either user has blocked the other (case-insensitive)
    const blockRow = await queryGet('SELECT id FROM blocks WHERE (LOWER(blocker) = LOWER($1) AND LOWER(blocked) = LOWER($2)) OR (LOWER(blocker) = LOWER($2) AND LOWER(blocked) = LOWER($1))', [following, follower]);
    if (blockRow) return res.status(403).json({ error: 'You cannot follow this user' });

    // Insert as pending (request sent)
    await pool.query('INSERT INTO follows ("followerId", "followingId", status) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [follower, following, 'pending']);
    
    invalidateCacheForUser(follower);
    invalidateCacheForUser(following);

    // Notify the user being followed so their UI updates immediately
    emitToUser(following, 'follow_request', { follower, following });

    res.json({ success: true, status: 'pending' });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── ACCEPT a follow request ───
app.post('/api/follow/:username/accept', authenticateTokenOptional, (req, res) => {
  if (!req.user || req.user.isGuest || req.user.id === 0) {
    return res.status(401).json({ error: 'login_required', message: 'Please log in to use this feature' });
  }
  const accepter = req.user.username;
  const requester = req.params.username;
  db.run('UPDATE follows SET status = ? WHERE LOWER(followerId) = LOWER(?) AND LOWER(followingId) = LOWER(?)', ['accepted', requester, accepter], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    invalidateCacheForUser(accepter);
    invalidateCacheForUser(requester);
    
    // Notify both users in real-time
    emitToUser(requester, 'follow_accepted', { accepter, requester });
    emitToUser(accepter, 'follow_accepted', { accepter, requester });

    res.json({ success: true, status: 'accepted' });
  });
});

// ─── UNFOLLOW / Cancel request ───
app.delete('/api/follow/:username', authenticateTokenOptional, (req, res) => {
  if (!req.user || req.user.isGuest || req.user.id === 0) {
    return res.status(401).json({ error: 'login_required', message: 'Please log in to use this feature' });
  }
  const follower = req.user.username;
  const following = req.params.username;
  db.run('DELETE FROM follows WHERE LOWER(followerId) = LOWER(?) AND LOWER(followingId) = LOWER(?)', [follower, following], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    invalidateCacheForUser(follower);
    invalidateCacheForUser(following);
    
    // Emit real-time unfollow event to sync UI across connected clients
    emitToUser(following, 'unfollow', { actor: follower, target: following });
    emitToUser(follower, 'unfollow', { actor: follower, target: following });
    
    res.json({ success: true });
  });
});

// â"€â"€ GET Follow Requests (incoming) â"€â"€
app.get('/api/follow/requests', authenticateToken, (req, res) => {
  const username = req.user.username;
  // Fetch pending and accepted follows from the last 10 days (or just all for simplicity, limit 50)
  db.all(`
    SELECT 
      f.followerId as "username", u.displayName as "displayName", u.avatarPath as "avatarPath", f.status,
      (SELECT status FROM follows WHERE LOWER(followerId) = LOWER(?) AND LOWER(followingId) = LOWER(f.followerId)) as "myFollowStatus"
    FROM follows f 
    JOIN users u ON LOWER(u.username) = LOWER(f.followerId) 
    WHERE LOWER(f.followingId) = LOWER(?) 
    ORDER BY f.createdAt DESC LIMIT 50
  `, [username, username], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows || []);
  });
});

// â"€â"€ GET Followers / Following list for a user â"€â"€
app.get('/api/follow/:username/list', authenticateTokenOptional, (req, res) => {
  const { username } = req.params;
  db.all(
    `SELECT u.username, u.displayName, u.avatarPath FROM follows f JOIN users u ON LOWER(u.username) = LOWER(f.followerId) WHERE LOWER(f.followingId) = LOWER(?) AND f.status = 'accepted' ORDER BY f.createdAt DESC LIMIT 50`,
    [username],
    (err, followers) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      db.all(
        `SELECT u.username, u.displayName, u.avatarPath FROM follows f JOIN users u ON LOWER(u.username) = LOWER(f.followingId) WHERE LOWER(f.followerId) = LOWER(?) AND f.status = 'accepted' ORDER BY f.createdAt DESC LIMIT 50`,
        [username],
        (err2, following) => {
          if (err2) return res.status(500).json({ error: 'Database error' });
          res.json({ followers: followers || [], following: following || [] });
        }
      );
    }
  );
});

// â"€â"€ UPDATE Display Name and Bio â"€â"€
app.put('/api/profile', authenticateToken, (req, res) => {
  const { displayName, bio } = req.body;
  if (!displayName || !displayName.trim()) return res.status(400).json({ error: 'Display name is required' });
  db.run('UPDATE users SET displayName = ?, bio = ? WHERE id = ?', [displayName.trim(), bio !== undefined ? bio : null, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    invalidateCacheForUser(req.user.username);
    res.json({ message: 'Profile updated', displayName: displayName.trim(), bio });
  });
});

// ── Check Username Availability ──
app.get('/api/profile/check-username', async (req, res) => {
  const { username, excludeId } = req.query;
  if (!username || username.trim().length < 3) return res.json({ available: false, reason: 'too_short' });
  const cleaned = username.trim();
  if (cleaned.length > 30) return res.json({ available: false, reason: 'too_long' });
  if (!/^[a-zA-Z0-9._]+$/.test(cleaned)) return res.json({ available: false, reason: 'invalid_chars' });
  try {
    const result = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)' + (excludeId ? ' AND id != $2' : ''),
      excludeId ? [cleaned, excludeId] : [cleaned]
    );
    res.json({ available: result.rows.length === 0 });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ── Update Username ──
app.put('/api/profile/username', authenticateToken, async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required' });
  const cleaned = username.trim();
  if (cleaned.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (cleaned.length > 30) return res.status(400).json({ error: 'Username must be 30 characters or less' });
  if (!/^[a-zA-Z0-9._]+$/.test(cleaned)) return res.status(400).json({ error: 'Username can only contain letters, numbers, dots, and underscores' });
  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
      [cleaned, req.user.id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username already taken' });
    await pool.query('UPDATE users SET username = $1 WHERE id = $2', [cleaned, req.user.id]);
    invalidateCacheForUser(req.user.username);
    invalidateCacheForUser(cleaned);
    const newToken = jwt.sign({ id: req.user.id, username: cleaned }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ message: 'Username updated', username: cleaned, token: newToken });
  } catch (err) {
    console.error('Username update error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ── DELETE User Account ──
app.delete('/api/profile', authenticateToken, (req, res) => {
  // First get the username to delete rooms
  db.get('SELECT username FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Failed to find user' });
    
    // Delete from users table
    db.run('DELETE FROM users WHERE id = ?', [req.user.id], function(err) {
      if (err) {
        console.error('DELETE ACCOUNT ERROR (users):', err);
        return res.status(500).json({ error: 'Failed to delete account (main table)' });
      }
      
      // Also delete any rooms they were hosting
      db.run('DELETE FROM room_names WHERE hostUsername = ?', [user.username], function(err) {
        if (err) console.error('DELETE ACCOUNT ERROR (room_names):', err);
        res.json({ message: 'Account permanently deleted' });
      });
    });
  });
});

// â"€â"€ Upload Avatar â"€â"€
app.post('/api/profile/avatar', authenticateToken, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = `/avatars/${req.file.filename}`;
  // Delete old avatar if exists
  db.get('SELECT avatarPath FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (!err && row && row.avatarPath) {
      const oldPath = path.join(__dirname, row.avatarPath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    db.run('UPDATE users SET avatarPath = ? WHERE id = ?', [avatarUrl, req.user.id], function(updateErr) {
      if (updateErr) return res.status(500).json({ error: 'Database error' });
      invalidateCacheForUser(req.user.username);
      res.json({ message: 'Avatar updated', avatarPath: avatarUrl });
    });
  });
});

// â"€â"€ Change Password â"€â"€
app.post('/api/profile/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  db.get('SELECT id, password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.password) return res.status(400).json({ error: 'Account uses Google sign-in, password cannot be changed here' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id], (updateErr) => {
      if (updateErr) return res.status(500).json({ error: 'Failed to change password' });
      res.json({ message: 'Password changed successfully' });
    });
  });
});

// ─── GET App Settings ───
app.get('/api/settings', authenticateTokenOptional, (req, res) => {
  if (!req.user || req.user.id === 0 || req.user.isGuest) {
    return res.json({
      language: 'en',
      country: 'US',
      showCountry: true,
      notifyApp: true,
      notifyJoin: true,
      notifyMessages: true,
      notifyFriendRequests: true,
      notifyLeave: true,
      notifyJoinRequests: true
    });
  }
  db.get('SELECT language, country, country_code, showCountry, notifyApp, notifyJoin, notifyMessages, notifyFriendRequests, notifyLeave, notifyJoinRequests FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  });
});

// ─── UPDATE App Settings ───
app.put('/api/settings', authenticateTokenOptional, (req, res) => {
  if (!req.user || req.user.id === 0 || req.user.isGuest) {
    return res.json({ message: 'Guest settings updated locally' });
  }
  const allowed = ['language', 'country', 'country_code', 'showCountry', 'notifyApp', 'notifyJoin', 'notifyMessages', 'notifyFriendRequests', 'notifyLeave', 'notifyJoinRequests'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid settings provided' });
  values.push(req.user.id);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    invalidateCacheForUser(req.user.username);
    res.json({ message: 'Settings updated' });
  });
});

// Endpoint to upload a room media file to Supabase storage
app.post('/api/upload', authenticateTokenOptional, (req, res) => {
  const roomUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
  }).single('media');

  roomUpload(req, res, async function(err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large (max 100MB).' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ error: 'roomId is required.' });

    const ts = Date.now();
    const safe = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `room/${ts}_${safe}`;

    const { error: upErr } = await supabase.storage
      .from('encrypted-media')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        upsert: false
      });

    if (upErr) {
      console.error('[UPLOAD/room] supabase:', upErr);
      return res.status(500).json({ error: 'Unable to save file. Please try again.' });
    }

    const { data } = supabase.storage.from('encrypted-media').getPublicUrl(filePath);
    return res.json({ url: data.publicUrl, path: filePath });
  });
});

// Legacy endpoint — serves old files that were stored on local disk before Supabase migration.
// New uploads go directly to Supabase; this endpoint only handles pre-migration files still on disk.
app.get('/api/stream/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  // ── Fallback: redirect to Supabase Storage if not on local disk ──
  if (!fs.existsSync(filePath)) {
    const storagePath = `chat-uploads/${filename}`;
    try {
      const { data, error } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(storagePath, 3600);
      if (!error && data?.signedUrl) {
        return res.redirect(307, data.signedUrl);
      }
    } catch (_) { /* fall through to 404 */ }
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  // Default to video/mp4 for streamed files without extensions to ensure browser compatibility
  const contentType = mimeTypes[ext] || (req.path.includes('/api/stream') ? 'video/mp4' : 'application/octet-stream');

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, {
      start, 
      end, 
      highWaterMark: 128 * 1024 // 128KB buffer for smoother 4K streaming
    });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath, { highWaterMark: 128 * 1024 }).pipe(res);
  }
});

app.get('/api/rooms/info', (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) return res.json([]);
  const ids = idsParam.split(',').filter(Boolean);
  
  const promises = ids.map(id => {
    return new Promise((resolve) => {
      let activeRoom = rooms.get(id);
      db.get('SELECT roomName, category, thumbnailPath FROM room_names WHERE roomId = ?', [id], (err, row) => {
        if (!row && !activeRoom) {
          console.log(`[INFO] Room Info Request: ${id} -> NOT FOUND`);
          return resolve(null);
        }
        let name = (row && row.roomName) ? row.roomName : (activeRoom ? activeRoom.roomName : 'Room Chat');
        let category = (row && row.category) ? row.category : (activeRoom ? activeRoom.category : 'other');
        let thumbnailPath = (row && row.thumbnailPath) ? row.thumbnailPath : (activeRoom ? activeRoom.thumbnailPath : null);
        let userCount = activeRoom ? activeRoom.users.length : 0;
        console.log(`[INFO] Room Info Request: ${id} -> FOUND (name: ${name}, active: ${!!activeRoom})`);
        resolve({ id, name, userCount, category, thumbnailPath });
      });
    });
  });

  Promise.all(promises).then(data => res.json(data.filter(Boolean))).catch(() => res.json([]));
});




app.post('/api/rooms/create', roomCreateLimiter, (req, res) => {
  const { roomId, roomName, category, isPublic, hostUsername } = req.body;
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
  const name = (roomName && roomName.trim()) ? roomName.trim() : 'Room Chat';
  const pub = isPublic ? 1 : 0;
  const cat = category || 'other';
  db.run(
    'INSERT INTO room_names (roomId, roomName, isPublic, hostUsername, category) VALUES (?, ?, ?, ?, ?) ON CONFLICT(roomId) DO UPDATE SET roomName = excluded.roomName, isPublic = excluded.isPublic, hostUsername = excluded.hostUsername, category = excluded.category',
    [roomId, name, pub, hostUsername || null, cat],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ success: true });
    }
  );
});

app.post('/api/rooms/make-private', (req, res) => {
  const { roomId, username } = req.body;
  const room = rooms.get(roomId);
  // Check both in-memory and DB host
  db.get('SELECT hostUsername FROM room_names WHERE roomId = ?', [roomId], (err, row) => {
    const dbHost = row && row.hostUsername;
    const memHost = room && room.hostUsername;
    const isHost = (username && (
      (memHost && String(memHost).toLowerCase() === String(username).toLowerCase()) ||
      (dbHost && String(dbHost).toLowerCase() === String(username).toLowerCase())
    ));
    if (!isHost) return res.status(403).json({ error: 'Permission denied or room not found' });
    if (room) {
      room.isPublic = false;
      io.to(roomId).emit('room_public_status', { isPublic: false });
    }
    // Persist private status to DB
    db.run('UPDATE room_names SET isPublic = 0 WHERE roomId = ?', [roomId]);
    return res.json({ success: true });
  });
});

app.get('/api/rooms/public', (req, res) => {
    db.all('SELECT roomId, roomName, hostUsername, category, thumbnailPath FROM room_names WHERE isPublic = 1', [], (err, rows) => {
    if (err) return res.json([]);

    // Merge with in-memory rooms
    const inMemoryPublic = [];
    for (const [id, room] of rooms.entries()) {
      if (room.isPublic) {
        inMemoryPublic.push({ roomId: id, roomName: room.roomName || 'Room Chat', hostUsername: room.hostUsername || null, category: room.category || 'other', thumbnailPath: room.thumbnailPath || null });
      }
    }

    // Combine DB rows + in-memory, dedupe by roomId
    const allPublicMap = new Map();
    (rows || []).forEach(r => allPublicMap.set(r.roomId, r));
    inMemoryPublic.forEach(r => {
      if (!allPublicMap.has(r.roomId)) allPublicMap.set(r.roomId, r);
    });

    const result = [];
    for (const [roomId, dbRow] of allPublicMap.entries()) {
      const memRoom = rooms.get(roomId);
      const userCount = memRoom ? memRoom.users.length : 0;
      const hostUsername = (memRoom?.hostUsername) || dbRow.hostUsername || null;
      const name = (memRoom?.roomName && memRoom.roomName !== 'Room Chat') ? memRoom.roomName : (dbRow.roomName || 'Room Chat');
      const category = (memRoom?.category) || dbRow.category || 'other';
      const thumbnailPath = (memRoom?.thumbnailPath) || dbRow.thumbnailPath || null;
      result.push({ id: roomId, name, userCount, hostUsername, category, thumbnailPath });
    }

    res.json(result);
  });
});

// ─── Save media position (sendBeacon fallback for page close) ───
app.post('/api/rooms/save-position', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    const data = JSON.parse(req.body.toString());
    const { roomId: rawRoomId, url, position, mediaType } = data || {};
    const roomId = (rawRoomId || '').toLowerCase();
    if (!roomId || !url || position === undefined) return res.sendStatus(400);

    await pool.query(
      `UPDATE room_names SET last_media_url=$1, last_media_position=$2, last_media_type=$3, last_media_saved_at=$4 WHERE "roomId"=$5`,
      [url, parseFloat(position) || 0, mediaType || null, new Date().toISOString(), roomId]
    );

    // Also sync to in-memory room
    const room = rooms.get(roomId);
    if (room) {
      room.lastMediaUrl = url;
      room.lastMediaPosition = parseFloat(position) || 0;
      room.lastMediaType = mediaType || null;
      room.lastMediaSavedAt = new Date().toISOString();
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[save-position]', err.message);
    res.sendStatus(500);
  }
});

const COUNTRY_TO_CODE = {
  'Afghanistan':'AF','Albania':'AL','Algeria':'DZ','Argentina':'AR','Armenia':'AM',
  'Australia':'AU','Austria':'AT','Azerbaijan':'AZ','Bangladesh':'BD','Belarus':'BY',
  'Belgium':'BE','Bolivia':'BO','Brazil':'BR','Bulgaria':'BG','Cambodia':'KH',
  'Canada':'CA','Chile':'CL','China':'CN','Colombia':'CO','Croatia':'HR',
  'Czech Republic':'CZ','Denmark':'DK','Ecuador':'EC','Egypt':'EG','Ethiopia':'ET',
  'Finland':'FI','France':'FR','Georgia':'GE','Germany':'DE','Ghana':'GH',
  'Greece':'GR','Hungary':'HU','India':'IN','Indonesia':'ID','Iran':'IR',
  'Iraq':'IQ','Ireland':'IE','Israel':'IL','Italy':'IT','Japan':'JP',
  'Jordan':'JO','Kazakhstan':'KZ','Kenya':'KE','South Korea':'KR','Kuwait':'KW',
  'Malaysia':'MY','Mexico':'MX','Morocco':'MA','Myanmar':'MM','Nepal':'NP',
  'Netherlands':'NL','New Zealand':'NZ','Nigeria':'NG','Norway':'NO','Pakistan':'PK',
  'Peru':'PE','Philippines':'PH','Poland':'PL','Portugal':'PT','Qatar':'QA',
  'Romania':'RO','Russia':'RU','Saudi Arabia':'SA','Serbia':'RS','Singapore':'SG',
  'South Africa':'ZA','Spain':'ES','Sri Lanka':'LK','Sweden':'SE','Switzerland':'CH',
  'Syria':'SY','Taiwan':'TW','Thailand':'TH','Tunisia':'TN','Turkey':'TR',
  'UAE':'AE','Ukraine':'UA','United Kingdom':'GB','United States':'US',
  'Uruguay':'UY','Uzbekistan':'UZ','Venezuela':'VE','Vietnam':'VN','Yemen':'YE',
  'Zimbabwe':'ZW'
};

function buildUserList(room) {
  // Collect usernames that are currently pending approval so we can exclude them
  // from the active member list. This handles the case where a user was in the room
  // before it was locked and their old socket entry is still in room.users.
  const pendingUsernames = new Set();
  if (room.pendingJoins) {
    room.pendingJoins.forEach(pending => {
      if (pending.username) pendingUsernames.add(pending.username.toLowerCase());
    });
  }

  return room.users
    .filter(u => !pendingUsernames.has((u.username || '').toLowerCase()))
    .map(u => {
      const isModeratorMuted = room.mutedUsers.has(u.username);
      return {
        socketId: u.socketId,
        username: u.username,
        isMuted: !!(u.isMuted || isModeratorMuted),
        isModMuted: isModeratorMuted,
        isHost: u.socketId === room.hostId,
        isAdmin: isUserAdmin(room, u),
        publicKey: room.publicKeys?.[u.socketId] || u.publicKey || null,
        avatarPath: u.avatarPath || null,
        country: (u.showCountry !== false && u.showCountry !== 0 && u.showCountry !== '0') ? (u.country || null) : null,
        countryCode: (u.showCountry !== false && u.showCountry !== 0 && u.showCountry !== '0') ? (u.countryCode || null) : null
      };
    });
}

function getSerializableRoom(room) {
  if (!room) return null;
  return {
    roomName: room.roomName || 'Room Chat',
    currentMedia: room.currentMedia || null,
    currentTime: room.currentTime || 0,
    isPlaying: !!room.isPlaying,
    timestampUpdatedAt: room.timestampUpdatedAt || Date.now(),
    isPublic: !!room.isPublic,
    category: room.category || 'other',
    thumbnailPath: room.thumbnailPath || null,
    uiState: room.uiState || { camPositions: {}, camSizes: {}, circleCams: [] },
    permissions: room.permissions || {},
    settings: room.settings || {},
    bannedUsers: Array.from(room.bannedUsers || []),
    activeExternalApp: room.activeExternalApp || null,
    screenshareHostId: room.screenshareHostId || null,
    lastMediaUrl: room.lastMediaUrl || null,
    lastMediaPosition: room.lastMediaPosition || 0,
    lastMediaType: room.lastMediaType || null,
    lastMediaSavedAt: room.lastMediaSavedAt || null,
    streamPending: room.streamPending || null,
    subtitles: room.subtitles || null,
    roomTheme: room.roomTheme || 'default',
    users: buildUserList(room)
  };
}

async function getOrInitFirstJoined(username, roomId) {
  if (!username || !roomId || username === 'Anonymous') return null;
  const lowerRoom = roomId.toLowerCase();
  
  try {
    const row = await queryGet('SELECT "firstJoined" FROM users WHERE username = ?', [username]);
    let fj = {};
    if (row && row.firstJoined) {
      try { fj = JSON.parse(row.firstJoined); } catch(e){}
    }
    
    if (fj[lowerRoom] === undefined) {
      fj[lowerRoom] = Date.now();
      await pool.query('UPDATE users SET "firstJoined" = $1 WHERE username = $2', [JSON.stringify(fj), username]);
      console.log(`[firstJoined] Initialized first join timestamp for ${username} in ${lowerRoom} to ${fj[lowerRoom]}`);
    }
    
    return fj[lowerRoom];
  } catch (err) {
    console.error(`[getOrInitFirstJoined] error for ${username} in ${lowerRoom}:`, err.message);
    return null;
  }
}

// Helper to check if a user has admin privileges in a room
function isUserAdmin(room, userOrSocket) {
  if (!room || !userOrSocket) return false;
  
  // Normalized identifiers
  const socketId = userOrSocket.socketId || userOrSocket.id;
  const username = userOrSocket.username;

  // 1. Host is always admin
  const isHost = (room.hostId === socketId) || 
                 (room.hostUsername && username && room.hostUsername.toLowerCase() === username.toLowerCase());
  if (isHost) return true;
  
  // 2. Manual Admin check
  if (room.admins && username && room.admins.has(username.toLowerCase())) {
    return true;
  }

  // 3. Auto-Admin logic (Applies to all users if setting is enabled)
  // Check if they are explicitly denied first
  if (room.deniedAdmins && username && room.deniedAdmins.has(username.toLowerCase())) {
    return false;
  }

  const isAutoAdminEnabled = room.settings?.newMembersAdmins === true || room.settings?.newMembersAdmins === 'true';
  if (isAutoAdminEnabled && username) {
    return true;
  }
  
  return false;
}

// Socket.io middleware to handle JWT auth
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return next();
    try {
      const result = await pool.query(
        'SELECT terminated, is_permanently_banned, banned_until FROM users WHERE id = $1',
        [decoded.id]
      );
      const u = result.rows[0];
      if (u && (u.terminated || u.is_permanently_banned || (u.banned_until && new Date(u.banned_until) > new Date()))) {
        return next(new Error('account_banned'));
      }
    } catch { /* allow through on DB error rather than blocking all sockets */ }
    socket.user = decoded;
    socket.username = decoded.username;
    next();
  });
});

// Socket.io connection logic
// ─── Virtual Browser (Hyperbeam) endpoints ───────────────────────────────────
const HB_API = 'https://engine.hyperbeam.com/v0/vm';

// Legacy: used by iframe browser toolbar (navigate endpoint kept for compat)
app.post('/api/browser/session', authenticateToken, async (req, res) => {
  const apiKey = process.env.HYPERBEAM_API_KEY;
  if (!apiKey) return res.json({ error: 'not_configured' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url_required' });
  try {
    const r = await fetch(HB_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_url: url, offline_timeout: 600, control_disable_default: false, fps: 30 })
    });
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/browser/session/:id', authenticateToken, async (req, res) => {
  const apiKey = process.env.HYPERBEAM_API_KEY;
  if (!apiKey) return res.json({ ok: true });
  try {
    await fetch(`${HB_API}/${req.params.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false });
  }
});

app.post('/api/browser/session/:id/navigate', authenticateToken, async (req, res) => {
  const apiKey = process.env.HYPERBEAM_API_KEY;
  if (!apiKey) return res.json({ error: 'not_configured' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    // Correct Hyperbeam API endpoint for navigation is /tabs/active (not /navs)
    const r = await fetch(`${HB_API}/${req.params.id}/tabs/active`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const body = await r.text();
    console.log(`[HYPERBEAM] Navigate ${req.params.id} → ${url} | status=${r.status} body=${body}`);
    res.json({ ok: r.ok, status: r.status });
  } catch (e) {
    console.error('[HYPERBEAM] Navigate error:', e.message);
    res.json({ ok: false, error: e.message });
  }
});

// ─── Hyperbeam Fallback Routes ────────────────────────────────────────────────
// SECURITY: HYPERBEAM_API_KEY is only used here in server.js, never in any
// frontend file. Frontend only calls these endpoints via our backend.

// POST /api/hyperbeam/create-session
// Creates a new Hyperbeam VM for a given room. Deduplicates per room (cost safety).
app.post('/api/hyperbeam/create-session', authenticateToken, async (req, res) => {
  // Using Hyperbeam TEST key — see HYPERBEAM_API_KEY in backend/.env
  const apiKey = process.env.HYPERBEAM_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Cloud browser not configured on this server.' });

  const { roomId, url } = req.body;
  if (!roomId || !url) return res.status(400).json({ error: 'roomId and url are required' });

  const rid = roomId.toLowerCase();

  // A5-F4: Only the room host may create or retrieve a Hyperbeam session (admin_token is a full control credential)
  {
    const memRoom = rooms.get(rid);
    let hostUsername = memRoom?.hostUsername || null;
    if (!hostUsername) {
      // Room not in memory (no one currently connected) — fall back to DB
      hostUsername = await new Promise(resolve =>
        db.get('SELECT hostUsername FROM room_names WHERE roomId = ?', [rid], (err, row) => resolve(row?.hostUsername || null))
      );
    }
    if (!hostUsername || hostUsername.toLowerCase() !== (req.user.username || '').toLowerCase()) {
      return res.status(403).json({ error: 'Only the room host can start or access a cloud browser session.' });
    }
  }

  // COST GUARD: if a session already exists for this room, return it immediately
  if (activeHyperbeamSessions.has(rid)) {
    const existing = activeHyperbeamSessions.get(rid);
    console.log(`[HYPERBEAM] Returning existing session for room ${rid}: ${existing.session_id}`);
    return res.json({
      session_id: existing.session_id,
      embed_url: existing.embed_url,
      admin_token: existing.admin_token || null,
      targetUrl: url  // use the newly requested URL so navigation goes to the right place
    });
  }

  try {
    const hbRequestBody = {
      start_url: url,
      kiosk: true,
      tag: `room_${rid}`,
      control_disable_default: false,
      timeout: {
        offline: 300,
        absolute: 7200,
        warning: 30
      }
    };
    console.log('[HYPERBEAM] Creating session with start_url:', url);
    console.log('[HYPERBEAM][DEBUG] Request body:', JSON.stringify(hbRequestBody));
    const r = await fetch(HB_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(hbRequestBody)
    });
    console.log('[HYPERBEAM][DEBUG] HTTP status:', r.status);
    const rawBody = await r.text();
    console.log('[HYPERBEAM][DEBUG] Response received (body suppressed for security)');
    if (!r.ok) {
      console.error('[HYPERBEAM] API error creating session:', r.status, rawBody);
      return res.status(502).json({ error: 'Hyperbeam API error', details: rawBody });
    }
    const data = JSON.parse(rawBody);
    const ts = new Date().toISOString();
    console.log(`[HYPERBEAM] Session created: ${data.session_id} at ${ts} for room ${rid}`);
    console.log('[HYPERBEAM][DEBUG] admin_token present:', !!data.admin_token);

    // Store in memory for cleanup triggers
    activeHyperbeamSessions.set(rid, {
      session_id: data.session_id,
      embed_url: data.embed_url,
      admin_token: data.admin_token || null,
      targetUrl: url,
      createdAt: ts
    });

    return res.json({
      session_id: data.session_id,
      embed_url: data.embed_url,
      admin_token: data.admin_token || null,
      targetUrl: url
    });
  } catch (e) {
    console.error('[HYPERBEAM] create-session error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/hyperbeam/session/:roomId
// Terminates the Hyperbeam session for the given room.
app.delete('/api/hyperbeam/session/:roomId', authenticateToken, async (req, res) => {
  const apiKey = process.env.HYPERBEAM_API_KEY;
  const rid = (req.params.roomId || '').toLowerCase();
  const session = activeHyperbeamSessions.get(rid);

  if (!session) {
    return res.json({ ok: true, note: 'No active session found for this room' });
  }

  try {
    await fetch(`${HB_API}/${session.session_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const ts = new Date().toISOString();
    console.log(`[HYPERBEAM] Session ended: ${session.session_id} at ${ts} for room ${rid}`);
    activeHyperbeamSessions.delete(rid);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[HYPERBEAM] end-session error:', e.message);
    // Still remove from map even if Hyperbeam call failed — don't leave zombie entries
    activeHyperbeamSessions.delete(rid);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// --- TV Pairing State ---
const activePairingCodes = new Map();

function generatePairingCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (activePairingCodes.has(code));
  return code;
}

// ═══════════════════════════════════════════════════════════════════
// CHUNKED VIDEO STREAMING — local file upload + progressive playback
// ═══════════════════════════════════════════════════════════════════

const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const streamKey = req.params.streamKey;
      const dir = path.join(__dirname, 'uploads', 'streams', streamKey);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, _file, cb) => {
      // chunkIndex comes from URL params — always available before body is parsed
      const idx = req.params.chunkIndex ?? '0';
      cb(null, `chunk_${String(idx).padStart(6, '0')}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB per chunk max
});

// In-memory stream registry — no DB migration needed
const activeStreams = new Map(); // streamKey → { roomId, filename, mimetype, totalSize, totalChunks, chunksReceived, createdAt }

app.post('/api/stream/init', authenticateTokenOptional, (req, res) => {
  try {
    const { roomId, filename, mimetype, totalSize, totalChunks } = req.body;
    if (!roomId || !filename || !totalSize || !totalChunks) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const mt = mimetype || 'video/mp4';
    if (!mt.startsWith('video/')) {
      return res.status(400).json({ error: 'Only video files allowed' });
    }
    if (totalSize > 5 * 1024 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Max 5GB.' });
    }

    const streamKey = crypto.randomBytes(16).toString('hex');
    fs.mkdirSync(path.join(__dirname, 'uploads', 'streams', streamKey), { recursive: true });

    activeStreams.set(streamKey, {
      roomId: roomId.toLowerCase(),
      filename,
      mimetype: mt,
      totalSize: Number(totalSize),
      totalChunks: Number(totalChunks),
      chunksReceived: 0,
      createdAt: Date.now()
    });

    const room = rooms.get(roomId.toLowerCase());
    if (room) {
      room.streamPending = {
        streamKey,
        filename,
        progress: 0
      };
    }

    res.json({ streamKey, streamId: streamKey, chunkSize: 1024 * 1024 });
  } catch (err) {
    console.error('[stream/init] error:', err);
    res.status(500).json({ error: 'Failed to initialize stream' });
  }
});

app.post('/api/stream/:streamKey/chunk/:chunkIndex', authenticateTokenOptional, chunkUpload.single('chunk'), (req, res) => {
  try {
    const { streamKey } = req.params;
    const stream = activeStreams.get(streamKey);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    stream.chunksReceived += 1;
    const newCount = stream.chunksReceived;
    const isReady = newCount >= stream.totalChunks;
    const progress = Math.round((newCount / stream.totalChunks) * 100);

    const room = rooms.get(stream.roomId);
    if (room && room.streamPending) {
      room.streamPending.progress = progress;
    }

    // Only emit stream_ready when the upload is 100% complete
    if (isReady) {
      if (room) {
        room.streamPending = null;
      }
      io.to(stream.roomId).emit('stream_ready', {
        streamKey,
        filename: stream.filename,
        progress,
        canPlay: true
      });
    }

    // Emit stream_progress on every chunk so progress bar updates smoothly for viewers
    io.to(stream.roomId).emit('stream_progress', {
      streamKey,
      progress,
      chunksReceived: newCount,
      totalChunks: stream.totalChunks
    });

    res.json({ received: newCount, progress });
  } catch (err) {
    console.error('[stream/chunk] error:', err);
    res.status(500).json({ error: 'Chunk upload failed' });
  }
});

// Serve assembled video with HTTP Range support (Async non-blocking version)
app.get('/api/stream/:streamKey/:filename', async (req, res) => {
  try {
    const { streamKey } = req.params;
    const stream = activeStreams.get(streamKey);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const streamDir = path.join(__dirname, 'uploads', 'streams', streamKey);
    const totalSize = stream.totalSize; // real total for Content-Range denominator
    const CHUNK_SIZE = 1024 * 1024;

    // Allow cross-origin video loading (ReactPlayer fetches from localhost:3001 while page is on :5173)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // Calculate bytes actually available on disk right now
    let availableBytes = 0;
    for (let i = 0; i < stream.chunksReceived; i++) {
      const chunkPath = path.join(streamDir, `chunk_${String(i).padStart(6, '0')}`);
      try {
        const stats = await fs.promises.stat(chunkPath);
        availableBytes += stats.size;
      } catch (e) {
        // Chunk not yet fully written or missing
      }
    }

    res.setHeader('Content-Type', stream.mimetype);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${stream.filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);

      if (start >= availableBytes) {
        // Browser is requesting bytes not yet uploaded
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        return res.status(416).end();
      }

      // Cap end at what's available — don't promise bytes we don't have yet
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : availableBytes - 1;
      const end = Math.min(requestedEnd, availableBytes - 1);
      const chunkLen = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': chunkLen,
      });

      const startChunk = Math.floor(start / CHUNK_SIZE);
      const endChunk = Math.floor(end / CHUNK_SIZE);
      let bytesWritten = 0;
      const totalToWrite = end - start + 1;

      for (let i = startChunk; i <= endChunk && i < stream.chunksReceived; i++) {
        const chunkPath = path.join(streamDir, `chunk_${String(i).padStart(6, '0')}`);
        try {
          await fs.promises.access(chunkPath);
        } catch {
          break;
        }

        let data = await fs.promises.readFile(chunkPath);

        if (i === startChunk) {
          const offset = start - startChunk * CHUNK_SIZE;
          data = data.subarray(offset);
        }

        const remaining = totalToWrite - bytesWritten;
        if (data.length > remaining) data = data.subarray(0, remaining);

        res.write(data);
        bytesWritten += data.length;
        if (bytesWritten >= totalToWrite) break;
      }
      res.end();
    } else {
      // No Range header — serve what's available so far
      res.setHeader('Content-Length', availableBytes);
      res.writeHead(200);
      for (let i = 0; i < stream.chunksReceived; i++) {
        const chunkPath = path.join(streamDir, `chunk_${String(i).padStart(6, '0')}`);
        try {
          const data = await fs.promises.readFile(chunkPath);
          res.write(data);
        } catch (e) {
          // Chunk missing
        }
      }
      res.end();
    }
  } catch (err) {
    console.error('[stream/video] error:', err);
    res.status(500).end();
  }
});

// Hourly cleanup of streams older than 4 hours
setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  let removed = 0;
  for (const [key, stream] of activeStreams.entries()) {
    if (stream.createdAt < cutoff) {
      const dir = path.join(__dirname, 'uploads', 'streams', key);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      activeStreams.delete(key);
      removed++;
    }
  }
  if (removed > 0) console.log(`[stream/cleanup] Removed ${removed} expired stream(s)`);
}, 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────

// Socket-level chat rate limiter: 30 messages per minute per socket
const chatRateBuckets = new Map(); // socketId -> { count, resetAt }
function checkChatRate(socketId) {
  const now = Date.now();
  let b = chatRateBuckets.get(socketId) || { count: 0, resetAt: now + 60000 };
  if (now > b.resetAt) { b.count = 0; b.resetAt = now + 60000; }
  b.count++;
  chatRateBuckets.set(socketId, b);
  return b.count <= 30;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id} (Authenticated: ${!!socket.username})`);
  // Register in global map if authenticated
  if (socket.username) registerSocket(socket.username, socket.id);

  socket.on('admin:join', () => {
    if (!socket.username) return;
    db.get('SELECT role FROM users WHERE username = ?', [socket.username], (err, row) => {
      if (row && (row.role === 'admin' || row.role === 'superadmin' || row.role === 'super_admin' || row.role === 'moderator' || row.role === 'support')) {
        socket.join('admins');
        console.log(`[ADMIN SOCKET] Joined admins room: ${socket.username}`);
      }
    });
  });

  socket.on('client_log', (msg) => {
    console.log('[CLIENT_LOG]', socket.username || socket.id, msg);
  });

  socket.on('stream_started', (data) => {
    if (data?.roomId) {
      const rid = data.roomId.toLowerCase();
      const room = rooms.get(rid);
      if (room) {
        room.currentMedia = '';
        room.currentTime = 0;
        room.isPlaying = false;
        room.streamPending = {
          streamKey: data.streamKey,
          filename: data.filename,
          progress: 0
        };
      }
      socket.to(rid).emit('stream_started', data);
      socket.to(rid).emit('media_changed', '');
    }
  });

  socket.on('stream_cancelled', (data) => {
    if (data?.roomId) {
      const rid = data.roomId.toLowerCase();
      const room = rooms.get(rid);
      if (room) {
        room.streamPending = null;
      }
      socket.to(rid).emit('stream_cancelled');
    }
  });

  socket.on('subtitles_load', ({ roomId, text }) => {
    const rid = roomId ? roomId.toLowerCase() : null;
    if (!rooms.has(rid)) return;
    const room = rooms.get(rid);
    room.subtitles = text;
    socket.to(rid).emit('action_subtitles_load', text);
  });

  // ─── TV Pairing Logic ───
  socket.on('request_tv_code', (data) => {
    const code = generatePairingCode();
    activePairingCodes.set(code, { socketId: socket.id, generatedAt: Date.now(), username: data?.username || 'Smart TV' });
    
    setTimeout(() => {
      if (activePairingCodes.get(code)?.socketId === socket.id) {
        activePairingCodes.delete(code);
        socket.emit('tv_code_expired');
      }
    }, 10 * 60 * 1000);

    socket.emit('tv_code_generated', { code });
  });

  socket.on('link_tv_code', ({ code, roomId }) => {
    if (!socket.username || !roomId) {
      socket.emit('error_notification', 'You must be logged in and in a room to link a TV.');
      return;
    }

    const normalizedCode = (code || '').toUpperCase();
    const tvData = activePairingCodes.get(normalizedCode);
    
    if (tvData) {
      const tvSocketId = tvData.socketId;
      activePairingCodes.delete(normalizedCode);
      
      // Auto-approve the TV username so it bypasses the lobby
      const roomObj = rooms.get(roomId);
      if (roomObj) {
        if (!roomObj.approvedUsers) roomObj.approvedUsers = new Set();
        roomObj.approvedUsers.add(tvData.username.toLowerCase());
      }

      // Generate a REAL signed guest JWT for the TV so it can authenticate API calls
      // Use a sanitised username so it works as a valid identifier in the DB layer
      const tvUsername = (tvData.username || 'smarttv').toLowerCase().replace(/\s+/g, '_');
      const guestToken = jwt.sign(
        { id: 0, username: tvUsername, isGuest: true, isTV: true },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      io.to(tvSocketId).emit('tv_linked', { roomId, guestToken, guestUsername: tvUsername });
      socket.emit('tv_link_success', { message: 'TV linked successfully.' });
    } else {
      socket.emit('error_notification', 'Invalid or expired pairing code. Please try again.');
    }
  });

  socket.on('disconnect', () => {
    unregisterSocket(socket.username, socket.id);
    chatRateBuckets.delete(socket.id);

    // Cleanup any active pairing codes for this socket
    for (const [code, data] of activePairingCodes.entries()) {
      if (data.socketId === socket.id) {
        activePairingCodes.delete(code);
      }
    }
  });

  // ─── Helper for Finalizing Room Join ───
  async function executeFinalJoin(targetSocket, roomObj, roomId, username) {
    console.log(`[JOIN_FLOW] executeFinalJoin for ${username} in ${roomId}`);
    if (!roomObj) {
      console.warn(`[JOIN_FLOW] roomObj null for ${roomId} in executeFinalJoin`);
      return;
    }

    if (username !== 'Anonymous') {
      roomObj.users = roomObj.users.filter(u => u.username !== username);
    }

    const isDbHost = roomObj.hostUsername && username && roomObj.hostUsername.toLowerCase() === username.toLowerCase();
    const isGuestStr = username === 'Anonymous' || username.toLowerCase().startsWith('guest_');

    if (roomObj.users.length === 0) {
      // Only assign hostId to the first joiner if they are the true host, or if it's a new room and they are not a guest
      if (isDbHost || (!roomObj.hostUsername && !isGuestStr)) {
        roomObj.hostId = targetSocket.id;
        roomObj.hostUsername = username;
      }
      roomObj.currentMedia = null;
      roomObj.currentTime = 0;
      roomObj.isPlaying = false;
      roomObj.timestampUpdatedAt = Date.now();
    } else if (isDbHost) {
      // True host rejoined while others are inside
      roomObj.hostId = targetSocket.id;
    }

    if (roomObj.bannedUsers.has(username)) {
      targetSocket.emit('kicked_out', { reason: 'banned' });
      targetSocket.leave(roomId);
      return;
    }

    targetSocket.join(roomId);
    targetSocket.roomId = roomId;
    targetSocket.username = username;
    registerSocket(username, targetSocket.id);

    // Note: approvedUsers is only populated when host explicitly approves via approve_join.
    // We do NOT auto-approve everyone who joins - that would bypass the lock on re-entry.

    if (!roomObj.users.find(u => u.socketId === targetSocket.id)) {
      // Fetch and cache avatarPath for profile picture display in group chat
      const userEntry = { socketId: targetSocket.id, username, avatarPath: null, isMuted: true };
      roomObj.users.push(userEntry);
      if (username && username !== 'Anonymous') {
        db.get('SELECT "avatarPath", "publicKey", "notifyJoinRequests", country, "showCountry" FROM users WHERE username = ?', [username], (err, row) => {
          if (err) { console.error('[join] db.get error for', username, err.message); }
          if (!err && row) {
            if (row.avatarPath) userEntry.avatarPath = row.avatarPath;
            if (row.publicKey) userEntry.publicKey = row.publicKey;
            if (row.notifyJoinRequests !== undefined) {
              userEntry.notifyJoinRequests = (row.notifyJoinRequests === 1 || row.notifyJoinRequests === true);
            } else {
              userEntry.notifyJoinRequests = true;
            }
            userEntry.country = row.country || null;
            userEntry.countryCode = row.country_code || COUNTRY_TO_CODE[row.country] || null;
            // null = never set → default to showing (opt-out model); 0/false = explicitly hidden
            userEntry.showCountry = !(row.showCountry === 0 || row.showCountry === false || row.showCountry === '0');
            // Broadcast updated user list so all clients see the avatar, E2EE key, and country flag
            io.in(roomId).emit('user_list', { users: buildUserList(roomObj), hostId: roomObj.hostId });
          }
        });
      }
    }

    // If newMembersAdmins is on and user is a registered member (not guest/anonymous), notify them they have admin rights
    const isAutoAdmin = roomObj.settings?.newMembersAdmins && !isGuestStr;
    const isRoomHost = (roomObj.hostId === targetSocket.id) || isDbHost;
    if (isAutoAdmin && !isRoomHost) {
      targetSocket.emit('you_are_now_admin');
    }

    // Emit initial state
    const state = getSerializableRoom(roomObj);
    if (state.isPlaying) state.currentTime += (Date.now() - state.timestampUpdatedAt) / 1000;
    
    console.log(`[JOIN_FLOW] Emitting room_state and user_joined for ${username} in ${roomId}`);
    targetSocket.emit('room_state', state);
    targetSocket.broadcast.to(roomId).emit('user_joined', { 
      socketId: targetSocket.id, 
      username, 
      isMuted: true, 
      isHost: roomObj.hostId === targetSocket.id, 
      publicKey: null,
      avatarPath: roomObj.users.find(u => u.socketId === targetSocket.id)?.avatarPath || null
    });

    // Save to DB
    if (username !== 'Anonymous') {
      db.run(
        'INSERT INTO room_names (roomId, roomName, hostUsername) VALUES (?, ?, ?) ON CONFLICT(roomId) DO UPDATE SET hostUsername = excluded.hostUsername WHERE room_names.hostUsername IS NULL',
        [roomId, 'Room Chat', username]
      );
    }

    const joinTs = await getOrInitFirstJoined(username, roomId);

    let queryStr = `
      SELECT * FROM (
        SELECT m.id, m.type, m."senderId", m."senderName",
               m.message, m.nonce, m."ephemeralPublicKey",
               m.timestamp, m."replyTo", m."hiddenFor", m.reactions,
               m."mediaType", m."mediaUrl", m.media_expires_at, m.is_unsent,
               m.media_file_name, m.media_file_size, m.media_duration,
               m.sender_public_key,
               u."avatarPath" as "senderAvatarPath"
        FROM messages m
        LEFT JOIN users u ON u.username = m."senderName"
        WHERE m."roomId" = $1 AND (m.type = 'room' OR m.type = 'group')
    `;
    const queryParams = [roomId];
    if (joinTs) {
      queryStr += ` AND m.timestamp >= $2 `;
      queryParams.push(joinTs);
    }
    queryStr += `
        ORDER BY m.timestamp DESC LIMIT 100
      ) sub
      ORDER BY sub.timestamp ASC
    `;

    pool.query(queryStr, queryParams, async (err, pgRes) => {
      const groupRows = pgRes ? pgRes.rows : null;
      console.log('[executeFinalJoin] groupRows count for', roomId, 'is', groupRows ? groupRows.length : 0, 'error:', err ? err.message : null);
      if (!err && groupRows && groupRows.length > 0) {
        // 1. Build username→publicKey from currently-connected sockets (fast, in-memory)
        const usernameToPublicKey = {};
        if (roomObj.publicKeys) {
          for (const [sid, pk] of Object.entries(roomObj.publicKeys)) {
            const userObj = roomObj.users.find(u => u.socketId === sid);
            if (userObj && pk) usernameToPublicKey[userObj.username.toLowerCase()] = pk;
          }
        }

        // 2. PostgreSQL fallback: for senders NOT currently connected, fetch publicKey from DB
        const missingUsers = [...new Set(
          groupRows
            .filter(r => r.nonce && r.ephemeralPublicKey && !usernameToPublicKey[(r.senderName || '').toLowerCase()])
            .map(r => (r.senderName || '').toLowerCase())
            .filter(Boolean)
        )];
        if (missingUsers.length > 0) {
          try {
            const pgResult = await pool.query(
              `SELECT LOWER(username) as username, "publicKey" FROM users WHERE LOWER(username) = ANY($1)`,
              [missingUsers]
            );
            for (const row of pgResult.rows) {
              if (row.username && row.publicKey) usernameToPublicKey[row.username] = row.publicKey;
            }
          } catch(pgErr) { console.warn('[chat_history] PG publicKey fallback failed:', pgErr.message); }
        }

        console.log('[DEBUG_HISTORY] executeFinalJoin database query callback:', {
          username,
          roomId,
          groupRowsCount: groupRows.length,
        });

        // Filter out messages hidden for this user (soft-delete / clear chat)
        const visibleGroupRows = groupRows.filter(r => {
          const isHidden = !!(r.hiddenFor && r.hiddenFor.includes(`"${username}"`));
          if (isHidden) {
            // Log a sample filtered message
            console.log('[DEBUG_HISTORY] Filtering out message:', { id: r.id, sender: r.senderName, hiddenFor: r.hiddenFor });
          }
          return !isHidden;
        });

        console.log('[DEBUG_HISTORY] filtered visibleGroupRows:', {
          username,
          visibleGroupRowsCount: visibleGroupRows.length,
          allHiddenFor: groupRows.map(r => ({ id: r.id, hiddenFor: r.hiddenFor, typeOfHiddenFor: typeof r.hiddenFor }))
        });

        // Fetch seen records for visible messages
        const messageIds = visibleGroupRows.map(r => Number(r.id)).filter(Boolean);
        const seenMap = {};
        if (messageIds.length > 0) {
          try {
            const seenResult = await pool.query(`
              SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as "avatarPath"
              FROM message_seen ms
              LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
              WHERE ms.message_id = ANY($1::bigint[])
            `, [messageIds]);
            seenResult.rows.forEach(r => {
              const msgId = String(r.message_id);
              if (!seenMap[msgId]) seenMap[msgId] = [];
              seenMap[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatarPath });
            });
          } catch (seenErr) {
            console.error('[chat_history] Failed to fetch seen records:', seenErr.message);
          }
        }

        const history = visibleGroupRows.map(r => ({
          id: r.id.toString(), userId: r.senderId, username: r.senderName, message: r.message,
          timestamp: r.timestamp,
          senderAvatar: r.senderAvatarPath || null,
          seenBy: seenMap[r.id.toString()] || [],
          reactions: (() => { try { return r.reactions ? JSON.parse(r.reactions) : {}; } catch{ return {}; } })(),
          e2ee: (() => {
            if (!r.nonce || !r.ephemeralPublicKey) return null;
            try {
              const keysMap = JSON.parse(r.ephemeralPublicKey);
              if (typeof keysMap !== 'object' || Array.isArray(keysMap)) throw new Error('not a keys map');
              const senderPK = r.sender_public_key || usernameToPublicKey[(r.senderName || '').toLowerCase()] || null;
              return { nonce: r.nonce, keys: keysMap, senderPublicKey: senderPK };
            } catch(e) {
               return null;
            }
          })(),
          mediaUrl: r.mediaUrl || null,
          mediaType: r.mediaType || null,
          mediaFileName: r.media_file_name || null,
          mediaFileSize: r.media_file_size || null,
          mediaExpiresAt: r.media_expires_at || null,
          mediaDuration: r.media_duration || null,
          replyTo: r.replyTo ? (() => { try { return JSON.parse(r.replyTo); } catch { return null; } })() : null
        }));
        // Merge any in-memory messages not yet reflected in DB
        // (covers the window between push() and INSERT commit, or INSERT failures)
        // Use ALL DB row IDs (not just visible ones) so soft-hidden messages don't
        // reappear through the in-memory path after a "clear for me" operation.
        const allDbIds = new Set(groupRows.map(r => String(r.id)));
        const inMemExtra = (roomObj.groupMessages || []).filter(m => {
          if (!m || !m.id) return false;
          if (allDbIds.has(String(m.id))) return false;
          if (m.dbId && allDbIds.has(String(m.dbId))) return false;
          return true;
        });
        const merged = [...history, ...inMemExtra].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)).slice(-200);
        console.log(`[executeFinalJoin] history: ${history.length} DB rows + ${inMemExtra.length} in-memory extra → ${merged.length} total for ${username}`);
        const filteredMerged = joinTs ? merged.filter(m => Number(m.timestamp) >= joinTs) : merged;
        targetSocket.emit('chat_history', filteredMerged);
        roomObj.groupMessages = merged;
      } else {
        console.log(`[executeFinalJoin] 0 DB rows for ${roomId}, falling back to ${(roomObj.groupMessages||[]).length} in-memory messages`);
        const fallbackHistory = (roomObj.groupMessages || []).slice(-200);
        const filteredFallback = joinTs ? fallbackHistory.filter(m => Number(m.timestamp) >= joinTs) : fallbackHistory;
        targetSocket.emit('chat_history', filteredFallback);
      }
    });

    db.all(`
      SELECT m.*, u.avatarPath as senderAvatarPath
      FROM messages m
      LEFT JOIN users u ON LOWER(u.username) = LOWER(m.senderName)
      WHERE m.type = 'private' AND (LOWER(m.senderName) = LOWER(?) OR LOWER(m.targetName) = LOWER(?))
      ORDER BY m.timestamp ASC
    `, [username, username], async (err, dmRows) => {
        console.log('🔥🔥🔥 [DM HISTORY FROM SQLITE — executeFinalJoin] 🔥🔥🔥', { username, totalRowsFromSQLite: dmRows?.length || 0 });
        if (!err && dmRows && dmRows.length > 0) {
          const visibleDmRows = dmRows.filter(row => {
            if (!row.hiddenFor) return true;
            const hStr = typeof row.hiddenFor === 'string' ? row.hiddenFor : JSON.stringify(row.hiddenFor);
            return !hStr.includes(`"${username}"`);
          });
          const messageIds = visibleDmRows.map(r => Number(r.id)).filter(Boolean);
          const seenMap = {};
          if (messageIds.length > 0) {
            try {
              const seenResult = await pool.query(`
                SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as "avatarPath"
                FROM message_seen ms
                LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
                WHERE ms.message_id = ANY($1::bigint[])
              `, [messageIds]);
              seenResult.rows.forEach(r => {
                const msgId = String(r.message_id);
                if (!seenMap[msgId]) seenMap[msgId] = [];
                seenMap[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatarPath });
              });
            } catch (seenErr) {
              console.error('[chat_history_dm] Failed to fetch seen records:', seenErr.message);
            }
          }

          const dmHistory = {};
          visibleDmRows.forEach(row => {
            const isMe = (row.senderName || '').toLowerCase() === (username || '').toLowerCase();
            const otherName = isMe ? row.targetName : row.senderName;
            if (!dmHistory[otherName]) dmHistory[otherName] = [];
            dmHistory[otherName].push({
              id: row.id.toString(),
              isMe,
              senderId: row.senderId,
              senderName: row.senderName,
              senderAvatar: row.senderAvatarPath || null,
              targetId: row.targetId,
              targetName: row.targetName,
              message: row.message,
              senderMessage: row.senderMessage || null,
              nonce: row.nonce,
              ephemeralPublicKey: row.ephemeralPublicKey,
              timestamp: row.timestamp,
              mediaUrl: row.mediaUrl || null,
              mediaType: row.mediaType || null,
              mediaFileName: row.media_file_name || null,
              mediaFileSize: row.media_file_size || null,
              mediaExpiresAt: row.media_expires_at || null,
              mediaDuration: row.media_duration || null,
              reactions: (() => { try { return row.reactions ? JSON.parse(row.reactions) : {}; } catch { return {}; } })(),
              replyTo: row.replyTo ? (() => { try { return JSON.parse(row.replyTo); } catch { return null; } })() : null,
              seenBy: seenMap[row.id.toString()] || []
            });
          });
          targetSocket.emit('chat_history_dm', dmHistory);
        }
      });

    if (roomObj.screenshareHostId) targetSocket.emit('webrtc_screenshare_started', { socketId: roomObj.screenshareHostId, app: roomObj.activeExternalApp });

    // CRITICAL: Notify everyone in the room about the new participant
    io.in(roomId).emit('user_list', { users: buildUserList(roomObj), hostId: roomObj.hostId });

    // ─── Resync Pending Joins to Host/Admin on Reconnect ───
    if (roomObj.pendingJoins && roomObj.pendingJoins.size > 0) {
      const isAutoAdmin = roomObj.settings?.newMembersAdmins && !isGuestStr;
      const isRoomHost = (roomObj.hostId === targetSocket.id) || isDbHost;
      if (isRoomHost || isAutoAdmin) {
        roomObj.pendingJoins.forEach((pendingUser, pendingSocketId) => {
          if (pendingSocketId === targetSocket.id) return; // Don't notify the user about their own request
          db.get('SELECT "avatarPath" FROM users WHERE LOWER(username) = LOWER(?)', [pendingUser.username], (err, row) => {
            const avatarPath = (row && row.avatarPath) ? row.avatarPath : null;
            targetSocket.emit('join_requested', { socketId: pendingSocketId, username: pendingUser.username, avatarPath });
          });
        });
      }
    }
  }

  // ─── Join Room ───
  socket.on('join_room', (data) => {
    let roomId = typeof data === 'string' ? data : data.roomId;
    if (roomId) roomId = roomId.toLowerCase();
    // Prioritize authenticated username from token, fallback to provided, then Anonymous
    const username = socket.username || (typeof data === 'string' ? 'Anonymous' : (data.username || 'Anonymous'));
    
    // FAST TRACK: If room is already in memory, perform the Guest Block check INSTANTLY.
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const isGuestOrLocal = username === 'Anonymous' || username.toLowerCase().startsWith('guest_');
      const isActuallyHost = (room.hostUsername && room.hostUsername.toLowerCase() === username.toLowerCase());
      
      if (room.settings?.onlyLoggedIn && isGuestOrLocal && !isActuallyHost) {
        console.log(`[Security] Fast-tracking rejection for ${username} in Members Only room ${roomId}`);
        socket.emit('join_rejected', { reason: 'members_only' });
        return;
      }
    }

    // DO NOT socket.join(roomId) here! This is the fix for ghost notifications.
    // Wait until security checks pass in executeFinalJoin.
    
    console.log(`User ${socket.id} (${username}) requesting join to room ${roomId}`);
    // ─── Database Existence Check ───
    // Block joins for rooms currently being deleted (prevents race-condition re-creation)
    if (deletingRooms.has(roomId)) {
      socket.emit('room_not_found');
      return;
    }
    db.get('SELECT roomId FROM room_names WHERE roomId = ?', [roomId], (err, row) => {
      const existsInDb = !!row;
      const existsInMemory = rooms.has(roomId);

      if (deletingRooms.has(roomId) || (!existsInDb && !existsInMemory)) {
        console.log(`Join Room Failed: Room ${roomId} not found in DB or Memory.`);
        socket.emit('room_not_found');
        return;
      }

      if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        currentMedia: null, currentTime: 0, isPlaying: false,
        timestampUpdatedAt: Date.now(), screenshareHostId: null,
        hostId: null, // Will be set when true host joins
        hostUsername: null, // Trust the database
        users: [],
        pendingJoins: new Map(), // socketId -> { username, socket }
        approvedSockets: new Set(), // socketId -> approved
        mutedUsers: new Set(), bannedUsers: new Set(),
        admins: new Set(), deniedAdmins: new Set(),
        groupMessages: [], publicKeys: {},
        roomName: 'Room Chat',
        category: 'other',
        isPublic: false,
        thumbnailPath: null,
        permissions: { 
          changeMedia: 'all', chat: 'all', cam: 'all', mic: 'all',
          allowLinks: true, allowMedia: true 
        },
        settings: { 
          audioDucking: false, webcamSync: true, playerCustomName: 'WatchTogether Player',
          lockRoom: false, onlyLoggedIn: false, newMembersAdmins: false,
          allUsersPlayerSettings: true,
          ...JSON.parse(row.settings || '{}')
        }
      });
    }
    const room = rooms.get(roomId);

    // Ensure metadata and bans are loaded before proceeding
    const loadMetadata = new Promise(resolve => {
      db.get('SELECT * FROM room_names WHERE roomId = ?', [roomId], (err, row) => {
        if (!err && row) {
          if (row.roomName && row.roomName !== 'Room Chat') room.roomName = row.roomName;
          if (row.isPublic !== undefined && row.isPublic !== null) room.isPublic = !!row.isPublic;
          if (row.hostUsername) room.hostUsername = row.hostUsername;
          if (row.category) room.category = row.category;
          if (row.thumbnailPath) room.thumbnailPath = row.thumbnailPath;
          try { if (row.permissions) room.permissions = JSON.parse(row.permissions); } catch (e) { }
          try { if (row.settings) room.settings = JSON.parse(row.settings); } catch (e) { }
          if (row.last_media_url) room.lastMediaUrl = row.last_media_url;
          if (row.last_media_position != null) room.lastMediaPosition = parseFloat(row.last_media_position) || 0;
          if (row.last_media_type) room.lastMediaType = row.last_media_type;
          if (row.last_media_saved_at) room.lastMediaSavedAt = row.last_media_saved_at;
          if (row.room_theme) room.roomTheme = row.room_theme;
        }
        resolve();
      });
    });

    const loadBans = new Promise(resolve => {
      db.all('SELECT username FROM room_bans WHERE roomId = ?', [roomId], (err, rows) => {
        if (!err && rows) {
          rows.forEach(r => room.bannedUsers.add(r.username));
        }
        resolve();
      });
    });

    Promise.all([loadMetadata, loadBans]).then(() => {
      const isGuestOrLocal = username === 'Anonymous' || username.toLowerCase().startsWith('guest_');
      const isActuallyHost = (room.hostId === socket.id) || (room.hostUsername && room.hostUsername.toLowerCase() === username.toLowerCase());

      console.log(`[JOIN_TRACE] Security check for ${username}: isActuallyHost=${isActuallyHost}, lockRoom=${room.settings.lockRoom}`);
      if (!isActuallyHost) {
        if (room.settings.onlyLoggedIn && isGuestOrLocal) {
          console.log(`[JOIN_TRACE] Rejected: Members Only`);
          socket.emit('join_rejected', { reason: 'members_only' });
          return;
        }

        if (room.settings.lockRoom) {
          const isApproved = (room.approvedUsers && username && username !== 'Anonymous' && room.approvedUsers.has(username.toLowerCase()))
                          || room.approvedSockets?.has(socket.id);
          
          console.log(`[JOIN_TRACE] Lock check for ${username}: isApproved=${isApproved}`);
          
          if (!isApproved) {
            console.log(`[JOIN_TRACE] Sent waiting_for_approval to ${username}`);
            room.pendingJoins.set(socket.id, { username, socket });
            socket.emit('waiting_for_approval');

            // Notify host/admins
            db.get('SELECT "avatarPath" FROM users WHERE LOWER(username) = LOWER(?)', [username], (err, row) => {
              const avatarPath = (row && row.avatarPath) ? row.avatarPath : null;
              room.users.forEach(u => {
                const uIsHost = (u.socketId === room.hostId) || (room.hostUsername && u.username && room.hostUsername.toLowerCase() === u.username.toLowerCase());
                const uIsAutoAdmin = room.settings?.newMembersAdmins && u.username && u.username !== 'Anonymous' && !u.username.toLowerCase().startsWith('guest_');
                if (uIsHost || uIsAutoAdmin) {
                  io.to(u.socketId).emit('join_requested', { socketId: socket.id, username, avatarPath });
                }
              });
            });
            return;
          }
        }
      }

      console.log(`[JOIN_TRACE] Success! Joining ${username} to ${roomId}`);
      executeFinalJoin(socket, room, roomId, username);
    });
  });
});

  // ─── Public key exchange for E2E DMs ───
  socket.on('chat:publicKey', ({ roomId, publicKey }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.publicKeys[socket.id] = publicKey;
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });

    // Persist the public key to the database so HTTP /api/auth/public-key/:username works
    if (socket.username && publicKey) {
      if (socket.username.toLowerCase().startsWith('guest_')) {
        pool.query(
          'INSERT INTO users (username, "publicKey", "isVerified") VALUES ($1, $2, 1) ON CONFLICT (username) DO UPDATE SET "publicKey" = EXCLUDED."publicKey"',
          [socket.username, publicKey]
        ).catch(err => console.error('[chat:publicKey] Failed to upsert guest to DB:', err));
      } else {
        pool.query('UPDATE users SET "publicKey" = $1 WHERE LOWER(username) = $2', [publicKey, socket.username.toLowerCase()])
          .catch(err => console.error('[chat:publicKey] Failed to persist key to DB:', err));
      }
    }
  });
 
  // ─── Scoped Chat History Pagination via Sockets ───
  socket.on('chat:request_history', async ({ type, roomId: rawRoomId, partner: rawPartner, before, limit }) => {
    const username = socket.username;
    if (!username) return;

    const cleanLimit = parseInt(limit, 10) || 200;
    const cleanBefore = before ? parseInt(before, 10) : null;
    
    if (type === 'private' || (!type && rawPartner)) {
      const partner = rawPartner;
      if (!partner) return;

      let queryStr = `
        SELECT m.id, m.type, m."senderId", m."senderName",
               m."targetId", m."targetName",
               m.message, m.nonce, m."ephemeralPublicKey",
               m.timestamp, m."replyTo", m.reactions, m."senderMessage",
               m."mediaType", m."mediaUrl", m.media_expires_at, m.is_unsent,
               m.media_file_name, m.media_file_size, m.media_duration,
               m.sender_public_key,
               u."avatarPath" as "senderAvatarPath", u."publicKey" as "senderPublicKey"
        FROM messages m
        LEFT JOIN users u ON LOWER(u.username) = LOWER(m."senderName")
        WHERE m.type = 'private'
          AND ((LOWER(m."senderName") = LOWER($1) AND LOWER(m."targetName") = LOWER($2))
            OR (LOWER(m."senderName") = LOWER($3) AND LOWER(m."targetName") = LOWER($4)))
          AND (m.is_unsent IS NULL OR m.is_unsent = FALSE)
      `;
      const queryParams = [username, partner, partner, username];
      if (cleanBefore) {
        queryStr += ` AND m.timestamp < $5 `;
        queryParams.push(cleanBefore);
      }
      queryStr += ` ORDER BY m.timestamp DESC LIMIT $${queryParams.length + 1} `;
      queryParams.push(cleanLimit);

      try {
        const pgRes = await pool.query(queryStr, queryParams);
        const rows = pgRes ? pgRes.rows : [];
        rows.reverse(); // chronological

        const messageIds = rows.map(r => Number(r.id)).filter(Boolean);
        const seenMap = {};
        if (messageIds.length > 0) {
          try {
            const seenResult = await pool.query(`
              SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as "avatarPath"
              FROM message_seen ms
              LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
              WHERE ms.message_id = ANY($1::bigint[])
            `, [messageIds]);
            seenResult.rows.forEach(r => {
              const msgId = String(r.message_id);
              if (!seenMap[msgId]) seenMap[msgId] = [];
              seenMap[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatarPath });
            });
          } catch (seenErr) {
            console.error('[chat:request_history private] Failed to fetch seen records:', seenErr.message);
          }
        }

        const history = rows.map(row => {
          const isMe = (row.senderName || '').toLowerCase() === (username || '').toLowerCase();
          return {
            id: row.id.toString(),
            isMe,
            senderId: row.senderId,
            senderName: row.senderName,
            senderAvatar: row.senderAvatarPath || null,
            targetId: row.targetId,
            targetName: row.targetName,
            message: row.message,
            senderMessage: row.senderMessage || null,
            nonce: row.nonce,
            ephemeralPublicKey: row.ephemeralPublicKey,
            timestamp: row.timestamp,
            mediaUrl: row.mediaUrl || null,
            mediaType: row.mediaType || null,
            mediaFileName: row.media_file_name || null,
            mediaFileSize: row.media_file_size || null,
            mediaExpiresAt: row.media_expires_at || null,
            mediaDuration: row.media_duration || null,
            reactions: row.reactions ? JSON.parse(row.reactions) : {},
            replyTo: row.replyTo ? JSON.parse(row.replyTo) : null,
            seenBy: seenMap[row.id.toString()] || []
          };
        });

        socket.emit('chat_history_more_dm', { partner, messages: history, before });
      } catch (err) {
        console.error('[chat:request_history private] error:', err);
      }
    } else {
      const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
      if (!roomId) return;

      const joinTs = await getOrInitFirstJoined(username, roomId);
      let queryStr = `
        SELECT m.id, m.type, m."senderId", m."senderName",
               m.message, m.nonce, m."ephemeralPublicKey",
               m.timestamp, m."replyTo", m.reactions,
               m."mediaType", m."mediaUrl", m.media_expires_at,
               m.media_file_name, m.media_file_size, m.media_duration,
               m.sender_public_key,
               u."avatarPath" as "senderAvatarPath", u."publicKey" as "senderPublicKey"
        FROM messages m
        LEFT JOIN users u ON u.username = m."senderName"
        WHERE m."roomId" = $1 AND (m.type = 'room' OR m.type = 'group')
          AND (m."hiddenFor" IS NULL OR m."hiddenFor" NOT LIKE $2)
          AND (m.is_unsent IS NULL OR m.is_unsent = FALSE)
      `;
      const queryParams = [roomId, `%"${username}"%`];
      if (joinTs) {
        queryStr += ` AND m.timestamp >= $3 `;
        queryParams.push(joinTs);
      }
      if (cleanBefore) {
        queryStr += ` AND m.timestamp < $${queryParams.length + 1} `;
        queryParams.push(cleanBefore);
      }
      queryStr += ` ORDER BY m.timestamp DESC LIMIT $${queryParams.length + 1} `;
      queryParams.push(cleanLimit);

      try {
        const pgRes = await pool.query(queryStr, queryParams);
        const groupRows = pgRes ? pgRes.rows : [];
        groupRows.reverse(); // chronological

        const usernameToPublicKey = {};
        const roomObj = rooms.get(roomId);
        if (roomObj && roomObj.publicKeys) {
          for (const [sid, pk] of Object.entries(roomObj.publicKeys)) {
            const userObj = roomObj.users.find(u => u.socketId === sid);
            if (userObj && pk) usernameToPublicKey[userObj.username.toLowerCase()] = pk;
          }
        }
        const missingUsers = [...new Set(
          groupRows
            .filter(r => r.nonce && r.ephemeralPublicKey && !usernameToPublicKey[(r.senderName || '').toLowerCase()])
            .map(r => (r.senderName || '').toLowerCase())
            .filter(Boolean)
        )];
        if (missingUsers.length > 0) {
          try {
            const pgResult = await pool.query(
              `SELECT LOWER(username) as username, "publicKey" FROM users WHERE LOWER(username) = ANY($1)`,
              [missingUsers]
            );
            for (const row of pgResult.rows) {
              if (row.username && row.publicKey) usernameToPublicKey[row.username] = row.publicKey;
            }
          } catch(pgErr) { console.warn('[chat_history_more] PG publicKey fallback failed:', pgErr.message); }
        }

        const messageIds = groupRows.map(r => Number(r.id)).filter(Boolean);
        const seenMap = {};
        if (messageIds.length > 0) {
          try {
            const seenResult = await pool.query(`
              SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as "avatarPath"
              FROM message_seen ms
              LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
              WHERE ms.message_id = ANY($1::bigint[])
            `, [messageIds]);
            seenResult.rows.forEach(r => {
              const msgId = String(r.message_id);
              if (!seenMap[msgId]) seenMap[msgId] = [];
              seenMap[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatarPath });
            });
          } catch (seenErr) {
            console.error('[chat_history_more] Failed to fetch seen records:', seenErr.message);
          }
        }

        const history = groupRows.map(r => ({
          id: r.id.toString(), userId: r.senderId, username: r.senderName, message: r.message,
          timestamp: r.timestamp,
          senderAvatar: r.senderAvatarPath || null,
          seenBy: seenMap[r.id.toString()] || [],
          reactions: (() => { try { return r.reactions ? JSON.parse(r.reactions) : {}; } catch{ return {}; } })(),
          e2ee: (() => {
            if (!r.nonce || !r.ephemeralPublicKey) return null;
            try {
              const keysMap = JSON.parse(r.ephemeralPublicKey);
              if (typeof keysMap !== 'object' || Array.isArray(keysMap)) throw new Error('not a keys map');
              const senderPK = r.sender_public_key || usernameToPublicKey[(r.senderName || '').toLowerCase()] || null;
              return { nonce: r.nonce, keys: keysMap, senderPublicKey: senderPK };
            } catch(e) {
               return null;
            }
          })(),
          mediaUrl: r.mediaUrl || null,
          mediaType: r.mediaType || null,
          mediaFileName: r.media_file_name || null,
          mediaFileSize: r.media_file_size || null,
          mediaExpiresAt: r.media_expires_at || null,
          mediaDuration: r.media_duration || null,
          replyTo: r.replyTo ? (() => { try { return JSON.parse(r.replyTo); } catch { return null; } })() : null
        }));

        socket.emit('chat_history_more', { roomId, messages: history, before });
      } catch (err) {
        console.error('[chat:request_history] error:', err);
      }
    }
  });


  // ─── Group chat message (saved in history) ───
  socket.on('chat_message', ({ roomId: rawRoomId, message, plaintextMessage, e2ee, username, replyTo, mediaUrl, mediaType, mediaFileName, mediaFileSize, mediaDuration, tempId }) => {
    if (!checkChatRate(socket.id)) {
      socket.emit('error_notification', 'You are sending messages too fast. Please slow down.');
      return;
    }
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`[Chat] Room not found in memory: ${roomId} (Original: ${rawRoomId})`);
      return;
    }
    console.log(`[Chat] ${username} → ${roomId} (${mediaUrl ? 'media' : 'text'})`);
    
    // Check Permissions
    const allowChat = room.permissions?.chat || 'all';
    const actualUsername = username || socket.username;
    // isUserAdmin robustly checks for BOTH host (by socketId and case-insensitive username) AND admins.
    const isRoomAdminOrHost = isUserAdmin(room, { id: socket.id, username: actualUsername });
    if (allowChat === 'host' && !isRoomAdminOrHost) {
      socket.emit('error_notification', 'Only the host can send messages in this room.');
      return;
    }

    if (room.mutedUsers.has(socket.id)) { socket.emit('you_are_muted'); return; }

    let safeMessage = message || '';
    safeMessage = truncateToWordLimit(safeMessage, 250);
    
    // â"€â"€ Content Filtering â"€â"€
    if (room.permissions && room.permissions.allowLinks === false && !isRoomAdminOrHost) {
       // Match http/https links AND bare domains like google.com, website.in, etc.
       const urlRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)/g;
       if (urlRegex.test(safeMessage)) {
          socket.emit('error_notification', 'Sharing links is disabled in this room.');
          return;
       }
    }
    
    if (room.permissions && room.permissions.allowMedia === false && !isRoomAdminOrHost) {
       if (mediaUrl || safeMessage.includes('data:image/') || safeMessage.includes('uploads/') || safeMessage.includes('/api/files/') || safeMessage.includes('/api/stream/')) {
          socket.emit('error_notification', 'Sharing media is disabled in this room.');
          return;
       }
    }

    const ts = Date.now();
    const msg = {
      id: `${socket.id}-${ts}`,
      userId: socket.id,
      username,
      message: safeMessage,
      timestamp: ts,
      reactions: {},
      replyTo: replyTo || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      mediaFileName: mediaFileName || null,
      mediaFileSize: mediaFileSize || null,
      mediaDuration: mediaDuration ? Number(mediaDuration) : null,
      tempId: tempId || null,
      type: 'group',
      roomId: roomId,
      e2ee: e2ee || null
    };
    room.groupMessages.push(msg);
    if (room.groupMessages.length > 200) room.groupMessages.shift();
    
    // Save to DB — use pool.query directly to bypass _convertSql and avoid any quoting issues
    const nonceText = e2ee ? e2ee.nonce : null;
    const ephemText = e2ee && e2ee.keys ? JSON.stringify(e2ee.keys) : null;

    const groupSocketExpiry = msg.mediaUrl ? computeMediaExpiry(msg.mediaType) : null;
    msg.mediaExpiresAt = groupSocketExpiry ? groupSocketExpiry.toISOString() : null;
    const senderPubKeyText = e2ee?.senderPublicKey || null;

    console.log('[Chat INSERT] Saving group message for', username, 'in room', roomId, '| e2ee:', !!e2ee, '| mediaUrl:', !!msg.mediaUrl);
    pool.query(
      `INSERT INTO messages (
        "roomId", type, "senderId", "senderName", message, timestamp,
        "replyTo", "mediaUrl", "mediaType", nonce, "ephemeralPublicKey",
        media_file_name, media_file_size, media_expires_at, media_duration, sender_public_key
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        roomId, 'group', socket.id, username, safeMessage, msg.timestamp,
        replyTo ? JSON.stringify(replyTo) : null,
        msg.mediaUrl, msg.mediaType, nonceText, ephemText,
        mediaFileName || null, mediaFileSize || null,
        groupSocketExpiry ? groupSocketExpiry.toISOString() : null,
        mediaDuration ? Number(mediaDuration) : null,
        senderPubKeyText
      ]
    ).then(res => {
        const dbId = res.rows?.[0]?.id;
        console.log('[Chat INSERT] Success for', username, '→ dbId:', dbId);
        if (dbId) {
          msg.id = String(dbId);
          msg.dbId = String(dbId);
          msg.seenBy = [{ username, seenAt: msg.timestamp }];
          pool.query('INSERT INTO message_seen (message_id, room_id, username, seen_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [dbId, roomId, username, msg.timestamp])
            .catch(e => console.error('[send_message] message_seen error:', e.message));
          if (tempId) socket.emit('chat:message_persisted', { tempId, dbId: String(dbId) });
        } else {
          msg.seenBy = [];
        }
        broadcastMessage(roomId, msg, socket.id, username);
      }).catch(err => {
        console.error('[Chat INSERT] FAILED for', username, 'in room', roomId, ':', err.message);
        // Still broadcast so UI stays consistent — message is in room.groupMessages (in-memory)
        // and will appear in history on refresh via the in-memory merge in executeFinalJoin
        msg.seenBy = [];
        broadcastMessage(roomId, msg, socket.id, username);
      });
  });

  // ─── Standardized Mark Read ───
  socket.on('chat:mark_read', async ({ chatId, timestamp, isDm }) => {
    console.log(`[DEBUG chat:mark_read] Called by socket.username=${socket.username}, socket.id=${socket.id} with chatId=${chatId}, timestamp=${timestamp}, isDm=${isDm}`);
    if (!socket.username || !chatId) {
      console.warn(`[DEBUG chat:mark_read] early return due to missing username or chatId`);
      return;
    }
    const now = timestamp || Date.now();
    
    // 1. Get the actual roomId used in messages table
    const targetRoomId = await getRoomIdForChat(chatId, socket.username, isDm);
    console.log(`[DEBUG chat:mark_read] resolved targetRoomId=${targetRoomId}`);
    
    // 2. Persist lastSeen to users table (existing logic)
    db.get('SELECT lastSeen FROM users WHERE username = ?', [socket.username], (err, row) => {
      if (err) console.error(`[DEBUG chat:mark_read] users lastSeen select error:`, err);
      let ls = {};
      try { ls = JSON.parse(row?.lastSeen || '{}'); } catch(e){}
      ls[chatId] = now;
      console.log(`[DEBUG chat:mark_read] updating lastSeen for ${socket.username} to ${JSON.stringify(ls)}`);
      db.run('UPDATE users SET lastSeen = ? WHERE username = ?', [JSON.stringify(ls), socket.username]);
      
      // Broadcast to other sockets of the same user to sync unread badges across tabs
      emitToUser(socket.username, 'chat:mark_read', { chatId, timestamp: now });
    });

    // 3. Mark messages as seen in message_seen table
    const queryStr = `
      INSERT INTO message_seen (message_id, room_id, username, seen_at)
      SELECT id, "roomId", $1::varchar, $2::bigint
      FROM messages
      WHERE "roomId" = $3::varchar
        AND LOWER("senderName") != LOWER($1::varchar)
        AND timestamp <= $2::bigint
        AND ("is_unsent" IS NULL OR "is_unsent" = FALSE)
      ON CONFLICT (message_id, username) DO NOTHING
      RETURNING message_id;
    `;
    
    db.get('SELECT "avatarPath" FROM users WHERE username = ?', [socket.username], (err, userRow) => {
      const userAvatar = userRow ? userRow.avatarPath : null;
      console.log(`[DEBUG chat:mark_read] userAvatar=${userAvatar} for ${socket.username}`);
      
      pool.query(queryStr, [socket.username, now, targetRoomId])
        .then(res => {
          const messageIds = res.rows.map(r => String(r.message_id));
          console.log(`[DEBUG chat:mark_read] query completed. messageIds marked seen:`, messageIds);
          if (messageIds.length > 0) {
            const isDm = targetRoomId.startsWith('dm-');
            const payload = {
              roomId: targetRoomId,
              chatId,
              username: socket.username,
              messageIds,
              seenAt: now,
              avatar: userAvatar
            };
            
            if (isDm) {
              console.log(`[DEBUG chat:mark_read] emitting chat:messages_seen to ${socket.username} and ${chatId}`);
              emitToUser(socket.username, 'chat:messages_seen', payload);
              emitToUser(chatId, 'chat:messages_seen', payload);
            } else {
              // Update in-memory room cache if it exists
              const roomObj = rooms.get(targetRoomId);
              if (roomObj && roomObj.groupMessages) {
                roomObj.groupMessages = roomObj.groupMessages.map(m => {
                  if (messageIds.includes(String(m.id))) {
                    const seenBy = m.seenBy ? [...m.seenBy] : [];
                    if (!seenBy.some(u => u.username.toLowerCase() === socket.username.toLowerCase())) {
                      seenBy.push({ username: socket.username, seenAt: now, avatar: userAvatar });
                    }
                    return { ...m, seenBy };
                  }
                  return m;
                });
              }
              io.in(targetRoomId).emit('chat:messages_seen', payload);
            }
          }
        })
        .catch(err => {
          console.error('[chat:mark_read] message_seen error:', err.message);
        });
    });
  });

  // Passive room tracking: allows GlobalChatWidget to receive updates for rooms
  // the user has previously participated in without showing up in the user list.
  socket.on('track_rooms', ({ roomIds }) => {
    if (!Array.isArray(roomIds)) return;
    roomIds.forEach(rid => {
      if (!rid) return;
      socket.join(rid.toLowerCase());

      // Immediately send current room permissions back so GlobalChatWidget
      // has the correct initial state without waiting for the next message.
      const room = rooms.get(rid.toLowerCase()) || rooms.get(rid);
      if (room && room.permissions) {
        const isHost = (room.hostUsername && socket.username && room.hostUsername.toLowerCase() === socket.username.toLowerCase()) || isUserAdmin(room, { username: socket.username });
        socket.emit('room_permissions_snapshot', {
          roomId: rid.toLowerCase(),
          permissions: room.permissions,
          isHost: !!isHost,
          admins: Array.from(room.admins || [])
        });
      }
    });
  });

  // ─── Unified Typing Indicators (Supports both Room and Global Widget) ───
  const typingTimers = {}; // { socketId: timer }
  socket.on('chat:typing', ({ partner, type, roomId, isTyping }) => {
    if (!socket.username) return;
    
    // Support Format 1: { partner, type } (Global Chat Widget)
    // Support Format 2: { roomId, isTyping } (Room.jsx)
    const targetRoom = (type === 'room' ? partner : roomId)?.toLowerCase();
    const isDM = type === 'private';
    const isStart = isTyping !== false;

    if (isDM) {
      const payload = { partner: socket.username, username: socket.username, type: 'private', isTyping: isStart };
      emitToUser(partner, 'chat:typing', payload);
      if (!isStart) emitToUser(partner, 'chat:stop_typing', payload);
    } else if (targetRoom) {
      const payload = { partner: targetRoom, username: socket.username, type: 'room', isTyping: isStart };
      socket.to(targetRoom).emit('chat:typing', payload);
      if (!isStart) socket.to(targetRoom).emit('chat:stop_typing', payload);
      
      // Auto-stop typing after 5s for room view (safety)
      if (isStart) {
        if (typingTimers[socket.id]) clearTimeout(typingTimers[socket.id]);
        typingTimers[socket.id] = setTimeout(() => {
          socket.to(targetRoom).emit('chat:typing', { ...payload, isTyping: false });
          socket.to(targetRoom).emit('chat:stop_typing', payload);
        }, 5000);
      }
    }
  });

  socket.on('chat:stop_typing', ({ partner, type, roomId }) => {
    if (!socket.username) return;
    const targetRoom = (type === 'room' ? partner : roomId)?.toLowerCase();
    const isDM = type === 'private';

    if (isDM) {
      const payload = { partner: socket.username, username: socket.username, type: 'private', isTyping: false };
      emitToUser(partner, 'chat:stop_typing', payload);
      emitToUser(partner, 'chat:typing', payload);
    } else if (targetRoom) {
      const payload = { partner: targetRoom, username: socket.username, type: 'room', isTyping: false };
      socket.to(targetRoom).emit('chat:stop_typing', payload);
      socket.to(targetRoom).emit('chat:typing', payload);
      if (typingTimers[socket.id]) clearTimeout(typingTimers[socket.id]);
    }
  });

  socket.on('chat:private_reaction', ({ targetName, messageId, emoji }) => {
    const senderName = socket.username;
    // Send to both sender and recipient for cross-tab sync
    emitToUser(senderName, 'chat:private_reaction', { messageId, senderName, emoji, targetName });
    emitToUser(targetName, 'chat:private_reaction', { messageId, senderName, emoji, targetName });
  });

  // ─── Clear DM ───
  socket.on('clear_dm', async ({ targetUsername, clearForBoth }) => {
    console.log('🔥🔥🔥 [CLEAR CHAT REAL HANDLER HIT] 🔥🔥🔥', new Date().toISOString(), JSON.stringify({ targetUsername, clearForBoth }));
    const sender = socket.username;
    console.log('[CLEAR_DM] triggered', { sender, targetUsername, clearForBoth });
    if (!sender || !targetUsername) {
      console.log('[CLEAR_DM] aborting — missing sender or targetUsername');
      return;
    }

    const payload = { userA: sender, userB: targetUsername, clearedBy: sender, clearForBoth: !!clearForBoth };
    const senderLow = sender.toLowerCase();
    const targetLow = targetUsername.toLowerCase();

    console.log('[CLEAR CHAT] deleteForBoth flag received:', clearForBoth, typeof clearForBoth);

    if (clearForBoth) {
      // ── Hard DELETE: permanently erase for both parties ──
      let pgDeleted = 0;
      try {
        const pgResult = await pool.query(
          `DELETE FROM messages WHERE type = 'private'
           AND ((LOWER("senderName") = $1 AND LOWER("targetName") = $2)
             OR (LOWER("senderName") = $2 AND LOWER("targetName") = $1))`,
          [senderLow, targetLow]
        );
        pgDeleted = pgResult.rowCount || 0;
        console.log('[CLEAR_DM] clearForBoth — PostgreSQL deleted rows:', pgDeleted);
        console.log('🔥🔥🔥 [CLEAR CHAT DB RESULT] 🔥🔥🔥', JSON.stringify({ operation: 'DELETE_PG', rowCount: pgDeleted, sqliteCleared: false }));
      } catch (err) {
        console.error('[CLEAR_DM] clearForBoth — PostgreSQL DELETE failed:', err.message);
      }

      // Also delete from SQLite — DM history is read entirely from SQLite on join/refresh
      await new Promise((resolve) => {
        db.run(
          `DELETE FROM messages WHERE type = 'private' AND (
             (LOWER(senderName) = ? AND LOWER(targetName) = ?) OR
             (LOWER(senderName) = ? AND LOWER(targetName) = ?)
          )`,
          [senderLow, targetLow, targetLow, senderLow],
          (err) => { if (err) console.error('[CLEAR_DM] SQLite DELETE failed:', err); resolve(); }
        );
      });

      // Emit to both participants
      emitToUser(sender, 'dm_cleared', payload);
      emitToUser(targetUsername, 'dm_cleared', payload);
    } else {
      // ── Soft hide: only the requester stops seeing the messages ──
      // Uses the same hiddenFor mechanism as per-message "delete for me".
      // The other participant's view is completely unaffected.
      // Explicit ::text casts make this work whether hiddenFor is TEXT or JSONB.
      let pgUpdated = 0;
      try {
        // Diagnostic: count rows BEFORE the update
        const beforeCount = await pool.query(
          `SELECT COUNT(*) AS c FROM messages
           WHERE type = 'private'
             AND ((LOWER("senderName") = $1 AND LOWER("targetName") = $2)
               OR (LOWER("senderName") = $2 AND LOWER("targetName") = $1))
             AND ("hiddenFor" IS NULL OR NOT ("hiddenFor"::jsonb @> jsonb_build_array($3::text)))`,
          [senderLow, targetLow, sender]
        ).catch(() => ({ rows: [{ c: '?' }] }));
        console.log('[CLEAR CHAT] Operation scope:', {
          conversationKey: `${sender}<->${targetUsername}`,
          messageIdsProvided: 'none - full clear',
          whereClauseDescription: 'ALL private messages between the pair, unconditional',
        });
        console.log('[CLEAR CHAT] Rows matching scope BEFORE clear:', beforeCount.rows[0]?.c);

        const pgResult = await pool.query(
          `UPDATE messages
           SET "hiddenFor" = CASE
             WHEN "hiddenFor" IS NULL OR "hiddenFor"::text IN ('', 'null', '[]')
               THEN jsonb_build_array($1::text)::text
             WHEN NOT ("hiddenFor"::jsonb @> jsonb_build_array($1::text))
               THEN ("hiddenFor"::jsonb || jsonb_build_array($1::text))::text
             ELSE "hiddenFor"::text
           END
           WHERE type = 'private'
             AND ((LOWER("senderName") = $2 AND LOWER("targetName") = $3)
               OR (LOWER("senderName") = $3 AND LOWER("targetName") = $2))`,
          [
            sender,    // $1 — username to add to hiddenFor array
            senderLow, // $2
            targetLow  // $3
          ]
        );
        pgUpdated = pgResult.rowCount || 0;
        console.log('[CLEAR_DM] clearForMe — PostgreSQL updated rows (hiddenFor):', pgUpdated);
        console.log('🔥🔥🔥 [CLEAR CHAT DB RESULT] 🔥🔥🔥', JSON.stringify({ operation: 'UPDATE_HIDDENFOR_PG', rowCount: pgUpdated, sqliteCleared: false }));
      } catch (err) {
        console.error('[CLEAR_DM] clearForMe — PostgreSQL UPDATE failed:', err.message);
      }

      // Also update hiddenFor in SQLite — DM history is read entirely from SQLite on join/refresh
      await new Promise((resolve) => {
        db.all(
          `SELECT id, hiddenFor FROM messages WHERE type = 'private' AND (
             (LOWER(senderName) = ? AND LOWER(targetName) = ?) OR
             (LOWER(senderName) = ? AND LOWER(targetName) = ?)
          )`,
          [senderLow, targetLow, targetLow, senderLow],
          (err, rows) => {
            if (err || !rows?.length) { resolve(); return; }
            let pending = rows.length;
            rows.forEach(row => {
              let arr = [];
              try { arr = JSON.parse(row.hiddenFor || '[]'); } catch { arr = []; }
              if (!Array.isArray(arr)) arr = [];
              if (!arr.map(x => (x || '').toLowerCase()).includes(sender.toLowerCase())) arr.push(sender);
              db.run(`UPDATE messages SET hiddenFor = ? WHERE id = ?`,
                [JSON.stringify(arr), row.id],
                () => { if (--pending === 0) resolve(); }
              );
            });
          }
        );
      });

      // Emit only to the requester (partner keeps their history)
      emitToUser(sender, 'dm_cleared', payload);
    }
  });

  // ─── Clear Room Chat (for me only — soft hide via hiddenFor) ───
  socket.on('clear_room_chat', async ({ roomId }) => {
    const sender = socket.username;
    if (!sender || !roomId) return;

    // PostgreSQL: add sender to hiddenFor on all messages in this room
    try {
      await pool.query(
        `UPDATE messages
         SET "hiddenFor" = CASE
           WHEN "hiddenFor" IS NULL OR "hiddenFor"::text IN ('', 'null', '[]')
             THEN jsonb_build_array($1::text)::text
           WHEN NOT ("hiddenFor"::jsonb @> jsonb_build_array($1::text))
             THEN ("hiddenFor"::jsonb || jsonb_build_array($1::text))::text
           ELSE "hiddenFor"::text
         END
         WHERE "roomId" = $2 AND type IN ('group', 'room')`,
        [sender, roomId]
      );
    } catch (err) {
      console.error('[CLEAR_ROOM] PostgreSQL UPDATE failed:', err.message);
    }

    // SQLite: same hiddenFor update row-by-row
    await new Promise((resolve) => {
      db.all(
        `SELECT id, hiddenFor FROM messages WHERE roomId = ? AND type IN ('room', 'group')`,
        [roomId],
        (err, rows) => {
          if (err || !rows?.length) { resolve(); return; }
          let pending = rows.length;
          rows.forEach(row => {
            let arr = [];
            try { arr = JSON.parse(row.hiddenFor || '[]'); } catch { arr = []; }
            if (!Array.isArray(arr)) arr = [];
            if (!arr.map(x => (x || '').toLowerCase()).includes(sender.toLowerCase())) arr.push(sender);
            db.run(`UPDATE messages SET hiddenFor = ? WHERE id = ?`,
              [JSON.stringify(arr), row.id],
              () => { if (--pending === 0) resolve(); }
            );
          });
        }
      );
    });

    // Emit only to the requester — other room members keep their history
    emitToUser(sender, 'room_chat_cleared', { roomId });
  });

  // â"€â"€ Emoji reaction â"€â"€
  socket.on('chat:reaction', async ({ roomId, messageId, emoji }) => {
    const room = rooms.get(roomId);
    const username = socket.username;
    if (!username || !roomId || !messageId || !emoji) return;

    const matchId = String(messageId);
    let tsFromId = null;
    const tsMatch = matchId.match(/\b(\d{13})\b/);
    if (tsMatch) tsFromId = tsMatch[1];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // SELECT FOR UPDATE serializes concurrent reactions for the same message
      const qWhere = tsFromId
        ? `id::text = $1 OR timestamp::text = $1 OR timestamp::text = $2`
        : `id::text = $1 OR timestamp::text = $1`;
      const qParams = tsFromId ? [matchId, tsFromId] : [matchId];
      const { rows } = await client.query(
        `SELECT id, timestamp, reactions, "senderName" FROM messages WHERE ${qWhere} LIMIT 1 FOR UPDATE`,
        qParams
      );

      let rx = {};
      let rowId = null;
      let rowTs = null;

      if (rows.length > 0) {
        const row = rows[0];
        rowId = row.id;
        rowTs = String(row.timestamp);

        const msgSender = (row.senderName || '').toLowerCase();
        if (msgSender && username && msgSender !== username.toLowerCase()) {
          const bCheck = await client.query(
            `SELECT 1 FROM blocks WHERE (LOWER(blocker) = $1 AND LOWER(blocked) = $2) OR (LOWER(blocker) = $2 AND LOWER(blocked) = $1) LIMIT 1`,
            [username.toLowerCase(), msgSender]
          );
          if (bCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return;
          }
        }

        try { rx = row.reactions ? JSON.parse(row.reactions) : {}; } catch {}
      } else if (room) {
        // Fallback to in-memory for brand-new messages not yet persisted to DB
        const inMem = room.groupMessages.find(m =>
          String(m.id) === matchId || String(m.timestamp) === matchId ||
          (tsFromId && String(m.timestamp) === String(tsFromId))
        );
        if (inMem) {
          for (const [em, val] of Object.entries(inMem.reactions || {})) {
            const arr = val instanceof Set ? [...val] : (Array.isArray(val) ? val : []);
            if (arr.length > 0) rx[em] = arr;
          }
        }
      }

      const hadThisEmoji = (Array.isArray(rx[emoji]) ? rx[emoji] : []).includes(username);
      for (const em of Object.keys(rx)) {
        rx[em] = (Array.isArray(rx[em]) ? rx[em] : []).filter(u => u !== username);
        if (rx[em].length === 0) delete rx[em];
      }
      if (!hadThisEmoji) {
        if (!rx[emoji]) rx[emoji] = [];
        rx[emoji].push(username);
      }

      if (rowId !== null) {
        await client.query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(rx), rowId]);
      }
      await client.query('COMMIT');

      if (room) {
        const inMemMsg = room.groupMessages.find(m =>
          String(m.id) === matchId || String(m.timestamp) === matchId ||
          (tsFromId && String(m.timestamp) === String(tsFromId))
        );
        if (inMemMsg) inMemMsg.reactions = rx;
      }

      const originalSenderName = rows.length > 0 ? rows[0].senderName : null;
      const reactionPayload = { roomId, messageId: String(messageId), timestampId: tsFromId || rowTs, reactions: rx, senderUsername: username, emoji, originalSenderName };
      io.in(roomId).emit('chat:reaction', reactionPayload);
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('[chat:reaction socket] error:', err);
    } finally {
      client.release();
    }
  });


  // ─── Emoji reaction (Private) ───
  socket.on('chat:private_reaction', ({ targetName: rawTargetName, messageId, emoji }) => {
    const targetName = rawTargetName; // Target is the person we reacted to
    const username = socket.username;
    if (!username || !targetName) return;

    // Robust ID matching: extract the 13-digit Unix timestamp reliably from any format ID
    const matchId = String(messageId);
    let tsFromId = null;
    const tsMatch = matchId.match(/\b(\d{13})\b/);
    if (tsMatch) tsFromId = tsMatch[1];

    // Save to DB with single-reaction enforcement
    db.get(`SELECT reactions, senderName, username FROM messages WHERE id = ? OR timestamp = ? OR timestamp = ?`, [matchId, matchId, tsFromId], async (err, row) => {
      if (err || !row) return;

      // BLOCK CHECK: Reactor cannot react to a message if blocked (either way)
      const msgSender = (row.senderName || row.username || '').toLowerCase();
      if (msgSender && username && msgSender !== username.toLowerCase()) {
         try {
           const bCheck = await pool.query('SELECT 1 FROM blocks WHERE (LOWER(blocker) = $1 AND LOWER(blocked) = $2) OR (LOWER(blocker) = $2 AND LOWER(blocked) = $1) LIMIT 1', [username, msgSender]);
           if (bCheck.rows.length > 0) return;
         } catch(e) { console.error('Block check error in private reaction:', e); }
      }

      let rx = {};
      try { rx = row.reactions ? JSON.parse(row.reactions) : {}; } catch{}

      const hadThisEmoji = (rx[emoji] || []).includes(username);
      for (const em of Object.keys(rx)) {
        rx[em] = (rx[em] || []).filter(u => u !== username);
        if (rx[em].length === 0) delete rx[em];
      }
      if (!hadThisEmoji) {
        if (!rx[emoji]) rx[emoji] = [];
        rx[emoji].push(username);
      }

      db.run(`UPDATE messages SET reactions = ? WHERE id = ? OR timestamp = ? OR timestamp = ?`, [JSON.stringify(rx), matchId, matchId, tsFromId]);

      // Emit full reactions object so clients stay in sync
      const reactionPayload = { messageId: String(messageId), timestampId: tsFromId, reactions: rx, senderName: username, emoji, targetName };
      emitToUser(targetName, 'chat:private_reaction', reactionPayload);
      emitToUser(username, 'chat:private_reaction', reactionPayload);
    });
  });

  // ─── Private / DM ───
  socket.on('private_message', async (data) => {
    const { targetName, message, senderMessage, nonce, ephemeralPublicKey, replyTo, msgId, mediaUrl, mediaType, mediaFileName, mediaFileSize, mediaDuration, tempId } = data;
    if (!socket.username || !targetName) return;

    let finalMessage = message;
    if (finalMessage) {
      finalMessage = truncateToWordLimit(finalMessage, 250);
    }
    let finalSenderMessage = senderMessage || null;
    if (finalSenderMessage) {
      finalSenderMessage = truncateToWordLimit(finalSenderMessage, 250);
    }
    
    const sender = socket.username.toLowerCase();
    const recipient = targetName.toLowerCase();

    // 1. Check for mutual friendship
    const rel1 = await queryGet('SELECT status FROM follows WHERE followerId = ? AND followingId = ?', [sender, recipient]);
    const rel2 = await queryGet('SELECT status FROM follows WHERE followerId = ? AND followingId = ?', [recipient, sender]);
    const areFriends = (rel1?.status === 'accepted') && (rel2?.status === 'accepted');

    if (!areFriends) {
      socket.emit('error_notification', 'You must be mutual friends to send private messages.');
      return;
    }

    // 2. Check for blocks
    const blockCheck = await queryGet('SELECT blocker, blocked FROM blocks WHERE (LOWER(blocker) = LOWER($1) AND LOWER(blocked) = LOWER($2)) OR (LOWER(blocker) = LOWER($2) AND LOWER(blocked) = LOWER($1))', [sender, recipient]);
    if (blockCheck) {
      socket.emit('error_notification', 'You cannot message this user at this time.');
      return;
    }

    const timestamp = Date.now();
    const payload = {
      id: msgId || `sock-${timestamp}-${Math.floor(Math.random()*1000)}`,
      senderId: socket.id,
      senderName: socket.username,
      targetName,
      message: finalMessage,
      senderMessage: finalSenderMessage,
      nonce,
      ephemeralPublicKey,
      replyTo,
      timestamp,
      mediaUrl,
      mediaType,
      mediaFileName: mediaFileName || null,
      mediaFileSize: mediaFileSize || null,
      mediaDuration: mediaDuration ? Number(mediaDuration) : null,
      tempId: tempId || null,
      type: 'private'
    };
    const users = [socket.username.toLowerCase(), targetName.toLowerCase()].sort();
    const dmRoomId = 'dm-' + users.join('-');

    const dmSocketExpiry = payload.mediaUrl ? computeMediaExpiry(payload.mediaType) : null;
    payload.mediaExpiresAt = dmSocketExpiry ? dmSocketExpiry.toISOString() : null;
    db.run(`INSERT INTO messages (roomId, type, senderId, senderName, targetId, targetName, message, senderMessage, nonce, ephemeralPublicKey, timestamp, replyTo, mediaUrl, mediaType, media_file_name, media_file_size, media_expires_at, media_duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [dmRoomId, 'private', socket.id, socket.username, 'dm', targetName, finalMessage, finalSenderMessage, nonce, ephemeralPublicKey || null, timestamp, replyTo ? JSON.stringify(replyTo) : null, mediaUrl || null, mediaType || null, mediaFileName || null, mediaFileSize || null, dmSocketExpiry || null, mediaDuration ? Number(mediaDuration) : null], function(err) {
        if (err) { console.error('Error saving private message:', err); return; }
        const dbId = this.lastID;
        if (dbId) {
          payload.id = String(dbId);
          payload.dbId = String(dbId);
          payload.seenBy = [{ username: socket.username, seenAt: payload.timestamp }];

          // Save sender seen status to database
          pool.query('INSERT INTO message_seen (message_id, room_id, username, seen_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [dbId, dmRoomId, socket.username, payload.timestamp])
            .catch(err => console.error('[private_message] message_seen error:', err.message));

          if (tempId) {
            socket.emit('chat:message_persisted', { tempId, dbId: String(dbId) });
          }
        } else {
          payload.seenBy = [];
        }
        broadcastMessage(null, payload, socket.id, socket.username);
      });
  });

  // Request sync
  socket.on('request_sync', (rawRoomId) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    
    // SECURITY FIX: Only allow sync if the user has fully joined the room (passed lock checks)
    const isMember = room.users.some(u => u.socketId === socket.id);
    if (!isMember) return;
    
    const state = getSerializableRoom(room);
    if (state.isPlaying) state.currentTime += (Date.now() - state.timestampUpdatedAt) / 1000;
    socket.emit('room_state', state);
  });



  // ─── Request DM History ───
  socket.on('request_dm_history', () => {
    const username = socket.username;
    if (!username) return;
    db.all(`
      SELECT m.*, u.avatarPath as senderAvatarPath
      FROM messages m
      LEFT JOIN users u ON LOWER(u.username) = LOWER(m.senderName)
      WHERE m.type = 'private' AND (LOWER(m.senderName) = LOWER(?) OR LOWER(m.targetName) = LOWER(?))
      ORDER BY m.timestamp ASC
    `, [username, username], async (err, dmRows) => {
        console.log('🔥🔥🔥 [DM HISTORY FROM SQLITE — request_dm_history] 🔥🔥🔥', { username, totalRowsFromSQLite: dmRows?.length || 0 });
        if (err) return;
        const dmHistory = {};
        if (dmRows && dmRows.length > 0) {
          const visibleDmRows = dmRows.filter(row => {
            if (!row.hiddenFor) return true;
            const hStr = typeof row.hiddenFor === 'string' ? row.hiddenFor : JSON.stringify(row.hiddenFor);
            return !hStr.includes(`"${username}"`);
          });
          const messageIds = visibleDmRows.map(r => Number(r.id)).filter(Boolean);
          const seenMap = {};
          if (messageIds.length > 0) {
            try {
              const seenResult = await pool.query(`
                SELECT ms.message_id, ms.username, ms.seen_at, u."avatarPath" as "avatarPath"
                FROM message_seen ms
                LEFT JOIN users u ON LOWER(u.username) = LOWER(ms.username)
                WHERE ms.message_id = ANY($1::bigint[])
              `, [messageIds]);
              seenResult.rows.forEach(r => {
                const msgId = String(r.message_id);
                if (!seenMap[msgId]) seenMap[msgId] = [];
                seenMap[msgId].push({ username: r.username, seenAt: Number(r.seen_at), avatar: r.avatarPath });
              });
            } catch (seenErr) {
              console.error('[request_dm_history] Failed to fetch seen records:', seenErr.message);
            }
          }

          visibleDmRows.forEach(row => {
            const isMe = (row.senderName || '').toLowerCase() === (username || '').toLowerCase();
            const otherName = isMe ? row.targetName : row.senderName;
            if (!dmHistory[otherName]) dmHistory[otherName] = [];
            dmHistory[otherName].push({
              id: row.id.toString(), isMe, senderId: row.senderId, senderName: row.senderName,
              senderAvatar: row.senderAvatarPath || null,
              targetId: row.targetId, targetName: row.targetName, message: row.message,
              senderMessage: row.senderMessage || null,
              nonce: row.nonce, ephemeralPublicKey: row.ephemeralPublicKey, timestamp: row.timestamp,
              mediaUrl: row.mediaUrl || null, mediaType: row.mediaType || null,
              mediaFileName: row.media_file_name || null, mediaFileSize: row.media_file_size || null,
              mediaExpiresAt: row.media_expires_at || null,
              mediaDuration: row.media_duration || null,
              reactions: row.reactions ? JSON.parse(row.reactions) : {}, 
              replyTo: row.replyTo ? JSON.parse(row.replyTo) : null,
              seenBy: seenMap[row.id.toString()] || []
            });
          });
        }
        socket.emit('chat_history_dm', dmHistory);
      });
  });

  // ── Room rename ──


  // â"€â"€ Pinned rooms are handled via REST /api/profile/pinned-rooms instead of WebSockets â"€â"€

  // ─── Media control ───
  socket.on('change_media', ({ roomId: rawRoomId, mediaUrl, browserUrl }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!rooms.has(roomId)) return;

    const room = rooms.get(roomId);

    // Check Permissions
    const allowMedia = room.permissions?.changeMedia || 'all';
    const allUsersPlayerSettings = room.settings?.allUsersPlayerSettings !== false && room.settings?.allUsersPlayerSettings !== 'false';
    if (allowMedia === 'host' && !isUserAdmin(room, socket) && !allUsersPlayerSettings) {
      socket.emit('error_notification', 'Only administrators can change media.');
      return;
    }

    // "Last Action Wins" Priority:
    // If a screenshare is currently active, stop it when the room shifts focus to a new media URL.
    if (room.screenshareHostId) {
      room.screenshareHostId = null;
      room.activeExternalApp = null;
      io.in(roomId).emit('webrtc_screenshare_stopped');
    }

    room.currentMedia = mediaUrl; room.currentTime = 0; room.isPlaying = false; room.timestampUpdatedAt = Date.now();
    room.subtitles = null;
    io.in(roomId).emit('media_changed', mediaUrl);
    if (browserUrl) io.in(roomId).emit('browser_url_changed', browserUrl);
    io.in(roomId).emit('room_state', getSerializableRoom(room));
  });

  socket.on('ui_sync', ({ roomId: rawRoomId, data }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    room.uiState = data;
    // Broadcast UI changes to everyone in the room except sender
    socket.to(roomId).emit('ui_sync', data);
  });
  socket.on('play', ({ roomId: rawRoomId, currentTime }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    
    // Check Permissions
    const allowMedia = room.permissions?.changeMedia || 'all';
    const allUsersPlayerSettings = room.settings?.allUsersPlayerSettings !== false && room.settings?.allUsersPlayerSettings !== 'false';
    if (allowMedia === 'host' && !isUserAdmin(room, socket) && !allUsersPlayerSettings) return;

    // Check if the sender is the host/admin
    const isHost = (room.hostId === socket.id) || (room.hostUsername && socket.username && room.hostUsername.toLowerCase() === socket.username.toLowerCase());
    let targetTime = currentTime;
    if (!isHost) {
      targetTime = room.isPlaying 
        ? room.currentTime + (Date.now() - room.timestampUpdatedAt) / 1000 
        : room.currentTime;
    }

    room.isPlaying = true; room.currentTime = targetTime; room.timestampUpdatedAt = Date.now();
    socket.to(roomId).emit('action_play', targetTime);
    if (!isHost) {
      socket.emit('action_play', targetTime);
    }
  });
  socket.on('pause', ({ roomId: rawRoomId, currentTime }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    // Check Permissions
    const allowMedia = room.permissions?.changeMedia || 'all';
    const allUsersPlayerSettings = room.settings?.allUsersPlayerSettings !== false && room.settings?.allUsersPlayerSettings !== 'false';
    if (allowMedia === 'host' && !isUserAdmin(room, socket) && !allUsersPlayerSettings) return;

    // Check if the sender is the host/admin
    const isHost = (room.hostId === socket.id) || (room.hostUsername && socket.username && room.hostUsername.toLowerCase() === socket.username.toLowerCase());
    let targetTime = currentTime;
    if (!isHost) {
      targetTime = room.isPlaying 
        ? room.currentTime + (Date.now() - room.timestampUpdatedAt) / 1000 
        : room.currentTime;
    }

    room.isPlaying = false; room.currentTime = targetTime; room.timestampUpdatedAt = Date.now();
    socket.to(roomId).emit('action_pause', targetTime);
    if (!isHost) {
      socket.emit('action_pause', targetTime);
    }
  });
  socket.on('seek', ({ roomId: rawRoomId, currentTime }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    // Check Permissions
    const allowMedia = room.permissions?.changeMedia || 'all';
    const allUsersPlayerSettings = room.settings?.allUsersPlayerSettings !== false && room.settings?.allUsersPlayerSettings !== 'false';
    if (allowMedia === 'host' && !isUserAdmin(room, socket) && !allUsersPlayerSettings) return;

    room.currentTime = currentTime; room.timestampUpdatedAt = Date.now();
    socket.to(roomId).emit('action_seek', currentTime);
  });

  // ─── Audio Ducking ───
  socket.on('audio_ducking_speaking', ({ roomId: rawRoomId, userId, username }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!roomId || !rooms.has(roomId)) return;
    if (!roomSpeakingUsers.has(roomId)) roomSpeakingUsers.set(roomId, new Set());
    const set = roomSpeakingUsers.get(roomId);
    const wasEmpty = set.size === 0;
    set.add(userId || socket.id);
    if (wasEmpty) {
      io.to(roomId).emit('audio_ducking_duck', { username: username || socket.username });
    }
  });

  socket.on('audio_ducking_stopped', ({ roomId: rawRoomId, userId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (!roomId) return;
    const set = roomSpeakingUsers.get(roomId);
    if (!set) return;
    set.delete(userId || socket.id);
    if (set.size === 0) {
      io.to(roomId).emit('audio_ducking_restore');
    }
  });

  // ─── WebRTC Screenshare ───
  socket.on('webrtc_start_screenshare', (data) => { 
    // data can be a string (roomId) or an object { roomId, app }
    const roomId = (typeof data === 'string' ? data : data.roomId)?.toLowerCase();
    const app = typeof data === 'object' ? data.app : null;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.screenshareHostId = socket.id; 
      room.activeExternalApp = app;
      // Auto-pause room media when screenshare starts to ensure process termination
      room.isPlaying = false;
      room.timestampUpdatedAt = Date.now();
    }
    const state = getSerializableRoom(rooms.get(roomId));
    io.in(roomId).emit('room_state', state);
    socket.to(roomId).emit('webrtc_screenshare_started', { socketId: socket.id, app }); 
  });
  socket.on('webrtc_stop_screenshare', (rawRoomId) => { 
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.screenshareHostId = null; 
      room.activeExternalApp = null;
    }
    const state = getSerializableRoom(rooms.get(roomId));
    io.in(roomId).emit('room_state', state);
    socket.to(roomId).emit('webrtc_screenshare_stopped', socket.id); 
  });
  socket.on('webrtc_join_request', ({ targetSocketId }) => { io.to(targetSocketId).emit('webrtc_viewer_joined', socket.id); });
  socket.on('webrtc_offer', ({ targetSocketId, offer }) => { io.to(targetSocketId).emit('webrtc_offer', { senderSocketId: socket.id, offer }); });
  socket.on('webrtc_answer', ({ targetSocketId, answer }) => { io.to(targetSocketId).emit('webrtc_answer', { senderSocketId: socket.id, answer }); });
  socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => { io.to(targetSocketId).emit('webrtc_ice_candidate', { senderSocketId: socket.id, candidate }); });

  // â"€â"€ Camera/Mic WebRTC (peer video communication) â"€â"€
  socket.on('cam_started', ({ roomId }) => {
    if (!rooms.has(roomId)) return;
    const room = rooms.get(roomId);
    
    // Check Permissions
    const allowCam = room.permissions?.cam || 'all';
    if (allowCam === 'host' && !isUserAdmin(room, socket)) {
      socket.emit('error_notification', 'Only administrators can use the camera.');
      return;
    }

    socket.to(roomId).emit('cam_started', { socketId: socket.id, username: socket.username });
  });
  socket.on('webrtc_cam_ping', ({ roomId }) => {
    socket.to(roomId).emit('webrtc_cam_ping', { requesterId: socket.id });
  });
  socket.on('webrtc_cam_pong', ({ targetSocketId }) => {
    io.to(targetSocketId).emit('cam_started', { socketId: socket.id, username: socket.username });
  });
  socket.on('cam_stopped', ({ roomId }) => {
    socket.to(roomId).emit('cam_stopped', { socketId: socket.id });
  });
  socket.on('cam_offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('cam_offer', { senderSocketId: socket.id, senderName: socket.username, offer });
  });
  socket.on('cam_answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('cam_answer', { senderSocketId: socket.id, answer });
  });
  socket.on('self_mute', ({ roomId: rawRoomId, isMuted }) => {
    // Use payload roomId first, fallback to socket.roomId in case of mismatch
    const roomId = (rawRoomId ? rawRoomId.toLowerCase() : null) || socket.roomId;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);
      
    // Check Permissions if unmuting
    if (!isMuted) {
      const allowMic = room.permissions?.mic || 'all';
      if (allowMic === 'host' && !isUserAdmin(room, socket)) {
        socket.emit('error_notification', 'Only administrators can use the microphone.');
        return;
      }
    }

    // Find user by socketId first, fallback to username for robustness
    const u = room.users.find(usr => usr.socketId === socket.id)
           || room.users.find(usr => usr.username && socket.username && usr.username.toLowerCase() === socket.username.toLowerCase());
    if (u) {
      u.isMuted = !!isMuted;
      if (!isMuted) {
        room.mutedUsers.delete(u.username);
      }
      io.to(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
    }
  });
  socket.on('cam_ice', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('cam_ice', { senderSocketId: socket.id, candidate });
  });

  // â"€â"€ Toggle Public Status â"€â"€
  socket.on('toggle_public', (data) => {
    if (!socket.roomId) return;
    const room = rooms.get(socket.roomId);
    if (!room || !isUserAdmin(room, socket)) return;
    room.isPublic = !!data.isPublic;
    io.to(socket.roomId).emit('room_public_status', { isPublic: room.isPublic });
    // Persist public status to DB
    db.run(
      'INSERT INTO room_names (roomId, roomName, isPublic, hostUsername) VALUES (?, ?, ?, ?) ON CONFLICT(roomId) DO UPDATE SET isPublic = excluded.isPublic',
      [socket.roomId, room.roomName || 'Room Chat', room.isPublic ? 1 : 0, socket.username || null]
    );
  });

  // â"€â"€ Connection Request (P2P Mesh) â"€â"€
  socket.on('webrtc_connection_request', ({ targetSocketId, signal }) => {
    io.to(targetSocketId).emit('webrtc_connection_request', { senderSocketId: socket.id, signal });
  });

  // â"€â"€ Connection Answer (P2P Mesh) â"€â"€
  socket.on('webrtc_connection_answer', ({ targetSocketId, signal }) => {
    io.to(targetSocketId).emit('webrtc_connection_answer', { senderSocketId: socket.id, signal });
  });

  // â"€â"€ ICE Candidate (P2P Mesh) â"€â"€
  socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('webrtc_ice_candidate', { senderSocketId: socket.id, candidate });
  });

  // â"€â"€ Screenshare Start â"€â"€
  socket.on('webrtc_screenshare_start', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.screenshareHostId = socket.id;
    io.in(roomId).emit('webrtc_screenshare_started', { socketId: socket.id, app: room.activeExternalApp });
  });

  // â"€â"€ Screenshare Stop â"€â"€
  socket.on('webrtc_screenshare_stop', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.screenshareHostId === socket.id) {
      room.screenshareHostId = null;
      io.in(roomId).emit('webrtc_screenshare_stopped');
    }
  });

  // ─── Moderation (host only) ───
  socket.on('mod_kick', ({ roomId: rawRoomId, targetSocketId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;

    // Hierarchy Protection: Admins cannot kick the Host
    const isTargetHost = (targetSocketId === room.hostId) || (room.hostUsername && room.users.find(u => u.socketId === targetSocketId)?.username?.toLowerCase() === room.hostUsername.toLowerCase());
    if (isTargetHost) {
      socket.emit('error_notification', 'You cannot kick the room host.');
      return;
    }

    const targetUser = room.users.find(u => u.socketId === targetSocketId);
    if (targetUser && targetUser.username && room.approvedUsers) {
      room.approvedUsers.delete(targetUser.username.toLowerCase());
    }
    
    io.to(targetSocketId).emit('kicked_out', { reason: 'kicked' });
    room.users = room.users.filter(u => u.socketId !== targetSocketId);
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
  });
  socket.on('mod_ban', ({ roomId: rawRoomId, targetSocketId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error_notification', 'Room not found.');
      return;
    }
    if (!isUserAdmin(room, socket)) {
      socket.emit('error_notification', 'Only administrators can ban users.');
      return;
    }
    const targetUser = room.users.find(u => u.socketId === targetSocketId);
    if (targetUser) {
      room.bannedUsers.add(targetUser.username);
      db.run('INSERT OR IGNORE INTO room_bans (roomId, username) VALUES (?, ?)', [roomId, targetUser.username], (err) => {
         if (err) console.error('[mod_ban] DB Error:', err.message);
      });
      io.to(targetSocketId).emit('kicked_out', { reason: 'banned' });
      room.users = room.users.filter(u => u.socketId !== targetSocketId);
      io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
      io.in(roomId).emit('room_state', getSerializableRoom(room));
      io.in(roomId).emit('room_settings_updated', { bannedUsers: Array.from(room.bannedUsers) });
    } else {
      socket.emit('error_notification', 'Target user not found.');
    }
  });
  socket.on('mod_mute', ({ roomId: rawRoomId, targetSocketId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;
    const targetUser = room.users.find(u => u.socketId === targetSocketId);
    if (!targetUser) return;
    
    // Privacy Policy: Admin can only Mute, not Unmute.
    // Set both the user object isMuted AND the mutedUsers set so user_list is immediately correct.
    targetUser.isMuted = true;
    room.mutedUsers.add(targetUser.username);
    io.to(targetSocketId).emit('you_are_muted');
    // Always emit user_list to ensure UI is in sync for all clients
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
  });

  socket.on('mod_mute_all', ({ roomId: rawRoomId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;

    room.users.forEach(u => {
      // Mute everyone except the person who issued the command
      if (u.socketId !== socket.id) {
        u.isMuted = true;                       // set on user object
        room.mutedUsers.add(u.username);        // add to moderator mute set
        io.to(u.socketId).emit('you_are_muted');
      }
    });
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
  });
  
  socket.on('mod_toggle_admin', ({ roomId: rawRoomId, targetSocketId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;

    const targetUser = room.users.find(u => u.socketId === targetSocketId);
    if (!targetUser || !targetUser.username) return;

    // Hierarchy Protection: Cannot toggle Host
    const isTargetHost = (targetSocketId === room.hostId) || (room.hostUsername && targetUser.username.toLowerCase() === room.hostUsername.toLowerCase());
    if (isTargetHost) {
      socket.emit('error_notification', 'You cannot change the room host\'s permissions.');
      return;
    }

    if (!room.admins) room.admins = new Set();
    if (!room.deniedAdmins) room.deniedAdmins = new Set();
    const unameLower = targetUser.username.toLowerCase();
    
    const currentlyAdmin = isUserAdmin(room, targetUser);
    
    if (currentlyAdmin) {
      // Logic to REMOVE admin
      if (room.admins.has(unameLower)) {
        room.admins.delete(unameLower);
      }
      // If auto-admin is on, we must explicitly deny them
      if (room.settings?.newMembersAdmins) {
        room.deniedAdmins.add(unameLower);
      }
    } else {
      // Logic to MAKE admin
      room.admins.add(unameLower);
      // Remove from denied if they were there
      room.deniedAdmins.delete(unameLower);
    }

    // Broadcast updated list
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
    
    // Also broadcast room settings updated so GlobalChatWidget can recalculate its admin permissions
    io.in(roomId).emit('room_settings_updated', { 
      roomId,
      roomName: room.roomName, 
      permissions: room.permissions, 
      settings: room.settings,
      hostUsername: room.hostUsername || null,
      admins: Array.from(room.admins || [])
    });
    
    // Notify the target user of their change in status
    const isNowAdmin = isUserAdmin(room, targetUser);
    io.to(targetSocketId).emit(isNowAdmin ? 'you_are_now_admin' : 'you_are_no_longer_admin');
  });

  socket.on('approve_join', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;
    const pending = room.pendingJoins.get(targetSocketId);
    if (pending) {
      console.log(`[Security] ${socket.username} approved join for ${pending.username}`);
      if (!room.approvedSockets) room.approvedSockets = new Set();
      room.approvedSockets.add(targetSocketId);

      // Also add to persistent approvedUsers so refresh doesn't require re-approval
      if (!room.approvedUsers) room.approvedUsers = new Set();
      if (pending.username && pending.username !== 'Anonymous') {
        room.approvedUsers.add(pending.username.toLowerCase());
      }

      room.pendingJoins.delete(targetSocketId);

      // CRITICAL FIX: pending.socket was captured at request time and may be STALE if Socket.IO
      // reconnected in the meantime. Always resolve the live socket at approval time.
      const liveSocket = io.sockets.sockets.get(targetSocketId);
      if (liveSocket) {
        console.log(`[JOIN_FLOW] Live socket found for ${pending.username}, executing final join`);
        executeFinalJoin(liveSocket, room, roomId, pending.username);
        // join_approved signals the waiting screen to disappear
        liveSocket.emit('join_approved');
      } else {
        // User disconnected while waiting — they will re-join automatically via reconnect
        // and approvedUsers already contains them so they won't hit the lobby again
        console.log(`[JOIN_FLOW] Socket gone for ${pending.username} (disconnected while waiting) — approvedUsers updated so reconnect will bypass lobby`);
      }

      // Tell all hosts/admins to dismiss the notification
      io.in(roomId).emit('join_request_handled', { socketId: targetSocketId, username: pending.username });
    }
  });

  socket.on('deny_join', ({ roomId, targetSocketId }) => {
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;
    const pending = room.pendingJoins.get(targetSocketId);
    if (pending) {
      console.log(`[Security] ${socket.username} denied join for ${pending.username}`);
      io.to(targetSocketId).emit('join_denied');
      // Tell all hosts/admins to dismiss the notification (include username for toast ID matching)
      io.in(roomId).emit('join_request_handled', { socketId: targetSocketId, username: pending.username });
      room.pendingJoins.delete(targetSocketId);
    }
  });
  
  socket.on('mod_rename_room', ({ roomId, newName }) => {
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;
    const cleanName = newName ? newName.trim() : '';
    if (!cleanName) return;
    
    room.roomName = cleanName;
    // Persist the new name and ensure hostUsername is stored if missing
    const host = room.hostUsername || socket.username || null;
    db.run(
      'INSERT INTO room_names (roomId, roomName, hostUsername) VALUES (?, ?, ?) ON CONFLICT(roomId) DO UPDATE SET roomName = excluded.roomName, hostUsername = EXCLUDED.hostUsername',
      [roomId, cleanName, host]
    );
    // Also update the name in pinned_rooms
    db.run('UPDATE pinned_rooms SET roomName = ? WHERE roomId = ?', [cleanName, roomId]);
    
    io.in(roomId).emit('room_renamed', cleanName);
    
    // Global notification for user's other sessions
    if (socket.username) {
        emitToUser(socket.username, 'room_renamed_global', { roomId, newName: cleanName });
    }
  });

  socket.on('update_room_settings', ({ roomId, newName, permissions, settings }) => {
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`[Settings] Room ${roomId} not found during update`);
      return;
    }
    
    // Check if the current user is an admin
    const isAdmin = isUserAdmin(room, socket);
    
    console.log(`[Settings] Room ${roomId}: Current hostId=${room.hostId}, DB host=${room.hostUsername}, Requester=${socket.username}, isAdmin=${isAdmin}`);

    if (!isAdmin) {
      console.log(`[Settings] Unauthorized attempt by ${socket.username}`);
      return;
    }

    console.log(`[Settings] Updating room ${roomId} - Name: ${newName}`);

    if (newName) {
       room.roomName = newName.trim();
       db.run('UPDATE room_names SET roomName = ? WHERE roomId = ?', [room.roomName, roomId]);
       io.in(roomId).emit('room_renamed', room.roomName);
    }
    
    if (permissions) {
       room.permissions = permissions;
       db.run('UPDATE room_names SET permissions = ? WHERE roomId = ?', [JSON.stringify(permissions), roomId]);
    }
    
    if (settings) {
       room.settings = settings;
       db.run('UPDATE room_names SET settings = ? WHERE roomId = ?', [JSON.stringify(settings), roomId]);
       
       // Retroactively enforce Members Only if just enabled
       if (settings.onlyLoggedIn) {
         let listChanged = false;
         room.users.forEach(u => {
           const isGuest = u.username === 'Anonymous' || (u.username && u.username.toLowerCase().startsWith('guest_'));
           if (isGuest && u.socketId !== room.hostId) {
             io.to(u.socketId).emit('join_rejected', { reason: 'members_only' });
             const s = io.sockets.sockets.get(u.socketId);
             if (s) s.leave(roomId);
             listChanged = true;
           }
         });
         
         if (listChanged) {
           room.users = room.users.filter(u => {
             const isGuest = u.username === 'Anonymous' || (u.username && u.username.toLowerCase().startsWith('guest_'));
             return !(isGuest && u.socketId !== room.hostId);
           });
           io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
         }
       }
    }

    // Refresh user list and state for everyone because isAdmin status or permissions might have changed
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
    io.in(roomId).emit('room_state', getSerializableRoom(room));
    io.in(roomId).emit('room_settings_updated', { 
      roomId,
      roomName: room.roomName, 
      permissions: room.permissions, 
      settings: room.settings,
      hostUsername: room.hostUsername || null,
      admins: Array.from(room.admins || [])
    });
  });

  socket.on('leave_room', ({ roomId }) => {
    if (!roomId) return;
    const room = rooms.get(roomId.toLowerCase());
    if (room && socket.username) {
      console.log(`[Security] User ${socket.username} explicitly left room ${roomId} - clearing approved status`);
      if (room.approvedUsers) room.approvedUsers.delete(socket.username.toLowerCase());
      if (room.approvedSockets) room.approvedSockets.delete(socket.id);
    }
  });

  socket.on('mod_unban', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) return;
    room.bannedUsers.delete(username);
    db.run('DELETE FROM room_bans WHERE roomId = ? AND username = ?', [roomId, username], (err) => {
      if (err) console.error('[mod_unban] DB Error:', err.message);
    });
    io.in(roomId).emit('room_state', getSerializableRoom(room));
    // Emit to the host's socket specifically so the settings modal updates instantly
    socket.emit('room_settings_updated', { bannedUsers: Array.from(room.bannedUsers) });
    io.in(roomId).emit('room_settings_updated', { bannedUsers: Array.from(room.bannedUsers) });
  });

  socket.on('mod_fetch_bans', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || !isUserAdmin(room, socket)) {
       socket.emit('error_notification', 'Sync failed: You are not an administrator.');
       return;
    }
    
    db.all('SELECT username FROM room_bans WHERE roomId = ?', [roomId], (err, rows) => {
      if (!err && rows) {
        const bannedList = rows.map(r => r.username);
        // Merge DB bans into in-memory set
        bannedList.forEach(u => room.bannedUsers.add(u));
        socket.emit('room_settings_updated', { bannedUsers: Array.from(room.bannedUsers) });
      } else {
        socket.emit('room_settings_updated', { bannedUsers: Array.from(room.bannedUsers) });
      }
    });
  });

  socket.on('change_room_theme', ({ roomId: rawRoomId, themeId }) => {
    const roomId = rawRoomId ? rawRoomId.toLowerCase() : null;
    const room = rooms.get(roomId);
    console.log(`[change_room_theme] roomId=${roomId} themeId=${themeId} roomFound=${!!room} user=${socket.username} isAdmin=${room ? isUserAdmin(room, socket) : false}`);
    if (!room || !isUserAdmin(room, socket)) return;
    room.roomTheme = themeId || 'default';
    db.run('UPDATE room_names SET room_theme = ? WHERE roomId = ?', [room.roomTheme, roomId], (err) => {
      if (err) console.error('[change_room_theme] DB error:', err.message);
      else console.log(`[change_room_theme] DB saved theme=${room.roomTheme} for room=${roomId}`);
    });
    io.to(roomId).emit('room_theme_changed', { themeId: room.roomTheme });
    console.log(`[change_room_theme] Broadcasted theme=${room.roomTheme} to room=${roomId}`);
  });

  socket.on('delete_room', ({ roomId }) => {
    const room = rooms.get(roomId);
    
    console.log(`[DELETE ROOM] Request received for roomId: ${roomId} from user: ${socket.username}`);

    // Authorization check: User must be host
    db.get('SELECT hostUsername FROM room_names WHERE roomId = ?', [roomId], (err, row) => {
        if (err) {
          console.error(`[DELETE ROOM] Database error during host check for ${roomId}:`, err.message);
          return;
        }
        
        const hostUsername = (room && room.hostUsername) || (row && row.hostUsername);
        
        if (!hostUsername) {
          console.warn(`[DELETE ROOM] No host found for room ${roomId}. Proceeding with cleanup anyway.`);
        } else if (hostUsername.toLowerCase() !== socket.username.toLowerCase()) {
          console.warn(`[DELETE ROOM] Unauthorized delete attempt for ${roomId} by ${socket.username}. Host is ${hostUsername}.`);
          return;
        }

        console.log(`[DELETE ROOM] Authorization successful for ${roomId}. Starting sequential cleanup...`);

        // Use serialize to ensure deletions happen in order and can be logged accurately
        db.serialize(() => {
          // 1. Mark as deleting FIRST to block any race-condition re-joins during async DB deletion
          deletingRooms.add(roomId);

          // 2. Notify and kick all users with a specific reason
          io.in(roomId).emit('kicked_out', { reason: 'room_deleted' });
          console.log(`[DELETE ROOM] Emitted kicked_out to room ${roomId}`);

          // 3. Broadcast to ALL connected sockets so GlobalChatWidget cleans up for everyone
          io.emit('room_permanently_deleted', { roomId });
          console.log(`[DELETE ROOM] Emitted room_permanently_deleted globally`);

          // 4. Cleanup memory
          if (rooms.has(roomId)) {
            rooms.delete(roomId);
            console.log(`[DELETE ROOM] Removed ${roomId} from memory`);
          }

          // 3. Cleanup DB - Room Metadata
          db.run('DELETE FROM room_names WHERE roomId = ?', [roomId], function(err) {
            if (err) console.error(`[DELETE ROOM] Error deleting from room_names:`, err.message);
            else console.log(`[DELETE ROOM] Deleted ${roomId} from room_names (${this.changes} rows)`);
          });

          // 4. Cleanup DB - Messages
          db.run('DELETE FROM messages WHERE roomId = ?', [roomId], function(err) {
            if (err) console.error(`[DELETE ROOM] Error deleting from messages:`, err.message);
            else console.log(`[DELETE ROOM] Deleted messages for ${roomId} (${this.changes} rows)`);
          });

          // 5. Cleanup DB - Future proofing (in case table exists or is added)
          db.run('DELETE FROM pinned_rooms WHERE roomId = ?', [roomId], function(err) {
            // Silently ignore if table doesn't exist
          });

          // 6. Cleanup DB - Bans
          db.run('DELETE FROM room_bans WHERE roomId = ?', [roomId], function(err) {
            if (err) console.error(`[DELETE ROOM] Error deleting from room_bans:`, err.message);
            else console.log(`[DELETE ROOM] Deleted bans for ${roomId} (${this.changes} rows)`);
          });

          // 7. Cleanup host's own pinnedRooms in users table
          if (hostUsername) {
            db.get('SELECT pinnedRooms FROM users WHERE username = ?', [hostUsername], (err, userRow) => {
              if (!err && userRow) {
                try {
                  const pinned = JSON.parse(userRow.pinnedRooms || '[]');
                  const filtered = pinned.filter(id => id !== roomId);
                  if (pinned.length !== filtered.length) {
                    db.run('UPDATE users SET pinnedRooms = ? WHERE username = ?', [JSON.stringify(filtered), hostUsername], function(err) {
                      if (err) console.error(`[DELETE ROOM] Error updating host pinnedRooms:`, err.message);
                      else console.log(`[DELETE ROOM] Updated host ${hostUsername} pinned list`);
                    });
                  }
                } catch(e) {
                  console.error(`[DELETE ROOM] Error parsing pinnedRooms for ${hostUsername}:`, e.message);
                }
              }
            });
          }
        });
    });
  });



  // ─── Unsend message (delete for everyone) ───
  socket.on('message:unsend', async ({ messageId, username: payloadUsername, timestamp: fallbackTs }) => {
    const username = socket.username || payloadUsername;
    if (!username || !messageId) return;

    try {
      let msg = await queryGet('SELECT id, "senderName", "targetName", "roomId", type, timestamp FROM messages WHERE id = ?', [messageId]);
      // Fallback: if the client sent a socket-based id (pre-fix sessions), look up by timestamp + sender
      if (!msg && fallbackTs) {
        msg = await queryGet('SELECT id, "senderName", "targetName", "roomId", type, timestamp FROM messages WHERE timestamp = ? AND "senderName" = ?', [fallbackTs, username]);
      }
      if (!msg) return;
      if ((msg.senderName || '').toLowerCase() !== username.toLowerCase()) return;

      await pool.query('DELETE FROM messages WHERE id = $1', [msg.id]);

      const payload = { messageId: String(msg.id), timestampId: String(msg.timestamp) };

      if (msg.type === 'private') {
        emitToUser(msg.senderName, 'message:unsent', payload);
        if (msg.targetName) emitToUser(msg.targetName, 'message:unsent', payload);
      } else {
        io.in(msg.roomId).emit('message:unsent', payload);
        // Also reach the sender's sockets that aren't joined to the room socket
        // room (e.g. a Global Chat tab), so all of their open views update.
        emitToUser(msg.senderName, 'message:unsent', payload);
        const room = rooms.get(msg.roomId);
        if (room) {
          const idx = room.groupMessages.findIndex(m => String(m.id) === String(msg.id) || String(m.dbId) === String(msg.id));
          if (idx !== -1) room.groupMessages.splice(idx, 1);
        }
      }
    } catch (err) {
      console.error('[message:unsend] Error:', err);
    }
  });

  // ─── Delete for me (hides message only for the requesting user) ───
  socket.on('message:delete-for-me', async ({ messageId, username: payloadUsername, timestamp: fallbackTs }) => {
    const username = socket.username || payloadUsername;
    if (!username || !messageId) return;

    try {
      let msg = await queryGet('SELECT id, "hiddenFor", timestamp FROM messages WHERE id = ?', [messageId]);
      // Fallback: if the client sent a socket-based id (pre-fix sessions), look up by timestamp
      if (!msg && fallbackTs) {
        msg = await queryGet('SELECT id, "hiddenFor", timestamp FROM messages WHERE timestamp = ?', [fallbackTs]);
      }
      if (!msg) {
        // Broadcast to ALL of this user's sockets (Global Chat + Room chat tabs)
        emitToUser(username, 'message:removed-for-me', { messageId });
        return;
      }

      let hiddenFor = [];
      try { hiddenFor = JSON.parse(msg.hiddenFor || '[]'); } catch {}
      if (!hiddenFor.includes(username)) hiddenFor.push(username);

      await pool.query('UPDATE messages SET "hiddenFor" = $1 WHERE id = $2', [JSON.stringify(hiddenFor), msg.id]);
      // Broadcast to ALL of this user's sockets so every open component (Global
      // Chat widget, Room chat panel, other tabs) hides the message in real time.
      emitToUser(username, 'message:removed-for-me', { messageId: String(msg.id), originalId: String(messageId), timestampId: String(msg.timestamp) });
    } catch (err) {
      console.error('[message:delete-for-me] Error:', err);
      emitToUser(username, 'message:removed-for-me', { messageId: String(messageId) });
    }
  });

  // ─── Live Reactions ───
  socket.on('room_reaction', (data) => {
    if (!data?.roomId || !data?.emoji) return;
    io.to(data.roomId).emit('room_reaction', {
      id: Date.now() + Math.random(),
      emoji: data.emoji,
      username: data.username || 'Someone',
      avatarUrl: data.avatarUrl || '',
      timestamp: Date.now()
    });
  });

  // ─── Media Position Save (host only) ───
  socket.on('media_position_save', (data) => {
    const { roomId: rawRoomId, url, position, mediaType } = data || {};
    const roomId = (rawRoomId || '').toLowerCase();
    if (!roomId || !url || position === undefined) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const isHostById = room.hostId === socket.id;
    const isHostByName = room.hostUsername && socket.username &&
      room.hostUsername.toLowerCase() === socket.username.toLowerCase();
    if (!isHostById && !isHostByName) return;

    const pos = parseFloat(position) || 0;
    room.lastMediaUrl = url;
    room.lastMediaPosition = pos;
    room.lastMediaType = mediaType || null;
    room.lastMediaSavedAt = new Date().toISOString();

    db.run(
      'UPDATE room_names SET last_media_url = ?, last_media_position = ?, last_media_type = ?, last_media_saved_at = ? WHERE roomId = ?',
      [url, pos, mediaType || null, room.lastMediaSavedAt, roomId]
    );
  });

  // ─── Disconnect ───
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    clearTimeout(typingTimers[socket.id]);

    // ─── Audio Ducking: remove from speaking set so ducking doesn't get stuck ───
    for (const [roomId, set] of roomSpeakingUsers.entries()) {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        if (set.size === 0) {
          io.to(roomId).emit('audio_ducking_restore');
        }
      }
    }

    // ─── Clean up pending join requests ───
    // If this socket was waiting for approval, notify all room admins to dismiss the toast
    for (const [roomId, room] of rooms.entries()) {
      if (room.pendingJoins && room.pendingJoins.has(socket.id)) {
        const pending = room.pendingJoins.get(socket.id);
        console.log(`[Security] Pending joiner ${pending.username} (${socket.id}) disconnected - cleaning up`);
        room.pendingJoins.delete(socket.id);
        // Notify all admins in the room to dismiss the join request toast
        room.users.forEach(u => {
          const uIsHost = (u.socketId === room.hostId) || (room.hostUsername && u.username && room.hostUsername.toLowerCase() === u.username.toLowerCase());
          const uIsAutoAdmin = room.settings?.newMembersAdmins && u.username && u.username !== 'Anonymous' && !u.username.toLowerCase().startsWith('guest_');
          if (uIsHost || uIsAutoAdmin) {
            io.to(u.socketId).emit('join_request_handled', { socketId: socket.id, username: pending.username });
          }
        });
      }
    }

    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        // ── Save media position when host disconnects ──
        if (room.hostId === socket.id && room.currentMedia) {
          const mType = detectMediaTypeServer(room.currentMedia);
          if (mType) {
            const pos = room.isPlaying
              ? room.currentTime + (Date.now() - room.timestampUpdatedAt) / 1000
              : room.currentTime;
            room.lastMediaUrl = room.currentMedia;
            room.lastMediaPosition = pos;
            room.lastMediaType = mType;
            room.lastMediaSavedAt = new Date().toISOString();
            db.run(
              'UPDATE room_names SET last_media_url = ?, last_media_position = ?, last_media_type = ?, last_media_saved_at = ? WHERE roomId = ?',
              [room.currentMedia, pos, mType, room.lastMediaSavedAt, socket.roomId]
            );
          } else {
            // Non-resumable media (local stream/blob) was last active — clear stale saved URL
            // so the host doesn't get an old YouTube/URL auto-resumed on next join
            room.lastMediaUrl = null;
            room.lastMediaPosition = 0;
            room.lastMediaType = null;
            room.lastMediaSavedAt = null;
            db.run(
              'UPDATE room_names SET last_media_url = NULL, last_media_position = 0, last_media_type = NULL, last_media_saved_at = NULL WHERE roomId = ?',
              [socket.roomId]
            );
          }
        }

        room.users = room.users.filter(u => u.socketId !== socket.id);
        delete room.publicKeys[socket.id];

        if (room.hostId === socket.id && room.users.length > 0) {
          // Find the first non-guest user to transfer host privileges
          const nextHost = room.users.find(u => (u.username && !u.username.toLowerCase().startsWith('guest_') && u.username !== 'Anonymous'));
          
          if (nextHost) {
            room.hostId = nextHost.socketId;
            const newHostName = nextHost.username;
            io.to(room.hostId).emit('you_are_now_host');
            io.in(socket.roomId).emit('host_changed', { newHostId: room.hostId, newHostName });
          } else {
            // Only guests remain, or no users. No host is assigned.
            room.hostId = null;
            io.in(socket.roomId).emit('host_changed', { newHostId: null, newHostName: null });
          }
        } else if (room.users.length === 0) {
          // Room is completely empty, clear state
          room.currentMedia = null;
          room.currentTime = 0;
          room.isPlaying = false;
          room.hostId = null;

          // COST CONTROL (trigger c): End any Hyperbeam session when the last user leaves
          // This runs entirely server-side — no frontend dependency
          if (activeHyperbeamSessions.has(socket.roomId)) {
            const hbSession = activeHyperbeamSessions.get(socket.roomId);
            const apiKey = process.env.HYPERBEAM_API_KEY;
            if (apiKey) {
              fetch(`${HB_API}/${hbSession.session_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${apiKey}` }
              }).catch(e => console.error('[HYPERBEAM] Auto-cleanup error:', e.message));
            }
            activeHyperbeamSessions.delete(socket.roomId);
            const ts = new Date().toISOString();
            console.log(`[HYPERBEAM] Session ended (room empty): ${hbSession.session_id} at ${ts}`);
          }
        }
        io.in(socket.roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });
        socket.to(socket.roomId).emit('user_left', { username: socket.username, count: room.users.length });

        // NOTE: We intentionally do NOT clear approvedUsers/approvedSockets on disconnect.
        // Disconnects can be caused by page refresh or network drops — the user is still
        // considered "in the room" and should rejoin seamlessly.
        // Approval is only cleared via the explicit 'leave_room' event (intentional exit).
        if (room.approvedSockets) room.approvedSockets.delete(socket.id);
      }
    }
    for (const [roomId, room] of rooms.entries()) {
      if (room.screenshareHostId === socket.id) { room.screenshareHostId = null; socket.to(roomId).emit('webrtc_screenshare_stopped'); }
    }
  });

  // ─── Hyperbeam Cloud Browser sync events ─────────────────────────────────
  // Relay cloud browser open/close to all other room members so they all show
  // the same Hyperbeam iframe. The API key never passes through these events.
  socket.on('hyperbeam_opened', ({ roomId, session_id, embed_url, targetUrl }) => {
    if (!roomId) return;
    socket.to(roomId.toLowerCase()).emit('hyperbeam_opened', { session_id, embed_url, targetUrl });
  });

  socket.on('hyperbeam_closed', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId.toLowerCase()).emit('hyperbeam_closed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// CHAT LOCK — Secure PIN-based chat privacy
// ═══════════════════════════════════════════════════════════════════
const chatLockRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.username || req['ip'],
  validate: false,
  handler: (req, res) => {
    const blockedUntil = Date.now() + 30 * 1000;
    // Persist block to DB
    pool.query(
      'UPDATE users SET "chat_lock_blocked_until" = $1 WHERE LOWER(username) = LOWER($2)',
      [blockedUntil, req.user?.username || '']
    ).catch(() => {});
    res.status(429).json({ error: 'Too many attempts. Try again in 30 seconds.', blockedUntil });
  },
  skipSuccessfulRequests: true,
});

// POST /api/chat-lock/setup — hash PIN + recovery key, enable lock
app.post('/api/chat-lock/setup', authenticateToken, async (req, res) => {
  const { pin, recoveryKey } = req.body;
  if (!pin || !/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
  if (!recoveryKey || recoveryKey.length < 16) return res.status(400).json({ error: 'Invalid recovery key' });
  try {
    const [pinHash, recoveryHash] = await Promise.all([
      bcrypt.hash(pin, 12),
      bcrypt.hash(recoveryKey.toUpperCase(), 12),
    ]);
    await pool.query(
      `UPDATE users SET
         "chat_lock_enabled" = TRUE,
         "chat_lock_pin_hash" = $1,
         "chat_lock_recovery_hash" = $2,
         "chat_lock_attempts" = 0,
         "chat_lock_blocked_until" = NULL
       WHERE LOWER(username) = LOWER($3)`,
      [pinHash, recoveryHash, req.user.username]
    );
    invalidateCacheForUser(req.user.username);
    return res.json({ success: true });
  } catch (err) {
    console.error('[chat-lock/setup]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/chat-lock/verify — check PIN, enforce rate limit
app.post('/api/chat-lock/verify', authenticateToken, chatLockRateLimit, async (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'Invalid PIN format' });
  try {
    const result = await pool.query(
      'SELECT "chat_lock_pin_hash","chat_lock_attempts","chat_lock_blocked_until","chat_lock_enabled" FROM users WHERE LOWER(username) = LOWER($1)',
      [req.user.username]
    );
    const user = result.rows[0];
    if (!user || !user.chat_lock_enabled) return res.status(400).json({ error: 'Chat Lock is not enabled' });

    const now = Date.now();
    if (user.chat_lock_blocked_until && Number(user.chat_lock_blocked_until) > now) {
      return res.status(429).json({ error: 'Too many attempts', blockedUntil: Number(user.chat_lock_blocked_until) });
    }

    const valid = await bcrypt.compare(pin, user.chat_lock_pin_hash);
    if (valid) {
      await pool.query('UPDATE users SET "chat_lock_attempts"=0, "chat_lock_blocked_until"=NULL WHERE LOWER(username)=LOWER($1)', [req.user.username]);
      return res.json({ success: true });
    }

    // Wrong PIN
    const newAttempts = (Number(user.chat_lock_attempts) || 0) + 1;
    const updates = { '"chat_lock_attempts"': newAttempts };
    let blockedUntil = null;
    if (newAttempts >= 3) {
      blockedUntil = now + 30 * 1000;
      updates['"chat_lock_blocked_until"'] = blockedUntil;
    }
    await pool.query(
      `UPDATE users SET "chat_lock_attempts"=$1, "chat_lock_blocked_until"=$2 WHERE LOWER(username)=LOWER($3)`,
      [newAttempts, blockedUntil, req.user.username]
    );
    const attemptsLeft = Math.max(0, 4 - newAttempts);
    if (blockedUntil && newAttempts === 3) return res.status(429).json({ error: 'Too many attempts. Locked for 30 seconds.', blockedUntil });
    
    if (newAttempts >= 4) {
      // Self-destruct logic will be triggered by frontend after receiving this error
      return res.status(403).json({ error: 'SELF_DESTRUCT_TRIGGERED', message: 'Final attempt failed. All data wiped.' });
    }

    return res.status(401).json({ error: 'Incorrect PIN', attemptsLeft });
  } catch (err) {
    console.error('[chat-lock/verify]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/chat-lock/verify-recovery — check Recovery Key
app.post('/api/chat-lock/verify-recovery', authenticateToken, async (req, res) => {
  const { recoveryKey } = req.body;
  if (!recoveryKey || recoveryKey.length < 16) return res.status(400).json({ error: 'Invalid recovery key' });
  try {
    const result = await pool.query('SELECT "chat_lock_recovery_hash" FROM users WHERE LOWER(username) = LOWER($1)', [req.user.username]);
    const user = result.rows[0];
    if (!user || !user.chat_lock_recovery_hash) return res.status(400).json({ error: 'Recovery key not set up' });

    const valid = await bcrypt.compare(recoveryKey.toUpperCase().replace(/-/g, ''), user.chat_lock_recovery_hash);
    if (valid) {
      await pool.query('UPDATE users SET "chat_lock_attempts"=0, "chat_lock_blocked_until"=NULL WHERE LOWER(username)=LOWER($1)', [req.user.username]);
      return res.json({ success: true });
    }
    return res.status(401).json({ error: 'Invalid recovery key' });
  } catch (err) {
    console.error('[chat-lock/verify-recovery]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/chat-lock/self-destruct — WIPE EVERYTHING for this user
app.post('/api/chat-lock/self-destruct', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username;
    // 1. Delete only LOCKED chats (DMs or Group messages that are marked as locked)
    await pool.query('DELETE FROM messages WHERE ("senderName" = $1 OR "targetName" = $1) AND "is_chat_locked" = TRUE', [username]);
    // 2. Clear locked/hidden status for the user
    await pool.query('UPDATE users SET "chat_lock_enabled" = FALSE, "chat_lock_pin_hash" = NULL, "chat_lock_recovery_hash" = NULL, "chat_lock_attempts" = 0, "chat_lock_blocked_until" = NULL WHERE LOWER(username) = LOWER($1)', [username]);
    
    invalidateCacheForUser(username);
    return res.json({ success: true, message: 'All data has been securely wiped.' });
  } catch (err) {
    console.error('[chat-lock/self-destruct]', err);
    return res.status(500).json({ error: 'Failed to wipe data' });
  }
});

// POST /api/chat-lock/disable — verify PIN then disable
app.post('/api/chat-lock/disable', authenticateToken, async (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'Invalid PIN' });
  try {
    const result = await pool.query('SELECT "chat_lock_pin_hash" FROM users WHERE LOWER(username)=LOWER($1)', [req.user.username]);
    const user = result.rows[0];
    if (!user?.chat_lock_pin_hash) return res.status(400).json({ error: 'Chat Lock is not set up' });
    const valid = await bcrypt.compare(pin, user.chat_lock_pin_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect PIN' });
    await pool.query(
      `UPDATE users SET "chat_lock_enabled"=FALSE, "chat_lock_pin_hash"=NULL, "chat_lock_recovery_hash"=NULL, "chat_lock_attempts"=0, "chat_lock_blocked_until"=NULL WHERE LOWER(username)=LOWER($1)`,
      [req.user.username]
    );
    // Also unlock all locked chats for this user
    await pool.query('UPDATE messages SET "is_chat_locked"=FALSE WHERE "senderName"=$1 OR "targetName"=$1', [req.user.username]).catch(() => {});
    invalidateCacheForUser(req.user.username);
    return res.json({ success: true });
  } catch (err) {
    console.error('[chat-lock/disable]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/chat-lock/status — return lock enabled + auto-lock settings
app.get('/api/chat-lock/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT "chat_lock_enabled" FROM users WHERE LOWER(username)=LOWER($1)',
      [req.user.username]
    );
    const user = result.rows[0];
    const autoLockMinutes = parseInt(req.query.autoLockMinutes) || 5;
    return res.json({
      enabled: !!(user?.chat_lock_enabled),
      autoLockMinutes,
    });
  } catch (err) {
    console.error('[chat-lock/status]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/chat-lock/settings — store auto-lock preference (server-side stub; primary storage is localStorage)
app.put('/api/chat-lock/settings', authenticateToken, async (req, res) => {
  // Auto-lock timing is a client-side UX concern; just ack.
  return res.json({ success: true });
});

// POST /api/chat-lock/toggle-chat — lock or unlock a specific chat (private DM or room)
app.post('/api/chat-lock/toggle-chat', authenticateToken, async (req, res) => {
  const { chatId, lock, pin } = req.body; // chatId = partner username or roomId
  if (!chatId) return res.status(400).json({ error: 'chatId required' });
  try {
    // Always verify PIN before any lock toggle to prevent brute-force exposure
    const result = await pool.query('SELECT "chat_lock_pin_hash","chat_lock_enabled" FROM users WHERE LOWER(username)=LOWER($1)', [req.user.username]);
    const user = result.rows[0];
    if (!user?.chat_lock_enabled) return res.status(400).json({ error: 'Chat Lock not enabled' });
    
    // Only verify PIN if UNLOCKING (lock === false). 
    // Locking is allowed silently for better UX.
    if (lock === false) {
      if (!pin || !(await bcrypt.compare(pin, user.chat_lock_pin_hash))) {
        return res.status(401).json({ error: 'Incorrect PIN' });
      }
    }

    const username = req.user.username.toLowerCase();
    // Mark/unmark messages as locked in DB
    // For private chats: identify by senderName/targetName pair
    // For group chats: identify by roomId
    const isRoom = chatId.startsWith('room-') || chatId.length === 36 || chatId.includes('-');
    if (isRoom) {
      await pool.query('UPDATE messages SET "is_chat_locked"=$1 WHERE "roomId"=$2', [!!lock, chatId]);
    } else {
      const partner = chatId.toLowerCase();
      await pool.query(
        `UPDATE messages SET "is_chat_locked"=$1 WHERE (LOWER("senderName")=$2 AND LOWER("targetName")=$3) OR (LOWER("senderName")=$3 AND LOWER("targetName")=$2)`,
        [!!lock, username, partner]
      );
    }
    return res.json({ success: true, locked: !!lock });
  } catch (err) {
    console.error('[chat-lock/toggle-chat]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/chat-lock/recovery-phrase — return recovery key hash (Wait, we need the actual phrase for the user to view it? No, we only store the HASH!)
// Actually, the user wants to VIEW the Master Key they were given.
// If we only store the hash, they CANNOT view it later unless they saved it.
// However, the signup flow gives them the phrase.
// If they want to "view" it later, we would have needed to store it (encrypted).
// Current schema only has "chat_lock_recovery_hash".

// But wait! signup-keys stores "recoveryKeyHash".
// So "View Master Key" is only possible if they have it.

// Wait! If they are ALREADY UNLOCKED, maybe we can show them a way to generate a NEW one?
// For now, I'll return a "Not supported" or "Check your saved records" message if I can't retrieve it.
// BUT WAIT! Signup.jsx: phrase = secretKeyToMnemonic(keyPair.secretKey).
// If they have their private key in session, they CAN view their master key!

app.get('/api/chat-lock/recovery-phrase', authenticateToken, async (req, res) => {
  // We don't store the raw phrase, so we can't return it from DB.
  // The client must derive it from their own secret key (which they have if they are logged in).
  return res.json({ message: 'Derive on client' });
});

// POST /api/chat-lock/recover-with-key — reset PIN using 32-char recovery key
app.post('/api/chat-lock/recover-with-key', authenticateToken, async (req, res) => {
  const { recoveryKey, newPin } = req.body;
  if (!newPin || !/^\d{6}$/.test(newPin)) return res.status(400).json({ error: 'New PIN must be 6 digits' });
  if (!recoveryKey || recoveryKey.length < 16) return res.status(400).json({ error: 'Invalid recovery key' });
  try {
    const result = await pool.query('SELECT "chat_lock_recovery_hash" FROM users WHERE LOWER(username)=LOWER($1)', [req.user.username]);
    const user = result.rows[0];
    if (!user?.chat_lock_recovery_hash) return res.status(400).json({ error: 'No recovery key registered' });
    const valid = await bcrypt.compare(recoveryKey.toUpperCase(), user.chat_lock_recovery_hash);
    if (!valid) return res.status(401).json({ error: 'Recovery key is incorrect' });
    const newPinHash = await bcrypt.hash(newPin, 12);
    await pool.query(
      `UPDATE users SET "chat_lock_pin_hash"=$1, "chat_lock_attempts"=0, "chat_lock_blocked_until"=NULL WHERE LOWER(username)=LOWER($2)`,
      [newPinHash, req.user.username]
    );
    invalidateCacheForUser(req.user.username);
    return res.json({ success: true });
  } catch (err) {
    console.error('[chat-lock/recover-with-key]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/chat-lock/request-email-reset — send OTP to user's email
app.post('/api/chat-lock/request-email-reset', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT email, username FROM users WHERE LOWER(username)=LOWER($1)', [req.user.username]);
    const user = result.rows[0];
    if (!user?.email) return res.status(400).json({ error: 'No email associated with account' });

    const token = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12-char hex OTP
    const expiry = Date.now() + 15 * 60 * 1000; // 15 min
    const tokenHash = await bcrypt.hash(token, 10);

    await pool.query(
      `UPDATE users SET "chat_lock_reset_token"=$1, "chat_lock_reset_token_expiry"=$2 WHERE LOWER(username)=LOWER($3)`,
      [tokenHash, expiry, req.user.username]
    );

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"SahaPlay" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Chat Lock PIN Reset Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f0f1e;color:#fff;padding:32px;border-radius:16px;">
          <h2 style="color:#818cf8;margin:0 0 16px">Chat Lock Reset</h2>
          <p style="color:#94a3b8;margin:0 0 24px">Your one-time PIN reset code:</p>
          <div style="background:#1a1a2e;border:1px solid rgba(129,140,248,0.3);border-radius:12px;padding:20px;text-align:center;font-size:28px;font-weight:800;letter-spacing:0.25em;color:#c7d2fe;font-family:monospace;">${token}</div>
          <p style="color:#475569;font-size:13px;margin:20px 0 0">Expires in 15 minutes. Do not share this code.</p>
        </div>
      `,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[chat-lock/request-email-reset]', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

// POST /api/chat-lock/reset-with-email — verify OTP and set new PIN
app.post('/api/chat-lock/reset-with-email', authenticateToken, async (req, res) => {
  const { token: otpToken, newPin } = req.body;
  if (!newPin || !/^\d{6}$/.test(newPin)) return res.status(400).json({ error: 'New PIN must be 6 digits' });
  if (!otpToken) return res.status(400).json({ error: 'Reset code required' });
  try {
    const result = await pool.query(
      'SELECT "chat_lock_reset_token","chat_lock_reset_token_expiry" FROM users WHERE LOWER(username)=LOWER($1)',
      [req.user.username]
    );
    const user = result.rows[0];
    if (!user?.chat_lock_reset_token) return res.status(400).json({ error: 'No reset code requested' });
    if (Number(user.chat_lock_reset_token_expiry) < Date.now()) {
      return res.status(400).json({ error: 'Reset code has expired. Request a new one.' });
    }
    const valid = await bcrypt.compare(otpToken.toUpperCase(), user.chat_lock_reset_token);
    if (!valid) return res.status(401).json({ error: 'Invalid reset code' });

    const newPinHash = await bcrypt.hash(newPin, 12);
    await pool.query(
      `UPDATE users SET "chat_lock_pin_hash"=$1, "chat_lock_reset_token"=NULL, "chat_lock_reset_token_expiry"=NULL, "chat_lock_attempts"=0, "chat_lock_blocked_until"=NULL WHERE LOWER(username)=LOWER($2)`,
      [newPinHash, req.user.username]
    );
    invalidateCacheForUser(req.user.username);
    return res.json({ success: true });
  } catch (err) {
    console.error('[chat-lock/reset-with-email]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/chat-lock/locked-chats — return list of chatIds that are locked for this user
app.get('/api/chat-lock/locked-chats', authenticateToken, async (req, res) => {
  try {
    const username = req.user.username.toLowerCase();
    const result = await pool.query(
      `SELECT DISTINCT
         CASE
           WHEN LOWER("senderName") = $1 THEN LOWER("targetName")
           ELSE LOWER("senderName")
         END AS partner,
         "roomId"
       FROM messages
       WHERE "is_chat_locked" = TRUE
         AND (LOWER("senderName") = $1 OR LOWER("targetName") = $1)`,
      [username]
    );
    const locked = result.rows.map(r => r.partner || r.roomId).filter(Boolean);
    return res.json({ lockedChats: [...new Set(locked)] });
  } catch (err) {
    console.error('[chat-lock/locked-chats]', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

// ─── Contact Form ─────────────────────────────────────────────────────────────
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { success: false, error: 'Too many messages sent. Please wait an hour before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function mapContactSubjectToType(subject) {
  const s = (subject || '').toLowerCase();
  if (s.includes('safety') || s.includes('report user')) return 'safety';
  if (s.includes('bug') || s.includes('bug report')) return 'bug';
  if (s.includes('account')) return 'account';
  if (s.includes('billing') || s.includes('payment') || s.includes('pricing')) return 'billing';
  return 'contact';
}

function mapContactSubjectToPriority(subject) {
  const s = (subject || '').toLowerCase();
  if (s.includes('safety') || s.includes('urgent') || s.includes('critical')) return 'urgent';
  if (s.includes('bug') || s.includes('error') || s.includes('broken')) return 'high';
  if (s.includes('feature') || s.includes('general')) return 'low';
  return 'medium';
}

function mapBugSeverityToPriority(severity) {
  if (severity === 'critical') return 'urgent';
  if (severity === 'major') return 'high';
  return 'medium';
}

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, subject, message, images, lang } = req.body;

  // ── Validation ──────────────────────────────────────
  const trim  = (v) => (v ? String(v).trim() : '');
  const cName    = trim(name);
  const cEmail   = trim(email).toLowerCase();
  const cSubject = trim(subject);
  const cMsg     = trim(message);

  if (cName.length < 2)
    return res.status(400).json({ success: false, error: 'Name must be at least 2 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail))
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  if (!cSubject)
    return res.status(400).json({ success: false, error: 'Subject is required.' });
  if (cMsg.length < 10)
    return res.status(400).json({ success: false, error: 'Message must be at least 10 characters.' });

  // ── Image validation ─────────────────────────────────
  const attachments = [];
  if (Array.isArray(images) && images.length > 0) {
    if (images.length > 5)
      return res.status(400).json({ success: false, error: 'Maximum 5 images allowed.' });

    const OK_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img || !img.data || !img.type) continue;
      if (!OK_TYPES.includes(img.type))
        return res.status(400).json({ success: false, error: `Image ${i + 1}: only JPG, PNG, GIF, WEBP allowed.` });
      const raw   = img.data.replace(/^data:[^;]+;base64,/, '');
      const bytes = Math.ceil((raw.length * 3) / 4);
      if (bytes > 5 * 1024 * 1024)
        return res.status(400).json({ success: false, error: `Image ${i + 1} exceeds the 5 MB limit.` });
      attachments.push({
        filename:    img.name || `image-${i + 1}`,
        content:     raw,
        encoding:    'base64',
        contentType: img.type,
      });
    }
  }

  // ── HTML helpers ─────────────────────────────────────
  const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  // ── Notification email to sahaaplay@gmail.com ────────
  const notifyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#09090b">
<div style="max-width:600px;margin:40px auto;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px 40px">
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">📬 New Contact Message</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">via SahaPlay Contact Form</p>
  </div>
  <div style="padding:32px 40px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px;width:80px">From</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#fff;font-size:14px;font-weight:600">${esc(cName)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px"><a href="mailto:${cEmail}" style="color:#818cf8;text-decoration:none">${cEmail}</a></td></tr>
      <tr><td style="padding:10px 0;color:#9ca3af;font-size:13px">Subject</td>
          <td style="padding:10px 0;color:#fff;font-size:14px">${esc(cSubject)}</td></tr>
    </table>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:${attachments.length ? '16px' : '0'}">
      <p style="color:#9ca3af;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">Message</p>
      <p style="color:#e5e7eb;font-size:15px;line-height:1.75;margin:0">${esc(cMsg)}</p>
    </div>
    ${attachments.length ? `<p style="color:#9ca3af;font-size:13px;margin:0">📎 ${attachments.length} image${attachments.length > 1 ? 's' : ''} attached</p>` : ''}
  </div>
  <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
    <p style="color:#6b7280;font-size:12px;margin:0">Reply to this email to respond directly to <strong>${esc(cName)}</strong> at ${cEmail}</p>
  </div>
</div>
</body></html>`;

  // ── Confirmation email to the user ───────────────────
  const userLang = lang || 'en';
  const L = emailTranslations[userLang] || emailTranslations['en'] || {};

  const confirmHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px">SahaPlay Support</div>
        <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px">${L.emailContactSubtitle || 'We have received your message'}</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700">${L.emailContactTitle || 'Message Received'}</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">Hi <strong style="color:#111827">${esc(cName)}</strong>,</p>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      ${L.emailContactBody || 'Thank you for reaching out. We have received your message and a member of our team will review it and respond within 48 hours.'}
    </p>
    <!-- Message Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px">
        <p style="margin:0 0 10px;color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${L.emailContactYourMsg || 'Your Message'}</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.75">${esc(cMsg)}</p>
      </td></tr>
    </table>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
      ${L.emailContactUrgent || 'For urgent matters, you may also contact us at'} <a href="mailto:sahaaplay@gmail.com" style="color:#6366f1;text-decoration:none;font-weight:600">sahaaplay@gmail.com</a>.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated confirmation from <strong>SahaPlay</strong>. Please do not reply directly to this email.</p>
    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  // ── Save to support_requests DB ─────────────────────────────────────────────
  let dbRequestId = null;
  try {
    const dbAttachments = attachments.length > 0
      ? attachments.map(a => ({ filename: a.filename, type: a.contentType, data: `data:${a.contentType};base64,${a.content}` }))
      : null;
    const dbInsert = await pool.query(
      `INSERT INTO support_requests (request_type, subject, message, submitted_by_email, submitted_by_name, priority, status, attachments, metadata, email_notification_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, 'pending') RETURNING id`,
      [
        mapContactSubjectToType(cSubject), cSubject, cMsg, cEmail, cName,
        mapContactSubjectToPriority(cSubject),
        dbAttachments ? JSON.stringify(dbAttachments) : null,
        JSON.stringify({ source: 'contact_form', lang: lang || 'en', attachmentCount: attachments.length }),
      ]
    );
    dbRequestId = dbInsert.rows[0]?.id;
    if (dbRequestId) broadcastAdminBadges();
  } catch (dbErr) {
    console.error('[contact] DB save error (non-fatal):', dbErr.message);
  }

  // ── Guard: no email credentials → still saved to DB ─────────────────────
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    if (dbRequestId) {
      return res.json({ success: true, message: L.apiContactSuccess || 'Message received! Our team will follow up soon.' });
    }
    console.error('[contact] Gmail credentials missing from .env!');
    return res.status(500).json({ success: false, error: 'Email service not configured. Please email sahaaplay@gmail.com directly.' });
  }

  // ── Fire both emails non-blocking so the response is instant ──
  // Data is already saved to DB — email failures are non-fatal.
  gmailTransporter.sendMail({
    from:     `"SahaPlay Contact" <${process.env.GMAIL_USER}>`,
    replyTo:  `"${cName}" <${cEmail}>`,
    to:       process.env.GMAIL_USER,
    subject:  `[SahaPlay Contact] ${cSubject}`,
    html:     notifyHtml,
    text:     `From: ${cName} <${cEmail}>\nSubject: ${cSubject}\n\n${cMsg}`,
    attachments,
  }).then(() => {
    if (dbRequestId) {
      pool.query(`UPDATE support_requests SET email_notification_status = 'sent', updated_at = NOW() WHERE id = $1`, [dbRequestId]).catch(() => {});
    }
  }).catch(err => {
    console.warn('[contact] Admin notification email failed (non-fatal):', err.message);
    if (dbRequestId) {
      pool.query(`UPDATE support_requests SET email_notification_status = 'failed', email_notification_error = $1, updated_at = NOW() WHERE id = $2`, [err.message.substring(0, 500), dbRequestId]).catch(() => {});
    }
  });

  sendEmail({
    to:      cEmail,
    subject: L.emailContactSubject || 'We received your message — SahaPlay',
    html:    confirmHtml,
    text:    `${L.emailContactHi || 'Hi'} ${cName},\n\n${L.emailContactBody || 'Thanks for reaching out! We received your message and will get back to you within 48 hours.'}\n\n${L.emailContactYourMsg || 'Your message'}:\n${cMsg}\n\n— ${L.emailContactFooter || 'SahaPlay Team'}`,
  }).catch(e => console.warn('[contact] Confirmation email failed (non-fatal):', e.message));

  return res.json({ success: true, message: L.apiContactSuccess || 'Message sent!' });
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── Bug Report ───────────────────────────────────────────────────────────────
const bugReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, error: 'Too many bug reports submitted. Please wait an hour before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ALLOWED_BUG_TYPES = [
  'video-sync', 'chat', 'login', 'mobile', 'notif', 'audio',
  'camera', 'crash', 'perf', 'ui', 'link', 'security', 'other',
];

const BUG_TYPE_LABELS = {
  'video-sync': 'Video / Sync Issue',
  'chat':       'Chat Not Working',
  'login':      'Login / Account Problem',
  'mobile':     'Mobile / Responsive Layout',
  'notif':      'Notifications Not Working',
  'audio':      'Audio / Microphone Issue',
  'camera':     'Camera / Screenshare Issue',
  'crash':      'App Crashing / Freezing',
  'perf':       'Performance / Slow Loading',
  'ui':         'UI / Visual Glitch',
  'link':       'Link / URL Problem',
  'security':   'Security Concern',
  'other':      'Other Bug',
};

app.post('/api/report-bug', bugReportLimiter, async (req, res) => {
  const { name, email, bugType, severity, whatHappened, whatExpected, actualResult,
          stepsToReproduce, browser, os, screenSize, consoleErrors, attachments, lang } = req.body;

  // ── Lang + translations ────────────────────────────────
  const bugUserLang = lang || 'en';
  const L = emailTranslations[bugUserLang] || emailTranslations['en'] || {};

  // ── Validation ──────────────────────────────────────
  const trim = (v) => (v ? String(v).trim() : '');
  const rName          = trim(name);
  const rEmail         = trim(email).toLowerCase();
  const rBugType       = trim(bugType);
  const rSeverity      = trim(severity).toLowerCase();
  const rWhatHappened  = trim(whatHappened);
  const rWhatExpected  = trim(whatExpected);
  const rActualResult  = trim(actualResult);
  const rSteps         = trim(stepsToReproduce);
  const rBrowser       = trim(browser);
  const rOs            = trim(os);
  const rScreenSize    = trim(screenSize);
  const rConsoleErrors = trim(consoleErrors);

  if (rName.length < 2)
    return res.status(400).json({ success: false, error: L.apiBugErrorName || 'Name must be at least 2 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rEmail))
    return res.status(400).json({ success: false, error: L.apiBugErrorEmail || 'Please provide a valid email address.' });
  if (!ALLOWED_BUG_TYPES.includes(rBugType))
    return res.status(400).json({ success: false, error: L.apiBugErrorType || 'Please select a valid bug type.' });
  if (!['minor', 'major', 'critical'].includes(rSeverity))
    return res.status(400).json({ success: false, error: L.apiBugErrorSeverity || 'Please select a severity level.' });
  if (rWhatHappened.length < 20)
    return res.status(400).json({ success: false, error: L.apiBugErrorHappened || 'Please describe what happened (min 20 characters).' });
  if (rWhatExpected.length < 10)
    return res.status(400).json({ success: false, error: L.apiBugErrorExpected || 'Please describe what you expected (min 10 characters).' });
  if (rActualResult.length < 10)
    return res.status(400).json({ success: false, error: L.apiBugErrorActual || 'Please describe what actually happened (min 10 characters).' });
  if (!rBrowser)
    return res.status(400).json({ success: false, error: L.apiBugErrorBrowser || 'Please enter your browser.' });
  if (!rOs)
    return res.status(400).json({ success: false, error: L.apiBugErrorOs || 'Please enter your operating system.' });

  const bugTypeLabel = BUG_TYPE_LABELS[rBugType] || rBugType;

  // ── Attachment validation ────────────────────────────
  const emailAttachments = [];
  if (Array.isArray(attachments) && attachments.length > 0) {
    if (attachments.length > 5)
      return res.status(400).json({ success: false, error: 'Maximum 5 attachments allowed.' });

    const OK_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      if (!att || !att.data || !att.type) continue;
      if (!OK_TYPES.includes(att.type))
        return res.status(400).json({ success: false, error: `File ${i + 1}: only images (JPG, PNG, GIF, WEBP) and videos (MP4, WEBM) are allowed.` });
      const raw   = att.data.replace(/^data:[^;]+;base64,/, '');
      const bytes = Math.ceil((raw.length * 3) / 4);
      if (bytes > 10 * 1024 * 1024)
        return res.status(400).json({ success: false, error: `File ${i + 1} exceeds the 10 MB limit.` });
      emailAttachments.push({
        filename:    att.name || `attachment-${i + 1}`,
        content:     raw,
        encoding:    'base64',
        contentType: att.type,
      });
    }
  }

  // ── Save to support_requests DB ──────────────────────
  let dbRequestId = null;
  let reportId = 'BUG-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  const imgAttsForDb = emailAttachments
    .filter(a => a.contentType && a.contentType.startsWith('image/'))
    .map(a => ({ filename: a.filename, type: a.contentType, data: `data:${a.contentType};base64,${a.content}` }));

  try {
    const bugMsg = `What happened: ${rWhatHappened}\n\nExpected: ${rWhatExpected}\n\nActual: ${rActualResult}${rSteps ? `\n\nSteps: ${rSteps}` : ''}${rConsoleErrors ? `\n\nConsole errors: ${rConsoleErrors}` : ''}`;
    const dbInsert = await pool.query(
      `INSERT INTO support_requests (request_type, subject, message, submitted_by_email, submitted_by_name, priority, status, attachments, metadata, email_notification_status)
       VALUES ('bug', $1, $2, $3, $4, $5, 'open', $6, $7, 'pending') RETURNING id`,
      [
        `Bug Report: ${bugTypeLabel} [${rSeverity}]`,
        bugMsg, rEmail, rName,
        mapBugSeverityToPriority(rSeverity),
        imgAttsForDb.length > 0 ? JSON.stringify(imgAttsForDb) : null,
        JSON.stringify({ source: 'bug_report_form', bugType: rBugType, severity: rSeverity, browser: rBrowser, os: rOs, screenSize: rScreenSize, attachmentCount: emailAttachments.length }),
      ]
    );
    dbRequestId = dbInsert.rows[0]?.id;
    if (dbRequestId) {
      reportId = `BUG-${dbRequestId}`;
      broadcastAdminBadges();
    }
  } catch (dbErr) {
    console.error('[report-bug] DB save error (non-fatal):', dbErr.message);
  }

  // ── HTML helpers ─────────────────────────────────────
  const esc = (s) =>
    String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const severityMeta = {
    minor:    { bg: '#fef3c7', color: '#92400e', label: '🟡 Minor' },
    major:    { bg: '#fed7aa', color: '#9a3412', label: '🟠 Major' },
    critical: { bg: '#fee2e2', color: '#991b1b', label: '🔴 Critical' },
  }[rSeverity] || { bg: '#f3f4f6', color: '#374151', label: rSeverity };

  // ── Notification email to sahaaplay@gmail.com ─────────
  const bugSections = [
    { label: 'What were they doing?',  content: rWhatHappened },
    { label: 'What did they expect?',  content: rWhatExpected },
    { label: 'What actually happened?', content: rActualResult },
    ...(rSteps         ? [{ label: 'Steps to reproduce',   content: rSteps }]         : []),
    ...(rConsoleErrors ? [{ label: '⚠️ Console Errors',    content: rConsoleErrors, mono: true }] : []),
  ];

  const notifyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#09090b">
<div style="max-width:640px;margin:40px auto;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px">
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0">🐛 New Bug Report</h1>
    <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">${esc(reportId)} · via SahaPlay Bug Report Form</p>
  </div>
  <div style="padding:32px 40px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px;width:130px">Report ID</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)"><span style="font-family:monospace;background:rgba(99,102,241,0.15);color:#818cf8;padding:3px 10px;border-radius:6px;font-size:14px;font-weight:700">${esc(reportId)}</span></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Reporter</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#fff;font-size:14px;font-weight:600">${esc(rName)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Email</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:14px"><a href="mailto:${rEmail}" style="color:#818cf8;text-decoration:none">${rEmail}</a></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Severity</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)"><span style="background:${severityMeta.bg};color:${severityMeta.color};padding:3px 10px;border-radius:6px;font-size:13px;font-weight:700">${severityMeta.label}</span></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Bug Type</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#fff;font-size:14px">${esc(bugTypeLabel)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">Browser</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e5e7eb;font-size:14px">${esc(rBrowser)}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9ca3af;font-size:13px">OS</td>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e5e7eb;font-size:14px">${esc(rOs)}</td></tr>
      <tr><td style="padding:10px 0;color:#9ca3af;font-size:13px">Screen</td>
          <td style="padding:10px 0;color:#e5e7eb;font-size:14px">${esc(rScreenSize || 'Not provided')}</td></tr>
    </table>
    ${bugSections.map(({ label, content, mono }) => `
    <div style="background:${mono ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.03)'};border:1px solid ${mono ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'};border-radius:12px;padding:20px;margin-bottom:16px">
      <p style="color:${mono ? '#ef4444' : '#9ca3af'};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px">${esc(label)}</p>
      ${mono
        ? `<pre style="color:#fca5a5;font-size:13px;line-height:1.6;margin:0;white-space:pre-wrap;font-family:'Courier New',monospace">${esc(content)}</pre>`
        : `<p style="color:#e5e7eb;font-size:14px;line-height:1.75;margin:0">${esc(content)}</p>`}
    </div>`).join('')}
    ${emailAttachments.length ? `<p style="color:#9ca3af;font-size:13px;margin:0">📎 ${emailAttachments.length} attachment${emailAttachments.length > 1 ? 's' : ''} included</p>` : ''}
  </div>
  <div style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02)">
    <p style="color:#6b7280;font-size:12px;margin:0">Reply to this email to contact <strong>${esc(rName)}</strong> at ${rEmail}</p>
  </div>
</div>
</body></html>`;

  // ── Confirmation email to user ────────────────────────

  const confirmHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px">SahaPlay Bug Tracker</div>
        <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:2px">${L.emailBugSubtitle || 'Bug Report Confirmation'}</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700">${L.emailBugTitle || 'Bug Report Received'}</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">Hi <strong style="color:#111827">${esc(rName)}</strong>,</p>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      ${L.emailBugBody1 || 'We have received your bug report regarding'} <strong style="color:#6366f1">${esc(bugTypeLabel)}</strong>.
      ${L.emailBugBody2 || 'Our engineering team will investigate and you will be notified at this email address once it is resolved.'}
    </p>
    <!-- Report Details -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px">
        <p style="margin:0 0 14px;color:#6366f1;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${L.emailBugDetails || 'Report Details'}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:5px 0;width:110px">${L.emailBugReportId || 'Report ID'}</td>
            <td style="font-family:monospace;color:#6366f1;font-size:14px;font-weight:700;padding:5px 0">${esc(reportId)}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:5px 0">${L.emailBugType || 'Bug Type'}</td>
            <td style="color:#111827;font-size:14px;padding:5px 0">${esc(bugTypeLabel)}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding:5px 0">${L.emailBugSeverity || 'Severity'}</td>
            <td style="padding:5px 0"><span style="background:${severityMeta.bg};color:${severityMeta.color};padding:2px 10px;border-radius:4px;font-weight:700;font-size:12px;text-transform:uppercase">${severityMeta.label}</span></td>
          </tr>
        </table>
      </td></tr>
    </table>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.6">${L.emailBugHint || 'We will notify you at this email address when the issue is resolved.'}</p>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">${L.emailBugUrgent || 'For urgent matters:'} <a href="mailto:sahaaplay@gmail.com" style="color:#6366f1;text-decoration:none;font-weight:600">sahaaplay@gmail.com</a></p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated confirmation from <strong>SahaPlay</strong>. Please do not reply directly to this email.</p>
    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  // ── Guard: no email credentials → still saved to DB ──────────────────────
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    if (dbRequestId) {
      return res.json({ success: true, reportId });
    }
    console.error('[report-bug] Gmail credentials missing from .env!');
    return res.status(500).json({ success: false, error: L.apiBugErrorNoConfig || 'Email service not configured. Please email sahaaplay@gmail.com directly.' });
  }

  // ── Fire both emails non-blocking — data already in DB ──
  gmailTransporter.sendMail({
    from:    `"SahaPlay Bug Reports" <${process.env.GMAIL_USER}>`,
    replyTo: `"${rName}" <${rEmail}>`,
    to:      process.env.GMAIL_USER,
    subject: `[BUG REPORT] ${rSeverity.toUpperCase()} - ${bugTypeLabel} | ${reportId}`,
    html:    notifyHtml,
    text:    `Bug Report ${reportId}\nReporter: ${rName} <${rEmail}>\nSeverity: ${rSeverity}\nBug Type: ${bugTypeLabel}\n\nWhat happened:\n${rWhatHappened}\n\nExpected:\n${rWhatExpected}\n\nActual:\n${rActualResult}${rSteps ? `\n\nSteps:\n${rSteps}` : ''}\n\nBrowser: ${rBrowser} | OS: ${rOs} | Screen: ${rScreenSize}`,
    attachments: emailAttachments,
  }).then(() => {
    if (dbRequestId) {
      pool.query(`UPDATE support_requests SET email_notification_status = 'sent', updated_at = NOW() WHERE id = $1`, [dbRequestId]).catch(() => {});
    }
  }).catch(err => {
    console.warn('[report-bug] Admin notification email failed (non-fatal):', err.message);
    if (dbRequestId) {
      pool.query(`UPDATE support_requests SET email_notification_status = 'failed', email_notification_error = $1, updated_at = NOW() WHERE id = $2`, [err.message.substring(0, 500), dbRequestId]).catch(() => {});
    }
  });

  sendEmail({
    to:      rEmail,
    subject: `${L.emailBugSubject || 'Bug Report Received'} - ${reportId} | SahaPlay`,
    html:    confirmHtml,
    text:    `${L.emailContactHi || 'Hi'} ${rName},\n\n${L.emailBugBody1 || 'We received your bug report about'} ${bugTypeLabel}.\n\n${L.emailBugReportId || 'Report ID'}: ${reportId}\n${L.emailBugSeverity || 'Severity'}: ${rSeverity}\n\n${L.emailBugBody2 || "Our team will investigate and we'll update you at this email when it's resolved."}\n\n${L.emailBugUrgent || 'For urgent issues:'} sahaaplay@gmail.com\n\n— ${L.emailBugFooter || 'SahaPlay Team'}`,
  }).catch(e => console.warn('[report-bug] Confirmation email failed (non-fatal):', e.message));

  return res.json({ success: true, reportId });
});

app.post('/api/report-user', authenticateTokenOptional, bugReportLimiter, async (req, res) => {
  if (!req.user || req.user.isGuest || req.user.id === 0) {
    return res.status(401).json({ error: 'login_required', message: 'Please log in to use this feature' });
  }
  const reporter = req.user.username;
  const { reportedUsername, reason, description, images } = req.body;

  if (!reportedUsername) {
    return res.status(400).json({ success: false, error: 'Reported username is required.' });
  }
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Reason for report is required.' });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ success: false, error: 'At least 1 proof image is required to submit a report.' });
  }
  if (images.length > 5) {
    return res.status(400).json({ success: false, error: 'Maximum 5 images allowed.' });
  }

  // Credentials guard
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[report-user] Gmail credentials missing from .env!');
    return res.status(500).json({
      success: false,
      error: 'Email service not configured. Please report user via sahaaplay@gmail.com directly.',
    });
  }

  // ── Image validation ─────────────────────────────────────────
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const attachments = [];
  const dbAttachments = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || !img.data || !img.type) continue;
    if (!OK_TYPES.includes(img.type))
      return res.status(400).json({ success: false, error: `Image ${i + 1}: only JPG, PNG, GIF, WEBP allowed.` });
    const raw = img.data.replace(/^data:[^;]+;base64,/, '');
    const bytes = Math.ceil((raw.length * 3) / 4);
    if (bytes > 5 * 1024 * 1024)
      return res.status(400).json({ success: false, error: `Image ${i + 1} exceeds the 5 MB limit.` });
    attachments.push({ filename: img.name || `proof-${i + 1}`, content: raw, encoding: 'base64', contentType: img.type });
    dbAttachments.push({ filename: img.name || `proof-${i + 1}`, type: img.type, data: img.data });
  }

  const trim = (v) => (v ? String(v).trim() : '');
  const rReported = trim(reportedUsername);
  const rReason = trim(reason);
  const rDesc = trim(description);

  const esc = (s) =>
    String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const reasonLabel = {
    harassment: 'Harassment / Abuse',
    spam: 'Spam / Advertising',
    inappropriate_profile: 'Inappropriate Username, Avatar, or Bio',
    other: 'Other',
  }[rReason] || rReason || 'Other';

  // ── Look up reporter email by user ID (reliable, avoids username lookup issues) ──
  let reporterEmail = null;
  try {
    const emailRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    reporterEmail = emailRes.rows[0]?.email || null;
  } catch (_) {}

  // ── Save to reports DB ─────────────────────────────────────────────────────
  let reportId = null;
  try {
    const dbInsert = await pool.query(
      `INSERT INTO reports ("roomId", "reporterUsername", "reportedUsername", message, reason, description, attachments, status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 'high') RETURNING id`,
      [
        null,
        reporter,
        rReported,
        'User Profile Report',
        rReason,
        rDesc,
        JSON.stringify(dbAttachments),
      ]
    );
    reportId = dbInsert.rows[0]?.id;
    if (reportId) {
      broadcastAdminBadges();
      sendReporterConfirmationEmail(reportId, reporter, rReported, rReason, reporterEmail);
    }
  } catch (dbErr) {
    console.error('[report-user] DB save error:', dbErr.message);
    return res.status(500).json({ success: false, error: 'Failed to save report. Please try again.' });
  }

  const notifyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#09090b">
<div style="max-width:640px;margin:40px auto;background:#111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px 40px;text-align:center">
    <img src="cid:sahaplay-logo" alt="SahaPlay" width="48" height="48" style="width:48px;height:48px;margin:0 auto 12px;display:block;" />
    <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px">🚨 USER REPORT FILED</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:14px">Report ID: #${reportId}</p>
  </div>
  <div style="padding:40px">
    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:20px;margin-bottom:32px">
      <h2 style="color:#f87171;font-size:16px;margin:0 0 16px;font-weight:700">Report Summary</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="color:#888;font-size:14px;padding:8px 0;width:140px;font-weight:600">Reported User:</td>
          <td style="color:#fff;font-size:15px;padding:8px 0;font-weight:700">@${esc(rReported)}</td>
        </tr>
        <tr>
          <td style="color:#888;font-size:14px;padding:8px 0;font-weight:600">Reporter:</td>
          <td style="color:#fff;font-size:15px;padding:8px 0">@${esc(reporter)}</td>
        </tr>
        <tr>
          <td style="color:#888;font-size:14px;padding:8px 0;font-weight:600">Reason:</td>
          <td style="color:#ef4444;font-size:15px;padding:8px 0;font-weight:700">${esc(reasonLabel)}</td>
        </tr>
      </table>
    </div>
    
    ${rDesc ? `<div style="margin-bottom:32px">
      <h3 style="color:#fff;font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Details provided:</h3>
      <p style="color:#ccc;font-size:14px;line-height:1.6;margin:0;background:rgba(255,255,255,0.03);padding:16px;border-radius:8px;border:1px solid rgba(255,255,255,0.05)">
        ${esc(rDesc)}
      </p>
    </div>` : ''}
    <p style="color:#9ca3af;font-size:13px;margin:0">📎 ${attachments.length} proof image${attachments.length > 1 ? 's' : ''} attached</p>
  </div>
</div>
</body></html>`;

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    sendEmail({
      to:      process.env.GMAIL_USER,
      subject: `[USER REPORT] @${rReported} reported by @${reporter} | #${reportId}`,
      html:    notifyHtml,
      text:    `User Report #${reportId}\nReported User: @${rReported}\nReporter: @${reporter}\nReason: ${reasonLabel}\n\nDescription:\n${rDesc || 'No details provided.'}`,
      attachments,
    }).catch(err => {
      console.error('[report-user] background email error:', err.message);
    });
  }

  return res.json({ success: true, reportId });
});
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN API — all routes require authenticateToken + requireAdmin
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [totalR, monthR, weekR, publicRoomR, privateRoomR] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [startOfMonth]),
      pool.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [startOfWeek]),
      pool.query(`SELECT COUNT(*) FROM room_names WHERE "isPublic" = 1`),
      pool.query(`SELECT COUNT(*) FROM room_names WHERE "isPublic" = 0 OR "isPublic" IS NULL`),
    ]);

    // Separate logged-in users (with email) from guest accounts (no email) among connected sockets
    const connectedUsernames = [...connectedSockets.keys()];
    let loggedInOnline = 0;
    let guestsOnline = 0;
    if (connectedUsernames.length > 0) {
      const presenceR = await pool.query(
        `SELECT email FROM users WHERE username = ANY($1)`,
        [connectedUsernames]
      );
      loggedInOnline = presenceR.rows.filter(u => u.email).length;
      guestsOnline = presenceR.rows.filter(u => !u.email).length;
    }
    const activeRoomsNow = rooms.size;
    let activePublicRooms = 0;
    let activePrivateRooms = 0;
    for (const [, room] of rooms.entries()) {
      if (room.isPublic) activePublicRooms++; else activePrivateRooms++;
    }

    res.json({
      totalUsers: parseInt(totalR.rows[0].count),
      newThisMonth: parseInt(monthR.rows[0].count),
      newThisWeek: parseInt(weekR.rows[0].count),
      loggedInOnline,
      guestsOnline,
      activeRoomsNow,
      activePublicRooms,
      activePrivateRooms,
      totalPublicRooms: parseInt(publicRoomR.rows[0].count),
      totalPrivateRooms: parseInt(privateRoomR.rows[0].count),
    });
  } catch (err) {
    console.error('[ADMIN] stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/online-users — only accounts with email (truly registered)
app.get('/api/admin/online-users', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const usernames = [...connectedSockets.keys()];
    if (usernames.length === 0) return res.json({ users: [], count: 0 });
    const result = await pool.query(
      `SELECT id, username, "displayName", "avatarPath" FROM users WHERE username = ANY($1) AND email IS NOT NULL`,
      [usernames]
    );
    res.json({ users: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[ADMIN] online-users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/guest-users — accounts without email (guests) currently online
app.get('/api/admin/guest-users', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const usernames = [...connectedSockets.keys()];
    if (usernames.length === 0) return res.json({ users: [], count: 0 });
    const result = await pool.query(
      `SELECT id, username, "displayName", "avatarPath" FROM users WHERE username = ANY($1) AND (email IS NULL OR email = '')`,
      [usernames]
    );
    res.json({ users: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('[ADMIN] guest-users error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/active-rooms
app.get('/api/admin/active-rooms', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const filter = req.query.filter || 'all'; // 'all' | 'public' | 'private'
    const list = [];
    for (const [roomId, room] of rooms.entries()) {
      if (filter === 'public' && !room.isPublic) continue;
      if (filter === 'private' && room.isPublic) continue;
      list.push({
        roomId,
        roomName: room.roomName || room.name || roomId,
        hostUsername: room.hostUsername || room.host || '—',
        memberCount: room.members ? (room.members instanceof Set ? room.members.size : Object.keys(room.members).length) : (room.viewers ? room.viewers.size : 0),
        isPublic: !!room.isPublic,
        category: room.category || '—',
      });
    }
    res.json({ rooms: list, count: list.length });
  } catch (err) {
    console.error('[ADMIN] active-rooms error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users?search=&page=&limit=&joinFilter=
app.get('/api/admin/users', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const pattern = `%${search}%`;
    const joinFilter = req.query.joinFilter || 'all';

    const now = new Date();
    let listDateClause = '';
    let countDateClause = '';
    let dateParam = null;

    if (joinFilter === 'this_week') {
      dateParam = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (joinFilter === 'this_month') {
      dateParam = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (joinFilter === 'last_6_months') {
      const d = new Date(now); d.setMonth(d.getMonth() - 6);
      dateParam = d.toISOString();
    } else if (joinFilter === 'last_year') {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
      dateParam = d.toISOString();
    }

    if (dateParam) {
      listDateClause = ' AND created_at >= $4';
      countDateClause = ' AND created_at >= $2';
    }

    const [usersR, countR] = await Promise.all([
      pool.query(
        `SELECT id, username, email, role, banned_until, is_permanently_banned, ban_reason,
                terminated, created_at, last_login, "displayName", "avatarPath"
         FROM users
         WHERE (username ILIKE $1 OR email ILIKE $1)${listDateClause}
         ORDER BY created_at DESC NULLS LAST
         LIMIT $2 OFFSET $3`,
        dateParam ? [pattern, limit, offset, dateParam] : [pattern, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM users WHERE (username ILIKE $1 OR email ILIKE $1)${countDateClause}`,
        dateParam ? [pattern, dateParam] : [pattern]
      ),
    ]);

    res.json({
      users: usersR.rows,
      total: parseInt(countR.rows[0].count),
      page,
      limit,
      pages: Math.ceil(parseInt(countR.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('[ADMIN] users list error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users/:userId/ban
app.post('/api/admin/users/:userId/ban', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { userId } = req.params;
  const { type, expiresAt, reason } = req.body;

  if (req.adminRole === 'moderator' && type === 'permanent') {
    return res.status(403).json({ error: 'Moderators are not authorized to issue permanent bans.' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A reason is required for all bans.' });
  }
  if (!['temporary', 'permanent'].includes(type)) {
    return res.status(400).json({ error: 'ban type must be "temporary" or "permanent"' });
  }
  if (type === 'temporary' && !expiresAt) {
    return res.status(400).json({ error: 'expiresAt is required for temporary bans.' });
  }

  // Prevent admin from banning themselves
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ error: 'You cannot ban your own account.' });
  }

  try {
    const targetR = await pool.query('SELECT id, username, email, role FROM users WHERE id = $1', [userId]);
    if (targetR.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const target = targetR.rows[0];

    if (target.role === 'admin' || target.role === 'super_admin') {
      return res.status(400).json({ error: 'Admin and Super Admin accounts cannot be banned.' });
    }

    const isPermanent = type === 'permanent';
    const expiry = isPermanent ? null : new Date(expiresAt);

    // Update user row
    await pool.query(
      `UPDATE users SET
         banned_until = $1,
         is_permanently_banned = $2,
         ban_reason = $3
       WHERE id = $4`,
      [isPermanent ? null : expiry, isPermanent, reason.trim(), userId]
    );

    // Insert into bans table
    await pool.query(
      `INSERT INTO bans (user_id, banned_by_admin_id, ban_type, scope, reason, expires_at, active)
       VALUES ($1, $2, $3, 'global', $4, $5, TRUE)`,
      [String(userId), String(req.user.id), type, reason.trim(), expiry]
    );

    // Audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_user_id, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        String(req.user.id), req.adminEmail,
        isPermanent ? 'PERMANENT_BAN_USER' : 'TEMP_BAN_USER',
        String(userId), reason.trim(),
        JSON.stringify({ banType: type, expiresAt: expiry, targetUsername: target.username }),
      ]
    );

    // Force-disconnect the user's active sockets with account_banned event
    const sids = connectedSockets.get(target.username.toLowerCase());
    if (sids && sids.size > 0) {
      for (const sid of [...sids]) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) {
          sock.emit('account_banned', { reason: reason.trim(), isPermanent, expiresAt: expiry });
          setTimeout(() => { try { sock.disconnect(true); } catch (_) {} }, 600);
        }
      }
    }

    console.log(`[ADMIN] ${req.user.username} banned ${target.username} (${type}): ${reason}`);
    res.json({ success: true, message: `User ${target.username} has been ${isPermanent ? 'permanently' : 'temporarily'} banned.` });
  } catch (err) {
    console.error('[ADMIN] ban error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// POST /api/admin/users/:userId/terminate
app.post('/api/admin/users/:userId/terminate', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A reason is required for termination.' });
  }
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ error: 'You cannot terminate your own account.' });
  }

  try {
    const targetR = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [userId]);
    if (targetR.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const target = targetR.rows[0];

    if (target.role === 'admin' || target.role === 'super_admin') {
      return res.status(400).json({ error: 'Admin and Super Admin accounts cannot be terminated.' });
    }

    await pool.query(
      `UPDATE users SET terminated = TRUE, ban_reason = $1 WHERE id = $2`,
      [reason.trim(), userId]
    );

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_user_id, reason, details)
       VALUES ($1, $2, 'TERMINATE_USER', $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, String(userId), reason.trim(),
       JSON.stringify({ targetUsername: target.username })]
    );

    // Force-disconnect active sockets
    const sids = connectedSockets.get(target.username.toLowerCase());
    if (sids && sids.size > 0) {
      for (const sid of [...sids]) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) {
          sock.emit('account_terminated', { reason: reason.trim() });
          setTimeout(() => { try { sock.disconnect(true); } catch (_) {} }, 600);
        }
      }
    }

    console.log(`[ADMIN] ${req.user.username} terminated ${target.username}: ${reason}`);
    res.json({ success: true, message: `Account ${target.username} has been terminated.` });
  } catch (err) {
    console.error('[ADMIN] terminate error:', err);
    res.status(500).json({ error: 'Failed to terminate account' });
  }
});

// POST /api/admin/users/:userId/unban
app.post('/api/admin/users/:userId/unban', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  const { userId } = req.params;

  // Self-check (can't accidentally lock yourself out by unbanning either)
  if (String(userId) === String(req.user.id)) {
    return res.status(400).json({ error: 'Action not allowed on your own account.' });
  }

  try {
    const targetR = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (targetR.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const target = targetR.rows[0];

    // Clear ban fields on user row
    await pool.query(
      `UPDATE users SET banned_until = NULL, is_permanently_banned = FALSE, ban_reason = NULL WHERE id = $1`,
      [userId]
    );

    // Mark all active bans for this user as inactive
    await pool.query(`UPDATE bans SET active = FALSE WHERE user_id = $1 AND active = TRUE`, [String(userId)]);

    // Audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_user_id, reason)
       VALUES ($1, $2, 'UNBAN_USER', $3, 'Admin unban')`,
      [String(req.user.id), req.adminEmail, String(userId)]
    );

    console.log(`[ADMIN] ${req.user.username} unbanned ${target.username}`);
    res.json({ success: true, message: `User ${target.username} has been unbanned.` });
  } catch (err) {
    console.error('[ADMIN] unban error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// ─── Phase 2 Admin Routes ─────────────────────────────────────────────────────

// GET /api/admin/rooms/detailed — rooms with member lists
app.get('/api/admin/rooms/detailed', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const list = [];
    for (const [roomId, room] of rooms.entries()) {
      list.push({
        roomId,
        roomName: room.roomName || roomId,
        hostUsername: room.hostUsername || '—',
        isPublic: !!room.isPublic,
        category: room.category || 'other',
        members: (room.users || []).map(u => ({
          username: u.username || 'Anonymous',
          socketId: u.socketId,
          avatarPath: u.avatarPath || null,
          isHost: u.socketId === room.hostId || (room.hostUsername && u.username?.toLowerCase() === room.hostUsername?.toLowerCase()),
        })),
      });
    }
    list.sort((a, b) => b.members.length - a.members.length);
    res.json({ rooms: list, count: list.length });
  } catch (err) {
    console.error('[ADMIN] rooms/detailed error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/rooms/:roomId/force-close
app.post('/api/admin/rooms/:roomId/force-close', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  const { roomId } = req.params;
  const { reason = 'Room closed by admin' } = req.body;

  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found or already closed' });

  try {
    io.in(roomId).emit('kicked_out', { reason: 'room_closed_by_admin' });
    rooms.delete(roomId);

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, room_id, reason, details)
       VALUES ($1, $2, 'FORCE_CLOSE_ROOM', $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, roomId, reason,
       JSON.stringify({ roomName: room.roomName || roomId })]
    );

    console.log(`[ADMIN] ${req.user.username} force-closed room ${roomId}`);
    res.json({ success: true, message: `Room "${room.roomName || roomId}" has been closed.` });
  } catch (err) {
    console.error('[ADMIN] force-close error:', err.message);
    res.status(500).json({ error: 'Failed to close room' });
  }
});

// POST /api/admin/rooms/:roomId/kick-member
app.post('/api/admin/rooms/:roomId/kick-member', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { roomId } = req.params;
  const { username } = req.body;

  if (!username) return res.status(400).json({ error: 'username is required' });

  const room = rooms.get(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const userEntry = (room.users || []).find(u =>
    u.username?.toLowerCase() === username.toLowerCase()
  );
  if (!userEntry) return res.status(404).json({ error: 'User not found in this room' });

  try {
    const sock = io.sockets.sockets.get(userEntry.socketId);
    if (sock) {
      sock.emit('kicked_out', { reason: 'admin_kick' });
      sock.leave(roomId);
    }
    room.users = (room.users || []).filter(u => u.socketId !== userEntry.socketId);
    io.in(roomId).emit('user_list', { users: buildUserList(room), hostId: room.hostId });

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, room_id, reason, details)
       VALUES ($1, $2, 'KICK_USER_FROM_ROOM', $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, roomId, `Admin kicked ${username}`,
       JSON.stringify({ username, roomName: room.roomName || roomId })]
    );

    console.log(`[ADMIN] ${req.user.username} kicked ${username} from room ${roomId}`);
    res.json({ success: true, message: `${username} has been removed from the room.` });
  } catch (err) {
    console.error('[ADMIN] kick-member error:', err.message);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

// GET /api/admin/audit-logs
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [logsR, countR] = await Promise.all([
      pool.query(
        `SELECT l.id, l.admin_user_id, l.admin_email, l.action, l.target_user_id,
                l.room_id, l.reason, l.details, l.created_at,
                u.username AS target_username
         FROM admin_audit_logs l
         LEFT JOIN users u ON l.target_user_id = u.id::TEXT
         ORDER BY l.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*) FROM admin_audit_logs'),
    ]);

    res.json({
      logs: logsR.rows,
      total: parseInt(countR.rows[0].count),
      page,
      limit,
      pages: Math.ceil(parseInt(countR.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('[ADMIN] audit-logs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/admin/reports
app.get('/api/admin/reports', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const filter = req.query.filter || 'all';

    let where = '';
    if (filter === 'unresolved') where = `WHERE (status IS NULL OR status = 'open' OR status = 'in_review') AND resolved IS NOT TRUE`;
    else if (filter === 'in_review') where = `WHERE status = 'in_review'`;
    else if (filter === 'resolved') where = `WHERE status = 'resolved' OR resolved = TRUE`;
    else if (filter === 'dismissed') where = `WHERE status = 'dismissed'`;

    const [reportsR, countR] = await Promise.all([
      pool.query(
        `SELECT id, "roomId", "reporterUsername", "reportedUsername", message, "createdAt", resolved,
                status, admin_notes, resolved_by_admin_id, resolved_at, priority, reason, description, attachments
         FROM reports ${where}
         ORDER BY "createdAt" DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM reports ${where}`),
    ]);

    res.json({
      reports: reportsR.rows,
      total: parseInt(countR.rows[0].count),
      page,
      limit,
      pages: Math.ceil(parseInt(countR.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('[ADMIN] reports error:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST /api/admin/reports/:id/resolve
app.post('/api/admin/reports/:id/resolve', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { id } = req.params;
  const { admin_notes, action: resolveAction } = req.body;
  const newStatus = resolveAction === 'dismiss' ? 'dismissed' : 'resolved';
  const auditAction = newStatus === 'dismissed' ? 'REPORT_DISMISSED' : 'REPORT_RESOLVED';
  try {
    await pool.query(
      `UPDATE reports SET resolved = TRUE, status = $1, resolved_by_admin_id = $2, resolved_at = NOW(), admin_notes = COALESCE($3, admin_notes) WHERE id = $4`,
      [newStatus, String(req.user.id), admin_notes || null, id]
    );
    broadcastAdminBadges();
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, reason)
       VALUES ($1, $2, $3, $4)`,
      [String(req.user.id), req.adminEmail, auditAction, `Report #${id}${admin_notes ? ': ' + admin_notes.substring(0, 200) : ''}`]
    );
    sendReporterResolutionEmail(id, req.user.username, admin_notes || null);
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] resolve report error:', err.message);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

// PATCH /api/admin/reports/:id — update status or admin notes
app.patch('/api/admin/reports/:id', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { id } = req.params;
  const { status, admin_notes, priority } = req.body;
  const allowed = ['open', 'in_review', 'resolved', 'dismissed'];
  if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const updates = [];
    const vals = [];
    let idx = 1;
    if (status) { updates.push(`status = $${idx++}`); vals.push(status); }
    if (admin_notes !== undefined) { updates.push(`admin_notes = $${idx++}`); vals.push(admin_notes); }
    if (priority) { updates.push(`priority = $${idx++}`); vals.push(priority); }
    if (status === 'resolved' || status === 'dismissed') {
      updates.push(`resolved = TRUE`, `resolved_by_admin_id = $${idx++}`, `resolved_at = NOW()`);
      vals.push(String(req.user.id));
    }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(id);
    await pool.query(`UPDATE reports SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
    broadcastAdminBadges();

    if (status === 'resolved' || status === 'dismissed') {
      sendReporterResolutionEmail(id, req.user.username, admin_notes || null);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] patch report error:', err.message);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// GET /api/admin/reports/:id
app.get('/api/admin/reports/:id', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, "roomId", "reporterUsername", "reportedUsername", message, "createdAt", resolved,
              status, admin_notes, resolved_by_admin_id, resolved_at, priority, reason, description, attachments, assigned_to_admin_id
       FROM reports WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ADMIN] fetch report error:', err.message);
    res.status(500).json({ error: 'Failed to fetch report details' });
  }
});

// POST /api/admin/reports/:id/assign
app.post('/api/admin/reports/:id/assign', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { id } = req.params;
  const { targetAdminId } = req.body;
  let assignedTo = String(req.user.id);
  let assignedEmail = req.adminEmail;
  try {
    if (targetAdminId && String(targetAdminId) !== String(req.user.id)) {
      if (!['super_admin', 'admin'].includes(req.adminRole)) {
        return res.status(403).json({ error: 'Only admins can assign reports to other team members' });
      }
      const check = await pool.query('SELECT id, email FROM users WHERE id = $1 AND role = ANY($2)', [String(targetAdminId), ALL_ADMIN_ROLES]);
      if (!check.rows[0]) return res.status(400).json({ error: 'Target user is not an admin team member' });
      assignedTo = String(targetAdminId);
      assignedEmail = check.rows[0].email;
    }
    await pool.query(
      `UPDATE reports SET assigned_to_admin_id = $1, status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END WHERE id = $2`,
      [assignedTo, id]
    );
    broadcastAdminBadges();
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, reason)
       VALUES ($1, $2, 'REPORT_ASSIGNED', $3)`,
      [String(req.user.id), req.adminEmail, `Report #${id} assigned to ${assignedEmail}`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] assign report error:', err.message);
    res.status(500).json({ error: 'Failed to assign report' });
  }
});

// POST /api/admin/reports/:id/note
app.post('/api/admin/reports/:id/note', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'Note is required' });
  try {
    const ts = new Date().toISOString();
    const noteEntry = `[${ts} - ${req.adminEmail}] ${note.trim()}`;
    await pool.query(
      `UPDATE reports SET admin_notes = CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN $1 ELSE admin_notes || E'\n' || $1 END WHERE id = $2`,
      [noteEntry, id]
    );
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, reason)
       VALUES ($1, $2, 'REPORT_NOTE_ADDED', $3)`,
      [String(req.user.id), req.adminEmail, `Note added to report #${id}`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] add note to report error:', err.message);
    res.status(500).json({ error: 'Failed to add note to report' });
  }
});

// GET /api/admin/db-rooms — paginated rooms from DB with search and filter
app.get('/api/admin/db-rooms', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator']), async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const filter = req.query.filter || 'all';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    const baseParams = [];

    if (search) {
      baseParams.push(`%${search}%`);
      conditions.push(`("roomId" ILIKE $${baseParams.length} OR "roomName" ILIKE $${baseParams.length})`);
    }
    if (filter === 'public') conditions.push(`"isPublic" = 1`);
    if (filter === 'private') conditions.push(`("isPublic" = 0 OR "isPublic" IS NULL)`);

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const dataParams = [...baseParams, limit, offset];

    const [roomsR, countR] = await Promise.all([
      pool.query(
        `SELECT "roomId", "roomName", "hostUsername", "isPublic", "category", "created_at"
         FROM room_names ${whereClause}
         ORDER BY "created_at" DESC NULLS LAST
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      ),
      pool.query(`SELECT COUNT(*) FROM room_names ${whereClause}`, baseParams),
    ]);

    const total = parseInt(countR.rows[0].count);
    res.json({
      rooms: roomsR.rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[ADMIN] db-rooms error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/rooms/:roomId — permanently delete room, chat history, and kick all live members
app.delete('/api/admin/rooms/:roomId', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin']), async (req, res) => {
  const { roomId } = req.params;
  const { reason = 'Room deleted by admin' } = req.body || {};

  try {
    const roomDbR = await pool.query(
      `SELECT "roomName", "hostUsername", "thumbnailPath" FROM room_names WHERE "roomId" = $1`,
      [roomId]
    );

    const liveRoom = rooms.get(roomId);
    if (roomDbR.rows.length === 0 && !liveRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const roomName = roomDbR.rows[0]?.roomName || roomId;
    const thumbnailPath = roomDbR.rows[0]?.thumbnailPath;

    if (liveRoom) {
      io.in(roomId).emit('kicked_out', { reason: 'room_closed_by_admin' });
      rooms.delete(roomId);
    }

    await pool.query(`DELETE FROM messages WHERE "roomId" = $1 AND type IN ('room', 'group')`, [roomId]);
    await pool.query(`DELETE FROM room_names WHERE "roomId" = $1`, [roomId]);

    if (thumbnailPath) {
      const fullPath = path.join(__dirname, thumbnailPath.replace(/^\//, ''));
      fs.unlink(fullPath, () => {});
    }

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, room_id, reason, details)
       VALUES ($1, $2, 'DELETE_ROOM', $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, roomId, reason, JSON.stringify({ roomName })]
    );

    // Notify ALL connected clients to purge this room from their global chat widget
    io.emit('admin_room_deleted', { roomId, roomName });

    console.log(`[ADMIN] ${req.user.username} permanently deleted room ${roomId} (${roomName})`);
    res.json({ success: true, message: `Room "${roomName}" has been permanently deleted.` });
  } catch (err) {
    console.error('[ADMIN] delete-room error:', err.message);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPPORT INBOX ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/badge-counts
app.get('/api/admin/badge-counts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [openSupport, unresolvedReports, pendingInvites] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM support_requests WHERE status = 'open'`),
      pool.query(`SELECT COUNT(*) FROM reports WHERE resolved IS NOT TRUE AND (status IS NULL OR status NOT IN ('resolved','dismissed'))`),
      req.adminRole === 'super_admin'
        ? pool.query(`SELECT COUNT(*) FROM admin_invites WHERE status = 'pending' AND expires_at > NOW()`)
        : Promise.resolve({ rows: [{ count: '0' }] }),
    ]);
    res.json({
      openSupportRequests: parseInt(openSupport.rows[0].count),
      unresolvedReports: parseInt(unresolvedReports.rows[0].count),
      pendingInvites: parseInt(pendingInvites.rows[0].count),
    });
  } catch (err) {
    console.error('[ADMIN] badge-counts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch badge counts' });
  }
});

// GET /api/admin/support-requests
app.get('/api/admin/support-requests', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator', 'support']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const filter = req.query.filter || 'all';
    const search = (req.query.search || '').trim();
    const type = req.query.type || '';
    const priority = req.query.priority || '';

    const conditions = [];
    const vals = [];
    let idx = 1;

    if (filter !== 'all') { conditions.push(`status = $${idx++}`); vals.push(filter); }
    if (type) { conditions.push(`request_type = $${idx++}`); vals.push(type); }
    if (priority) { conditions.push(`priority = $${idx++}`); vals.push(priority); }
    if (search) {
      conditions.push(`(subject ILIKE $${idx} OR submitted_by_email ILIKE $${idx} OR submitted_by_name ILIKE $${idx})`);
      vals.push(`%${search}%`); idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countWhere = where;

    const [rows, countR] = await Promise.all([
      pool.query(
        `SELECT id, request_type, subject, submitted_by_email, submitted_by_name, priority, status,
                assigned_to_admin_id, resolved_at, created_at, updated_at, email_notification_status,
                attachment_deleted,
                CASE WHEN attachments IS NOT NULL AND jsonb_typeof(attachments) = 'array' THEN jsonb_array_length(attachments)
                     WHEN metadata IS NOT NULL AND metadata->>'attachmentCount' IS NOT NULL THEN (metadata->>'attachmentCount')::int
                     ELSE 0 END AS attachment_count
         FROM support_requests ${where}
         ORDER BY
           CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
           created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...vals, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM support_requests ${countWhere}`, vals),
    ]);

    res.json({
      requests: rows.rows,
      total: parseInt(countR.rows[0].count),
      page,
      limit,
      pages: Math.ceil(parseInt(countR.rows[0].count) / limit),
    });
  } catch (err) {
    console.error('[ADMIN] support-requests list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

// GET /api/admin/support-requests/:id
app.get('/api/admin/support-requests/:id', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator', 'support']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, request_type, subject, message, submitted_by_user_id, submitted_by_email, submitted_by_name,
              room_id, target_user_id, priority, status, admin_notes, assigned_to_admin_id,
              resolved_by_admin_id, resolved_at, attachments, metadata, attachment_deleted, attachment_deleted_at,
              email_notification_status, created_at, updated_at
       FROM support_requests WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Request not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ADMIN] support-request fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch request' });
  }
});

// PATCH /api/admin/support-requests/:id
app.patch('/api/admin/support-requests/:id', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator', 'support']), async (req, res) => {
  const { id } = req.params;
  const { status, priority, admin_notes, resolution_message } = req.body;
  const allowedStatus = ['open', 'in_progress', 'resolved', 'dismissed'];
  if (status && !allowedStatus.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const updates = [];
    const vals = [];
    let idx = 1;
    if (status) {
      updates.push(`status = $${idx++}`); vals.push(status);
      if (status === 'resolved' || status === 'dismissed') {
        updates.push(`resolved_by_admin_id = $${idx++}`, `resolved_at = NOW()`);
        vals.push(String(req.user.id));
      }
    }
    if (priority) { updates.push(`priority = $${idx++}`); vals.push(priority); }
    if (admin_notes !== undefined) { updates.push(`admin_notes = $${idx++}`); vals.push(admin_notes); }
    if (resolution_message !== undefined) { updates.push(`resolution_message = $${idx++}`); vals.push(resolution_message); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    updates.push(`updated_at = NOW()`);
    vals.push(id);
    await pool.query(`UPDATE support_requests SET ${updates.join(', ')} WHERE id = $${idx}`, vals);
    broadcastAdminBadges();

    const auditAction = status === 'resolved' ? 'SUPPORT_REQUEST_RESOLVED'
      : status === 'dismissed' ? 'SUPPORT_REQUEST_DISMISSED'
      : 'SUPPORT_REQUEST_UPDATED';
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, support_request_id, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, auditAction, String(id), `Request #${id} → ${status || 'updated'}`]
    );

    // Send resolution email to the original submitter
    if (status === 'resolved') {
      try {
        const ticketR = await pool.query(
          `SELECT subject, submitted_by_email, submitted_by_name, resolution_message FROM support_requests WHERE id = $1`, [id]
        );
        const ticket = ticketR.rows[0];
        if (ticket && ticket.submitted_by_email) {
          const escR = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
          const resolveHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px">SahaPlay Support</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Support Request Resolution</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 8px;color:#111827;font-size:22px;font-weight:700">Your Request Has Been Resolved</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6">Hi <strong style="color:#111827">${escR(ticket.submitted_by_name || 'there')}</strong>,</p>
    <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75">
      We have reviewed your support request and are pleased to confirm that it has been resolved by our team.
    </p>
    <!-- Request Box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${ticket.resolution_message ? '20px' : '28px'}">
      <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px">
        <p style="margin:0 0 8px;color:#059669;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Your Request</p>
        <p style="margin:0;color:#111827;font-size:15px;font-weight:600">${escR(ticket.subject)}</p>
      </td></tr>
    </table>
    ${ticket.resolution_message ? `<!-- Message from team -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
      <tr><td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:20px">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:10px;vertical-align:top;padding-top:2px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </td>
          <td>
            <p style="margin:0 0 8px;color:#1d4ed8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Message from our Team</p>
            <p style="margin:0;color:#1e3a5f;font-size:14px;line-height:1.75">${escR(ticket.resolution_message)}</p>
          </td>
        </tr></table>
      </td></tr>
    </table>` : ''}
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">
      If you have any further questions or this issue reoccurs, please contact us at <a href="mailto:sahaaplay@gmail.com" style="color:#059669;text-decoration:none;font-weight:600">sahaaplay@gmail.com</a>.
    </p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated message from <strong>SahaPlay</strong>. Please do not reply directly to this email.</p>
    <p style="margin:6px 0 0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
          sendEmail({
            to: ticket.submitted_by_email,
            subject: `Your request has been resolved — SahaPlay`,
            html: resolveHtml,
            text: `Hi ${ticket.submitted_by_name || 'there'},\n\nYour support request "${ticket.subject}" has been resolved by our team.\n\n${ticket.resolution_message ? `Message from our team:\n${ticket.resolution_message}\n\n` : ''}If you have further questions, email us at sahaaplay@gmail.com.\n\n— SahaPlay Team`,
          }).catch(() => {});
        }
      } catch (emailErr) {
        console.warn('[ADMIN] resolve email error (non-fatal):', emailErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] patch support-request error:', err.message);
    res.status(500).json({ error: 'Failed to update request' });
  }
});

// POST /api/admin/support-requests/:id/assign
app.post('/api/admin/support-requests/:id/assign', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator', 'support']), async (req, res) => {
  const { id } = req.params;
  const { targetAdminId } = req.body;
  let assignedTo = String(req.user.id);
  let assignedEmail = req.adminEmail;
  try {
    if (targetAdminId && String(targetAdminId) !== String(req.user.id)) {
      if (!['super_admin', 'admin'].includes(req.adminRole)) {
        return res.status(403).json({ error: 'Only admins can assign tickets to other team members' });
      }
      const check = await pool.query('SELECT id, email FROM users WHERE id = $1 AND role = ANY($2)', [String(targetAdminId), ALL_ADMIN_ROLES]);
      if (!check.rows[0]) return res.status(400).json({ error: 'Target user is not an admin team member' });
      assignedTo = String(targetAdminId);
      assignedEmail = check.rows[0].email;
    }
    await pool.query(
      `UPDATE support_requests SET assigned_to_admin_id = $1, status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END, updated_at = NOW() WHERE id = $2`,
      [assignedTo, id]
    );
    broadcastAdminBadges();
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, support_request_id, reason)
       VALUES ($1, $2, 'SUPPORT_REQUEST_ASSIGNED', $3, $4)`,
      [String(req.user.id), req.adminEmail, String(id), `Request #${id} assigned to ${assignedEmail}`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] assign support-request error:', err.message);
    res.status(500).json({ error: 'Failed to assign request' });
  }
});

// GET /api/admin/team/:userId/tickets — assigned tickets for a team member
app.get('/api/admin/team/:userId/tickets', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator', 'support']), async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, subject, request_type, status, priority, created_at, submitted_by_name, submitted_by_email
       FROM support_requests
       WHERE assigned_to_admin_id = $1
       ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, created_at DESC
       LIMIT 50`,
      [String(userId)]
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    console.error('[ADMIN] member tickets error:', err.message);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// POST /api/admin/support-requests/:id/note
app.post('/api/admin/support-requests/:id/note', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'support']), async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: 'Note is required' });
  try {
    const ts = new Date().toISOString();
    const noteEntry = `[${ts} - ${req.adminEmail}] ${note.trim()}`;
    await pool.query(
      `UPDATE support_requests SET admin_notes = CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN $1 ELSE admin_notes || E'\n' || $1 END, updated_at = NOW() WHERE id = $2`,
      [noteEntry, id]
    );
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, support_request_id, reason)
       VALUES ($1, $2, 'SUPPORT_REQUEST_NOTE_ADDED', $3, $4)`,
      [String(req.user.id), req.adminEmail, String(id), `Note added to request #${id}`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] add note error:', err.message);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// POST /api/admin/support-requests/cleanup-attachments — 90-day retention
app.post('/api/admin/support-requests/cleanup-attachments', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const toClean = await pool.query(
      `SELECT id, attachments FROM support_requests
       WHERE attachment_deleted = FALSE
         AND (status = 'resolved' OR status = 'dismissed')
         AND COALESCE(resolved_at, updated_at) < $1
         AND attachments IS NOT NULL AND attachments != 'null'::jsonb`,
      [cutoff]
    );

    let cleaned = 0;
    for (const row of toClean.rows) {
      try {
        const atts = Array.isArray(row.attachments) ? row.attachments : JSON.parse(row.attachments || '[]');
        for (const att of atts) {
          if (att.storagePath) {
            await supabase.storage.from('support-attachments').remove([att.storagePath]).catch(() => {});
          }
        }
        await pool.query(
          `UPDATE support_requests SET attachment_deleted = TRUE, attachment_deleted_at = NOW(), attachments = NULL, updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
        cleaned++;
      } catch (rowErr) {
        console.warn('[cleanup-attachments] row', row.id, 'error:', rowErr.message);
      }
    }

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, reason)
       VALUES ($1, $2, 'SUPPORT_ATTACHMENT_DELETED', $3)`,
      [String(req.user.id), req.adminEmail, `Cleaned ${cleaned} of ${toClean.rows.length} expired attachment sets`]
    );

    res.json({ success: true, cleaned, total: toClean.rows.length });
  } catch (err) {
    console.error('[ADMIN] cleanup-attachments error:', err.message);
    res.status(500).json({ error: 'Failed to run attachment cleanup' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TEAM MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/team
app.get('/api/admin/team', authenticateToken, requireAdmin, requireAdminRole(['super_admin', 'admin', 'moderator', 'support']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
              COUNT(sr.id)::int AS open_ticket_count
       FROM users u
       LEFT JOIN support_requests sr
         ON sr.assigned_to_admin_id = u.id::TEXT
         AND sr.status NOT IN ('resolved', 'dismissed')
       WHERE u.role = ANY($1)
       GROUP BY u.id, u.username, u.email, u.role, u.created_at, u.last_login
       ORDER BY CASE u.role WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END, u.username ASC`,
      [ALL_ADMIN_ROLES]
    );
    res.json({ members: result.rows });
  } catch (err) {
    console.error('[ADMIN] team list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// PATCH /api/admin/team/:userId/role — super_admin only
app.patch('/api/admin/team/:userId/role', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  const allowed = ['super_admin', 'admin', 'moderator', 'support', 'user'];
  if (!role || !allowed.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (userId === String(req.user.id)) return res.status(400).json({ error: 'Cannot change your own role' });
  try {
    const check = await pool.query('SELECT email, role FROM users WHERE id = $1', [userId]);
    if (!check.rows[0]) return res.status(404).json({ error: 'User not found' });
    const prev = check.rows[0];
    if (prev.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify or demote a super_admin account' });
    }
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_user_id, target_email, reason)
       VALUES ($1, $2, 'ADMIN_ROLE_CHANGED', $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, userId, prev.email, `Role changed from ${prev.role} to ${role}`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] change role error:', err.message);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PATCH /api/admin/team/:userId/disable — super_admin only (set role to 'user' = revoke access)
app.patch('/api/admin/team/:userId/disable', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  const { userId } = req.params;
  if (userId === String(req.user.id)) return res.status(400).json({ error: 'Cannot disable your own account' });
  try {
    const check = await pool.query('SELECT email, role FROM users WHERE id = $1', [userId]);
    if (!check.rows[0]) return res.status(404).json({ error: 'User not found' });
    const prev = check.rows[0];
    if (prev.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot disable or revoke a super_admin account' });
    }
    await pool.query(`UPDATE users SET role = 'user' WHERE id = $1`, [userId]);
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_user_id, target_email, reason)
       VALUES ($1, $2, 'ADMIN_ACCESS_DISABLED', $3, $4, $5)`,
      [String(req.user.id), req.adminEmail, userId, prev.email, `Admin access revoked (was ${prev.role})`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] disable admin error:', err.message);
    res.status(500).json({ error: 'Failed to disable admin access' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN INVITE ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/invites — super_admin only
app.get('/api/admin/invites', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ai.id, ai.email, ai.role, ai.status, ai.expires_at, ai.accepted_at, ai.created_at,
              u.email AS invited_by_email
       FROM admin_invites ai
       LEFT JOIN users u ON u.id::text = ai.invited_by_admin_id
       ORDER BY ai.created_at DESC
       LIMIT 200`
    );
    res.json({ invites: result.rows });
  } catch (err) {
    console.error('[ADMIN] invites list error:', err.message);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// POST /api/admin/invites — super_admin only
app.post('/api/admin/invites', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  const { email, role } = req.body;
  const allowed = ['admin', 'moderator', 'support'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: 'Valid email required' });
  if (!role || !allowed.includes(role)) return res.status(400).json({ error: 'Valid role required (admin, moderator, support)' });

  const cleanEmail = email.trim().toLowerCase();
  try {
    const existing = await pool.query(`SELECT id FROM admin_invites WHERE email = $1 AND status = 'pending' AND expires_at > NOW()`, [cleanEmail]);
    if (existing.rows.length) return res.status(409).json({ error: 'A pending invite already exists for this email' });

    const rawToken = require('crypto').randomBytes(32).toString('hex');
    const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await pool.query(
      `INSERT INTO admin_invites (email, role, token_hash, invited_by_admin_id, status, expires_at) VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [cleanEmail, role, tokenHash, String(req.user.id), expiresAt]
    );

    const clientOrigin = (req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'https://sahaplay.com').replace(/\/$/, '');
    const inviteUrl = `${clientOrigin}/admin/accept-invite?token=${rawToken}&email=${encodeURIComponent(cleanEmail)}`;
    const roleLabel = { admin: 'Admin', moderator: 'Moderator', support: 'Support' }[role] || role;

    const inviteHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Admin Invitation</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">Team Invitation</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.75">
      You have been invited to join the SahaPlay team as an administrator with the role of <strong style="color:#6366f1">${roleLabel}</strong>.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(99,102,241,0.2)">Accept Invitation</a>
    </div>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.6">This invitation link will expire in 48 hours and can only be used once.</p>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">If you did not request or expect this invitation, you can safely ignore this email.</p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      sendEmail({ to: cleanEmail, subject: `You're invited to SahaPlay Admin — ${roleLabel}`, html: inviteHtml, text: `You've been invited to SahaPlay as ${roleLabel}.\n\nAccept your invitation here: ${inviteUrl}\n\nThis link expires in 48 hours.` })
        .catch(e => console.warn('[admin-invite] Email failed (non-fatal):', e.message));
    } else {
      console.warn('[admin-invite] Gmail not configured — invite created for', cleanEmail, '(deliver link via admin panel resend once email is set up)');
    }

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_email, reason)
       VALUES ($1, $2, 'ADMIN_INVITE_SENT', $3, $4)`,
      [String(req.user.id), req.adminEmail, cleanEmail, `Invited ${cleanEmail} as ${role}`]
    );
    broadcastAdminBadges();

    res.json({ success: true, message: `Invite sent to ${cleanEmail}` });
  } catch (err) {
    console.error('[ADMIN] send invite error:', err.message);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// DELETE /api/admin/invites/:id — super_admin only
app.delete('/api/admin/invites/:id', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query(`SELECT email, status FROM admin_invites WHERE id = $1`, [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Invite not found' });
    await pool.query(`UPDATE admin_invites SET status = 'revoked' WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_email, reason)
       VALUES ($1, $2, 'ADMIN_INVITE_REVOKED', $3, $4)`,
      [String(req.user.id), req.adminEmail, check.rows[0].email, `Invite #${id} revoked`]
    );
    broadcastAdminBadges();
    res.json({ success: true });
  } catch (err) {
    console.error('[ADMIN] revoke invite error:', err.message);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// POST /api/admin/invites/:id/resend — super_admin only
app.post('/api/admin/invites/:id/resend', authenticateToken, requireAdmin, requireAdminRole(['super_admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query(`SELECT email, role, status FROM admin_invites WHERE id = $1`, [id]);
    if (!check.rows[0]) return res.status(404).json({ error: 'Invite not found' });
    if (check.rows[0].status === 'accepted') return res.status(400).json({ error: 'Invite already accepted' });
    if (check.rows[0].status === 'revoked') return res.status(400).json({ error: 'Invite has been revoked' });

    const crypto = require('crypto');
    const newToken = crypto.randomBytes(32).toString('hex');
    const newHash = crypto.createHash('sha256').update(newToken).digest('hex');
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE admin_invites SET token_hash = $1, expires_at = $2, status = 'pending' WHERE id = $3`,
      [newHash, newExpiry, id]
    );

    const inv = check.rows[0];
    const clientOrigin = (req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'https://sahaplay.com').replace(/\/$/, '');
    const inviteLink = `${clientOrigin}/admin/accept-invite?token=${newToken}&email=${encodeURIComponent(inv.email)}`;
    const roleLabel = { admin: 'Admin', moderator: 'Moderator', support: 'Support' }[inv.role] || inv.role;

    const inviteHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Admin Invitation (Resent)</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">Team Invitation</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.75">
      You have been invited to join the SahaPlay team as an administrator with the role of <strong style="color:#6366f1">${roleLabel}</strong>.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${inviteLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(99,102,241,0.2)">Accept Invitation</a>
    </div>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0 0 8px;color:#9ca3af;font-size:13px;line-height:1.6">This invitation link will expire in 7 days and can only be used once.</p>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">If you did not request or expect this invitation, you can safely ignore this email.</p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      sendEmail({ to: inv.email, subject: `You're invited to SahaPlay Admin — ${roleLabel} (Resent)`, html: inviteHtml, text: `You've been invited to SahaPlay as ${roleLabel}.\n\nAccept your invitation here: ${inviteLink}\n\nThis link expires in 7 days.` })
        .catch(e => console.warn('[admin-invite-resend] Email failed:', e.message));
    } else if (process.env.SMTP_HOST) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: inv.email,
        subject: `You're invited to SahaPlay Admin — ${roleLabel} (Resent)`,
        html: inviteHtml,
      });
    }

    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_email, reason)
       VALUES ($1, $2, 'ADMIN_INVITE_RESENT', $3, $4)`,
      [String(req.user.id), req.adminEmail, inv.email, `Invite #${id} resent`]
    );
    broadcastAdminBadges();

    res.json({ success: true, message: `Invite resent to ${inv.email}` });
  } catch (err) {
    console.error('[ADMIN] resend invite error:', err.message);
    res.status(500).json({ error: 'Failed to resend invite' });
  }
});

// POST /api/admin/accept-invite — authenticated user accepts invite
app.post('/api/admin/accept-invite', authenticateToken, async (req, res) => {
  const { token, email } = req.body;
  if (!token || !email) return res.status(400).json({ error: 'Token and email required' });
  const cleanEmail = email.trim().toLowerCase();
  try {
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    const invite = await pool.query(
      `SELECT id, email, role, status, expires_at FROM admin_invites WHERE token_hash = $1 AND status = 'pending' AND expires_at > NOW()`,
      [tokenHash]
    );
    if (!invite.rows[0]) return res.status(400).json({ error: 'Invalid or expired invite link' });
    const inv = invite.rows[0];
    if (inv.email !== cleanEmail) return res.status(400).json({ error: 'Email mismatch' });

    const userCheck = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.user.id]);
    if (!userCheck.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (userCheck.rows[0].email.toLowerCase() !== cleanEmail) {
      return res.status(403).json({ error: 'Your account email does not match the invite' });
    }

    await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [inv.role, req.user.id]);
    await pool.query(`UPDATE admin_invites SET status = 'accepted', accepted_at = NOW() WHERE id = $1`, [inv.id]);
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_user_id, admin_email, action, target_email, reason)
       VALUES ($1, $2, 'ADMIN_INVITE_ACCEPTED', $3, $4)`,
      [String(req.user.id), cleanEmail, cleanEmail, `Accepted invite as ${inv.role}`]
    );
    broadcastAdminBadges();

    // Send confirmation email
    const clientOrigin = (req.headers.origin || req.headers.referer || process.env.FRONTEND_URL || 'https://sahaplay.com').replace(/\/$/, '');
    const roleLabel = { admin: 'Admin', moderator: 'Moderator', support: 'Support' }[inv.role] || inv.role;
    const acceptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f7">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 48px">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:14px;vertical-align:middle">
        <table cellpadding="0" cellspacing="0" width="48" height="48" style="width:48px;height:48px;background:rgba(255,255,255,0.18);border-radius:12px;border-collapse:collapse">
          <tr>
            <td align="center" valign="middle" style="padding:0;text-align:center;vertical-align:middle">
              <img src="${EMAIL_LOGO_DATA_URI}" alt="SahaPlay" width="36" height="36" style="width:36px;height:36px;display:block;margin:0 auto;border:none" />
            </td>
          </tr>
        </table>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px">SahaPlay</div>
        <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:2px">Access Approved</div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px 48px">
    <h1 style="margin:0 0 16px;color:#111827;font-size:22px;font-weight:700">Invitation Approved!</h1>
    <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.75">
      Your invitation to join the SahaPlay team has been approved. You now have access as a <strong style="color:#10b981">${roleLabel}</strong>.
    </p>
    <div style="text-align:center;margin-bottom:32px">
      <a href="${clientOrigin}/admin" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(16,185,129,0.2)">Go to Admin Dashboard</a>
    </div>
    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td style="border-top:1px solid #e5e7eb"></td></tr></table>
    <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6">You can now access the admin panel using your registered account email: ${cleanEmail}.</p>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 48px">
    <p style="margin:0;color:#9ca3af;font-size:12px">&copy; ${new Date().getFullYear()} SahaPlay &nbsp;&middot;&nbsp; All rights reserved</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      sendEmail({ to: cleanEmail, subject: `SahaPlay Admin Access Approved — ${roleLabel}`, html: acceptHtml, text: `Your invitation to join the SahaPlay team has been approved.\n\nAccess the dashboard here: ${clientOrigin}/admin` })
        .catch(e => console.warn('[admin-accept-invite-email] Email failed:', e.message));
    }

    res.json({ success: true, role: inv.role, message: `Welcome to the SahaPlay admin team as ${inv.role}!` });
  } catch (err) {
    console.error('[admin-accept-invite] error:', err.message);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('[Express Error Catch]:', err.stack || err);
  res.status(500).json({ error: 'Internal Server Error. Please contact support.' });
});

const PORT = 3001;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;

// ─── Server Info Endpoint (for Cast to TV LAN URL) ───
app.get('/api/server-info', (req, res) => {
  res.json({
    lanIp: LAN_IP,
    lanUrl: `http://${LAN_IP}:${FRONTEND_PORT}`,
    tvUrl: `http://${LAN_IP}:${FRONTEND_PORT}/tv`,
    backendUrl: `http://${LAN_IP}:${PORT}`
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Cast TV URL: http://${LAN_IP}:${FRONTEND_PORT}/tv`);
});

// ─── Media Expiry Cleanup Job (runs every 24 hours) ───
async function cleanupExpiredMedia() {
  console.log('[Cleanup] Running media expiry cleanup...');
  try {
    const now = new Date().toISOString();
    const { rows: expired } = await pool.query(
      `SELECT id, "mediaUrl" FROM messages WHERE media_expires_at IS NOT NULL AND media_expires_at < $1 AND "mediaUrl" IS NOT NULL`,
      [now]
    );
    if (expired.length === 0) { console.log('[Cleanup] No expired media.'); return; }

    const filenames = expired
      .map(m => {
        try {
          const parts = (m.mediaUrl || '').split('/');
          const fname = parts[parts.length - 1];
          return fname ? path.join(__dirname, 'uploads', fname) : null;
        } catch { return null; }
      })
      .filter(Boolean);

    filenames.forEach(fp => { try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {} });

    // Clean up from Supabase Storage 'encrypted-media' bucket
    const supabasePaths = expired
      .map(m => {
        try {
          if (!m.mediaUrl) return null;
          const match = m.mediaUrl.match(/\/encrypted-media\/(.+)$/);
          return match ? match[1] : null;
        } catch { return null; }
      })
      .filter(Boolean);

    if (supabasePaths.length > 0) {
      console.log('[Cleanup] Deleting from Supabase storage:', supabasePaths);
      const { error: delErr } = await supabase.storage
        .from('encrypted-media')
        .remove(supabasePaths);
      if (delErr) {
        console.error('[Cleanup] Supabase media delete error:', delErr.message);
      } else {
        console.log(`[Cleanup] Successfully deleted ${supabasePaths.length} file(s) from Supabase storage.`);
      }
    }

    const ids = expired.map(m => m.id);
    await pool.query(
      `UPDATE messages SET "mediaUrl" = NULL, "mediaType" = NULL WHERE id = ANY($1::int[])`,
      [ids]
    );
    console.log(`[Cleanup] Cleaned ${expired.length} expired media file(s) ✅`);
  } catch (err) {
    console.error('[Cleanup] Error during media cleanup:', err.message);
  }
}
migrationsReady.then(() => cleanupExpiredMedia());
setInterval(cleanupExpiredMedia, 24 * 60 * 60 * 1000);

// Keep server alive on unhandled errors instead of crashing silently
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception (server kept alive):', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection (server kept alive):', reason);
});

