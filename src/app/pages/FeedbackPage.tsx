import { FormEvent, useState } from 'react';
import { MessageSquareText, Send, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  callFirebaseFunction,
  firebaseAppCheckIsConfigured,
  firebaseErrorMessage,
  firebaseIsConfigured,
} from '../lib/firebase';

const categories = [
  { label: 'Jacket Builder', value: 'jacket-builder' },
  { label: 'Product', value: 'product' },
  { label: 'Shopping Experience', value: 'shopping' },
  { label: 'Website', value: 'website' },
  { label: 'Other', value: 'other' },
] as const;

const initialForm = {
  category: 'jacket-builder',
  email: '',
  message: '',
  name: '',
  rating: 0,
  website: '',
};

export function FeedbackPage() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.rating) {
      setError('Choose a rating before sending your feedback.');
      return;
    }
    if (!firebaseIsConfigured() || !firebaseAppCheckIsConfigured()) {
      setError('Feedback is temporarily unavailable. Please try again later.');
      return;
    }

    setSubmitting(true);
    try {
      await callFirebaseFunction(
        'submitFeedback',
        {
          ...form,
          path: window.location.pathname,
        },
        { limitedUseAppCheckTokens: true },
      );
      setForm(initialForm);
      setSubmitted(true);
    } catch (submissionError) {
      setError(
        firebaseErrorMessage(
          submissionError,
          'Feedback could not be sent. Please try again later.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-black px-6 py-20 text-center text-white">
        <MessageSquareText className="mx-auto mb-5 h-8 w-8" aria-hidden="true" />
        <h1 className="mb-4 text-5xl font-light tracking-widest">FEEDBACK</h1>
        <p className="text-sm tracking-wide opacity-80">
          Help us improve your Manoir Kits experience
        </p>
      </div>

      <div className="container mx-auto px-6 py-20">
        <div className="mx-auto max-w-3xl">
          {submitted ? (
            <div
              className="border border-black bg-gray-50 px-8 py-14 text-center"
              role="status"
            >
              <h2 className="mb-4 text-3xl font-light tracking-wide">
                THANK YOU
              </h2>
              <p className="mb-8 text-sm leading-relaxed text-gray-600">
                Your feedback has been sent to the Manoir Kits team.
              </p>
              <button
                className="bg-black px-8 py-3 text-sm tracking-widest text-white transition-colors hover:bg-gray-800"
                onClick={() => setSubmitted(false)}
                type="button"
              >
                SEND MORE FEEDBACK
              </button>
            </div>
          ) : (
            <form
              className="space-y-8 border border-gray-200 bg-gray-50 p-8 md:p-12"
              onSubmit={handleSubmit}
            >
              <div>
                <h2 className="mb-3 text-2xl font-light tracking-wide">
                  TELL US WHAT YOU THINK
                </h2>
                <p className="text-sm leading-relaxed text-gray-600">
                  Ratings and comments are reviewed privately and are not posted
                  publicly.
                </p>
              </div>

              <fieldset>
                <legend className="mb-3 block text-sm tracking-wide">
                  OVERALL RATING *
                </legend>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
                      aria-pressed={form.rating === rating}
                      className={`flex h-12 w-12 items-center justify-center border transition-colors ${
                        form.rating >= rating
                          ? 'border-black bg-black text-white'
                          : 'border-gray-300 bg-white text-gray-400 hover:border-black hover:text-black'
                      }`}
                      key={rating}
                      onClick={() =>
                        setForm((current) => ({ ...current, rating }))
                      }
                      type="button"
                    >
                      <Star
                        className="h-5 w-5"
                        fill={form.rating >= rating ? 'currentColor' : 'none'}
                      />
                    </button>
                  ))}
                </div>
              </fieldset>

              <div>
                <label
                  className="mb-2 block text-sm tracking-wide"
                  htmlFor="feedback-category"
                >
                  FEEDBACK ABOUT *
                </label>
                <select
                  className="w-full border border-gray-300 bg-white px-4 py-3 focus:border-black focus:outline-none"
                  id="feedback-category"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                  required
                  value={form.category}
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm tracking-wide"
                  htmlFor="feedback-message"
                >
                  YOUR FEEDBACK *
                </label>
                <textarea
                  className="w-full resize-none border border-gray-300 bg-white px-4 py-3 focus:border-black focus:outline-none"
                  id="feedback-message"
                  maxLength={2000}
                  minLength={3}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }))
                  }
                  required
                  rows={7}
                  value={form.message}
                />
                <p className="mt-2 text-right text-xs text-gray-500">
                  {form.message.length}/2000
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label
                    className="mb-2 block text-sm tracking-wide"
                    htmlFor="feedback-name"
                  >
                    FULL NAME (REQUIRED)
                  </label>
                  <input
                    autoComplete="name"
                    className="w-full border border-gray-300 bg-white px-4 py-3 focus:border-black focus:outline-none"
                    id="feedback-name"
                    maxLength={120}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    type="text"
                    value={form.name}
                  />
                </div>
                <div>
                  <label
                    className="mb-2 block text-sm tracking-wide"
                    htmlFor="feedback-email"
                  >
                    EMAIL ADDRESS (REQUIRED)
                  </label>
                  <input
                    autoComplete="email"
                    className="w-full border border-gray-300 bg-white px-4 py-3 focus:border-black focus:outline-none"
                    id="feedback-email"
                    maxLength={180}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                    type="email"
                    value={form.email}
                  />
                </div>
              </div>

              <div hidden>
                <label htmlFor="feedback-website">Website</label>
                <input
                  autoComplete="off"
                  id="feedback-website"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      website: event.target.value,
                    }))
                  }
                  tabIndex={-1}
                  type="text"
                  value={form.website}
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
                className="flex w-full items-center justify-center gap-2 bg-black py-4 text-sm tracking-widest text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting}
                type="submit"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {submitting ? 'SENDING…' : 'SEND FEEDBACK'}
              </button>

              <p className="text-xs leading-relaxed text-gray-500">
                By sending feedback, you agree that we may use it to improve our
                products and website. Read our{' '}
                <Link className="underline hover:text-black" to="/privacy-policy">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
