import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Header() {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location]);

  const headerClass = isHomePage
    ? 'bg-black text-white border-b border-gray-800 z-40'
    : 'bg-white border-b border-gray-200 z-40';
  const mobileMenuBorderClass = isHomePage
    ? 'border-gray-800'
    : 'border-gray-200';

  return (
    <header className={headerClass}>
      <div className="container mx-auto px-6">
        <div className="relative flex h-16 items-center justify-between">
          <button
            aria-expanded={showMobileMenu}
            aria-label="Toggle menu"
            className="md:hidden"
            onClick={() => setShowMobileMenu((current) => !current)}
            type="button"
          >
            {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
            <Link
              className="text-sm tracking-wide transition-opacity hover:opacity-70"
              to="/jacket-builder"
            >
              CUSTOM JACKET
            </Link>
          </nav>

          <Link
            className="absolute left-1/2 -translate-x-1/2 text-xl font-light tracking-widest"
            to="/"
          >
            MANOIR KITS
          </Link>

          <Link
            className="hidden text-sm tracking-wide transition-opacity hover:opacity-70 md:block"
            to="/account"
          >
            ACCOUNT
          </Link>

          <span aria-hidden="true" className="w-5 md:hidden" />
        </div>

        {showMobileMenu ? (
          <nav
            aria-label="Mobile navigation"
            className={`border-t py-4 md:hidden ${mobileMenuBorderClass}`}
          >
            <div className="flex flex-col gap-4">
              <Link
                className="text-sm tracking-wide transition-opacity hover:opacity-70"
                to="/jacket-builder"
              >
                CUSTOM JACKET
              </Link>
              <Link
                className="text-sm tracking-wide transition-opacity hover:opacity-70"
                to="/account"
              >
                ACCOUNT
              </Link>
              <Link
                className="text-sm tracking-wide transition-opacity hover:opacity-70"
                to="/feedback"
              >
                FEEDBACK
              </Link>
            </div>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
