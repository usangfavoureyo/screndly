import { useState, useEffect } from 'react';
import { haptics } from '../utils/haptics';

interface ContactPageProps {
  onNavigate: (page: string) => void;
}

export function ContactPage({ onNavigate }: ContactPageProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const SUPPORT_EMAIL = 'screndlyapp@gmail.com';
  const LEGAL_EMAIL = 'screndlyapp@gmail.com';

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
          <h1 className="text-gray-900 dark:text-white">Contact</h1>
        </div>
        
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] p-6 rounded-2xl space-y-4 text-gray-700 dark:text-[#D1D5DB]">
          <p>
            Support inquiries and account issues are handled by email.
          </p>
          
          <div className="bg-gray-100 dark:bg-[#111111] rounded-xl p-6 space-y-3">
            <div>
              <p className="text-gray-900 dark:text-white">Primary support:</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#ec1e24] hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </div>
            
            <div>
              <p className="text-gray-900 dark:text-white">
                Abuse reports, DMCA notices, or platform security concerns should include relevant evidence and be sent to:
              </p>
              <a href={`mailto:${LEGAL_EMAIL}`} className="text-[#ec1e24] hover:underline">
                {LEGAL_EMAIL}
              </a>
            </div>
          </div>
          
          <p>
            Typical response time is 24–72 hours depending on workload. Screndly does not offer phone-based support and does not process support requests through social media.
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
