import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getSettingsForBackend } from '../lib/tmdb';
import { apiClient } from '../lib/api/client';
import {
  enqueueTMDbMutation,
  getQueuedTMDbMutations,
  getTMDbPostsSnapshot,
  removeQueuedTMDbMutation,
  saveTMDbPostsSnapshot,
} from '../utils/tmdbOfflineStore';

interface FetchPostsOptions {
  silent?: boolean;
}

export interface TMDbPost {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year: number;
  releaseDate: string;
  caption: string;
  imageUrl: string;
  imageType: 'poster' | 'backdrop';
  scheduledTime: string;
  source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
  cast: string[];
  popularity: number;
  cacheHit: boolean;
  status: 'queued' | 'scheduled' | 'published' | 'failed';
  platforms?: string[];
  publishedTime?: string;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TMDbPostsContextType {
  posts: TMDbPost[];
  isLoading: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  fetchPosts: (options?: FetchPostsOptions) => Promise<void>;
  refreshFromTMDb: () => Promise<{ added: number; errors: string[] }>;
  schedulePost: (post: TMDbPost) => Promise<void>;
  addPost: (post: TMDbPost) => Promise<void>;
  restorePost: (post: TMDbPost, index: number) => Promise<void>;
  reschedulePost: (postId: string, newScheduledTime: string) => Promise<void>;
  updatePostStatus: (postId: string, status: TMDbPost['status'], publishedTime?: string, errorMessage?: string) => Promise<void>;
  updatePost: (postId: string, updates: Partial<TMDbPost>) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  getPostsByStatus: (status: TMDbPost['status']) => TMDbPost[];
}

const TMDbPostsContext = createContext<TMDbPostsContextType | undefined>(undefined);

function normalizeTmdbPayload(payload: Record<string, any>) {
  const normalized: Record<string, any> = { ...payload };

  if (Object.prototype.hasOwnProperty.call(payload, 'publishedTime') && payload.publishedTime === undefined) {
    normalized.publishedTime = null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'errorMessage') && payload.errorMessage === undefined) {
    normalized.errorMessage = null;
  }

  return normalized;
}

