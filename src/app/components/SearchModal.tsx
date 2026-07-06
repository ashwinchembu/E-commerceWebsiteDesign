import { X, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { products } from '../data/products';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Reset search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setShowResults(false);
    }
  }, [isOpen]);

  // Trigger animation when search query changes
  useEffect(() => {
    setShowResults(false);
    const timer = setTimeout(() => setShowResults(true), 50);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const filteredProducts = searchQuery.trim()
    ? products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Limit to first 6 results in modal
  const displayedProducts = filteredProducts.slice(0, 6);
  const hasMoreResults = filteredProducts.length > 6;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div className="bg-white w-full max-w-2xl mx-4 rounded-sm shadow-xl">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl tracking-wide font-light text-left">SEARCH</h2>
            <button
              onClick={onClose}
              className="hover:opacity-70 transition-opacity cursor-pointer"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors text-sm text-left"
              autoFocus
            />
          </div>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {searchQuery.trim() === '' ? (
            <p className="text-gray-500 text-sm text-left py-8">
              Start typing to search for products
            </p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-gray-500 text-sm text-left py-8">
              No products found for "{searchQuery}"
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {displayedProducts.map((product, index) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    onClick={onClose}
                    className={`flex items-center gap-4 hover:bg-gray-50 p-2 transition-all duration-400 ${
                      showResults ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    }`}
                    style={{ transitionDelay: showResults ? `${index * 100}ms` : '0ms' }}
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
              
              {/* View All Results Button */}
              {hasMoreResults && (
                <div 
                  className={`mt-6 pt-6 border-t border-gray-200 transition-all duration-400 ${
                    showResults ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                  }`}
                  style={{ transitionDelay: showResults ? `${displayedProducts.length * 100}ms` : '0ms' }}
                >
                  <Link
                    to={`/shop?search=${encodeURIComponent(searchQuery)}`}
                    onClick={onClose}
                    className="block w-full text-center border-2 border-black px-8 py-3 hover:bg-black hover:text-white transition-all tracking-widest text-sm"
                  >
                    VIEW ALL {filteredProducts.length} RESULTS
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}