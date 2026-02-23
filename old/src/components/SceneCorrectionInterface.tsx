import { ThumbsUp, ThumbsDown, Edit2, Award, TrendingUp, Target } from 'lucide-react';
import { useState } from 'react';
import { haptics } from '../utils/haptics';
import { toast } from "sonner";

interface DetectedScene {
  id: string;
  timestamp: string;
  duration: number;
  predictedLabel: 'action' | 'dialogue' | 'suspense' | 'atmosphere' | 'transition';
  confidence: number;
  reasoning: {
    audioEnergy: number;
    spectralFlux: number;
    zeroCrossingRate: number;
    tempo?: number;
  };
  thumbnailUrl?: string;
}

interface SceneCorrectionInterfaceProps {
  scenes: DetectedScene[];
  totalCorrections: number;
  accuracyImprovement: number;
  overrideRate: number; // Override rate over last 100 videos
  onCorrection: (sceneId: string, isCorrect: boolean, correctedLabel?: string) => void;
}

export function SceneCorrectionInterface({
  scenes,
  totalCorrections,
  accuracyImprovement,
  overrideRate,
  onCorrection
}: SceneCorrectionInterfaceProps) {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<string | null>(null);

  const progressToMLTraining = (totalCorrections / 500) * 100;
  const isMLUnlocked = totalCorrections >= 500;
  const progressToAdvanced = (totalCorrections / 2500) * 100;

  const handleCorrection = (sceneId: string, isCorrect: boolean) => {
    haptics.medium();
    onCorrection(sceneId, isCorrect);
    toast.success(isCorrect ? '✅ Confirmed correct' : '❌ Marked for retraining', {
      description: `${totalCorrections + 1} corrections • Model improving...`
    });
  };

  const handleRelabel = (sceneId: string, newLabel: string) => {
    haptics.medium();
    onCorrection(sceneId, false, newLabel as any);
    setEditingScene(null);
    toast.success(`🏷️ Relabeled as "${newLabel}"`, {
      description: 'Saved to local corrections.jsonl'
    });
  };

  const getLabelColor = (label: string) => {
    switch (label) {
      case 'action': return 'text-[#ec1e24] bg-red-50 dark:bg-red-900/20';
      case 'dialogue': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'suspense': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
      case 'atmosphere': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'transition': return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (confidence >= 0.5) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
    return 'text-[#ec1e24] bg-red-50 dark:bg-red-900/20';
  };

  return (
    <div className="space-y-4">
      {/* Training Progress Header */}
      <div className="p-4 bg-gradient-to-r from-[#ec1e24]/10 to-purple-500/10 border border-[#ec1e24]/20 rounded-xl">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-[#ec1e24]" />
              <h3 className="text-gray-900 dark:text-white">Training Progress</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Corrections stored locally • Append-only dataset
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl text-[#ec1e24]">{totalCorrections}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">total corrections</div>
          </div>
        </div>

        {/* Progress to ML Training */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              {isMLUnlocked ? '✅ ML Training Unlocked' : 'Progress to ML Training'}
            </span>
            <span className={isMLUnlocked ? 'text-green-600' : 'text-[#ec1e24]'}>
              {totalCorrections} / 500 corrections
            </span>
          </div>
          <div className="h-2 bg-white dark:bg-black rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${isMLUnlocked ? 'bg-green-500' : 'bg-[#ec1e24]'}`}
              style={{ width: `${Math.min(progressToMLTraining, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Accuracy Gain</div>
              <div className="text-sm text-gray-900 dark:text-white">+{accuracyImprovement.toFixed(1)}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#ec1e24]" />
            <div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Override Rate (Last 100)</div>
              <div className={`text-sm ${overrideRate <= 20 ? 'text-green-600' : 'text-amber-600'}`}>
                {overrideRate.toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scene Corrections */}
      <div className="space-y-2">
        <h4 className="text-sm text-[#ec1e24]">Review Detected Scenes</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className="p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-900 dark:text-white">{scene.timestamp}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getLabelColor(scene.predictedLabel)}`}>
                      {scene.predictedLabel}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getConfidenceColor(scene.confidence)}`}>
                      {(scene.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  {expandedScene === scene.id && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded text-xs space-y-1">
                      <div className="text-gray-600 dark:text-gray-400">
                        <strong>Why {scene.predictedLabel}?</strong>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Audio Energy: <span className="text-[#ec1e24]">{scene.reasoning.audioEnergy.toFixed(2)}</span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Spectral Flux: <span className="text-[#ec1e24]">{scene.reasoning.spectralFlux.toFixed(2)}</span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        Zero Crossing: <span className="text-[#ec1e24]">{scene.reasoning.zeroCrossingRate.toFixed(2)}</span>
                      </div>
                      {scene.reasoning.tempo && (
                        <div className="text-gray-700 dark:text-gray-300">
                          Tempo: <span className="text-[#ec1e24]">{scene.reasoning.tempo.toFixed(0)} BPM</span>
                        </div>
                      )}
                    </div>
                  )}

                  {editingScene === scene.id && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['action', 'dialogue', 'suspense', 'atmosphere', 'transition'].map((label) => (
                        <button
                          key={label}
                          onClick={() => handleRelabel(scene.id, label)}
                          className={`text-xs px-3 py-1 rounded transition-all ${getLabelColor(label)} hover:opacity-80`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Show reasoning"
                  >
                    <Target className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => {
                      haptics.light();
                      setEditingScene(editingScene === scene.id ? null : scene.id);
                    }}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="Relabel"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleCorrection(scene.id, true)}
                    className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors"
                    title="Correct"
                  >
                    <ThumbsUp className="w-4 h-4 text-green-600" />
                  </button>
                  <button
                    onClick={() => handleCorrection(scene.id, false)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Incorrect"
                  >
                    <ThumbsDown className="w-4 h-4 text-[#ec1e24]" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Milestone Tracking */}
      {!isMLUnlocked && (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
          <p className="text-xs text-purple-800 dark:text-purple-400">
            💡 <strong>{500 - totalCorrections} more corrections</strong> to unlock enhanced ML model training. 
            All corrections saved to <code className="px-1 py-0.5 bg-purple-900/20 rounded">ml/labels/corrections.jsonl</code>
          </p>
        </div>
      )}
      {isMLUnlocked && totalCorrections < 2500 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-400">
            ⚡ ML Training Active • <strong>{2500 - totalCorrections} corrections</strong> until Advanced model (temporal + context aware)
          </p>
        </div>
      )}
    </div>
  );
}
