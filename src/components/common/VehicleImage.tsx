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
  lexus: { bg: '#F3F4F6', fg: '#111827' },
  byd: { bg: '#EFF6FF', fg: '#1D4ED8' },
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

const BRAND_FALLBACK_PHOTOS: Record<string, string> = {
  toyota: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=80',
  lexus: 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80',
  byd: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
  honda: 'https://images.unsplash.com/photo-1619405399517-d7fce0f13302?auto=format&fit=crop&w=1200&q=80',
  hyundai: 'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=1200&q=80',
  nissan: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80',
  kia: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
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
  const [fallbackPhotoFailed, setFallbackPhotoFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    setFallbackPhotoFailed(false);
  }, [imageUrl]);

  const brandKey = useMemo(() => getBrandKey(brand), [brand]);
  const brandFallbackPhoto = BRAND_FALLBACK_PHOTOS[brandKey] || null;
  const fallback = useMemo(() => buildFallbackImage(brand, model), [brand, model]);

  let src = fallback;
  if (!imageFailed && imageUrl) {
    src = imageUrl;
  } else if (!fallbackPhotoFailed && brandFallbackPhoto) {
    src = brandFallbackPhoto;
  }

  const imageAlt = alt || `${brand || 'Vehicle'} ${model || ''}`.trim();

  return (
    <img
      src={src}
      alt={imageAlt}
      loading="lazy"
      onError={() => {
        if (!imageFailed && imageUrl) {
          setImageFailed(true);
          return;
        }
        if (!fallbackPhotoFailed && brandFallbackPhoto) {
          setFallbackPhotoFailed(true);
        }
      }}
      className={className || 'h-10 w-10 rounded-lg object-cover'}
    />
  );
}
