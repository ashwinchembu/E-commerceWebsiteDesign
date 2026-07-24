import { Link } from 'react-router-dom';

export function CheckoutPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-24 text-center text-white">
      <h1 className="text-3xl font-light tracking-widest">SECURE CHECKOUT</h1>
      <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/70">
        Configure your jacket first. Shipping, taxes, payment, and the final order are handled securely by Shopify.
      </p>
      <Link
        to="/jacket-builder"
        className="mt-8 inline-block border border-white px-10 py-4 text-sm tracking-widest transition-colors hover:bg-white hover:text-black"
      >
        DESIGN YOUR JACKET
      </Link>
    </div>
  );
}
