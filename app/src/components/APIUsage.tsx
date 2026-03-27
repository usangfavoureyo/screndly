import { useEffect, useMemo, useState } from 'react';
import { haptics } from '../utils/haptics';
import { dashboardApi, type ApiUsageActivity, type ApiUsageService } from '../lib/api/dashboard';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { BackIconButton } from './BackIconButton';

interface APIUsageProps {
  onBack: () => void;
  previousPage?: string | null;
}

const numberFormatter = new Intl.NumberFormat('en-US');

const cardDefinitions: Array<{
  key: ApiUsageService | 'total';
  label: string;
  cardLabel: string;
  className?: string;
}> = [
  { key: 'openai', label: 'OpenAI', cardLabel: "Today's calls" },
  { key: 'serper', label: 'Serper', cardLabel: "Today's calls" },
  { key: 'tmdb', label: 'TMDb', cardLabel: "Today's calls" },
  { key: 'shotstack', label: 'Shotstack', cardLabel: "Today's calls" },
  { key: 'googleSearch', label: 'Google Search', cardLabel: "Today's calls" },
  { key: 'googleVideo', label: 'GVI', cardLabel: "Today's calls" },
  { key: 'total', label: 'Total', cardLabel: "Today's calls", className: 'col-span-2 lg:col-span-1' },
];

export function APIUsage({ onBack }: APIUsageProps) {
  const [usage, setUsage] = useState<ApiUsageActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchUsage = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await dashboardApi.getApiUsage();
        if (!response.success || !response.data) {
          const message = response.error?.message || 'Failed to load API usage activity';
          if (!cancelled) {
            setErrorMessage(message);
            toast.error(message);
          }
          return;
        }

        if (!cancelled) {
          setUsage(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Failed to load API usage activity';
          setErrorMessage(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchUsage();

    return () => {
      cancelled = true;
    };
  }, []);

  const summaryRows = useMemo(() => usage?.summary ?? [], [usage]);

  const renderCardValue = (key: ApiUsageService | 'total') => {
    if (isLoading) {
      return <Skeleton className="h-8 w-16" />;
    }

    const value = key === 'total'
      ? usage?.cards.total ?? 0
      : usage?.cards[key] ?? 0;

    return <>{numberFormatter.format(value)}</>;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      {/* Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <BackIconButton
            onClick={() => {
              onBack();
            }}
            className="mt-0.5"
          />
          <div>
            <h1 className="text-gray-900 dark:text-white mb-2">API Usage Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">Monitor your API consumption</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          {cardDefinitions.map((card) => (
            <button
              key={card.key}
              onClick={() => haptics.light()}
              className={`${card.className ?? ''} bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">{card.label}</span>
              </div>
              <div className="text-2xl text-gray-900 dark:text-white mb-1">{renderCardValue(card.key)}</div>
              <div className="text-xs text-gray-500 dark:text-[#6B7280]">{card.cardLabel}</div>
            </button>
          ))}
        </div>

        {/* Usage Breakdown Table */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
          <h3 className="text-gray-900 dark:text-white mb-4">Usage Summary</h3>
          {errorMessage && !isLoading ? (
            <p className="text-sm text-[#ec1e24] mb-4">{errorMessage}</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-[#9CA3AF]">API Service</th>
                  <th className="text-right py-3 px-4 text-gray-600 dark:text-[#9CA3AF]">Daily</th>
                  <th className="text-right py-3 px-4 text-gray-600 dark:text-[#9CA3AF]">Weekly</th>
                  <th className="text-right py-3 px-4 text-gray-600 dark:text-[#9CA3AF]">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1, 2, 3, 4, 5, 6, 7].map((row) => (
                    <tr key={row} className="border-b border-gray-200 dark:border-[#333333]">
                      <td className="py-3 px-4"><Skeleton className="h-5 w-28" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-16 ml-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-16 ml-auto" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : summaryRows.length ? (
                  summaryRows.map((row) => (
                    <tr
                      key={row.service}
                      className={row.service === 'total'
                        ? 'bg-gray-50 dark:bg-[#0A0A0A]'
                        : 'border-b border-gray-200 dark:border-[#333333]'}
                    >
                      <td className="py-3 px-4">
                        <span className="text-gray-900 dark:text-white">{row.label}</span>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-900 dark:text-white">{numberFormatter.format(row.daily)}</td>
                      <td className="text-right py-3 px-4 text-gray-900 dark:text-white">{numberFormatter.format(row.weekly)}</td>
                      <td className="text-right py-3 px-4 text-gray-900 dark:text-white">{numberFormatter.format(row.monthly)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 px-4 text-center text-gray-500 dark:text-[#6B7280]">
                      No tracked API calls yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
