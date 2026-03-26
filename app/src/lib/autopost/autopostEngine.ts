/**
 * Autopost Execution Engine
 * 
 * Runs continuously, pulling from the unified post queue and publishing to platforms.
 * Integrated with Analytics-Driven Optimization Layer for optimal posting times.
 * 
 * Flow:
 * 1. Every 15 minutes (configurable)
 * 2. Check if autopost is enabled globally
 * 3. Check if platform quotas allow posting
 * 4. Pull highest-priority eligible item from queue
 * 5. Use optimization layer for posting time decisions
 * 6. Generate/validate caption
 * 7. Publish to target platforms
 * 8. Log result
 * 9. Sleep until next tick
 */

import { postQueue, PostCandidate } from './postQueue';
import { toast } from "sonner";
import { xAdapter } from '../../adapters/xAdapter';
import { metaAdapter } from '../../adapters/metaAdapter';
import { pinterestAdapter } from '../../adapters/pinterestAdapter';
import { youtubeAdapter } from '../../adapters/youtubeAdapter';
import { postTimeOptimizer, optimizationGuardrails } from '../optimization';

export interface AutopostEngineConfig {
  enabled: boolean;
  tickInterval: number; // Minutes between execution checks (default: 15)
  dryRun: boolean; // If true, log but don't actually post
}

const DEFAULT_ENGINE_CONFIG: AutopostEngineConfig = {
  enabled: true,
  tickInterval: 15,
  dryRun: false,
};

