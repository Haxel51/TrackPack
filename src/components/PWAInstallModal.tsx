import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check, Share, PlusSquare, ArrowRight, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallModal() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [installed, setInstalled] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if app is already running as installed standalone PWA
    const inStandalone = window.matchMedia('(display-mode: standalone)').matches || 
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    
    if (inStandalone) {
      setIsStandalone(true);
      return;
    }

    // Detect iOS & In-App Browsers (WhatsApp, Instagram, FB, Opera Mini, etc.)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    const inApp = /fban|fbav|instagram|whatsapp|line|snapchat|twitter|micromessenger/.test(userAgent);
    setIsInAppBrowser(inApp);

    // Check if early window listener already caught the prompt before React mounted
    if ((window as unknown as { deferredInstallPrompt?: BeforeInstallPromptEvent }).deferredInstallPrompt) {
      setDeferredPrompt((window as unknown as { deferredInstallPrompt?: BeforeInstallPromptEvent }).deferredInstallPrompt || null);
    }

    // 2. Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      (window as unknown as { deferredInstallPrompt?: BeforeInstallPromptEvent }).deferredInstallPrompt = promptEvent;
      // Immediately display prompt on app open!
      setShowModal(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Show modal immediately on page load
    const timer = setTimeout(() => {
      const isDismissed = sessionStorage.getItem('tp_install_dismissed') === 'true';
      if (!inStandalone && !isDismissed) {
        setShowModal(true);
      }
    }, 500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    setIsTriggering(true);

    // 1. Check if prompt is available in state or global window object
    const activePrompt = deferredPrompt || (window as unknown as { deferredInstallPrompt?: BeforeInstallPromptEvent | null }).deferredInstallPrompt;

    if (activePrompt) {
      try {
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          setShowModal(false);
          setDeferredPrompt(null);
          (window as unknown as { deferredInstallPrompt?: null }).deferredInstallPrompt = null;
        }
      } catch (err) {
        console.warn('Install prompt execution error:', err);
      } finally {
        setIsTriggering(false);
      }
      return;
    }

    // 2. If prompt isn't immediately present, poll aggressively for 2 seconds
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts++;
      const latePrompt = (window as unknown as { deferredInstallPrompt?: BeforeInstallPromptEvent | null }).deferredInstallPrompt;
      
      if (latePrompt) {
        clearInterval(pollInterval);
        try {
          await latePrompt.prompt();
          const choice = await latePrompt.userChoice;
          if (choice.outcome === 'accepted') {
            setInstalled(true);
            setShowModal(false);
            setDeferredPrompt(null);
            (window as unknown as { deferredInstallPrompt?: null }).deferredInstallPrompt = null;
          }
        } catch (err) {
          console.warn('Late install prompt error:', err);
        } finally {
          setIsTriggering(false);
        }
        return;
      }

      if (attempts >= 8) {
        clearInterval(pollInterval);
        setIsTriggering(false);
        // Show step-by-step guide if browser won't expose direct prompt event
        setShowGuide(true);
      }
    }, 250);
  };

  const handleClose = () => {
    setShowModal(false);
    setShowGuide(false);
    sessionStorage.setItem('tp_install_dismissed', 'true');
  };

  if (isStandalone || installed) {
    return null;
  }

  return (
    <>
      {/* Floating mini header bar button if dismissed */}
      {!showModal && (
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-4 left-4 z-40 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-full shadow-2xl border border-emerald-400/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all animate-bounce"
        >
          <Download className="w-4 h-4 text-emerald-200" />
          <span>Install TrackPack App</span>
        </button>
      )}

      {/* Main Immediate Install Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-emerald-100 relative animate-scaleUp">
            {/* Top gradient banner */}
            <div className="bg-gradient-to-br from-navy via-navy-light to-emerald-950 p-6 text-white text-center relative">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-3 shadow-lg flex items-center justify-center border-2 border-emerald-400 p-1">
                <BrandLogo className="w-full h-full rounded-xl" iconSizeClassName="w-8 h-8" />
              </div>

              <span className="inline-block bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-3 py-0.5 rounded-full border border-emerald-400/30 mb-2 uppercase tracking-wide">
                Official PWA Mobile App
              </span>

              <h2 className="text-xl font-black text-white tracking-tight">
                Install TrackPack
              </h2>
              <p className="text-xs text-gray-300 mt-1 max-w-xs mx-auto">
                Nigeria's #1 Interstate Waybill Tracking App
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {!showGuide ? (
                <>
                  <div className="space-y-2.5 text-xs text-gray-700">
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0 mt-0.5">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-navy text-xs">Instant 1-Tap Home Screen Access</p>
                        <p className="text-[11px] text-gray-600">Opens like a native Android/iOS app from your phone home screen.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                      <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5">
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-navy text-xs">Live Push & Waybill Notifications</p>
                        <p className="text-[11px] text-gray-600">Get instant phone alerts when your parcel is loaded or arrived.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-purple-50/60 border border-purple-100">
                      <div className="p-1.5 bg-purple-600 text-white rounded-lg shrink-0 mt-0.5">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-navy text-xs">Works Fast on Any Mobile Network</p>
                        <p className="text-[11px] text-gray-600">Saves data & opens instantly even with poor park network.</p>
                      </div>
                    </div>
                  </div>

                  {isInAppBrowser && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>You are in an in-app browser. Open in <strong>Chrome</strong> to install natively!</span>
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <button
                      onClick={handleInstallClick}
                      disabled={isTriggering}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-80 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-600/30 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                      {isTriggering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Opening Install Dialog...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>INSTALL APP NOW</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleClose}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2 px-4 rounded-xl text-xs transition"
                    >
                      Continue in Web Browser
                    </button>
                  </div>
                </>
              ) : (
                /* Step by Step Guide for iOS or Browsers requiring manual Install */
                <div className="space-y-4 animate-fadeIn">
                  <div className="text-center">
                    <p className="text-sm font-bold text-navy">Easy 2-Step Install Guide</p>
                    <p className="text-[11px] text-gray-500">Install TrackPack directly to your mobile phone home screen</p>
                  </div>

                  {isIOS ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-gray-800 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <Share className="w-4 h-4 text-amber-700" />
                        <span>For iPhone / iPad (Safari):</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-700 pl-1">
                        <li>Tap the <strong>Share button</strong> <Share className="inline w-3.5 h-3.5 text-blue-600" /> at the bottom of Safari.</li>
                        <li>Scroll down and select <strong>'Add to Home Screen'</strong> <PlusSquare className="inline w-3.5 h-3.5 text-emerald-600" />.</li>
                        <li>Tap <strong>'Add'</strong> in top right corner.</li>
                      </ol>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-gray-800 space-y-3">
                      <div className="flex items-center gap-2 font-bold text-emerald-900">
                        <Smartphone className="w-4 h-4 text-emerald-700" />
                        <span>How to Install on Android in 3 Seconds:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-700 pl-1">
                        <li>Tap the <strong>3 dots menu (⋮)</strong> at the very top-right of your Chrome browser screen.</li>
                        <li>Select <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong> from the Chrome menu list.</li>
                        <li>Tap <strong>'Install'</strong> — TrackPack icon will immediately appear on your phone home screen!</li>
                      </ol>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 flex items-start gap-2.5">
                    <Download className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Want a standalone Android APK / Google Play Store App?</p>
                      <p className="text-[10.5px] text-blue-800 mt-0.5">
                        You can convert <strong>trackpack.com.ng</strong> into a native Android <strong>.APK</strong> file in 1 minute using <strong>PWABuilder.com</strong>!
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setShowGuide(false);
                        handleInstallClick();
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>TRY AUTOMATIC INSTALL AGAIN</span>
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowGuide(false)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-3 rounded-xl text-xs transition"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleClose}
                        className="flex-1 bg-navy hover:bg-navy-light text-white font-bold py-2 px-3 rounded-xl text-xs transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
