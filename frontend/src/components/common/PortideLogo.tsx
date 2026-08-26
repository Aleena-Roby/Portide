import React from 'react';
import logoImg from '../../assets/images/portide_logo.png';
import emblemImg from '../../assets/images/portide_emblem.png';

interface PortideLogoProps {
  variant?: 'full' | 'horizontal' | 'icon' | 'sidebar' | 'landing' | 'compact';
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
  onClick?: () => void;
  showSubtitle?: boolean;
}

export const PortideLogo: React.FC<PortideLogoProps> = ({
  variant = 'horizontal',
  theme = 'auto',
  className = '',
  onClick,
  showSubtitle = true
}) => {
  const isDarkTheme = theme === 'dark';

  if (variant === 'icon') {
    return (
      <div 
        onClick={onClick} 
        className={`inline-flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${className}`}
      >
        <img 
          src={emblemImg} 
          alt="Portide Logo Mark" 
          className="h-10 w-auto object-contain"
        />
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div 
        onClick={onClick}
        className={`flex items-center gap-3 cursor-pointer group select-none ${className}`}
      >
        <img 
          src={emblemImg} 
          alt="Portide Monogram" 
          className="h-9 w-auto object-contain shrink-0 group-hover:scale-105 transition-transform" 
        />
        <div className="flex flex-col min-w-0">
          <span className={`text-lg font-black tracking-tight leading-tight font-sans transition-colors ${
            isDarkTheme ? 'text-white group-hover:text-amber-400' : 'text-[#0b192c] group-hover:text-sky-600'
          }`}>
            PORTIDE
          </span>
          {showSubtitle && (
            <span className={`text-[8.5px] font-bold uppercase tracking-widest truncate ${
              isDarkTheme ? 'text-slate-300' : 'text-slate-500'
            }`}>
              INTELLIGENT PORT OPS
            </span>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div 
        onClick={onClick}
        className={`flex flex-col items-center text-center cursor-pointer group ${className}`}
      >
        <img 
          src={logoImg} 
          alt="PORTIDE - Intelligent Maritime Port Operations Logo" 
          className="h-24 sm:h-28 w-auto object-contain transition-transform group-hover:scale-105" 
        />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div 
        onClick={onClick}
        className={`flex items-center gap-2.5 cursor-pointer ${className}`}
      >
        <img 
          src={emblemImg} 
          alt="Portide Logo" 
          className="h-8 w-auto object-contain shrink-0" 
        />
        <span className={`text-base font-black tracking-tight ${isDarkTheme ? 'text-white' : 'text-[#0b192c]'}`}>
          PORTIDE
        </span>
      </div>
    );
  }

  // Default 'horizontal' or 'landing' - Refined enterprise proportions (15-20% smaller icon, 14px gap)
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3.5 cursor-pointer group select-none ${className}`}
    >
      <img 
        src={emblemImg} 
        alt="PORTIDE Emblem" 
        className="h-8 sm:h-8.5 lg:h-9 w-auto object-contain shrink-0 transition-transform group-hover:scale-105" 
      />
      <div className="flex flex-col justify-center min-w-0">
        <span className={`text-lg sm:text-xl font-black tracking-tight leading-none ${
          isDarkTheme ? 'text-white' : 'text-[#0b192c]'
        }`}>
          PORTIDE
        </span>
        {showSubtitle && (
          <span className={`text-[8px] sm:text-[9px] font-extrabold tracking-[0.14em] uppercase block mt-1 ${
            isDarkTheme ? 'text-amber-200/90' : 'text-slate-500'
          }`}>
            Intelligent Maritime Port Operations
          </span>
        )}
      </div>
    </div>
  );
};
