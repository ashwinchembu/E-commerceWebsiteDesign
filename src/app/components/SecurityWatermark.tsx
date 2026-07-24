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
  const mobileName = compactName.split(/[—–-]/)[0].trim().split(/\s+/)[0] || compactName;
  const compactAccessId = accessId.trim().slice(-6).toUpperCase();
  const mobileIdentity = [
    mobileName,
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
        <div className="absolute left-1/2 top-1/2 flex h-[135vh] w-[150vw] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] flex-col justify-around opacity-[0.025] sm:hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className="whitespace-nowrap text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-white"
              style={{ transform: `translateX(${index % 2 === 0 ? '-9vw' : '9vw'})` }}
            >
              PRIVATE · {mobileIdentity}
            </span>
          ))}
        </div>

        <div className="absolute left-1/2 top-1/2 hidden w-[170vw] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] grid-cols-3 gap-x-16 gap-y-28 opacity-[0.07] mix-blend-difference sm:grid">
          {Array.from({ length: 20 }, (_, index) => (
            <span key={index} className="whitespace-nowrap text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
              PRIVATE · {identity}
            </span>
          ))}
        </div>
      </div>

      <aside className="fixed right-3 top-[calc(5.5rem+env(safe-area-inset-top))] z-[9999] w-fit max-w-[calc(100vw-1.5rem)] border border-white/20 bg-black/90 px-3 py-2 text-[9px] uppercase tracking-[0.1em] text-white shadow-2xl backdrop-blur sm:bottom-4 sm:right-4 sm:top-auto sm:max-w-[min(22rem,calc(100vw-2rem))] sm:text-[10px] sm:tracking-[0.14em]">
        <div className="flex items-center gap-3">
          <span className="min-w-0 truncate" title={identity}>
            Private · <span className="sm:hidden">{mobileName}</span><span className="hidden sm:inline">{name}</span>
          </span>
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
