import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative h-[60vh]">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1744502672203-98316831f121?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBmYXNoaW9uJTIwYXRlbGllcnxlbnwxfHx8fDE3NjkwNzkyMjN8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="About Manoir Kits"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <h1 className="text-6xl tracking-widest text-white font-light">OUR STORY</h1>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl tracking-wide mb-8 text-center font-light">
            CRAFTING TIMELESS ELEGANCE
          </h2>

          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              Founded in 2026, Manoir Kits represents the intersection of luxury craftsmanship and contemporary streetwear culture. Our brand emerged from a vision to create garments that transcend seasonal trends while maintaining an unwavering commitment to quality and design excellence.
            </p>

            <p>
              Every piece in our collection is meticulously designed with attention to detail, using premium materials sourced from the finest mills around the world. We believe that true luxury lies not in logos or labels, but in the quality of construction, the integrity of materials, and the timelessness of design.
            </p>

            <p>
              Drawing inspiration from minimalist architecture, modern art, and urban landscapes, Manoir Kits embodies a philosophy of refined simplicity. Our designs speak to those who appreciate understated elegance and seek garments that become better with time.
            </p>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="bg-black text-white py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl tracking-widest mb-16 text-center font-light">OUR VALUES</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <h3 className="text-xl tracking-wide mb-4">QUALITY</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                We source only the finest materials and work with skilled artisans to ensure every piece meets our exacting standards.
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-xl tracking-wide mb-4">SUSTAINABILITY</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Our commitment to responsible production means considering the environmental impact of every decision we make.
              </p>
            </div>
            <div className="text-center">
              <h3 className="text-xl tracking-wide mb-4">AUTHENTICITY</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                We create pieces that reflect our values and vision, never compromising our aesthetic for fleeting trends.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Image Grid */}
      <div className="py-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="aspect-[4/3]">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1703355685639-d558d1b0f63e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB3b3Jrc3BhY2UlMjBkZXNpZ258ZW58MXx8fHwxNzY5MDQ3NjA3fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Our workspace"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="aspect-[4/3]">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1761882461486-a9efb51e86ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXR3ZWFyJTIwbG9va2Jvb2slMjBlZGl0b3JpYWx8ZW58MXx8fHwxNzY5MTA3NjE5fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Our process"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gray-50 py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl tracking-wide mb-6 font-light">EXPLORE THE COLLECTION</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Discover pieces that are designed to last, crafted to inspire, and created to become part of your personal story.
          </p>
          <Link
            to="/shop"
            className="inline-block bg-black text-white px-12 py-4 hover:bg-gray-800 transition-colors tracking-widest text-sm"
          >
            SHOP NOW
          </Link>
        </div>
      </div>
    </div>
  );
}