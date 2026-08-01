import React, { useState } from 'react';
import { PackageCheck } from 'lucide-react';

interface BrandLogoProps {
  className?: string;
  iconSizeClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = "w-8 h-8 rounded-lg",
  iconSizeClassName = "w-4 h-4"
}) => {
  const [imgSrc, setImgSrc] = useState<string>('/logo_final_v4.jpg');
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (imgSrc === '/logo_final_v4.jpg') {
      setImgSrc('/icon-192.png');
    } else if (imgSrc === '/icon-192.png') {
      setImgSrc('/logo.png');
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className={`${className} bg-navy flex items-center justify-center border border-emerald-500/40 text-emerald-400 font-bold shadow-sm select-none`}>
        <PackageCheck className={iconSizeClassName} />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt="TrackPack"
      onError={handleError}
      className={`${className} object-cover shadow-sm border border-emerald-500/30`}
    />
  );
};
