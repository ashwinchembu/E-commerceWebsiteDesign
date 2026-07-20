import { HeroSection } from '../components/HeroSection';
import { BenefitTiles } from '../components/BenefitTiles';

export function HomePage() {
  return (
    <div className="bg-black text-white">
      <HeroSection />
      <BenefitTiles />
    </div>
  );
}
