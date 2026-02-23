/**
 * Account Settings - Logout and session management
 */

import { Button } from '../ui/button';
import { toast } from "sonner";
import { haptics } from '../../utils/haptics';
import { logout } from '../../lib/auth';
import { LogOut, Shield, Clock } from 'lucide-react';

export function AccountSettings() {
  const handleLogout = () => {
    haptics.medium();
    
    if (confirm('Are you sure you want to logout? You will need to enter your password again.')) {
      haptics.success();
      toast.success('Logged out successfully');
      logout();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl text-black dark:text-white mb-1">Account</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage your authentication and session settings
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Security Status */}
        <div className="space-y-4">
          <h3 className="text-black dark:text-white mb-4">Security</h3>
          
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-green-900 dark:text-green-100">
                <strong>Authenticated</strong>
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Your session is secured with JWT authentication
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333333]">
            <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-100">
                <strong>Session Expiry</strong>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Your session will expire after 7 days of inactivity
              </p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-black dark:text-white">Session Management</h3>
          
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full sm:w-auto gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              You'll need to enter your password again to access the app
            </p>
          </div>
        </div>

        {/* Security Features */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-[#333333]">
          <h3 className="text-black dark:text-white mb-3">Security Features</h3>
          
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>JWT-based authentication with cryptographic signatures</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>Server-side password validation (never exposed in client code)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>Rate limiting (5 failed attempts = 15-minute lockout)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>Automatic session expiry after 7 days</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
              <span>Timing-safe password comparison (prevents timing attacks)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
