import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient } from '../lib/api/client';

export interface ActivityLog {
    id: string;
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    service: string;
    metadata?: any;
}

interface UseActivityOptions {
    limit?: number;
    service?: string;
    level?: string;
    autoRefresh?: boolean;
}

export function useActivity({ limit = 50, service, level, autoRefresh = true }: UseActivityOptions = {}) {
    const [activities, setActivities] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastFetchAtRef = useRef(0);
    const inFlightFetchRef = useRef<Promise<void> | null>(null);

    const fetchActivities = useCallback(async (options: { force?: boolean; silent?: boolean } = {}) => {
        const { force = false, silent = false } = options;
        const now = Date.now();

        if (!force && now - lastFetchAtRef.current < 15_000) {
            return;
        }

        if (inFlightFetchRef.current) {
            return inFlightFetchRef.current;
        }

        const request = (async () => {
          try {
            if (!silent && activities.length === 0) {
                setIsLoading(true);
            }
            setError(null);

            const params = new URLSearchParams();
            if (limit) params.append('limit', limit.toString());
            if (service) params.append('service', service);
            if (level) params.append('level', level);

            const response = await apiClient.get<ActivityLog[]>(`/api/logs?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                setActivities(response.data);
                lastFetchAtRef.current = Date.now();
            } else {
                setActivities([]); // Fallback to empty array
                // Only set error if not successful, but keep array safe
                if (!response.success) {
                    setError('Failed to load activity logs');
                }
            }
        } catch (err) {
            setError('An error occurred while fetching activities');
            console.error(err);
        } finally {
            setIsLoading(false);
            inFlightFetchRef.current = null;
          }
        })();

        inFlightFetchRef.current = request;
        return request;
    }, [activities.length, limit, service, level]);

    useEffect(() => {
        void fetchActivities({ force: true });

        if (autoRefresh) {
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    void fetchActivities({ force: true, silent: true });
                }
            };

            const interval = window.setInterval(() => {
                if (document.visibilityState === 'visible') {
                    void fetchActivities({ silent: true });
                }
            }, 60000);

            document.addEventListener('visibilitychange', handleVisibilityChange);

            return () => {
                window.clearInterval(interval);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }
    }, [fetchActivities, autoRefresh]);

    return {
        activities,
        isLoading,
        error,
        refresh: () => fetchActivities({ force: true })
    };
}
