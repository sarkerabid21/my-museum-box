import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ArtworkItem,
  AspectRatioType,
  AvatarConfig,
  FrameStyle,
  Gender,
  MemberRole,
  MuseumMember,
  MuseumMeta,
  VisitorPresence,
  WallTheme,
} from '../types/museum';
import { CURATED_SAMPLES } from '../data/seedMuseum';
import { generateAccessCode } from '../museum/layout';
import { normalizeAngle } from '../museum/cameraSteering';
import {
  ABID_PRIMARY_OWNER_UID,
  computeMemberKey,
  getDefaultTrustedMembersForOwner,
  isAbidMuseum,
  isTrustedAbidVisitorEmail,
} from '../museum/trustedCircle';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120) || `id_${Date.now()}`;
}

export async function loadOrCreateUserProfile(
  user: User,
  fallbackAvatar: AvatarConfig
): Promise<AvatarConfig> {
  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const d = snap.data();
      return {
        displayName: typeof d.displayName === 'string' ? d.displayName : fallbackAvatar.displayName,
        gender: d.gender === 'woman' ? 'woman' : 'man',
        skinTone: typeof d.skinTone === 'string' ? d.skinTone : fallbackAvatar.skinTone,
        hairStyle: typeof d.hairStyle === 'string' ? d.hairStyle : fallbackAvatar.hairStyle,
        hairColor: typeof d.hairColor === 'string' ? d.hairColor : fallbackAvatar.hairColor,
        outfitStyle: typeof d.outfitStyle === 'string' ? d.outfitStyle : fallbackAvatar.outfitStyle,
        outfitColor: typeof d.outfitColor === 'string' ? d.outfitColor : fallbackAvatar.outfitColor,
        accentColor: typeof d.accentColor === 'string' ? d.accentColor : fallbackAvatar.accentColor,
        accessory:
          d.accessory === 'glasses' || d.accessory === 'scarf' || d.accessory === 'lanyard'
            ? d.accessory
            : 'none',
      };
    }

    const displayName = (user.displayName || fallbackAvatar.displayName).trim().slice(0, 80) || 'Curator';
    const initial: AvatarConfig = {
      ...fallbackAvatar,
      displayName,
    };

    if (user.emailVerified) {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: initial.displayName,
        email: (user.email || '').slice(0, 160),
        gender: initial.gender,
        skinTone: initial.skinTone,
        hairStyle: initial.hairStyle,
        hairColor: initial.hairColor,
        outfitStyle: initial.outfitStyle,
        outfitColor: initial.outfitColor,
        accentColor: initial.accentColor,
        accessory: initial.accessory,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return initial;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(user: User, avatar: AvatarConfig): Promise<void> {
  if (!user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const payload = {
      displayName: avatar.displayName.trim().slice(0, 80) || 'Curator',
      email: (user.email || '').slice(0, 160),
      gender: avatar.gender,
      skinTone: avatar.skinTone,
      hairStyle: avatar.hairStyle.slice(0, 32),
      hairColor: avatar.hairColor,
      outfitStyle: avatar.outfitStyle.slice(0, 32),
      outfitColor: avatar.outfitColor,
      accentColor: avatar.accentColor,
      accessory: avatar.accessory,
      updatedAt: serverTimestamp(),
    };
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        uid: user.uid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensurePersonalMuseum(
  user: User,
  ownerName: string
): Promise<MuseumMeta> {
  const museumId = sanitizeId(`museum_${user.uid}`);
  const museumPath = `museums/${museumId}`;
  let opType = OperationType.GET;
  const trustedSeeds = getDefaultTrustedMembersForOwner(user.email);
  const trustedEmails = trustedSeeds.map((m) => m.email.toLowerCase());

  try {
    const snap = await getDoc(doc(db, 'museums', museumId));
    if (snap.exists()) {
      const existingMuseum = mapMuseumDoc(snap.id, snap.data());

      // Automatically ensure pre-authorized trusted circle emails are registered on Abid's museum
      if (trustedSeeds.length > 0 && user.emailVerified) {
        const existingLower = new Set(existingMuseum.memberEmails.map((e) => e.toLowerCase()));
        const missingSeeds = trustedSeeds.filter((s) => !existingLower.has(s.email.toLowerCase()));
        if (missingSeeds.length > 0) {
          const nextMembers = Array.from(
            new Set([...existingMuseum.memberEmails.map((e) => e.toLowerCase()), ...trustedEmails])
          ).slice(0, 10);
          try {
            const batch = writeBatch(db);
            for (const seed of missingSeeds) {
              batch.set(doc(db, 'museums', museumId, 'members', seed.id), {
                museumId,
                ownerId: user.uid,
                email: seed.email.toLowerCase(),
                displayName: seed.displayName,
                role: seed.role,
                gender: seed.gender,
                createdAt: serverTimestamp(),
              });
            }
            batch.update(doc(db, 'museums', museumId), {
              memberEmails: nextMembers,
              curatorEmails: existingMuseum.curatorEmails,
              updatedAt: serverTimestamp(),
            });
            await batch.commit();
            await syncArtworkViewerLists(
              museumId,
              user.uid,
              existingMuseum.isOpenByCode,
              nextMembers
            );
            return { ...existingMuseum, memberEmails: nextMembers };
          } catch (syncErr) {
            console.warn('Trusted circle sync skipped:', syncErr);
          }
        }
      }
      return existingMuseum;
    }

    opType = OperationType.CREATE;
    const safeOwner = (ownerName || user.displayName || 'Curator').trim().slice(0, 80);
    const accessCode = generateAccessCode(user.uid);
    const title = `${safeOwner.split(' ')[0]}'s Museum`.slice(0, 100);
    const description =
      'Personal 3D architectural gallery showcasing curated artworks and chronological photographic memories.';

    const batch = writeBatch(db);
    const museumRef = doc(db, 'museums', museumId);
    batch.set(museumRef, {
      ownerId: user.uid,
      ownerName: safeOwner,
      title,
      description,
      accessCode,
      wallTheme: 'alabaster',
      isOpenByCode: false,
      memberEmails: trustedEmails.slice(0, 10),
      curatorEmails: [],
      artworkCount: 0,
      roomNames: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const codeRef = doc(db, 'museumCodes', accessCode);
    batch.set(codeRef, {
      accessCode,
      museumId,
      ownerId: user.uid,
      title,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    // Seed trusted member records after parent museum exists (satisfies Master Gate rule)
    if (trustedSeeds.length > 0 && user.emailVerified) {
      try {
        const memBatch = writeBatch(db);
        for (const seed of trustedSeeds) {
          memBatch.set(doc(db, 'museums', museumId, 'members', seed.id), {
            museumId,
            ownerId: user.uid,
            email: seed.email.toLowerCase(),
            displayName: seed.displayName,
            role: seed.role,
            gender: seed.gender,
            createdAt: serverTimestamp(),
          });
        }
        await memBatch.commit();
      } catch (seedErr) {
        console.warn('Trusted member seed skipped:', seedErr);
      }
    }

    return {
      id: museumId,
      ownerId: user.uid,
      ownerName: safeOwner,
      title,
      description,
      accessCode,
      wallTheme: 'alabaster',
      isOpenByCode: false,
      memberEmails: trustedEmails.slice(0, 10),
      curatorEmails: [],
      artworkCount: 0,
      roomNames: {},
    };
  } catch (error) {
    handleFirestoreError(error, opType, museumPath);
  }
}

function mapMuseumDoc(id: string, d: Record<string, unknown>): MuseumMeta {
  const rawRoomNames =
    d.roomNames && typeof d.roomNames === 'object' && !Array.isArray(d.roomNames)
      ? (d.roomNames as Record<string, unknown>)
      : {};
  const roomNames: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawRoomNames)) {
    if (typeof v === 'string' && v.trim()) {
      roomNames[k] = v.trim().slice(0, 60);
    }
  }
  return {
    id,
    ownerId: String(d.ownerId ?? ''),
    ownerName: String(d.ownerName ?? 'Curator'),
    title: String(d.title ?? 'My Museum'),
    description: String(d.description ?? ''),
    accessCode: String(d.accessCode ?? 'MUS-0000'),
    wallTheme:
      d.wallTheme === 'travertine' || d.wallTheme === 'charcoal' ? d.wallTheme : 'alabaster',
    isOpenByCode: Boolean(d.isOpenByCode),
    memberEmails: Array.isArray(d.memberEmails) ? d.memberEmails.map(String) : [],
    curatorEmails: Array.isArray(d.curatorEmails) ? d.curatorEmails.map(String) : [],
    artworkCount: typeof d.artworkCount === 'number' ? d.artworkCount : 0,
    roomNames,
  };
}

export function subscribeAccessibleMuseums(
  user: User,
  onUpdate: (museums: MuseumMeta[]) => void
): Unsubscribe {
  let owned: MuseumMeta[] = [];
  let shared: MuseumMeta[] = [];
  let trustedShared: MuseumMeta[] = [];

  const emit = () => {
    const byId = new Map<string, MuseumMeta>();
    for (const m of [...owned, ...trustedShared, ...shared]) {
      byId.set(m.id, m);
    }
    onUpdate(Array.from(byId.values()));
  };

  const ownedQ = query(collection(db, 'museums'), where('ownerId', '==', user.uid));
  const unsubOwned = onSnapshot(
    ownedQ,
    (snap) => {
      owned = snap.docs.map((docSnap) => mapMuseumDoc(docSnap.id, docSnap.data()));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'museums')
  );

  let unsubShared: Unsubscribe = () => {};
  let unsubTrusted: Unsubscribe = () => {};
  if (user.emailVerified && user.email) {
    const sharedQ = query(
      collection(db, 'museums'),
      where('memberEmails', 'array-contains', user.email.toLowerCase())
    );
    unsubShared = onSnapshot(
      sharedQ,
      (snap) => {
        shared = snap.docs.map((docSnap) => mapMuseumDoc(docSnap.id, docSnap.data()));
        emit();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'museums')
    );

    // Pre-authorized trusted circle automatically discovers Abid's shared museum in real time
    if (isTrustedAbidVisitorEmail(user.email)) {
      const trustedQ = query(
        collection(db, 'museums'),
        where('ownerId', '==', ABID_PRIMARY_OWNER_UID)
      );
      unsubTrusted = onSnapshot(
        trustedQ,
        (snap) => {
          trustedShared = snap.docs.map((docSnap) => mapMuseumDoc(docSnap.id, docSnap.data()));
          emit();
        },
        (err) => {
          console.warn('Trusted shared museum lookup skipped:', err);
        }
      );
    }
  }

  return () => {
    unsubOwned();
    unsubShared();
    unsubTrusted();
  };
}

export async function findMuseumByAccessCode(rawCode: string): Promise<MuseumMeta | null> {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (code.length < 4 || code.length > 20) return null;
  const codePath = `museumCodes/${code}`;
  try {
    const codeSnap = await getDoc(doc(db, 'museumCodes', code));
    if (!codeSnap.exists()) return null;
    const museumId = String(codeSnap.data().museumId ?? '');
    if (!museumId) return null;
    const museumSnap = await getDoc(doc(db, 'museums', museumId));
    if (!museumSnap.exists()) return null;
    return mapMuseumDoc(museumSnap.id, museumSnap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, codePath);
  }
}

export async function fetchInvitedMuseum(
  museumId: string,
  accessCode?: string
): Promise<MuseumMeta | null> {
  const safeId = sanitizeId(museumId);
  try {
    const museumSnap = await getDoc(doc(db, 'museums', safeId));
    if (museumSnap.exists()) {
      return mapMuseumDoc(museumSnap.id, museumSnap.data());
    }
  } catch {
    // Fall through to code lookup if direct ID get was denied or missing
  }
  if (accessCode && accessCode.trim().length >= 4) {
    try {
      return await findMuseumByAccessCode(accessCode);
    } catch {
      return null;
    }
  }
  return null;
}

export function subscribeArtworks(
  museum: MuseumMeta,
  user: User,
  onUpdate: (artworks: ArtworkItem[]) => void
): Unsubscribe {
  const colPath = `museums/${museum.id}/artworks`;
  const colRef = collection(db, 'museums', museum.id, 'artworks');

  let q;
  if (
    museum.ownerId === user.uid ||
    (isAbidMuseum(museum) && user.emailVerified && isTrustedAbidVisitorEmail(user.email))
  ) {
    q = query(colRef, where('ownerId', '==', museum.ownerId));
  } else if (museum.isOpenByCode) {
    q = query(colRef, where('isOpenByCode', '==', true));
  } else {
    q = query(colRef, where('viewerEmails', 'array-contains', (user.email || '').toLowerCase()));
  }

  return onSnapshot(
    q,
    (snap) => {
      const list: ArtworkItem[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        const sampleMatch = CURATED_SAMPLES.find((s) => s.imageUrl === d.imageUrl);
        return {
          id: docSnap.id,
          museumId: String(d.museumId ?? museum.id),
          ownerId: String(d.ownerId ?? museum.ownerId),
          uploadedBy: String(d.uploadedBy ?? museum.ownerId),
          uploadedByName: String(d.uploadedByName ?? museum.ownerName),
          title: String(d.title ?? 'Untitled'),
          artist: String(d.artist ?? 'Unknown'),
          dateCaptured: String(d.dateCaptured ?? '2026-01-01'),
          notes: String(d.notes ?? ''),
          imageUrl: String(d.imageUrl ?? ''),
          aspectRatio:
            d.aspectRatio === '3:4' || d.aspectRatio === '1:1' ? d.aspectRatio : '4:3',
          frameStyle:
            d.frameStyle === 'walnut' ||
            d.frameStyle === 'obsidian' ||
            d.frameStyle === 'alabaster'
              ? d.frameStyle
              : 'bronze',
          isOpenByCode: Boolean(d.isOpenByCode),
          viewerEmails: Array.isArray(d.viewerEmails) ? d.viewerEmails.map(String) : [],
          cropMargin: sampleMatch?.cropMargin ?? 0,
        };
      });
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, colPath)
  );
}

export async function addArtworkToMuseum(
  museum: MuseumMeta,
  user: User,
  uploaderName: string,
  input: {
    title: string;
    artist: string;
    dateCaptured: string;
    notes: string;
    imageUrl: string;
    aspectRatio: AspectRatioType;
    frameStyle: FrameStyle;
  }
): Promise<string> {
  const artworkId = sanitizeId(`art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const artPath = `museums/${museum.id}/artworks/${artworkId}`;
  try {
    await setDoc(doc(db, 'museums', museum.id, 'artworks', artworkId), {
      museumId: museum.id,
      ownerId: museum.ownerId,
      uploadedBy: user.uid,
      uploadedByName: uploaderName.trim().slice(0, 80) || 'Curator',
      title: input.title.trim().slice(0, 120),
      artist: input.artist.trim().slice(0, 100),
      dateCaptured: input.dateCaptured,
      notes: input.notes.trim().slice(0, 500),
      imageUrl: input.imageUrl,
      aspectRatio: input.aspectRatio,
      frameStyle: input.frameStyle,
      isOpenByCode: museum.isOpenByCode,
      viewerEmails: museum.memberEmails.slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (museum.ownerId === user.uid) {
      await updateDoc(doc(db, 'museums', museum.id), {
        artworkCount: Math.min(200, museum.artworkCount + 1),
        updatedAt: serverTimestamp(),
      });
    }
    return artworkId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, artPath);
  }
}

export async function deleteArtworkFromMuseum(
  museum: MuseumMeta,
  user: User,
  artworkId: string
): Promise<void> {
  const artPath = `museums/${museum.id}/artworks/${artworkId}`;
  try {
    await deleteDoc(doc(db, 'museums', museum.id, 'artworks', artworkId));
    if (museum.ownerId === user.uid) {
      await updateDoc(doc(db, 'museums', museum.id), {
        artworkCount: Math.max(0, museum.artworkCount - 1),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, artPath);
  }
}

export function subscribeMembers(
  museum: MuseumMeta,
  user: User,
  onUpdate: (members: MuseumMember[]) => void
): Unsubscribe {
  const colPath = `museums/${museum.id}/members`;
  const colRef = collection(db, 'museums', museum.id, 'members');
  const q =
    museum.ownerId === user.uid
      ? query(colRef, where('ownerId', '==', user.uid))
      : query(colRef, where('email', '==', (user.email || '').toLowerCase()));

  return onSnapshot(
    q,
    (snap) => {
      const members: MuseumMember[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          museumId: String(d.museumId ?? museum.id),
          ownerId: String(d.ownerId ?? museum.ownerId),
          email: String(d.email ?? ''),
          displayName: String(d.displayName ?? 'Visitor'),
          role: d.role === 'curator' ? 'curator' : 'visitor',
          gender: d.gender === 'woman' ? 'woman' : 'man',
        };
      });
      onUpdate(members);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, colPath)
  );
}

async function syncArtworkViewerLists(
  museumId: string,
  ownerId: string,
  isOpenByCode: boolean,
  memberEmails: string[]
): Promise<void> {
  const colRef = collection(db, 'museums', museumId, 'artworks');
  const snap = await getDocs(query(colRef, where('ownerId', '==', ownerId)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      isOpenByCode,
      viewerEmails: memberEmails.slice(0, 10),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function grantMuseumAccess(
  museum: MuseumMeta,
  input: { email: string; displayName: string; role: MemberRole; gender: Gender }
): Promise<void> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const memberId = sanitizeId(`mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const memberPath = `museums/${museum.id}/members/${memberId}`;

  const nextMembers = Array.from(new Set([...museum.memberEmails, normalizedEmail])).slice(0, 10);
  const nextCurators =
    input.role === 'curator'
      ? Array.from(new Set([...museum.curatorEmails, normalizedEmail])).slice(0, 10)
      : museum.curatorEmails.filter((e) => e !== normalizedEmail);

  try {
    await setDoc(doc(db, 'museums', museum.id, 'members', memberId), {
      museumId: museum.id,
      ownerId: museum.ownerId,
      email: normalizedEmail,
      displayName: input.displayName.trim().slice(0, 80),
      role: input.role,
      gender: input.gender,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'museums', museum.id), {
      memberEmails: nextMembers,
      curatorEmails: nextCurators,
      updatedAt: serverTimestamp(),
    });

    await syncArtworkViewerLists(museum.id, museum.ownerId, museum.isOpenByCode, nextMembers);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }
}

export async function revokeMuseumAccess(
  museum: MuseumMeta,
  member: MuseumMember
): Promise<void> {
  const memberPath = `museums/${museum.id}/members/${member.id}`;
  const nextMembers = museum.memberEmails.filter((e) => e !== member.email.toLowerCase());
  const nextCurators = museum.curatorEmails.filter((e) => e !== member.email.toLowerCase());

  try {
    await deleteDoc(doc(db, 'museums', museum.id, 'members', member.id));
    await updateDoc(doc(db, 'museums', museum.id), {
      memberEmails: nextMembers,
      curatorEmails: nextCurators,
      updatedAt: serverTimestamp(),
    });
    await syncArtworkViewerLists(museum.id, museum.ownerId, museum.isOpenByCode, nextMembers);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, memberPath);
  }
}

export async function updateMuseumSettings(
  museum: MuseumMeta,
  patch: Partial<{ title: string; description: string; wallTheme: WallTheme; isOpenByCode: boolean }>
): Promise<void> {
  const path = `museums/${museum.id}`;
  try {
    await updateDoc(doc(db, 'museums', museum.id), {
      title: (patch.title ?? museum.title).trim().slice(0, 100),
      description: (patch.description ?? museum.description).trim().slice(0, 400),
      wallTheme: patch.wallTheme ?? museum.wallTheme,
      isOpenByCode: patch.isOpenByCode ?? museum.isOpenByCode,
      updatedAt: serverTimestamp(),
    });
    if (patch.isOpenByCode !== undefined && patch.isOpenByCode !== museum.isOpenByCode) {
      await syncArtworkViewerLists(
        museum.id,
        museum.ownerId,
        patch.isOpenByCode,
        museum.memberEmails
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateMuseumRoomNames(
  museum: MuseumMeta,
  roomNames: Record<string, string>
): Promise<void> {
  const path = `museums/${museum.id}`;
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(roomNames).slice(0, 30)) {
    const trimmed = v.trim().slice(0, 60);
    if (trimmed) cleaned[k] = trimmed;
  }
  try {
    await updateDoc(doc(db, 'museums', museum.id), {
      roomNames: cleaned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function upsertPresence(
  museum: MuseumMeta,
  user: User,
  avatar: AvatarConfig,
  x: number,
  z: number,
  yaw: number,
  isOnline = true,
  ridingRideId: string | null = null,
  ridingVehicleId: string | null = null
): Promise<void> {
  if (!user.emailVerified) return;
  const path = `museums/${museum.id}/presence/${user.uid}`;
  const memberKey = computeMemberKey(user.email);
  const boundedYaw = normalizeAngle(yaw);
  try {
    const payload: Record<string, unknown> = {
      museumId: museum.id,
      ownerId: museum.ownerId,
      uid: user.uid,
      displayName: avatar.displayName.trim().slice(0, 80) || 'Visitor',
      gender: avatar.gender,
      skinTone: avatar.skinTone,
      hairStyle: avatar.hairStyle.slice(0, 32),
      hairColor: avatar.hairColor,
      outfitStyle: avatar.outfitStyle.slice(0, 32),
      outfitColor: avatar.outfitColor,
      accentColor: avatar.accentColor,
      accessory: avatar.accessory,
      x: Math.max(-50, Math.min(50, Number(x.toFixed(2)))),
      z: Math.max(-590, Math.min(50, Number(z.toFixed(2)))),
      yaw: Math.max(-9.9, Math.min(9.9, Number(boundedYaw.toFixed(3)))),
      isOnline: Boolean(isOnline),
      ridingRideId: ridingRideId ?? null,
      ridingVehicleId: ridingVehicleId ?? null,
      isOpenByCode: museum.isOpenByCode,
      viewerEmails: museum.memberEmails.slice(0, 10),
      updatedAt: serverTimestamp(),
    };
    if (memberKey) {
      payload.memberKey = memberKey;
    }
    await setDoc(doc(db, 'museums', museum.id, 'presence', user.uid), payload);
  } catch (error) {
    // Non-fatal presence errors are logged without crashing navigation
    console.warn('Presence update skipped:', error);
  }
}

/**
 * Marks the visitor's 3D model as standing offline at their last position rather than deleting it,
 * so other visitors continue to see their 3D model standing calmly in place until they reconnect.
 */
export async function markPresenceOffline(
  museum: MuseumMeta,
  user: User,
  avatar: AvatarConfig,
  x: number,
  z: number,
  yaw: number
): Promise<void> {
  await upsertPresence(museum, user, avatar, x, z, yaw, false);
}

export async function removePresence(museumId: string, uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'museums', museumId, 'presence', uid));
  } catch {
    // Ignore cleanup errors on unmount
  }
}

export function subscribePresence(
  museum: MuseumMeta,
  user: User,
  onUpdate: (visitors: VisitorPresence[]) => void
): Unsubscribe {
  const colPath = `museums/${museum.id}/presence`;
  const colRef = collection(db, 'museums', museum.id, 'presence');

  let q;
  if (
    museum.ownerId === user.uid ||
    (isAbidMuseum(museum) && user.emailVerified && isTrustedAbidVisitorEmail(user.email))
  ) {
    q = query(colRef, where('ownerId', '==', museum.ownerId));
  } else if (museum.isOpenByCode) {
    q = query(colRef, where('isOpenByCode', '==', true));
  } else {
    q = query(colRef, where('viewerEmails', 'array-contains', (user.email || '').toLowerCase()));
  }

  return onSnapshot(
    q,
    (snap) => {
      const list: VisitorPresence[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          const updatedAtMs =
            d.updatedAt && typeof d.updatedAt.toMillis === 'function'
              ? (d.updatedAt.toMillis() as number)
              : Date.now();
          return {
            uid: String(d.uid ?? docSnap.id),
            museumId: String(d.museumId ?? museum.id),
            ownerId: String(d.ownerId ?? museum.ownerId),
            memberKey: typeof d.memberKey === 'string' ? d.memberKey : undefined,
            displayName: String(d.displayName ?? 'Visitor'),
            gender: (d.gender === 'woman' ? 'woman' : 'man') as Gender,
            skinTone: String(d.skinTone ?? '#D49E76'),
            hairStyle: String(d.hairStyle ?? 'taper'),
            hairColor: String(d.hairColor ?? '#1E1B18'),
            outfitStyle: String(d.outfitStyle ?? 'blazer'),
            outfitColor: String(d.outfitColor ?? '#233447'),
            accentColor: String(d.accentColor ?? '#EFECE6'),
            accessory:
              d.accessory === 'glasses' || d.accessory === 'scarf' || d.accessory === 'lanyard'
                ? d.accessory
                : 'none',
            x: typeof d.x === 'number' ? d.x : 0,
            z: typeof d.z === 'number' ? d.z : 2,
            yaw: typeof d.yaw === 'number' ? d.yaw : 0,
            isOnline: typeof d.isOnline === 'boolean' ? d.isOnline : true,
            ridingRideId: typeof d.ridingRideId === 'string' ? d.ridingRideId : null,
            ridingVehicleId: typeof d.ridingVehicleId === 'string' ? d.ridingVehicleId : null,
            updatedAt: updatedAtMs,
          };
        })
        .filter((v) => v.uid !== user.uid);
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, colPath)
  );
}
