import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';

interface SessionExpiredBannerProps {
  show: boolean;
  onDismiss?: () => void;
}

export const SessionExpiredBanner: React.FC<SessionExpiredBannerProps> = ({ show, onDismiss }) => {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    setVisible(show);
    if (show) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md mx-auto mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 shadow-sm flex items-start gap-3.5 z-30"
        id="session-expired-banner"
      >
        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
          <Clock className="w-5 h-5" />
        </div>
        <div className="flex-1 text-xs sm:text-sm leading-relaxed font-semibold">
          Ah, you've been gone so long we thought you forgot about us! 😂 Please log in again to continue.
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
