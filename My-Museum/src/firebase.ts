import { initializeApp } from 'firebase/app';
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
] as const;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Basic Google Sign-In provider (NO sensitive Workspace scopes — allows clean sign-in for all visitors)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function createGmailSendProvider(loginHint?: string | null): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  const params: Record<string, string> = { prompt: 'consent' };
  if (loginHint) {
    params.login_hint = loginHint;
  }
  provider.setCustomParameters(params);
  return provider;
}

// Strict in-memory cache for Google Workspace Gmail access token (never stored in localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;
let cachedGmailTokenUid: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user || (cachedGmailTokenUid && cachedGmailTokenUid !== user.uid)) {
    cachedGmailAccessToken = null;
    cachedGmailTokenUid = null;
  }
});

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function clearGmailAccessToken(): void {
  cachedGmailAccessToken = null;
  cachedGmailTokenUid = null;
}

/**
 * Standard Google Sign-In (basic email + profile only).
 * Does NOT request Gmail permissions so invited guests can sign in without Workspace consent warnings.
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (cachedGmailTokenUid && cachedGmailTokenUid !== result.user.uid) {
    clearGmailAccessToken();
  }
  return result.user;
}

export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

/**
 * On-demand Gmail send permission flow.
 * Called ONLY when a museum owner explicitly confirms sending an invitation email via Gmail.
 */
export async function requestGmailSendToken(): Promise<string> {
  if (cachedGmailAccessToken && cachedGmailTokenUid === auth.currentUser?.uid) {
    return cachedGmailAccessToken;
  }

  const currentUser = auth.currentUser;
  const gmailProvider = createGmailSendProvider(currentUser?.email);
  const result = currentUser
    ? await reauthenticateWithPopup(currentUser, gmailProvider)
    : await signInWithPopup(auth, gmailProvider);

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken ?? null;
  if (!accessToken) {
    throw new Error(
      'Gmail sending permission was not granted. You can allow Gmail access to send emails, or use "Grant Without Email" and share your direct invite link.'
    );
  }

  cachedGmailAccessToken = accessToken;
  cachedGmailTokenUid = result.user.uid;
  return accessToken;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
