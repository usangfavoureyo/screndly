import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTmdbImageCycler } from '../../hooks/useTmdbImageCycler';
import type { TMDbImagePools } from '../../lib/tmdb/feedImageSelection';

function createPools(overrides: Partial<TMDbImagePools> = {}): TMDbImagePools {
  return {
    posters: [],
    backdrops: [],
    logos: [],
    ...overrides,
  };
}

describe('useTmdbImageCycler', () => {
  it('preserves an uploaded custom image when TMDb assets finish loading later', () => {
    const initialProps = {
      open: true,
      pools: createPools(),
      currentImageUrl: 'https://image.tmdb.org/t/p/w780/original-poster.jpg',
      currentImageType: 'poster',
      currentImageUrls: ['https://image.tmdb.org/t/p/w780/original-poster.jpg'],
      currentImageTypes: ['poster'],
    };

    const { result, rerender } = renderHook((props) => useTmdbImageCycler(props), {
      initialProps,
    });

    act(() => {
      result.current.setUploadedImageForType('poster', 'data:image/jpeg;base64,custom-image');
    });

    rerender({
      ...initialProps,
      pools: createPools({
        posters: [
          {
            path: '/poster-a.jpg',
            url: 'https://image.tmdb.org/t/p/w780/poster-a.jpg',
            type: 'poster',
          },
        ],
        backdrops: [
          {
            path: '/backdrop-a.jpg',
            url: 'https://image.tmdb.org/t/p/w1280/backdrop-a.jpg',
            type: 'backdrop',
          },
        ],
      }),
    });

    expect(result.current.uploadedImages.poster).toBe('data:image/jpeg;base64,custom-image');
    expect(result.current.selection?.imageType).toBe('poster');
    expect(result.current.selection?.imageUrl).toBe('data:image/jpeg;base64,custom-image');
  });

  it('allows replacing only the backdrop slot in a poster plus backdrop selection', () => {
    const { result } = renderHook(() => useTmdbImageCycler({
      open: true,
      pools: createPools({
        posters: [
          { path: '/poster-a.jpg', url: 'https://image.tmdb.org/t/p/w780/poster-a.jpg', type: 'poster' },
        ],
        backdrops: [
          { path: '/backdrop-a.jpg', url: 'https://image.tmdb.org/t/p/w1280/backdrop-a.jpg', type: 'backdrop' },
        ],
      }),
      currentImageUrl: 'https://image.tmdb.org/t/p/w780/poster-a.jpg',
      currentImageType: 'poster',
      currentImageUrls: [
        'https://image.tmdb.org/t/p/w780/poster-a.jpg',
        'https://image.tmdb.org/t/p/w1280/backdrop-a.jpg',
      ],
      currentImageTypes: ['poster', 'backdrop'],
    }));

    act(() => {
      result.current.setUploadedImageForType('backdrop', 'data:image/jpeg;base64,custom-backdrop');
    });

    expect(result.current.effectivePosterUrl).toBe('https://image.tmdb.org/t/p/w780/poster-a.jpg');
    expect(result.current.effectiveBackdropUrl).toBe('data:image/jpeg;base64,custom-backdrop');
    expect(result.current.selection?.imageUrls).toEqual([
      'https://image.tmdb.org/t/p/w780/poster-a.jpg',
      'data:image/jpeg;base64,custom-backdrop',
    ]);
    expect(result.current.selection?.imageTypes).toEqual(['poster', 'backdrop']);
  });
});
