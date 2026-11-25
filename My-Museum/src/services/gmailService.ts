import type { Gender, MemberRole } from '../types/museum';

export interface PendingMuseumInvite {
  museumId: string;
  accessCode: string;
  museumTitle: string;
  hostName: string;
}

export interface MuseumInvitationEmailInput {
  recipientEmail: string;
  recipientName: string;
  hostName: string;
  hostEmail?: string;
  museumTitle: string;
  museumId: string;
  accessCode: string;
  role: MemberRole;
  gender: Gender;
  inviteUrl: string;
  personalNote?: string;
}

export interface ComposedInvitationEmail {
  to: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  rawMime: string;
  encodedRaw: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Builds the direct museum entry URL embedded inside the invitation email.
 */
export function buildMuseumInviteUrl(
  baseOrigin: string,
  params: {
    museumId: string;
    accessCode: string;
    museumTitle: string;
    hostName: string;
  }
): string {
  const cleanOrigin = baseOrigin.replace(/\/+$/, '');
  const query = new URLSearchParams({
    invite: params.museumId,
    code: params.accessCode,
    museum: params.museumTitle.slice(0, 80),
    host: params.hostName.slice(0, 60),
  });
  return `${cleanOrigin}/?${query.toString()}`;
}

/**
 * Parses an incoming museum invitation link from window.location.search.
 */
export function parseMuseumInviteFromSearch(search: string): PendingMuseumInvite | null {
  const params = new URLSearchParams(search);
  const museumId = params.get('invite')?.trim() ?? '';
  const accessCode = params.get('code')?.trim().toUpperCase() ?? '';
  if (!museumId || !/^[a-zA-Z0-9_-]{3,128}$/.test(museumId)) {
    return null;
  }
  return {
    museumId,
    accessCode: accessCode.replace(/[^A-Z0-9-]/g, '').slice(0, 20),
    museumTitle: (params.get('museum')?.trim() || 'Private 3D Museum').slice(0, 100),
    hostName: (params.get('host')?.trim() || 'A Museum Curator').slice(0, 80),
  };
}

/**
 * Encodes a UTF-8 MIME message into URL-safe Base64 (RFC 4648) required by Gmail API.
 */
export function encodeMimeMessageBase64Url(mime: string): string {
  const bytes = new TextEncoder().encode(mime);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Composes a richly styled editorial HTML + plain-text invitation email with a direct
 * museum entry link and private access pass.
 */
export function buildMuseumInvitationEmail(
  input: MuseumInvitationEmailInput
): ComposedInvitationEmail {
  const to = sanitizeHeaderValue(input.recipientEmail.toLowerCase());
  const recipientName = input.recipientName.trim() || 'Honored Guest';
  const hostName = input.hostName.trim() || 'Museum Curator';
  const museumTitle = input.museumTitle.trim() || 'My Museum';
  const roleLabel = input.role === 'curator' ? 'Co-Curator (View & Add Artworks)' : 'Private Visitor (Guided Walk-Through)';
  const genderLabel = input.gender === 'woman' ? 'Woman 3D Model' : 'Man 3D Model';
  const noteTrimmed = (input.personalNote ?? '').trim().slice(0, 300);

  const subject = sanitizeHeaderValue(
    `Private Invitation: Visit "${museumTitle}" in 3D`
  );

  const safeRecipient = escapeHtml(recipientName);
  const safeHost = escapeHtml(hostName);
  const safeMuseum = escapeHtml(museumTitle);
  const safeCode = escapeHtml(input.accessCode);
  const safeRole = escapeHtml(roleLabel);
  const safeGender = escapeHtml(genderLabel);
  const safeUrl = escapeHtml(input.inviteUrl);
  const safeNote = escapeHtml(noteTrimmed);

  const htmlBody = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C1917;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F4F0E8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#FAF8F4;border:1px solid #D6CEC0;">
          <!-- Obsidian & Gilded Bronze Header -->
          <tr>
            <td style="background-color:#181512;padding:32px 36px;border-bottom:3px solid #C99A5B;text-align:center;">
              <p style="margin:0 0 8px 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:3px;color:#D9B37C;text-transform:uppercase;">
                MY MUSEUM &middot; PRIVATE EXHIBITION PASS
              </p>
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#FAF6EE;line-height:1.25;">
                ${safeMuseum}
              </h1>
            </td>
          </tr>

          <!-- Main Editorial Body -->
          <tr>
            <td style="padding:36px 36px 24px 36px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#292524;">
                Dear <strong>${safeRecipient}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#44403C;">
                <strong>${safeHost}</strong> has personally invited you to step inside their private 3D architectural gallery, <strong>${safeMuseum}</strong>. Walk through curated rooms, open connecting gallery doors, and explore every artwork framed along the walls.
              </p>

              ${
                safeNote
                  ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px 0;background-color:#F3EEE5;border-left:3px solid #8A5A2B;">
                <tr>
                  <td style="padding:14px 18px;font-size:14px;font-style:italic;line-height:1.6;color:#44403C;">
                    &ldquo;${safeNote}&rdquo;
                    <div style="margin-top:6px;font-style:normal;font-size:12px;color:#78716C;">&mdash; ${safeHost}</div>
                  </td>
                </tr>
              </table>`
                  : ''
              }

              <!-- Pass Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FFFFFF;border:1px solid #E2DAD0;margin:0 0 28px 0;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;color:#8A5A2B;text-transform:uppercase;">
                      YOUR GALLERY CREDENTIALS
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:13px;color:#292524;">
                      <tr>
                        <td style="padding:6px 0;color:#78716C;width:40%;">Invited Email</td>
                        <td style="padding:6px 0;font-weight:600;">${escapeHtml(to)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#78716C;border-top:1px solid #F0EAE1;">Access Level</td>
                        <td style="padding:6px 0;font-weight:600;border-top:1px solid #F0EAE1;">${safeRole}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#78716C;border-top:1px solid #F0EAE1;">3D Avatar Preset</td>
                        <td style="padding:6px 0;font-weight:600;border-top:1px solid #F0EAE1;">${safeGender}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#78716C;border-top:1px solid #F0EAE1;">Museum Pass Code</td>
                        <td style="padding:6px 0;font-family:'Courier New',monospace;font-weight:700;letter-spacing:2px;color:#8A5A2B;border-top:1px solid #F0EAE1;">${safeCode}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary Direct Entry CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:4px 0 24px 0;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#8A5A2B;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:15px 34px;letter-spacing:0.3px;border:1px solid #734922;">
                      Enter ${safeMuseum} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px 0;font-size:12px;color:#78716C;text-align:center;">
                Sign in with <strong>${escapeHtml(to)}</strong> when you arrive to unlock your private gallery pass automatically.
              </p>
              <p style="margin:0;font-size:11px;color:#A8A29E;text-align:center;word-break:break-all;">
                Direct Access Link: <a href="${safeUrl}" style="color:#8A5A2B;">${safeUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer Controls Tip -->
          <tr>
            <td style="background-color:#EFECE6;padding:20px 36px;border-top:1px solid #E2DAD0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#57534E;line-height:1.5;">
                Inside the 3D Museum: Customize your avatar &middot; Walk with <strong>WASD / Arrow Keys</strong> &middot; Press <strong>F</strong> to open room doors &middot; Click any framed artwork to inspect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainTextBody = [
    `MY MUSEUM — PRIVATE EXHIBITION INVITATION`,
    ``,
    `Dear ${recipientName},`,
    ``,
    `${hostName} has invited you to visit "${museumTitle}" in 3D.`,
    noteTrimmed ? `\nPersonal Note: "${noteTrimmed}" — ${hostName}` : '',
    ``,
    `Direct Museum Access Link:`,
    input.inviteUrl,
    ``,
    `Gallery Pass Details:`,
    `- Invited Email: ${to}`,
    `- Access Level: ${roleLabel}`,
    `- 3D Avatar Preset: ${genderLabel}`,
    `- Pass Code: ${input.accessCode}`,
    ``,
    `Sign in with ${to} after opening the link to enter "${museumTitle}" directly.`,
  ]
    .filter(Boolean)
    .join('\n');

  const boundary = `mymuseum_invite_${Date.now().toString(36)}`;
  const mimeLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    plainTextBody,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    htmlBody,
    ``,
    `--${boundary}--`,
  ];

  const rawMime = mimeLines.join('\r\n');
  const encodedRaw = encodeMimeMessageBase64Url(rawMime);

  return {
    to,
    subject,
    htmlBody,
    plainTextBody,
    rawMime,
    encodedRaw,
  };
}

/**
 * Sends the composed museum invitation email through the authenticated user's Gmail account.
 */
export async function sendMuseumInvitationEmail(
  accessToken: string,
  input: MuseumInvitationEmailInput
): Promise<{ messageId: string }> {
  const composed = buildMuseumInvitationEmail(input);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: composed.encodedRaw }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string } };
      if (errJson.error?.message) detail = errJson.error.message;
    } catch {
      // ignore non-json error body
    }
    const err = new Error(`Gmail could not send the invitation (${detail}).`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as { id?: string };
  return { messageId: data.id ?? 'sent' };
}
