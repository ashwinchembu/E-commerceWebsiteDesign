import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';

const HERO_VIDEO = '/videos/landing-hero.mp4?v=4';
const HERO_VIDEO_DESKTOP = '/videos/landing-hero-desktop.mp4?v=5';

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !muted;
    setMuted(!muted);
    if (video.paused) await video.play();
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    const timer = window.setTimeout(() => {
      const hero = heroRef.current;
      if (!hero || cancelled) return;
      const start = window.scrollY;
      const destination = Math.max(0, hero.offsetTop + hero.offsetHeight / 2 - window.innerHeight / 2);
      const distance = destination - start;
      const duration = 3200;
      const startedAt = performance.now();

      const animate = (now: number) => {
        if (cancelled) return;
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
        window.scrollTo(0, start + distance * eased);
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, 700);

    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', cancel);
    return () => {
      window.clearTimeout(timer);
      cancel();
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, []);

  return (
    <section ref={heroRef} className="relative aspect-[9/16] w-full overflow-hidden bg-black">
      <div className="absolute inset-0 bg-black" aria-hidden="true">
        {/* The hero matches the source's 9:16 ratio, so every frame is visible
            at full width without cropping, distortion, or side bars. */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover object-center"
          autoPlay
          loop
          muted={muted}
          playsInline
          poster="/images/jacket-preview-poster.jpg"
          preload="metadata"
          aria-label="Manoir Kits collection film"
        >
          <source media="(min-width: 768px)" src={HERO_VIDEO_DESKTOP} type="video/mp4" />
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        {/* Feather the outer desktop edges into the site's black canvas. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[11%] bg-gradient-to-r from-black/80 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_right,black,transparent)] md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[11%] bg-gradient-to-l from-black/80 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_left,black,transparent)] md:block" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),transparent_10%,transparent_90%,rgba(0,0,0,0.45))]" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <button
        type="button"
        onClick={toggleSound}
        className="absolute right-4 top-4 z-20 flex cursor-pointer items-center gap-2 border border-white/60 bg-black/35 px-3 py-2 text-[10px] tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:right-6 sm:top-6"
        aria-label={muted ? 'Turn video sound on' : 'Mute video'}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {muted ? 'SOUND ON' : 'MUTE'}
      </button>
      
      <div className="relative h-full flex items-center justify-center text-center text-white px-6">
        <div>
          <p className="text-sm tracking-widest mb-8 opacity-90">
            SHOP
          </p>
          <Link 
            to="/jacket-builder"
            className="inline-block border-2 border-white px-12 py-4 hover:bg-white hover:text-black transition-all tracking-widest text-sm"
          >
            DESIGN YOUR CUSTOM JACKET
          </Link>
        </div>
      </div>
    </section>
  );
}
