/**
 * Authentication Provider
 * Manages auth state and protects the app
 * 
 * PUBLIC ROUTES: Legal pages are accessible without authentication
 * for platform compliance (Meta, TikTok, etc.)
 */

import { useState, useEffect, ReactNode, lazy, Suspense } from 'react';
import { hasStoredAuthSession, verifyAuth } from '../../lib/auth';
import { LoginPage } from '../LoginPage';

// Lazy load public pages (using named exports)
const PrivacyPage = lazy(() => import('../PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('../TermsPage').then(m => ({ default: m.TermsPage })));
const DataDeletionPage = lazy(() => import('../DataDeletionPage').then(m => ({ default: m.DataDeletionPage })));
const CookiePage = lazy(() => import('../CookiePage').then(m => ({ default: m.CookiePage })));
const DisclaimerPage = lazy(() => import('../DisclaimerPage').then(m => ({ default: m.DisclaimerPage })));
const AboutPage = lazy(() => import('../AboutPage').then(m => ({ default: m.AboutPage })));
const ContactPage = lazy(() => import('../ContactPage').then(m => ({ default: m.ContactPage })));

// Public routes that don't require authentication
const PUBLIC_ROUTES: Record<string, React.ComponentType<any>> = {
    '/privacy': PrivacyPage,
    '/terms': TermsPage,
    '/data-deletion': DataDeletionPage,
    '/legal/privacy': PrivacyPage,
    '/legal/terms': TermsPage,
    '/legal/data-deletion': DataDeletionPage,
    '/cookies': CookiePage,
    '/disclaimer': DisclaimerPage,
    '/about': AboutPage,
    '/contact': ContactPage,
};

interface AuthProviderProps {
    children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
        if (typeof window === 'undefined') {
            return null;
        }

        return hasStoredAuthSession() ? true : null;
    });

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            const isValid = await verifyAuth();
            if (!isMounted) {
                return;
            }

            setIsAuthenticated(isValid);
        };

        checkAuth();

        return () => {
            isMounted = false;
        };
    }, []);

    // Check if current path is a public route
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const PublicComponent = PUBLIC_ROUTES[currentPath];

    // If this is a public route, render it directly without auth check
    if (PublicComponent) {
        return (
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-white dark:bg-black"><div className="text-gray-600 dark:text-gray-400">Loading...</div></div>}>
                <PublicComponent onNavigate={() => window.location.href = '/'} />
            </Suspense>
        );
    }

    // Show nothing while checking auth (prevents flash)
    if (isAuthenticated === null) {
        return null;
    }

    // Show login if not authenticated
    if (!isAuthenticated) {
        return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
    }

    // Show app if authenticated
    return <>{children}</>;
}
