/**
 * Monthly Compilation - Multi-Trailer Video Generation
 * Handles analysis and compilation of multiple trailers for monthly releases
 */

import { analyzeTrailer, TrailerAnalysis, VideoMoment } from './googleVideoIntelligence';
import { ShotstackConfig, ShotstackClip } from './shotstack';
import { calculateAutoframing } from './autoframing';
import { validateShotstackConfig, sanitizeShotstackConfig } from '../validation/shotstackSchema';
import { toast } from "sonner";

export interface MonthlyTrailerAnalysis {
  trailerId: string;
  movieTitle: string;
  analysis: TrailerAnalysis;
  bestMoments: VideoMoment[];
}

export interface MonthlyCompilationData {
  trailers: {
    title: string;
    videoUrl: string;
    file?: File;
  }[];
  voiceoverUrl: string;
  voiceoverDuration: number;
  backgroundMusicUrl?: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
  removeLetterbox?: boolean; // Scale video to fill frame and eliminate black bars
  enableAutoframing?: boolean; // AI-powered intelligent cropping to center faces/action
}

/**
 * Analyze multiple trailers for monthly compilation
 */
export async function analyzeMultipleTrailers(
  trailerFiles: File[],
  movieTitles: string[]
): Promise<MonthlyTrailerAnalysis[]> {
  const analyses: MonthlyTrailerAnalysis[] = [];
  
  for (let i = 0; i < trailerFiles.length; i++) {
    const file = trailerFiles[i];
    const title = movieTitles[i] || `Movie ${i + 1}`;
    
    try {
      const analysis = await analyzeTrailer(file);
      
      // Select best moments from this trailer (top 5 most intense scenes)
      const bestMoments = analysis.moments
        .sort((a, b) => b.intensityScore - a.intensityScore)
        .slice(0, 5);
      
      analyses.push({
        trailerId: `trailer_${i}`,
        movieTitle: title,
        analysis,
        bestMoments
      });
    } catch (error) {
      console.error(`Failed to analyze trailer for ${title}:`, error);
    }
  }
  
  return analyses;
}

/**
 * Generate Shotstack configuration for monthly compilation
 * Creates a video that showcases multiple movies with best scenes from each
 */
