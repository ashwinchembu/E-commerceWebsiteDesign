import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Toaster } from 'sonner';
import { CookieConsent } from './components/CookieConsent';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { NewsletterModal } from './components/NewsletterModal';
import { ScrollToTop } from './components/ScrollToTop';
import { SecurityWatermark } from './components/SecurityWatermark';
import { useShopifyCustomerAccount } from './hooks/useShopifyCustomerAccount';
import { HomePage } from './pages/HomePage';

const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((module) => ({ default: module.AboutPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })),
);
const AdminAccessPage = lazy(() =>
  import('./pages/AdminAccessPage').then((module) => ({
    default: module.AdminAccessPage,
  })),
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((module) => ({ default: module.ContactPage })),
);
const DoNotSellPage = lazy(() =>
  import('./pages/DoNotSellPage').then((module) => ({
    default: module.DoNotSellPage,
  })),
);
const FeedbackPage = lazy(() =>
  import('./pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })),
);
const JacketBuilderPage = lazy(() =>
  import('./pages/JacketBuilderPage').then((module) => ({
    default: module.JacketBuilderPage,
  })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({
    default: module.NotFoundPage,
  })),
);
const PrivacyPolicyPage = lazy(() =>
  import('./pages/PrivacyPolicyPage').then((module) => ({
    default: module.PrivacyPolicyPage,
  })),
);
const PrivateAccessPage = lazy(() =>
  import('./pages/PrivateAccessPage').then((module) => ({
    default: module.PrivateAccessPage,
  })),
);
const TermsPage = lazy(() =>
  import('./pages/TermsPage').then((module) => ({ default: module.TermsPage })),
);

interface AccessIdentity {
  id: string;
  name: string;
  email: string;
  role: 'visitor' | 'footballer' | 'admin';
}

const pageTitles: Record<string, string> = {
  '/': 'Manoir Kits | Custom Football Heritage Jackets',
  '/about': 'About | Manoir Kits',
  '/account': 'Account | Manoir Kits',
  '/contact': 'Contact | Manoir Kits',
  '/do-not-sell': 'Privacy Choices | Manoir Kits',
  '/feedback': 'Feedback | Manoir Kits',
  '/jacket-builder': 'Design Your Custom Jacket | Manoir Kits',
  '/privacy-policy': 'Privacy Policy | Manoir Kits',
  '/terms': 'Terms and Conditions | Manoir Kits',
};

function RouteMetadata() {
  const location = useLocation();

  useEffect(() => {
    document.title = pageTitles[location.pathname] || 'Page Not Found | Manoir Kits';
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (robots) {
      robots.content =
        import.meta.env.VITE_PUBLIC_INDEXING_ENABLED === 'true'
          ? 'index, follow'
          : 'noindex, nofollow';
    }
  }, [location.pathname]);

  return null;
}

function StorefrontRoutes({
  account,
  accessIdentity,
}: {
  account: ReturnType<typeof useShopifyCustomerAccount>;
  accessIdentity: AccessIdentity | null;
}) {
  const jacketAccessRole =
    accessIdentity?.role ??
    (account.state.status === 'signed-in' && account.state.customer.hasFootballerAccess
      ? 'footballer'
      : 'visitor');
  const shopifyAccessStatus =
    account.state.status === 'signed-in'
      ? account.state.customer.hasFootballerAccess
        ? 'eligible'
        : 'ineligible'
      : account.state.status;

  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route
        element={
          <AccountPage
            accountState={account.state}
            configured={account.configured}
            onRefresh={account.refresh}
            onSignIn={account.signIn}
            onSignOut={account.signOut}
          />
        }
        path="/account"
      />
      <Route element={<AboutPage />} path="/about" />
      <Route element={<ContactPage />} path="/contact" />
      <Route element={<FeedbackPage />} path="/feedback" />
      <Route element={<PrivacyPolicyPage />} path="/privacy-policy" />
      <Route element={<TermsPage />} path="/terms" />
      <Route element={<DoNotSellPage />} path="/do-not-sell" />
      <Route
        element={
          <JacketBuilderPage
            accessRole={jacketAccessRole}
            onShopifySignIn={() => void account.signIn('/jacket-builder')}
            shopifyAccessStatus={shopifyAccessStatus}
          />
        }
        path="/jacket-builder"
      />

      {/* The old catalog was prototype data. All real purchasing now starts in
          the Shopify-backed jacket builder. */}
      <Route element={<Navigate replace to="/jacket-builder" />} path="/shop" />
      <Route element={<Navigate replace to="/jacket-builder" />} path="/product/*" />
      <Route element={<Navigate replace to="/jacket-builder" />} path="/search" />
      <Route element={<Navigate replace to="/jacket-builder" />} path="/cart" />
      <Route element={<Navigate replace to="/jacket-builder" />} path="/checkout" />

      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

export default function App() {
  const privateAccessEnabled = import.meta.env.VITE_PRIVATE_ACCESS_ENABLED === 'true';
  const isAdminAccessRoute = window.location.pathname.startsWith('/admin/access');
  const isPrivateAccessRoute = window.location.pathname === '/access';
  const shopifyCustomerAccount = useShopifyCustomerAccount(
    !privateAccessEnabled && !isAdminAccessRoute && !isPrivateAccessRoute,
  );
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
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
      isPrivateAccessRoute ||
      localStorage.getItem('newsletterShown')
    ) {
      return;
    }

    let timer = 0;
    const scheduleNewsletter = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowNewsletterModal(true), 20_000);
    };

    if (localStorage.getItem('cookieConsent')) {
      scheduleNewsletter();
    } else {
      window.addEventListener('manoir:cookie-consent', scheduleNewsletter, {
        once: true,
      });
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('manoir:cookie-consent', scheduleNewsletter);
    };
  }, [isAdminAccessRoute, isPrivateAccessRoute]);

  const handleNewsletterClose = () => {
    setShowNewsletterModal(false);
    localStorage.setItem('newsletterShown', 'true');
  };

  const handlePrivateAccessLogout = async () => {
    const [firebaseAuth, firebaseClient] = await Promise.all([
      import('firebase/auth'),
      import('./lib/firebase'),
    ]);
    await firebaseAuth.signOut(firebaseClient.getFirebaseServices().auth);
    window.location.assign('/access');
  };

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
    return <div aria-label="Verifying private access" className="min-h-screen bg-black" />;
  }

  return (
    <Router>
      <RouteMetadata />
      <div className="flex min-h-screen flex-col">
        <Header />

        <main className="flex-1">
          <Suspense fallback={<div className="min-h-[60vh] bg-white" />}>
            <StorefrontRoutes
              accessIdentity={accessIdentity}
              account={shopifyCustomerAccount}
            />
          </Suspense>
        </main>

        <Footer />

        <NewsletterModal isOpen={showNewsletterModal} onClose={handleNewsletterClose} />
        <CookieConsent />

        {accessIdentity ? (
          <SecurityWatermark
            accessId={accessIdentity.id}
            email={accessIdentity.email}
            name={accessIdentity.name}
            onLogout={handlePrivateAccessLogout}
          />
        ) : null}

        <Toaster position="bottom-right" />
        <ScrollToTop />
      </div>
    </Router>
  );
}
