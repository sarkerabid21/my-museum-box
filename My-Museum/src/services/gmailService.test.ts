import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMuseumInvitationEmail,
  buildMuseumInviteUrl,
  encodeMimeMessageBase64Url,
  parseMuseumInviteFromSearch,
} from './gmailService.ts';

describe('Museum invite link builder & parser', () => {
  it('builds a direct invite URL and round-trips it cleanly', () => {
    const url = buildMuseumInviteUrl('https://my-museum.example.com/', {
      museumId: 'museum_abc123',
      accessCode: 'MUS-742A',
      museumTitle: "Abid's Museum",
      hostName: 'Ashfaq Abid',
    });

    assert.ok(url.startsWith('https://my-museum.example.com/?'));
    const parsedUrl = new URL(url);
    const parsed = parseMuseumInviteFromSearch(parsedUrl.search);
    assert.ok(parsed);
    assert.equal(parsed.museumId, 'museum_abc123');
    assert.equal(parsed.accessCode, 'MUS-742A');
    assert.equal(parsed.museumTitle, "Abid's Museum");
    assert.equal(parsed.hostName, 'Ashfaq Abid');
  });

  it('rejects malformed or missing invite query parameters', () => {
    assert.equal(parseMuseumInviteFromSearch(''), null);
    assert.equal(parseMuseumInviteFromSearch('?invite=../bad/path&code=MUS-1111'), null);
  });
});

describe('HTML museum invitation email composer', () => {
  it('generates escaped HTML + plain text MIME message containing the direct link and code', () => {
    const inviteUrl = buildMuseumInviteUrl('https://my-museum.example.com', {
      museumId: 'museum_xyz',
      accessCode: 'MUS-9988',
      museumTitle: 'Royal <Art> Salon',
      hostName: 'Abid',
    });

    const composed = buildMuseumInvitationEmail({
      recipientEmail: 'Guest.User@Example.com',
      recipientName: 'Nadia <Rahman>',
      hostName: 'Abid',
      museumTitle: 'Royal <Art> Salon',
      museumId: 'museum_xyz',
      accessCode: 'MUS-9988',
      role: 'visitor',
      gender: 'woman',
      inviteUrl,
      personalNote: 'Come explore Room II!',
    });

    assert.equal(composed.to, 'guest.user@example.com');
    assert.ok(composed.subject.includes('Royal <Art> Salon'));
    assert.ok(composed.htmlBody.includes('Nadia &lt;Rahman&gt;'), 'HTML must escape user input');
    assert.ok(composed.htmlBody.includes('MUS-9988'));
    assert.ok(composed.htmlBody.includes('Woman 3D Model'));
    assert.ok(composed.htmlBody.includes('Come explore Room II!'));
    assert.ok(composed.plainTextBody.includes(inviteUrl));

    // Verify URL-safe base64 encoding has no +, /, or = padding
    assert.equal(/[+/=]/.test(composed.encodedRaw), false);
    assert.ok(composed.encodedRaw.length > 200);
  });

  it('encodes UTF-8 characters (including Bengali/Unicode) safely to base64url', () => {
    const encoded = encodeMimeMessageBase64Url('Subject: আমার মিউজিয়াম — Invitation');
    assert.equal(/[+/=]/.test(encoded), false);
    assert.ok(encoded.length > 20);
  });
});
