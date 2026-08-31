import React from 'react';
import { ICON_192_BASE64 } from '../assets/images/icons-base64';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  textColor?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  textColor = 'text-white'
}) => {
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizeMap = {
    xs: 'text-sm',
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const logoSrc = `data:image/png;base64,${ICON_192_BASE64}`;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className={`relative rounded-xl overflow-hidden shadow-md shrink-0 border border-amber-400/30 bg-[#0A1F44] ${sizeMap[size]}`}>
        <img
          src={logoSrc}
          alt="Waybilla Logo"
          className="w-full h-full object-cover rounded-xl"
          loading="eager"
          decoding="sync"
        />
      </div>
      {showText && (
        <span
          className={`font-black tracking-tight notranslate ${textSizeMap[size]} ${textColor}`}
          translate="no"
        >
          Waybilla<span className="text-[#F2A93B]">.</span>
        </span>
      )}
    </div>
  );
};
