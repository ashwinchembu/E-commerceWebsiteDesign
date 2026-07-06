import { HeroSection } from '../components/HeroSection';
import { LookbookSection } from '../components/LookbookSection';
import { ProductGrid } from '../components/ProductGrid';
import { BenefitTiles } from '../components/BenefitTiles';

export function HomePage() {
  return (
    <div className="bg-black text-white">
      <HeroSection />
      <LookbookSection />
      <ProductGrid />
      <BenefitTiles />
    </div>
  );
}