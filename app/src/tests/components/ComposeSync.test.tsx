import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ComposeSync } from '../../components/create/ComposeSync';
import { useComposeStore } from '../../store/useComposeStore';

const composeApiMock = vi.hoisted(() => ({
  getState: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock('../../lib/api/compose', () => ({
  composeApi: composeApiMock,
}));

describe('ComposeSync', () => {
  beforeEach(() => {
    useComposeStore.setState({
      items: [],
      activeItemId: null,
      lastModifiedAt: null,
    });
    composeApiMock.getState.mockReset();
    composeApiMock.saveState.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps newer local deletions from being overwritten by older remote state', async () => {
    useComposeStore.setState({
      items: [],
      activeItemId: null,
      lastModifiedAt: '2026-03-27T10:00:00.000Z',
    });

    composeApiMock.getState.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'remote-post',
            title: 'Remote draft',
            status: 'draft',
            mediaAssets: [],
            platforms: ['instagram_feed'],
            sharedCaption: '',
            platformFields: {},
            createdAt: '2026-03-26T07:00:00.000Z',
            updatedAt: '2026-03-26T08:00:00.000Z',
          },
        ],
        updatedAt: '2026-03-26T08:00:00.000Z',
      },
    });
    composeApiMock.saveState.mockResolvedValue({ success: true, data: { items: [], updatedAt: '2026-03-27T10:00:00.000Z' } });

    render(<ComposeSync />);

    await waitFor(() => {
      expect(useComposeStore.getState().items).toEqual([]);
    });

    await waitFor(() => {
      expect(composeApiMock.saveState).toHaveBeenCalledWith([]);
    });
  });

  it('hydrates from remote state when there is no newer local state', async () => {
    composeApiMock.getState.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 'remote-post',
            title: 'Remote draft',
            status: 'draft',
            mediaAssets: [],
            platforms: ['instagram_feed'],
            sharedCaption: '',
            platformFields: {},
            createdAt: '2026-03-26T07:00:00.000Z',
            updatedAt: '2026-03-26T08:00:00.000Z',
          },
        ],
        updatedAt: '2026-03-26T08:00:00.000Z',
      },
    });
    composeApiMock.saveState.mockResolvedValue({ success: true, data: { items: [], updatedAt: '2026-03-26T08:00:00.000Z' } });

    render(<ComposeSync />);

    await waitFor(() => {
      expect(useComposeStore.getState().items).toHaveLength(1);
    });

    expect(useComposeStore.getState().items[0]?.id).toBe('remote-post');
    expect(composeApiMock.saveState).not.toHaveBeenCalled();
  });
});
