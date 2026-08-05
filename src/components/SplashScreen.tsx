import React, { useState, useEffect } from 'react';
import { Package } from 'lucide-react';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number; // total ms before fade out
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 3500
}) => {
  const [show, setShow] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [phase, setPhase] = useState<'logo' | 'text' | 'glow'>('logo');

  useEffect(() => {
    // Step 1: Text animation phase
    const textTimer = setTimeout(() => {
      setPhase('text');
    }, 350);

    // Step 2: Glow / pulse progress phase
    const glowTimer = setTimeout(() => {
      setPhase('glow');
    }, 700);

    // Step 3: Trigger fade out transition
    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true);
    }, duration - 400);

    // Step 4: Hide completely
    const completeTimer = setTimeout(() => {
      setShow(false);
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(glowTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-[#0A1F44] via-[#0F2952] to-[#1E3B70] text-white transition-opacity duration-500 ease-out ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        WebkitFontSmoothing: 'antialiased'
      }}
    >
      <div className="flex flex-col items-center text-center space-y-6 px-6 max-w-sm">
        {/* Animated Shield / Logo Icon Container */}
        <div className="relative">
          {/* Subtle Outer Glow Ring */}
          <div
            className={`absolute -inset-4 rounded-3xl bg-[#F2A93B]/20 blur-xl transition-all duration-700 ${
              phase === 'glow' ? 'opacity-100 scale-110' : 'opacity-0 scale-95'
            }`}
          />

          <div
            className={`relative w-20 h-20 bg-[#0A1F44] border-2 border-[#F2A93B]/60 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500 ease-out transform ${
              phase !== 'logo' ? 'scale-100 opacity-100' : 'scale-90 opacity-90'
            }`}
          >
            <Package className="w-10 h-10 text-[#F2A93B] drop-shadow-md" />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div
          className={`space-y-2 transition-all duration-500 ease-out transform ${
            phase === 'text' || phase === 'glow'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
          }`}
        >
          <h1 className="text-3xl font-black tracking-wider text-white flex items-center justify-center gap-2 flex-wrap">
            <span>Track<span className="text-[#F2A93B]">Pack</span></span>
            <span className="inline-flex items-center text-xl font-black px-2.5 py-0.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 shadow-md">
              <span className="text-emerald-400">NI</span>
              <span className="text-white">GER</span>
              <span className="text-emerald-400">IA</span>
            </span>
          </h1>
          <p className="text-xs font-bold text-slate-300 tracking-widest uppercase">
            Digital waybill Tracking platform
          </p>
        </div>

        {/* Animated Gold Loading Indicator */}
        <div className="w-28 h-1 bg-white/10 rounded-full overflow-hidden relative mt-2">
          <div
            className={`h-full bg-gradient-to-r from-[#F2A93B] to-amber-300 rounded-full transition-all duration-2500 ease-in-out ${
              phase === 'glow' ? 'w-full' : 'w-1/4'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
