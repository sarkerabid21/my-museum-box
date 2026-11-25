import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ABID_SIGNATURE_STYLE,
  EXCLUSIVE_ABID_EMAIL,
  enforceAccountAvatarPolicy,
  getAbidSignatureAvatar,
  isAbidSignatureAvatar,
  isExclusiveAbidAccount,
} from './exclusiveAvatar';
import { DEFAULT_AVATAR_BY_GENDER } from '../types/museum';

describe('Exclusive 3D Model Policy (abidsarker213@gmail.com)', () => {
  it('matches abidsarker213@gmail.com case-insensitively and rejects all other emails', () => {
    assert.equal(isExclusiveAbidAccount(EXCLUSIVE_ABID_EMAIL), true);
    assert.equal(isExclusiveAbidAccount('  ABIDSARKER213@GMAIL.COM  '), true);
    assert.equal(isExclusiveAbidAccount('other@gmail.com'), false);
    assert.equal(isExclusiveAbidAccount('abidsarker213@outlook.com'), false);
    assert.equal(isExclusiveAbidAccount(null), false);
    assert.equal(isExclusiveAbidAccount(undefined), false);
  });

  it('always locks abidsarker213@gmail.com to the signature 3D model', () => {
    const locked = enforceAccountAvatarPolicy(DEFAULT_AVATAR_BY_GENDER.woman, 'abidsarker213@gmail.com');
    assert.equal(isAbidSignatureAvatar(locked), true);
    assert.equal(locked.outfitStyle, ABID_SIGNATURE_STYLE);
    assert.equal(locked.hairStyle, ABID_SIGNATURE_STYLE);
    assert.equal(locked.gender, 'man');
    assert.equal(locked.accessory, 'glasses');
  });

  it('strips the exclusive signature model for guests and any other signed-in user', () => {
    const abidModel = getAbidSignatureAvatar('Ashfaq Sarker Abid');

    const forGuest = enforceAccountAvatarPolicy(abidModel, null);
    assert.equal(isAbidSignatureAvatar(forGuest), false);
    assert.notEqual(forGuest.outfitStyle, ABID_SIGNATURE_STYLE);

    const forOtherUser = enforceAccountAvatarPolicy(abidModel, 'friend@gmail.com');
    assert.equal(isAbidSignatureAvatar(forOtherUser), false);
    assert.notEqual(forOtherUser.hairStyle, ABID_SIGNATURE_STYLE);
  });
});
