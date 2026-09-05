import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';
import waybillaWorldSplashImage from '../assets/images/waybilla_world_splash_1788591042885.jpg';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 3800
}) => {
  const [show, setShow] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [graphicVisible, setGraphicVisible] = useState(false);
  const [progressWidth, setProgressWidth] = useState('w-1/12');

  useEffect(() => {
    // 1. Smoothly fade in branding & artwork
    const graphicTimer = setTimeout(() => {
      setGraphicVisible(true);
    }, 40);

    // 2. Animate progress bar smoothly
    const progressTimer = setTimeout(() => {
      setProgressWidth('w-full');
    }, 150);

    // 3. Trigger fade out transition
    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true);
    }, duration - 450);

    // 4. Complete and notify parent
    const completeTimer = setTimeout(() => {
      setShow(false);
      onComplete();
    }, duration);

    return () => {
      clearTimeout(graphicTimer);
      clearTimeout(progressTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!show) return null;

  return (
    <div
      id="waybilla-splash-screen"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0A1F44] text-white transition-opacity duration-500 ease-out overflow-hidden select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(242,169,59,0.15)_0%,transparent_65%)]" />

      {/* World Map Container with Aspect Ratio and Edge Vignette */}
      <div
        className={`relative w-full max-w-[460px] h-full max-h-screen aspect-[9/16] flex flex-col items-center justify-between py-12 px-6 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-out ${
          graphicVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          backgroundImage: `url("${waybillaWorldSplashImage}")`,
        }}
      >
        {/* Soft edge fade: Blends the world map graphic into the solid outer background color */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_35%,#0A1F44_88%)] z-10" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0A1F44]/80 via-transparent to-[#0A1F44] z-10" />

        {/* Top Space / Buffer */}
        <div className="relative z-20 w-full pt-4" />

        {/* Center Brand Content */}
        <div className="relative z-20 flex flex-col items-center text-center px-4 max-w-sm">
          {/* Logo with Glow */}
          <div className="relative mb-5">
            <div className="absolute -inset-4 bg-amber-500/25 rounded-3xl blur-xl animate-pulse" />
            <div className="relative p-1 bg-gradient-to-b from-amber-400/40 to-transparent rounded-2xl shadow-2xl">
              <Logo size="xl" showText={false} className="shadow-2xl" />
            </div>
          </div>

          {/* Brand Name */}
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-lg">
            Way<span className="text-[#F2A93B]">billa</span>
          </h1>

          {/* Slogan */}
          <div className="inline-block px-4 py-1.5 bg-[#0A1F44]/90 backdrop-blur-xs border border-amber-400/30 rounded-full shadow-lg">
            <p className="text-[#F2A93B] font-extrabold text-xs sm:text-sm tracking-wider uppercase">
              Unified Waybill & Fleet Tracking
            </p>
          </div>
        </div>

        {/* Bottom Loading Progress Bar */}
        <div className="relative z-20 w-full max-w-xs flex flex-col items-center space-y-2.5 pb-4">
          <div className="w-56 h-1.5 bg-[#051126]/90 rounded-full overflow-hidden relative shadow-inner border border-amber-400/30 backdrop-blur-xs">
            <div
              className={`h-full bg-gradient-to-r from-[#F2A93B] via-amber-300 to-[#F2A93B] rounded-full transition-all ease-out shadow-[0_0_12px_rgba(242,169,59,0.8)] ${progressWidth}`}
              style={{
                transitionDuration: `${duration - 600}ms`
              }}
            />
          </div>
          <span className="text-[11px] text-amber-200/80 font-medium tracking-wider uppercase">
            Loading System...
          </span>
        </div>
      </div>
    </div>
  );
};

