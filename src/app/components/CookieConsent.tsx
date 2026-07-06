import { X } from 'lucide-react';
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
    <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-6 z-50 border-t border-gray-800">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm tracking-widest mb-2">COOKIES & PRIVACY</h3>
            <p className="text-xs text-gray-400 tracking-wide max-w-2xl">
              We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
              By clicking "Accept", you consent to our use of cookies. Read our{' '}
              <Link to="/contact" className="underline hover:text-white">
                Privacy Policy
              </Link>{' '}
              for more information.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleDecline}
              className="px-6 py-2 border border-white text-white hover:bg-white hover:text-black transition-colors text-xs tracking-widest cursor-pointer"
            >
              DECLINE
            </button>
            <button
              onClick={handleAccept}
              className="px-6 py-2 bg-white text-black hover:bg-gray-200 transition-colors text-xs tracking-widest cursor-pointer"
            >
              ACCEPT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
