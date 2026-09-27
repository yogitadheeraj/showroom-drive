import { useEffect, useMemo, useState } from 'react';

type VehicleImageProps = {
  imageUrl?: string | null;
  brand?: string | null;
  model?: string | null;
  alt?: string;
  className?: string;
};

const BRAND_COLORS: Record<string, { bg: string; fg: string }> = {
  maruti: { bg: '#E8F1FF', fg: '#1D4ED8' },
  toyota: { bg: '#FEE2E2', fg: '#B91C1C' },
  hyundai: { bg: '#DBEAFE', fg: '#1E40AF' },
  honda: { bg: '#F3F4F6', fg: '#111827' },
  tata: { bg: '#E0F2FE', fg: '#0369A1' },
  mahindra: { bg: '#FFE4E6', fg: '#BE123C' },
  kia: { bg: '#FFF7ED', fg: '#C2410C' },
  ford: { bg: '#DBEAFE', fg: '#1D4ED8' },
  bmw: { bg: '#E0F2FE', fg: '#0C4A6E' },
  mercedes: { bg: '#F3F4F6', fg: '#111827' },
  audi: { bg: '#F5F3FF', fg: '#5B21B6' },
  nissan: { bg: '#FEE2E2', fg: '#991B1B' },
};

const getBrandKey = (brand?: string | null) => String(brand || '').trim().toLowerCase();

const getInitials = (brand?: string | null) => {
  const clean = String(brand || '').trim();
  if (!clean) return 'VH';
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
};

const buildFallbackImage = (brand?: string | null, model?: string | null) => {
  const key = getBrandKey(brand);
  const colors = BRAND_COLORS[key] || { bg: '#ECFEFF', fg: '#155E75' };
  const initials = getInitials(brand);
  const brandText = String(brand || 'Vehicle').slice(0, 16);
  const modelText = String(model || '').slice(0, 18);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${colors.bg}" />
        <stop offset="100%" stop-color="#ffffff" />
      </linearGradient>
    </defs>
    <rect width="240" height="160" fill="url(#g)" rx="16" />
    <circle cx="56" cy="52" r="30" fill="#ffffff" opacity="0.85" />
    <text x="56" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="${colors.fg}">${initials}</text>
    <text x="24" y="116" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#111827">${brandText}</text>
    <text x="24" y="136" font-family="Arial, sans-serif" font-size="12" fill="#4B5563">${modelText}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export default function VehicleImage({ imageUrl, brand, model, alt, className }: VehicleImageProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const fallback = useMemo(() => buildFallbackImage(brand, model), [brand, model]);
  const src = !imageFailed && imageUrl ? imageUrl : fallback;
  const imageAlt = alt || `${brand || 'Vehicle'} ${model || ''}`.trim();

  return (
    <img
      src={src}
      alt={imageAlt}
      loading="lazy"
      onError={() => setImageFailed(true)}
      className={className || 'h-10 w-10 rounded-lg object-cover'}
    />
  );
}
