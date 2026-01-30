import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface BrowserInfo {
  name: 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'other';
  supportsOneClick: boolean;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [pagesVisited, setPagesVisited] = useState(0);
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const [browser, setBrowser] = useState<BrowserInfo>({ name: 'other', supportsOneClick: false });

  // Detect browser
  const detectBrowser = useCallback((): BrowserInfo => {
    const ua = navigator.userAgent.toLowerCase();
    
    if (ua.includes('edg/')) {
      return { name: 'edge', supportsOneClick: true };
    }
    if (ua.includes('samsung')) {
      return { name: 'samsung', supportsOneClick: true };
    }
    if (ua.includes('opr/') || ua.includes('opera')) {
      return { name: 'opera', supportsOneClick: true };
    }
    if (ua.includes('chrome') && !ua.includes('edg/')) {
      return { name: 'chrome', supportsOneClick: true };
    }
    if (ua.includes('safari') && !ua.includes('chrome')) {
      return { name: 'safari', supportsOneClick: false };
    }
    if (ua.includes('firefox')) {
      return { name: 'firefox', supportsOneClick: false };
    }
    
    return { name: 'other', supportsOneClick: false };
  }, []);

  useEffect(() => {
    // Detect browser
    setBrowser(detectBrowser());

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    const isAndroidDevice = /android/.test(ua);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Check if banner was dismissed (show again after 3 days instead of 7)
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      if (Date.now() - dismissedTime > 3 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('pwa-banner-dismissed');
      } else {
        setBannerDismissed(true);
      }
    }

    // Track pages visited for smart timing
    const visited = parseInt(localStorage.getItem('pwa-pages-visited') || '0', 10);
    setPagesVisited(visited);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setCanInstall(false);
      setShowFloatingButton(false);
      localStorage.setItem('pwa-installed', 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [detectBrowser]);

  // Show floating button after delay and page visits
  useEffect(() => {
    if (isInstalled || bannerDismissed) {
      setShowFloatingButton(false);
      return;
    }

    // Increment page visit counter
    const newVisited = pagesVisited + 1;
    localStorage.setItem('pwa-pages-visited', newVisited.toString());
    setPagesVisited(newVisited);

    // Show floating button after 5 seconds if user has visited 2+ pages
    const timer = setTimeout(() => {
      if (newVisited >= 2) {
        setShowFloatingButton(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isInstalled, bannerDismissed]); // eslint-disable-line react-hooks/exhaustive-deps

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        setCanInstall(false);
        setShowFloatingButton(false);
        return true;
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
    return false;
  };

  const dismissBanner = () => {
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
    setBannerDismissed(true);
  };

  const dismissFloatingButton = () => {
    setShowFloatingButton(false);
    // Don't set full banner dismiss, just hide the floating button for this session
    sessionStorage.setItem('pwa-floating-dismissed', 'true');
  };

  const remindLater = () => {
    // Set to show again in 1 day
    localStorage.setItem('pwa-remind-later', (Date.now() + 24 * 60 * 60 * 1000).toString());
    setBannerDismissed(true);
    setShowFloatingButton(false);
  };

  const showInstallPrompt = !isInstalled && !bannerDismissed;

  return {
    isInstalled,
    isIOS,
    isAndroid,
    canInstall,
    showInstallPrompt,
    showFloatingButton: showFloatingButton && !sessionStorage.getItem('pwa-floating-dismissed'),
    browser,
    pagesVisited,
    promptInstall,
    dismissBanner,
    dismissFloatingButton,
    remindLater,
  };
}
