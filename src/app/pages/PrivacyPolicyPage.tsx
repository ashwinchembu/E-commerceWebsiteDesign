export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white py-20 text-center">
        <h1 className="text-5xl tracking-widest mb-4 font-light">PRIVACY POLICY</h1>
        <p className="text-sm tracking-wide opacity-80">Last Updated: February 2, 2026</p>
      </div>

      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8 text-gray-700">
            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">1. Information We Collect</h3>
              <p className="text-sm leading-relaxed mb-4">
                We collect information you provide directly to us, including your name, email address, shipping address, payment information, and any other information you choose to provide when you create an account, make a purchase, or contact us.
              </p>
              <p className="text-sm leading-relaxed">
                We also automatically collect certain information about your device when you use our website, including your IP address, browser type, operating system, referring URLs, and information about your usage of our website.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">2. How We Use Your Information</h3>
              <p className="text-sm leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="text-sm leading-relaxed space-y-2 ml-6 list-disc">
                <li>Process your orders and manage your account</li>
                <li>Communicate with you about products, services, and promotional offers</li>
                <li>Improve our website and customer experience</li>
                <li>Detect and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">3. Information Sharing</h3>
              <p className="text-sm leading-relaxed">
                We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers who assist us in operating our website and conducting our business, such as payment processors and shipping companies. These parties are obligated to keep your information confidential.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">4. Cookies and Tracking</h3>
              <p className="text-sm leading-relaxed">
                We use cookies and similar tracking technologies to enhance your browsing experience, analyze site traffic, and understand where our visitors are coming from. You can control cookies through your browser settings.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">5. Data Security</h3>
              <p className="text-sm leading-relaxed">
                We implement reasonable security measures to protect your personal information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">6. Your Rights</h3>
              <p className="text-sm leading-relaxed">
                You have the right to access, correct, or delete your personal information. You may also opt out of receiving marketing communications from us at any time. To exercise these rights, please contact us using the information provided on this page.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">7. Contact Us</h3>
              <p className="text-sm leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at privacy@manoirkits.com.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
