import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for your message. We will get back to you soon!');
    setFormData({ name: '', email: '', subject: '', message: '' });
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
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm tracking-wide mb-2">
                  NAME *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
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
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full border border-gray-300 px-4 py-3 focus:outline-none focus:border-black resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                SEND MESSAGE
              </button>
            </form>
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
                Shipping times vary depending on your location. Some items ship from the US, while others ship from the Middle East.
              </p>
            </div>

            <div className="bg-white p-6">
              <h3 className="text-sm tracking-wide mb-2">Do you ship internationally?</h3>
              <p className="text-sm text-gray-600">
                Yes, we ship to select countries worldwide. International shipping times vary by location.
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