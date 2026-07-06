import { ImageWithFallback } from './figma/ImageWithFallback';

export function LookbookSection() {
  const lookbookItems = [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1761882461486-a9efb51e86ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXR3ZWFyJTIwbG9va2Jvb2slMjBlZGl0b3JpYWx8ZW58MXx8fHwxNzY5MTA3NjE5fDA&ixlib=rb-4.1.0&q=80&w=1080",
      title: "URBAN ESSENTIALS",
      subtitle: "Minimalist design meets function"
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1768825197238-629b1ae2dc18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZmFzaGlvbiUyMHBob3RvZ3JhcGh5fGVufDF8fHx8MTc2OTA0NDA4MHww&ixlib=rb-4.1.0&q=80&w=1080",
      title: "SIGNATURE PIECES",
      subtitle: "Crafted for the modern individual"
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1751158753623-9ba2e1215f58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwbW9kZWwlMjBwb3J0cmFpdCUyMGJsYWNrfGVufDF8fHx8MTc2OTEwNzYyMHww&ixlib=rb-4.1.0&q=80&w=1080",
      title: "TAILORED LUXURY",
      subtitle: "Refined aesthetics"
    }
  ];

  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl tracking-widest text-center mb-16 font-light text-white">
          LOOKBOOK
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {lookbookItems.map((item) => (
            <div key={item.id} className="group cursor-pointer">
              <div className="relative overflow-hidden mb-4 aspect-[3/4]">
                <ImageWithFallback
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <h3 className="text-lg tracking-wider mb-1 text-white">{item.title}</h3>
              <p className="text-sm text-gray-400 tracking-wide">{item.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}