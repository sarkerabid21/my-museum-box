import {
  DEFAULT_AVATAR_BY_GENDER,
  type AvatarConfig,
  type Gender,
  type MemberRole,
  type MuseumMember,
  type MuseumMeta,
  type VisitorPresence,
} from '../types/museum';
import {
  EXCLUSIVE_ABID_EMAIL,
  getAbidSignatureAvatar,
  isExclusiveAbidAccount,
} from './exclusiveAvatar';

export const ABID_PRIMARY_OWNER_UID = 'CwufCmYF1kOQRybSTFLoktJuo8b2';
export const ABID_PRIMARY_MUSEUM_ID = `museum_${ABID_PRIMARY_OWNER_UID}`;
export const PRESENCE_ACTIVE_WINDOW_MS = 28_000;

export interface TrustedMemberSeed {
  id: string;
  email: string;
  displayName: string;
  gender: Gender;
  role: MemberRole;
  standbyX: number;
  standbyZ: number;
  standbyYaw: number;
  outfitColor: string;
}

/**
 * Pre-authorized trusted circle for Abid's museum (abidsarker213@gmail.com).
 * These accounts automatically have access to Abid's museum, see all artworks added,
 * stand calmly in place when offline, and become live/active 3D avatars when signed in.
 */
export const ABID_TRUSTED_MEMBERS: readonly TrustedMemberSeed[] = [
  {
    id: 'mem_trusted_suraia475',
    email: 'suraia475@gmail.com',
    displayName: 'Suraia',
    gender: 'woman',
    role: 'visitor',
    standbyX: -2.85,
    standbyZ: 1.8,
    standbyYaw: 0.45,
    outfitColor: '#6E2E36',
  },
  {
    id: 'mem_trusted_abidsarker098',
    email: 'abidsarker098@gmail.com',
    displayName: 'Abid (Guest)',
    gender: 'man',
    role: 'visitor',
    standbyX: 2.85,
    standbyZ: 1.8,
    standbyYaw: -0.45,
    outfitColor: '#2D4739',
  },
] as const;

export const ABID_TRUSTED_VISITOR_EMAILS: readonly string[] = ABID_TRUSTED_MEMBERS.map(
  (m) => m.email
);

/**
 * Deterministic non-PII key derived from a normalized email address.
 * Stored on Firestore presence docs so we can cleanly match a live/offline presence record
 * to an invited member without exposing raw email addresses in shared presence documents.
 */
export function computeMemberKey(email?: string | null): string {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function isTrustedAbidVisitorEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ABID_TRUSTED_VISITOR_EMAILS.includes(normalized);
}

export function isAbidMuseum(museum: Pick<MuseumMeta, 'id' | 'ownerId'>): boolean {
  return museum.id === ABID_PRIMARY_MUSEUM_ID || museum.ownerId === ABID_PRIMARY_OWNER_UID;
}

export function getDefaultTrustedMembersForOwner(ownerEmail?: string | null): readonly TrustedMemberSeed[] {
  return isExclusiveAbidAccount(ownerEmail) ? ABID_TRUSTED_MEMBERS : [];
}

/**
 * Determines whether a Firestore presence record is currently live & actively inside the museum.
 */
export function isPresenceActive(
  presence: Pick<VisitorPresence, 'isOnline' | 'updatedAt'>,
  nowMs = Date.now()
): boolean {
  if (presence.isOnline === false) return false;
  if (typeof presence.updatedAt === 'number' && presence.updatedAt > 0) {
    return nowMs - presence.updatedAt <= PRESENCE_ACTIVE_WINDOW_MS;
  }
  return presence.isOnline === true;
}

/**
 * Picks the best default museum upon sign-in:
 * - For Abid's trusted visitors (suraia475@gmail.com, abidsarker098@gmail.com),
 *   automatically lands directly in Abid's shared museum so they see his artworks immediately.
 * - For the owner and all other accounts, lands in their own personal museum.
 */
export function pickPreferredInitialMuseumId(
  museums: MuseumMeta[],
  userUid: string,
  userEmail?: string | null
): string {
  if (museums.length === 0) return '';

  if (isTrustedAbidVisitorEmail(userEmail)) {
    const abidMuseum =
      museums.find((m) => isAbidMuseum(m)) ??
      museums.find((m) => m.ownerId !== userUid);
    if (abidMuseum) return abidMuseum.id;
  }

  const personal = museums.find((m) => m.ownerId === userUid);
  return personal ? personal.id : museums[0].id;
}

export interface CompanionAvatarEntry extends VisitorPresence {
  isActive: boolean;
}

function buildStandbyAvatarFromMember(
  museum: Pick<MuseumMeta, 'id' | 'ownerId'>,
  member: Pick<MuseumMember, 'id' | 'email' | 'displayName' | 'gender'>,
  index: number
): CompanionAvatarEntry {
  const emailLower = member.email.trim().toLowerCase();
  const trustedSeed = ABID_TRUSTED_MEMBERS.find((t) => t.email === emailLower);
  const preset: AvatarConfig = DEFAULT_AVATAR_BY_GENDER[member.gender];

  const fallbackX = index % 2 === 0 ? -3.1 : 3.1;
  const fallbackZ = 1.6 - Math.floor(index / 2) * 2.2;
  const fallbackYaw = index % 2 === 0 ? 0.45 : -0.45;

  return {
    uid: `standby-${member.id}`,
    museumId: museum.id,
    ownerId: museum.ownerId,
    memberKey: computeMemberKey(emailLower),
    displayName: member.displayName,
    gender: member.gender,
    skinTone: preset.skinTone,
    hairStyle: preset.hairStyle,
    hairColor: preset.hairColor,
    outfitStyle: preset.outfitStyle,
    outfitColor: trustedSeed?.outfitColor ?? (member.gender === 'woman' ? '#6E2E36' : '#2D4739'),
    accentColor: preset.accentColor,
    accessory: preset.accessory,
    x: trustedSeed?.standbyX ?? fallbackX,
    z: trustedSeed?.standbyZ ?? Math.max(-5.5, Math.min(4.2, fallbackZ)),
    yaw: trustedSeed?.standbyYaw ?? fallbackYaw,
    isOnline: false,
    isActive: false,
    ridingRideId: null,
    ridingVehicleId: null,
  };
}

