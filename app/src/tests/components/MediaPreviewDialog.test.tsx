import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/BackNavigationContext', () => ({
  useBackNavigation: () => ({
    registerModalWithCloseHandler: vi.fn(),
    unregisterModal: vi.fn(),
  }),
}));

import { MediaPreviewDialog } from '../../components/media/MediaPreviewDialog';

describe('MediaPreviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders image previews and closes through the dismiss button', () => {
    const onOpenChange = vi.fn();

    render(
      <MediaPreviewDialog
        open
        src="https://example.com/poster.jpg"
        mediaType="image"
        title="Hero image"
        badgeLabel="image"
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole('img', { name: 'Hero image' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles video playback on tap and updates the scrubber state', async () => {
    const onOpenChange = vi.fn();

    render(
      <MediaPreviewDialog
        open
        src="https://example.com/trailer.mp4"
        mediaType="video"
        title="Trailer preview"
        badgeLabel="video"
        onOpenChange={onOpenChange}
      />,
    );

    const video = document.querySelector('video') as HTMLVideoElement | null;
    expect(video).not.toBeNull();

    let pausedState = true;
    Object.defineProperty(video!, 'paused', {
      configurable: true,
      get: () => pausedState,
    });
    Object.defineProperty(video!, 'duration', {
      configurable: true,
      get: () => 125,
    });
    Object.defineProperty(video!, 'currentTime', {
      configurable: true,
      writable: true,
      value: 0,
    });

    const playMock = vi.spyOn(video!, 'play').mockImplementation(async () => {
      pausedState = false;
      fireEvent(video!, new Event('play'));
    });
    const pauseMock = vi.spyOn(video!, 'pause').mockImplementation(() => {
      pausedState = true;
      fireEvent(video!, new Event('pause'));
    });

    fireEvent(video!, new Event('loadedmetadata'));
    expect(screen.getByText('2:05')).toBeInTheDocument();

    fireEvent.click(video!);

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Pause video' })).toBeInTheDocument();
    });

    video!.currentTime = 32;
    fireEvent(video!, new Event('timeupdate'));
    expect(screen.getByText('0:32')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Scrub video playback'), {
      target: { value: '60' },
    });

    expect(video!.currentTime).toBe(60);

    fireEvent.click(video!);

    await waitFor(() => {
      expect(pauseMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    });
  });

  it('navigates through mixed media items with arrow controls', () => {
    const onOpenChange = vi.fn();

    render(
      <MediaPreviewDialog
        open
        mediaItems={[
          {
            src: 'https://example.com/first.jpg',
            mediaType: 'image',
            title: 'First still',
            badgeLabel: 'image',
          },
          {
            src: 'https://example.com/second.mp4',
            mediaType: 'video',
            title: 'Second clip',
            badgeLabel: 'video',
          },
        ]}
        initialIndex={0}
        mediaType="image"
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole('img', { name: 'First still' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show next media' }));

    expect(document.querySelector('video')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Show previous media' })).toBeInTheDocument();
  });

  it('zooms in and back out on touch double-tap, even with slight finger drift while zoomed', () => {
    const onOpenChange = vi.fn();

    render(
      <MediaPreviewDialog
        open
        src="https://example.com/poster.jpg"
        mediaType="image"
        title="Hero image"
        badgeLabel="image"
        onOpenChange={onOpenChange}
      />,
    );

    const image = screen.getByRole('img', { name: 'Hero image' });
    const imageSurface = image.parentElement as HTMLElement;

    Object.defineProperty(imageSurface, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        width: 320,
        height: 640,
        top: 0,
        left: 0,
        right: 320,
        bottom: 640,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });

    const dispatchTap = (x: number, y: number) => {
      fireEvent.touchStart(imageSurface, {
        touches: [{ clientX: x, clientY: y }],
      });
      fireEvent.touchEnd(imageSurface, {
        changedTouches: [{ clientX: x, clientY: y }],
        touches: [],
      });
    };

    dispatchTap(120, 180);
    dispatchTap(124, 184);

    expect(image).toHaveStyle({ transform: 'translate3d(0px, 0px, 0) scale(2)' });

    dispatchTap(154, 214);
    dispatchTap(162, 222);

    expect(image).toHaveStyle({ transform: 'translate3d(0px, 0px, 0) scale(1)' });
  });
});
