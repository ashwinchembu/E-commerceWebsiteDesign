import { Ghost, Instagram, Youtube } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeToNewsletter } from '../lib/newsletter';
import { markNewsletterSubscribed } from '../lib/newsletterPreferences';

export function Footer() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('');
    setSubmitting(true);
    try {
      const result = await subscribeToNewsletter(email, website);
      setEmail('');
      setWebsite('');
      markNewsletterSubscribed(true);
      setStatus(
        result.discountCode
          ? `you are subscribed — welcome code ${result.discountCode}`
          : 'you are subscribed',
      );
    } catch (error) {
      const { firebaseErrorMessage } = await import('../lib/firebase');
      setStatus(
        firebaseErrorMessage(
          error,
          'newsletter signup is temporarily unavailable',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-black text-white py-16">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 gap-12 mb-12 lg:grid-cols-3">
          {/* Left - Logo and Copyright */}
          <div>
            <h3 className="text-2xl tracking-widest mb-4 font-light">
              MANOIR KITS
            </h3>
            <p className="text-sm text-gray-400 tracking-wide">
              Copyright © 2026 Manoir Kits.
              <br />
              All Rights Reserved.
            </p>
          </div>

          {/* Center - Newsletter */}
          <div className="lg:text-center">
            <p className="text-sm tracking-wide mb-4">
              For the latest news & most limited drops
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                aria-label="Email address for newsletter"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="bg-transparent border border-white/30 px-4 py-3 text-sm focus:outline-none focus:border-white transition-colors"
                required
              />
              <div hidden>
                <label htmlFor="footer-newsletter-website">Website</label>
                <input
                  autoComplete="off"
                  id="footer-newsletter-website"
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  type="text"
                  value={website}
                />
              </div>
              <button
                type="submit"
                className="cursor-pointer bg-white px-6 py-3 text-sm tracking-wide text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? 'SUBSCRIBING…' : 'SUBSCRIBE'}
              </button>
              {status ? (
                <p aria-live="polite" className="text-xs leading-5 text-gray-300">
                  {status}
                </p>
              ) : null}
              <p className="text-center text-[11px] leading-5 text-gray-500">
                <span className="block">
                  By subscribing you agree to receive marketing emails.
                </span>
                <span className="block">You may unsubscribe at any time.</span>
              </p>
            </form>
          </div>

          {/* Right - Social Media */}
          <div className="lg:text-right">
            <p className="text-sm tracking-wide mb-4">Follow Us</p>
            <div className="flex gap-4 lg:justify-end">
              <a
                href="https://www.instagram.com/manoirkits/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
                aria-label="Manoir Kits on Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.snapchat.com/add/manoirkits"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
                aria-label="Manoir Kits on Snapchat"
              >
                <Ghost className="w-5 h-5" />
              </a>
              <a
                href="https://www.tiktok.com/@manoirkits"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
                aria-label="Manoir Kits on TikTok"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                </svg>
              </a>
              <a
                href="https://x.com/manoirkits"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
                aria-label="Manoir Kits on X"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://www.youtube.com/@manoirkits"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
                aria-label="Manoir Kits on YouTube"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-400">
            <p>ManoirKits.com</p>
            <div className="flex flex-wrap gap-6 justify-center">
              <Link to="/about" className="hover:text-white transition-colors">
                About
              </Link>
              <Link to="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
              <Link to="/feedback" className="hover:text-white transition-colors">
                Feedback
              </Link>
              <Link to="/privacy-policy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms & Conditions
              </Link>
              <Link to="/do-not-sell" className="hover:text-white transition-colors">
                Do Not Sell My Personal Information
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