/**
 * Resolves the exact set of other 3D avatars shown inside the museum:
 * 1. Every other user who has a real Firestore presence record appears at their exact coordinates
 *    (live/active & walking when isOnline + fresh heartbeat; standing straight in place when offline).
 * 2. Any invited / trusted member (and the museum owner when visited by a guest) who has not
 *    entered yet stands calmly in a neat Room 1 welcome spot with `isActive: false` (no fake patrolling).
 * 3. Strictly deduplicated by `uid` and non-PII `memberKey` so nobody ever spawns twice.
 */
export function resolveMuseumCompanionAvatars(params: {
  museum: MuseumMeta;
  liveVisitors: VisitorPresence[];
  members: MuseumMember[];
  showInvitedIn3D: boolean;
  selfUid?: string | null;
  selfEmail?: string | null;
  nowMs?: number;
}): CompanionAvatarEntry[] {
  const {
    museum,
    liveVisitors,
    members,
    showInvitedIn3D,
    selfUid,
    selfEmail,
    nowMs = Date.now(),
  } = params;

  const selfKey = computeMemberKey(selfEmail);
  const result: CompanionAvatarEntry[] = [];
  const seenUids = new Set<string>();
  const seenKeys = new Set<string>();
  const seenNames = new Set<string>();

  if (selfUid) seenUids.add(selfUid);
  if (selfKey) seenKeys.add(selfKey);

  // 1. Add real Firestore presence records (both live active visitors & offline standing visitors)
  for (const v of liveVisitors) {
    if (seenUids.has(v.uid)) continue;
    if (v.memberKey && seenKeys.has(v.memberKey)) continue;

    seenUids.add(v.uid);
    if (v.memberKey) seenKeys.add(v.memberKey);
    seenNames.add(v.displayName.trim().toLowerCase());

    result.push({
      ...v,
      isActive: isPresenceActive(v, nowMs),
    });
  }

  if (!showInvitedIn3D) {
    return result;
  }

  // 2. If a visitor is inside Abid's museum while Abid himself has no presence doc yet,
  //    render Abid's own signature 3D model standing calmly as the museum host.
  const abidOwnerKey = computeMemberKey(EXCLUSIVE_ABID_EMAIL);
  if (
    isAbidMuseum(museum) &&
    selfUid !== museum.ownerId &&
    !seenUids.has(museum.ownerId) &&
    !seenKeys.has(abidOwnerKey)
  ) {
    const abidHost = getAbidSignatureAvatar(museum.ownerName || 'Ashfaq Sarker Abid');
    seenUids.add(museum.ownerId);
    seenKeys.add(abidOwnerKey);
    seenNames.add(abidHost.displayName.trim().toLowerCase());

    result.push({
      uid: `standby-owner-${museum.ownerId}`,
      museumId: museum.id,
      ownerId: museum.ownerId,
      memberKey: abidOwnerKey,
      displayName: abidHost.displayName,
      gender: abidHost.gender,
      skinTone: abidHost.skinTone,
      hairStyle: abidHost.hairStyle,
      hairColor: abidHost.hairColor,
      outfitStyle: abidHost.outfitStyle,
      outfitColor: abidHost.outfitColor,
      accentColor: abidHost.accentColor,
      accessory: abidHost.accessory,
      x: 0,
      z: -1.8,
      yaw: 0,
      isOnline: false,
      isActive: false,
    });
  }

  // 3. Merge Firestore invited members + Abid's trusted circle seeds (deduplicated by memberKey)
  const standbyRoster: Pick<MuseumMember, 'id' | 'email' | 'displayName' | 'gender'>[] = [...members];

  if (isAbidMuseum(museum) || isExclusiveAbidAccount(selfEmail)) {
    const rosterKeys = new Set(standbyRoster.map((m) => computeMemberKey(m.email)));
    for (const seed of ABID_TRUSTED_MEMBERS) {
      const k = computeMemberKey(seed.email);
      if (!rosterKeys.has(k)) {
        rosterKeys.add(k);
        standbyRoster.push({
          id: seed.id,
          email: seed.email,
          displayName: seed.displayName,
          gender: seed.gender,
        });
      }
    }
  }

  let standbyIdx = 0;
  for (const member of standbyRoster) {
    const key = computeMemberKey(member.email);
    const nameLower = member.displayName.trim().toLowerCase();
    if ((key && seenKeys.has(key)) || (!key && seenNames.has(nameLower))) {
      continue;
    }
    if (key) seenKeys.add(key);
    seenNames.add(nameLower);
    result.push(buildStandbyAvatarFromMember(museum, member, standbyIdx));
    standbyIdx++;
  }

  return result;
}
