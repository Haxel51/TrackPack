import React from 'react';
import waybillaLogo from '../assets/images/waybilla_splash_screen_1786134507522.jpg';

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

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <div className={`relative rounded-xl overflow-hidden shadow-md shrink-0 border border-amber-400/30 bg-[#0A1F44] ${sizeMap[size]}`}>
        <img
          src={waybillaLogo}
          alt="Waybilla Logo"
          className="w-full h-full object-cover rounded-xl"
        />
      </div>
      {showText && (
        <span className={`font-black tracking-tight ${textSizeMap[size]} ${textColor}`}>
          Waybilla<span className="text-[#F2A93B]">.</span>
        </span>
      )}
    </div>
  );
};
