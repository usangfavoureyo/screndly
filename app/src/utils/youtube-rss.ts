// YouTube RSS Feed Polling (No API Key Required!)

export interface YouTubeVideo {
  videoId: string;
  channelId: string;
  title: string;
  published: Date;
  updated: Date;
  link: string;
  author: string;
  isShort?: boolean; // YouTube Shorts indicator
  thumbnailUrl?: string;
}

export interface Channel {
  id: string;
  name: string;
  channelId: string;
  active: boolean;
  videoCount: number;
  lastChecked: Date | null;
  lastVideoId: string | null;
}

// Fetch RSS feed for a YouTube channel
export async function fetchChannelFeed(channelId: string): Promise<YouTubeVideo[]> {
  // Remove @ symbol if present
  const cleanChannelId = channelId.replace('@', '');

  // Try multiple feed URL formats
  const feedUrls = [
    `https://www.youtube.com/feeds/videos.xml?channel_id=${cleanChannelId}`,
    `https://www.youtube.com/feeds/videos.xml?user=${cleanChannelId}`,
  ];

  for (const feedUrl of feedUrls) {
    try {
      const response = await fetch(feedUrl, {
        headers: {
          'Accept': 'application/atom+xml, application/xml, text/xml',
        },
      });

      if (!response.ok) continue;

      const xmlText = await response.text();
      const videos = parseYouTubeFeed(xmlText);

      if (videos.length > 0) {
        return videos;
      }
    } catch (_error) {
      // RSS feed fetching from browser has CORS limitations
      // This is expected and would require a backend proxy in production
      continue;
    }
  }

  return [];
}

// Parse YouTube Atom feed XML
function parseYouTubeFeed(xmlText: string): YouTubeVideo[] {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      return [];
    }

    const entries = Array.from(xmlDoc.querySelectorAll('entry'));

    return entries.map(entry => {
      // Handle namespaced elements (yt:videoId, yt:channelId)
      const getTextContent = (selector: string): string => {
        const element = entry.querySelector(selector);
        return element?.textContent || '';
      };

      const getLinkHref = (): string => {
        const link = entry.querySelector('link[rel="alternate"]');
        return link?.getAttribute('href') || '';
      };

      const getThumbnailUrl = (videoId: string): string => {
        // Try to find media:thumbnail if available (often inside media:group)
        const mediaGroup = entry.getElementsByTagName('media:group')[0];
        if (mediaGroup) {
          const thumbnail = mediaGroup.getElementsByTagName('media:thumbnail')[0];
          if (thumbnail && thumbnail.getAttribute('url')) {
            return thumbnail.getAttribute('url')!;
          }
        }
        // Fallback to standard max resolution if not found in feed
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      };

      const link = getLinkHref();
      const videoId = getTextContent('yt\\:videoId, videoId');

      return {
        videoId: videoId,
        channelId: getTextContent('yt\\:channelId, channelId'),
        title: getTextContent('title'),
        published: new Date(getTextContent('published') || Date.now()),
        updated: new Date(getTextContent('updated') || Date.now()),
        link: link,
        author: getTextContent('author name'),
        isShort: link.includes('/shorts/'), // Detect YouTube Shorts by URL pattern
        thumbnailUrl: getThumbnailUrl(videoId),
      };
    });
  } catch (error) {
    console.error('Error parsing YouTube feed:', error);
    return [];
  }
}

// Check if video title indicates it's a trailer
export function isTrailer(title: string, customKeywords?: string): boolean {
  // Get keywords from custom input or use defaults
  let keywords: string[];

  if (customKeywords && customKeywords.trim()) {
    // Parse custom keywords from comma-separated string
    keywords = customKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
  } else {
    // Default keywords
    keywords = [
      'trailer',
      'teaser',
      'official trailer',
      'official teaser',
      'first look',
      'sneak peek',
      'exclusive clip',
      'movie clip',
      'tv spot',
      'behind the scenes',
      'featurette',
      'announcement',
    ];
  }

  const lowerTitle = title.toLowerCase();
  return keywords.some(keyword => lowerTitle.includes(keyword));
}

// Check if video was published recently (within last N minutes)
export function isRecentUpload(published: Date, withinMinutes: number = 10): boolean {
  const now = new Date();
  const diffMs = now.getTime() - published.getTime();
  const diffMinutes = diffMs / 1000 / 60;
  return diffMinutes >= 0 && diffMinutes <= withinMinutes;
}

// Extract channel ID from various YouTube URL formats
export function extractChannelId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Format: youtube.com/channel/UCxxxxxx
    if (urlObj.pathname.includes('/channel/')) {
      return urlObj.pathname.split('/channel/')[1].split('/')[0];
    }

    // Format: youtube.com/@username
    if (urlObj.pathname.startsWith('/@')) {
      return urlObj.pathname.split('/@')[1].split('/')[0];
    }

    // Format: youtube.com/c/username or youtube.com/user/username
    if (urlObj.pathname.includes('/c/') || urlObj.pathname.includes('/user/')) {
      const username = urlObj.pathname.split('/').filter(Boolean)[1];
      return username;
    }

    return null;
  } catch (_error) {
    // If not a URL, assume it's already a channel ID or username
    return url.replace('@', '');
  }
}

// Test if a channel ID is valid by attempting to fetch its feed
export async function validateChannelId(channelId: string): Promise<boolean> {
  try {
    const videos = await fetchChannelFeed(channelId);
    return videos.length > 0;
  } catch (_error) {
    return false;
  }
}

// Check if video title indicates it's a Short (additional check beyond URL)
export function hasShortsIndicators(title: string): boolean {
  const shortsKeywords = [
    '#shorts',
    '#short',
    '(shorts)',
    '(short)',
    'youtube shorts',
    'youtube short',
    'short video',
  ];

  const lowerTitle = title.toLowerCase();
  return shortsKeywords.some(keyword => lowerTitle.includes(keyword));
}

// Check if video is likely a valid 16:9 trailer (not a Short)
export function isValid16x9Video(video: YouTubeVideo): boolean {
  // Check 1: URL should not contain /shorts/
  if (video.isShort || video.link.includes('/shorts/')) {
    return false;
  }

  // Check 2: Title should not have Shorts indicators
  if (hasShortsIndicators(video.title)) {
    return false;
  }

  // All checks passed - likely a 16:9 video
  return true;
}