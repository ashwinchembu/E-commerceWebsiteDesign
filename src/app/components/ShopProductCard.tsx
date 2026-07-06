import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';

interface ShopProductCardProps {
  id: number;
  name: string;
  price: number;
  image: string;
  images: string[];
  sizes: string[];
  inStock: boolean;
  onAddToCart: (item: { id: number; name: string; price: number; image: string; size: string }) => void;
  wishlist: { id: number; name: string; price: number; image: string }[];
  onToggleWishlist: (item: { id: number; name: string; price: number; image: string }) => { requiresLogin: boolean } | void;
}

export function ShopProductCard({ 
  id, 
  name, 
  price, 
  image, 
  images, 
  sizes,
  inStock,
  onAddToCart,
  wishlist,
  onToggleWishlist
}: ShopProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('M');

  const isInWishlist = wishlist.some(item => item.id === id);

  // Auto-scroll through images on hover
  useEffect(() => {
    if (!isHovered || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isHovered, images.length]);

  // Reset to first image when not hovering
  useEffect(() => {
    if (!isHovered) {
      setCurrentImageIndex(0);
    }
  }, [isHovered]);

  const handleQuickAdd = (size: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toast.success(`Added ${name} (${size}) to cart`);
    if (onAddToCart) {
      onAddToCart({ id, name, price, image, size });
    }
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = onToggleWishlist({ id, name, price, image });
    if (result && result.requiresLogin) {
      toast.error('Please log in to add items to your wishlist', {
        action: {
          label: 'Login',
          onClick: () => window.location.href = '/account'
        }
      });
    } else if (isInWishlist) {
      toast.success('Removed from wishlist');
    } else {
      toast.success('Added to wishlist');
    }
  };

  const currentImage = images.length > 1 ? images[currentImageIndex] : image;

  return (
    <Link
      to={`/product/${id}`}
      className="group cursor-pointer block"
      onMouseEnter={() => {
        setIsHovered(true);
        setShowQuickAdd(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowQuickAdd(false);
      }}
    >
      <div className="relative overflow-hidden aspect-[3/4] bg-gray-100 mb-4">
        <ImageWithFallback
          src={currentImage}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Heart Icon */}
        <button 
          className={`absolute top-4 right-4 bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
            isInWishlist ? '!opacity-100' : ''
          }`}
          onClick={handleToggleWishlist}
        >
          <Heart className={`w-5 h-5 transition-colors ${
            isInWishlist ? 'fill-red-500 text-red-500' : ''
          }`} />
        </button>

        {/* Quick Add Size Buttons */}
        {inStock && showQuickAdd && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm p-4 transform translate-y-0 transition-all duration-300">
            <p className="text-xs tracking-wide mb-3 text-center text-white">SELECT SIZE</p>
            <div className="grid grid-cols-3 gap-2">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={(e) => handleQuickAdd(size, e)}
                  className="border border-white/60 bg-transparent py-2 text-xs tracking-wide text-white hover:bg-white hover:text-black transition-all"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sold Out Overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-sm tracking-widest">SOLD OUT</span>
          </div>
        )}

        {/* Image Indicators */}
        {images.length > 1 && isHovered && (
          <div className="absolute top-4 left-4 flex gap-1">
            {images.map((_, index) => (
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
        {name}
      </h3>
      <p className="text-sm text-gray-600">${price}</p>
    </Link>
  );
}