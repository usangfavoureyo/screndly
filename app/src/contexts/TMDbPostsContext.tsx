import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getSettingsForBackend } from '../lib/tmdb';
import { apiClient } from '../lib/api/client';
import {
  enqueueTMDbMutation,
  getQueuedTMDbMutations,
  getTMDbDeletedPostIds,
  getTMDbPostsSnapshot,
  markTMDbPostDeleted,
  removeQueuedTMDbMutation,
  saveTMDbPostsSnapshot,
  unmarkTMDbPostDeleted,
} from '../utils/tmdbOfflineStore';
import { deriveTMDbImageStyle, normalizeTMDbImageTypes, type TMDbFeedImageStyle, type TMDbImageAssetType } from '../lib/tmdb/feedImageSelection';
import {
  deriveTMDbActivityStatus,
  deriveTMDbPlatformStates,
  type TMDbPlatformResultRecord,
} from '../lib/tmdb/activityStatus';
import { __tmdbCaptionSanitizer, type FeedType } from '../utils/tmdbCaptionGenerator';

interface FetchPostsOptions {
  silent?: boolean;
}

export interface TMDbPost {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  moduleType?: 'today' | 'weekly' | 'monthly' | 'anniversary';
  title: string;
  year: number;
  releaseDate: string;
  caption: string;
  imageUrl: string;
  imageType: TMDbImageAssetType;
  imageUrls?: string[];
  imageTypes?: TMDbImageAssetType[];
  imageStyle?: TMDbFeedImageStyle;
  scheduledTime: string;
  source: 'tmdb_today' | 'tmdb_weekly' | 'tmdb_monthly' | 'tmdb_anniversary';
  cast: string[];
  popularity: number;
  cacheHit: boolean;
  status: 'queued' | 'scheduled' | 'dispatched' | 'published' | 'failed' | 'unscheduled' | 'skipped';
  platforms?: string[];
  platformPostIds?: Record<string, string>;
  platformResults?: TMDbPlatformResultRecord[];
  runId?: string;
  captionContextHash?: string;
  overflowPolicy?: string;
  overflowExpiresAt?: string;
  unscheduledReason?: string;
  dispatchedAt?: string;
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

function getFeedTypeFromTMDbPost(post: Partial<TMDbPost>): FeedType {
  if (post.moduleType) {
    return post.moduleType;
  }

  switch (post.source) {
    case 'tmdb_weekly':
      return 'weekly';
    case 'tmdb_monthly':
      return 'monthly';
    case 'tmdb_anniversary':
      return 'anniversary';
    case 'tmdb_today':
    default:
      return 'today';
  }
}

function sanitizeTMDbPostCaption(post: Partial<TMDbPost>): string {
  const caption = typeof post.caption === 'string' ? post.caption : '';

  return __tmdbCaptionSanitizer.sanitizeTMDbCaption(
    caption,
    {
      title: post.title || '',
      mediaType: post.mediaType === 'tv' ? 'tv' : 'movie',
      releaseDate: post.releaseDate || '',
      cast: Array.isArray(post.cast) ? post.cast : [],
      year: typeof post.year === 'number' ? post.year : undefined,
    },
    {
      model: '',
      prompt: '',
      maxLength: 200,
      includeCast: true,
      includeDate: true,
      feedType: getFeedTypeFromTMDbPost(post),
    },
  );
}

function normalizeTmdbPayload(payload: Record<string, any>) {
  const normalized: Record<string, any> = { ...payload };

  delete normalized.imageStyle;
  delete normalized.platformPostIds;
  delete normalized.platformResults;

  if (Object.prototype.hasOwnProperty.call(payload, 'publishedTime') && payload.publishedTime === undefined) {
    normalized.publishedTime = null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'errorMessage') && payload.errorMessage === undefined) {
    normalized.errorMessage = null;
  }

  return normalized;
}

