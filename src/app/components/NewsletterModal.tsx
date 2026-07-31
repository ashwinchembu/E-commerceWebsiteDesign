import { X } from 'lucide-react';
import { useState } from 'react';
import { subscribeToNewsletter } from '../lib/newsletter';
import { markNewsletterSubscribed } from '../lib/newsletterPreferences';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewsletterModal({ isOpen, onClose }: NewsletterModalProps) {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [discountCode, setDiscountCode] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await subscribeToNewsletter(email, website);
      setDiscountCode(result.discountCode);
      setSubmitted(true);
      markNewsletterSubscribed();
    } catch (submissionError) {
      const { firebaseErrorMessage } = await import('../lib/firebase');
      setError(
        firebaseErrorMessage(
          submissionError,
          'newsletter signup is temporarily unavailable',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      aria-label="Newsletter signup"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
    >
      <div className="relative w-full max-w-md bg-white p-8">
        <button
          aria-label="Close newsletter signup"
          className="absolute right-4 top-4 cursor-pointer transition-opacity hover:opacity-70"
          onClick={onClose}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-5 text-center" role="status">
            <h2 className="text-2xl font-light tracking-wide">WELCOME TO MANOIR</h2>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              Your email is now subscribed through Shopify
            </p>
            {discountCode ? (
              <p className="mt-5 border border-black px-4 py-3 text-sm tracking-widest">
                WELCOME CODE {discountCode}
              </p>
            ) : null}
            <button
              className="mt-6 w-full bg-black py-3 text-sm tracking-wide text-white transition-colors hover:bg-gray-800"
              onClick={onClose}
              type="button"
            >
              CONTINUE
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-center text-2xl font-light tracking-wide">
              GET THE LATEST DROPS
            </h2>
            <p className="mb-6 text-center text-sm tracking-wide text-gray-600">
              Get early access to limited releases and Manoir Kits updates
            </p>

            <form onSubmit={handleSubmit}>
              <input
                aria-label="Email address for newsletter"
                autoComplete="email"
                className="mb-4 w-full border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-black focus:outline-none"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                required
                type="email"
                value={email}
              />
              <div hidden>
                <label htmlFor="modal-newsletter-website">Website</label>
                <input
                  autoComplete="off"
                  id="modal-newsletter-website"
                  onChange={(event) => setWebsite(event.target.value)}
                  tabIndex={-1}
                  type="text"
                  value={website}
                />
              </div>
              {error ? (
                <p
                  className="mb-4 border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                className="w-full cursor-pointer bg-black py-3 text-sm tracking-wide text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'SUBSCRIBING…' : 'SUBSCRIBE'}
              </button>
              <p className="mt-4 text-center text-[11px] leading-5 text-gray-500">
                <span className="block">
                  By subscribing you agree to receive marketing emails.
                </span>
                <span className="block">You may unsubscribe at any time.</span>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
