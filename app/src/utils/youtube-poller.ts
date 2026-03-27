// YouTube RSS Polling Service (No API Key Required!)

import { fetchChannelFeed, isTrailer, isRecentUpload, isValid16x9Video, type YouTubeVideo, type Channel } from './youtube-rss';

type NotificationCallback = (notification: any) => void;
type VideoCallback = (video: YouTubeVideo, channel: Channel) => void;

class YouTubeRSSPoller {
  private channels: Channel[] = [];
  private processedVideos: Set<string> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentInterval: number = 2; // minutes
  private onNotification: NotificationCallback | null = null;
  private onNewVideo: VideoCallback | null = null;
  private isPolling: boolean = false;
  private customKeywords: string = ''; // For trailer detection
  private channelIdCounter: number = 0; // Counter for unique IDs

  constructor() {
    this.loadState();
  }

  // Generate unique ID for channels
  private generateUniqueId(): string {
    this.channelIdCounter++;
    return `${Date.now()}-${this.channelIdCounter}`;
  }

  // Set custom keywords for trailer detection
  setCustomKeywords(keywords: string): void {
    this.customKeywords = keywords;
    this.saveState();
  }

  // Get custom keywords
  getCustomKeywords(): string {
    return this.customKeywords;
  }

  // Get all channels
  getChannels(): Channel[] {
    return this.channels;
  }

  // Add channel to monitor
  addChannel(channelId: string, channelName: string): void {
    const exists = this.channels.find(ch => ch.channelId === channelId);
    if (exists) {
      console.log(`Channel ${channelName} already exists`);
      return;
    }

    const newChannel: Channel = {
      id: this.generateUniqueId(),
      name: channelName,
      channelId,
      active: true,
      videoCount: 0,
      lastChecked: null,
      lastVideoId: null,
    };

    this.channels.push(newChannel);
    this.saveState();
    console.log(`✅ Added channel: ${channelName}`);
  }

  // Update channel
  updateChannel(id: string, updates: Partial<Channel>): void {
    const index = this.channels.findIndex(ch => ch.id === id);
    if (index !== -1) {
      this.channels[index] = { ...this.channels[index], ...updates };
      this.saveState();
    }
  }

  // Remove channel
  removeChannel(id: string): void {
    this.channels = this.channels.filter(ch => ch.id !== id);
    this.saveState();
    console.log(`✅ Removed channel`);
  }

  // Restore channel at specific index (for undo functionality)
  restoreChannel(channel: Channel, index: number): void {
    // Insert the channel at the specified index
    this.channels.splice(index, 0, channel);
    this.saveState();
    console.log(`✅ Restored channel: ${channel.name} at index ${index}`);
  }

  // Toggle channel active status
  toggleChannel(id: string): void {
    const channel = this.channels.find(ch => ch.id === id);
    if (channel) {
      channel.active = !channel.active;
      this.saveState();
    }
  }

  // Set notification callback
  setNotificationCallback(callback: NotificationCallback): void {
    this.onNotification = callback;
  }

  // Set new video callback
  setNewVideoCallback(callback: VideoCallback): void {
    this.onNewVideo = callback;
  }

  // Start polling all channels
  startPolling(intervalMinutes: number = 2): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.currentInterval = intervalMinutes;
    this.isPolling = true;
    console.log(`🔄 Starting RSS polling every ${intervalMinutes} minute(s)...`);

    // Poll immediately on start
    this.pollAllChannels();

    // Then poll at intervals
    this.pollingInterval = setInterval(() => {
      this.pollAllChannels();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop polling
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
      console.log('⏸️ Polling stopped');
    }
  }

  // Check if currently polling
  getIsPolling(): boolean {
    return this.isPolling;
  }

  // Get current polling interval
  getCurrentInterval(): number {
    return this.currentInterval;
  }

