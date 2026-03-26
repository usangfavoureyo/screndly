import { AlertCircle } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { Switch } from './ui/switch';
import type { AIModelId } from '../lib/ai/models';

type AnalysisBackend = 'google-vi' | 'ffmpeg-fallback';
type QualityMode = 'fast' | 'quality';
type AIModel = Extract<AIModelId, 'gpt-5.4' | 'gpt-5.4-mini' | 'gpt-5.4-nano' | 'flash-3'>;

interface AnalysisSettingsPanelProps {
  backend: AnalysisBackend;
  onBackendChange: (backend: AnalysisBackend) => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  enableSTT: boolean;
  onEnableSTTChange: (enabled: boolean) => void;
  estimatedCost: number;
  monthlyBudget: number;
  monthlySpend: number;
  aiModel?: AIModel;
  onAIModelChange?: (model: AIModel) => void;
}

export function AnalysisSettingsPanel({
  backend,
  onBackendChange,
  qualityMode,
  onQualityModeChange,
  enableSTT,
  onEnableSTTChange,
  estimatedCost,
  monthlyBudget,
  monthlySpend,
  aiModel,
  onAIModelChange
}: AnalysisSettingsPanelProps) {
  const budgetPercentage = (monthlySpend / monthlyBudget) * 100;
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-gray-900 dark:text-white">Video Studio Settings</h3>
      </div>

      {/* Backend Selection */}
      <div className="space-y-2">
        <label className="text-sm text-[#ec1e24]">Analysis Backend</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              haptics.light();
              onBackendChange('google-vi');
            }}
            className={`p-3 rounded-lg border-2 transition-all text-left ${backend === 'google-vi'
              ? 'border-[#ec1e24] bg-[#ec1e24]/5'
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
          >
            <div className="mb-1">
              <span className="text-sm text-gray-900 dark:text-white">Google VI</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-left">High accuracy</p>
            <p className="text-xs text-[#ec1e24] mt-1 text-left">~$0.22/video</p>
          </button>

          <button
            onClick={() => {
              haptics.light();
              onBackendChange('ffmpeg-fallback');
            }}
            className={`p-3 rounded-lg border-2 transition-all text-left ${backend === 'ffmpeg-fallback'
              ? 'border-[#ec1e24] bg-[#ec1e24]/5'
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
          >
            <div className="mb-1">
              <span className="text-sm text-gray-900 dark:text-white">FFmpeg</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-left">Fallback mode</p>
            <p className="text-xs text-green-600 mt-1 text-left">Free (local)</p>
          </button>
        </div>
        {backend === 'ffmpeg-fallback' && (
          <div className="flex items-start gap-2 p-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg">
            <AlertCircle className="w-4 h-4 text-[#ec1e24] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-500 dark:text-gray-500">
              <strong>Fallback Mode:</strong> Uses histogram-based shot detection. Lower accuracy (~60-65%) but zero API cost. Good for testing or budget constraints.
            </div>
          </div>
        )}
      </div>

      {/* AI Model Selection */}
      {aiModel && onAIModelChange && (
        <div className="space-y-2">
          <label className="text-sm text-[#ec1e24]">AI Model (Scene Detection)</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                haptics.light();
                onAIModelChange('gpt-5.4');
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${aiModel === 'gpt-5.4'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
            >
              <div className="mb-1">
                <span className="text-sm text-gray-900 dark:text-white">GPT-5.4</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-left">Most accurate</p>
            </button>

            <button
              onClick={() => {
                haptics.light();
                onAIModelChange('gpt-5.4-mini');
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${aiModel === 'gpt-5.4-mini'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
            >
              <div className="mb-1">
                <span className="text-sm text-gray-900 dark:text-white">GPT-5.4 Mini</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-left">Faster & cheaper</p>
            </button>

            <button
              onClick={() => {
                haptics.light();
                onAIModelChange('gpt-5.4-nano');
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${aiModel === 'gpt-5.4-nano'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
            >
              <div className="mb-1">
                <span className="text-sm text-gray-900 dark:text-white">GPT-5.4 Nano</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-left">Budget-friendly</p>
            </button>

            <button
              onClick={() => {
                haptics.light();
                onAIModelChange('flash-3');
              }}
              className={`p-3 rounded-lg border-2 transition-all text-left ${aiModel === 'flash-3'
                ? 'border-[#ec1e24] bg-[#ec1e24]/5'
                : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
                }`}
            >
              <div className="mb-1">
                <span className="text-sm text-gray-900 dark:text-white">Flash 3</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-left">High Speed</p>
            </button>
          </div>
        </div>
      )}

      {/* Quality Mode */}
      <div className="space-y-2">
        <label className="text-sm text-[#ec1e24]">Processing Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              haptics.light();
              onQualityModeChange('fast');
            }}
            className={`p-3 rounded-lg border-2 transition-all text-left ${qualityMode === 'fast'
              ? 'border-[#ec1e24] bg-[#ec1e24]/5'
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
          >
            <div className="mb-1">
              <span className="text-sm text-gray-900 dark:text-white">Fast</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-left">~30-45s per video</p>
          </button>

          <button
            onClick={() => {
              haptics.light();
              onQualityModeChange('quality');
            }}
            className={`p-3 rounded-lg border-2 transition-all text-left ${qualityMode === 'quality'
              ? 'border-[#ec1e24] bg-[#ec1e24]/5'
              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
          >
            <div className="mb-1">
              <span className="text-sm text-gray-900 dark:text-white">Quality</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 text-left">~60-90s per video</p>
          </button>
        </div>
      </div>

      {/* Selective STT */}
      <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-900 dark:text-white mb-1">
              <strong>Selective Speech-to-Text (Whisper)</strong>
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Transcribe dialogue scenes for +8-12% accuracy. Runs locally (CPU/GPU auto-detect), zero API cost, privacy-first.
            </p>
            {enableSTT && (
              <p className="text-xs text-[#ec1e24] mt-2">
                Free • Adds ~15-20s processing time
              </p>
            )}
          </div>
          <Switch
            checked={enableSTT}
            onCheckedChange={(checked) => {
              haptics.light();
              onEnableSTTChange(checked);
            }}
          />
        </div>
      </div>

      {/* Cost & Budget Tracking */}
      <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Estimated Cost (This Video)</span>
          <span className="text-gray-900 dark:text-white">${estimatedCost.toFixed(2)}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Monthly Spend</span>
            <span className="text-[#ec1e24]">
              ${monthlySpend.toFixed(2)} / ${monthlyBudget.toFixed(2)} ({budgetPercentage.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#ec1e24] transition-all"
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
        </div>

        {budgetPercentage > 90 && (
          <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
            <AlertCircle className="w-3 h-3 text-[#ec1e24] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#ec1e24]">
              ⚠️ {budgetPercentage.toFixed(0)}% of monthly threshold reached. Consider switching to FFmpeg fallback.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
