import { useState } from 'react';

interface SecurityWatermarkProps {
  name: string;
  email: string;
  accessId: string;
  onLogout: () => Promise<void>;
}

export function SecurityWatermark({ name, email, accessId, onLogout }: SecurityWatermarkProps) {
  const identity = [name, email, accessId ? `ID ${accessId}` : ''].filter(Boolean).join(' · ');
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
        <div className="absolute left-1/2 top-1/2 grid w-[160vw] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] grid-cols-3 gap-x-20 gap-y-28 opacity-[0.08] mix-blend-difference">
          {Array.from({ length: 24 }, (_, index) => (
            <span key={index} className="whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              PRIVATE · {identity}
            </span>
          ))}
        </div>
      </div>

      <aside className="fixed bottom-4 right-4 z-[9999] max-w-[min(22rem,calc(100vw-2rem))] border border-white/20 bg-black/90 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white shadow-2xl backdrop-blur">
        <div className="flex items-center gap-3">
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
