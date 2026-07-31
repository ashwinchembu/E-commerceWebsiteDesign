import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';
import {
  callFirebaseFunction,
  firebaseAppCheckIsConfigured,
  firebaseErrorMessage,
  firebaseIsConfigured,
} from '../lib/firebase';

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    website: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!firebaseIsConfigured() || !firebaseAppCheckIsConfigured()) {
      setError('Messages are temporarily unavailable. Please try again later.');
      return;
    }

    setSubmitting(true);
    try {
      await callFirebaseFunction(
        'submitContact',
        {
          ...formData,
          path: window.location.pathname,
        },
        { limitedUseAppCheckTokens: true },
      );
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        website: '',
      });
      setSubmitted(true);
    } catch (submissionError) {
      setError(
        firebaseErrorMessage(
          submissionError,
          'Your message could not be sent. Please try again later.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white py-20 text-center">
        <h1 className="text-5xl tracking-widest mb-4 font-light">CONTACT US</h1>
        <p className="text-sm tracking-wide opacity-80">We'd love to hear from you</p>
      </div>

      <div className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
          {/* Contact Information */}
          <div>
            <h2 className="text-3xl tracking-wide mb-8 font-light">GET IN TOUCH</h2>
            
            <p className="text-gray-600 mb-12 leading-relaxed">
              Have a question about our products, need styling advice, or want to inquire about custom orders? Our team is here to help.
            </p>
          </div>

          {/* Contact Form */}
          <div className="bg-gray-50 p-8">
            <h2 className="text-2xl tracking-wide mb-6 font-light">SEND US A MESSAGE</h2>

            {submitted ? (
              <div className="border border-black bg-white px-6 py-12 text-center" role="status">
                <h3 className="text-2xl font-light tracking-wide">MESSAGE RECEIVED</h3>
                <p className="mt-4 text-sm leading-6 text-gray-600">
                  Your message is saved privately in the Manoir Kits Shopify inbox
                </p>
                <button
                  className="mt-7 bg-black px-8 py-3 text-sm tracking-widest text-white transition-colors hover:bg-gray-800"
                  onClick={() => setSubmitted(false)}
                  type="button"
                >
                  SEND ANOTHER MESSAGE
                </button>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm tracking-wide mb-2">
                  NAME *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  maxLength={120}
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm tracking-wide mb-2">
                  EMAIL *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  maxLength={180}
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm tracking-wide mb-2">
                  SUBJECT *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  maxLength={160}
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:border-black"
                  required
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm tracking-wide mb-2">
                  MESSAGE *
                </label>
                <textarea
                  id="message"
                  name="message"
                  maxLength={1800}
                  minLength={3}
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:border-black resize-none"
                  required
                />
              </div>

              <div hidden>
                <label htmlFor="contact-website">Website</label>
                <input
                  autoComplete="off"
                  id="contact-website"
                  name="website"
                  onChange={handleChange}
                  tabIndex={-1}
                  type="text"
                  value={formData.website}
                />
              </div>

              {error ? (
                <p
                  className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-center gap-2 bg-black py-4 text-sm tracking-widest text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
              >
                <Send className="w-4 h-4" />
                {submitting ? 'SENDING…' : 'SEND MESSAGE'}
              </button>
            </form>
            )}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-gray-50 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl tracking-wide mb-12 text-center font-light">
            FREQUENTLY ASKED QUESTIONS
          </h2>

          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-6">
              <h3 className="text-sm tracking-wide mb-2">Can I return or exchange my order?</h3>
              <p className="text-sm text-gray-600">
                All sales are final — every piece is made to order, so we do not offer returns or exchanges. If your item arrives defective or damaged, contact us within 7 days and we will make it right.
              </p>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm tracking-wide mb-2">How long does shipping take?</h3>
              <p className="text-sm text-gray-600">
                The available delivery methods and estimated arrival window are calculated at checkout from the destination, shipping origin, package, and carrier service.
              </p>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm tracking-wide mb-2">Do you ship internationally?</h3>
              <p className="text-sm text-gray-600">
                Yes, we ship to select countries worldwide. Shipping rates are calculated at checkout. Import duties, taxes, or customs fees may be charged by the destination country unless checkout states that they are included.
              </p>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm tracking-wide mb-2">How do I track my order?</h3>
              <p className="text-sm text-gray-600">
                Orders can be tracked by logging in your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
