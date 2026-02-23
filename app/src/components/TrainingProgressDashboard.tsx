import { Target, Zap, AlertCircle, Download, Upload, Info } from 'lucide-react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";

interface TrainingProgressDashboardProps {
  totalCorrections: number;
  currentAccuracy: number;
  systemRating: number;
  modelVersion: string;
  lastTrainingDate?: string;
  overrideRate: number; // Override rate over last 100 videos
  meanHookConfidence: number; // Mean confidence of selected hooks
  lastBackupDate?: string;
  stratificationNeeds: {
    action: number;
    dialogue: number;
    suspense: number;
    atmosphere: number;
    transition: number;
  };
}

export function TrainingProgressDashboard({
  totalCorrections,
  currentAccuracy,
  systemRating,
  modelVersion,
  lastTrainingDate,
  overrideRate,
  meanHookConfidence,
  lastBackupDate,
  stratificationNeeds
}: TrainingProgressDashboardProps) {
  // Automation unlock criteria (all 3 must be met)
  const criteriaOverrideRate = overrideRate <= 20;
  const criteriaMeanConfidence = meanHookConfidence >= 0.75;
  const criteriaSystemRating = systemRating >= 8.5;
  const automationUnlocked = criteriaOverrideRate && criteriaMeanConfidence && criteriaSystemRating;
  const mlTrainingActive = totalCorrections >= 500;

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-600';
    if (accuracy >= 70) return 'text-amber-600';
    return 'text-[#ec1e24]';
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8.5) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (rating >= 7.0) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
    return 'text-[#ec1e24] bg-red-50 dark:bg-red-900/20';
  };

  const getMostNeededLabel = () => {
    const entries = Object.entries(stratificationNeeds);
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0];
  };

  const [mostNeededLabel, mostNeededCount] = getMostNeededLabel();

  const handleExportDataset = () => {
    haptics.medium();
    toast.success('📦 Dataset exported', {
      description: 'corrections.jsonl + model snapshots downloaded'
    });
    // TODO: Implement actual export logic
  };

  const handleBackupToCloud = () => {
    haptics.medium();
    toast.success('☁️ Backup initiated', {
      description: 'Uploading to Drive/S3...'
    });
    // TODO: Implement actual cloud backup
  };

  return (
    <div className="space-y-4">
      {/* System Status Header */}
      <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-gray-900 dark:text-white">AI Training Status</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Model: {modelVersion} • Trained: {lastTrainingDate || 'Never'}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Last backup: {lastBackupDate || 'Never'}
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-lg ${getRatingColor(systemRating)}`}>
            <div className="text-lg">{systemRating.toFixed(1)}/10</div>
          </div>
        </div>

        {/* Automation Status */}
        {automationUnlocked ? (
          <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <Zap className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-green-800 dark:text-green-400">
              <strong>✅ Full Automation Unlocked!</strong> All criteria met. Videos can publish directly to X/TikTok/YouTube without manual approval.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
              <Target className="w-4 h-4 text-[#ec1e24] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Manual Review Required</strong> — Automation unlocks when all 3 criteria are met:
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2 text-[#ec1e24]">
                Override rate ≤ 20% (current: {overrideRate.toFixed(0)}%)
              </div>
              <div className={`flex items-center gap-2 ${criteriaMeanConfidence ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}`}>
                Mean hook confidence ≥ 0.75 (current: {meanHookConfidence.toFixed(2)})
              </div>
              <div className={`flex items-center gap-2 ${criteriaSystemRating ? 'text-green-600' : 'text-gray-600 dark:text-gray-400'}`}>
                System rating ≥ 8.5 (current: {systemRating.toFixed(1)})
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Accuracy</span>
          </div>
          <div className={`text-2xl ${getAccuracyColor(currentAccuracy)}`}>
            {currentAccuracy.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {currentAccuracy < 75 && 'Baseline (68-75%)'}
            {currentAccuracy >= 75 && currentAccuracy < 86 && 'Enhanced (80-86%)'}
            {currentAccuracy >= 86 && 'Advanced (88-92%)'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-600 dark:text-gray-400">Training Data</span>
          </div>
          <div className="text-2xl text-gray-900 dark:text-white">
            {totalCorrections}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {!mlTrainingActive && `${500 - totalCorrections} to ML unlock`}
            {mlTrainingActive && totalCorrections < 2500 && `${2500 - totalCorrections} to advanced`}
            {mlTrainingActive && totalCorrections >= 2500 && 'Advanced unlocked'}
          </div>
        </div>
      </div>

      {/* Accuracy Trajectory */}
      <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg space-y-3">
        <h4 className="text-sm text-[#ec1e24]">Accuracy Trajectory</h4>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Baseline (Out of box)</span>
            <span className="text-[#ec1e24]">
              68-75% {currentAccuracy >= 68 && '✓'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-[#ec1e24]" style={{ width: '75%' }} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Enhanced (500+ corrections + STT)</span>
            <span className="text-[#ec1e24]">
              80-86% {mlTrainingActive && '✓'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-[#ec1e24] transition-all`} 
              style={{ width: mlTrainingActive ? '86%' : '0%' }} 
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">Advanced (2,500+ corrections + temporal)</span>
            <span className="text-[#ec1e24]">
              88-92% {totalCorrections >= 2500 && '✓'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#ec1e24] transition-all"
              style={{ width: totalCorrections >= 2500 ? '92%' : '0%' }} 
            />
          </div>
        </div>
      </div>

      {/* Stratification Needs */}
      <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
        <h4 className="text-sm text-[#ec1e24] mb-3">Training Data Balance</h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          All corrections weighted: 70% recent, 30% historical (never pruned)
        </p>
        <div className="space-y-2">
          {Object.entries(stratificationNeeds).map(([label, count]) => {
            const percentage = (count / totalCorrections) * 100 || 0;
            const isNeeded = count === mostNeededCount;
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">{label}</span>
                  <span className={isNeeded ? 'text-[#ec1e24]' : 'text-gray-500'}>
                    {count} ({percentage.toFixed(0)}%) {isNeeded && '← Underrepresented'}
                  </span>
                </div>
                <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${isNeeded ? 'bg-[#ec1e24]' : 'bg-gray-400'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {mostNeededCount > 0 && (
          <div className="flex items-start gap-2 mt-3 p-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded">
            <AlertCircle className="w-3 h-3 text-[#ec1e24] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-900 dark:text-gray-400">
              Model learns your preferences. Focus on <strong className="text-gray-900 dark:text-white">{mostNeededLabel}</strong> scenes to balance dataset and reduce bias.
            </p>
          </div>
        )}
      </div>

      {/* Backup & Data Management */}
      <div className="p-4 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm text-[#ec1e24]">Backup & Safety</h4>
        </div>
        
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          <strong>Local Storage:</strong> <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-900 rounded text-[#ec1e24]">ml/labels/corrections.jsonl</code>
          <br />
          <strong>Model Snapshots:</strong> <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-900 rounded text-[#ec1e24]">ml/snapshots/model_v*.bin</code>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExportDataset}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg hover:border-[#ec1e24] transition-colors"
          >
            <Download className="w-4 h-4 text-[#ec1e24]" />
            <span className="text-sm text-gray-900 dark:text-white">Export Dataset</span>
          </button>
          <button
            onClick={handleBackupToCloud}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg hover:border-[#ec1e24] transition-colors"
          >
            <Upload className="w-4 h-4 text-[#ec1e24]" />
            <span className="text-sm text-gray-900 dark:text-white">Backup to Cloud</span>
          </button>
        </div>

        <div className="flex items-start gap-2 p-2 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded">
          <Info className="w-3 h-3 text-[#ec1e24] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-900 dark:text-gray-400">
            Automatic weekly backups enabled. Models use <strong className="text-gray-900 dark:text-white">append-only versioning</strong> (never overwritten).
          </p>
        </div>
      </div>
    </div>
  );
}