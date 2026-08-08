import React, { useState, useEffect } from 'react';
import waybillaSplashScreen from '../assets/images/waybilla_splash_screen_1786134507522.jpg';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number; // total ms before fade out
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 3800
}) => {
  const [show, setShow] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [progressWidth, setProgressWidth] = useState('w-1/4');

  useEffect(() => {
    // Fill the progress bar after component mounts
    const progressTimer = setTimeout(() => {
      setProgressWidth('w-full');
    }, 150);

    // Trigger fade out transition
    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true);
    }, duration - 450);

    // Hide completely
    const completeTimer = setTimeout(() => {
      setShow(false);
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(progressTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#051124] text-white transition-opacity duration-500 ease-out overflow-hidden select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Centered central asset container with responsive max-width constraints */}
      <div
        className="relative w-full max-w-[420px] max-h-screen aspect-[9/16] flex flex-col items-center justify-end pb-16 px-6 bg-cover bg-center bg-no-repeat transition-all duration-300"
        style={{
          backgroundImage: `url(${waybillaSplashScreen})`,
        }}
      >
        {/* Smooth edge fade: Blends the world map graphic into the solid outer background color */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_45%,#051124_90%)] z-10" />

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



