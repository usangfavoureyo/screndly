import { useEffect } from 'react';
import screndlyLogo from 'figma:asset/aa914b18f567f6825fda46e6657ced11e5c34887.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] flex flex-col items-center justify-center">
      {/* Logo in Center */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center animate-pulse">
          <img src={screndlyLogo} alt="Screndly" className="w-[96.82px] h-[96.82px]" />
        </div>
      </div>

      {/* Attribution at Bottom */}
      <div className="pb-8 text-center">
        <p className="text-[#9CA3AF] tracking-widest uppercase text-xs">
          By Screen Render
        </p>
      </div>
    </div>
  );
}