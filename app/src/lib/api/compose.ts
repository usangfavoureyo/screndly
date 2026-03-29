import { apiClient } from './client';
import type { ComposeItem } from '../../types/compose';
import { useComposeStore } from '../../store/useComposeStore';

interface ComposeStateResponse {
  items: ComposeItem[];
  updatedAt: string | null;
}

class ComposeApi {
  async getState() {
    return apiClient.get<ComposeStateResponse>('/api/create/state');
  }

  async saveState(items: ComposeItem[]) {
    return apiClient.put<ComposeStateResponse>('/api/create/state', {
      items,
      lastModifiedAt: useComposeStore.getState().lastModifiedAt,
    });
  }
}

export const composeApi = new ComposeApi();
