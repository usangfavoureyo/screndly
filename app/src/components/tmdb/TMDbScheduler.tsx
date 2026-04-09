import { Calendar, Clock, Lock } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

export function TMDbScheduler() {
  const { settings } = useSettings();
  const timezone = settings.timezone || 'UTC';
  const refreshTime = (settings as any).tmdbDailyRefreshTime || '07:00';
  const secondaryRefreshTime = '12:00';
  const refreshRuns = refreshTime === secondaryRefreshTime
    ? [refreshTime]
    : [refreshTime, secondaryRefreshTime];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="mb-1 text-gray-900 dark:text-white">TMDb Daily Refresh Run</h3>
        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
          All TMDb modules are evaluated together in one backend run using your app timezone: {timezone}.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#333333] dark:bg-[#000000]">
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="font-medium text-gray-900 dark:text-white">Master TMDb Refresh</h4>
            <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 dark:bg-[#111111] dark:text-[#666666]">
              <Lock className="h-3 w-3" />
              <span>System Managed</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
            The scheduler gathers Today, Anniversary, Weekly, and Monthly candidates in one run before dedupe, prioritization, and same-day scheduling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#ec1e24]" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Daily</span>
          </div>
          {refreshRuns.map((runTime, index) => (
            <div key={runTime} className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#ec1e24]" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {runTime} {timezone}
                {index === 1 ? ' catch-up refresh' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#333333] dark:bg-[#000000]">
        <h4 className="mb-4 text-gray-900 dark:text-white">Module Rules</h4>
        <div className="space-y-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
          <div><span className="text-gray-900 dark:text-white">Today:</span> exact current-day releases, same-day only.</div>
          <div><span className="text-gray-900 dark:text-white">Anniversary:</span> exact anniversary day for configured milestones, same-day only.</div>
          <div><span className="text-gray-900 dark:text-white">Weekly:</span> exact releases 7 calendar days from fetch date, same-day preferred with explicit overflow handling.</div>
          <div><span className="text-gray-900 dark:text-white">Monthly:</span> exact releases 1 calendar month from fetch date, same-day preferred with explicit overflow handling.</div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#333333] dark:bg-[#000000]">
        <h4 className="mb-4 text-gray-900 dark:text-white">Posting Distribution Strategy</h4>
        <div className="space-y-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
          <div><span className="text-gray-900 dark:text-white">Priority tiers:</span> Today and Anniversary are protected urgent modules; Weekly and Monthly fill remaining capacity.</div>
          <div><span className="text-gray-900 dark:text-white">No silent carry:</span> Weekly and Monthly use explicit overflow policy instead of silently rolling into tomorrow.</div>
          <div><span className="text-gray-900 dark:text-white">Caption accuracy:</span> Captions regenerate from the final scheduled time versus release date whenever scheduling changes.</div>
        </div>
      </div>
    </div>
  );
}
