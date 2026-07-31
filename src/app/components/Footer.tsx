import { Instagram, Youtube } from 'lucide-react';
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
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
          <div className="md:text-center">
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
          <div className="md:text-right">
            <p className="text-sm tracking-wide mb-4">Follow Us</p>
            <div className="flex gap-4 md:justify-end">
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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.166 3c.796 0 3.495.223 4.769 3.073.426.959.324 2.589.24 3.898l-.002.047c-.011.146-.018.278-.024.41.395.09.773.16 1.064.16.268 0 .522-.037.77-.116.594-.19.871-.475 1.09-.672.106-.095.225-.204.39-.204.078 0 .15.024.227.073a.448.448 0 01.104.603c-.268.34-.665.585-1.029.797l-.087.05c-.395.228-.723.417-.723.816 0 .446.25.756.523 1.098.35.437.744.93.744 1.71 0 1.11-.734 1.834-2.005 1.981a.838.838 0 01-.02.355c-.094.373-.301.762-.556 1.043-.504.557-1.176.866-1.896.866-.485 0-.97-.142-1.38-.277-.326-.108-.617-.203-.846-.203-.212 0-.479.09-.777.188-.494.163-1.107.366-1.778.366-.665 0-1.275-.203-1.769-.587-.769-.599-1.14-1.571-1.14-2.973V8.818c0-.507-.147-.889-.476-1.238-.482-.512-1.234-.791-2.058-.791-.203 0-.368-.165-.368-.368s.165-.369.368-.369c1.085 0 2.05.382 2.718 1.075.514.534.817 1.24.817 1.99v5.697c0 1.165.282 1.928.86 2.328.346.239.803.37 1.324.37.516 0 1.007-.15 1.45-.294.336-.11.643-.211.922-.211.297 0 .623.106.982.222.422.138.9.294 1.416.294.527 0 1.012-.215 1.366-.605.172-.19.324-.427.39-.662a1.37 1.37 0 00.041-.373.368.368 0 01.301-.363c.991-.177 1.493-.64 1.493-1.375 0-.51-.271-.842-.593-1.243-.346-.433-.737-.923-.737-1.607 0-.736.5-1.048.93-1.295l.087-.05c.267-.155.533-.31.712-.532-.19.071-.389.106-.593.106-.478 0-.932-.103-1.367-.206-.294-.07-.57-.135-.821-.135-.203 0-.368-.165-.368-.368 0-.049.01-.095.027-.137.023-.198.034-.384.044-.557l.002-.047c.08-1.244.165-2.53-.134-3.237-.987-2.337-3.202-2.535-3.78-2.535h-.333c-.578 0-2.793.198-3.78 2.535-.3.707-.214 1.993-.134 3.237l.002.047c.01.173.02.36.044.557.017.042.027.088.027.137 0 .203-.165.368-.368.368-.251 0-.527.066-.821.135-.435.103-.889.206-1.367.206-.204 0-.403-.035-.593-.106.179.221.445.377.712.532l.087.05c.43.247.93.559.93 1.295 0 .684-.391 1.174-.737 1.607-.322.401-.593.733-.593 1.243 0 .735.502 1.198 1.493 1.375a.368.368 0 01.301.363c0 .128.015.253.041.373.066.235.218.472.39.662.354.39.84.605 1.366.605.516 0 .994-.156 1.416-.294.359-.116.685-.222.982-.222.279 0 .586.1.922.211.443.144.934.294 1.45.294.52 0 .978-.131 1.324-.37.578-.4.86-1.163.86-2.328V8.818c0-.75.303-1.456.817-1.99.668-.693 1.633-1.075 2.718-1.075.203 0 .368.166.368.369s-.165.368-.368.368c-.824 0-1.576.279-2.058.791-.329.35-.476.731-.476 1.238v5.484c0 1.402-.371 2.374-1.14 2.973-.494.384-1.104.587-1.769.587-.671 0-1.284-.203-1.778-.366-.298-.098-.565-.188-.777-.188-.229 0-.52.095-.846.203-.41.135-.895.277-1.38.277-.72 0-1.392-.309-1.896-.866-.255-.281-.462-.67-.556-1.043a.838.838 0 01-.02-.355c-1.271-.147-2.005-.871-2.005-1.981 0-.78.394-1.273.744-1.71.273-.342.523-.652.523-1.098 0-.399-.328-.588-.723-.816l-.087-.05c-.364-.212-.761-.457-1.029-.797a.448.448 0 01.104-.603.368.368 0 01.227-.073c.165 0 .284.109.39.204.219.197.496.481 1.09.672.248.079.502.116.77.116.291 0 .669-.07 1.064-.16-.006-.132-.013-.264-.024-.41l-.002-.047c-.084-1.309-.186-2.939.24-3.898C8.671 3.223 11.37 3 12.166 3z"/>
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
