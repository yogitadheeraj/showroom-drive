import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_install_dismissed') === 'true');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Already installed — hide
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDismissed(true);
    }
  }, []);

  if (!promptEvent || dismissed) return null;

  const handleInstall = async () => {
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setDismissed(true);
    setPromptEvent(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-sidebar text-sidebar-foreground rounded-xl shadow-2xl px-4 py-3 border border-white/10 max-w-sm w-[calc(100vw-2rem)]">
      <img src="/images/auth_logo.png" alt="AutoAdvant" className="h-9 w-9 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Install AutoAdvant</p>
        <p className="text-xs text-black/60">Add to your home screen for quick access</p>
      </div>
      <Button size="sm" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 text-xs gap-1" onClick={handleInstall}>
        <Download className="h-3.5 w-3.5" /> Install
      </Button>
      <button onClick={handleDismiss} className="text-white/50 hover:text-white shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
