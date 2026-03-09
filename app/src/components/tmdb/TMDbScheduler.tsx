import { Calendar, Clock, Lock } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

type ScheduleCard = {
  title: string;
  cadence: string;
  time: string;
  description: string;
};

const schedules: ScheduleCard[] = [
  {
    title: "Today's Releases",
    cadence: 'Daily',
    time: '06:00',
    description: 'Refreshes daily for titles releasing today.',
  },
  {
    title: 'Weekly Releases',
    cadence: 'Daily',
    time: '08:00',
    description: 'Refreshes daily for titles releasing in 1-7 days.',
  },
  {
    title: 'Monthly Previews',
    cadence: 'Daily',
    time: '09:00',
    description: 'Refreshes daily for titles releasing in 8-30 days.',
  },
  {
    title: 'Anniversaries',
    cadence: 'Daily',
    time: '07:00',
    description: 'Refreshes daily for anniversary titles matching your selected milestone years.',
  },
];

function ScheduleCardView({ schedule }: { schedule: ScheduleCard }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#333333] dark:bg-[#000000]">
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-medium text-gray-900 dark:text-white">{schedule.title}</h4>
          <div className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 dark:bg-[#111111] dark:text-[#666666]">
            <Lock className="h-3 w-3" />
            <span>System Managed</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">{schedule.description}</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#ec1e24]" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{schedule.cadence}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#ec1e24]" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{schedule.time}</span>
        </div>
      </div>
    </div>
  );
}

export function TMDbScheduler() {
  const { settings } = useSettings();
  const timezone = settings.timezone || 'UTC';

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h3 className="mb-1 text-gray-900 dark:text-white">Feed Refresh Schedules</h3>
        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
          Feeds are refreshed by the backend using the current live schedule in your app timezone: {timezone}.
        </p>
      </div>

      {schedules.map((schedule) => (
        <ScheduleCardView
          key={schedule.title}
          schedule={{ ...schedule, time: `${schedule.time} ${timezone}` }}
        />
      ))}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#333333] dark:bg-[#000000]">
        <h4 className="mb-4 text-gray-900 dark:text-white">Posting Distribution Strategy</h4>
        <div className="space-y-3 text-sm text-gray-600 dark:text-[#9CA3AF]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-[#ec1e24]">-</span>
            <div>
              <span className="text-gray-900 dark:text-white">Progressive Countdown:</span> The same title can appear once in Monthly, Weekly, and Today as release day gets closer.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-[#ec1e24]">-</span>
            <div>
              <span className="text-gray-900 dark:text-white">Stage Windows:</span> Today = 0 days, Weekly = 1-7 days, Monthly = 8-30 days.
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-[#ec1e24]">-</span>
            <div>
              <span className="text-gray-900 dark:text-white">Feed Retention:</span> Unposted queued TMDb feed items are removed automatically based on your feed-retention setting below.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
