import { ShoppingBag, Menu, X, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { products } from '../data/products';
import logoImage from 'figma:asset/49db8db3192aa070a09b2e638fd91cfc6cf1ca1e.png';

interface HeaderProps {
  cartItemCount: number;
  onSearchClick: () => void;
  user: { email: string; name: string; isAdmin: boolean } | null;
}

export function Header({ cartItemCount, user, onSearchClick }: HeaderProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showResultsAnimation, setShowResultsAnimation] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location]);

  // Trigger animation when search query changes
  useEffect(() => {
    if (searchQuery.trim() && showSearchBar) {
      setShowResultsAnimation(false);
      const timer = setTimeout(() => setShowResultsAnimation(true), 50);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, showSearchBar]);

  const filteredProducts = searchQuery.trim()
    ? products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Limit to first 6 results in dropdown
  const displayedProducts = filteredProducts.slice(0, 6);
  const hasMoreResults = filteredProducts.length > 6;

  const headerClass = isHomePage 
    ? "bg-black text-white border-b border-gray-800 z-40" 
    : "bg-white border-b border-gray-200 z-40";
  
  const dropdownClass = isHomePage
    ? "bg-black border-gray-800 text-white"
    : "bg-white border-gray-200";

  const mobileMenuBorderClass = isHomePage
    ? "border-gray-800"
    : "border-gray-200";

  return (
    <header className={headerClass}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left Section - Collection */}
          <div className="flex items-center gap-8">
            <button 
              className="md:hidden"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-label="Toggle menu"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link to="/shop" className="text-sm tracking-wide hover:opacity-70 transition-opacity">
                NEW
              </Link>
              <div 
                className="relative group"
                onMouseEnter={() => setShowCollectionDropdown(true)}
                onMouseLeave={() => setShowCollectionDropdown(false)}
              >
                <Link to="/shop" className="text-sm tracking-wide hover:opacity-70 transition-opacity">
                  COLLECTION
                </Link>
                <div className={`absolute top-full left-0 mt-0 ${dropdownClass} border min-w-[200px] py-4 px-6 shadow-lg transition-all duration-700 ease-out origin-top overflow-hidden ${
                  showCollectionDropdown 
                    ? 'opacity-100 max-h-96 pointer-events-auto' 
                    : 'opacity-0 max-h-0 pointer-events-none'
                }`}>
                  <Link 
                    to="/shop" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '100ms' : '0ms' }}
                  >
                    ALL
                  </Link>
                  <Link 
                    to="/shop?category=jackets" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '200ms' : '0ms' }}
                  >
                    JACKETS
                  </Link>
                  <Link 
                    to="/jacket-builder" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 pl-4 text-gray-600 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '250ms' : '0ms' }}
                  >
                    → CUSTOM JACKET BUILDER
                  </Link>
                  <Link 
                    to="/shop?category=hoodies" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '300ms' : '0ms' }}
                  >
                    HOODIES
                  </Link>
                  <Link 
                    to="/shop?category=pants" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '400ms' : '0ms' }}
                  >
                    PANTS
                  </Link>
                  <Link 
                    to="/shop?category=upcycled-kits" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '500ms' : '0ms' }}
                  >
                    UPCYCLED KITS
                  </Link>
                  <Link 
                    to="/shop?category=footwear" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 mb-3 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '600ms' : '0ms' }}
                  >
                    FOOTWEAR
                  </Link>
                  <Link 
                    to="/shop?category=accessories" 
                    className={`block text-sm tracking-wide hover:opacity-70 transition-all duration-400 ${
                      showCollectionDropdown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showCollectionDropdown ? '700ms' : '0ms' }}
                  >
                    ACCESSORIES
                  </Link>
                </div>
              </div>
            </nav>
          </div>

          {/* Center Logo */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Link to="/" className="text-xl tracking-widest font-light">
              MANOIR KITS
            </Link>
          </div>

          {/* Right Section - Login, Search, Cart */}
          <div className="flex items-center gap-6">
            <Link to="/account" className="text-sm tracking-wide hover:opacity-70 transition-opacity hidden md:block mr-2">
              {user ? user.name.toUpperCase() : 'LOGIN'}
            </Link>

            {/* Search with Expanding Bar */}
            <div 
              className="relative hidden md:block"
              onMouseEnter={() => setShowSearchBar(true)}
              onMouseLeave={() => {
                setShowSearchBar(false);
                setSearchQuery('');
              }}
            >
              <div className={`flex items-center overflow-hidden transition-all duration-[2000ms] ease-in-out ${
                showSearchBar ? 'w-40' : 'w-[60px]'
              }`}>
                <span className={`text-sm tracking-wide whitespace-nowrap cursor-pointer absolute transition-all duration-700 ${
                  showSearchBar ? 'opacity-0 delay-[1300ms]' : 'opacity-100 hover:opacity-70'
                }`}>
                  SEARCH
                </span>
                <div className={`flex items-center gap-2 w-full transition-opacity duration-[1000ms] ${
                  showSearchBar ? 'opacity-100 delay-[1500ms]' : 'opacity-0'
                }`}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="SEARCH"
                    className={`text-sm tracking-wide bg-transparent border-b-2 focus:outline-none w-full placeholder:tracking-wide transition-all duration-500 ${
                      isHomePage 
                        ? 'border-white placeholder-gray-400' 
                        : 'border-black placeholder-gray-500'
                    }`}
                    autoFocus={showSearchBar}
                  />
                  <Search className="w-4 h-4 flex-shrink-0" />
                </div>
              </div>

              {/* Search Results Dropdown */}
              {searchQuery.trim() && (
                <div className={`absolute top-full right-0 mt-2 ${dropdownClass} border min-w-[400px] shadow-lg transition-all duration-[1000ms] ease-in-out origin-top overflow-hidden z-50 ${
                  searchQuery.trim() && filteredProducts.length > 0
                    ? 'opacity-100 max-h-[600px] pointer-events-auto' 
                    : 'opacity-0 max-h-0 pointer-events-none'
                }`}>
                  {filteredProducts.length === 0 ? (
                    <div className="py-6 px-6">
                      <p className="text-sm text-gray-500 text-left">
                        No products found for "{searchQuery}"
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="py-4 px-6 max-h-[500px] overflow-y-auto">
                        {displayedProducts.map((product, index) => (
                          <Link
                            key={product.id}
                            to={`/product/${product.id}`}
                            onClick={() => {
                              setSearchQuery('');
                              setShowSearchBar(false);
                            }}
                            className={`flex items-center gap-4 hover:opacity-70 py-3 transition-all duration-500 ${
                              showResultsAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                            }`}
                            style={{ transitionDelay: showResultsAnimation ? `${(index + 1) * 300}ms` : '0ms' }}
                          >
                            <ImageWithFallback
                              src={product.images[0]}
                              alt={product.name}
                              className="w-16 h-16 object-cover"
                            />
                            <div className="flex-1 text-left">
                              <h3 className="text-sm tracking-wide mb-1">{product.name}</h3>
                              <p className="text-sm text-gray-600">${product.price}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                      
                      {/* View More Results Button */}
                      {hasMoreResults && (
                        <div 
                          className={`border-t px-6 py-4 transition-all duration-500 ${
                              isHomePage ? 'border-gray-800' : 'border-gray-200'
                            } ${
                              showResultsAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                            }`}
                            style={{ transitionDelay: showResultsAnimation ? `${(displayedProducts.length + 1) * 300}ms` : '0ms' }}
                        >
                          <Link
                            to={`/search?query=${encodeURIComponent(searchQuery)}`}
                            onClick={() => {
                              setSearchQuery('');
                              setShowSearchBar(false);
                            }}
                            className={`block w-full text-center text-sm tracking-widest py-2 border-2 transition-all ${
                              isHomePage 
                                ? 'border-white hover:bg-white hover:text-black' 
                                : 'border-black hover:bg-black hover:text-white'
                            }`}
                          >
                            VIEW ALL {filteredProducts.length} RESULTS
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <Link to="/cart" className="text-sm tracking-wide hover:opacity-70 transition-opacity relative flex items-center gap-2">
              <span className="hidden md:inline">CART</span>
              <ShoppingBag className="w-5 h-5 md:hidden" />
              {cartItemCount > 0 && (
                <span className="text-xs">
                  ({cartItemCount})
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <nav className={`md:hidden py-4 border-t ${mobileMenuBorderClass}`}>
            <div className="flex flex-col gap-4">
              <Link 
                to="/shop" 
                className="text-sm tracking-wide hover:opacity-70 transition-opacity"
                onClick={() => setShowMobileMenu(false)}
              >
                NEW
              </Link>
              <Link 
                to="/shop" 
                className="text-sm tracking-wide hover:opacity-70 transition-opacity"
                onClick={() => setShowMobileMenu(false)}
              >
                COLLECTION
              </Link>
              <Link 
                to="/account" 
                className="text-sm tracking-wide hover:opacity-70 transition-opacity"
                onClick={() => setShowMobileMenu(false)}
              >
                LOGIN
              </Link>
              <button
                onClick={() => {
                  onSearchClick();
                  setShowMobileMenu(false);
                }}
                className="text-sm tracking-wide hover:opacity-70 transition-opacity text-left"
              >
                SEARCH
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}