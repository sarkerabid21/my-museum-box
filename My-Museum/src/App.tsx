import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRedirectResult, onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  auth,
  clearGmailAccessToken,
  requestGmailSendToken,
  signInWithGoogle,
  signInWithGoogleRedirect,
} from './firebase';
import {
  addArtworkToMuseum,
  deleteArtworkFromMuseum,
  ensurePersonalMuseum,
  fetchInvitedMuseum,
  findMuseumByAccessCode,
  grantMuseumAccess,
  loadOrCreateUserProfile,
  markPresenceOffline,
  revokeMuseumAccess,
  saveUserProfile,
  subscribeAccessibleMuseums,
  subscribeArtworks,
  subscribeMembers,
  subscribePresence,
  updateMuseumRoomNames,
  updateMuseumSettings,
  upsertPresence,
} from './services/museumService';
import {
  buildMuseumInviteUrl,
  parseMuseumInviteFromSearch,
  sendMuseumInvitationEmail,
  type PendingMuseumInvite,
} from './services/gmailService';
import {
  DEFAULT_AVATAR_BY_GENDER,
  type ArtworkItem,
  type AspectRatioType,
  type AvatarConfig,
  type FrameStyle,
  type Gender,
  type MemberRole,
  type MuseumMember,
  type MuseumMeta,
  type VisitorPresence,
  type WallTheme,
} from './types/museum';
import {
  createSeedArtworks,
  createSeedMembers,
  createSeedMuseum,
} from './data/seedMuseum';
import {
  calculateMuseumLayout,
  getResolvedRoomName,
  toRomanNumeral,
} from './museum/layout';
import {
  enforceAccountAvatarPolicy,
  isAbidSignatureAvatar,
  isExclusiveAbidAccount,
} from './museum/exclusiveAvatar';
import {
  isAbidMuseum,
  isTrustedAbidVisitorEmail,
  pickPreferredInitialMuseumId,
} from './museum/trustedCircle';
import {
  clearCustomGlbForAccount,
  loadCustomGlbForAccount,
  saveCustomGlbForAccount,
} from './services/customModelStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeStudio, type InviteBannerState } from './components/HomeStudio';
import { Museum3DView } from './components/Museum3DView';
import { CatalogDrawer } from './components/CatalogDrawer';
import { UploadArtworkModal } from './components/UploadArtworkModal';
import { AccessModal, type InviteEmailDraft } from './components/AccessModal';
import { ArtworkInspectModal } from './components/ArtworkInspectModal';
import { RenameRoomModal } from './components/RenameRoomModal';

const STORAGE_AVATAR_KEY = 'mymuseum_avatar_v1';
const STORAGE_ARTWORKS_KEY = 'mymuseum_guest_artworks_v2';
const STORAGE_MEMBERS_KEY = 'mymuseum_guest_members_v2';
const STORAGE_MUSEUM_KEY = 'mymuseum_guest_museum_v2';

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clearGuestStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_ARTWORKS_KEY);
    window.localStorage.removeItem(STORAGE_MEMBERS_KEY);
    window.localStorage.removeItem(STORAGE_MUSEUM_KEY);
    // Also clean legacy v1 keys if present
    window.localStorage.removeItem('mymuseum_guest_artworks_v1');
    window.localStorage.removeItem('mymuseum_guest_members_v1');
    window.localStorage.removeItem('mymuseum_guest_museum_v1');
  } catch {
    // Ignore storage access errors
  }
}

function createEmptyAccountMuseumPlaceholder(user: User): MuseumMeta {
  const name = (user.displayName || user.email?.split('@')[0] || 'Curator').slice(0, 80);
  return {
    id: `museum_${user.uid}`,
    ownerId: user.uid,
    ownerName: name,
    title: `${name.split(' ')[0]}'s Museum`,
    description: 'Loading your private cloud museum...',
    accessCode: 'LOADING',
    wallTheme: 'alabaster',
    isOpenByCode: false,
    memberEmails: [],
    curatorEmails: [],
    artworkCount: 0,
    roomNames: {},
  };
}

