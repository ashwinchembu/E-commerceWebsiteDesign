import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { CartItem } from '../App';

interface CartPageProps {
  cart: CartItem[];
  updateQuantity: (id: number, size: string, quantity: number) => void;
  removeFromCart: (id: number, size: string) => void;
}

export function CartPage({ cart, updateQuantity, removeFromCart }: CartPageProps) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 15;
  const total = subtotal + shipping;

  if (cart.length === 0) {
    return (
      <div className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl tracking-wide mb-6 font-light">YOUR CART IS EMPTY</h1>
        <p className="text-gray-600 mb-8">Add some items to get started</p>
        <Link
          to="/shop"
          className="inline-block bg-black text-white px-12 py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm"
        >
          CONTINUE SHOPPING
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="text-3xl tracking-wide mb-8 font-light">SHOPPING CART</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          {cart.map((item) => (
            <div
              key={`${item.id}-${item.size}`}
              className="flex gap-6 pb-6 mb-6 border-b border-gray-200"
            >
              <img
                src={item.image}
                alt={item.name}
                className="w-32 h-32 object-cover"
              />
              <div className="flex-1">
                <h3 className="tracking-wide mb-2">{item.name}</h3>
                <p className="text-sm text-gray-600 mb-2">Size: {item.size}</p>
                <p className="mb-4">${item.price}</p>

                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-gray-300">
                    <button
                      onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                      className="p-2 hover:bg-gray-100 transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-4 text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                      className="p-2 hover:bg-gray-100 transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id, item.size)}
                    className="text-sm text-gray-600 hover:text-black transition-colors underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p>${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 p-6 h-fit">
          <h2 className="text-xl tracking-wide mb-6 font-light">ORDER SUMMARY</h2>
          
          <div className="space-y-4 mb-6">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Shipping</span>
              <span>${shipping.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-300 pt-4">
              <div className="flex justify-between">
                <span>Total</span>
                <span className="text-xl">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Link
            to="/checkout"
            className="block w-full bg-black text-white text-center py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm mb-4"
          >
            PROCEED TO CHECKOUT
          </Link>

          <Link
            to="/shop"
            className="block w-full text-center py-3 border border-gray-300 hover:border-black transition-colors tracking-widest text-sm"
          >
            CONTINUE SHOPPING
          </Link>
        </div>
      </div>
    </div>
  );
}