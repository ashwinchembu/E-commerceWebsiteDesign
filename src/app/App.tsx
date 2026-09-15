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
import {
  NEWSLETTER_SUBSCRIBED_EVENT,
  shouldShowNewsletterOffer,
  snoozeNewsletterOffer,
} from './lib/newsletterPreferences';
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
const StudioAccessPage = lazy(() =>
  import('./pages/StudioAccessPage').then((module) => ({
    default: module.StudioAccessPage,
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

interface StudioIdentity {
  name: string;
  email: string;
}

const pageTitles: Record<string, string> = {
  '/': 'Manoir Kits | Custom Football Heritage Jackets',
  '/about': 'About | Manoir Kits',
  '/account': 'Account | Manoir Kits',
  '/contact': 'Contact | Manoir Kits',
  '/do-not-sell': 'Privacy Choices | Manoir Kits',
  '/feedback': 'Feedback | Manoir Kits',
  '/jacket-builder': 'Design Your Custom Jacket | Manoir Kits',
  '/studio': 'Private Jacket Studio | Manoir Kits',
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
  studioIdentity,
}: {
  account: ReturnType<typeof useShopifyCustomerAccount>;
  studioIdentity: StudioIdentity | null;
}) {
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
        element={<JacketBuilderPage />}
        path="/jacket-builder"
      />
      <Route
        element={
          studioIdentity ? (
            <JacketBuilderPage operatorName={studioIdentity.name} studioMode />
          ) : (
            <Navigate replace to="/jacket-builder" />
          )
        }
        path="/studio"
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
  const isStudioAccessRoute = window.location.pathname === '/studio-access';
  const isStudioRoute = window.location.pathname === '/studio';
  const requiresAccessSession =
    privateAccessEnabled && !isStudioRoute && !isStudioAccessRoute;
  const shopifyCustomerAccount = useShopifyCustomerAccount(
    !privateAccessEnabled &&
      !isAdminAccessRoute &&
      !isPrivateAccessRoute &&
      !isStudioAccessRoute &&
      !isStudioRoute,
  );
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [accessIdentity, setAccessIdentity] = useState<AccessIdentity | null>(null);
  const [accessChecked, setAccessChecked] = useState(!requiresAccessSession);
  const [studioIdentity, setStudioIdentity] = useState<StudioIdentity | null>(null);
  const [studioChecked, setStudioChecked] = useState(!isStudioRoute);

  useEffect(() => {
    if (!requiresAccessSession || isAdminAccessRoute || isPrivateAccessRoute) return;
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
  }, [isAdminAccessRoute, isPrivateAccessRoute, requiresAccessSession]);

  useEffect(() => {
    if (!isStudioRoute) return;
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
            window.location.assign('/studio-access');
            return;
          }
          try {
            const { studio } = await firebaseClient.callFirebaseFunction<
              Record<string, never>,
              { studio: StudioIdentity }
            >('getStudioSession', {});
            if (!active) return;
            setStudioIdentity({
              email: studio.email,
              name: studio.name,
            });
            setStudioChecked(true);
          } catch {
            await firebaseAuth.signOut(auth);
            window.location.assign('/studio-access');
          }
        });
      })
      .catch(() => {
        window.location.assign('/studio-access');
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isStudioRoute]);

  useEffect(() => {
    if (
      window.location.pathname === '/jacket-builder' ||
      window.location.pathname === '/studio' ||
      isAdminAccessRoute ||
      isPrivateAccessRoute ||
      isStudioAccessRoute ||
      !shouldShowNewsletterOffer()
    ) {
      return;
    }

    let timer = 0;
    const scheduleNewsletter = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (shouldShowNewsletterOffer()) {
          setShowNewsletterModal(true);
        }
      }, 1_500);
    };
    const closeNewsletter = () => setShowNewsletterModal(false);

    if (localStorage.getItem('cookieConsent')) {
      scheduleNewsletter();
    } else {
      window.addEventListener('manoir:cookie-consent', scheduleNewsletter, {
        once: true,
      });
    }
    window.addEventListener(NEWSLETTER_SUBSCRIBED_EVENT, closeNewsletter);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('manoir:cookie-consent', scheduleNewsletter);
      window.removeEventListener(NEWSLETTER_SUBSCRIBED_EVENT, closeNewsletter);
    };
  }, [isAdminAccessRoute, isPrivateAccessRoute, isStudioAccessRoute]);

  const handleNewsletterClose = () => {
    setShowNewsletterModal(false);
    snoozeNewsletterOffer();
  };

  const handlePrivateAccessLogout = async () => {
    const [firebaseAuth, firebaseClient] = await Promise.all([
      import('firebase/auth'),
      import('./lib/firebase'),
    ]);
    await firebaseAuth.signOut(firebaseClient.getFirebaseServices().auth);
    window.location.assign('/access');
  };

  const handleStudioLogout = async () => {
    const [firebaseAuth, firebaseClient] = await Promise.all([
      import('firebase/auth'),
      import('./lib/firebase'),
    ]);
    await firebaseAuth.signOut(firebaseClient.getFirebaseServices().auth);
    window.location.assign('/studio-access');
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


  if (isStudioAccessRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <StudioAccessPage />
      </Suspense>
    );
  }

  if (requiresAccessSession && (!accessChecked || !accessIdentity)) {
    return <div aria-label="Verifying private access" className="min-h-screen bg-black" />;
  }


  if (isStudioRoute && (!studioChecked || !studioIdentity)) {
    return <div aria-label="Verifying Studio access" className="min-h-screen bg-black" />;
  }

  return (
    <Router>
      <RouteMetadata />
      <div className="flex min-h-screen flex-col">
        <Header showStudio={Boolean(studioIdentity)} />

        <main className="flex-1">
          <Suspense fallback={<div className="min-h-[60vh] bg-white" />}>
            <StorefrontRoutes
              account={shopifyCustomerAccount}
              studioIdentity={studioIdentity}
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

        {studioIdentity ? (
          <SecurityWatermark
            accessId="GOOGLE"
            email={studioIdentity.email}
            name={studioIdentity.name}
            onLogout={handleStudioLogout}
          />
        ) : null}

        <Toaster position="bottom-right" />
        <ScrollToTop />
      </div>
    </Router>
  );
}
