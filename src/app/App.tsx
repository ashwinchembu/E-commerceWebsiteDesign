import { lazy, Suspense, useState, useEffect } from 'react';
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
import { FeedbackPage } from './pages/FeedbackPage';
import { AccountPage } from './pages/AccountPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { DoNotSellPage } from './pages/DoNotSellPage';
import { JacketBuilderPage } from './pages/JacketBuilderPage';
import { SecurityWatermark } from './components/SecurityWatermark';
import { useShopifyCustomerAccount } from './hooks/useShopifyCustomerAccount';

const AdminAccessPage = lazy(() =>
  import('./pages/AdminAccessPage').then((module) => ({
    default: module.AdminAccessPage,
  })),
);
const PrivateAccessPage = lazy(() =>
  import('./pages/PrivateAccessPage').then((module) => ({
    default: module.PrivateAccessPage,
  })),
);

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

interface AccessIdentity {
  id: string;
  name: string;
  email: string;
  role: 'visitor' | 'footballer' | 'admin';
}

export default function App() {
  const privateAccessEnabled = import.meta.env.VITE_PRIVATE_ACCESS_ENABLED === 'true';
  const isAdminAccessRoute = window.location.pathname.startsWith('/admin/access');
  const isPrivateAccessRoute = window.location.pathname === '/access';
  const shopifyCustomerAccount = useShopifyCustomerAccount(
    !privateAccessEnabled && !isAdminAccessRoute && !isPrivateAccessRoute,
  );
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [accessIdentity, setAccessIdentity] = useState<AccessIdentity | null>(null);
  const [accessChecked, setAccessChecked] = useState(!privateAccessEnabled);

  useEffect(() => {
    if (!privateAccessEnabled || isAdminAccessRoute || isPrivateAccessRoute) return;
    let active = true;
    let unsubscribe = () => {};
    void Promise.all([import('firebase/auth'), import('./lib/firebase')])
      .then(async ([firebaseAuth, firebaseClient]) => {
        const { auth, persistenceReady } = firebaseClient.getFirebaseServices();
        await persistenceReady;
        if (!active) return;
        unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (user) => {
          if (!active) return;
          if (!user) {
            window.location.assign(
              `/access?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
            );
            return;
          }
          try {
            const { access } = await firebaseClient.callFirebaseFunction<
              Record<string, never>,
              { access: AccessIdentity }
            >('getAccessSession', {});
            if (!active) return;
            setAccessIdentity({
              id: access.id,
              name: access.name,
              email: access.email || '',
              role:
                access.role === 'footballer' || access.role === 'admin'
                  ? access.role
                  : 'visitor',
            });
            setAccessChecked(true);
          } catch {
            await firebaseAuth.signOut(auth);
            window.location.assign(
              `/access?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
            );
          }
        });
      })
      .catch(() => {
        window.location.assign(
          `/access?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isAdminAccessRoute, isPrivateAccessRoute, privateAccessEnabled]);

  useEffect(() => {
    if (
      window.location.pathname === '/jacket-builder' ||
      isAdminAccessRoute ||
      isPrivateAccessRoute
    ) {
      return;
    }

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
  }, [isAdminAccessRoute, isPrivateAccessRoute]);

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
    setWishlist((prevWishlist) => {
      const exists = prevWishlist.find((wishlistItem) => wishlistItem.id === item.id);
      if (exists) {
        return prevWishlist.filter((wishlistItem) => wishlistItem.id !== item.id);
      }
      return [...prevWishlist, item];
    });
    return { requiresLogin: false };
  };

  const handlePrivateAccessLogout = async () => {
    const [firebaseAuth, firebaseClient] = await Promise.all([
      import('firebase/auth'),
      import('./lib/firebase'),
    ]);
    await firebaseAuth.signOut(firebaseClient.getFirebaseServices().auth);
    window.location.assign('/access');
  };

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const jacketAccessRole =
    accessIdentity?.role ??
    (shopifyCustomerAccount.state.status === 'signed-in' &&
    shopifyCustomerAccount.state.customer.hasFootballerAccess
      ? 'footballer'
      : 'visitor');
  const shopifyAccessStatus =
    shopifyCustomerAccount.state.status === 'signed-in'
      ? shopifyCustomerAccount.state.customer.hasFootballerAccess
        ? 'eligible'
        : 'ineligible'
      : shopifyCustomerAccount.state.status;

  if (isAdminAccessRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <AdminAccessPage />
      </Suspense>
    );
  }

  if (isPrivateAccessRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <PrivateAccessPage />
      </Suspense>
    );
  }

  if (privateAccessEnabled && (!accessChecked || !accessIdentity)) {
    return <div className="min-h-screen bg-black" aria-label="Verifying private access" />;
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Header 
          cartItemCount={cartItemCount} 
          onSearchClick={() => setShowSearchModal(true)}
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
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route
              path="/account"
              element={
                <AccountPage
                  accountState={shopifyCustomerAccount.state}
                  configured={shopifyCustomerAccount.configured}
                  onRefresh={shopifyCustomerAccount.refresh}
                  onSignIn={shopifyCustomerAccount.signIn}
                  onSignOut={shopifyCustomerAccount.signOut}
                />
              }
            />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/do-not-sell" element={<DoNotSellPage />} />
            <Route
              path="/jacket-builder"
              element={
                <JacketBuilderPage
                  accessRole={jacketAccessRole}
                  onShopifySignIn={() => void shopifyCustomerAccount.signIn('/jacket-builder')}
                  shopifyAccessStatus={shopifyAccessStatus}
                />
              }
            />
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

        {accessIdentity && (
          <SecurityWatermark
            name={accessIdentity.name}
            email={accessIdentity.email}
            accessId={accessIdentity.id}
            onLogout={handlePrivateAccessLogout}
          />
        )}

        <Toaster position="bottom-right" />

        <ScrollToTop />
      </div>
    </Router>
  );
}
