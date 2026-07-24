import { useEffect } from 'react';
import { shopifyAccountUrl } from '../lib/shopify';

export function AccountPage() {
  const accountUrl = shopifyAccountUrl();

  useEffect(() => {
    window.location.replace(accountUrl);
  }, [accountUrl]);

  return (
    <div className="min-h-screen bg-black px-6 py-24 text-center text-white">
      <p className="text-sm tracking-widest">OPENING YOUR SECURE SHOPIFY ACCOUNT…</p>
      <a className="mt-6 inline-block underline" href={accountUrl}>
        CONTINUE
      </a>
    </div>
  );
}
