import { useEffect, useRef, useState } from 'react';
import type { ShopifyCustomerAccountState } from '../hooks/useShopifyCustomerAccount';
import { shopifyAccountUrl } from '../lib/shopify';

interface AccountPageProps {
  accountState: ShopifyCustomerAccountState;
  configured: boolean;
  onRefresh: () => Promise<void>;
  onSignIn: (returnTo?: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccountPage({
  accountState,
  configured,
  onRefresh,
  onSignIn,
  onSignOut,
}: AccountPageProps) {
  const accountUrl = shopifyAccountUrl();
  const [actionError, setActionError] = useState<string | null>(null);
  const autoSignInStarted = useRef(false);

  useEffect(() => {
    if (configured && accountState.status === 'signed-out' && !autoSignInStarted.current) {
      autoSignInStarted.current = true;
      void onSignIn('/account').catch((error) => {
        setActionError(error instanceof Error ? error.message : 'Shopify sign-in could not start.');
      });
    }
  }, [accountState.status, configured, onSignIn]);

  const error = actionError || accountState.error;

  if (
    accountState.status === 'checking' ||
    (configured && accountState.status === 'signed-out' && !actionError)
  ) {
    return (
      <div className="min-h-screen bg-black px-6 py-24 text-center text-white">
        <p className="text-sm tracking-widest">VERIFYING YOUR SHOPIFY ACCOUNT…</p>
      </div>
    );
  }

  if (accountState.status === 'signed-in') {
    return (
      <div className="min-h-screen bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-xl border border-white/20 p-8">
          <p className="text-xs tracking-[0.24em] text-white/60">SHOPIFY CUSTOMER ACCOUNT</p>
          <h1 className="mt-4 text-3xl font-light">{accountState.customer.displayName}</h1>
          <p className="mt-5 text-sm leading-relaxed text-white/70">
            {accountState.customer.hasFootballerAccess
              ? 'Footballers access is active for this account.'
              : 'This account is signed in. Footballers access has not been added yet.'}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a
              className="border border-white px-4 py-3 text-center text-xs tracking-widest transition-colors hover:bg-white hover:text-black"
              href={accountUrl}
            >
              ORDERS & PROFILE
            </a>
            <button
              className="border border-white/40 px-4 py-3 text-xs tracking-widest transition-colors hover:border-white"
              onClick={() => void onRefresh()}
              type="button"
            >
              REFRESH ACCESS
            </button>
            <button
              className="sm:col-span-2 px-4 py-3 text-xs tracking-widest text-white/60 transition-colors hover:text-white"
              onClick={() => void onSignOut()}
              type="button"
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-6 py-24 text-center text-white">
      <div className="mx-auto max-w-xl border border-white/20 p-8">
        <p className="text-sm tracking-widest">SHOPIFY ACCOUNT ACCESS</p>
        <p className="mt-5 text-sm leading-relaxed text-white/70">
          {error || 'Sign in with your Shopify customer account to check Footballers access.'}
        </p>
        <div className="mt-8 grid gap-3">
          {configured && (
            <button
              className="bg-white px-4 py-3 text-xs tracking-widest text-black transition-opacity hover:opacity-80"
              onClick={() => {
                setActionError(null);
                void onSignIn('/account').catch((signInError) => {
                  setActionError(
                    signInError instanceof Error ? signInError.message : 'Shopify sign-in could not start.',
                  );
                });
              }}
              type="button"
            >
              SIGN IN WITH SHOPIFY
            </button>
          )}
          <a className="px-4 py-3 text-xs tracking-widest text-white/70 underline" href={accountUrl}>
            OPEN SHOPIFY ACCOUNT
          </a>
        </div>
      </div>
    </div>
  );
}
