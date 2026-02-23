import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface LowerThirdProps {
  title: string;
  subtitle: string;
  position: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'middle-left' | 'middle-center' | 'middle-right';
  aspectRatio: '16:9' | '9:16' | '1:1';
  size: 'small' | 'medium' | 'large';
  isVisible: boolean;
  backgroundColor?: string;
  textColor?: string;
  onAnimationComplete?: () => void;
}

export function LowerThird({
  title,
  subtitle,
  position,
  aspectRatio,
  size,
  isVisible,
  backgroundColor = '#000000',
  textColor = '#FFFFFF',
  onAnimationComplete,
}: LowerThirdProps) {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    }
  }, [isVisible]);

  // Size configurations
  const sizeConfig = {
    small: {
      titleSize: 'text-lg sm:text-xl',
      subtitleSize: 'text-xs sm:text-sm',
      padding: 'px-4 py-2 sm:px-5 sm:py-2.5',
      barWidth: '3px',
      maxWidth: '280px sm:320px',
    },
    medium: {
      titleSize: 'text-xl sm:text-2xl',
      subtitleSize: 'text-sm sm:text-base',
      padding: 'px-5 py-2.5 sm:px-6 sm:py-3',
      barWidth: '4px',
      maxWidth: '320px sm:400px',
    },
    large: {
      titleSize: 'text-2xl sm:text-3xl',
      subtitleSize: 'text-base sm:text-lg',
      padding: 'px-6 py-3 sm:px-8 sm:py-4',
      barWidth: '5px',
      maxWidth: '400px sm:500px',
    },
  };

  // Position configurations based on aspect ratio
  const getPositionClasses = () => {
    const baseClasses = 'absolute';
    
    if (aspectRatio === '16:9') {
      // Landscape/Cinematic
      switch (position) {
        case 'bottom-left':
          return `${baseClasses} bottom-[8%] left-[5%]`;
        case 'bottom-center':
          return `${baseClasses} bottom-[8%] left-1/2 -translate-x-1/2`;
        case 'bottom-right':
          return `${baseClasses} bottom-[8%] right-[5%]`;
        case 'middle-left':
          return `${baseClasses} bottom-[20%] left-[5%]`;
        case 'middle-center':
          return `${baseClasses} bottom-[20%] left-1/2 -translate-x-1/2`;
        case 'middle-right':
          return `${baseClasses} bottom-[20%] right-[5%]`;
        default:
          return `${baseClasses} bottom-[8%] left-[5%]`;
      }
    } else if (aspectRatio === '9:16') {
      // Vertical/Mobile
      switch (position) {
        case 'bottom-left':
          return `${baseClasses} bottom-[20%] left-[5%]`;
        case 'bottom-center':
          return `${baseClasses} bottom-[20%] left-1/2 -translate-x-1/2`;
        case 'bottom-right':
          return `${baseClasses} bottom-[20%] right-[5%]`;
        case 'middle-left':
          return `${baseClasses} bottom-[30%] left-[5%]`;
        case 'middle-center':
          return `${baseClasses} bottom-[30%] left-1/2 -translate-x-1/2`;
        case 'middle-right':
          return `${baseClasses} bottom-[30%] right-[5%]`;
        default:
          return `${baseClasses} bottom-[20%] left-1/2 -translate-x-1/2`;
      }
    } else {
      // Square/1:1
      switch (position) {
        case 'bottom-left':
          return `${baseClasses} bottom-[12%] left-[5%]`;
        case 'bottom-center':
          return `${baseClasses} bottom-[12%] left-1/2 -translate-x-1/2`;
        case 'bottom-right':
          return `${baseClasses} bottom-[12%] right-[5%]`;
        case 'middle-left':
          return `${baseClasses} bottom-[23%] left-[5%]`;
        case 'middle-center':
          return `${baseClasses} bottom-[23%] left-1/2 -translate-x-1/2`;
        case 'middle-right':
          return `${baseClasses} bottom-[23%] right-[5%]`;
        default:
          return `${baseClasses} bottom-[12%] left-1/2 -translate-x-1/2`;
      }
    }
  };

  const config = sizeConfig[size];
  const positionClasses = getPositionClasses();

  if (!shouldRender) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{
        duration: 0.4,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      onAnimationComplete={() => {
        if (!isVisible) {
          setShouldRender(false);
        }
        onAnimationComplete?.();
      }}
      className={positionClasses}
      style={{ maxWidth: config.maxWidth }}
    >
      <div className="relative">
        {/* Red accent bar */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={isVisible ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{
            duration: 0.3,
            delay: 0.1,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className="absolute left-0 top-0 bottom-0 bg-[#ec1e24] origin-top"
          style={{ width: config.barWidth }}
        />
        
        {/* Content container */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{
            duration: 0.4,
            delay: 0.2,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className={`${config.padding} backdrop-blur-sm`}
          style={{ 
            paddingLeft: `calc(${config.padding.split(' ')[0].replace('px-', '')} * 0.25rem + ${config.barWidth} + 12px)`,
            backgroundColor: backgroundColor + 'CC' // 80% opacity
          }}
        >
          {/* Title */}
          <motion.h3
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.35,
            }}
            className={`${config.titleSize} leading-tight tracking-tight`}
            style={{ color: textColor }}
          >
            {title}
          </motion.h3>
          
          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.45,
            }}
            className={`${config.subtitleSize} mt-1 leading-tight`}
            style={{ color: textColor, opacity: 0.85 }}
          >
            {subtitle}
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
}