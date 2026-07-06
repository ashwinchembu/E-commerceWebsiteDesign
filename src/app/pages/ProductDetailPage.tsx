import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Heart, Truck, RotateCcw, Shield } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { products } from '../data/products';
import { CartItem } from '../App';
import { toast } from 'sonner@2.0.3';

interface ProductDetailPageProps {
  onAddToCart: (item: Omit<CartItem, 'quantity'>) => void;
  wishlist: { id: number; name: string; price: number; image: string }[];
  onToggleWishlist: (item: { id: number; name: string; price: number; image: string }) => { requiresLogin: boolean } | void;
}

export function ProductDetailPage({ onAddToCart, wishlist, onToggleWishlist }: ProductDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = products.find(p => p.id === Number(id));

  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [showSizeError, setShowSizeError] = useState(false);

  const isInWishlist = wishlist.some(item => item.id === Number(id));

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl tracking-wide mb-4">Product Not Found</h2>
          <Link to="/shop" className="text-sm tracking-wide underline">
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!selectedSize) {
      setShowSizeError(true);
      return;
    }

    onAddToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      size: selectedSize
    });

    toast.success('Added to cart!');
    navigate('/cart');
  };

  const handleWishlistToggle = () => {
    if (isInWishlist) {
      onToggleWishlist({ id: product.id, name: product.name, price: product.price, image: product.image });
      toast.success('Removed from wishlist');
    } else {
      const result = onToggleWishlist({ id: product.id, name: product.name, price: product.price, image: product.image });
      if (result && result.requiresLogin) {
        toast.error('Please log in to add to wishlist');
      } else {
        toast.success('Added to wishlist!');
      }
    }
  };

  return (
    <div className="min-h-screen bg-white py-12">
      <div className="container mx-auto px-6">
        {/* Breadcrumb */}
        <div className="mb-8 text-sm text-gray-600">
          <Link to="/" className="hover:text-black">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/shop" className="hover:text-black">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-black">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Images */}
          <div>
            <div className="aspect-[3/4] bg-gray-100 mb-4">
              <ImageWithFallback
                src={product.images[selectedImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square bg-gray-100 ${
                    selectedImage === index ? 'ring-2 ring-black' : ''
                  }`}
                >
                  <ImageWithFallback
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div>
            <h1 className="text-3xl tracking-wide mb-2">{product.name}</h1>
            <p className="text-2xl mb-6">${product.price}</p>

            <p className="text-gray-600 mb-8 leading-relaxed">{product.description}</p>

            {/* Size Selection */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm tracking-wide">SELECT SIZE</label>
                <button className="text-sm underline">Size Guide</button>
              </div>
              <div className="grid grid-cols-6 gap-3">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setSelectedSize(size);
                      setShowSizeError(false);
                    }}
                    className={`border py-3 text-sm tracking-wide transition-all ${
                      selectedSize === size
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 hover:border-black'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {showSizeError && (
                <p className="text-red-600 text-sm mt-2">Please select a size</p>
              )}
            </div>

            {/* Add to Cart */}
            <div className="space-y-3 mb-8">
              <button
                onClick={handleAddToCart}
                className="w-full bg-black text-white py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm"
              >
                ADD TO CART
              </button>
              <button
                onClick={handleWishlistToggle}
                className="w-full border border-black py-4 hover:bg-gray-50 transition-colors tracking-widest text-sm flex items-center justify-center gap-2"
              >
                <Heart className="w-5 h-5" />
                {isInWishlist ? 'REMOVE FROM WISHLIST' : 'ADD TO WISHLIST'}
              </button>
            </div>

            {/* Features */}
            <div className="border-t border-gray-200 pt-8 space-y-4">
              <div className="flex items-start gap-4">
                <Truck className="w-5 h-5 mt-1" />
                <div>
                  <p className="text-sm tracking-wide mb-1">Free US Shipping</p>
                  <p className="text-xs text-gray-600">On orders over $200</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <RotateCcw className="w-5 h-5 mt-1" />
                <div>
                  <p className="text-sm tracking-wide mb-1">Easy Returns</p>
                  <p className="text-xs text-gray-600">30-day return policy</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Shield className="w-6 h-6 flex-shrink-0" />
                <div>
                  <p className="text-sm tracking-wide mb-1">Authentic Products</p>
                  <p className="text-xs text-gray-600">Premium quality assurance</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        <div className="mt-20">
          <h2 className="text-2xl tracking-wide mb-8 text-center">YOU MAY ALSO LIKE</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {products
              .filter(p => p.id !== product.id && p.category === product.category)
              .slice(0, 4)
              .map((relatedProduct) => (
                <Link
                  key={relatedProduct.id}
                  to={`/product/${relatedProduct.id}`}
                  className="group"
                >
                  <div className="aspect-[3/4] bg-gray-100 mb-4 overflow-hidden">
                    <ImageWithFallback
                      src={relatedProduct.image}
                      alt={relatedProduct.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <h3 className="tracking-wide mb-2">{relatedProduct.name}</h3>
                  <p className="text-sm text-gray-600">${relatedProduct.price}</p>
                </Link>
              ))}
          </div>
          
          {/* More Button */}
          <div className="text-center mt-12">
            <Link
              to={`/shop?category=${product.category}`}
              className="inline-block border-2 border-black px-12 py-4 hover:bg-black hover:text-white transition-all tracking-widest text-sm"
            >
              VIEW MORE {product.category.toUpperCase()}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}