export function TMDbPostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<TMDbPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);
  const isFlushingQueueRef = useRef(false);

  // Fetch posts from backend API
  const fetchPosts = useCallback(async (options: FetchPostsOptions = {}) => {
    const { silent = false } = options;

    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await apiClient.get<any[]>('/api/tmdb/posts');

      if (response.success && Array.isArray(response.data)) {
        // Transform backend data to match frontend interface
        const transformedPosts: TMDbPost[] = response.data.map((post: any) => ({
          id: post.id,
          tmdbId: post.tmdbId,
          mediaType: post.mediaType,
          title: post.title,
          year: post.year,
          releaseDate: post.releaseDate,
          caption: post.caption,
          imageUrl: post.imageUrl,
          imageType: post.imageType,
          scheduledTime: post.scheduledTime,
          source: post.source,
          cast: post.cast || [],
          popularity: post.popularity || 0,
          cacheHit: post.cacheHit || false,
          status: post.status,
          platforms: post.platforms || [],
          publishedTime: post.publishedTime,
          errorMessage: post.errorMessage,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        }));

        setPosts(transformedPosts);
        setLastSyncTime(new Date());
        setError(null);
        void saveTMDbPostsSnapshot(transformedPosts);
      } else {
        throw new Error(response.error?.message || 'Failed to fetch posts');
      }
    } catch (err: any) {
      console.error('Failed to fetch TMDb posts from backend:', err);

      if (!silent) {
        setError(err.message || 'Failed to fetch posts');
      }

      // Fall back to IndexedDB snapshot if backend fails
      if (!silent) {
        const saved = await getTMDbPostsSnapshot<TMDbPost[]>();
        setPosts(saved ?? []);
      }
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void saveTMDbPostsSnapshot(posts);
  }, [posts]);

  const flushPendingMutations = useCallback(async () => {
    if (isFlushingQueueRef.current || !navigator.onLine) {
      return;
    }

    isFlushingQueueRef.current = true;

    try {
      const queued = await getQueuedTMDbMutations();

      for (const mutation of queued) {
        try {
          switch (mutation.operation) {
            case 'restore':
            case 'create-or-update':
              await apiClient.post('/api/tmdb/posts', mutation.payload);
              break;
            case 'reschedule':
              await apiClient.put(`/api/tmdb/posts/${String(mutation.payload.postId)}`, {
                scheduledTime: mutation.payload.newScheduledTime,
              });
              break;
            case 'update-status':
              await apiClient.put(
                `/api/tmdb/posts/${String(mutation.payload.postId)}`,
                normalizeTmdbPayload({
                  status: mutation.payload.status,
                  publishedTime: mutation.payload.publishedTime,
                  errorMessage: mutation.payload.errorMessage,
                }),
              );
              break;
            case 'update-post':
              await apiClient.put(
                `/api/tmdb/posts/${String(mutation.payload.postId)}`,
                normalizeTmdbPayload((mutation.payload.updates as Record<string, unknown>) || {}),
              );
              break;
            case 'delete':
              await apiClient.delete(`/api/tmdb/posts/${String(mutation.payload.postId)}`);
              break;
            default:
              break;
          }

          await removeQueuedTMDbMutation(mutation.id);
        } catch (error) {
          console.error('Failed to flush TMDb offline mutation:', error);
          break;
        }
      }
    } finally {
      isFlushingQueueRef.current = false;
    }
  }, []);

  // Trigger refresh from TMDb API (fetches fresh movies)
  const refreshFromTMDb = useCallback(async (): Promise<{ added: number; errors: string[] }> => {
    try {
      const settings = getSettingsForBackend();
      const response = await apiClient.post<any>('/api/tmdb/refresh', { settings });

      if (response.success) {
        // Refetch posts after refresh
        await fetchPosts();
        return { added: response.data.added || 0, errors: response.data.errors || [] };
      } else {
        throw new Error(response.error?.message || 'Refresh failed');
      }
    } catch (err: any) {
      console.error('TMDb refresh failed:', err);
      return { added: 0, errors: [err.message || 'Refresh failed'] };
    }
  }, [fetchPosts]);

  // Load posts on mount
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    void flushPendingMutations();

    const handleOnline = () => {
      void flushPendingMutations().then(() => fetchPosts({ silent: true }));
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchPosts, flushPendingMutations]);

  const schedulePost = async (post: TMDbPost) => {
    // Optimistic update
    setPosts(prev => {
      const existingIndex = prev.findIndex(p => p.id === post.id);
      const updated = [...prev];
      if (existingIndex !== -1) {
        updated[existingIndex] = { ...post, status: 'scheduled' };
      } else {
        updated.push({ ...post, status: 'scheduled' });
      }
      return updated;
    });

    try {
      const response = await apiClient.put(
        `/api/tmdb/posts/${post.id}`,
        normalizeTmdbPayload({ ...post, status: 'scheduled' })
      );
      if (!response.success) throw new Error(response.error?.message || 'Failed to schedule post');
    } catch (err) {
      console.error('Failed to schedule post:', err);
      await enqueueTMDbMutation('update-post', {
        postId: post.id,
        updates: normalizeTmdbPayload({ ...post, status: 'scheduled' }),
      });
    }
  };

  const addPost = async (post: TMDbPost) => {
    setPosts(prev => {
      const existingIndex = prev.findIndex(p => p.id === post.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = post;
        return updated;
      }
      return [...prev, post];
    });
  };

  const restorePost = async (post: TMDbPost, index: number) => {
    setPosts(prev => {
      const updated = [...prev];
      updated.splice(index, 0, post);
      return updated;
    });

    try {
      const response = await apiClient.post('/api/tmdb/posts', post);
      if (!response.success) throw new Error(response.error?.message || 'Failed to restore post');
    } catch (err) {
      console.error('Failed to restore post:', err);
      await enqueueTMDbMutation('restore', post as unknown as Record<string, unknown>);
    }
  };

  const reschedulePost = async (postId: string, newScheduledTime: string) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { ...post, scheduledTime: newScheduledTime }
          : post
      )
    );

    try {
      const response = await apiClient.put(`/api/tmdb/posts/${postId}`, { scheduledTime: newScheduledTime });
      if (!response.success) throw new Error(response.error?.message || 'Failed to reschedule post');
    } catch (err) {
      console.error('Failed to reschedule post:', err);
      await enqueueTMDbMutation('reschedule', { postId, newScheduledTime });
    }
  };

  const updatePostStatus = async (
    postId: string,
    status: TMDbPost['status'],
    publishedTime?: string,
    errorMessage?: string
  ) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
            ...post,
            status,
            publishedTime: status === 'published' ? publishedTime : post.publishedTime,
            errorMessage: status === 'failed' ? errorMessage : undefined
          }
          : post
      )
    );

    try {
      const response = await apiClient.put(
        `/api/tmdb/posts/${postId}`,
        normalizeTmdbPayload({ status, publishedTime, errorMessage })
      );
      if (!response.success) throw new Error(response.error?.message || 'Failed to update status');
    } catch (err) {
      console.error('Failed to update status:', err);
      await enqueueTMDbMutation('update-status', { postId, status, publishedTime, errorMessage });
    }
  };

  const updatePost = async (postId: string, updates: Partial<TMDbPost>) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { ...post, ...updates }
          : post
      )
    );

    try {
      const response = await apiClient.put(`/api/tmdb/posts/${postId}`, normalizeTmdbPayload(updates));
      if (!response.success) throw new Error(response.error?.message || 'Failed to update post');
    } catch (err) {
      console.error('Failed to update post:', err);
      await enqueueTMDbMutation('update-post', { postId, updates: normalizeTmdbPayload(updates) });
    }
  };

  const deletePost = async (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));

    try {
      await apiClient.delete(`/api/tmdb/posts/${postId}`);
    } catch (err) {
      console.error('Failed to delete from backend:', err);
      await enqueueTMDbMutation('delete', { postId });
    }
  };

  const getPostsByStatus = (status: TMDbPost['status']) => {
    return posts.filter(post => post.status === status);
  };

  return (
    <TMDbPostsContext.Provider
      value={{
        posts,
        isLoading,
        error,
        lastSyncTime,
        fetchPosts,
        refreshFromTMDb,
        schedulePost,
        addPost,
        restorePost,
        reschedulePost,
        updatePostStatus,
        updatePost,
        deletePost,
        getPostsByStatus,
      }}
    >
      {children}
    </TMDbPostsContext.Provider>
  );
}

export function useTMDbPosts() {
  const context = useContext(TMDbPostsContext);
  if (context === undefined) {
    throw new Error('useTMDbPosts must be used within a TMDbPostsProvider');
  }
  return context;
}
