import { ImageWithFallback } from './figma/ImageWithFallback';
import { Link } from 'react-router-dom';

export function HeroSection() {
  return (
    <section className="relative h-screen bg-black">
      <div className="absolute inset-0">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1730196343034-41b7f2350667?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmYXNoaW9uJTIwbW9kZWwlMjB1cmJhbnxlbnwxfHx8fDE3NjkxMDc2MTh8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Hero fashion"
          className="w-full h-full object-cover opacity-40"
        />
      </div>
      
      <div className="relative h-full flex items-center justify-center text-center text-white px-6">
        <div>
          <h1 className="text-6xl md:text-8xl tracking-widest mb-6 font-light">
            SPRING/SUMMER '26
          </h1>
          <p className="text-sm tracking-widest mb-8 opacity-90">
            DISCOVER THE NEW COLLECTION
          </p>
          <Link 
            to="/shop"
            className="inline-block border-2 border-white px-12 py-4 hover:bg-white hover:text-black transition-all tracking-widest text-sm"
          >
            EXPLORE
          </Link>
        </div>
      </div>
    </section>
  );
}