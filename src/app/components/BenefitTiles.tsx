import { Truck, Tag, Shield } from 'lucide-react';

export function BenefitTiles() {
  const benefits = [
    {
      icon: Truck,
      title: 'SHIPPING',
      description: 'US & International Shipping Rates Apply'
    },
    {
      icon: Tag,
      title: 'FINAL SALE',
      description: 'All Sales Final — Made to Order'
    },
    {
      icon: Shield,
      title: 'QUALITY ASSURED',
      description: '100% Guarantee'
    }
  ];

  return (
    <section className="py-16 bg-black border-t border-white/10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div key={index} className="text-center">
                <Icon className="w-8 h-8 mx-auto mb-4 text-white" />
                <h3 className="text-sm tracking-widest mb-2 text-white">
                  {benefit.title}
                </h3>
                <p className="text-sm text-gray-400 tracking-wide">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}