import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { products } from '../data/products';
import { Heart } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface SearchResultsPageProps {
  wishlist: { id: number; name: string; price: number; image: string }[];
  onToggleWishlist: (item: { id: number; name: string; price: number; image: string }) => { requiresLogin: boolean } | void;
  onAddToCart: (item: { id: number; name: string; price: number; image: string; size: string }) => void;
}

export function SearchResultsPage({ wishlist, onToggleWishlist, onAddToCart }: SearchResultsPageProps) {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const [hoveredProduct, setHoveredProduct] = useState<number | null>(null);
  const [scrollPositions, setScrollPositions] = useState<{ [key: number]: number }>({});
  const [showQuickAdd, setShowQuickAdd] = useState<number | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<{ [key: number]: string }>({});

  const filteredProducts = query.trim()
    ? products.filter(
        (product) =>
          product.name.toLowerCase().includes(query.toLowerCase()) ||
          product.category.toLowerCase().includes(query.toLowerCase()) ||
          product.description.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    const intervals: { [key: number]: NodeJS.Timeout } = {};

    if (hoveredProduct !== null) {
      const product = products.find((p) => p.id === hoveredProduct);
      if (product && product.images.length > 1) {
        intervals[hoveredProduct] = setInterval(() => {
          setScrollPositions((prev) => {
            const currentPos = prev[hoveredProduct] || 0;
            const nextPos = (currentPos + 1) % product.images.length;
            return { ...prev, [hoveredProduct]: nextPos };
          });
        }, 1000);
      }
    }

    return () => {
      Object.values(intervals).forEach((interval) => clearInterval(interval));
    };
  }, [hoveredProduct]);

  const handleMouseEnter = (productId: number) => {
    setHoveredProduct(productId);
    setScrollPositions((prev) => ({ ...prev, [productId]: 0 }));
    setShowQuickAdd(productId);
  };

  const handleMouseLeave = (productId: number) => {
    setHoveredProduct(null);
    setScrollPositions((prev) => ({ ...prev, [productId]: 0 }));
    setShowQuickAdd(null);
  };

  const isInWishlist = (productId: number) => {
    return wishlist.some((item) => item.id === productId);
  };

  const handleQuickAdd = (e: React.MouseEvent, product: { id: number; name: string; price: number; images: string[] }, size: string) => {
    e.preventDefault();
    onAddToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
      size: size,
    });
    toast.success(`Added ${product.name} (${size}) to cart`);
  };

  const handleSizeSelect = (productId: number, size: string) => {
    setSelectedSizes((prev) => ({ ...prev, [productId]: size }));
  };

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="container mx-auto px-6">
        {/* Search Results Header */}
        <div className="mb-8">
          <h1 className="text-3xl tracking-wider mb-2">SEARCH RESULTS</h1>
          <p className="text-gray-600 text-sm">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'} for "{query}"
          </p>
        </div>

        {/* Results Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-4">No products found for "{query}"</p>
            <Link 
              to="/shop" 
              className="inline-block border-2 border-black px-8 py-3 hover:bg-black hover:text-white transition-all tracking-widest text-sm"
            >
              CONTINUE SHOPPING
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredProducts.map((product) => {
              const currentImageIndex = scrollPositions[product.id] || 0;
              const isWishlisted = isInWishlist(product.id);
              const currentImage = product.images.length > 1 ? product.images[currentImageIndex] : product.images[0];

              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group cursor-pointer block"
                  onMouseEnter={() => handleMouseEnter(product.id)}
                  onMouseLeave={() => handleMouseLeave(product.id)}
                >
                  <div className="relative overflow-hidden aspect-[3/4] bg-gray-100 mb-4">
                    <ImageWithFallback
                      src={currentImage}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Heart Icon */}
                    <button 
                      className={`absolute top-4 right-4 bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                        isWishlisted ? '!opacity-100' : ''
                      }`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const result = onToggleWishlist({
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          image: product.images[0],
                        });
                        if (result && result.requiresLogin) {
                          toast.error('Please log in to add items to your wishlist', {
                            action: {
                              label: 'Login',
                              onClick: () => window.location.href = '/account'
                            }
                          });
                        } else if (isWishlisted) {
                          toast.success('Removed from wishlist');
                        } else {
                          toast.success('Added to wishlist');
                        }
                      }}
                    >
                      <Heart className={`w-5 h-5 transition-colors ${
                        isWishlisted ? 'fill-red-500 text-red-500' : ''
                      }`} />
                    </button>

                    {/* Quick Add Size Buttons */}
                    {product.inStock && showQuickAdd === product.id && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm p-4 transform translate-y-0 transition-all duration-300">
                        <p className="text-xs tracking-wide mb-3 text-center text-white">SELECT SIZE</p>
                        <div className="grid grid-cols-3 gap-2">
                          {product.sizes.map((size) => (
                            <button
                              key={size}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onAddToCart({
                                  id: product.id,
                                  name: product.name,
                                  price: product.price,
                                  image: product.images[0],
                                  size: size,
                                });
                                toast.success(`Added ${product.name} (${size}) to cart`);
                              }}
                              className="border border-white/60 bg-transparent py-2 text-xs tracking-wide text-white hover:bg-white hover:text-black transition-all"
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sold Out Overlay */}
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white text-sm tracking-widest">SOLD OUT</span>
                      </div>
                    )}

                    {/* Image Indicators */}
                    {product.images.length > 1 && hoveredProduct === product.id && (
                      <div className="absolute top-4 left-4 flex gap-1">
                        {product.images.map((_, index) => (
                          <div
                            key={index}
                            className={`h-1 w-6 rounded-full transition-all ${
                              index === currentImageIndex ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <h3 className="tracking-wide mb-2 group-hover:opacity-70 transition-opacity">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-600">${product.price}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}