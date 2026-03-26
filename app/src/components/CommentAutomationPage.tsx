import { formatDistanceToNow } from 'date-fns';
import { haptics } from '../utils/haptics';
import { XIcon } from './icons/XIcon';
import { ThreadsIcon } from './icons/ThreadsIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { TikTokIcon } from './icons/TikTokIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { PinterestIcon } from './icons/PinterestIcon';
import { useCommentAutomation } from '../contexts/CommentAutomationContext';
import { BackIconButton } from './BackIconButton';

interface CommentAutomationPageProps {
  onBack: () => void;
  previousPage?: string | null;
}

function formatReplyTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function CommentAutomationPage({ onBack }: CommentAutomationPageProps) {
  const { platformData } = useCommentAutomation();
  const enabledPlatforms = platformData.filter((platform) => platform.enabled);
  const connectedPlatforms = enabledPlatforms.filter((platform) => platform.connected);
  const readyPlatforms = enabledPlatforms.filter((platform) => platform.ready);

  const totalReplies = enabledPlatforms.reduce((sum, platform) => sum + platform.repliesToday, 0);
  const avgSuccessRate = enabledPlatforms.length > 0
    ? Math.round(enabledPlatforms.reduce((sum, platform) => sum + parseFloat(platform.successRate), 0) / enabledPlatforms.length)
    : 0;

  const getPlatformIcon = (platformName: string) => {
    switch (platformName) {
      case 'X':
        return <XIcon className="w-4.5 h-4.5" />;
      case 'Instagram':
        return <InstagramIcon className="w-6 h-6" />;
      case 'TikTok':
        return <TikTokIcon className="w-[34px] h-[34px]" />;
      case 'Facebook':
        return <FacebookIcon className="w-[26px] h-[26px]" />;
      case 'YouTube':
        return <YouTubeIcon className="w-[26px] h-[26px]" />;
      case 'Threads':
        return <ThreadsIcon className="w-5.5 h-5.5" />;
      case 'Pinterest':
        return <PinterestIcon className="w-5.5 h-5.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <BackIconButton onClick={onBack} className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1" ariaLabel="Back to previous page" />
          <div>
            <h1 className="text-gray-900 dark:text-white mb-2">Comment Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">AI-powered comment replies</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
          <div className="mb-6">
            <h2 className="text-gray-900 dark:text-white">Overall Performance</h2>
            <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Current automation activity</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] col-span-2 lg:col-span-1">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">{totalReplies}</p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Replies Today</p>
            </div>
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">{avgSuccessRate}%</p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Success Rate</p>
            </div>
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">{enabledPlatforms.length}</p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Enabled Platforms</p>
            </div>
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">{connectedPlatforms.length}</p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Connected Platforms</p>
            </div>
            <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
              <p className="text-2xl text-gray-900 dark:text-white mb-1">{readyPlatforms.length}</p>
              <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Runnable Platforms</p>
            </div>
          </div>
        </div>

        {enabledPlatforms.length === 0 ? (
          <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-8 text-center">
            <p className="text-gray-600 dark:text-[#9CA3AF]">No comment automation activity recorded yet.</p>
          </div>
        ) : enabledPlatforms.map((data) => (
          <div key={data.platform} className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center">
                  {getPlatformIcon(data.platform)}
                </div>
                <div>
                  <h3 className="text-gray-900 dark:text-white">{data.platform}</h3>
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Comment replies</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-6">
              <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs ${data.enabled ? 'bg-[#FEE2E2] dark:bg-[#991B1B] text-[#991B1B] dark:text-[#FEE2E2]' : 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]'}`}>
                    {data.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs ${data.connected ? 'bg-[#DCFCE7] dark:bg-[#14532D] text-[#166534] dark:text-[#DCFCE7]' : 'bg-gray-200 dark:bg-[#1f1f1f] text-gray-700 dark:text-[#9CA3AF]'}`}>
                    {data.connected ? `Connected${data.username ? ` as @${data.username}` : ''}` : 'Not connected'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs ${data.ready ? 'bg-[#DCFCE7] dark:bg-[#14532D] text-[#166534] dark:text-[#DCFCE7]' : 'bg-amber-100 dark:bg-[#78350F] text-amber-800 dark:text-amber-100'}`}>
                    {data.ready ? 'Ready' : 'Not runnable yet'}
                  </span>
                </div>
                {!data.ready && data.reasons.length > 0 ? (
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
                    {data.reasons[0]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
                <p className="text-2xl text-gray-900 dark:text-white mb-1">{data.repliesToday}</p>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Replies Today</p>
              </div>
              <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333]">
                <p className="text-2xl text-gray-900 dark:text-white mb-1">{data.successRate}</p>
                <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">Success Rate</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm text-gray-900 dark:text-white">Recent Replies</h4>
              {data.recentReplies.length === 0 ? (
                <div className="w-full text-left p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333]">
                  <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">No recent replies for {data.platform} yet.</p>
                </div>
              ) : data.recentReplies.map((item, index) => (
                <button
                  key={`${data.platform}-${index}`}
                  onClick={() => haptics.light()}
                  className="w-full text-left p-4 bg-white dark:bg-[#000000] rounded-xl border border-gray-200 dark:border-[#333333] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <p className="text-sm text-gray-600 dark:text-[#9CA3AF] italic flex-1">&quot;{item.comment}&quot;</p>
                    <span className="text-xs text-gray-500 dark:text-[#6B7280] ml-2 whitespace-nowrap">{formatReplyTime(item.time)}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white">↳ {item.reply || 'No reply saved'}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
