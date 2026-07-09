'use strict';

const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const EMAILS = {
  from:     process.env.APP_EMAIL_FROM     || 'SahaPlay <no-reply@sahaplay.com>',
  noReply:  process.env.APP_EMAIL_NO_REPLY || 'no-reply@sahaplay.com',
  contact:  process.env.APP_EMAIL_CONTACT  || 'contact@sahaplay.com',
  safety:   process.env.APP_EMAIL_SAFETY   || 'safety@sahaplay.com',
  report:   process.env.APP_EMAIL_REPORT   || 'report@sahaplay.com',
  founders: process.env.APP_EMAIL_FOUNDERS || 'founders@sahaplay.com',
};

// Pre-load logo buffer once at startup for CID inline attachments
let _logoBuffer = null;
try {
  _logoBuffer = fs.readFileSync(path.join(__dirname, '../../frontend/public/logos/trans_webl.png'));
} catch (e) {
  console.warn('[EMAIL] Logo not found — emails will have no inline logo:', e.message);
}

/**
 * Send a transactional email via Resend.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to         - Recipient address(es)
 * @param {string}          opts.subject    - Email subject
 * @param {string}          [opts.html]     - HTML body
 * @param {string}          [opts.text]     - Plain-text fallback
 * @param {string}          [opts.replyTo]  - Reply-To header (defaults to contact@sahaplay.com)
 * @param {string}          [opts.fromName] - Override display name (keeps no-reply@ address)
 * @param {Array}           [opts.attachments] - Attachments in nodemailer-ish or Resend format
 *
 * Returns the Resend data object on success, null on failure.
 * Never throws.
 */
async function sendEmail({ to, subject, html, text, replyTo, fromName, attachments = [] }) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[EMAIL] RESEND_API_KEY not set — skipping email to:', to);
      return null;
    }

    const from = fromName
      ? `${fromName} <${EMAILS.noReply}>`
      : EMAILS.from;

    // Normalise attachments: accept nodemailer-style { cid, encoding } or Resend-style { contentId }
    const normAttachments = attachments.map(a => ({
      filename:    a.filename,
      content:     a.content,
      ...(a.path        ? { path: a.path }                         : {}),
      ...(a.contentType ? { contentType: a.contentType }           : {}),
      ...(a.contentId || a.cid
                        ? { contentId: a.contentId || a.cid }      : {}),
    }));

    // Auto-attach inline logo when HTML uses cid:sahaplay-logo
    if (html && html.includes('cid:sahaplay-logo') && _logoBuffer) {
      normAttachments.push({
        filename:  'trans_webl.png',
        content:   _logoBuffer,
        contentId: 'sahaplay-logo',
      });
    }

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text: text || subject,
      replyTo: replyTo || EMAILS.contact,
      attachments: normAttachments.length > 0 ? normAttachments : undefined,
    });

    if (error) {
      console.error('[EMAIL] Resend send failed:', { to, subject, error: error.message || error });
      return null;
    }

    console.log('[EMAIL] Sent via Resend:', { to, subject, id: data?.id });
    return data;
  } catch (err) {
    console.error('[EMAIL] Send exception:', { to, subject, error: err.message });
    return null;
  }
}

module.exports = { sendEmail, EMAILS };
