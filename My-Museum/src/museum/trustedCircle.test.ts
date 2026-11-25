import test from 'node:test';
import assert from 'node:assert/strict';
import type { MuseumMeta, VisitorPresence } from '../types/museum';
import {
  ABID_PRIMARY_MUSEUM_ID,
  ABID_PRIMARY_OWNER_UID,
  computeMemberKey,
  isPresenceActive,
  isTrustedAbidVisitorEmail,
  pickPreferredInitialMuseumId,
  resolveMuseumCompanionAvatars,
} from './trustedCircle';
import { ABID_SIGNATURE_STYLE, EXCLUSIVE_ABID_EMAIL } from './exclusiveAvatar';

const abidMuseum: MuseumMeta = {
  id: ABID_PRIMARY_MUSEUM_ID,
  ownerId: ABID_PRIMARY_OWNER_UID,
  ownerName: 'Ashfaq Sarker Abid',
  title: "Ashfaq's Museum",
  description: 'Personal 3D gallery',
  accessCode: 'MUS-ABID',
  wallTheme: 'alabaster',
  isOpenByCode: false,
  memberEmails: ['suraia475@gmail.com', 'abidsarker098@gmail.com'],
  curatorEmails: [],
  artworkCount: 4,
};

const suraiaPersonalMuseum: MuseumMeta = {
  id: 'museum_suraia_uid',
  ownerId: 'suraia_uid',
  ownerName: 'Suraia',
  title: "Suraia's Museum",
  description: 'Personal 3D gallery',
  accessCode: 'MUS-SUR1',
  wallTheme: 'alabaster',
  isOpenByCode: false,
  memberEmails: [],
  curatorEmails: [],
  artworkCount: 0,
};

test('recognizes pre-authorized trusted visitor emails case-insensitively', () => {
  assert.equal(isTrustedAbidVisitorEmail('suraia475@gmail.com'), true);
  assert.equal(isTrustedAbidVisitorEmail('  ABIDSARKER098@GMAIL.COM '), true);
  assert.equal(isTrustedAbidVisitorEmail('random@example.com'), false);
});

test('selects Abid museum first for suraia475 and abidsarker098, and personal museum for owner', () => {
  const list = [suraiaPersonalMuseum, abidMuseum];
  assert.equal(
    pickPreferredInitialMuseumId(list, 'suraia_uid', 'suraia475@gmail.com'),
    ABID_PRIMARY_MUSEUM_ID
  );
  assert.equal(
    pickPreferredInitialMuseumId(list, 'abid098_uid', 'abidsarker098@gmail.com'),
    ABID_PRIMARY_MUSEUM_ID
  );
  assert.equal(
    pickPreferredInitialMuseumId(list, ABID_PRIMARY_OWNER_UID, EXCLUSIVE_ABID_EMAIL),
    ABID_PRIMARY_MUSEUM_ID
  );
  assert.equal(
    pickPreferredInitialMuseumId(list, 'suraia_uid', 'someoneelse@gmail.com'),
    suraiaPersonalMuseum.id
  );
});

test('deduplicates active Suraia presence by memberKey even if Google display name differs', () => {
  const now = 1_700_000_000_000;
  const suraiaLive: VisitorPresence = {
    uid: 'suraia_uid',
    museumId: abidMuseum.id,
    ownerId: abidMuseum.ownerId,
    memberKey: computeMemberKey('suraia475@gmail.com'),
    displayName: 'Suraia Akter',
    gender: 'woman',
    skinTone: '#E6BC9A',
    hairStyle: 'flowing',
    hairColor: '#4A3423',
    outfitStyle: 'dress',
    outfitColor: '#6E2E36',
    accentColor: '#C49A6C',
    accessory: 'scarf',
    x: 1.5,
    z: -2.4,
    yaw: 0.7,
    isOnline: true,
    updatedAt: now - 2000,
  };

  const companions = resolveMuseumCompanionAvatars({
    museum: abidMuseum,
    liveVisitors: [suraiaLive],
    members: [],
    showInvitedIn3D: true,
    selfUid: ABID_PRIMARY_OWNER_UID,
    selfEmail: EXCLUSIVE_ABID_EMAIL,
    nowMs: now,
  });

  // Should contain Suraia (active) and Abid Guest (standing offline), NO duplicate Suraia!
  assert.equal(companions.length, 2);
  const suraia = companions.find((c) => c.uid === 'suraia_uid');
  const abid098 = companions.find((c) => c.memberKey === computeMemberKey('abidsarker098@gmail.com'));
  assert.ok(suraia);
  assert.equal(suraia.isActive, true);
  assert.equal(suraia.x, 1.5);
  assert.ok(abid098);
  assert.equal(abid098.isActive, false);
});

test('marks visitor as standing offline when isOnline is false or heartbeat is stale', () => {
  const now = 1_700_000_000_000;
  assert.equal(isPresenceActive({ isOnline: true, updatedAt: now - 5_000 }, now), true);
  assert.equal(isPresenceActive({ isOnline: false, updatedAt: now - 1_000 }, now), false);
  assert.equal(isPresenceActive({ isOnline: true, updatedAt: now - 60_000 }, now), false);
});

test('when Suraia visits Abid museum while Abid is offline, Abid stands in place with his host model', () => {
  const companions = resolveMuseumCompanionAvatars({
    museum: abidMuseum,
    liveVisitors: [],
    members: [],
    showInvitedIn3D: true,
    selfUid: 'suraia_uid',
    selfEmail: 'suraia475@gmail.com',
    nowMs: 1_700_000_000_000,
  });

  // Should show Abid (host standing) and abidsarker098 (standing), never Suraia herself
  assert.equal(companions.length, 2);
  const host = companions.find((c) => c.memberKey === computeMemberKey(EXCLUSIVE_ABID_EMAIL));
  assert.ok(host);
  assert.equal(host.isActive, false);
  assert.equal(host.outfitStyle, ABID_SIGNATURE_STYLE);
  assert.equal(
    companions.some((c) => c.memberKey === computeMemberKey('suraia475@gmail.com')),
    false
  );
});
