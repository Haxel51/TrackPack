import React, { useEffect, useState } from 'react';
import { Logo } from './Logo';
import waybillaTransportSplashImage from '../assets/images/waybilla_splash_transport_hub_1790189080381.jpg';
import { Radio, Sparkles, ChevronRight } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 7000
}) => {
  const [show, setShow] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [graphicVisible, setGraphicVisible] = useState(false);
  const [progressWidth, setProgressWidth] = useState('w-1/12');
  const [statusText, setStatusText] = useState('Connecting to National Transport Network...');

  const handleSkip = () => {
    setFadingOut(true);
    setTimeout(() => {
      setShow(false);
      onComplete();
    }, 400);
  };

  useEffect(() => {
    // 1. Smoothly fade in artwork & branding
    const graphicTimer = setTimeout(() => {
      setGraphicVisible(true);
    }, 80);

    // 2. Animate progress bar smoothly over the 7 seconds
    const progressTimer = setTimeout(() => {
      setProgressWidth('w-full');
    }, 200);

    // 3. Dynamic stage status changes (well-spaced across 7 seconds)
    const status1Timer = setTimeout(() => {
      setStatusText('Syncing Interstate Buses, Trucks & Hubs...');
    }, 2200);

    const status2Timer = setTimeout(() => {
      setStatusText('Connecting Live Stage-by-Stage Tracking...');
    }, 4400);

    const status3Timer = setTimeout(() => {
      setStatusText('Nigeria\'s Stage-by-Stage Waybill Network Ready 🇳🇬');
    }, 5800);

    // 4. Trigger smooth fade out
    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true);
    }, duration - 600);

    // 5. Complete and notify parent
    const completeTimer = setTimeout(() => {
      setShow(false);
      onComplete();
    }, duration);

    return () => {
      clearTimeout(graphicTimer);
      clearTimeout(progressTimer);
      clearTimeout(status1Timer);
      clearTimeout(status2Timer);
      clearTimeout(status3Timer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!show) return null;

  return (
    <div
      id="waybilla-splash-screen"
      className={`fixed inset-0 z-[99999] flex items-center justify-center bg-[#061229] text-white transition-opacity duration-700 ease-out overflow-hidden select-none ${
        fadingOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(247,148,29,0.25)_0%,transparent_70%)]" />

      {/* Transport Visual Container with Aspect Ratio and Edge Vignette */}
      <div
        className={`relative w-full max-w-[480px] h-full max-h-screen flex flex-col items-center justify-between py-10 px-5 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-out ${
          graphicVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          backgroundImage: `url("${waybillaTransportSplashImage}")`,
        }}
      >
        {/* Soft edge fade: Blends the transport artwork seamlessly with deep navy branding */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#061229]/90 via-[#061229]/30 to-[#061229]/95 z-10" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,#061229_92%)] z-10" />

        {/* Top Bar: Floating Badges & Optional Skip */}
        <div className="relative z-20 w-full flex justify-between items-center pt-2">
          <div className="flex items-center gap-1.5 bg-[#0A1F44]/90 backdrop-blur-md px-3 py-1 rounded-full border border-[#F7941D]/40 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#F7941D] animate-pulse" />
            <span className="text-[10px] font-black text-[#F7941D] tracking-wider uppercase">
              Nationwide Tracking
            </span>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-slate-200 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
          >
            <span>Skip</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Center Brand Identity */}
        <div className="relative z-20 flex flex-col items-center text-center px-4 max-w-sm my-auto">
          {/* Glowing Logo Icon */}
          <div className="relative mb-3">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#F7941D]/35 to-emerald-500/25 rounded-3xl blur-xl animate-pulse" />
            <div className="relative p-1.5 bg-[#0A1F44]/85 backdrop-blur-md border border-[#F7941D]/50 rounded-2xl shadow-2xl">
              <Logo size="xl" showText={false} className="shadow-2xl" />
            </div>
          </div>

          {/* Brand Name */}
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
            Way<span className="text-[#F7941D]">billa</span>
          </h1>

          {/* Slogan */}
          <div className="inline-block px-4 py-1.5 bg-[#0A1F44]/95 backdrop-blur-md border border-[#F7941D]/50 rounded-full shadow-2xl">
            <p className="text-[#F7941D] font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F7941D]" />
              <span>Stage-by-Stage Waybill Tracker</span>
            </p>
          </div>
          
          <p className="text-[11.5px] text-slate-200 font-bold mt-2.5 drop-shadow-md">
            Buses &bull; Trucks &bull; Cars &bull; Dispatch Fleets
          </p>
        </div>

        {/* Bottom Loading Status & Progress Bar */}
        <div className="relative z-20 w-full max-w-xs flex flex-col items-center space-y-2.5 pb-3">
          <div className="w-64 h-2 bg-[#051126]/90 rounded-full overflow-hidden relative shadow-inner border border-[#F7941D]/40 backdrop-blur-md">
            <div
              className={`h-full bg-gradient-to-r from-[#F7941D] via-amber-300 to-[#F7941D] rounded-full transition-all ease-out shadow-[0_0_14px_rgba(247,148,29,0.9)] ${progressWidth}`}
              style={{
                transitionDuration: `${duration - 800}ms`
              }}
            />
          </div>
          <span className="text-[11px] text-[#FBA943] font-extrabold tracking-wide text-center drop-shadow-md animate-fadeIn min-h-[16px]">
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
};
