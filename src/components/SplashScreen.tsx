import { motion } from 'motion/react';
import { useEffect, useState, useRef } from 'react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Total splash duration: ~1.8 seconds for smooth entrance
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onCompleteRef.current();
      }, 400); // Allow fade-out transition
    }, 1800);

    return () => clearTimeout(timer);
  }, []); // Run ONCE on mount to prevent infinite resets

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0A1F44] via-[#0d2a5c] to-[#0A1F44] text-white select-none overflow-hidden ${
        isVisible ? '' : 'pointer-events-none'
      }`}
    >
      {/* Background Soft Glow Effect */}
      <div className="absolute w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Logo container with pulse & scale-up entrance */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center"
      >
        {/* Soft glowing aura behind logo */}
        <div className="absolute inset-0 bg-emerald-500/20 rounded-3xl blur-xl animate-ping opacity-75" />

        <div className="relative w-24 h-24 rounded-3xl bg-white shadow-2xl p-3 border border-white/20 flex items-center justify-center mb-6">
          <img 
            src="/logo_final_v4.jpg?v=4" 
            alt="TrackPack Logo" 
            referrerPolicy="no-referrer"
            className="w-full h-full rounded-2xl object-cover shadow-inner"
          />
        </div>

        {/* App Name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          className="text-3xl font-extrabold tracking-wider text-white mb-2"
        >
          TrackPack
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-xs text-emerald-300 font-medium tracking-wide mb-8"
        >
          Digital Waybill Tracking Platform
        </motion.p>

        {/* Thin animated progress indicator */}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: '120px' }}
          transition={{ delay: 0.4, duration: 1.2, ease: 'easeInOut' }}
          className="h-1 bg-gradient-to-r from-emerald-500 to-teal-300 rounded-full overflow-hidden shadow-sm"
        />
      </motion.div>
    </motion.div>
  );
}
