import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Volume2, VolumeX } from 'lucide-react';

const HERO_VIDEO = '/videos/landing-hero.mp4?v=4';
const HERO_VIDEO_DESKTOP = '/videos/landing-hero-desktop.mp4?v=5';

export function HeroSection() {
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  const startPlayback = async () => {
    const video = videoRef.current;
    if (!video) return false;

    // Starting muted is the most reliable way to resume inline playback on
    // iPhone, including when Low Power Mode has blocked autoplay.
    video.defaultMuted = true;
    video.muted = true;
    setMuted(true);
    try {
      await video.play();
      setPlaybackBlocked(false);
      return true;
    } catch {
      setPlaybackBlocked(true);
      return false;
    }
  };

  const toggleSound = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (playbackBlocked || video.paused) {
      await startPlayback();
      return;
    }

    video.muted = !muted;
    setMuted(!muted);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let pauseTimer = 0;
    const markPlaying = () => {
      if (!cancelled) setPlaybackBlocked(false);
    };
    const markPaused = () => {
      window.clearTimeout(pauseTimer);
      pauseTimer = window.setTimeout(() => {
        if (
          !cancelled &&
          document.visibilityState === 'visible' &&
          video.paused &&
          !video.ended
        ) {
          setPlaybackBlocked(true);
        }
      }, 250);
    };
    const attemptPlayback = async () => {
      if (cancelled) return;
      if (!video.paused && !video.ended) {
        markPlaying();
        return;
      }

      video.defaultMuted = true;
      video.muted = true;
      try {
        await video.play();
        markPlaying();
      } catch {
        if (!cancelled && video.paused) setPlaybackBlocked(true);
      }
    };

    const retryWhenVisible = () => {
      if (document.visibilityState === 'visible') void attemptPlayback();
    };

    video.addEventListener('playing', markPlaying);
    video.addEventListener('timeupdate', markPlaying);
    video.addEventListener('pause', markPaused);
    video.addEventListener('error', markPaused);
    video.addEventListener('canplay', attemptPlayback);
    window.addEventListener('pageshow', attemptPlayback);
    document.addEventListener('visibilitychange', retryWhenVisible);

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      void attemptPlayback();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(pauseTimer);
      video.removeEventListener('playing', markPlaying);
      video.removeEventListener('timeupdate', markPlaying);
      video.removeEventListener('pause', markPaused);
      video.removeEventListener('error', markPaused);
      video.removeEventListener('canplay', attemptPlayback);
      window.removeEventListener('pageshow', attemptPlayback);
      document.removeEventListener('visibilitychange', retryWhenVisible);
    };
  }, []);

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
          className="hero-video absolute inset-0 h-full w-full object-cover object-center"
          autoPlay
          loop
          muted={muted}
          playsInline
          poster="/images/landing-hero-poster.jpg"
          preload="auto"
          aria-label="Manoir Kits collection film"
        >
          <source media="(min-width: 768px)" src={HERO_VIDEO_DESKTOP} type="video/mp4" />
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        <img
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover object-center transition-opacity duration-300 ${
            playbackBlocked ? 'opacity-100' : 'opacity-0'
          }`}
          src="/images/landing-hero-poster.jpg"
        />
        {/* Feather the outer desktop edges into the site's black canvas. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[2] hidden w-[11%] bg-gradient-to-r from-black/80 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_right,black,transparent)] md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] hidden w-[11%] bg-gradient-to-l from-black/80 to-transparent backdrop-blur-sm [mask-image:linear-gradient(to_left,black,transparent)] md:block" />
        <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.35),transparent_10%,transparent_90%,rgba(0,0,0,0.45))]" />
        <div className="absolute inset-0 z-[2] bg-black/20" />
      </div>

      {playbackBlocked ? (
        <button
          aria-label="Play hero film"
          className="absolute left-1/2 top-[18%] z-20 flex -translate-x-1/2 cursor-pointer items-center gap-2 border border-white/80 bg-black/55 px-5 py-3 text-xs tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-black/75"
          onClick={startPlayback}
          type="button"
        >
          <Play className="h-4 w-4 fill-current" />
          TAP TO PLAY
        </button>
      ) : (
        <button
          aria-label={muted ? 'Turn video sound on' : 'Mute video'}
          className="absolute right-4 top-4 z-20 flex cursor-pointer items-center gap-2 border border-white/60 bg-black/35 px-3 py-2 text-[10px] tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-black/60 sm:right-6 sm:top-6"
          onClick={toggleSound}
          type="button"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          {muted ? 'SOUND ON' : 'MUTE'}
        </button>
      )}
      
      <div className="relative z-10 flex h-full items-center justify-center px-6 text-center text-white">
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
