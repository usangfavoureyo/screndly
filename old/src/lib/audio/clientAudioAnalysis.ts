/**
 * Client-Side Audio Analysis for Video Studio
 * Uses Web Audio API for privacy-preserving, cost-free audio feature extraction
 */

export interface AudioFeatures {
  avgVolume: number;        // 0-1: RMS volume
  dynamicRange: number;     // 0-1: Variance in volume
  speechProbability: number; // 0-1: Likelihood of speech (1 - spectral flatness)
}

export interface ShotAudioFeatures extends AudioFeatures {
  startTime: number;
  endTime: number;
  duration: number;
}



/**
 * Analyze all shots in a video using HTML5 video element
 */
export async function analyzeAllShots(
  videoFile: File,
  shots: Array<{ startTime: number; endTime: number }>
): Promise<ShotAudioFeatures[]> {
  try {
    console.log('🎵 Starting audio analysis for', shots.length, 'shots...');
    
    // Create video element to extract audio
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);
    video.preload = 'metadata';
    
    // Wait for video to load
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Video load timeout')), 10000);
    });
    
    // Create audio context and connect to video
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaElementSource(video);
    
    // Create analyser node
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    
    // Also connect to destination to enable playback (muted)
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0; // Mute
    analyser.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Analyze each shot
    const results: ShotAudioFeatures[] = [];
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      
      if (i % 10 === 0) {
        console.log(`  📊 Analyzing shot ${i + 1}/${shots.length}...`);
      }
      
      try {
        const features = await analyzeShotWithVideoElement(video, analyser, shot.startTime, shot.endTime, audioContext.sampleRate);
        results.push({
          startTime: shot.startTime,
          endTime: shot.endTime,
          duration: shot.endTime - shot.startTime,
          ...features
        });
      } catch (error) {
        console.warn(`Failed to analyze shot ${i + 1}, using defaults:`, error);
        // Use neutral values for failed shots
        results.push({
          startTime: shot.startTime,
          endTime: shot.endTime,
          duration: shot.endTime - shot.startTime,
          avgVolume: 0.5,
          dynamicRange: 0.5,
          speechProbability: 0.5
        });
      }
    }
    
    // Clean up
    URL.revokeObjectURL(video.src);
    source.disconnect();
    analyser.disconnect();
    gainNode.disconnect();
    await audioContext.close();
    
    console.log('✅ Audio analysis complete!');
    
    return results;
  } catch (error) {
    console.error('Error analyzing all shots:', error);
    // Return neutral values for all shots on error
    return shots.map(shot => ({
      startTime: shot.startTime,
      endTime: shot.endTime,
      duration: shot.endTime - shot.startTime,
      avgVolume: 0.5,
      dynamicRange: 0.5,
      speechProbability: 0.5
    }));
  }
}

/**
 * Analyze a single shot using video element and analyser node
 */
async function analyzeShotWithVideoElement(
  video: HTMLVideoElement,
  analyser: AnalyserNode,
  startTime: number,
  endTime: number,
  sampleRate: number
): Promise<AudioFeatures> {
  // Seek to start time
  video.currentTime = startTime;
  
  // Wait for seek to complete
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    // Timeout fallback
    setTimeout(resolve, 500);
  });
  
  // Play and collect audio data
  video.play().catch(() => {}); // Ignore play errors
  
  const duration = Math.min(endTime - startTime, 6); // Max 6 seconds
  const samples: number[] = [];
  const bufferLength = analyser.fftSize;
  const dataArray = new Float32Array(bufferLength);
  
  // Collect samples for the duration
  const sampleInterval = 50; // Sample every 50ms
  const numSamples = Math.ceil((duration * 1000) / sampleInterval);
  
  for (let i = 0; i < numSamples; i++) {
    if (video.currentTime >= endTime) break;
    
    analyser.getFloatTimeDomainData(dataArray);
    samples.push(...Array.from(dataArray));
    
    await new Promise(resolve => setTimeout(resolve, sampleInterval));
  }
  
  video.pause();
  
  // Convert to Float32Array for analysis
  const samplesArray = new Float32Array(samples);
  
  return {
    avgVolume: computeRMSVolume(samplesArray),
    dynamicRange: computeDynamicRange(samplesArray),
    speechProbability: computeSpeechProbability(samplesArray, sampleRate)
  };
}