function MyMuseumApp() {
  const autostart = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  }, []);

  const [view, setView] = useState<'home' | 'museum'>(autostart ? 'museum' : 'home');
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);

  // Avatar Config (synced with Firestore when signed in, localStorage when guest)
  const [avatar, setAvatar] = useState<AvatarConfig>(() =>
    enforceAccountAvatarPolicy(
      loadStoredJson<AvatarConfig>(STORAGE_AVATAR_KEY, DEFAULT_AVATAR_BY_GENDER.man),
      null
    )
  );
  const avatarRef = useRef(avatar);
  avatarRef.current = avatar;

  // Exclusive personal .GLB override (strictly locked to abidsarker213@gmail.com)
  const isExclusiveAbid = isExclusiveAbidAccount(user?.email);
  const [customGlbBuffer, setCustomGlbBuffer] = useState<ArrayBuffer | null>(null);
  const [customGlbName, setCustomGlbName] = useState<string | null>(null);

  // Strictly isolated Guest Preview state (ONLY used when user === null)
  const [guestMuseum, setGuestMuseum] = useState<MuseumMeta>(() =>
    loadStoredJson<MuseumMeta>(STORAGE_MUSEUM_KEY, createSeedMuseum('guest', 'Julian Vance'))
  );
  const [guestArtworks, setGuestArtworks] = useState<ArtworkItem[]>(() =>
    loadStoredJson<ArtworkItem[]>(
      STORAGE_ARTWORKS_KEY,
      createSeedArtworks('museum-guest', 'guest', 'Julian Vance')
    )
  );
  const [guestMembers, setGuestMembers] = useState<MuseumMember[]>(() =>
    loadStoredJson<MuseumMember[]>(
      STORAGE_MEMBERS_KEY,
      createSeedMembers('museum-guest', 'guest')
    )
  );

  // Strictly isolated Authenticated Cloud state (ONLY used when user !== null)
  const [cloudMuseums, setCloudMuseums] = useState<MuseumMeta[]>([]);
  const [activeMuseumId, setActiveMuseumId] = useState<string>('');
  const [cloudArtworks, setCloudArtworks] = useState<ArtworkItem[]>([]);
  const [cloudMembers, setCloudMembers] = useState<MuseumMember[]>([]);
  const [liveVisitors, setLiveVisitors] = useState<VisitorPresence[]>([]);

  // Shared Modals & Drawers
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [renameRoomIndex, setRenameRoomIndex] = useState<number | null>(null);
  const [showInvitedIn3D, setShowInvitedIn3D] = useState(true);
  const [inspectState, setInspectState] = useState<{
    artwork: ArtworkItem | null;
    slotIndex: number;
  }>({ artwork: null, slotIndex: 0 });
  const [teleportTargetId, setTeleportTargetId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Direct email invitation link handling (/?invite=<museumId>&code=<code>&museum=...&host=...)
  const [pendingInvite, setPendingInvite] = useState<PendingMuseumInvite | null>(() =>
    parseMuseumInviteFromSearch(window.location.search)
  );
  const [inviteBannerState, setInviteBannerState] = useState<InviteBannerState>(() =>
    parseMuseumInviteFromSearch(window.location.search) ? 'needs-auth' : null
  );
  const [inviteBannerMessage, setInviteBannerMessage] = useState<string | null>(null);
  const inviteResolvedRef = useRef<string | null>(null);
  const manualMuseumChoiceRef = useRef(false);
  const lastKnownPosRef = useRef({ x: 0, z: 4.5, yaw: Math.PI });

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3600);
  }, []);

  // Persist avatar preference cleanly
  useEffect(() => {
    if (user) return;
    try {
      window.localStorage.setItem(STORAGE_AVATAR_KEY, JSON.stringify(avatar));
    } catch {
      // Ignore storage quota issues
    }
  }, [user, avatar]);

  // Persist Guest preview state ONLY when signed out (never write signed-in data here!)
  useEffect(() => {
    if (user || authLoading) return;
    try {
      window.localStorage.setItem(STORAGE_MUSEUM_KEY, JSON.stringify(guestMuseum));
      window.localStorage.setItem(STORAGE_ARTWORKS_KEY, JSON.stringify(guestArtworks));
      window.localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(guestMembers));
    } catch {
      showToast('Browser local storage is full. Sign in with Google to save images to Firebase Cloud.');
    }
  }, [user, authLoading, guestMuseum, guestArtworks, guestMembers, showToast]);

  // Firebase Auth listener with strict per-user state reset on every sign-in / sign-out transition
  useEffect(() => {
    let activeRun = 0;

    // Check if the user is returning from a redirect sign-in
    getRedirectResult(auth).catch((err: any) => {
      if (err?.code) {
        console.warn('Google redirect sign-in error:', err);
      }
    });

    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      const runId = ++activeRun;

      // Immediately purge any previous user's cloud state & custom 3D model before switching accounts
      setCloudMuseums([]);
      setCloudArtworks([]);
      setCloudMembers([]);
      setLiveVisitors([]);
      setActiveMuseumId('');
      setCloudReady(false);
      setCustomGlbBuffer(null);
      setCustomGlbName(null);
      setInspectState({ artwork: null, slotIndex: 0 });
      setRenameRoomIndex(null);
      manualMuseumChoiceRef.current = false;

      setUser(nextUser);
      setAuthLoading(false);

      if (nextUser) {
        try {
          const initialDraft = enforceAccountAvatarPolicy(avatarRef.current, nextUser.email);
          const loadedProfile = await loadOrCreateUserProfile(nextUser, initialDraft);
          if (runId !== activeRun) return;

          const enforcedProfile = enforceAccountAvatarPolicy(loadedProfile, nextUser.email);
          setAvatar(enforcedProfile);

          // Sync Abid's exclusive signature model to his Firestore profile & restore any saved GLB
          if (isExclusiveAbidAccount(nextUser.email)) {
            if (!isAbidSignatureAvatar(loadedProfile)) {
              void saveUserProfile(nextUser, enforcedProfile).catch(() => {});
            }
            const storedGlb = await loadCustomGlbForAccount(nextUser.email!);
            if (runId === activeRun && storedGlb) {
              setCustomGlbBuffer(storedGlb.buffer);
              setCustomGlbName(storedGlb.fileName);
            }
          }

          const personal = await ensurePersonalMuseum(nextUser, enforcedProfile.displayName);
          if (runId !== activeRun) return;

          setCloudMuseums((prev) =>
            prev.some((m) => m.id === personal.id) ? prev : [personal, ...prev]
          );
          setActiveMuseumId((prev) => prev || personal.id);
          setCloudReady(true);
        } catch (err) {
          console.error('Error initializing private cloud museum:', err);
          if (runId === activeRun) {
            showToast('Could not load your private cloud museum. Please check your connection and retry.');
          }
        }
      } else {
        setAvatar((prev) => enforceAccountAvatarPolicy(prev, null));
      }
    });
    return () => {
      activeRun++;
      unsub();
    };
  }, [showToast]);

  const activeMuseumIdRef = useRef(activeMuseumId);
  activeMuseumIdRef.current = activeMuseumId;

  // Subscribe ONLY to museums owned by or explicitly shared with this authenticated user
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeAccessibleMuseums(user, (list) => {
      setCloudMuseums((prev) => {
        // Keep any directly opened invited museum in the list alongside owned/member museums
        const byId = new Map<string, MuseumMeta>();
        for (const m of list) byId.set(m.id, m);
        const curActiveId = activeMuseumIdRef.current;
        for (const existing of prev) {
          if (existing.id === curActiveId && !byId.has(existing.id)) {
            byId.set(existing.id, existing);
          }
        }
        return Array.from(byId.values());
      });
      if (list.length > 0) {
        setCloudReady(true);
        setActiveMuseumId((prev) => {
          if (prev && inviteResolvedRef.current === `${user.uid}:${prev}`) return prev;
          if (manualMuseumChoiceRef.current && prev && list.some((m) => m.id === prev)) {
            return prev;
          }
          return pickPreferredInitialMuseumId(list, user.uid, user.email);
        });
      }
    });
    return () => unsub();
  }, [user]);

  // Automatically resolve incoming direct invitation link once the visitor signs in
  useEffect(() => {
    if (!pendingInvite) {
      setInviteBannerState(null);
      setInviteBannerMessage(null);
      return;
    }

    if (!user) {
      setInviteBannerState('needs-auth');
      setInviteBannerMessage(null);
      inviteResolvedRef.current = null;
      return;
    }

    if (inviteResolvedRef.current === `${user.uid}:${pendingInvite.museumId}`) {
      return;
    }

    let cancelled = false;
    setInviteBannerState('loading');
    setInviteBannerMessage(null);

    void (async () => {
      try {
        const invitedMuseum = await fetchInvitedMuseum(
          pendingInvite.museumId,
          pendingInvite.accessCode
        );
        if (cancelled) return;

        if (invitedMuseum) {
          inviteResolvedRef.current = `${user.uid}:${pendingInvite.museumId}`;
          manualMuseumChoiceRef.current = true;
          setCloudMuseums((prev) =>
            prev.some((m) => m.id === invitedMuseum.id)
              ? prev.map((m) => (m.id === invitedMuseum.id ? invitedMuseum : m))
              : [invitedMuseum, ...prev]
          );
          setActiveMuseumId(invitedMuseum.id);
          setCloudReady(true);
          setInviteBannerState('accepted');
          setPendingInvite((prev) =>
            prev
              ? {
                  ...prev,
                  museumTitle: invitedMuseum.title,
                  hostName: invitedMuseum.ownerName,
                  accessCode: invitedMuseum.accessCode,
                }
              : prev
          );
          // Clean invite query params cleanly without reloading
          if (window.location.search.includes('invite=')) {
            window.history.replaceState({}, '', window.location.pathname);
          }
          showToast(`Invitation accepted! "${invitedMuseum.title}" is now ready to explore.`);
        } else {
          setInviteBannerState('error');
          setInviteBannerMessage(
            `We could not unlock "${pendingInvite.museumTitle}" with ${user.email || 'this account'}. Make sure you sign in with the exact Google email address that received the invitation.`
          );
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Could not resolve private museum invitation:', err);
        setInviteBannerState('error');
        setInviteBannerMessage(
          `Access denied for ${user.email || 'this account'}. Please sign in with the exact Google email address invited by ${pendingInvite.hostName}.`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, pendingInvite, showToast]);

  // Strictly derive active museum, artworks, and members with ZERO cross-leakage
  const activeMuseum: MuseumMeta = useMemo(() => {
    if (user) {
      return (
        cloudMuseums.find((m) => m.id === activeMuseumId) ??
        cloudMuseums.find((m) => m.ownerId === user.uid) ??
        cloudMuseums[0] ??
        createEmptyAccountMuseumPlaceholder(user)
      );
    }
    return guestMuseum;
  }, [user, cloudMuseums, activeMuseumId, guestMuseum]);

  const accessibleMuseums = user ? cloudMuseums : [guestMuseum];
  const artworks = user ? cloudArtworks : guestArtworks;
  const members = user ? cloudMembers : guestMembers;

  const isOwner = user ? activeMuseum.ownerId === user.uid : true;
  const canCurate = useMemo(() => {
    if (!user) return true;
    if (!cloudReady) return false;
    if (activeMuseum.ownerId === user.uid) return true;
    const email = (user.email || '').toLowerCase();
    return Boolean(user.emailVerified && activeMuseum.curatorEmails.includes(email));
  }, [user, cloudReady, activeMuseum]);

  // Subscribe to active cloud museum artworks, members, and real-time visitor presence
  useEffect(() => {
    if (!user || !cloudReady || activeMuseum.accessCode === 'LOADING') {
      if (user) {
        setCloudArtworks([]);
        setCloudMembers([]);
        setLiveVisitors([]);
      }
      return;
    }
    // Clear previous museum's artworks immediately when switching museums
    setCloudArtworks([]);
    setCloudMembers([]);
    setLiveVisitors([]);

    const unsubArt = subscribeArtworks(activeMuseum, user, setCloudArtworks);
    const unsubMem = subscribeMembers(activeMuseum, user, setCloudMembers);
    const unsubPres = subscribePresence(activeMuseum, user, setLiveVisitors);
    return () => {
      unsubArt();
      unsubMem();
      unsubPres();
    };
  }, [user, cloudReady, activeMuseum.id, activeMuseum.ownerId, activeMuseum.isOpenByCode]);

  // Mark visitor as standing offline (preserving last position) when leaving the 3D museum view
  useEffect(() => {
    if (view !== 'museum' && user && cloudReady && activeMuseum.accessCode !== 'LOADING') {
      const pos = lastKnownPosRef.current;
      void markPresenceOffline(
        activeMuseum,
        user,
        enforceAccountAvatarPolicy(avatarRef.current, user.email),
        pos.x,
        pos.z,
        pos.yaw
      );
    }
  }, [view, user, cloudReady, activeMuseum]);

  const handleSignInGoogle = async () => {
    try {
      await signInWithGoogle();
      showToast('Signed in with Google. Loading your private museum database...');
    } catch (err: any) {
      console.warn('Google sign-in popup failed, checking error:', err);
      const code = err?.code as string | undefined;
      const message = err?.message as string | undefined;

      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        showToast('পপ-আপ উইন্ডো ব্লক থাকায় রিডাইরেক্ট করে সাইন-ইন শুরু হচ্ছে...');
        try {
          await signInWithGoogleRedirect();
        } catch (redirectErr: any) {
          console.error('Redirect sign-in error:', redirectErr);
          const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
          showToast(`ব্রাউজারের অ্যাড্রেস বার থেকে ${host}-এর জন্য Pop-ups allow করুন।`);
        }
        return;
      }

      if (code === 'auth/unauthorized-domain') {
        const curDomain = typeof window !== 'undefined' ? window.location.hostname : 'my-museum-box.vercel.app';
        showToast(
          `Firebase Unauthorized Domain! Firebase Console > Authentication > Settings > Authorized domains-এ "${curDomain}" ডোমেইনটি যোগ করুন।`
        );
        return;
      }

      if (code === 'auth/popup-closed-by-user') {
        showToast(
          'সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। গুগল "Access Blocked" দেখালে নিশ্চিত করুন আপনি টেস্ট ইউজার তালিকায় থাকা মেইল (abidsarker213@gmail.com বা suraia475@gmail.com) দিয়ে সাইন-ইন করছেন।'
        );
        return;
      }

      if (code === 'auth/network-request-failed') {
        showToast('ইন্টারনেট বা নেটওয়ার্ক সমস্যার কারণে সাইন-ইন করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
        return;
      }

      showToast(
        code
          ? `সাইন-ইন ব্যর্থ (${code}): ${message || 'দয়া করে পুনরায় চেষ্টা করুন।'}`
          : 'Sign-in was cancelled. You can continue customizing in Guest Studio Mode.'
      );
    }
  };

  const handleSignOut = async () => {
    if (user && cloudReady && activeMuseum.accessCode !== 'LOADING') {
      const pos = lastKnownPosRef.current;
      await markPresenceOffline(
        activeMuseum,
        user,
        enforceAccountAvatarPolicy(avatarRef.current, user.email),
        pos.x,
        pos.z,
        pos.yaw
      );
    }
    clearGmailAccessToken();
    inviteResolvedRef.current = null;
    // Reset local guest preview cleanly so no previous session state lingers after sign-out
    clearGuestStorage();
    setGuestMuseum(createSeedMuseum('guest', 'Julian Vance'));
    setGuestArtworks(createSeedArtworks('museum-guest', 'guest', 'Julian Vance'));
    setGuestMembers(createSeedMembers('museum-guest', 'guest'));
    setCustomGlbBuffer(null);
    setCustomGlbName(null);
    setAvatar(DEFAULT_AVATAR_BY_GENDER.man);
    setView('home');
    setCatalogOpen(false);
    setUploadOpen(false);
    setAccessOpen(false);
    setRenameRoomIndex(null);
    setInspectState({ artwork: null, slotIndex: 0 });
    await signOut(auth);
    showToast('Signed out. Your private cloud artworks are now hidden.');
  };

  const handleAvatarChange = (next: AvatarConfig) => {
    setAvatar(enforceAccountAvatarPolicy(next, user?.email));
  };

  const handleUploadCustomGlb = async (file: File) => {
    if (!user || !isExclusiveAbidAccount(user.email)) {
      throw new Error('Custom 3D model import is exclusive to your personal account.');
    }
    if (!file.name.toLowerCase().endsWith('.glb')) {
      throw new Error('Please choose a binary .glb 3D model file exported from Tripo Studio.');
    }
    if (file.size > 35 * 1024 * 1024) {
      throw new Error('3D model file must be 35 MB or smaller.');
    }
    const buffer = await file.arrayBuffer();
    // Verify binary glTF magic header ("glTF" = 0x46546C67)
    if (buffer.byteLength < 12) {
      throw new Error('This file is not a valid binary .glb 3D model.');
    }
    const magic = new DataView(buffer).getUint32(0, true);
    if (magic !== 0x46546c67) {
      throw new Error('Invalid .glb file header. Export binary GLB from Tripo Studio.');
    }

    await saveCustomGlbForAccount(user.email!, file.name, buffer);
    setCustomGlbBuffer(buffer);
    setCustomGlbName(file.name);
    showToast(`Loaded "${file.name}" as your exclusive 3D museum character.`);
  };

  const handleClearCustomGlb = async () => {
    if (user?.email) {
      await clearCustomGlbForAccount(user.email);
    }
    setCustomGlbBuffer(null);
    setCustomGlbName(null);
    showToast('Switched back to your articulated walking 3D signature model.');
  };

  const handleEnterMuseum = async () => {
    const safeAvatar = enforceAccountAvatarPolicy(avatar, user?.email);
    if (user) {
      try {
        await saveUserProfile(user, safeAvatar);
      } catch (err) {
        console.warn('Could not sync avatar profile before entering:', err);
      }
    }
    setView('museum');
  };

  const handleAddArtwork = async (payload: {
    title: string;
    artist: string;
    dateCaptured: string;
    notes: string;
    imageUrl: string;
    aspectRatio: AspectRatioType;
    frameStyle: FrameStyle;
  }) => {
    const prevCount = artworks.length;
    const prevRooms = calculateMuseumLayout(prevCount).roomCount;
    const nextRooms = calculateMuseumLayout(prevCount + 1).roomCount;

    if (user) {
      if (!cloudReady || activeMuseum.accessCode === 'LOADING') {
        throw new Error('Your private cloud museum is still initializing. Please try again in a moment.');
      }
      await addArtworkToMuseum(activeMuseum, user, avatar.displayName, payload);
    } else {
      const newWork: ArtworkItem = {
        id: `guest-art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        museumId: guestMuseum.id,
        ownerId: guestMuseum.ownerId,
        uploadedBy: guestMuseum.ownerId,
        uploadedByName: avatar.displayName || 'Curator',
        title: payload.title,
        artist: payload.artist,
        dateCaptured: payload.dateCaptured,
        notes: payload.notes,
        imageUrl: payload.imageUrl,
        aspectRatio: payload.aspectRatio,
        frameStyle: payload.frameStyle,
        isOpenByCode: guestMuseum.isOpenByCode,
        viewerEmails: guestMuseum.memberEmails,
      };
      setGuestArtworks((prev) => [...prev, newWork]);
      setGuestMuseum((m) => ({ ...m, artworkCount: prevCount + 1 }));
    }

    if (nextRooms > prevRooms) {
      const createdRoom = calculateMuseumLayout(prevCount + 1).rooms[nextRooms - 1];
      showToast(
        createdRoom?.isCrossHall
          ? `Artwork hung! Grand Cross Hall ${toRomanNumeral(nextRooms)} (18 walls · X-Wing Pavilion) created — walk to the North door and press [F] to open it.`
          : `Artwork hung! Room ${toRomanNumeral(nextRooms)} (8 walls) created automatically — walk to the North door and press [F] to open it.`
      );
    } else {
      showToast(`"${payload.title}" hung on Room ${toRomanNumeral(nextRooms)} wall.`);
    }
  };

  const handleDeleteArtwork = async (artworkId: string) => {
    if (user) {
      if (!cloudReady) return;
      await deleteArtworkFromMuseum(activeMuseum, user, artworkId);
    } else {
      setGuestArtworks((prev) => prev.filter((a) => a.id !== artworkId));
      setGuestMuseum((m) => ({ ...m, artworkCount: Math.max(0, m.artworkCount - 1) }));
    }
    showToast('Artwork removed from the gallery wall.');
  };

  const handleRenameRoom = async (roomIndex: number, nextName: string) => {
    const updatedNames: Record<string, string> = {
      ...(activeMuseum.roomNames ?? {}),
      [String(roomIndex)]: nextName.trim().slice(0, 60),
    };

    if (user) {
      if (!cloudReady || !isOwner) {
        throw new Error('Only the museum owner can rename room signboards.');
      }
      await updateMuseumRoomNames(activeMuseum, updatedNames);
    } else {
      setGuestMuseum((m) => ({ ...m, roomNames: updatedNames }));
    }
    showToast(`Room ${toRomanNumeral(roomIndex + 1)} signboard updated to "${nextName.trim()}".`);
  };

  const handleGrantAccess = async (input: {
    email: string;
    displayName: string;
    role: MemberRole;
    gender: Gender;
  }) => {
    if (user) {
      if (!cloudReady) {
        throw new Error('Museum is still loading. Please try again.');
      }
      await grantMuseumAccess(activeMuseum, input);
    } else {
      const nextMember: MuseumMember = {
        id: `guest-mem-${Date.now()}`,
        museumId: guestMuseum.id,
        ownerId: guestMuseum.ownerId,
        email: input.email,
        displayName: input.displayName,
        role: input.role,
        gender: input.gender,
      };
      setGuestMembers((prev) => [...prev, nextMember]);
      setGuestMuseum((m) => ({
        ...m,
        memberEmails: Array.from(new Set([...m.memberEmails, input.email])).slice(0, 10),
        curatorEmails:
          input.role === 'curator'
            ? Array.from(new Set([...m.curatorEmails, input.email])).slice(0, 10)
            : m.curatorEmails,
      }));
    }
    showToast(
      `Access granted to ${input.displayName} (${input.gender === 'woman' ? 'Woman' : 'Man'} avatar).`
    );
  };

  const handleSendInviteEmail = async (draft: InviteEmailDraft) => {
    if (!user) {
      throw new Error('Sign in with Google first to send real invitation emails via Gmail.');
    }
    if (!cloudReady || activeMuseum.accessCode === 'LOADING') {
      throw new Error('Your private museum is still loading. Please try again in a moment.');
    }

    // 1. Ensure the visitor is granted access in Firestore first so the email link unlocks immediately
    if (!draft.alreadyMember) {
      await grantMuseumAccess(activeMuseum, {
        email: draft.email,
        displayName: draft.displayName,
        role: draft.role,
        gender: draft.gender,
      });
    }

    // 2. Build direct museum entry URL and email payload
    const inviteUrl = buildMuseumInviteUrl(window.location.origin, {
      museumId: activeMuseum.id,
      accessCode: activeMuseum.accessCode,
      museumTitle: activeMuseum.title,
      hostName: activeMuseum.ownerName || user.displayName || 'Museum Curator',
    });

    const emailInput = {
      recipientEmail: draft.email,
      recipientName: draft.displayName,
      hostName: activeMuseum.ownerName || user.displayName || 'Museum Curator',
      hostEmail: user.email || undefined,
      museumTitle: activeMuseum.title,
      museumId: activeMuseum.id,
      accessCode: activeMuseum.accessCode,
      role: draft.role,
      gender: draft.gender,
      inviteUrl,
      personalNote: draft.personalNote,
    };

    // 3. Send via Gmail API with automatic 401 token refresh retry
    let token = await requestGmailSendToken();
    try {
      await sendMuseumInvitationEmail(token, emailInput);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        clearGmailAccessToken();
        token = await requestGmailSendToken();
        await sendMuseumInvitationEmail(token, emailInput);
      } else {
        throw err;
      }
    }

    showToast(
      `Invitation email sent to ${draft.email} with direct entry link to "${activeMuseum.title}".`
    );
  };

  const handleRevokeAccess = async (member: MuseumMember) => {
    if (user) {
      if (!cloudReady) return;
      await revokeMuseumAccess(activeMuseum, member);
    } else {
      setGuestMembers((prev) => prev.filter((m) => m.id !== member.id));
      setGuestMuseum((m) => ({
        ...m,
        memberEmails: m.memberEmails.filter((e) => e !== member.email),
        curatorEmails: m.curatorEmails.filter((e) => e !== member.email),
      }));
    }
    showToast(`Access revoked for ${member.displayName}.`);
  };

  const handleToggleOpenByCode = async (isOpen: boolean) => {
    if (user) {
      if (!cloudReady || !isOwner) return;
      await updateMuseumSettings(activeMuseum, { isOpenByCode: isOpen });
    } else {
      setGuestMuseum((m) => ({ ...m, isOpenByCode: isOpen }));
    }
  };

  const handleChangeWallTheme = async (wallTheme: WallTheme) => {
    if (user) {
      if (!cloudReady || !isOwner) return;
      await updateMuseumSettings(activeMuseum, { wallTheme });
    } else {
      setGuestMuseum((m) => ({ ...m, wallTheme }));
    }
  };

  const handleJoinByCode = async (code: string): Promise<string | null> => {
    if (!user) {
      if (code === guestMuseum.accessCode) {
        setView('museum');
        return null;
      }
      return 'Sign in with Google to join another user’s cloud museum by access code.';
    }
    const found = await findMuseumByAccessCode(code);
    if (!found) {
      return 'No museum found with that access code, or entry is private.';
    }
    setCloudMuseums((prev) => (prev.some((m) => m.id === found.id) ? prev : [...prev, found]));
    setActiveMuseumId(found.id);
    setView('museum');
    showToast(`Entered "${found.title}" as ${avatar.displayName}.`);
    return null;
  };

  const handlePositionBroadcast = useCallback(
    (
      x: number,
      z: number,
      yaw: number,
      ridingRideId: string | null = null,
      ridingVehicleId: string | null = null
    ) => {
      lastKnownPosRef.current = { x, z, yaw };
      if (!user || !cloudReady || activeMuseum.accessCode === 'LOADING') return;
      void upsertPresence(
        activeMuseum,
        user,
        enforceAccountAvatarPolicy(avatar, user.email),
        x,
        z,
        yaw,
        true,
        ridingRideId,
        ridingVehicleId
      );
    },
    [user, cloudReady, activeMuseum, avatar]
  );

  const handlePresenceOffline = useCallback(
    (x: number, z: number, yaw: number) => {
      lastKnownPosRef.current = { x, z, yaw };
      if (!user || !cloudReady || activeMuseum.accessCode === 'LOADING') return;
      void markPresenceOffline(
        activeMuseum,
        user,
        enforceAccountAvatarPolicy(avatar, user.email),
        x,
        z,
        yaw
      );
    },
    [user, cloudReady, activeMuseum, avatar]
  );

  const isAnyModalOpen =
    catalogOpen ||
    uploadOpen ||
    accessOpen ||
    renameRoomIndex !== null ||
    Boolean(inspectState.artwork);

  const safeAvatar = useMemo(
    () => enforceAccountAvatarPolicy(avatar, user?.email),
    [avatar, user?.email]
  );

  return (
    <div data-view={view}>
      {view === 'home' ? (
        <HomeStudio
          user={user}
          authLoading={authLoading || (Boolean(user) && !cloudReady)}
          avatar={safeAvatar}
          isExclusiveAbid={isExclusiveAbid}
          customGlbBuffer={isExclusiveAbid ? customGlbBuffer : null}
          customGlbName={isExclusiveAbid ? customGlbName : null}
          museum={activeMuseum}
          artworks={artworks}
          members={members}
          accessibleMuseums={accessibleMuseums}
          pendingInvite={pendingInvite}
          inviteBannerState={inviteBannerState}
          inviteBannerMessage={inviteBannerMessage}
          onDismissInvite={() => {
            setPendingInvite(null);
            setInviteBannerState(null);
            setInviteBannerMessage(null);
            if (window.location.search.includes('invite=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }}
          onSignInGoogle={handleSignInGoogle}
          onSignOut={handleSignOut}
          onChangeAvatar={handleAvatarChange}
          onUploadCustomGlb={handleUploadCustomGlb}
          onClearCustomGlb={handleClearCustomGlb}
          onEnterMuseum={handleEnterMuseum}
          onOpenCatalog={() => setCatalogOpen(true)}
          onOpenUpload={() => setUploadOpen(true)}
          onOpenAccess={() => setAccessOpen(true)}
          onSwitchMuseum={(id) => {
            manualMuseumChoiceRef.current = true;
            setActiveMuseumId(id);
            showToast('Switched active museum.');
          }}
          onInspectArtwork={(artwork, slotIndex) =>
            setInspectState({ artwork, slotIndex })
          }
        />
      ) : (
        <Museum3DView
          museum={activeMuseum}
          avatar={safeAvatar}
          selfUid={user?.uid ?? null}
          selfEmail={user?.email ?? null}
          customGlbBuffer={isExclusiveAbid ? customGlbBuffer : null}
          artworks={artworks}
          members={members}
          liveVisitors={liveVisitors}
          showInvitedIn3D={showInvitedIn3D}
          canCurate={canCurate}
          canRenameRooms={isOwner}
          teleportTargetId={teleportTargetId}
          onClearTeleport={() => setTeleportTargetId(null)}
          onSelectArtwork={(artwork, slotIndex) =>
            setInspectState({ artwork, slotIndex })
          }
          onRequestRenameRoom={(idx) => setRenameRoomIndex(idx)}
          onNotify={showToast}
          onOpenCatalog={() => setCatalogOpen(true)}
          onOpenUpload={() => setUploadOpen(true)}
          onOpenAccess={() => setAccessOpen(true)}
          onReturnHome={() => setView('home')}
          onChangeWallTheme={handleChangeWallTheme}
          onPositionBroadcast={handlePositionBroadcast}
          onPresenceOffline={handlePresenceOffline}
          isPaused={isAnyModalOpen}
        />
      )}

      {/* Date-Sorted Complete Archival Catalog Drawer */}
      <CatalogDrawer
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        artworks={artworks}
        roomNames={activeMuseum.roomNames}
        canCurate={canCurate}
        onWalkToArtwork={
          view === 'museum'
            ? (id) => setTeleportTargetId(id)
            : (id) => {
                setView('museum');
                setTeleportTargetId(id);
              }
        }
        onInspectArtwork={(artwork, slotIndex) =>
          setInspectState({ artwork, slotIndex })
        }
        onDeleteArtwork={handleDeleteArtwork}
        onOpenUpload={() => {
          setCatalogOpen(false);
          setUploadOpen(true);
        }}
      />

      {/* Upload / Hang New Artwork Modal */}
      <UploadArtworkModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        currentArtworkCount={artworks.length}
        defaultArtist={avatar.displayName}
        isCloudSynced={Boolean(user && cloudReady)}
        onSubmitArtwork={handleAddArtwork}
      />

      {/* Shared Museum Access & Multi-Visitor Modal */}
      <AccessModal
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        museum={activeMuseum}
        isOwner={isOwner}
        isSignedIn={Boolean(user)}
        inviteBaseUrl={window.location.origin}
        members={members}
        accessibleMuseums={accessibleMuseums}
        showInvitedIn3D={showInvitedIn3D}
        onToggleShowInvitedIn3D={setShowInvitedIn3D}
        onSignInGoogle={handleSignInGoogle}
        onGrantAccess={handleGrantAccess}
        onSendInviteEmail={handleSendInviteEmail}
        onRevokeAccess={handleRevokeAccess}
        onToggleOpenByCode={handleToggleOpenByCode}
        onJoinByCode={handleJoinByCode}
        onSwitchMuseum={(id) => {
          manualMuseumChoiceRef.current = true;
          setActiveMuseumId(id);
          setView('museum');
        }}
      />

      {/* Artwork Inspection Modal */}
      <ArtworkInspectModal
        artwork={inspectState.artwork}
        slotIndex={inspectState.slotIndex}
        roomNames={activeMuseum.roomNames}
        canDelete={canCurate}
        onClose={() => setInspectState({ artwork: null, slotIndex: 0 })}
        onWalkTo={(id) => {
          setView('museum');
          setTeleportTargetId(id);
        }}
        onDelete={handleDeleteArtwork}
      />

      {/* Clickable Door Signboard Room Rename Modal */}
      <RenameRoomModal
        roomIndex={renameRoomIndex}
        currentName={
          renameRoomIndex !== null
            ? getResolvedRoomName(renameRoomIndex, activeMuseum.roomNames)
            : ''
        }
        canEdit={isOwner}
        onClose={() => setRenameRoomIndex(null)}
        onSaveName={handleRenameRoom}
      />

      {/* Quiet Toast Feedback */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-50 bg-[#1C1917] text-[#F7F5F0] border border-[#C99A5B]/60 px-4 py-2.5 text-xs shadow-lg max-w-sm"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MyMuseumApp />
    </ErrorBoundary>
  );
}
