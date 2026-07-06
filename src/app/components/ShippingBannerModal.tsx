import { X } from 'lucide-react';

interface ShippingBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShippingBannerModal({ isOpen, onClose }: ShippingBannerModalProps) {
  return (
    <div 
      className="bg-black text-white overflow-hidden transition-all duration-700 ease-in-out relative z-50"
      style={{
        maxHeight: isOpen ? '60px' : '0px',
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div className="container mx-auto flex items-center justify-between py-3 px-6">
        <div className="flex-1 text-center">
          <p className="text-sm tracking-wide">
            FREE US SHIPPING ON ORDERS OVER $200
          </p>
        </div>
        <button
          onClick={onClose}
          className="hover:opacity-70 transition-opacity ml-4 cursor-pointer"
          aria-label="Close banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}