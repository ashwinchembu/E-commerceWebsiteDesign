interface SecurityWatermarkProps {
  name: string;
  email: string;
  accessId: string;
}

export function SecurityWatermark({ name, email, accessId }: SecurityWatermarkProps) {
  const identity = [name, email, accessId ? `ID ${accessId}` : ''].filter(Boolean).join(' · ');

  return (
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
  );
}
