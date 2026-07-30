import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import {
  callFirebaseFunction,
  firebaseErrorMessage,
  getFirebaseServices,
} from '../lib/firebase';

type RedeemResponse = {
  token: string;
  access: {
    id: string;
    name: string;
    email: string;
    role: string;
    expiresAt: number;
  };
};

function safeNextPath() {
  const requested = new URLSearchParams(window.location.search).get('next') || '/';
  if (!requested.startsWith('/') || requested.startsWith('//') || requested.includes('\\')) {
    return '/';
  }
  try {
    const target = new URL(requested, window.location.origin);
    return target.origin === window.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : '/';
  } catch {
    return '/';
  }
}

function disclosedClientContext() {
  const screenDetails = window.screen
    ? `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio || 1}x`
    : '';
  return {
    deviceMemoryGb:
      'deviceMemory' in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : null,
    language: navigator.language || '',
    languages: Array.from(navigator.languages || []).slice(0, 8),
    logicalProcessors: navigator.hardwareConcurrency || null,
    platform: navigator.platform || '',
    referrer: document.referrer || '',
    screen: screenDetails,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    touchPoints: navigator.maxTouchPoints || 0,
  };
}

async function warmJacketAssets() {
  const assets = [
    '/models/varsitybase/VarsityBase.glb',
    '/draco/draco_wasm_wrapper.js',
    '/draco/draco_decoder.wasm',
  ];
  const results = await Promise.allSettled(
    assets.map(async (asset) => {
      const response = await fetch(asset, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Could not prepare ${asset}`);
      await response.arrayBuffer();
    }),
  );
  return results.every((result) => result.status === 'fulfilled');
}

export function PrivateAccessPage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices();
      return onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        try {
          await callFirebaseFunction('getAccessSession', {});
          window.location.assign(safeNextPath());
        } catch {
          // The existing Firebase session does not represent active private access.
        }
      });
    } catch (error) {
      setStatus(firebaseErrorMessage(error, 'Firebase is not configured.'));
      return undefined;
    }
  }, []);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus('Verifying your personal code…');
    try {
      const result = await callFirebaseFunction<
        { code: string; path: string; client: ReturnType<typeof disclosedClientContext> },
        RedeemResponse
      >('redeemAccessCode', {
        client: disclosedClientContext(),
        code,
        path: safeNextPath(),
      });
      const { auth, persistenceReady } = getFirebaseServices();
      await persistenceReady;
      await signInWithCustomToken(auth, result.token);
      setStatus('Access confirmed. Preparing your jacket preview…');
      await warmJacketAssets();
      window.location.assign(safeNextPath());
    } catch (error) {
      setStatus(firebaseErrorMessage(error, 'Access could not be verified.'));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-5 py-16 text-white">
      <main className="w-full max-w-xl border border-white/20 bg-white/[0.035] p-7 sm:p-10">
        <p className="text-xs tracking-[0.28em] text-white/50">MANOIR KITS</p>
        <h1 className="mt-4 text-3xl font-light sm:text-4xl">Private preview</h1>
        <p className="mt-5 text-sm leading-6 text-white/60">
          Enter the personal access code issued to you. Attempts and approximate network
          information are retained for security.
        </p>
        <form className="mt-8 grid gap-4" onSubmit={redeem}>
          <label className="text-xs tracking-[0.16em] text-white/70">
            PERSONAL ACCESS CODE
            <input
              autoCapitalize="characters"
              autoComplete="one-time-code"
              className="mt-2 w-full border border-white/25 bg-black px-4 py-4 font-mono text-base uppercase tracking-wider outline-none focus:border-white/70"
              onChange={(event) => setCode(event.target.value)}
              placeholder="MK-XXXXXXXX-XXXX-XXXX-XXXX-XXXX"
              required
              spellCheck={false}
              value={code}
            />
          </label>
          <button
            className="border border-white bg-white px-4 py-4 text-xs tracking-[0.2em] text-black transition hover:bg-transparent hover:text-white disabled:opacity-40"
            disabled={busy}
            type="submit"
          >
            VERIFY ACCESS
          </button>
        </form>
        {status && (
          <p className="mt-5 text-sm leading-6 text-white/70" role="status">
            {status}
          </p>
        )}
      </main>
    </div>
  );
}
