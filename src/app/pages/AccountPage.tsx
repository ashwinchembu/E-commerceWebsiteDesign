import { useState } from 'react';
import { User, Package, Heart, Settings, LogOut, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { toast } from 'sonner';
import logoImage from 'figma:asset/49db8db3192aa070a09b2e638fd91cfc6cf1ca1e.png';

interface AccountPageProps {
  user: { email: string; name: string; isAdmin: boolean; isFootballer?: boolean } | null;
  onLogin: (email: string, password: string) => boolean;
  onLogout: () => void;
  wishlist: Array<{ id: number; name: string; price: number; image: string }>;
  onToggleWishlist: (item: { id: number; name: string; price: number; image: string }) => { requiresLogin: boolean } | void;
}

export function AccountPage({ user, onLogin, onLogout, wishlist, onToggleWishlist }: AccountPageProps) {
  const [activeLoginTab, setActiveLoginTab] = useState('login');
  const [activeAccountTab, setActiveAccountTab] = useState<'profile' | 'orders' | 'wishlist' | 'settings'>('profile');
  const [loginError, setLoginError] = useState('');

  // Fake credentials for testing
  const testCredentials = {
    user: { email: 'user@test.com', password: 'user123' },
    admin: { email: 'admin@manoir.com', password: 'admin123' },
    footballer: { email: 'footballers@manoir.com', password: 'footballers123' }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Check credentials
    if (email === testCredentials.user.email && password === testCredentials.user.password) {
      onLogin(email, password);
      setLoginError('');
      toast.success('Successfully signed in!');
    } else if (email === testCredentials.admin.email && password === testCredentials.admin.password) {
      onLogin(email, password);
      setLoginError('');
      toast.success('Successfully signed in as Admin!');
    } else if (email === testCredentials.footballer.email && password === testCredentials.footballer.password) {
      onLogin(email, password);
      setLoginError('');
      toast.success('Successfully signed in for Footballers access!');
    } else {
      setLoginError('Invalid email or password');
    }
  };

  const handleLogout = () => {
    onLogout();
    toast.success('Successfully logged out');
  };

  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success('Profile updated successfully!');
  };

  // Login/Register View
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-md mx-auto">
            <div className="bg-white p-12 shadow-sm">
              {/* Logo at the top */}
              <div className="flex justify-center mb-8">
                <img 
                  src={logoImage} 
                  alt="Manoir Kits Crest" 
                  className="w-auto h-40 max-w-[250px]"
                />
              </div>

              <div className="flex mb-8 border-b border-gray-200">
                <button
                  onClick={() => setActiveLoginTab('login')}
                  className={`flex-1 pb-4 text-sm tracking-widest transition-colors cursor-pointer ${
                    activeLoginTab === 'login'
                      ? 'border-b-2 border-black text-black'
                      : 'text-gray-400'
                  }`}
                >
                  SIGN IN
                </button>
                <button
                  onClick={() => setActiveLoginTab('register')}
                  className={`flex-1 pb-4 text-sm tracking-widest transition-colors cursor-pointer ${
                    activeLoginTab === 'register'
                      ? 'border-b-2 border-black text-black'
                      : 'text-gray-400'
                  }`}
                >
                  REGISTER
                </button>
              </div>

              {activeLoginTab === 'login' ? (
                <form className="space-y-6" onSubmit={handleLogin}>
                  <div className="bg-blue-50 border border-blue-200 p-4 text-xs mb-4">
                    <p className="font-semibold mb-2">Test Credentials:</p>
                    <p className="mb-1">User: user@test.com / user123</p>
                    <p className="mb-1">Admin: admin@manoir.com / admin123</p>
                    <p>Footballers: footballers@manoir.com / footballers123</p>
                  </div>
                  
                  {loginError && (
                    <div className="bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                      {loginError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="block text-sm mb-2 tracking-wide">
                      EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm mb-2 tracking-wide">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="tracking-wide">Remember me</span>
                    </label>
                    <button type="button" className="tracking-wide hover:opacity-70">
                      Forgot password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-black text-white py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm cursor-pointer"
                  >
                    SIGN IN
                  </button>
                </form>
              ) : (
                <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin('newuser@test.com', 'newuser123'); toast.success('Account created successfully!'); }}>
                  <div>
                    <label htmlFor="register-name" className="block text-sm mb-2 tracking-wide">
                      FULL NAME
                    </label>
                    <input
                      type="text"
                      id="register-name"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="register-email" className="block text-sm mb-2 tracking-wide">
                      EMAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      id="register-email"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="register-password" className="block text-sm mb-2 tracking-wide">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      id="register-password"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="register-confirm" className="block text-sm mb-2 tracking-wide">
                      CONFIRM PASSWORD
                    </label>
                    <input
                      type="password"
                      id="register-confirm"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      required
                    />
                  </div>
                  <div className="flex items-start">
                    <input type="checkbox" className="mr-2 mt-1" required />
                    <span className="text-sm tracking-wide">
                      I agree to the Terms & Conditions and Privacy Policy
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-black text-white py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm cursor-pointer"
                  >
                    CREATE ACCOUNT
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged In View
  return (
    <div className="min-h-screen bg-[#f5f5f5] py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-3xl tracking-widest mb-8 font-light">MY ACCOUNT</h1>
        
        <div className="grid md:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="bg-white p-6 h-fit">
            <nav className="space-y-4">
              <button 
                onClick={() => setActiveAccountTab('profile')}
                className={`flex items-center gap-3 w-full text-left hover:opacity-70 transition-opacity cursor-pointer ${
                  activeAccountTab === 'profile' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-sm tracking-wide">Profile</span>
              </button>
              <button 
                onClick={() => setActiveAccountTab('orders')}
                className={`flex items-center gap-3 w-full text-left hover:opacity-70 transition-opacity cursor-pointer ${
                  activeAccountTab === 'orders' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="text-sm tracking-wide">Orders</span>
              </button>
              <button 
                onClick={() => setActiveAccountTab('wishlist')}
                className={`flex items-center gap-3 w-full text-left hover:opacity-70 transition-opacity cursor-pointer ${
                  activeAccountTab === 'wishlist' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <Heart className="w-5 h-5" />
                <span className="text-sm tracking-wide">Wishlist ({wishlist.length})</span>
              </button>
              <button 
                onClick={() => setActiveAccountTab('settings')}
                className={`flex items-center gap-3 w-full text-left hover:opacity-70 transition-opacity cursor-pointer ${
                  activeAccountTab === 'settings' ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm tracking-wide">Settings</span>
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full text-left hover:opacity-70 transition-opacity cursor-pointer pt-4 border-t border-gray-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm tracking-wide">Logout</span>
              </button>
            </nav>
          </div>

          {/* Main Content */}
          <div className="md:col-span-3 bg-white p-8">
            {activeAccountTab === 'profile' && (
              <>
                <h2 className="text-2xl tracking-widest mb-6 font-light">PROFILE INFORMATION</h2>
                {user.isAdmin && (
                  <div className="bg-amber-50 border border-amber-200 p-4 mb-6">
                    <p className="text-sm tracking-wide">🔑 Admin Account</p>
                  </div>
                )}
                <form className="space-y-6" onSubmit={handleSaveProfile}>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm mb-2 tracking-wide">FIRST NAME</label>
                      <input
                        type="text"
                        defaultValue={user.name}
                        className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 tracking-wide">LAST NAME</label>
                      <input
                        type="text"
                        defaultValue="Doe"
                        className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-2 tracking-wide">EMAIL ADDRESS</label>
                    <input
                      type="email"
                      defaultValue={user.email}
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2 tracking-wide">PHONE NUMBER</label>
                    <input
                      type="tel"
                      defaultValue="+1 (555) 123-4567"
                      className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-black text-white px-12 py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm cursor-pointer"
                  >
                    SAVE CHANGES
                  </button>
                </form>
              </>
            )}

            {activeAccountTab === 'orders' && (
              <>
                <h2 className="text-2xl tracking-widest mb-6 font-light">MY ORDERS</h2>
                <div className="space-y-4">
                  <div className="border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm tracking-wide mb-1">Order #MK-2026-001</p>
                        <p className="text-xs text-gray-500">Placed on January 15, 2026</p>
                      </div>
                      <span className="text-sm tracking-wide px-4 py-1 bg-green-100 text-green-800">
                        Delivered
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-gray-100"></div>
                      <div className="flex-1">
                        <p className="text-sm tracking-wide mb-1">Essential Hoodie - Black</p>
                        <p className="text-xs text-gray-500">Size: M | Qty: 1</p>
                      </div>
                      <p className="text-sm tracking-wide">$185.00</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4">
                      <button className="text-sm tracking-wide hover:opacity-70 cursor-pointer" onClick={() => toast.info('Order details shown')}>View Details</button>
                      <button className="text-sm tracking-wide hover:opacity-70 cursor-pointer" onClick={() => toast.info('Tracking information shown')}>Track Package</button>
                      <button className="text-sm tracking-wide hover:opacity-70 cursor-pointer" onClick={() => toast.success('Added to cart!')}>Reorder</button>
                    </div>
                  </div>

                  <div className="border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm tracking-wide mb-1">Order #MK-2026-002</p>
                        <p className="text-xs text-gray-500">Placed on January 20, 2026</p>
                      </div>
                      <span className="text-sm tracking-wide px-4 py-1 bg-blue-100 text-blue-800">
                        In Transit
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-gray-100"></div>
                      <div className="flex-1">
                        <p className="text-sm tracking-wide mb-1">Minimal Tee - White</p>
                        <p className="text-xs text-gray-500">Size: L | Qty: 2</p>
                      </div>
                      <p className="text-sm tracking-wide">$140.00</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex gap-4">
                      <button className="text-sm tracking-wide hover:opacity-70 cursor-pointer" onClick={() => toast.info('Order details shown')}>View Details</button>
                      <button className="text-sm tracking-wide hover:opacity-70 cursor-pointer" onClick={() => toast.info('Tracking information shown')}>Track Package</button>
                      <button className="text-sm tracking-wide text-red-600 hover:opacity-70 cursor-pointer" onClick={() => toast.error('Order cancelled')}>Cancel Order</button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeAccountTab === 'wishlist' && (
              <>
                <h2 className="text-2xl tracking-widest mb-6 font-light">MY WISHLIST</h2>
                {wishlist.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-4">Your wishlist is empty</p>
                    <Link to="/shop" className="text-sm tracking-wide underline hover:opacity-70">
                      Continue Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    {wishlist.map((item) => (
                      <div key={item.id} className="group relative">
                        <Link to={`/product/${item.id}`}>
                          <div className="aspect-[3/4] bg-gray-100 mb-2 overflow-hidden">
                            <ImageWithFallback
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        </Link>
                        <button
                          onClick={() => {
                            onToggleWishlist(item);
                            toast.success('Removed from wishlist');
                          }}
                          className="absolute top-2 right-2 bg-white/90 p-2 rounded-full hover:bg-white transition-all cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <Link to={`/product/${item.id}`}>
                          <p className="text-sm tracking-wide mb-1">{item.name}</p>
                          <p className="text-sm">${item.price}</p>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeAccountTab === 'settings' && (
              <>
                <h2 className="text-2xl tracking-widest mb-6 font-light">ACCOUNT SETTINGS</h2>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg tracking-wide mb-4">Change Password</h3>
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast.success('Password updated!'); }}>
                      <div>
                        <label className="block text-sm mb-2 tracking-wide">CURRENT PASSWORD</label>
                        <input
                          type="password"
                          className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 tracking-wide">NEW PASSWORD</label>
                        <input
                          type="password"
                          className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 tracking-wide">CONFIRM NEW PASSWORD</label>
                        <input
                          type="password"
                          className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:border-black transition-colors"
                        />
                      </div>
                      <button
                        type="submit"
                        className="bg-black text-white px-12 py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm cursor-pointer"
                      >
                        UPDATE PASSWORD
                      </button>
                    </form>
                  </div>

                  <div className="pt-8 border-t border-gray-200">
                    <h3 className="text-lg tracking-wide mb-4">Email Preferences</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm tracking-wide">Receive promotional emails</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" defaultChecked />
                        <span className="text-sm tracking-wide">Order updates and shipping notifications</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="checkbox" />
                        <span className="text-sm tracking-wide">New product announcements</span>
                      </label>
                    </div>
                    <button
                      onClick={() => toast.success('Preferences saved!')}
                      className="mt-4 bg-black text-white px-12 py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm cursor-pointer"
                    >
                      SAVE PREFERENCES
                    </button>
                  </div>

                  <div className="pt-8 border-t border-gray-200">
                    <h3 className="text-lg tracking-wide mb-4 text-red-600">Danger Zone</h3>
                    <button
                      onClick={() => toast.error('Account deletion requires email verification')}
                      className="border-2 border-red-600 text-red-600 px-12 py-4 hover:bg-red-600 hover:text-white transition-colors tracking-widest text-sm cursor-pointer"
                    >
                      DELETE ACCOUNT
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
