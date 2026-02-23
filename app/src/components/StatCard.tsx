import { LucideIcon } from 'lucide-react';
import { haptics } from '../utils/haptics';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  iconColor: string;
  change?: string;
  changeType?: 'positive' | 'negative';
  onClick?: () => void;
}

export function StatCard({ title, value, icon: Icon, iconColor, change, changeType, onClick }: StatCardProps) {
  return (
    <div 
      className={`bg-white dark:!bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-xl dark:hover:shadow-[0_8px_24px_rgba(255,255,255,0.12)] transition-all duration-300 hover:-translate-y-1 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={() => {
        if (onClick) {
          haptics.light();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-2 transition-colors duration-200">{title}</p>
          <h2 className="text-gray-900 dark:text-white mb-2 transition-all duration-200">{value}</h2>
          {change && (
            <span
              className={`transition-all duration-200 ${
                changeType === 'positive' ? 'text-[#10B981]' : 'text-[#6B7280] dark:text-[#9CA3AF]'
              }`}
            >
              {change}
            </span>
          )}
        </div>
        <div className={`${iconColor} w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110`}>
          <Icon className="w-6 h-6 text-white transition-transform duration-300" />
        </div>
      </div>
    </div>
  );
}