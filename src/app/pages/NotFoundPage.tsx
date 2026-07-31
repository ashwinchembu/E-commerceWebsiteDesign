import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center bg-white px-6 py-20 text-center">
      <div>
        <p className="text-xs tracking-[0.25em] text-gray-500">404</p>
        <h1 className="mt-4 text-4xl font-light tracking-widest">PAGE NOT FOUND</h1>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-gray-600">
          The page you requested does not exist or is no longer available
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            className="bg-black px-8 py-3 text-sm tracking-widest text-white transition-colors hover:bg-gray-800"
            to="/jacket-builder"
          >
            DESIGN A JACKET
          </Link>
          <Link
            className="border border-black px-8 py-3 text-sm tracking-widest transition-colors hover:bg-gray-50"
            to="/"
          >
            RETURN HOME
          </Link>
        </div>
      </div>
    </div>
  );
}
