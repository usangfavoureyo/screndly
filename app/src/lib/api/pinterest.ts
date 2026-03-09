import { apiClient } from './client';

export interface PinterestBoard {
  id: string;
  name: string;
  description?: string;
  privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
  pin_count?: number;
}

function normalizeBoard(board: any): PinterestBoard | null {
  if (!board?.id || !board?.name) {
    return null;
  }

  return {
    id: String(board.id),
    name: String(board.name),
    description: typeof board.description === 'string' ? board.description : undefined,
    privacy: (typeof board.privacy === 'string' ? board.privacy : 'PUBLIC') as PinterestBoard['privacy'],
    pin_count: typeof board.pin_count === 'number' ? board.pin_count : undefined,
  };
}

export async function fetchPinterestBoards(): Promise<PinterestBoard[]> {
  try {
    const response = await apiClient.get<any[]>('/api/platforms/pinterest/boards');

    if (!response.success || !Array.isArray(response.data)) {
      return [];
    }

    return response.data.map(normalizeBoard).filter((board): board is PinterestBoard => !!board);
  } catch (error) {
    console.error('Failed to fetch Pinterest boards:', error);
    return [];
  }
}

export async function createPinterestBoard(
  name: string,
  description?: string
): Promise<PinterestBoard | null> {
  try {
    const response = await apiClient.post<any>('/api/platforms/pinterest/boards', {
      name,
      description,
    });

    if (!response.success) {
      return null;
    }

    return normalizeBoard(response.data);
  } catch (error) {
    console.error('Failed to create Pinterest board:', error);
    return null;
  }
}
