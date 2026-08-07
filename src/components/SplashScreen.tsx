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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-end pb-16 px-6 bg-[#08152B] text-white transition-opacity duration-500 ease-out overflow-hidden select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        WebkitFontSmoothing: 'antialiased',
        backgroundImage: `url(${waybillaSplashScreen})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Animated Gold Loading Indicator centered at the bottom of the premium background */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center space-y-2">
        <div className="w-48 h-1.5 bg-slate-900/80 rounded-full overflow-hidden relative shadow-inner border border-slate-700/30">
          <div
            className={`h-full bg-gradient-to-r from-[#F2A93B] via-amber-400 to-[#F2A93B] rounded-full transition-all duration-3000 ease-out shadow-[0_0_10px_rgba(242,169,59,0.6)] ${progressWidth}`}
          />
        </div>
      </div>
    </div>
  );
};