  // Poll all active channels
  private async pollAllChannels(): Promise<void> {
    const activeChannels = this.channels.filter(ch => ch.active);

    if (activeChannels.length === 0) {
      console.log('No active channels to poll');
      return;
    }

    console.log(`🔍 Polling ${activeChannels.length} active channels...`);

    const promises = activeChannels.map(channel => this.pollChannel(channel));
    const results = await Promise.allSettled(promises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Poll complete: ${successful} successful, ${failed} failed`);
    this.saveState();
  }

  // Poll single channel
  private async pollChannel(channel: Channel): Promise<void> {
    try {
      const videos = await fetchChannelFeed(channel.channelId);

      if (videos.length === 0) {
        console.log(`No videos found for ${channel.name}`);
        channel.lastChecked = new Date();
        return;
      }

      // Update video count
      channel.videoCount = videos.length;

      // Get latest video
      const latestVideo = videos[0];

      // Check if this is a new video
      const isNewVideo = channel.lastVideoId !== latestVideo.videoId;

      if (isNewVideo && !this.processedVideos.has(latestVideo.videoId)) {
        console.log(`🎬 NEW VIDEO DETECTED: ${latestVideo.title}`);
        console.log(`   Channel: ${channel.name}`);
        console.log(`   Video ID: ${latestVideo.videoId}`);
        console.log(`   Published: ${latestVideo.published}`);

        // Mark as processed
        this.processedVideos.add(latestVideo.videoId);

        // Only process if it's recent (within last 10 min) or first check
        const isRecent = isRecentUpload(latestVideo.published, 10);
        const isFirstCheck = channel.lastVideoId === null;

        if (isRecent || isFirstCheck) {
          await this.handleNewVideo(latestVideo, channel);
        } else {
          console.log(`   ⏭️ Skipping (not a recent upload)`);
        }

        // Update last video ID
        channel.lastVideoId = latestVideo.videoId;
      }

      channel.lastChecked = new Date();
    } catch (error) {
      console.error(`Error polling ${channel.name}:`, error);
    }
  }

  // Handle new video detection
  private async handleNewVideo(video: YouTubeVideo, channel: Channel): Promise<void> {
    // Check if it's a trailer
    const isTrailerVideo = isTrailer(video.title, this.customKeywords);

    if (!isTrailerVideo) {
      console.log(`   ⏭️ Skipping (not a trailer)`);
      return;
    }

    // Check if it's a valid 16:9 video (not a Short)
    const isValid16x9 = isValid16x9Video(video);

    if (!isValid16x9) {
      if (video.isShort || video.link.includes('/shorts/')) {
        console.log(`   ⏭️ Skipping (YouTube Short detected - 9:16 format)`);
      } else {
        console.log(`   ⏭️ Skipping (likely not 16:9 format)`);
      }
      return;
    }

    console.log(`   ✅ Processing 16:9 trailer...`);

    // Trigger callback if set
    if (this.onNewVideo) {
      this.onNewVideo(video, channel);
    }

    // Generate thumbnails using the new Overlay system
    try {
      // Get enabled platforms (default to all or specific logic?)
      // For now, assume YouTube and X are relevant
      const enabledPlatforms: any[] = ['YouTube', 'X'];

      // Import dynamically to avoid circular deps if any, or just import at top. 
      // Using direct call assuming import at top.
      const { generateThumbnailsForPublish, getPlatformThumbnailSettings } = await import('./thumbnailGenerator');

      const platformSettings = getPlatformThumbnailSettings();

      // Map YouTubeVideo to VideoMetadata
      const videoMetadata = {
        title: video.title,
        videoId: video.videoId,
        channelName: channel.name,
        thumbnailUrl: video.thumbnailUrl, // e.g. https://i.ytimg.com...
      };

      console.log('🎨 Generating thumbnails with overlay...');
      const thumbnails = await generateThumbnailsForPublish(videoMetadata, platformSettings, enabledPlatforms);
      const youtubeThumbnail = thumbnails.YouTube;

      if (youtubeThumbnail?.detectedOverlayType) {
        console.log(
          `🎞️ YouTube branded overlay resolved from title as ${youtubeThumbnail.detectedOverlayType}`
          + `${youtubeThumbnail.resolvedOverlayAssetKey ? ` (${youtubeThumbnail.resolvedOverlayAssetKey})` : ''}`
        );
      }

      // Log success (In real app, we would upload 'thumbnails' here)
      console.log('✨ Thumbnails generated successfully:', Object.keys(thumbnails).filter(k => thumbnails[k as keyof typeof thumbnails]));

      // Optionally attach to notification if needed
      // (Skipping modification of createNotification signature to keep changes minimal)

    } catch (error) {
      console.error('❌ Failed to generate thumbnails:', error);
    }

    // Create notification
    this.createNotification(video, channel);
  }

  // Create notification
  private createNotification(video: YouTubeVideo, channel: Channel): void {
    if (!this.onNotification) return;

    const notification = {
      id: Date.now().toString(),
      type: 'success',
      source: 'upload',
      title: 'New Trailer Detected',
      message: `${video.title} from ${channel.name}`,
      timestamp: new Date().toISOString(),
      read: false,
      actionPage: 'channels',
      metadata: {
        videoId: video.videoId,
        channelId: video.channelId,
        link: video.link,
      },
    };

    this.onNotification(notification);
    console.log('🔔 Notification created:', notification.title);
  }

  // Save state to localStorage
  private saveState(): void {
    if (typeof window === 'undefined') return;

    try {
      const state = {
        channels: this.channels,
        processedVideos: Array.from(this.processedVideos),
        lastSaved: new Date().toISOString(),
        customKeywords: this.customKeywords,
      };

      localStorage.setItem('screndly_youtube_rss_poller', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving poller state:', error);
    }
  }

  // Load state from localStorage
  private loadState(): void {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('screndly_youtube_rss_poller');
      if (saved) {
        const state = JSON.parse(saved);
        this.channels = state.channels || [];
        this.processedVideos = new Set(state.processedVideos || []);
        this.customKeywords = state.customKeywords || '';

        // Initialize counter to avoid duplicate IDs
        this.channelIdCounter = this.channels.length;

        console.log(`📂 Loaded ${this.channels.length} channels from storage`);
      }
    } catch (error) {
      console.error('Error loading poller state:', error);
    }
  }

  // Clear processed videos older than N days
  clearOldProcessedVideos(_days: number = 7): void {
    // This would require storing timestamps with processed videos
    // For now, we'll just clear the entire set if it gets too large
    if (this.processedVideos.size > 1000) {
      console.log('🧹 Clearing old processed videos...');
      this.processedVideos.clear();
      this.saveState();
    }
  }

  // Get statistics
  getStats() {
    const activeChannels = this.channels.filter(ch => ch.active).length;
    const totalChannels = this.channels.length;
    const totalVideosTracked = this.channels.reduce((sum, ch) => sum + ch.videoCount, 0);
    const processedVideosCount = this.processedVideos.size;

    return {
      activeChannels,
      totalChannels,
      totalVideosTracked,
      processedVideosCount,
      isPolling: this.isPolling,
      pollingInterval: this.currentInterval,
    };
  }
}

// Export singleton instance
export const youtubePoller = new YouTubeRSSPoller();
