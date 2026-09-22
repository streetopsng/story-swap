/**
 * Brevo (Sendinblue) Transactional Email Service
 * Sends automated invitations for Story Swap sessions.
 */

const getEnv = (...keys) => {
  for (const k of keys) {
    const val = import.meta.env[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  return '';
};

const BREVO_API_KEY = getEnv('VITE_BREVO_API_KEY', 'BREVO_API_KEY', 'NEXT_PUBLIC_BREVO_API_KEY');
const SENDER_EMAIL = getEnv('VITE_BREVO_SENDER_EMAIL', 'BREVO_SENDER_EMAIL', 'NEXT_PUBLIC_BREVO_SENDER_EMAIL') || 'playgummygum@gmail.com';
const SENDER_NAME = getEnv('VITE_BREVO_SENDER_NAME', 'BREVO_SENDER_NAME', 'NEXT_PUBLIC_BREVO_SENDER_NAME') || 'Story Swap';

export const isBrevoConfigured = Boolean(
  BREVO_API_KEY &&
  BREVO_API_KEY.trim() !== '' &&
  BREVO_API_KEY !== 'your_brevo_api_key_here'
);

/**
 * Generate a beautifully styled HTML email template for Story Swap invites
 */
export function generateInvitationEmailHtml({
  recipientName = 'Teammate',
  sessionName = 'Team Bonding',
  sessionId,
  inviteUrl,
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to Story Swap!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #EDEAE4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1A1A1A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #EDEAE4; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border: 1.5px solid #E0DBD4; border-radius: 24px; box-shadow: 0 4px 0 #E0DBD4; overflow: hidden; padding: 32px 28px;" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Logo & Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: #F5821F; color: #FFFFFF; font-weight: 900; font-size: 20px; padding: 8px 18px; border-radius: 9999px; letter-spacing: -0.5px;">
                🪅 Story Swap
              </div>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding-bottom: 16px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #1A1A1A; line-height: 1.3;">
                You're invited to play!
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 15px; color: #666666; line-height: 1.5;">
                Hello <strong>${recipientName}</strong>, you have been invited to join the team bonding session:
              </p>
            </td>
          </tr>

          <!-- Session Badge Card -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table role="presentation" width="100%" style="background-color: #FAF7F2; border: 1.5px solid #FDE8D0; border-radius: 16px; padding: 18px;" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #F5821F; display: block; margin-bottom: 4px;">
                      Session Name
                    </span>
                    <span style="font-size: 18px; font-weight: 800; color: #1A1A1A;">
                      ${sessionName}
                    </span>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #E0DBD4;">
                      <span style="font-size: 12px; color: #888888;">Session Code:</span>
                      <strong style="font-size: 16px; font-family: monospace; color: #F5821F; letter-spacing: 2px; margin-left: 6px;">${sessionId}</strong>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #F5821F; color: #FFFFFF; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 36px; border-radius: 14px; box-shadow: 0 3px 0 #C9650E; text-align: center;">
                Enter Game Lobby ›
              </a>
            </td>
          </tr>

          <!-- Direct Link Fallback -->
          <tr>
            <td align="center" style="padding-bottom: 24px; font-size: 12px; color: #999999; line-height: 1.5;">
              Or copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="color: #F5821F; word-break: break-all; font-weight: 600;">
                ${inviteUrl}
              </a>
            </td>
          </tr>

          <!-- Footer divider -->
          <tr>
            <td style="border-top: 1px solid #EAE6DF; padding-top: 20px;" align="center">
              <p style="margin: 0; font-size: 12px; color: #AAAAAA;">
                Story Swap · Real-time team connection and storytelling
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send a single transactional email via Brevo SMTP API
 */
export async function sendEmail({ to, subject, htmlContent }) {
  if (!isBrevoConfigured) {
    throw new Error('Brevo API key is not configured.');
  }

  const payload = {
    sender: {
      name: SENDER_NAME,
      email: SENDER_EMAIL,
    },
    to: Array.isArray(to) ? to : [to],
    subject,
    htmlContent,
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Brevo API error (${response.status}): ${errorDetail}`);
  }

  return await response.json();
}

/**
 * Send invitation email to a single participant
 */
export async function sendSessionInvitation({ recipient, sessionName, sessionId, originUrl }) {
  const origin = originUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const inviteUrl = `${origin}/join/${sessionId}`;
  const recipientName = recipient.name || recipient.email.split('@')[0];

  const htmlContent = generateInvitationEmailHtml({
    recipientName,
    sessionName,
    sessionId,
    inviteUrl,
  });

  return await sendEmail({
    to: [{ email: recipient.email, name: recipientName }],
    subject: `You're invited to join ${sessionName} on Story Swap!`,
    htmlContent,
  });
}

/**
 * Send invitation emails to multiple participants
 * Returns an object with results: { sent: number, failed: number, errors: [] }
 */
export async function sendBulkSessionInvitations({ recipients, sessionName, sessionId, originUrl }) {
  const results = { sent: 0, failed: 0, errors: [] };

  if (!recipients || recipients.length === 0) {
    return results;
  }

  for (const recipient of recipients) {
    if (!recipient.email) continue;
    try {
      await sendSessionInvitation({
        recipient,
        sessionName,
        sessionId,
        originUrl,
      });
      results.sent += 1;
    } catch (err) {
      console.error(`Failed to send invitation to ${recipient.email}:`, err);
      results.failed += 1;
      results.errors.push({ email: recipient.email, error: err.message });
    }
  }

  return results;
}
