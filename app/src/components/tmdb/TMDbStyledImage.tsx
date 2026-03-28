import { cn } from '../ui/utils';
import {
  deriveTMDbImageStyle,
  getTMDbAssetUrl,
  isTMDbLogoCardUrl,
  type TMDbFeedImageStyle,
} from '../../lib/tmdb/feedImageSelection';

interface TMDbStyledImageProps {
  title: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  imageType?: string | null;
  imageTypes?: string[];
  imageStyle?: TMDbFeedImageStyle;
  className?: string;
  imageClassName?: string;
}

export function TMDbStyledImage({
  title,
  imageUrl,
  imageUrls,
  imageType,
  imageTypes,
  imageStyle,
  className,
  imageClassName,
}: TMDbStyledImageProps) {
  const resolvedStyle = imageStyle || deriveTMDbImageStyle(imageType, imageTypes);
  const posterUrl = getTMDbAssetUrl(imageUrls, imageTypes, 'poster');
  const backdropUrl = getTMDbAssetUrl(imageUrls, imageTypes, 'backdrop');
  const rawLogoUrl = getTMDbAssetUrl(imageUrls, imageTypes, 'logo');
  const logoUrl = isTMDbLogoCardUrl(rawLogoUrl) ? undefined : rawLogoUrl;
  const primaryUrl = imageUrl || imageUrls?.[0];

  if (resolvedStyle === 'poster_backdrop' && posterUrl && backdropUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]', className)}>
        <img
          src={backdropUrl}
          alt={`${title} backdrop`}
          className={cn('absolute inset-0 h-full w-full object-cover', imageClassName)}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/15 to-transparent" />
        <div className="absolute bottom-[10%] left-[7%] top-[10%] w-[34%] overflow-hidden rounded-xl border border-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
          <img
            src={posterUrl}
            alt={`${title} poster`}
            className={cn('h-full w-full object-cover', imageClassName)}
          />
        </div>
      </div>
    );
  }

  if (resolvedStyle === 'backdrop_logo' && backdropUrl && logoUrl) {
    return (
      <div className={cn('relative overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]', className)}>
        <img
          src={backdropUrl}
          alt={`${title} backdrop`}
          className={cn('absolute inset-0 h-full w-full object-cover', imageClassName)}
        />
        <div className="absolute inset-0 bg-black/35" />
        <img
          src={logoUrl}
          alt={`${title} logo`}
          className="absolute left-1/2 top-1/2 max-h-[28%] max-w-[72%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]"
        />
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden bg-gray-100 dark:bg-[#1A1A1A]', className)}>
      {primaryUrl ? (
        <img
          src={primaryUrl}
          alt={title}
          className={cn('h-full w-full object-cover', imageClassName)}
        />
      ) : null}
    </div>
  );
}
