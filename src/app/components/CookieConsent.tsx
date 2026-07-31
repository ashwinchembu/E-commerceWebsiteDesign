import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      const timer = window.setTimeout(() => setIsVisible(true), 2000);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const handleContinue = () => {
    localStorage.setItem('cookieConsent', 'acknowledged');
    setIsVisible(false);
    window.dispatchEvent(new Event('manoir:cookie-consent'));
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 z-50 border-t border-gray-800 sm:p-6">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          <div className="flex-1">
            <h3 className="text-xs tracking-widest mb-1.5 sm:text-sm sm:mb-2">COOKIES & PRIVACY</h3>
            <p className="text-[11px] leading-relaxed text-gray-400 tracking-wide max-w-2xl sm:text-xs">
              We currently use only necessary browser storage for secure access and your site
              preferences. Read our{' '}
              <Link to="/privacy-policy" className="underline hover:text-white">
                Privacy Policy
              </Link>{' '}
              for more information
            </p>
          </div>
          
          <div className="w-full sm:w-auto">
            <button
              onClick={handleContinue}
              className="w-full cursor-pointer bg-white px-6 py-2 text-xs tracking-widest text-black transition-colors hover:bg-gray-200"
              type="button"
            >
              CONTINUE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
