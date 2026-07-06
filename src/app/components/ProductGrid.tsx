import { QuickAddProduct } from './QuickAddProduct';
import { toast } from 'sonner@2.0.3';
import { Link } from 'react-router-dom';

export function ProductGrid() {
  const products = [
    {
      id: 1,
      name: "Essential Hoodie",
      price: "$175",
      priceNumber: 175,
      image: "https://images.unsplash.com/photo-1532074198010-97d0c3700b7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGhvb2RpZSUyMHN0cmVldHdlYXJ8ZW58MXx8fHwxNzY5MTA3NjIwfDA&ixlib=rb-4.1.0&q=80&w=1080"
    },
    {
      id: 2,
      name: "Premium Tee",
      price: "$95",
      priceNumber: 95,
      image: "https://images.unsplash.com/photo-1596122787821-95c4255bb936?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMHRzaGlydCUyMG1pbmltYWx8ZW58MXx8fHwxNzY5MDYwOTkwfDA&ixlib=rb-4.1.0&q=80&w=1080"
    },
    {
      id: 3,
      name: "Signature Jacket",
      price: "$385",
      priceNumber: 385,
      image: "https://images.unsplash.com/photo-1761882461486-a9efb51e86ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXR3ZWFyJTIwbG9va2Jvb2slMjBlZGl0b3JpYWx8ZW58MXx8fHwxNzY5MTA3NjE5fDA&ixlib=rb-4.1.0&q=80&w=1080"
    },
    {
      id: 4,
      name: "Urban Pants",
      price: "$225",
      priceNumber: 225,
      image: "https://images.unsplash.com/photo-1768825197238-629b1ae2dc18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZmFzaGlvbiUyMHBob3RvZ3JhcGh5fGVufDF8fHx8MTc2OTA0NDA4MHww&ixlib=rb-4.1.0&q=80&w=1080"
    }
  ];

  const handleQuickAdd = (product: typeof products[0], size: string) => {
    toast.success(`Added ${product.name} (${size}) to cart`);
  };

  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl tracking-widest text-center mb-16 font-light text-white">
          NEW ARRIVALS
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <QuickAddProduct
              key={product.id}
              {...product}
              onAddToCart={(size) => handleQuickAdd(product, size)}
            />
          ))}
        </div>
        
        <div className="text-center mt-12">
          <Link 
            to="/shop"
            className="inline-block border-2 border-white text-white px-12 py-4 hover:bg-white hover:text-black transition-all tracking-widest text-sm"
          >
            VIEW ALL
          </Link>
        </div>
      </div>
    </section>
  );
}