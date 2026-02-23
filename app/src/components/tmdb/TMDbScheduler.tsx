import { Calendar, Clock, Lock } from 'lucide-react';

export function TMDbScheduler() {
  // Hardcoded schedules matching backend cron.ts
  const schedules = {
    today: { day: 'Daily', time: '06:00 UTC', description: "Refreshes daily to capture movies/TV shows releasing today" },
    weekly: { day: 'Every Monday', time: '08:00 UTC', description: "Refreshes weekly to preview upcoming releases for the next 7 days" },
    monthly: { day: 'Every Monday', time: '09:00 UTC', description: "Refreshes weekly with rolling 30-day window (drops past week, adds future week)" },
    anniversary: { day: 'Daily', time: '07:00 UTC', description: "Refreshes daily to celebrate milestone anniversaries (1, 2, 3, 5, 10+ years)" }
  };

  const renderScheduleCard = (
    title: string,
    schedule: { day: string, time: string, description: string }
  ) => {
    return (
      <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-gray-900 dark:text-white font-medium">{title}</h4>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-[#111] text-xs font-medium text-gray-500 dark:text-[#666]">
              <Lock className="w-3 h-3" />
              <span>System Managed</span>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{schedule.description}</p>
        </div>

        {/* Schedule Info */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#ec1e24]" />
            <span className="text-sm text-gray-900 dark:text-white font-medium">{schedule.day}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#ec1e24]" />
            <span className="text-sm text-gray-900 dark:text-white font-medium">{schedule.time}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="text-gray-900 dark:text-white mb-1">Feed Refresh Schedules</h3>
        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
          Feeds are refreshed by the backend system according to this optimized matrix.
        </p>
      </div>

      {renderScheduleCard("Today's Releases", schedules.today)}
      {renderScheduleCard("Weekly Releases", schedules.weekly)}
      {renderScheduleCard("Monthly Previews", schedules.monthly)}
      {renderScheduleCard("Anniversaries", schedules.anniversary)}

      {/* Distribution Strategy Summary */}
      <div className="bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-6">
        <h4 className="text-gray-900 dark:text-white mb-4">Posting Distribution Strategy</h4>
        <div className="space-y-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
          <div className="flex items-start gap-2">
            <span className="text-[#ec1e24] mt-0.5">•</span>
            <div>
              <span className="text-gray-900 dark:text-white">Progressive Countdown:</span> Same release can post in Monthly → Weekly → Today as it approaches
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#ec1e24] mt-0.5">•</span>
            <div>
              <span className="text-gray-900 dark:text-white">Feed-Aware Deduplication:</span> Within same feed: 30-day block. Across feeds: 7-day minimum gap
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#ec1e24] mt-0.5">•</span>
            <div>
              <span className="text-gray-900 dark:text-white">Dynamic Captions:</span> Varied, natural language generated per feed type using TMDb metadata
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}