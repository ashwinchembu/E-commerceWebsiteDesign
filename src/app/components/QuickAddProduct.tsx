import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface QuickAddProductProps {
  id: number;
  name: string;
  price: string;
  priceNumber: number;
  image: string;
  onAddToCart?: (size: string) => void;
}

export function QuickAddProduct({ id, name, price, priceNumber, image, onAddToCart }: QuickAddProductProps) {
  const [isHovered, setIsHovered] = useState(false);
  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  const handleSizeClick = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(size);
    }
  };

  return (
    <Link 
      to={`/product/${id}`}
      className="group cursor-pointer bg-black relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative overflow-hidden aspect-[3/4]">
        <ImageWithFallback
          src={image}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute top-4 right-4 bg-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <Heart className="w-5 h-5 text-black" />
        </button>

        {/* Quick Add Size Selector */}
        {isHovered && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-4 transform transition-transform duration-300">
            <p className="text-xs text-black mb-2 text-center tracking-wide">SELECT SIZE</p>
            <div className="grid grid-cols-5 gap-2">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={(e) => handleSizeClick(e, size)}
                  className="border border-black text-black py-2 text-xs hover:bg-black hover:text-white transition-colors cursor-pointer"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="tracking-wide mb-2 text-white">{name}</h3>
        <p className="text-sm text-gray-400">{price}</p>
      </div>
    </Link>
  );
}