function normalizeTMDbPostRecord(post: any): TMDbPost {
  const imageUrls = Array.isArray(post.imageUrls) && post.imageUrls.length > 0
    ? post.imageUrls.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
    : [post.imageUrl].filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
  const imageTypes = normalizeTMDbImageTypes(post.imageType, post.imageTypes);

  return {
    id: post.id,
    tmdbId: post.tmdbId,
    mediaType: post.mediaType,
    moduleType: post.moduleType,
    title: post.title,
    year: post.year,
    releaseDate: post.releaseDate,
    caption: sanitizeTMDbPostCaption(post),
    imageUrl: post.imageUrl,
    imageType: (post.imageType === 'custom' ? 'custom' : imageTypes[0]) || 'poster',
    imageUrls,
    imageTypes,
    imageStyle: deriveTMDbImageStyle(post.imageType, imageTypes),
    scheduledTime: post.scheduledTime,
    source: post.source,
    cast: post.cast || [],
    popularity: post.popularity || 0,
    cacheHit: post.cacheHit || false,
    status: post.status,
    platforms: Array.isArray(post.platforms) ? post.platforms : [],
    platformPostIds: post.platformPostIds && typeof post.platformPostIds === 'object' ? post.platformPostIds : {},
    platformResults: Array.isArray(post.platformResults) ? post.platformResults : [],
    runId: post.runId,
    captionContextHash: post.captionContextHash,
    overflowPolicy: post.overflowPolicy,
    overflowExpiresAt: post.overflowExpiresAt,
    unscheduledReason: post.unscheduledReason,
    dispatchedAt: post.dispatchedAt,
    publishedTime: post.publishedTime,
    errorMessage: post.errorMessage,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function mergeFetchedTMDbPostWithLocalRetryState(
  incomingPost: TMDbPost,
  existingPost?: TMDbPost,
): TMDbPost {
  if (!existingPost) {
    return incomingPost;
  }

  const incomingHasPlatformResults = Array.isArray(incomingPost.platformResults) && incomingPost.platformResults.length > 0;
  const incomingHasPlatformPostIds = incomingPost.platformPostIds && Object.keys(incomingPost.platformPostIds).length > 0;
  const existingHasPlatformResults = Array.isArray(existingPost.platformResults) && existingPost.platformResults.length > 0;
  const existingHasPlatformPostIds = existingPost.platformPostIds && Object.keys(existingPost.platformPostIds).length > 0;

  if (!existingHasPlatformResults && !existingHasPlatformPostIds) {
    return incomingPost;
  }

  const mergedPost: TMDbPost = {
    ...incomingPost,
    platforms: Array.from(new Set([...(incomingPost.platforms || []), ...(existingPost.platforms || [])])),
    platformResults: incomingHasPlatformResults ? incomingPost.platformResults : existingPost.platformResults,
    platformPostIds: incomingHasPlatformPostIds ? incomingPost.platformPostIds : existingPost.platformPostIds,
    publishedTime: incomingPost.publishedTime || existingPost.publishedTime,
  };

  const platformStates = deriveTMDbPlatformStates(mergedPost);
  const derivedStatus = deriveTMDbActivityStatus(mergedPost, platformStates);

  if (derivedStatus === 'published') {
    return {
      ...mergedPost,
      status: 'published',
      errorMessage: undefined,
    };
  }

  return mergedPost;
}

function mergeFetchedTMDbPostsWithLocalRetryState(
  incomingPosts: TMDbPost[],
  existingPosts: TMDbPost[],
): TMDbPost[] {
  const existingById = new Map(existingPosts.map((post) => [post.id, post] as const));
  return incomingPosts.map((post) => mergeFetchedTMDbPostWithLocalRetryState(post, existingById.get(post.id)));
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
        const transformedPosts: TMDbPost[] = response.data.map((post: any) => normalizeTMDbPostRecord(post));

        const deletedIds = await getTMDbDeletedPostIds();
        const filteredPosts = transformedPosts.filter((post) => !deletedIds.has(post.id));

        setPosts((prev) => {
          const mergedPosts = mergeFetchedTMDbPostsWithLocalRetryState(filteredPosts, prev);
          void saveTMDbPostsSnapshot(mergedPosts);
          return mergedPosts;
        });
        setLastSyncTime(new Date());
        setError(null);
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
        const deletedIds = await getTMDbDeletedPostIds();
        const saved = await getTMDbPostsSnapshot<TMDbPost[]>();
        const filtered = (saved ?? []).filter((post) => !deletedIds.has(post.id));
        setPosts(filtered);
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
              await apiClient.post('/api/tmdb/posts', normalizeTmdbPayload((mutation.payload as Record<string, any>) || {}));
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
    const sanitizedPost = {
      ...post,
      caption: sanitizeTMDbPostCaption(post),
    };

    // Optimistic update
    setPosts(prev => {
      const existingIndex = prev.findIndex(p => p.id === sanitizedPost.id);
      const updated = [...prev];
      if (existingIndex !== -1) {
        updated[existingIndex] = { ...sanitizedPost, status: 'scheduled' };
      } else {
        updated.push({ ...sanitizedPost, status: 'scheduled' });
      }
      return updated;
    });

    try {
      const response = await apiClient.put(
        `/api/tmdb/posts/${sanitizedPost.id}`,
        normalizeTmdbPayload({ ...sanitizedPost, status: 'scheduled' })
      );
      if (!response.success) throw new Error(response.error?.message || 'Failed to schedule post');
    } catch (err) {
      console.error('Failed to schedule post:', err);
      await enqueueTMDbMutation('update-post', {
        postId: sanitizedPost.id,
        updates: normalizeTmdbPayload({ ...sanitizedPost, status: 'scheduled' }),
      });
    }
  };

  const addPost = async (post: TMDbPost) => {
    const sanitizedPost = {
      ...post,
      caption: sanitizeTMDbPostCaption(post),
    };
    await unmarkTMDbPostDeleted(post.id);
    setPosts(prev => {
      const existingIndex = prev.findIndex(p => p.id === sanitizedPost.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = sanitizedPost;
        return updated;
      }
      return [...prev, sanitizedPost];
    });
  };

  const restorePost = async (post: TMDbPost, index: number) => {
    const sanitizedPost = {
      ...post,
      caption: sanitizeTMDbPostCaption(post),
    };
    await unmarkTMDbPostDeleted(post.id);
    setPosts(prev => {
      const updated = [...prev];
      updated.splice(index, 0, sanitizedPost);
      return updated;
    });

    try {
      const response = await apiClient.post('/api/tmdb/posts', normalizeTmdbPayload(sanitizedPost as unknown as Record<string, any>));
      if (!response.success) throw new Error(response.error?.message || 'Failed to restore post');
    } catch (err) {
      console.error('Failed to restore post:', err);
      await enqueueTMDbMutation('restore', sanitizedPost as unknown as Record<string, unknown>);
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
    const normalizeUpdates = (post: TMDbPost) => {
      const merged = { ...post, ...updates };
      if (!Object.prototype.hasOwnProperty.call(updates, 'caption')) {
        return updates;
      }

      return {
        ...updates,
        caption: sanitizeTMDbPostCaption(merged),
      };
    };

    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
            ...post,
            ...normalizeUpdates(post),
            imageStyle: deriveTMDbImageStyle(
              updates.imageType ?? post.imageType,
              updates.imageTypes ?? post.imageTypes,
            ),
          }
          : post
      )
    );

    try {
      const currentPost = posts.find((post) => post.id === postId);
      const normalizedUpdates = currentPost ? normalizeUpdates(currentPost) : updates;
      const response = await apiClient.put(`/api/tmdb/posts/${postId}`, normalizeTmdbPayload(normalizedUpdates));
      if (!response.success) throw new Error(response.error?.message || 'Failed to update post');
    } catch (err) {
      console.error('Failed to update post:', err);
      const currentPost = posts.find((post) => post.id === postId);
      const normalizedUpdates = currentPost ? normalizeUpdates(currentPost) : updates;
      await enqueueTMDbMutation('update-post', { postId, updates: normalizeTmdbPayload(normalizedUpdates) });
    }
  };

  const deletePost = async (postId: string) => {
    void markTMDbPostDeleted(postId);
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
