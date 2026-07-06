import crestImage from 'figma:asset/65260e3ff07725a684ad1d29eb3db00cb66a8976.png';

interface BrandCrestProps {
  width?: number;
  className?: string;
}

export function BrandCrest({ width = 80, className = "" }: BrandCrestProps) {
  const height = (width * 611) / 408;
  
  return (
    <img
      src={crestImage}
      alt="Manoir Kits Crest"
      className={className}
      style={{ width: `${width}px`, height: `${height}px`, objectFit: 'contain' }}
    />
  );
}