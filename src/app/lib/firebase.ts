import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
};

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim() || 'us-west1';
const appCheckSiteKey =
  import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim() || '';
let emulatorsConnected = false;
let persistenceConfigured: Promise<void> | null = null;
let appCheckInitialized = false;

export function firebaseIsConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.appId &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId,
  );
}

export function firebaseAppCheckIsConfigured() {
  return Boolean(appCheckSiteKey);
}

export function getFirebaseServices() {
  if (!firebaseIsConfigured()) {
    throw new Error(
      'Firebase is not configured. Add the public VITE_FIREBASE_* settings to Render.',
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  if (
    appCheckSiteKey &&
    import.meta.env.VITE_FIREBASE_USE_EMULATORS !== 'true' &&
    !appCheckInitialized
  ) {
    initializeAppCheck(app, {
      isTokenAutoRefreshEnabled: true,
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    });
    appCheckInitialized = true;
  }
  const auth = getAuth(app);
  const functions = getFunctions(app, region);

  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true' &&
    !emulatorsConnected
  ) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    emulatorsConnected = true;
  }

  persistenceConfigured ??= setPersistence(auth, browserSessionPersistence);
  return { auth, functions, persistenceReady: persistenceConfigured };
}

export async function callFirebaseFunction<
  Request = Record<string, never>,
  Response = unknown,
>(
  name: string,
  data?: Request,
  options?: { limitedUseAppCheckTokens?: boolean; timeout?: number },
) {
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<Request, Response>(functions, name, options);
  const result = await callable(data as Request);
  return result.data;
}

export function firebaseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FirebaseError) {
    const message = error.message
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\([^)]*\/[^)]*\)\.?$/, '');
    return message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
