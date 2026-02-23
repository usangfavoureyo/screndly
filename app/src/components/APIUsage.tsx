import { haptics } from '../utils/haptics';

interface APIUsageProps {
  onBack: () => void;
}

export function APIUsage({ onBack }: APIUsageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#000000]">
      {/* Content */}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button
            onClick={() => {
              haptics.light();
              onBack();
            }}
            className="text-gray-900 dark:text-white hover:text-[#ec1e24] p-2 -ml-2 mt-1"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12H2M9 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="text-gray-900 dark:text-white mb-2">API Usage Activity</h1>
            <p className="text-[#6B7280] dark:text-[#9CA3AF]">Monitor your API consumption</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          {/* OpenAI */}
          <button
            onClick={() => haptics.light()}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">OpenAI</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">1,247</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>

          {/* Serper */}
          <button
            onClick={() => haptics.light()}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Serper</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">892</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>

          {/* TMDb */}
          <button
            onClick={() => haptics.light()}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">TMDb</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">3,451</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>

          {/* Shotstack */}
          <button
            onClick={() => haptics.light()}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Shotstack</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">127</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>

          {/* Google Search */}
          <button
            onClick={() => haptics.light()}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Google Search</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">543</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>

          {/* Google Video Intelligence */}
          <button
            onClick={() => haptics.light()}
            className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">GVI</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">284</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>

          {/* Total */}
          <button
            onClick={() => haptics.light()}
            className="col-span-2 lg:col-span-1 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-4 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] hover:border-[#ec1e24] dark:hover:border-[#ec1e24] transition-all duration-200 cursor-pointer text-left"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-gray-600 dark:text-[#9CA3AF]">Total</span>
            </div>
            <div className="text-2xl text-gray-900 dark:text-white mb-1">6,544</div>
            <div className="text-xs text-gray-500 dark:text-[#6B7280]">Today's calls</div>
          </button>
        </div>

        {/* Usage Breakdown Table */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-2xl shadow-sm dark:shadow-[0_2px_8px_rgba(255,255,255,0.05)] p-6 hover:shadow-md dark:hover:shadow-[0_4px_16px_rgba(255,255,255,0.08)] transition-shadow duration-200">
          <h3 className="text-gray-900 dark:text-white mb-4">Usage Summary</h3>
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
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">OpenAI API</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">1,247</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">7,593</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">27,602</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">Serper API</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">892</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">5,002</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">19,103</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">TMDb API</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">3,451</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">21,149</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">82,036</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">Shotstack API</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">127</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">891</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">3,258</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">Google Search API</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">543</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">3,214</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">12,891</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-[#333333]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">Google Video Intelligence API</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">284</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">1,893</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">7,421</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-[#0A0A0A]">
                  <td className="py-3 px-4">
                    <span className="text-gray-900 dark:text-white">Total</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">6,544</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">40,742</td>
                  <td className="text-right py-3 px-4 text-gray-900 dark:text-white">152,311</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}