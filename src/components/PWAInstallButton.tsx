import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share2, PlusSquare, CheckCircle2, ExternalLink, Zap } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'button' | 'banner' | 'compact' | 'bar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'banner'
}) => {
  const { isInstallable, isInstalled, isIOS, isIframe, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showIframeGuide, setShowIframeGuide] = useState(false);
  const [showFallbackGuide, setShowFallbackGuide] = useState(false);
  const [showInstalledToast, setShowInstalledToast] = useState(false);

  const handleInstallClick = async () => {
    // 1. If native install prompt is captured, trigger it immediately (1-tap native sheet)
    if (isInstallable) {
      const result = await install();
      if (result) {
        setShowInstalledToast(true);
        setTimeout(() => setShowInstalledToast(false), 3500);
        return;
      }
    }

    // 2. If running inside an iframe (like AI Studio preview), opening in top tab enables native PWA installation
    if (isIframe) {
      setShowIframeGuide(true);
      return;
    }

    // 3. iOS Safari requires Add to Home Screen via Share sheet
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    // 4. Fallback guide for Android / Chrome if prompt was already consumed or unavailable
    setShowFallbackGuide(true);
  };

  if (variant === 'banner') {
    return (
      <>
        <div className={`bg-gradient-to-r from-[#0A1F44] via-[#0E2A5C] to-[#0A1F44] text-white border-2 border-[#F7941D]/70 rounded-3xl p-4 sm:p-5 shadow-xl shadow-blue-950/20 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
          <div className="flex items-center gap-3.5 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#F7941D] text-[#0A1F44] flex items-center justify-center font-black text-xl shrink-0 shadow-md">
              <Smartphone className="w-6 h-6 text-[#0A1F44]" />
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  <span>Install Waybilla App</span>
                  <span className="text-[#F7941D]">📲</span>
                </h3>
                <span className="bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-emerald-300" />
                  <span>100% Offline Ready</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Add to your phone for instant 1-tap tracking, park manifests, and zero-data offline booking.
              </p>
            </div>
          </div>

          <button
            onClick={handleInstallClick}
            type="button"
            className="w-full sm:w-auto bg-[#F7941D] hover:bg-[#e07d0f] active:scale-95 text-[#0A1F44] font-black px-6 py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-orange-500/30 cursor-pointer flex items-center justify-center gap-2 shrink-0 whitespace-nowrap min-h-[48px]"
          >
            <Download className="w-4 h-4 text-[#0A1F44] stroke-[2.5]" />
            <span>Install App Now</span>
          </button>
        </div>

        {showIframeGuide && renderIframeGuide(() => setShowIframeGuide(false))}
        {showIOSGuide && renderIOSGuide(() => setShowIOSGuide(false))}
        {showFallbackGuide && renderFallbackGuide(() => setShowFallbackGuide(false))}
        {showInstalledToast && renderInstalledToast()}
      </>
    );
  }

  // Default button variant
  return (
    <>
      <button
        onClick={handleInstallClick}
        type="button"
        className={`bg-[#F7941D] hover:bg-[#e07d0f] text-[#0A1F44] font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 border border-amber-300 ${className}`}
        title="Install Waybilla on your home screen"
      >
        <Download className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
        <span className="whitespace-nowrap">Install App</span>
      </button>

      {showIframeGuide && renderIframeGuide(() => setShowIframeGuide(false))}
      {showIOSGuide && renderIOSGuide(() => setShowIOSGuide(false))}
      {showFallbackGuide && renderFallbackGuide(() => setShowFallbackGuide(false))}
      {showInstalledToast && renderInstalledToast()}
    </>
  );
};

function renderIframeGuide(onClose: () => void) {
  const currentUrl = window.location.href;
  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
        <div className="mx-auto w-14 h-14 bg-orange-100 text-[#0A1F44] rounded-2xl flex items-center justify-center border-2 border-orange-300 shadow-sm">
          <Smartphone className="w-7 h-7 text-[#F7941D]" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-[#0A1F44]">Install Waybilla to Phone</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            To install directly to your Android/iPhone home screen with 1 tap, open Waybilla in a dedicated browser tab:
          </p>
        </div>

        <button
          onClick={() => {
            window.open(currentUrl, '_blank');
            onClose();
          }}
          className="w-full bg-[#F7941D] hover:bg-[#e07d0f] text-[#0A1F44] font-black py-3.5 rounded-2xl text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 min-h-[48px]"
        >
          <ExternalLink className="w-4 h-4 stroke-[2.5]" />
          <span>Open Full Tab to Install</span>
        </button>

        <button
          onClick={onClose}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function renderInstalledToast() {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-2xl border-2 border-emerald-400 text-xs sm:text-sm flex items-center gap-2.5">
      <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
      <span>Waybilla is installed to your home screen!</span>
    </div>
  );
}

function renderIOSGuide(onClose: () => void) {
  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
        <div className="mx-auto w-14 h-14 bg-amber-100 text-[#0A1F44] rounded-2xl flex items-center justify-center border-2 border-amber-300">
          <Smartphone className="w-7 h-7 text-[#F7941D]" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-[#0A1F44]">Add to Home Screen</h3>
          <p className="text-xs text-slate-500">
            Install Waybilla on your iPhone or iPad:
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3 text-xs text-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[#0A1F44] text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
            <span>Tap <Share2 className="w-4 h-4 inline text-blue-600 mx-1" /> <strong>Share</strong> in your Safari navigation bar.</span>
          </div>
          <div className="flex items-center gap-2.5 border-t border-slate-200 pt-2.5">
            <span className="w-6 h-6 rounded-full bg-[#F7941D] text-[#0A1F44] flex items-center justify-center font-bold text-xs shrink-0">2</span>
            <span>Scroll down and select <PlusSquare className="w-4 h-4 inline text-orange-600 mx-1" /> <strong>Add to Home Screen</strong>.</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#0A1F44] hover:bg-blue-950 text-white font-black py-3 rounded-xl text-xs sm:text-sm transition cursor-pointer"
        >
          Got It
        </button>
      </div>
    </div>
  );
}

function renderFallbackGuide(onClose: () => void) {
  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
        <div className="mx-auto w-14 h-14 bg-amber-100 text-[#0A1F44] rounded-2xl flex items-center justify-center border-2 border-amber-300">
          <Smartphone className="w-7 h-7 text-[#F7941D]" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-[#0A1F44]">Install Waybilla App</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            In your Chrome or Samsung Internet browser:
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 text-xs text-slate-700">
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-900">1.</span>
            <span>Tap the browser menu <strong className="text-slate-900">⋮</strong> (top-right corner).</span>
          </div>
          <div className="flex items-start gap-2 border-t border-slate-200 pt-2">
            <span className="font-bold text-slate-900">2.</span>
            <span>Select <strong className="text-slate-900">"Install App"</strong> or <strong className="text-slate-900">"Add to Home screen"</strong>.</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#0A1F44] hover:bg-blue-950 text-white font-black py-3 rounded-xl text-xs sm:text-sm transition cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
}
