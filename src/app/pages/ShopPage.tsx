import { useState, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShopProductCard } from '../components/ShopProductCard';
import { products } from '../data/products';

interface ShopPageProps {
  onAddToCart: (item: { id: number; name: string; price: number; image: string; size: string }) => void;
  wishlist: { id: number; name: string; price: number; image: string }[];
  onToggleWishlist: (item: { id: number; name: string; price: number; image: string }) => { requiresLogin: boolean } | void;
}

export function ShopPage({ onAddToCart, wishlist, onToggleWishlist }: ShopPageProps) {
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);

  const categories = ['All', 'Jackets', 'Hoodies', 'Pants', 'Upcycled Kits', 'Footwear', 'Accessories'];

  // Handle URL parameters for search and category
  useEffect(() => {
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    if (category) {
      // Handle URL formats like "upcycled-kits" -> "Upcycled Kits"
      const formattedCategory = category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      setSelectedCategory(formattedCategory);
    }
  }, [searchParams]);

  const searchQuery = searchParams.get('search') || '';

  // Filter by category and search
  let filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category.toLowerCase() === selectedCategory.toLowerCase());

  // Apply search filter if search query exists
  if (searchQuery) {
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white py-20 text-center">
        <h1 className="text-5xl tracking-widest mb-4 font-light">SHOP</h1>
        <p className="text-sm tracking-wide opacity-80">Discover our full collection</p>
        <Link
          to="/jacket-builder"
          className="mt-7 inline-flex min-h-12 items-center justify-center border border-white px-6 py-3 text-xs tracking-widest transition-colors hover:bg-white hover:text-black sm:px-9"
        >
          DESIGN YOUR CUSTOM JACKET
        </Link>
      </div>

      <div className="container mx-auto px-6 py-12">
        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-6 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm tracking-wide hover:opacity-70 transition-opacity md:hidden"
          >
            <SlidersHorizontal className="w-4 h-4" />
            FILTERS
          </button>

          {/* Categories */}
          <div className={`${showFilters ? 'flex' : 'hidden md:flex'} flex-wrap gap-4`}>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`text-sm tracking-wide transition-all ${
                  selectedCategory === category
                    ? 'border-b-2 border-black pb-1'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                {category.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{sortedProducts.length} items</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-sm border border-gray-300 px-4 py-2 focus:outline-none focus:border-black"
            >
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A-Z</option>
            </select>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {sortedProducts.map((product) => (
            <ShopProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
              image={product.image}
              images={product.images}
              sizes={product.sizes}
              inStock={product.inStock}
              onAddToCart={onAddToCart}
              wishlist={wishlist}
              onToggleWishlist={onToggleWishlist}
            />
          ))}
        </div>

        {sortedProducts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 tracking-wide">No products found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
