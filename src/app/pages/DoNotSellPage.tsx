export function DoNotSellPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white py-20 text-center">
        <h1 className="text-5xl tracking-widest mb-4 font-light">DO NOT SELL MY PERSONAL INFORMATION</h1>
        <p className="text-sm tracking-wide opacity-80">Last Updated: February 2, 2026</p>
      </div>

      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8 text-gray-700">
            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">Your Rights Under CCPA</h3>
              <p className="text-sm leading-relaxed">
                The California Consumer Privacy Act (CCPA) provides California residents with specific rights regarding their personal information. This section describes your CCPA rights and how to exercise them.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">Our Commitment</h3>
              <p className="text-sm leading-relaxed mb-4">
                <strong>Manoir Kits does not sell your personal information.</strong> We do not and will not sell your personal data to third parties for monetary or other valuable consideration.
              </p>
              <p className="text-sm leading-relaxed">
                We may share certain information with service providers who help us operate our business (such as payment processors, shipping companies, and marketing platforms), but these parties are contractually obligated to use your information only to provide services to us and not for their own purposes.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">Information We Collect</h3>
              <p className="text-sm leading-relaxed mb-4">
                We collect the following categories of personal information:
              </p>
              <ul className="text-sm leading-relaxed space-y-2 ml-6 list-disc">
                <li>Identifiers (name, email address, mailing address)</li>
                <li>Order and payment records processed by Shopify</li>
                <li>Purchase history and preferences</li>
                <li>Limited technical and security activity such as an IP address</li>
                <li>Approximate location only when supplied for private-access security</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">Your CCPA Rights</h3>
              <p className="text-sm leading-relaxed mb-4">
                As a California resident, you have the right to:
              </p>
              <ul className="text-sm leading-relaxed space-y-2 ml-6 list-disc">
                <li>Know what personal information we collect, use, and disclose</li>
                <li>Request deletion of your personal information</li>
                <li>Opt-out of the sale of your personal information (though we do not sell personal information)</li>
                <li>Non-discrimination for exercising your CCPA rights</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">How to Exercise Your Rights</h3>
              <p className="text-sm leading-relaxed mb-4">
                To exercise your CCPA rights, please:
              </p>
              <ul className="text-sm leading-relaxed space-y-2 ml-6 list-disc">
                <li>Email us at privacy@manoirkits.com</li>
                <li>Contact us through our contact page</li>
                <li>Log into your account and update your preferences</li>
              </ul>
              <p className="text-sm leading-relaxed mt-4">
                We will verify your identity before processing your request and respond within 45 days.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">Cookies and Tracking</h3>
              <p className="text-sm leading-relaxed">
                We currently use only necessary cookies or browser storage for secure access, account sessions, and website preferences. We do not currently use advertising cookies or third-party behavioral analytics. Disabling necessary storage may affect website functionality.
              </p>
            </div>

            <div>
              <h3 className="text-xl tracking-wide mb-4 font-light">Questions</h3>
              <p className="text-sm leading-relaxed">
                If you have questions about this notice or our privacy practices, please contact us at privacy@manoirkits.com or visit our contact page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
