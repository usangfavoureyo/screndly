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
      result.current.setUploadedImageUrl('data:image/jpeg;base64,custom-image');
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

    expect(result.current.uploadedImageUrl).toBe('data:image/jpeg;base64,custom-image');
    expect(result.current.selection?.imageType).toBe('custom');
    expect(result.current.selection?.imageUrl).toBe('data:image/jpeg;base64,custom-image');
  });
});
