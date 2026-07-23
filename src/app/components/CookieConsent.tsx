import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Show after a brief delay
      setTimeout(() => setIsVisible(true), 2000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('cookieConsent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 z-50 border-t border-gray-800 sm:p-6">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          <div className="flex-1">
            <h3 className="text-xs tracking-widest mb-1.5 sm:text-sm sm:mb-2">COOKIES & PRIVACY</h3>
            <p className="text-[11px] leading-relaxed text-gray-400 tracking-wide max-w-2xl sm:text-xs">
              We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
              By clicking "Accept", you consent to our use of cookies. Read our{' '}
              <Link to="/privacy-policy" className="underline hover:text-white">
                Privacy Policy
              </Link>{' '}
              for more information.
            </p>
          </div>
          
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:items-center">
            <button
              onClick={handleDecline}
              className="px-4 py-2 border border-white text-white hover:bg-white hover:text-black transition-colors text-xs tracking-widest cursor-pointer sm:px-6"
            >
              DECLINE
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 bg-white text-black hover:bg-gray-200 transition-colors text-xs tracking-widest cursor-pointer sm:px-6"
            >
              ACCEPT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
