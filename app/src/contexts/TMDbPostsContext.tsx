import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getSettingsForBackend } from '../lib/tmdb';
import { getAuthHeaders } from '../lib/api/settings';

// Railway backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://screndly-production.up.railway.app';

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
}

interface TMDbPostsContextType {
  posts: TMDbPost[];
  isLoading: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  fetchPosts: () => Promise<void>;
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

export function TMDbPostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<TMDbPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Fetch posts from backend API
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/tmdb/posts`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        // Transform backend data to match frontend interface
        const transformedPosts: TMDbPost[] = data.data.map((post: any) => ({
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
        }));

        setPosts(transformedPosts);
        setLastSyncTime(new Date());

        // Also cache to localStorage for offline access
        localStorage.setItem('screndlyTMDbPosts', JSON.stringify(transformedPosts));
      } else {
        throw new Error(data.error?.message || 'Failed to fetch posts');
      }
    } catch (err) {
      console.error('Failed to fetch TMDb posts from backend:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');

      // Fall back to localStorage if backend fails
      const saved = localStorage.getItem('screndlyTMDbPosts');
      if (saved) {
        try {
          setPosts(JSON.parse(saved));
        } catch {
          setPosts([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger refresh from TMDb API (fetches fresh movies)
  // Sends settings from frontend to backend for enforcement
  const refreshFromTMDb = useCallback(async (): Promise<{ added: number; errors: string[] }> => {
    try {
      // Get current settings to send to backend
      const settings = getSettingsForBackend();

      const response = await fetch(`${BACKEND_URL}/api/tmdb/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ settings })
      });
      const data = await response.json();

      if (data.success) {
        // Refetch posts after refresh
        await fetchPosts();
        return { added: data.data.added || 0, errors: data.data.errors || [] };
      } else {
        throw new Error(data.error?.message || 'Refresh failed');
      }
    } catch (err) {
      console.error('TMDb refresh failed:', err);
      return { added: 0, errors: [err instanceof Error ? err.message : 'Refresh failed'] };
    }
  }, [fetchPosts]);

  // Load posts on mount
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const schedulePost = async (post: TMDbPost) => {
    // Optimistic update
    setPosts(prev => {
      const existingIndex = prev.findIndex(p => p.id === post.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = { ...post, status: 'scheduled' };
        return updated;
      }
      return [...prev, { ...post, status: 'scheduled' }];
    });

    try {
      const response = await fetch(`${BACKEND_URL}/api/tmdb/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ ...post, status: 'scheduled' })
      });
      if (!response.ok) throw new Error('Failed to schedule post');
    } catch (err) {
      console.error('Failed to schedule post:', err);
      // Revert optimistic update (simplified: refetch)
      fetchPosts();
    }
  };

  const addPost = async (post: TMDbPost) => {
    // ... logic ...
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
    // Optimistic
    setPosts(prev => {
      const updated = [...prev];
      updated.splice(index, 0, post);
      return updated;
    });

    // We need to re-create it in backend because it was deleted
    try {
      const response = await fetch(`${BACKEND_URL}/api/tmdb/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(post)
      });
      if (!response.ok) throw new Error('Failed to restore post');
    } catch (err) {
      console.error('Failed to restore post:', err);
      fetchPosts();
    }
  };

  const reschedulePost = async (postId: string, newScheduledTime: string) => {
    // Optimistic
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { ...post, scheduledTime: newScheduledTime }
          : post
      )
    );

    try {
      const response = await fetch(`${BACKEND_URL}/api/tmdb/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ scheduledTime: newScheduledTime })
      });
      if (!response.ok) throw new Error('Failed to reschedule post');
    } catch (err) {
      console.error('Failed to reschedule post:', err);
      fetchPosts();
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
      const response = await fetch(`${BACKEND_URL}/api/tmdb/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ status, publishedTime, errorMessage })
      });
      if (!response.ok) throw new Error('Failed to update status');
    } catch (err) {
      console.error('Failed to update status:', err);
      fetchPosts();
      throw err;
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
      const response = await fetch(`${BACKEND_URL}/api/tmdb/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update post');
    } catch (err) {
      console.error('Failed to update post:', err);
      fetchPosts();
      throw err;
    }
  };



  const deletePost = async (postId: string) => {
    setPosts(prev => {
      const newPosts = prev.filter(post => post.id !== postId);
      localStorage.setItem('screndlyTMDbPosts', JSON.stringify(newPosts));
      return newPosts;
    });

    try {
      await fetch(`${BACKEND_URL}/api/tmdb/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders()
        }
      });
    } catch (err) {
      console.error('Failed to delete from backend:', err);
      // No refetch needed usually as delete is final, but maybe warn user
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