export class AutopostEngine {
  private config: AutopostEngineConfig;
  private intervalId: number | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<AutopostEngineConfig>) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.loadConfig();
  }

  /**
   * Start the autopost engine
   */
  start(): void {
    if (this.isRunning) {
      console.log('[AutopostEngine] Already running');
      return;
    }

    console.log('[AutopostEngine] Starting...');
    this.isRunning = true;

    // Run immediately on start
    this.tick();

    // Schedule recurring execution
    this.intervalId = window.setInterval(
      () => this.tick(),
      this.config.tickInterval * 60 * 1000
    );

    toast.success('Autopost engine started');
  }

  /**
   * Stop the autopost engine
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[AutopostEngine] Not running');
      return;
    }

    console.log('[AutopostEngine] Stopping...');
    this.isRunning = false;

    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    toast.info('Autopost engine stopped');
  }

  /**
   * Single execution tick - integrated with optimization layer
   */
  private async tick(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[AutopostEngine] Disabled, skipping tick');
      return;
    }

    // Reload rate config from settings before each tick
    postQueue.reloadRateConfigFromSettings();

    console.log('[AutopostEngine] Tick started');

    try {
      // Get next eligible post from queue
      const candidate = postQueue.getNextEligible();

      if (!candidate) {
        console.log('[AutopostEngine] No eligible posts in queue');
        return;
      }

      console.log(`[AutopostEngine] Processing: ${candidate.title} (${candidate.source})`);

      // Check optimization guardrails before posting
      for (const platform of candidate.platforms) {
        const guardrailCheck = optimizationGuardrails.checkGuardrails(platform as any, candidate.source as any);
        if (!guardrailCheck.allowed) {
          console.log(`[AutopostEngine] Guardrail blocked for ${platform}: ${guardrailCheck.reason}`);
        }
      }

      // Get optimal posting time recommendation
      const primaryPlatform = candidate.platforms[0] as any;
      const optimalTime = postTimeOptimizer.getOptimalPostTime(primaryPlatform);

      if (optimalTime) {
        console.log(`[AutopostEngine] Optimal time for ${primaryPlatform}: ${optimalTime.hour}:00 (confidence: ${(optimalTime.confidence * 100).toFixed(0)}%)`);

        // If we're not in an optimal window, consider delaying
        const currentHour = new Date().getHours();
        if (Math.abs(currentHour - optimalTime.hour) > 2 && optimalTime.confidence > 0.7) {
          console.log(`[AutopostEngine] Current hour ${currentHour} differs from optimal ${optimalTime.hour}, but proceeding anyway`);
        }
      }

      // Execute post
      if (this.config.dryRun) {
        console.log('[AutopostEngine] DRY RUN - Would post:', {
          title: candidate.title,
          platforms: candidate.platforms,
          priority: candidate.priority,
        });
        postQueue.markPosted(candidate.id, candidate.platforms);
      } else {
        await this.executePost(candidate);
      }

    } catch (error) {
      console.error('[AutopostEngine] Tick error:', error);
    }
  }

  /**
   * Execute a single post to all target platforms
   */
  private async executePost(candidate: PostCandidate): Promise<void> {
    const results: { platform: string; success: boolean; error?: string }[] = [];

    // Post to each platform
    for (const platform of candidate.platforms) {
      try {
        console.log(`[AutopostEngine] Posting to ${platform}...`);

        // Check if autopost is enabled for this platform
        const platformSettings = this.getPlatformSettings(platform);
        if (!platformSettings?.autoPost) {
          console.log(`[AutopostEngine] Autopost disabled for ${platform}, skipping`);
          continue;
        }

        // Publish to platform
        const success = await this.publishToPlatform(candidate, platform);

        results.push({ platform, success });

        if (success) {
          console.log(`[AutopostEngine] Successfully posted to ${platform}`);
        }

      } catch (error: any) {
        console.error(`[AutopostEngine] Failed to post to ${platform}:`, error);
        results.push({
          platform,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Determine overall status
    const successCount = results.filter(r => r.success).length;

    if (successCount === 0) {
      // All failed
      const errorMsg = results.map(r => `${r.platform}: ${r.error}`).join('; ');
      postQueue.markFailed(candidate.id, errorMsg);
      toast.error(`Failed to post: ${candidate.title}`);
    } else if (successCount < results.length) {
      // Partial success
      const successPlatforms = results.filter(r => r.success).map(r => r.platform);
      postQueue.markPosted(candidate.id, successPlatforms);
      toast.warning(`Posted to ${successCount}/${results.length} platforms: ${candidate.title}`);
    } else {
      // All succeeded
      postQueue.markPosted(candidate.id, candidate.platforms);
      toast.success(`Posted: ${candidate.title}`);
    }
  }

  /**
   * Publish to a specific platform
   * Returns true if successful, false otherwise
   */
  private async publishToPlatform(candidate: PostCandidate, platform: string): Promise<boolean> {
    // Get platform settings
    const platformSettings = this.getPlatformSettings(platform);
    if (!platformSettings) {
      throw new Error(`Platform ${platform} not configured`);
    }

    console.log(`[AutopostEngine] Publishing to ${platform}:`, {
      title: candidate.title,
      caption: candidate.caption,
      mediaUrl: candidate.mediaUrl,
      thumbnailUrl: candidate.thumbnailUrl,
      imageUrls: candidate.imageUrls,
      imageSelectionStrategy: candidate.imageSelectionStrategy,
      imageSelectionReasons: candidate.imageSelectionReasons,
      imageSelectionConfidence: candidate.imageSelectionConfidence,
    });

    try {
      const imageUrls = (candidate.imageUrls || []).filter(Boolean);
      const primaryImageUrl = imageUrls[0] || candidate.thumbnailUrl;
      const publishCaption = this.getPublishCaption(candidate);

      if (candidate.imageSelectionStrategy) {
        console.log('[AutopostEngine] RSS image selection', {
          strategy: candidate.imageSelectionStrategy,
          reasons: candidate.imageSelectionReasons,
          confidence: candidate.imageSelectionConfidence,
        });
      }

      if (publishCaption !== candidate.caption) {
        console.warn('[AutopostEngine] Caption was empty; using fallback publish caption', {
          title: candidate.title,
          source: candidate.source,
          platform,
          fallbackLength: publishCaption.length,
        });
      }

      // Route to appropriate platform adapter
      switch (platform) {
        case 'x':
          // X (Twitter) posting
          const xResult = await xAdapter.post({
            text: publishCaption,
            videoUrl: candidate.mediaUrl,
            imageUrls: candidate.mediaUrl ? undefined : imageUrls,
          });
          return xResult.success;

        case 'threads':
          // Threads posting via Meta adapter
          if (!candidate.mediaUrl && primaryImageUrl) {
            console.warn('[AutopostEngine] Threads RSS image publishing is not supported by the current adapter.');
            return false;
          }
          const threadsResult = await metaAdapter.publishToThreads({
            caption: publishCaption,
            videoUrl: candidate.mediaUrl!,
            thumbnailUrl: primaryImageUrl,
          });
          return threadsResult.success;

        case 'facebook':
          // Facebook posting via Meta adapter
          if (!candidate.mediaUrl && primaryImageUrl) {
            console.warn('[AutopostEngine] Facebook RSS image publishing is not supported by the current adapter.');
            return false;
          }
          const fbResult = await metaAdapter.publishToFacebook({
            caption: publishCaption,
            videoUrl: candidate.mediaUrl!,
            thumbnailUrl: primaryImageUrl,
          });
          return fbResult.success;

        case 'pinterest': {
          if (!primaryImageUrl) {
            throw new Error('No RSS image available for Pinterest publishing');
          }

          const pinterestBoardId = this.getPinterestBoardId(platformSettings);
          const pinResult = await pinterestAdapter.createPin({
            title: candidate.title,
            description: publishCaption,
            boardId: pinterestBoardId,
            mediaUrl: primaryImageUrl,
            mediaType: candidate.mediaUrl ? 'video' : 'image',
            link: candidate.linkUrl,
            thumbnailUrl: primaryImageUrl,
          });
          return pinResult.success;
        }

        case 'youtube':
          // YouTube community post
          const ytResult = await youtubeAdapter.createCommunityPost({
            text: publishCaption,
            imageUrl: primaryImageUrl,
          });
          return ytResult.success;

        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

    } catch (error: any) {
      console.error(`[AutopostEngine] Platform ${platform} error:`, error);
      throw new Error(`${platform} API error: ${error.message}`);
    }
  }

  /**
   * Get platform-specific settings
   */
  private getPlatformSettings(platform: string): any {
    try {
      const settings = localStorage.getItem('screndly_platform_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return parsed[platform];
      }
    } catch (e) {
      console.error('[AutopostEngine] Failed to load platform settings:', e);
    }
    return null;
  }

  private getPinterestBoardId(platformSettings: any): string {
    if (platformSettings?.boardId) {
      return platformSettings.boardId;
    }

    try {
      const settings = localStorage.getItem('screndlySettings') || localStorage.getItem('screndly_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.rssPinterestBoard) {
          return parsed.rssPinterestBoard;
        }
      }
    } catch (e) {
      console.error('[AutopostEngine] Failed to load Pinterest board setting:', e);
    }

    return 'Entertainment News';
  }

  private getPublishCaption(candidate: PostCandidate): string {
    const caption = String(candidate.caption || '').trim();
    if (caption) {
      return caption;
    }

    const title = String(candidate.title || '').trim();
    const link = String(candidate.linkUrl || candidate.mediaUrl || '').trim();
    const fallback = [title, link].filter(Boolean).join('\n\n').trim();

    return fallback || 'Latest update';
  }

  /**
   * Get engine status
   */
  getStatus(): {
    isRunning: boolean;
    config: AutopostEngineConfig;
    queueStats: ReturnType<typeof postQueue.getStats>;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      queueStats: postQueue.getStats(),
    };
  }

  /**
   * Update engine configuration
   */
  updateConfig(updates: Partial<AutopostEngineConfig>): void {
    const wasRunning = this.isRunning;

    // Stop if running
    if (wasRunning) {
      this.stop();
    }

    // Update config
    this.config = { ...this.config, ...updates };
    this.saveConfig();

    // Restart if was running
    if (wasRunning && this.config.enabled) {
      this.start();
    }

    toast.success('Autopost engine configuration updated');
  }

  /**
   * Force immediate execution (manual trigger)
   */
  async forceExecute(): Promise<void> {
    console.log('[AutopostEngine] Force execute triggered');
    await this.tick();
  }

  /**
   * Save config to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('screndly_autopost_engine_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('[AutopostEngine] Failed to save config:', e);
    }
  }

  /**
   * Load config from localStorage
   */
  private loadConfig(): void {
    try {
      const saved = localStorage.getItem('screndly_autopost_engine_config');
      if (saved) {
        this.config = { ...DEFAULT_ENGINE_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[AutopostEngine] Failed to load config:', e);
    }
  }
}

// Export singleton instance
export const autopostEngine = new AutopostEngine();

// Auto-start on load if enabled
if (autopostEngine.getStatus().config.enabled) {
  autopostEngine.start();
}
