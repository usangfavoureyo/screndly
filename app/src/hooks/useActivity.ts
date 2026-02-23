import { useState, useCallback, useEffect } from 'react';
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

    const fetchActivities = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (limit) params.append('limit', limit.toString());
            if (service) params.append('service', service);
            if (level) params.append('level', level);

            const response = await apiClient.get<ActivityLog[]>(`/api/logs?${params.toString()}`);

            if (response.success && Array.isArray(response.data)) {
                setActivities(response.data);
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
        }
    }, [limit, service, level]);

    useEffect(() => {
        fetchActivities();

        if (autoRefresh) {
            const interval = setInterval(fetchActivities, 30000); // 30s poll
            return () => clearInterval(interval);
        }
    }, [fetchActivities, autoRefresh]);

    return {
        activities,
        isLoading,
        error,
        refresh: fetchActivities
    };
}
