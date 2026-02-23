import { useState, useEffect } from 'react';
import { haptics } from '../utils/haptics';

interface AboutPageProps {
  onNavigate: (page: string) => void;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleBack = () => {
    haptics.light();
    if (isDesktop) {
      onNavigate('dashboard');
    } else {
      onNavigate('settings');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000] flex flex-col">
      <div className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="flex items-start gap-4 mb-8">
          <button
            onClick={handleBack}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="text-gray-900 dark:text-white">About</h1>
        </div>
        
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-4 text-gray-700 dark:text-[#D1D5DB]">
          <p>
            Screndly is a Screen Render automation app built exclusively for Screen Render social-media automation. It provides a dedicated infrastructure for running high-frequency, high-volume media operations without manual intervention.
          </p>
          
          <p>
            It is a web platform for automated media workflows that can generate, edit, schedule, and publish branded content through AI and programmable automation. The system removes repetitive tasks from content pipelines for creators, marketers, and developers.
          </p>
          
          <p>
            Screndly unifies storage, job queues, publishing endpoints, and rendering functions into a single dashboard, allowing scalable automation without writing code. Every component is optimized for heavy task execution, hands-off scheduling, and fast iteration of content formats.
          </p>
          
          <p>
            The platform prioritizes stability, predictability, and performance rather than vanity features. It is engineered to remain reliable under continuous load and to support the long-term automation requirements of the Screen Render ecosystem.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-[#374151] py-8 px-6 mt-12">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex flex-wrap gap-2 justify-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            <button onClick={() => onNavigate('privacy')} className="hover:text-[#ec1e24]">Privacy</button>
            <span>•</span>
            <button onClick={() => onNavigate('terms')} className="hover:text-[#ec1e24]">Terms</button>
            <span>•</span>
            <button onClick={() => onNavigate('disclaimer')} className="hover:text-[#ec1e24]">Disclaimer</button>
            <span>•</span>
            <button onClick={() => onNavigate('cookie')} className="hover:text-[#ec1e24]">Cookie</button>
            <span>•</span>
            <button onClick={() => onNavigate('contact')} className="hover:text-[#ec1e24]">Contact</button>
            <span>•</span>
            <button onClick={() => onNavigate('about')} className="hover:text-[#ec1e24]">About</button>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-[#9CA3AF]">
            ©️ 2026, Screndly. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}