export function generateMonthlyCompilationJSON(
  compilationData: MonthlyCompilationData,
  trailerAnalyses: MonthlyTrailerAnalysis[],
  audioSettings: {
    backgroundMusicVolume: number;
    trailerVolume: number;
    crossfadeDuration: number;
  }
): ShotstackConfig {
  const { voiceoverDuration, aspectRatio, removeLetterbox, enableAutoframing } = compilationData;
  
  // Determine fit mode based on aspect ratio and letterbox settings
  const shouldFillFrame = removeLetterbox && (aspectRatio === '9:16' || aspectRatio === '1:1');
  const fitMode: 'cover' | 'contain' = shouldFillFrame ? 'cover' : 'contain';
  
  // Helper function to apply autoframing to a clip
  const applyAutoframingToClip = (clip: ShotstackClip, moment: VideoMoment): ShotstackClip => {
    if (!enableAutoframing || !shouldFillFrame) {
      return clip;
    }
    
    const autoframing = calculateAutoframing(
      moment,
      '16:9',
      aspectRatio as '9:16' | '1:1',
      {
        enabled: true,
        priorityMode: 'balanced',
        dynamicTracking: false
      }
    );
    
    return {
      ...clip,
      position: autoframing.position,
      offset: autoframing.offset
    };
  };
  
  // Calculate timing for each trailer segment
  const segmentDuration = voiceoverDuration / trailerAnalyses.length;
  
  const videoClips: ShotstackClip[] = [];
  const textClips: ShotstackClip[] = [];
  
  trailerAnalyses.forEach((trailerData, index) => {
    const startTime = index * segmentDuration;
    const { bestMoments, movieTitle, analysis } = trailerData;
    
    // Use opening hook for this trailer segment
    const openingMoment = analysis.suggestedHooks.opening;
    
    // Add trailer clip (5-7 seconds from opening scene)
    const clipDuration = Math.min(7, segmentDuration * 0.4);
    videoClips.push(applyAutoframingToClip({
      asset: {
        type: 'video',
        src: compilationData.trailers[index].videoUrl,
        trim: openingMoment.startTime,
        volume: audioSettings.trailerVolume / 100
      },
      start: startTime,
      length: clipDuration,
      fit: fitMode,
      transition: {
        in: index === 0 ? undefined : 'fadeIn',
        out: 'fadeOut',
        duration: audioSettings.crossfadeDuration
      }
    }, openingMoment));
    
    // Add B-roll footage for voiceover section
    const brollStart = startTime + clipDuration;
    const brollDuration = segmentDuration - clipDuration;
    
    if (brollDuration > 0) {
      // Select a dramatic moment for B-roll
      const dramaticMoment = bestMoments.find(m => 
        m.type === 'dramatic_dialogue' || m.type === 'suspense_moment'
      ) || bestMoments[0];
      
      videoClips.push(applyAutoframingToClip({
        asset: {
          type: 'video',
          src: compilationData.trailers[index].videoUrl,
          trim: dramaticMoment.startTime,
          volume: 0  // Muted during voiceover
        },
        start: brollStart,
        length: brollDuration,
        fit: fitMode,
        effect: 'zoomIn',
        transition: {
          in: 'fadeIn',
          out: index === trailerAnalyses.length - 1 ? 'fadeOut' : undefined,
          duration: audioSettings.crossfadeDuration
        }
      }, dramaticMoment));
    }
    
    // Add movie title overlay
    textClips.push({
      asset: {
        type: 'html',
        html: `<div class="movie-title">${movieTitle}</div>`,
        css: `.movie-title { 
          font-size: 42px; 
          color: white; 
          font-weight: bold; 
          text-shadow: 2px 2px 8px rgba(0,0,0,0.9);
          padding: 20px;
          background: linear-gradient(90deg, rgba(236,30,36,0.8) 0%, rgba(236,30,36,0) 100%);
        }`
      },
      start: startTime + 0.5,
      length: 3,
      position: 'bottom',
      offset: { y: 0.15 },
      transition: {
        in: 'slideLeft',
        out: 'fade'
      }
    });
  });
  
  const config: ShotstackConfig = {
    timeline: {
      tracks: [
        // Video track
        { clips: videoClips },
        
        // Voiceover track
        {
          clips: [{
            asset: {
              type: 'audio',
              src: compilationData.voiceoverUrl,
              volume: 1.0
            },
            start: 0,
            length: voiceoverDuration,
            transition: {
              in: 'fadeIn',
              out: 'fadeOut',
              duration: 1.0
            }
          }]
        },
        
        // Text overlays track
        { clips: textClips }
      ]
    },
    output: {
      format: 'mp4',
      resolution: '1080',
      aspectRatio: aspectRatio,
      fps: 30,
      quality: 'high'
    }
  };
  
  // Add background music if provided
  if (compilationData.backgroundMusicUrl) {
    config.timeline.soundtrack = {
      src: compilationData.backgroundMusicUrl,
      effect: 'fadeOut',
      volume: audioSettings.backgroundMusicVolume / 100
    };
  }
  
  // Validate and sanitize the config
  const validation = validateShotstackConfig(config);
  if (!validation.valid) {
    console.error('Shotstack validation errors:', validation.errors);
    toast.error(`Video config has ${validation.errors.length} validation error(s)`)
    return sanitizeShotstackConfig(config);
  }
  
  return config;
}

/**
 * Get summary stats for monthly compilation
 */
export function getCompilationStats(analyses: MonthlyTrailerAnalysis[]) {
  const totalScenes = analyses.reduce((sum, a) => sum + a.analysis.moments.length, 0);
  const totalDuration = analyses.reduce((sum, a) => sum + a.analysis.totalDuration, 0);
  const avgIntensity = analyses.reduce((sum, a) => {
    const avgScore = a.bestMoments.reduce((s, m) => s + m.intensityScore, 0) / a.bestMoments.length;
    return sum + avgScore;
  }, 0) / analyses.length;
  
  return {
    totalTrailers: analyses.length,
    totalScenes,
    totalDuration,
    avgIntensity,
    movieTitles: analyses.map(a => a.movieTitle)
  };
}