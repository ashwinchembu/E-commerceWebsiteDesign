import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from './components/Header';
import { NewsletterModal } from './components/NewsletterModal';
import { SearchModal } from './components/SearchModal';
import { CookieConsent } from './components/CookieConsent';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { AccountPage } from './pages/AccountPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { DoNotSellPage } from './pages/DoNotSellPage';
import { JacketBuilderPage } from './pages/JacketBuilderPage';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  size: string;
  quantity: number;
}

export interface WishlistItem {
  id: number;
  name: string;
  price: number;
  image: string;
}

export interface User {
  email: string;
  name: string;
  isAdmin: boolean;
  isFootballer?: boolean;
}

export default function App() {
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (window.location.pathname === '/jacket-builder') return;

    // Check if newsletter has been shown before
    const newsletterShown = localStorage.getItem('newsletterShown');

    // Show newsletter modal only if it hasn't been shown before
    if (!newsletterShown) {
      const newsletterTimer = setTimeout(() => {
        setShowNewsletterModal(true);
      }, 3000);
      
      return () => {
        clearTimeout(newsletterTimer);
      };
    }
  }, []);

  const handleNewsletterClose = () => {
    setShowNewsletterModal(false);
    localStorage.setItem('newsletterShown', 'true');
  };

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(
        (cartItem) => cartItem.id === item.id && cartItem.size === item.size
      );
      if (existingItem) {
        return prevCart.map((cartItem) =>
          cartItem.id === item.id && cartItem.size === item.size
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number, size: string) => {
    setCart((prevCart) => prevCart.filter((item) => !(item.id === id && item.size === size)));
  };

  const updateCartQuantity = (id: number, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id, size);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id && item.size === size ? { ...item, quantity } : item
      )
    );
  };

  const toggleWishlist = (item: WishlistItem) => {
    // Check if user is logged in
    if (!user) {
      // Redirect to login page if not logged in
      return { requiresLogin: true };
    }
    
    setWishlist((prevWishlist) => {
      const exists = prevWishlist.find((wishlistItem) => wishlistItem.id === item.id);
      if (exists) {
        return prevWishlist.filter((wishlistItem) => wishlistItem.id !== item.id);
      }
      return [...prevWishlist, item];
    });
    return { requiresLogin: false };
  };

  const handleLogin = (email: string, password: string) => {
    // Test credentials
    if (email === 'user@test.com' && password === 'user123') {
      setUser({ email, name: 'John', isAdmin: false });
      return true;
    }
    if (email === 'admin@manoir.com' && password === 'admin123') {
      setUser({ email, name: 'Admin', isAdmin: true });
      return true;
    }
    if (email === 'footballers@manoir.com' && password === 'footballers123') {
      setUser({ email, name: 'Footballer', isAdmin: false, isFootballer: true });
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setUser(null);
  };

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header 
          cartItemCount={cartItemCount} 
          onSearchClick={() => setShowSearchModal(true)}
          user={user}
        />
        
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route 
              path="/shop" 
              element={
                <ShopPage 
                  onAddToCart={addToCart}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                />
              } 
            />
            <Route 
              path="/product/:id" 
              element={
                <ProductDetailPage 
                  onAddToCart={addToCart}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                />
              } 
            />
            <Route 
              path="/search" 
              element={
                <SearchResultsPage 
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                  onAddToCart={addToCart}
                />
              } 
            />
            <Route 
              path="/cart" 
              element={
                <CartPage 
                  cart={cart}
                  onUpdateQuantity={updateCartQuantity}
                  onRemove={removeFromCart}
                />
              } 
            />
            <Route path="/checkout" element={<CheckoutPage cart={cart} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route 
              path="/account" 
              element={
                <AccountPage 
                  user={user}
                  onLogin={handleLogin}
                  onLogout={handleLogout}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                />
              } 
            />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/do-not-sell" element={<DoNotSellPage />} />
            <Route path="/jacket-builder" element={<JacketBuilderPage user={user} />} />
          </Routes>
        </main>

        <Footer />

        <NewsletterModal 
          isOpen={showNewsletterModal}
          onClose={handleNewsletterClose}
        />

        <SearchModal 
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
        />

        <CookieConsent />

        <Toaster position="bottom-right" />

        <ScrollToTop />
      </div>
    </Router>
  );
}
