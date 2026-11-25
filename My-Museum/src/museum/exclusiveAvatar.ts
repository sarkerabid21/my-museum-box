import { DEFAULT_AVATAR_BY_GENDER, type AvatarConfig } from '../types/museum';

export const EXCLUSIVE_ABID_EMAIL = 'abidsarker213@gmail.com';
export const ABID_SIGNATURE_STYLE = 'abid_signature';
export const ABID_SIGNATURE_VIDEO_URL =
  '/assets/aistudio/tripo-showcase-bca99e5e-94d8-4496-ae11-dab79a275a2d_2cd94ade.mp4';
export const ABID_TRIPO_SOURCE_URL =
  'https://studio.tripo3d.ai/3d-model/bca99e5e-94d8-4496-ae11-dab79a275a2d';

/**
 * Returns true ONLY when the authenticated email strictly matches abidsarker213@gmail.com.
 */
export function isExclusiveAbidAccount(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === EXCLUSIVE_ABID_EMAIL;
}

/**
 * Checks whether an AvatarConfig represents Abid's exclusive signature 3D model.
 */
export function isAbidSignatureAvatar(avatar: Pick<AvatarConfig, 'outfitStyle' | 'hairStyle'>): boolean {
  return (
    avatar.outfitStyle === ABID_SIGNATURE_STYLE ||
    avatar.hairStyle === ABID_SIGNATURE_STYLE
  );
}

/**
 * Returns Abid's exclusive signature 3D model configuration matching his Tripo 3D showcase:
 * burgundy/navy plaid rolled-sleeve shirt, ivory chinos, charcoal white-sole sneakers,
 * rose-silver rectangular glasses, sculpted beard/moustache, and dark wristwatch.
 */
export function getAbidSignatureAvatar(displayName?: string | null): AvatarConfig {
  const cleanName = (displayName ?? '').trim().slice(0, 80) || 'Ashfaq Sarker Abid';
  return {
    displayName: cleanName,
    gender: 'man',
    skinTone: '#B87D58',
    hairStyle: ABID_SIGNATURE_STYLE,
    hairColor: '#161515',
    outfitStyle: ABID_SIGNATURE_STYLE,
    outfitColor: '#5E2333',
    accentColor: '#EFECE5',
    accessory: 'glasses',
  };
}

/**
 * Enforces strict account-level model exclusivity:
 * - abidsarker213@gmail.com ALWAYS uses his exclusive signature 3D model.
 * - Guests and all other email accounts NEVER receive the exclusive signature model.
 */
export function enforceAccountAvatarPolicy(
  avatar: AvatarConfig,
  userEmail?: string | null
): AvatarConfig {
  if (isExclusiveAbidAccount(userEmail)) {
    if (
      avatar.outfitStyle === ABID_SIGNATURE_STYLE &&
      avatar.hairStyle === ABID_SIGNATURE_STYLE &&
      (avatar.displayName?.trim() || 'Ashfaq Sarker Abid') === avatar.displayName
    ) {
      return avatar;
    }
    return getAbidSignatureAvatar(avatar.displayName);
  }

  if (isAbidSignatureAvatar(avatar)) {
    const fallback = DEFAULT_AVATAR_BY_GENDER[avatar.gender];
    return {
      ...fallback,
      displayName: avatar.displayName || fallback.displayName,
    };
  }

  return avatar;
}
