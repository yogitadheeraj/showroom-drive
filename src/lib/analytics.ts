declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_SCRIPT_ID = 'ga4-script';
const GA_CONFIG_ID = 'ga4-config';

const getMeasurementId = () => (import.meta as any)?.env?.VITE_GA_MEASUREMENT_ID as string | undefined;

export const initGoogleAnalytics = () => {
  const measurementId = getMeasurementId();
  if (!measurementId) return;

  if (!document.getElementById(GA_SCRIPT_ID)) {
    const script = document.createElement('script');
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }

  if (!document.getElementById(GA_CONFIG_ID)) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };

    window.gtag('js', new Date());
    window.gtag('config', measurementId, { send_page_view: false });

    const configScript = document.createElement('script');
    configScript.id = GA_CONFIG_ID;
    configScript.type = 'text/javascript';
    configScript.textContent = `window.dataLayer = window.dataLayer || [];`;
    document.head.appendChild(configScript);
  }
};

export const trackPageView = (path: string, pageTitle?: string) => {
  const measurementId = getMeasurementId();
  if (!measurementId || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: pageTitle,
    send_to: measurementId,
  });
};
