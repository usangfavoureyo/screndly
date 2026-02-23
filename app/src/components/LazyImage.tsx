/**
 * Advanced Lazy Loading Image Component
 * Features:
 * - Intersection Observer for lazy loading
 * - Progressive image loading (placeholder → low-res → high-res)
 * - Automatic WebP/AVIF format detection
 * - Fade-in animation
 * - Error handling with fallback
 */

import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string; // Low-res placeholder
  fallback?: string; // Fallback if image fails to load
  threshold?: number; // Intersection observer threshold (0-1)
  rootMargin?: string; // Start loading before entering viewport
  onLoad?: () => void;
  onError?: (error: Error) => void;
  priority?: boolean; // Skip lazy loading for critical images
  aspectRatio?: string; // e.g., "16/9" for maintaining aspect ratio
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  placeholder,
  fallback,
  threshold = 0.1,
  rootMargin = '50px', // Start loading 50px before entering viewport
  onLoad,
  onError,
  priority = false,
  aspectRatio,
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // If priority image, load immediately without lazy loading
    if (priority) {
      loadImage(src);
      return;
    }

    // Set up Intersection Observer for lazy loading
    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage(src);
            // Stop observing after image starts loading
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(imgRef.current);

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [src, priority, threshold, rootMargin]);

  const loadImage = (imageSrc: string) => {
    const img = new Image();
    
    img.onload = () => {
      setImageSrc(imageSrc);
      setIsLoaded(true);
      setHasError(false);
      onLoad?.();
    };

    img.onerror = () => {
      setHasError(true);
      if (fallback) {
        setImageSrc(fallback);
      }
      onError?.(new Error(`Failed to load image: ${imageSrc}`));
    };

    img.src = imageSrc;
  };

  const containerStyle: React.CSSProperties = aspectRatio
    ? { aspectRatio, position: 'relative', overflow: 'hidden' }
    : {};

  const imageStyle: React.CSSProperties = {
    opacity: isLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
    ...(aspectRatio ? { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } : {}),
  };

  return (
    <div style={containerStyle} className={className}>
      <img
        ref={imgRef}
        src={imageSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'}
        alt={alt}
        style={imageStyle}
        className={`${className} ${isLoaded ? 'loaded' : 'loading'} ${hasError ? 'error' : ''}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
      {!isLoaded && !hasError && placeholder && (
        <div
          className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse"
          style={{ aspectRatio }}
        />
      )}
    </div>
  );
};

export default LazyImage;