/**
 * Compute RMS (Root Mean Square) volume
 * Returns normalized value 0-1
 */
function computeRMSVolume(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  
  const rms = Math.sqrt(sum / samples.length);
  
  // Normalize to 0-1 range (typical audio RMS is 0-0.5, we scale to 0-1)
  return Math.min(rms * 2, 1.0);
}

/**
 * Compute dynamic range (variance in volume)
 * Returns normalized value 0-1
 */
function computeDynamicRange(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  
  // Compute RMS in windows to get volume over time
  const windowSize = 2048;
  const rmsValues: number[] = [];
  
  for (let i = 0; i < samples.length; i += windowSize) {
    const window = samples.slice(i, Math.min(i + windowSize, samples.length));
    rmsValues.push(computeRMSVolume(window));
  }
  
  if (rmsValues.length === 0) return 0;
  
  // Sort to get percentiles
  const sorted = [...rmsValues].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p5Index = Math.floor(sorted.length * 0.05);
  
  const p95 = sorted[p95Index] || sorted[sorted.length - 1];
  const p5 = sorted[p5Index] || sorted[0];
  
  // Dynamic range is the difference between high and low volume moments
  return Math.min(p95 - p5, 1.0);
}

/**
 * Compute speech probability using spectral flatness
 * Speech has structured harmonics (low flatness)
 * Music/noise has flatter spectrum (high flatness)
 * Returns 0-1 where 1 = high probability of speech
 */
function computeSpeechProbability(samples: Float32Array, sampleRate: number): number {
  if (samples.length === 0) return 0;
  
  // Use FFT window size
  const fftSize = 2048;
  const numWindows = Math.floor(samples.length / fftSize);
  
  if (numWindows === 0) return 0;
  
  let totalFlatness = 0;
  
  for (let w = 0; w < numWindows; w++) {
    const windowStart = w * fftSize;
    const window = samples.slice(windowStart, windowStart + fftSize);
    
    // Simple spectral flatness estimate
    const flatness = computeSpectralFlatness(window);
    totalFlatness += flatness;
  }
  
  const avgFlatness = totalFlatness / numWindows;
  
  // Speech has low flatness (structured), so invert it
  // Flatness ranges 0-1, speech typically 0.1-0.3, music 0.4-0.7
  const speechProb = 1 - avgFlatness;
  
  // Boost speech signal slightly (empirical tuning)
  return Math.min(speechProb * 1.2, 1.0);
}

/**
 * Compute spectral flatness (geometric mean / arithmetic mean of power spectrum)
 * Returns 0-1 where 0 = tonal (speech/music), 1 = noise-like
 */
function computeSpectralFlatness(samples: Float32Array): number {
  // Simple magnitude spectrum (absolute values)
  const magnitudes: number[] = [];
  
  for (let i = 0; i < samples.length; i++) {
    magnitudes.push(Math.abs(samples[i]));
  }
  
  // Add small epsilon to avoid log(0)
  const epsilon = 1e-10;
  
  // Geometric mean (using log space for numerical stability)
  let logSum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    logSum += Math.log(magnitudes[i] + epsilon);
  }
  const geometricMean = Math.exp(logSum / magnitudes.length);
  
  // Arithmetic mean
  let sum = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    sum += magnitudes[i];
  }
  const arithmeticMean = sum / magnitudes.length;
  
  // Flatness
  if (arithmeticMean < epsilon) return 0;
  
  return geometricMean / arithmeticMean;
}

/**
 * Detect if trailer is music-only (no speech throughout)
 */
export function isMusicOnlyTrailer(shotFeatures: ShotAudioFeatures[]): boolean {
  if (shotFeatures.length === 0) return false;
  
  const avgSpeechProb = shotFeatures.reduce((sum, s) => sum + s.speechProbability, 0) / shotFeatures.length;
  
  // If average speech probability across all shots is very low, it's music-only
  return avgSpeechProb < 0.15;
}

/**
 * Detect if trailer has voiceover narration (speech throughout)
 */
export function hasVoiceoverNarration(shotFeatures: ShotAudioFeatures[]): boolean {
  if (shotFeatures.length === 0) return false;
  
  const shotsWithSpeech = shotFeatures.filter(s => s.speechProbability > 0.7).length;
  const percentage = shotsWithSpeech / shotFeatures.length;
  
  // If >80% of shots have high speech probability, it's likely voiceover
  return percentage > 0.8;
}
