import React, { useEffect, useState } from 'react';
import waybillaSplashScreen from '../assets/images/waybilla_splash_screen_1786134507522.jpg';

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
  const [progressWidth, setProgressWidth] = useState('w-1/4');

  useEffect(() => {
    // 1. Cross-fade out static HTML shell once React mounts
    const staticSplash = document.getElementById('static-splash');
    if (staticSplash) {
      staticSplash.style.opacity = '0';
      setTimeout(() => {
        if (staticSplash && staticSplash.parentNode) {
          staticSplash.parentNode.removeChild(staticSplash);
        }
      }, 400);
    }

    // 2. Smoothly fade in world map artwork after first frame
    const graphicTimer = setTimeout(() => {
      setGraphicVisible(true);
    }, 50);

    // 3. Fill progress bar smoothly
    const progressTimer = setTimeout(() => {
      setProgressWidth('w-full');
    }, 150);

    // 4. Trigger fade out transition of React splash screen
    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true);
    }, duration - 450);

    // 5. Hide completely and notify parent
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
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#0A1F44] text-white transition-opacity duration-500 ease-out overflow-hidden select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: '#0A1F44'
      }}
    >
      {/* Centered central asset container with responsive max-width constraints and smooth fade-in */}
      <div
        className={`relative w-full max-w-[420px] max-h-screen aspect-[9/16] flex flex-col items-center justify-end pb-16 px-6 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-out ${
          graphicVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{
          backgroundImage: `url(${waybillaSplashScreen})`,
        }}
      >
        {/* Smooth edge fade: Blends the world map graphic into the solid outer background color */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,#0A1F44_90%)] z-10" />

        {/* Animated Gold Loading Indicator centered at the bottom of the premium background */}
        <div className="relative z-20 w-full max-w-xs flex flex-col items-center space-y-2 mb-2">
          <div className="w-48 h-1.5 bg-slate-900/80 rounded-full overflow-hidden relative shadow-inner border border-slate-700/30">
            <div
              className={`h-full bg-gradient-to-r from-[#F2A93B] via-amber-400 to-[#F2A93B] rounded-full transition-all ease-out shadow-[0_0_10px_rgba(242,169,59,0.6)] ${progressWidth}`}
              style={{
                transitionDuration: `${duration - 600}ms`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
