import crestImage from '../../assets/manoir-kits-crest.png';

interface BrandCrestProps {
  width?: number;
  className?: string;
}

export function BrandCrest({ width = 80, className = "" }: BrandCrestProps) {
  return (
    <img
      src={crestImage}
      alt="Manoir Kits Crest"
      className={className}
      style={{ width: `${width}px`, height: `${width}px`, objectFit: 'contain' }}
    />
  );
}
