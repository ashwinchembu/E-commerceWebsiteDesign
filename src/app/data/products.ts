export interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  image: string;
  images: string[];
  description: string;
  sizes: string[];
  inStock: boolean;
}

export const products: Product[] = [
  {
    id: 1,
    name: "Essential Hoodie",
    price: 175,
    category: "Hoodies",
    image: "https://images.unsplash.com/photo-1532074198010-97d0c3700b7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGhvb2RpZSUyMHN0cmVldHdlYXJ8ZW58MXx8fHwxNzY5MTA3NjIwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1532074198010-97d0c3700b7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGhvb2RpZSUyMHN0cmVldHdlYXJ8ZW58MXx8fHwxNzY5MTA3NjIwfDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1606416835675-b4f110ed6918?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzd2VhdHNoaXJ0fGVufDF8fHx8MTc2OTE0NTQ1NXww&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Premium heavyweight cotton hoodie with oversized fit. Features ribbed cuffs and hem, kangaroo pocket, and signature embroidered logo.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    inStock: true
  },
  {
    id: 2,
    name: "Premium Tee",
    price: 95,
    category: "T-Shirts",
    image: "https://images.unsplash.com/photo-1596122787821-95c4255bb936?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMHRzaGlydCUyMG1pbmltYWx8ZW58MXx8fHwxNzY5MDYwOTkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1596122787821-95c4255bb936?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMHRzaGlydCUyMG1pbmltYWx8ZW58MXx8fHwxNzY5MDYwOTkwfDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1654707636005-5b5a96c11ab2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmVtaXVtJTIwY2xvdGhpbmclMjBkZXRhaWx8ZW58MXx8fHwxNzY5MDI0ODczfDA&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Classic crew neck t-shirt in premium cotton. Relaxed fit with reinforced shoulder seams and subtle logo detail.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    inStock: true
  },
  {
    id: 3,
    name: "Signature Jacket",
    price: 385,
    category: "Jackets",
    image: "https://images.unsplash.com/photo-1611025504703-8c143abe6996?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGphY2tldCUyMGZhc2hpb258ZW58MXx8fHwxNzY5MTQ1NDUzfDA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1611025504703-8c143abe6996?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGphY2tldCUyMGZhc2hpb258ZW58MXx8fHwxNzY5MTQ1NDUzfDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1761882461486-a9efb51e86ab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHJlZXR3ZWFyJTIwbG9va2Jvb2slMjBlZGl0b3JpYWx8ZW58MXx8fHwxNzY5MTA3NjE5fDA&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Technical outerwear jacket with water-resistant coating. Multiple pockets, adjustable hood, and premium hardware details.",
    sizes: ["S", "M", "L", "XL", "XXL"],
    inStock: true
  },
  {
    id: 4,
    name: "Urban Pants",
    price: 225,
    category: "Pants",
    image: "https://images.unsplash.com/photo-1758267928031-a87e5a5c6c5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMHBhbnRzJTIwc3RyZWV0d2VhcnxlbnwxfHx8fDE3NjkwNzkyOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1758267928031-a87e5a5c6c5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJnbyUyMHBhbnRzJTIwc3RyZWV0d2VhcnxlbnwxfHx8fDE3NjkwNzkyOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1768825197238-629b1ae2dc18?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZmFzaGlvbiUyMHBob3RvZ3JhcGh5fGVufDF8fHx8MTc2OTA0NDA4MHww&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Relaxed fit cargo pants with multiple utility pockets. Crafted from durable cotton twill with adjustable waist.",
    sizes: ["28", "30", "32", "34", "36", "38"],
    inStock: true
  },
  {
    id: 5,
    name: "Classic Sneakers",
    price: 195,
    category: "Footwear",
    image: "https://images.unsplash.com/photo-1573875133340-0b589f59a8c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMHNuZWFrZXJzJTIwbWluaW1hbHxlbnwxfHx8fDE3NjkwNTk3NjV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1573875133340-0b589f59a8c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMHNuZWFrZXJzJTIwbWluaW1hbHxlbnwxfHx8fDE3NjkwNTk3NjV8MA&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Minimalist leather sneakers with premium cushioning. Handcrafted with attention to detail and timeless design.",
    sizes: ["7", "8", "9", "10", "11", "12"],
    inStock: true
  },
  {
    id: 6,
    name: "Wool Beanie",
    price: 65,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1610757069896-81459a5ed6fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFuaWUlMjBhY2Nlc3Nvcmllc3xlbnwxfHx8fDE3NjkxNDU0NTV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1610757069896-81459a5ed6fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFuaWUlMjBhY2Nlc3Nvcmllc3xlbnwxfHx8fDE3NjkxNDU0NTV8MA&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Premium merino wool beanie with ribbed knit. One size fits all with subtle logo embroidery.",
    sizes: ["One Size"],
    inStock: true
  },
  {
    id: 7,
    name: "Oversized Sweatshirt",
    price: 155,
    category: "Hoodies",
    image: "https://images.unsplash.com/photo-1606416835675-b4f110ed6918?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzd2VhdHNoaXJ0fGVufDF8fHx8MTc2OTE0NTQ1NXww&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1606416835675-b4f110ed6918?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzd2VhdHNoaXJ0fGVufDF8fHx8MTc2OTE0NTQ1NXww&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1532074198010-97d0c3700b7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMGhvb2RpZSUyMHN0cmVldHdlYXJ8ZW58MXx8fHwxNzY5MTA3NjIwfDA&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Relaxed fit sweatshirt in brushed fleece. Dropped shoulders and extended hem for a contemporary silhouette.",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    inStock: true
  },
  {
    id: 8,
    name: "Minimal Tote Bag",
    price: 145,
    category: "Accessories",
    image: "https://images.unsplash.com/photo-1751158753623-9ba2e1215f58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwbW9kZWwlMjBwb3J0cmFpdCUyMGJsYWNrfGVufDF8fHx8MTc2OTEwNzYyMHww&ixlib=rb-4.1.0&q=80&w=1080",
    images: [
      "https://images.unsplash.com/photo-1751158753623-9ba2e1215f58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwbW9kZWwlMjBwb3J0cmFpdCUyMGJsYWNrfGVufDF8fHx8MTc2OTEwNzYyMHww&ixlib=rb-4.1.0&q=80&w=1080"
    ],
    description: "Versatile canvas tote bag with leather handles. Spacious interior with internal pocket for essentials.",
    sizes: ["One Size"],
    inStock: true
  }
];