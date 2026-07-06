import { X } from 'lucide-react';
import { useState } from 'react';

interface NewsletterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewsletterModal({ isOpen, onClose }: NewsletterModalProps) {
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Newsletter signup:', email);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 hover:opacity-70 transition-opacity cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl tracking-wide mb-2 font-light text-center">
          JOIN THE MANOIR FAMILY
        </h2>
        <p className="text-sm text-gray-600 mb-6 text-center tracking-wide">
          Save 10% off your first order
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full border border-gray-300 px-4 py-3 mb-4 text-sm focus:outline-none focus:border-black transition-colors"
            required
          />
          <button
            type="submit"
            className="w-full bg-black text-white py-3 hover:bg-gray-800 transition-colors text-sm tracking-wide cursor-pointer"
          >
            SUBSCRIBE
          </button>
        </form>
      </div>
    </div>
  );
}