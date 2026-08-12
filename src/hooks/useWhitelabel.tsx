/**
 * WhitelabelContext
 *
 * Detects which dealer is viewing the app and loads their public branding
 * WITHOUT requiring authentication. Works on homepage, login page, and
 * post-login dashboard.
 *
 * Dealer resolution priority:
 *  1. Subdomain  — e.g. "honda" in "honda.autoadvant.com"
 *  2. Query param — ?dealer=<slug>  (useful for dev / preview links)
 *  3. After login — if DealerContext resolves a dealerId, merge that branding
 *
 * Falls back gracefully to AutoAdvant defaults if no dealer is detected.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getApiBaseUrl } from '@/lib/getApiBaseUrl';

const BASE_DOMAINS = ['autoadvant.com', 'localhost', '127.0.0.1'];

export interface WhitelabelBranding {
  dealerId:     string | null;
  dealerSlug:   string | null;
  dealerName:   string | null;
  dealerLogoUrl: string | null;
  primaryColor: string | null;
  tagline:      string | null;
  /** true while the initial branding fetch is in-flight */
  loading:      boolean;
  /** true if a dealer-specific brand was resolved (not AutoAdvant default) */
  isBranded:    boolean;
}

const DEFAULT: WhitelabelBranding = {
  dealerId:      null,
  dealerSlug:    null,
  dealerName:    null,
  dealerLogoUrl: null,
  primaryColor:  null,
  tagline:       null,
  loading:       true,
  isBranded:     false,
};

const WhitelabelCtx = createContext<WhitelabelBranding>(DEFAULT);

function detectSlug(): string | null {
  // 1. Subdomain detection
  const hostname = window.location.hostname;
  const isBase = BASE_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`) === false && d === 'localhost');
  if (!isBase) {
    const parts = hostname.split('.');
    // e.g. "honda.autoadvant.com" → parts[0] = "honda"
    if (parts.length >= 3 && !BASE_DOMAINS.includes(hostname)) {
      const sub = parts[0];
      if (sub && sub !== 'www' && sub !== 'app') return sub;
    }
  }

  // 2. Query param
  const params = new URLSearchParams(window.location.search);
  const qDealer = params.get('dealer');
  if (qDealer) return qDealer;

  // 3. Path segment /d/<slug>/...
  const pathMatch = window.location.pathname.match(/^\/d\/([^/]+)/);
  if (pathMatch) return pathMatch[1];

  return null;
}

async function fetchBranding(slug: string): Promise<Omit<WhitelabelBranding, 'loading' | 'isBranded'> | null> {
  try {
    const apiBase = getApiBaseUrl();
    const res = await fetch(`${apiBase}/api/dealers/branding/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json.data;
    return {
      dealerId:      d.id   ?? null,
      dealerSlug:    d.slug ?? null,
      dealerName:    d.name ?? null,
      dealerLogoUrl: d.logo_url     ?? null,
      primaryColor:  d.primary_color ?? null,
      tagline:       d.tagline ?? null,
    };
  } catch {
    return null;
  }
}

export function WhitelabelProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<WhitelabelBranding>(DEFAULT);

  useEffect(() => {
    const slug = detectSlug();
    if (!slug) {
      setBrand({ ...DEFAULT, loading: false });
      return;
    }

    fetchBranding(slug).then((data) => {
      if (data) {
        setBrand({ ...data, loading: false, isBranded: true });
        // Apply primary colour CSS variable if provided
        if (data.primaryColor) {
          document.documentElement.style.setProperty('--brand-primary', data.primaryColor);
        }
        // Set page title
        if (data.dealerName) {
          document.title = `${data.dealerName} — Powered by AutoAdvant`;
        }
      } else {
        setBrand({ ...DEFAULT, loading: false });
      }
    });
  }, []);

  return <WhitelabelCtx.Provider value={brand}>{children}</WhitelabelCtx.Provider>;
}

export function useWhitelabel() {
  return useContext(WhitelabelCtx);
}
