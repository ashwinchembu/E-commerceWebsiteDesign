import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  callFirebaseFunction,
  firebaseErrorMessage,
  getFirebaseServices,
} from '../lib/firebase';

type StudioSession = {
  studio: {
    email: string;
    name: string;
  };
};

async function verifyStudioAccount() {
  return callFirebaseFunction<Record<string, never>, StudioSession>(
    'getStudioSession',
    {},
  );
}

export function StudioAccessPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    document.title = 'Private Studio Sign In | Manoir Kits';
    try {
      const { auth } = getFirebaseServices();
      return onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
          await verifyStudioAccount();
          window.location.assign('/studio');
        } catch (error) {
          await signOut(auth).catch(() => undefined);
          setStatus(
            firebaseErrorMessage(
              error,
              'This Google account does not have Private Studio access.',
            ),
          );
          setBusy(false);
        }
      });
    } catch (error) {
      setStatus(firebaseErrorMessage(error, 'Firebase is not configured.'));
      return undefined;
    }
  }, []);

  async function googleSignIn() {
    setBusy(true);
    setStatus('Opening Google sign in…');
    try {
      const { auth, persistenceReady } = getFirebaseServices();
      await persistenceReady;
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      setStatus(firebaseErrorMessage(error, 'Google sign in failed.'));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-5 py-16 text-white">
      <main className="w-full max-w-xl border border-white/20 bg-white/[0.035] p-7 sm:p-10">
        <p className="text-xs tracking-[0.28em] text-white/50">MANOIR KITS</p>
        <h1 className="mt-4 text-3xl font-light sm:text-4xl">
          Private Studio sign in
        </h1>
        <p className="mt-5 text-sm leading-6 text-white/60">
          Continue with the Google account approved for the Manoir Kits Private Studio.
        </p>
        <button
          className="mt-8 w-full border border-white bg-white px-4 py-4 text-xs tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white disabled:opacity-40"
          disabled={busy}
          onClick={() => void googleSignIn()}
          type="button"
        >
          CONTINUE WITH GOOGLE
        </button>
        {status && (
          <p className="mt-5 text-sm leading-6 text-white/70" role="status">
            {status}
          </p>
        )}
      </main>
    </div>
  );
}
