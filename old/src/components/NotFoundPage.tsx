import { Film } from 'lucide-react';
import { Button } from './ui/button';
import { haptics } from '../utils/haptics';

interface NotFoundPageProps {
  onNavigate: (page: string) => void;
}

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  const handleGoHome = () => {
    haptics.medium();
    onNavigate('dashboard');
  };

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* 404 Number with cinematic styling */}
        <div className="relative mb-8">
          <h1 className="text-[120px] lg:text-[160px] text-[#ec1e24] opacity-20 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white dark:bg-black rounded-full p-8 border-2 border-[#ec1e24] shadow-lg dark:shadow-[0_4px_24px_rgba(236,30,36,0.3)]">
              <Film className="w-16 h-16 text-[#ec1e24]" />
            </div>
          </div>
        </div>

        {/* Error Message */}
        <h2 className="text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h2>
        
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-8">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleGoHome}
            className="bg-[#ec1e24] hover:bg-[#d11920] text-white px-6"
          >
            Go to Dashboard
          </Button>
          
          <Button
            onClick={() => {
              haptics.light();
              window.history.back();
            }}
            variant="outline"
            className="bg-white dark:bg-black border-gray-300 dark:border-[#333333] text-gray-900 dark:text-white px-6"
          >
            Go Back
          </Button>
        </div>

        {/* Additional Help */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-[#333333]">
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">
            Need help finding something?
          </p>
          <div className="flex flex-wrap gap-3 justify-center text-sm">
            <button
              onClick={() => {
                haptics.light();
                onNavigate('channels');
              }}
              className="text-[#ec1e24] hover:underline"
            >
              Channels
            </button>
            <span className="text-gray-400">•</span>
            <button
              onClick={() => {
                haptics.light();
                onNavigate('platforms');
              }}
              className="text-[#ec1e24] hover:underline"
            >
              Platforms
            </button>
            <span className="text-gray-400">•</span>
            <button
              onClick={() => {
                haptics.light();
                onNavigate('rss');
              }}
              className="text-[#ec1e24] hover:underline"
            >
              RSS Feeds
            </button>
            <span className="text-gray-400">•</span>
            <button
              onClick={() => {
                haptics.light();
                onNavigate('tmdb');
              }}
              className="text-[#ec1e24] hover:underline"
            >
              TMDb Feeds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
