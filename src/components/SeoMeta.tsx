import { useEffect } from 'react';

type JsonLd = Record<string, unknown>;

type SeoMetaProps = {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImageUrl?: string;
  ogType?: 'website' | 'article';
  robots?: string;
  jsonLd?: JsonLd | JsonLd[];
};

const SITE_NAME = 'AutoAdvant';
const DEFAULT_OG_IMAGE = 'https://www.autoadvant.com/images/autoadvant-logo.png';

const upsertMeta = (name: string, content: string, isProperty = false) => {
  const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (!tag) {
    tag = document.createElement('meta');
    if (isProperty) tag.setAttribute('property', name);
    else tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
};

const upsertCanonical = (href: string) => {
  let tag = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
};

const upsertJsonLd = (data?: JsonLd | JsonLd[]) => {
  const scriptId = 'seo-jsonld-primary';
  const existing = document.getElementById(scriptId);

  if (!data) {
    if (existing) existing.remove();
    return;
  }

  const script = existing || document.createElement('script');
  script.id = scriptId;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(data);

  if (!existing) {
    document.head.appendChild(script);
  }
};

export default function SeoMeta({
  title,
  description,
  canonicalUrl,
  ogImageUrl = DEFAULT_OG_IMAGE,
  ogType = 'website',
  robots = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  jsonLd,
}: SeoMetaProps) {
  useEffect(() => {
    const canonical = canonicalUrl || `${window.location.origin}${window.location.pathname}`;

    document.title = title;
    upsertMeta('description', description);
    upsertMeta('robots', robots);

    upsertCanonical(canonical);

    upsertMeta('og:title', title, true);
    upsertMeta('og:description', description, true);
    upsertMeta('og:type', ogType, true);
    upsertMeta('og:url', canonical, true);
    upsertMeta('og:site_name', SITE_NAME, true);
    upsertMeta('og:image', ogImageUrl, true);
    upsertMeta('og:image:alt', `${SITE_NAME} preview`, true);

    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('twitter:title', title);
    upsertMeta('twitter:description', description);
    upsertMeta('twitter:image', ogImageUrl);

    upsertJsonLd(jsonLd);
  }, [title, description, canonicalUrl, ogImageUrl, ogType, robots, jsonLd]);

  return null;
}
