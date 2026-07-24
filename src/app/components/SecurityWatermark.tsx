import { useState } from 'react';

interface SecurityWatermarkProps {
  name: string;
  email: string;
  accessId: string;
  onLogout: () => Promise<void>;
}

export function SecurityWatermark({ name, email, accessId, onLogout }: SecurityWatermarkProps) {
  const identity = [name, email, accessId ? `ID ${accessId}` : ''].filter(Boolean).join(' · ');
  const compactName = name.trim() || email.split('@')[0] || 'Authorized visitor';
  const compactAccessId = accessId.trim().slice(-6).toUpperCase();
  const mobileIdentity = [
    compactName,
    compactAccessId ? `ID ${compactAccessId}` : '',
  ].filter(Boolean).join(' · ');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError('');
    try {
      await onLogout();
    } catch {
      setLogoutError('Could not exit. Try again.');
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden select-none"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 grid w-[215vw] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] grid-cols-2 gap-x-6 gap-y-24 opacity-[0.045] mix-blend-difference sm:w-[170vw] sm:-rotate-[24deg] sm:grid-cols-3 sm:gap-x-16 sm:gap-y-28 sm:opacity-[0.07]">
          {Array.from({ length: 20 }, (_, index) => (
            <span key={index} className="whitespace-nowrap text-center text-[8px] font-semibold uppercase tracking-[0.1em] text-white sm:text-[11px] sm:tracking-[0.18em]">
              <span className="sm:hidden">PRIVATE · {mobileIdentity}</span>
              <span className="hidden sm:inline">PRIVATE · {identity}</span>
            </span>
          ))}
        </div>
      </div>

      <aside className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[9999] border border-white/20 bg-black/90 px-3 py-2 text-[9px] uppercase tracking-[0.1em] text-white shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-[min(22rem,calc(100vw-2rem))] sm:text-[10px] sm:tracking-[0.14em]">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate" title={identity}>Private · {name}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="shrink-0 border border-white/35 px-2 py-1 transition-colors hover:bg-white hover:text-black disabled:cursor-wait disabled:opacity-60"
          >
            {isLoggingOut ? 'Exiting…' : 'Exit'}
          </button>
        </div>
        {logoutError && <p className="mt-1 normal-case tracking-normal text-red-300" role="alert">{logoutError}</p>}
      </aside>
    </>
  );
}
