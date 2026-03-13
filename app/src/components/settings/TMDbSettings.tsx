import { useRef, useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PinterestBoardSelect } from '../ui/pinterest-board-select';
import { FacebookIcon } from '../icons/FacebookIcon';
import { ThreadsIcon } from '../icons/ThreadsIcon';
import { XIcon } from '../icons/XIcon';
import { YouTubeIcon } from '../icons/YouTubeIcon';
import { PinterestIcon } from '../icons/PinterestIcon';
import { haptics } from '../../utils/haptics';
import { toast } from "sonner";
import { Plus } from 'lucide-react';
import { AI_MODELS, DEFAULT_MODELS, getModelDisplayName } from '../../lib/ai/models';
import { fetchSettings, saveSettings } from '../../lib/api/settings';
import { tmdbPromptDefaults } from '../../config/cultureCravePromptDefaults';
import { useSettings } from '../../contexts/SettingsContext';

const TMDB_CULTURE_CRAVE_PROMPTS_MIGRATION_KEY = 'screndly_culturecrave_tmdb_prompts_v1';
const TMDB_SHARED_SETTING_KEYS = new Set([
  'tmdbCaptionModel',
  'todayPrompt',
  'weeklyPrompt',
  'monthlyPrompt',
  'anniversaryPrompt',
  'tmdbActivityRetention',
  'tmdbLogLevel',
  'timezone',
]);

// TMDb Genre IDs - Official from TMDb API
const MOVIE_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
];

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
];

// Unified genres for synced selection (combining unique genres from both)
const UNIFIED_GENRES = [
  { id: 28, name: 'Action', movieId: 28, tvId: 10759 }, // Action & Action & Adventure
  { id: 12, name: 'Adventure', movieId: 12, tvId: 10759 }, // Adventure & Action & Adventure
  { id: 16, name: 'Animation', movieId: 16, tvId: 16 },
  { id: 35, name: 'Comedy', movieId: 35, tvId: 35 },
  { id: 80, name: 'Crime', movieId: 80, tvId: 80 },
  { id: 99, name: 'Documentary', movieId: 99, tvId: 99 },
  { id: 18, name: 'Drama', movieId: 18, tvId: 18 },
  { id: 10751, name: 'Family', movieId: 10751, tvId: 10751 },
  { id: 14, name: 'Fantasy', movieId: 14, tvId: 10765 }, // Fantasy & Sci-Fi & Fantasy
  { id: 36, name: 'History', movieId: 36, tvId: null },
  { id: 27, name: 'Horror', movieId: 27, tvId: null },
  { id: 10762, name: 'Kids', movieId: null, tvId: 10762 },
  { id: 10402, name: 'Music', movieId: 10402, tvId: null },
  { id: 9648, name: 'Mystery', movieId: 9648, tvId: 9648 },
  { id: 10763, name: 'News', movieId: null, tvId: 10763 },
  { id: 10764, name: 'Reality', movieId: null, tvId: 10764 },
  { id: 10749, name: 'Romance', movieId: 10749, tvId: null },
  { id: 878, name: 'Sci-Fi', movieId: 878, tvId: 10765 }, // Sci-Fi & Sci-Fi & Fantasy
  { id: 10766, name: 'Soap', movieId: null, tvId: 10766 },
  { id: 10767, name: 'Talk', movieId: null, tvId: 10767 },
  { id: 53, name: 'Thriller', movieId: 53, tvId: null },
  { id: 10770, name: 'TV Movie', movieId: 10770, tvId: null },
  { id: 10752, name: 'War', movieId: 10752, tvId: 10768 }, // War & War & Politics
  { id: 37, name: 'Western', movieId: 37, tvId: 37 },
];

// Default settings
const defaultSettings = {
  openaiModel: DEFAULT_MODELS.tmdb,
  enableToday: true,
  enableWeekly: true,
  enableMonthly: true,
  enableAnniversaries: true,
  anniversaryYears: ['1', '2', '3', '5', '10', '15', '20', '25'],
  anniversaryStartYear: '1995',
  maxPerAnniversary: '2',
  // Four independent feed max_items (replaced global maxItemsPerFeed)
  todayMaxItems: '5',
  weeklyMaxItems: '10',
  monthlyMaxItems: '30',
  anniversaryMaxItems: '5',
  captionMaxLength: '100',
  includeCast: true,
  includeDate: true,
  preferredImage: 'poster',
  rehostImages: true,
  dedupeWindow: '30',
  tmdbQueuedRetentionHours: '168',
  tmdbActivityRetention: 24,
  tmdbLogLevel: 'standard',
  discoveryCacheTTL: '12',
  creditsCacheTTL: '30',
  captionCacheTTL: '30',
  timezone: 'Africa/Lagos',
  // Genre filters (empty array = all genres allowed)
  movieGenres: [] as number[],
  tvGenres: [] as number[],
  selectedGenres: [] as number[], // Unified genre selection
  onlyPopular: true, // Only show popular titles
  languageFilter: 'en', // English only by default
  // Auto-post settings
  todayAutoPost: false,
  weeklyAutoPost: false,
  monthlyAutoPost: false,
  anniversaryAutoPost: false,
  // Platform settings (X, Threads, Facebook, YouTube, Pinterest)
  todayPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
  weeklyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
  monthlyPlatforms: { x: true, threads: true, facebook: false, youtube: false, pinterest: false },
  anniversaryPlatforms: { x: true, threads: false, facebook: false, youtube: false, pinterest: false },
  // Caption generation settings - Universal Model
  tmdbCaptionModel: DEFAULT_MODELS.tmdb,
  // Individual prompts for each feed type
  todayPrompt: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: today_release
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut2 releases today.
2) #TheLastOfUs S2 premieres today.
3) Keanu Reeves stars in #JohnWick4 releasing today.

Instruction: Produce a single-line caption following the constraints.`,
  weeklyPrompt: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: week_release
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut2 releases next week.
2) #TheLastOfUs S2 premieres this week on HBO.
3) Keanu Reeves and Laurence Fishburne return in #TheMatrix next week.

Instruction: Produce a single-line caption following the constraints.`,
  monthlyPrompt: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: month_notice
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut2 releases next month.
2) #TheLastOfUs S2 coming next month to HBO.
3) Keanu Reeves stars in #JohnWick5 next month.

Instruction: Produce a single-line caption following the constraints.`,
  anniversaryPrompt: `You are a concise caption generator for short social posts. Output must be under 100 characters and use at most 50 tokens. Insert the title as a hashtag somewhere in the sentence. Occasionally include top 1–2 cast names and/or the release date. Tone: punchy, newsy, minimal. No extra hashtags. No CTAs. No quotes. No markdown. End with a period.

User prompt template:
Title: {title}
Type: {movie|tv}
ReleaseDate: {YYYY-MM-DD}
CastTop2: {Actor One, Actor Two}
Context: anniversary_N_years
Constraints: Max 100 characters. Use title as hashtag #Title inside the sentence. Keep short.

Examples:
1) #InsideOut released 10 years ago today.
2) #TheLastOfUs S1 premiered two years ago today.
3) Keanu Reeves and Laurence Fishburne created an unforgettable moment in the #Matrix 25 years ago today.

Instruction: Produce a single-line caption following the constraints.`,
  // Pinterest-specific settings for Today's Releases
  todayPinterestTitlePrompt: `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movies and TV shows releasing today.

INPUT: Movie/TV title, release date, cast, type (movie/tv)
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + "Releases Today" + Year + Type
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "Inside Out 2 Releases Today (2025) | Pixar Movie"
- "The Last of Us Season 2 Premieres Today | HBO Series"
- "John Wick 4 Out Now (2025) | Keanu Reeves Action Movie"

Guidelines:
- Always include "Releases Today" or "Premieres Today" or "Out Now"
- Include year for searchability
- Add 1-2 key cast members if space allows
- Use " | " separator for clarity
- Prioritize search terms users would type

Tone: Timely, searchable, informative, optimized for Pinterest discovery`,
  todayPinterestDescriptionPrompt: `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movies and TV shows releasing today.

INPUT: Title, synopsis, cast, director, release date, type
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load: "OUT NOW!" or "STREAMING NOW!" + Title + Platform
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (trending + branded)
- Optimize for search and discovery
- Keep under 500 characters total

Structure:
1. Opening hook with urgency (50-60 chars) - "OUT NOW! [Title] is streaming on [Platform]!"
2. Synopsis (2-3 sentences)
3. Key cast/director mention
4. Where to watch + release date
5. Hashtags (3-5 relevant tags)

Example:
"OUT NOW! Inside Out 2 is in theaters today! 🎬 Pixar's emotional journey continues as Riley navigates new feelings in her teenage years. Amy Poehler returns with an all-star cast. Watch it in theaters nationwide starting June 14, 2025. #InsideOut2 #Pixar #MovieRelease #AnimatedMovie #OutNow

Get tickets now! 🎟️"

Guidelines:
- Create urgency with "OUT NOW" / "STREAMING NOW" / "IN THEATERS NOW"
- Natural keyword integration
- Use emojis strategically (1-2 max)
- Include searchable hashtags
- Make first sentence compelling and complete

Tone: Urgent, exciting, actionable, optimized for users seeking what to watch today`,
  todayPinterestBoard: 'New Releases Today',
  todayPinterestLinkStrategy: 'tmdb',
  // Pinterest-specific settings for Weekly Releases
  weeklyPinterestTitlePrompt: `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movies and TV shows releasing this week.

INPUT: Movie/TV title, release date, cast, type (movie/tv)
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + "This Week" + Year + Type
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "Inside Out 2 Releases This Week (2025) | Pixar Movie"
- "The Last of Us Season 2 Coming This Week | HBO Series"
- "John Wick 4 Next Week (2025) | Keanu Reeves Action"

Guidelines:
- Include "This Week" or "Next Week" or "Coming Soon"
- Include year for searchability
- Add 1-2 key cast members if space allows
- Use " | " separator for clarity
- Prioritize search terms users would type

Tone: Anticipatory, searchable, informative, optimized for Pinterest planning`,
  weeklyPinterestDescriptionPrompt: `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movies and TV shows releasing this week.

INPUT: Title, synopsis, cast, director, release date, type
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load: "THIS WEEK!" or "COMING SOON!" + Title + Date
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (trending + branded)
- Optimize for search and discovery
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - "THIS WEEK! [Title] arrives [date]!"
2. Synopsis (2-3 sentences)
3. Key cast/director mention
4. Where to watch + specific release date
5. Hashtags (3-5 relevant tags)

Example:
"THIS WEEK! Inside Out 2 arrives in theaters June 14! 🎬 Pixar's emotional journey continues as Riley navigates new feelings in her teenage years. Amy Poehler returns with an all-star cast. Don't miss the must-see animated event of summer 2025. #InsideOut2 #Pixar #ComingSoon #AnimatedMovie #ThisWeek

Mark your calendar! 📅"

Guidelines:
- Create anticipation with "THIS WEEK" / "COMING SOON"
- Natural keyword integration
- Use emojis strategically (1-2 max)
- Include specific release date
- Include searchable hashtags

Tone: Anticipatory, planning-focused, optimized for users building watchlists`,
  weeklyPinterestBoard: 'Coming This Week',
  weeklyPinterestLinkStrategy: 'tmdb',
  // Pinterest-specific settings for Monthly Previews
  monthlyPinterestTitlePrompt: `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movies and TV shows releasing next month.

INPUT: Movie/TV title, release date, cast, type (movie/tv)
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + "Next Month" + Year + Type
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "Inside Out 2 Next Month (2025) | Pixar Summer Movie"
- "The Last of Us Season 2 Coming July | HBO Series"
- "John Wick 4 Releases Next Month | Action Thriller"

Guidelines:
- Include "Next Month" or specific month name
- Include year for searchability
- Add genre or key appeal if space allows
- Use " | " separator for clarity
- Prioritize search terms users would type

Tone: Forward-looking, searchable, informative, optimized for planners`,
  monthlyPinterestDescriptionPrompt: `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movies and TV shows releasing next month.

INPUT: Title, synopsis, cast, director, release date, type
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load: "NEXT MONTH!" + Title + Month/Year
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (trending + branded)
- Optimize for search and discovery
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - "NEXT MONTH! [Title] arrives in [Month]!"
2. Synopsis (2-3 sentences)
3. Key cast/director mention
4. Where to watch + month/year
5. Hashtags (3-5 relevant tags)

Example:
"NEXT MONTH! Inside Out 2 arrives in July 2025! 🎬 Pixar's beloved characters return for an emotional journey through Riley's teenage years. Amy Poehler leads an all-star voice cast. The must-see family film of summer hits theaters July 2025. #InsideOut2 #Pixar #ComingSoon2025 #SummerMovies #NextMonth

Save for later! 📌"

Guidelines:
- Create anticipation for planning ahead
- Natural keyword integration
- Use emojis strategically (1-2 max)
- Include month and year
- Include searchable hashtags
- Encourage saves/planning

Tone: Forward-looking, planning-focused, optimized for users planning entertainment`,
  monthlyPinterestBoard: 'Coming Next Month',
  monthlyPinterestLinkStrategy: 'tmdb',
  // Pinterest-specific settings for Anniversaries
  anniversaryPinterestTitlePrompt: `You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movie and TV show anniversaries.

INPUT: Movie/TV title, original release date, years ago, cast, type
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + "[X] Years Ago Today" + Original Year
- Optimize for Pinterest nostalgia search
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "The Matrix Released 25 Years Ago Today (1999) | Keanu Reeves"
- "Friends Premiered 30 Years Ago (1994) | TV Classic"
- "Titanic Anniversary: 27 Years Since 1997 Release"

Guidelines:
- Include specific year count (5, 10, 25 years, etc.)
- Include original release year
- Add iconic cast member if space allows
- Use " | " separator for clarity
- Optimize for nostalgia searches

Tone: Nostalgic, commemorative, optimized for anniversary and throwback searches`,
  anniversaryPinterestDescriptionPrompt: `You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movie and TV show anniversaries.

INPUT: Title, original release date, years ago, cast, cultural impact, type
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load: "[X] YEARS AGO TODAY!" + Title + Year
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (nostalgia + branded)
- Optimize for throwback/anniversary searches
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - "[X] YEARS AGO TODAY! [Title] premiered!"
2. Cultural impact or memorable moment (2-3 sentences)
3. Key cast/crew mention
4. Legacy or fun fact
5. Hashtags (3-5 nostalgia tags)

Example:
"25 YEARS AGO TODAY! The Matrix premiered in 1999! 🎬 Keanu Reeves and Laurence Fishburne created an unforgettable sci-fi masterpiece that redefined action cinema. The groundbreaking film introduced bullet time and changed Hollywood forever. A true classic that still inspires today. #TheMatrix #25YearsAgo #MovieAnniversary #ThrowbackThursday #ClassicMovies

Remember this moment! 🕰️"

Guidelines:
- Emphasize nostalgia and cultural significance
- Natural keyword integration
- Use emojis strategically (1-2 max)
- Include specific year count and original year
- Include throwback/anniversary hashtags
- Encourage remembrance/sharing

  Tone: Nostalgic, celebratory, commemorative, optimized for throwback content`,
  anniversaryPinterestBoard: 'Movie & TV Anniversaries',
  anniversaryPinterestLinkStrategy: 'tmdb',
  ...tmdbPromptDefaults,
};

export function TMDbSettings() {
  const { settings: globalSettings, updateSetting: updateGlobalSetting } = useSettings();
  const [tmdbSettings, setTMDbSettings] = useState(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const initialSharedSettingsRef = useRef<Record<string, any> | null>(null);
  const [expandedPrompts, setExpandedPrompts] = useState({
    today: false,
    weekly: false,
    monthly: false,
    anniversary: false
  });
  const [customAnniversaryYears, setCustomAnniversaryYears] = useState<string[]>([]);
  const [newYearInput, setNewYearInput] = useState('');
  const [longPressYear, setLongPressYear] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  if (initialSharedSettingsRef.current === null) {
    initialSharedSettingsRef.current = Object.fromEntries(
      Object.entries(globalSettings as Record<string, any>).filter(([key]) =>
        TMDB_SHARED_SETTING_KEYS.has(key)
      )
    );
  }

  // Load settings from Backend + LocalStorage on mount
  useEffect(() => {
    async function load() {
      const shouldInjectCultureCravePrompts = !localStorage.getItem(TMDB_CULTURE_CRAVE_PROMPTS_MIGRATION_KEY);
      const sharedSettings = initialSharedSettingsRef.current || {};

      // 1. Load Local (Fastest)
      let merged = { ...defaultSettings, ...sharedSettings };
      const local = localStorage.getItem('screndly_tmdb_settings');
      if (local) {
        try {
          merged = { ...merged, ...JSON.parse(local) };
        } catch (e) {
          console.error('Local settings parse error', e);
        }
      }

      // 2. Load Backend (Source of Truth for Cron)
      try {
        const response = await fetchSettings();
        if (response.success && response.data) {
          // Merge backend data
          merged = { ...merged, ...response.data };
        }
      } catch (e) {
        console.error('Backend settings fetch error', e);
      }

      if (shouldInjectCultureCravePrompts) {
        merged = { ...merged, ...tmdbPromptDefaults };
        localStorage.setItem(TMDB_CULTURE_CRAVE_PROMPTS_MIGRATION_KEY, 'true');
      }
      setTMDbSettings(merged as typeof defaultSettings);
      setIsLoaded(true);
    }
    load();
  }, []);

  // Save settings to LocalStorage AND Backend whenever they change
  useEffect(() => {
    if (!isLoaded) return;

    // 1. LocalStorage (Instant)
    localStorage.setItem('screndly_tmdb_settings', JSON.stringify(tmdbSettings));

    // 2. Backend (Debounced for Cron Sync)
    const timeout = setTimeout(() => {
      saveSettings(tmdbSettings).catch(err =>
        console.error('Failed to sync TMDb settings to backend', err)
      );
    }, 1000);

    return () => clearTimeout(timeout);
  }, [tmdbSettings, isLoaded]);

  // Custom Anniversary Years persist only locally for now (UI preference)
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('screndly_custom_anniversary_years', JSON.stringify(customAnniversaryYears));
    }
  }, [customAnniversaryYears, isLoaded]);

  const platformIcons: Record<string, React.ComponentType<any>> = {
    x: XIcon,
    threads: ThreadsIcon,
    facebook: FacebookIcon,
    youtube: YouTubeIcon,
    pinterest: PinterestIcon,
  };

  const platformLabels: Record<string, string> = {
    x: 'X',
    threads: 'Threads',
    facebook: 'Facebook',
    youtube: 'YouTube',
    pinterest: 'Pinterest',
  };

  const updateSetting = (key: string, value: any) => {
    setTMDbSettings(prev => ({ ...prev, [key]: value }));

    if (TMDB_SHARED_SETTING_KEYS.has(key)) {
      void updateGlobalSetting(key, value);
    }

    // Show toast notifications for important settings
    if (key === 'todayAutoPost') {
      toast.success(value ? "Today's Releases auto-post enabled" : "Today's Releases auto-post disabled");
    } else if (key === 'weeklyAutoPost') {
      toast.success(value ? 'Weekly Releases auto-post enabled' : 'Weekly Releases auto-post disabled');
    } else if (key === 'monthlyAutoPost') {
      toast.success(value ? 'Monthly Previews auto-post enabled' : 'Monthly Previews auto-post disabled');
    } else if (key === 'anniversaryAutoPost') {
      toast.success(value ? 'Anniversaries auto-post enabled' : 'Anniversaries auto-post disabled');
    } else if (key === 'enableToday') {
      toast.success(value ? "Today's Releases feed enabled" : "Today's Releases feed disabled");
    } else if (key === 'enableWeekly') {
      toast.success(value ? 'Weekly Releases feed enabled' : 'Weekly Releases feed disabled');
    } else if (key === 'enableMonthly') {
      toast.success(value ? 'Monthly Previews feed enabled' : 'Monthly Previews feed disabled');
    } else if (key === 'enableAnniversaries') {
      toast.success(value ? 'Anniversaries feed enabled' : 'Anniversaries feed disabled');
    } else if (key === 'openaiModel') {
      toast.success(`AI Model changed to ${getModelDisplayName(value)}`);
    } else if (key === 'timezone') {
      toast.success(`Timezone changed to ${value}`);
    } else if (key === 'preferredImage') {
      const imagePreferenceLabel = value === 'poster'
        ? 'Poster (Vertical)'
        : value === 'backdrop'
          ? 'Backdrop (Horizontal)'
          : 'Random';
      toast.success(`Image preference changed to ${imagePreferenceLabel}`);
    } else if (key === 'todayPlatforms' || key === 'weeklyPlatforms' || key === 'monthlyPlatforms' || key === 'anniversaryPlatforms') {
      const platformType = key.replace('Platforms', '');
      const enabledPlatforms = Object.entries(value).filter(([_, enabled]) => enabled).map(([platform]) => platformLabels[platform]);
      if (enabledPlatforms.length > 0) {
        toast.success(`Platforms updated: ${enabledPlatforms.join(', ')}`);
      } else {
        toast.warning('No platforms selected for auto-posting');
      }
    }

  };

  const toggleAnniversaryYear = (year: string) => {
    const years = tmdbSettings.anniversaryYears;
    const newYears = years.includes(year)
      ? years.filter(y => y !== year)
      : [...years, year].sort((a, b) => parseInt(a) - parseInt(b));
    updateSetting('anniversaryYears', newYears);
  };

  const toggleMovieGenre = (genreId: number) => {
    const genres = tmdbSettings.movieGenres;
    const newGenres = genres.includes(genreId)
      ? genres.filter(id => id !== genreId)
      : [...genres, genreId];
    updateSetting('movieGenres', newGenres);
  };

  const toggleTVGenre = (genreId: number) => {
    const genres = tmdbSettings.tvGenres;
    const newGenres = genres.includes(genreId)
      ? genres.filter(id => id !== genreId)
      : [...genres, genreId];
    updateSetting('tvGenres', newGenres);
  };

  const toggleUnifiedGenre = (genreId: number) => {
    const selectedGenres = tmdbSettings.selectedGenres;
    const newGenres = selectedGenres.includes(genreId)
      ? selectedGenres.filter(id => id !== genreId)
      : [...selectedGenres, genreId];
    updateSetting('selectedGenres', newGenres);
  };

  const addCustomAnniversaryYear = () => {
    const year = newYearInput.trim();

    // Check if year is empty
    if (!year) {
      return;
    }

    // Check if year already exists in default years or custom years
    const allYears = [...tmdbSettings.anniversaryYears, ...customAnniversaryYears];
    if (allYears.includes(year)) {
      toast.error(`Year ${year} is already in the list`);
      return;
    }

    // Add the year
    setCustomAnniversaryYears(prev => [...prev, year]);

    // Also add it to active anniversary years
    toggleAnniversaryYear(year);

    setNewYearInput('');
    toast.success(`Added custom anniversary year: ${year}y`);
  };

  const removeCustomAnniversaryYear = (year: string) => {
    setCustomAnniversaryYears(prev => prev.filter(y => y !== year));
  };

  const handleLongPress = (year: string) => {
    setLongPressYear(year);
    const timer = setTimeout(() => {
      removeCustomAnniversaryYear(year);
      toast.success(`Removed custom anniversary year: ${year}`);
    }, 1000);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
    setLongPressYear(null);
  };

  return (
    <div className="space-y-6">
      {/* Caption Generation Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-gray-900 dark:text-white mb-1">Caption Generation</h3>
          <p className="text-sm text-[#9CA3AF]">
            AI-powered caption generation for TMDb feed posts, with live release-context verification when the model needs to confirm theaters, networks, or streaming platforms.
          </p>
        </div>

        {/* Universal OpenAI Model Selection */}
        <div>
          <Label htmlFor="tmdb-caption-model" className="text-[#6B7280] dark:text-[#9CA3AF]">Caption AI Model</Label>
          <Select
            value={tmdbSettings.tmdbCaptionModel}
            onValueChange={(value) => {
              haptics.light();
              updateSetting('tmdbCaptionModel', value);
              toast.success(`Caption AI Model changed to ${getModelDisplayName(value)}`);
            }}
          >
            <SelectTrigger id="tmdb-caption-model" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
            OpenAI models use the Responses API with web search, while Flash 3 uses grounded Google Search, to verify release date and network or platform details when helpful.
          </p>
        </div>

        {/* Today's Releases Prompt */}
        <div className="border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
          <button
            onClick={() => {
              haptics.light();
              setExpandedPrompts(prev => ({ ...prev, today: !prev.today }));
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#0A0A0A] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-white">Today's Releases Prompt</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${expandedPrompts.today ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedPrompts.today && (
            <div className="p-4 pt-0">
              <textarea
                value={tmdbSettings.todayPrompt}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('todayPrompt', e.target.value);
                }}
                rows={18}
                className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-white mt-2">
                Context: today_release — For movies/TV shows releasing today
              </p>
            </div>
          )}
        </div>

        {/* Weekly Releases Prompt */}
        <div className="border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
          <button
            onClick={() => {
              haptics.light();
              setExpandedPrompts(prev => ({ ...prev, weekly: !prev.weekly }));
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#0A0A0A] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-white">Weekly Releases Prompt</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${expandedPrompts.weekly ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedPrompts.weekly && (
            <div className="p-4 pt-0">
              <textarea
                value={tmdbSettings.weeklyPrompt}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('weeklyPrompt', e.target.value);
                }}
                rows={18}
                className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-white mt-2">
                Context: week_release — For movies/TV shows releasing next week
              </p>
            </div>
          )}
        </div>

        {/* Monthly Previews Prompt */}
        <div className="border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
          <button
            onClick={() => {
              haptics.light();
              setExpandedPrompts(prev => ({ ...prev, monthly: !prev.monthly }));
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#0A0A0A] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-white">Monthly Previews Prompt</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${expandedPrompts.monthly ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedPrompts.monthly && (
            <div className="p-4 pt-0">
              <textarea
                value={tmdbSettings.monthlyPrompt}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('monthlyPrompt', e.target.value);
                }}
                rows={18}
                className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-white mt-2">
                Context: month_notice — For movies/TV shows releasing next month
              </p>
            </div>
          )}
        </div>

        {/* Anniversaries Prompt */}
        <div className="border border-gray-200 dark:border-[#333333] rounded-lg overflow-hidden">
          <button
            onClick={() => {
              haptics.light();
              setExpandedPrompts(prev => ({ ...prev, anniversary: !prev.anniversary }));
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#0A0A0A] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-900 dark:text-white">Anniversaries Prompt</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${expandedPrompts.anniversary ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedPrompts.anniversary && (
            <div className="p-4 pt-0">
              <textarea
                value={tmdbSettings.anniversaryPrompt}
                onFocus={() => haptics.light()}
                onChange={(e) => {
                  haptics.light();
                  updateSetting('anniversaryPrompt', e.target.value);
                }}
                rows={18}
                className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono resize-none"
              />
              <p className="text-xs text-gray-500 dark:text-white mt-2">
                Context: anniversary_N_years — For movies/TV shows celebrating anniversaries
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-[#333333]"></div>

      {/* Pinterest Publishing Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-gray-900 dark:text-white mb-1">Pinterest Publishing Settings</h3>
          <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
            Pinterest requires structured content: Title + Description + Link + Board. Configure settings per feed type.
          </p>
        </div>

        {/* Today's Releases Pinterest */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4 space-y-3">
          <h4 className="text-gray-900 dark:text-white">Today's Releases - Pinterest</h4>

          <div>
            <Label htmlFor="today-pinterest-board" className="text-[#9CA3AF]">Pinterest Board</Label>
            <PinterestBoardSelect
              id="today-pinterest-board"
              value={tmdbSettings.todayPinterestBoard || 'New Releases Today'}
              onChange={(value) => {
                updateSetting('todayPinterestBoard', value);
              }}
              placeholder="New Releases Today"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board name for today's releases (must match existing Pinterest board)
            </p>
          </div>

          <div>
            <Label htmlFor="today-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={tmdbSettings.todayPinterestLinkStrategy || 'tmdb'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('todayPinterestLinkStrategy', value);
              }}
            >
              <SelectTrigger id="today-pinterest-link-strategy" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="tmdb" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  TMDb Movie/Show Page
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render Page
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins
            </p>
          </div>

          <div>
            <Label htmlFor="today-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="today-pinterest-title-prompt"
              value={tmdbSettings.todayPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('todayPinterestTitlePrompt', e.target.value);
              }}
              rows={18}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters for today's releases
            </p>
          </div>

          <div>
            <Label htmlFor="today-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="today-pinterest-description-prompt"
              value={tmdbSettings.todayPinterestDescriptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('todayPinterestDescriptionPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with urgency and CTAs for today's releases
            </p>
          </div>
        </div>

        {/* Weekly Releases Pinterest */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4 space-y-3">
          <h4 className="text-gray-900 dark:text-white">Weekly Releases - Pinterest</h4>

          <div>
            <Label htmlFor="weekly-pinterest-board" className="text-[#9CA3AF]">Pinterest Board</Label>
            <PinterestBoardSelect
              id="weekly-pinterest-board"
              value={tmdbSettings.weeklyPinterestBoard || 'Coming This Week'}
              onChange={(value) => {
                updateSetting('weeklyPinterestBoard', value);
              }}
              placeholder="Coming This Week"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board name for weekly releases (must match existing Pinterest board)
            </p>
          </div>

          <div>
            <Label htmlFor="weekly-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={tmdbSettings.weeklyPinterestLinkStrategy || 'tmdb'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('weeklyPinterestLinkStrategy', value);
              }}
            >
              <SelectTrigger id="weekly-pinterest-link-strategy" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="tmdb" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  TMDb Movie/Show Page
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render Page
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins
            </p>
          </div>

          <div>
            <Label htmlFor="weekly-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="weekly-pinterest-title-prompt"
              value={tmdbSettings.weeklyPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('weeklyPinterestTitlePrompt', e.target.value);
              }}
              rows={18}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters for weekly releases
            </p>
          </div>

          <div>
            <Label htmlFor="weekly-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="weekly-pinterest-description-prompt"
              value={tmdbSettings.weeklyPinterestDescriptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('weeklyPinterestDescriptionPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with planning-focused CTAs for weekly releases
            </p>
          </div>
        </div>

        {/* Monthly Previews Pinterest */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4 space-y-3">
          <h4 className="text-gray-900 dark:text-white">Monthly Previews - Pinterest</h4>

          <div>
            <Label htmlFor="monthly-pinterest-board" className="text-[#9CA3AF]">Pinterest Board</Label>
            <PinterestBoardSelect
              id="monthly-pinterest-board"
              value={tmdbSettings.monthlyPinterestBoard || 'Coming Next Month'}
              onChange={(value) => {
                updateSetting('monthlyPinterestBoard', value);
              }}
              placeholder="Coming Next Month"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board name for monthly previews (must match existing Pinterest board)
            </p>
          </div>

          <div>
            <Label htmlFor="monthly-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={tmdbSettings.monthlyPinterestLinkStrategy || 'tmdb'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('monthlyPinterestLinkStrategy', value);
              }}
            >
              <SelectTrigger id="monthly-pinterest-link-strategy" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="tmdb" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  TMDb Movie/Show Page
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render Page
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins
            </p>
          </div>

          <div>
            <Label htmlFor="monthly-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="monthly-pinterest-title-prompt"
              value={tmdbSettings.monthlyPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('monthlyPinterestTitlePrompt', e.target.value);
              }}
              rows={18}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters for monthly previews
            </p>
          </div>

          <div>
            <Label htmlFor="monthly-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="monthly-pinterest-description-prompt"
              value={tmdbSettings.monthlyPinterestDescriptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('monthlyPinterestDescriptionPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with future-planning CTAs for monthly previews
            </p>
          </div>
        </div>

        {/* Anniversaries Pinterest */}
        <div className="bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4 space-y-3">
          <h4 className="text-gray-900 dark:text-white">Anniversaries - Pinterest</h4>

          <div>
            <Label htmlFor="anniversary-pinterest-board" className="text-[#9CA3AF]">Pinterest Board</Label>
            <PinterestBoardSelect
              id="anniversary-pinterest-board"
              value={tmdbSettings.anniversaryPinterestBoard || 'Movie & TV Anniversaries'}
              onChange={(value) => {
                updateSetting('anniversaryPinterestBoard', value);
              }}
              placeholder="Movie & TV Anniversaries"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Board name for anniversaries (must match existing Pinterest board)
            </p>
          </div>

          <div>
            <Label htmlFor="anniversary-pinterest-link-strategy" className="text-[#9CA3AF]">Link Strategy</Label>
            <Select
              value={tmdbSettings.anniversaryPinterestLinkStrategy || 'tmdb'}
              onValueChange={(value) => {
                haptics.light();
                updateSetting('anniversaryPinterestLinkStrategy', value);
              }}
            >
              <SelectTrigger id="anniversary-pinterest-link-strategy" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]">
                <SelectItem value="tmdb" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  TMDb Movie/Show Page
                </SelectItem>
                <SelectItem value="screenrender" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]">
                  Screen Render Page
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Default link destination for Pinterest pins
            </p>
          </div>

          <div>
            <Label htmlFor="anniversary-pinterest-title-prompt" className="text-[#9CA3AF]">Pinterest Title Generation Prompt</Label>
            <textarea
              id="anniversary-pinterest-title-prompt"
              value={tmdbSettings.anniversaryPinterestTitlePrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('anniversaryPinterestTitlePrompt', e.target.value);
              }}
              rows={18}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              Search-optimized titles under 100 characters for anniversaries
            </p>
          </div>

          <div>
            <Label htmlFor="anniversary-pinterest-description-prompt" className="text-[#9CA3AF]">Pinterest Description Generation Prompt</Label>
            <textarea
              id="anniversary-pinterest-description-prompt"
              value={tmdbSettings.anniversaryPinterestDescriptionPrompt}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('anniversaryPinterestDescriptionPrompt', e.target.value);
              }}
              rows={24}
              className="w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-[#6B7280] mt-1">
              SEO-optimized descriptions with nostalgia-driven CTAs for anniversaries
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-[#333333]"></div>

      {/* Content Filters Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-gray-900 dark:text-white mb-1">Content Filters</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Filter content by genre, popularity, and language for all feed types
          </p>
        </div>

        {/* Only Popular Titles */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#9CA3AF]">Only Popular Titles</span>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Filter to only show popular movies and TV shows
            </p>
          </div>
          <Switch
            checked={tmdbSettings.onlyPopular}
            onCheckedChange={(checked) => {
              haptics.light();
              updateSetting('onlyPopular', checked);
              toast.success(checked ? 'Showing only popular titles' : 'Showing all titles');
            }}
          />
        </div>

        {/* Language Filter */}
        <div>
          <Label htmlFor="language-filter" className="text-[#9CA3AF]">Language Filter</Label>
          <Select
            value={tmdbSettings.languageFilter}
            onValueChange={(value) => {
              haptics.light();
              updateSetting('languageFilter', value);
              toast.success(value === 'en' ? 'Filtering to English only' : `Language filter: ${value}`);
            }}
          >
            <SelectTrigger id="language-filter" className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English Only</SelectItem>
              <SelectItem value="all">All Languages</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Filter content by language (ISO 639-1 code)
          </p>
        </div>

        {/* Unified Genres (Movies & TV in Sync) */}
        <div>
          <Label className="text-[#9CA3AF] mb-2 block">Genres (Movies & TV)</Label>
          <div className="flex flex-wrap gap-2 mb-1">
            {UNIFIED_GENRES.map(genre => (
              <button
                key={genre.id}
                onClick={() => {
                  haptics.light();
                  toggleUnifiedGenre(genre.id);
                }}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${tmdbSettings.selectedGenres.length === 0 || tmdbSettings.selectedGenres.includes(genre.id)
                  ? 'bg-[#ec1e24] text-white'
                  : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                  }`}
              >
                {genre.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            {tmdbSettings.selectedGenres.length === 0
              ? 'All genres allowed for both movies and TV shows'
              : `${tmdbSettings.selectedGenres.length} genre${tmdbSettings.selectedGenres.length > 1 ? 's' : ''} selected (applies to both movies & TV)`}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-[#333333]"></div>

      {/* Feed Types */}
      <div className="space-y-3">
        <div>
          <h3 className="text-gray-900 dark:text-white mb-1">Feed Configuration</h3>
          <p className="text-sm text-[#9CA3AF]">
            Configure maximum items and enable/disable each feed type independently
          </p>
        </div>

        {/* Today's Releases */}
        <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#9CA3AF]">Today's Releases</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Up to {tmdbSettings.todayMaxItems} popular movies + up to {tmdbSettings.todayMaxItems} popular TV shows releasing today
              </p>
            </div>
            <Switch
              checked={tmdbSettings.enableToday}
              onCheckedChange={(checked) => updateSetting('enableToday', checked)}
            />
          </div>
          <div>
            <Label htmlFor="today-max-items" className="text-[#9CA3AF] text-sm">Max Items</Label>
            <Input
              id="today-max-items"
              type="number"
              min="1"
              max="20"
              value={tmdbSettings.todayMaxItems}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('todayMaxItems', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Weekly Releases */}
        <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#9CA3AF]">Weekly Releases</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Up to {tmdbSettings.weeklyMaxItems} popular movies + up to {tmdbSettings.weeklyMaxItems} popular TV shows releasing next week
              </p>
            </div>
            <Switch
              checked={tmdbSettings.enableWeekly}
              onCheckedChange={(checked) => updateSetting('enableWeekly', checked)}
            />
          </div>
          <div>
            <Label htmlFor="weekly-max-items" className="text-[#9CA3AF] text-sm">Max Items</Label>
            <Input
              id="weekly-max-items"
              type="number"
              min="1"
              max="50"
              value={tmdbSettings.weeklyMaxItems}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('weeklyMaxItems', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Monthly Previews */}
        <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#9CA3AF]">Monthly Previews</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Up to {tmdbSettings.monthlyMaxItems} popular movies + up to {tmdbSettings.monthlyMaxItems} popular TV shows for next month
              </p>
            </div>
            <Switch
              checked={tmdbSettings.enableMonthly}
              onCheckedChange={(checked) => updateSetting('enableMonthly', checked)}
            />
          </div>
          <div>
            <Label htmlFor="monthly-max-items" className="text-[#9CA3AF] text-sm">Max Items</Label>
            <Input
              id="monthly-max-items"
              type="number"
              min="1"
              max="100"
              value={tmdbSettings.monthlyMaxItems}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('monthlyMaxItems', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>

        {/* Anniversaries */}
        <div className="bg-white dark:bg-[#000000] rounded-xl p-4 border border-gray-200 dark:border-[#333333] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[#9CA3AF]">Anniversaries</span>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Daily anniversary posts (1, 2, 3, 5, 10, 15, 20, 25 years)
              </p>
            </div>
            <Switch
              checked={tmdbSettings.enableAnniversaries}
              onCheckedChange={(checked) => updateSetting('enableAnniversaries', checked)}
            />
          </div>
          <div>
            <Label htmlFor="anniversary-max-items" className="text-[#9CA3AF] text-sm">Max Items</Label>
            <Input
              id="anniversary-max-items"
              type="number"
              min="1"
              max="20"
              value={tmdbSettings.anniversaryMaxItems}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('anniversaryMaxItems', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>
      </div>

      {/* Anniversary Years Selection */}
      {tmdbSettings.enableAnniversaries && (
        <div>
          <Label className="text-[#9CA3AF] mb-2 block">Track Anniversary Years</Label>

          {/* Add custom year input */}
          <div className="flex gap-2 mb-3">
            <Input
              type="number"
              placeholder="Add custom year (e.g., 30)"
              value={newYearInput}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                setNewYearInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomAnniversaryYear();
                }
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"
            />
            <button
              onClick={() => {
                haptics.light();
                addCustomAnniversaryYear();
              }}
              disabled={!newYearInput.trim()}
              className="px-4 py-2 bg-[#ec1e24] text-white rounded-lg hover:bg-[#d11920] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {/* Year buttons with long-press delete */}
          <div className="flex flex-wrap gap-2 mb-2">
            {/* Default years */}
            {['1', '2', '3', '5', '10', '15', '20', '25'].map(year => (
              <button
                key={year}
                onClick={() => {
                  haptics.light();
                  toggleAnniversaryYear(year);
                }}
                onTouchStart={() => {
                  const timer = setTimeout(() => {
                    haptics.light();
                    toast.info(`Cannot delete default year: ${year}y. Only custom years can be deleted.`);
                  }, 3000);
                  setLongPressTimer(timer);
                }}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => {
                  const timer = setTimeout(() => {
                    haptics.light();
                    toast.info(`Cannot delete default year: ${year}y. Only custom years can be deleted.`);
                  }, 3000);
                  setLongPressTimer(timer);
                }}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                className={`px-3 py-1 rounded-lg text-sm transition-all ${tmdbSettings.anniversaryYears.includes(year)
                  ? 'bg-[#ec1e24] text-white'
                  : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                  }`}
              >
                {year}y
              </button>
            ))}

            {/* Custom years */}
            {customAnniversaryYears.map(year => (
              <button
                key={`custom-${year}`}
                onClick={() => {
                  haptics.light();
                  toggleAnniversaryYear(year);
                }}
                onTouchStart={() => {
                  const timer = setTimeout(() => {
                    haptics.light();
                    removeCustomAnniversaryYear(year);
                    // Also remove from active years if it was selected
                    if (tmdbSettings.anniversaryYears.includes(year)) {
                      toggleAnniversaryYear(year);
                    }
                    toast.success(`Deleted custom year: ${year}y`);
                  }, 3000);
                  setLongPressTimer(timer);
                  setLongPressYear(year);
                }}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => {
                  const timer = setTimeout(() => {
                    haptics.light();
                    removeCustomAnniversaryYear(year);
                    // Also remove from active years if it was selected
                    if (tmdbSettings.anniversaryYears.includes(year)) {
                      toggleAnniversaryYear(year);
                    }
                    toast.success(`Deleted custom year: ${year}y`);
                  }, 3000);
                  setLongPressTimer(timer);
                  setLongPressYear(year);
                }}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                className={`px-3 py-1 rounded-lg text-sm transition-all relative ${tmdbSettings.anniversaryYears.includes(year)
                  ? 'bg-[#ec1e24] text-white'
                  : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                  } ${longPressYear === year ? 'opacity-70' : ''}`}
              >
                {year}y
              </button>
            ))}
          </div>

          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">
            Hold any custom year for 3 seconds to delete it
          </p>

          <div className="mb-4">
            <Label htmlFor="anniversary-start-year" className="text-[#9CA3AF]">Anniversary Starting Year</Label>
            <Input
              id="anniversary-start-year"
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={tmdbSettings.anniversaryStartYear}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('anniversaryStartYear', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
              Only track anniversaries for movies/TV shows released from this year onwards
            </p>
          </div>

          <div>
            <Label htmlFor="max-per-anniversary" className="text-[#9CA3AF]">Max items per anniversary</Label>
            <Input
              id="max-per-anniversary"
              type="number"
              min="1"
              max="5"
              value={tmdbSettings.maxPerAnniversary}
              onFocus={() => haptics.light()}
              onChange={(e) => {
                haptics.light();
                updateSetting('maxPerAnniversary', e.target.value);
              }}
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            />
          </div>
        </div>
      )}

      {/* Caption Settings */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="caption-max-length" className="text-[#9CA3AF]">Max Caption Length</Label>
          <Input
            id="caption-max-length"
            type="number"
            min="50"
            max="200"
            value={tmdbSettings.captionMaxLength}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('captionMaxLength', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Characters (recommended: 100)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#9CA3AF]">Include Cast Names</span>
          <Switch
            checked={tmdbSettings.includeCast}
            onCheckedChange={(checked) => updateSetting('includeCast', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#9CA3AF]">Include Release Date</span>
          <Switch
            checked={tmdbSettings.includeDate}
            onCheckedChange={(checked) => updateSetting('includeDate', checked)}
          />
        </div>
      </div>

      {/* Image Preferences */}
      <div className="space-y-3">
        <div>
          <Label className="text-[#9CA3AF]">Preferred Image Type</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button
              onClick={() => {
                haptics.light();
                updateSetting('preferredImage', 'poster');
              }}
              className={`px-4 py-2 rounded-lg transition-all text-sm ${tmdbSettings.preferredImage === 'poster'
                ? 'bg-[#ec1e24] text-white'
                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                }`}
            >
              Poster (Vertical)
            </button>
            <button
              onClick={() => {
                haptics.light();
                updateSetting('preferredImage', 'backdrop');
              }}
              className={`px-4 py-2 rounded-lg transition-all text-sm ${tmdbSettings.preferredImage === 'backdrop'
                ? 'bg-[#ec1e24] text-white'
                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                }`}
            >
              Backdrop (Horizontal)
            </button>
            <button
              onClick={() => {
                haptics.light();
                updateSetting('preferredImage', 'random');
              }}
              className={`px-4 py-2 rounded-lg transition-all text-sm ${tmdbSettings.preferredImage === 'random'
                ? 'bg-[#ec1e24] text-white'
                : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                }`}
            >
              Random
            </button>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Random will automatically choose between poster and backdrop for each post
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[#9CA3AF]">Rehost Image to storage</span>
          <Switch
            checked={tmdbSettings.rehostImages}
            onCheckedChange={(checked) => updateSetting('rehostImages', checked)}
          />
        </div>
      </div>

      {/* Deduplication & Caching */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="dedupe-window" className="text-[#9CA3AF]">Deduplication Window (days)</Label>
          <Input
            id="dedupe-window"
            type="number"
            min="1"
            max="90"
            value={tmdbSettings.dedupeWindow}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('dedupeWindow', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Prevent same title from posting within this window
          </p>
        </div>

        <div className="space-y-1 pt-2">
          <h3 className="text-gray-900 dark:text-white">Retention & Activity</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
            Control how long queued TMDb feed items and resolved TMDb activity remain visible.
          </p>
        </div>

        <div>
          <Label htmlFor="queued-retention" className="text-[#9CA3AF]">Feed Retention (hours)</Label>
          <Input
            id="queued-retention"
            type="number"
            min="1"
            max="720"
            value={tmdbSettings.tmdbQueuedRetentionHours}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('tmdbQueuedRetentionHours', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Unposted queued TMDb feed items in the TMDb Feeds page are hidden by this setting and removed by backend cleanup after this many hours.
          </p>
        </div>

        <div>
          <Label htmlFor="tmdb-activity-retention" className="text-[#9CA3AF]">Activity Retention (hours)</Label>
          <Input
            id="tmdb-activity-retention"
            type="number"
            min="1"
            max="720"
            value={tmdbSettings.tmdbActivityRetention}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('tmdbActivityRetention', parseInt(e.target.value, 10) || 24);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Published and failed TMDb activity items are hidden in the activity page immediately and removed during backend cleanup after this many hours. Queued and scheduled items stay visible until they are resolved.
          </p>
        </div>

        <div>
          <Label htmlFor="tmdb-log-level" className="text-[#9CA3AF]">Log Level</Label>
          <Select
            value={tmdbSettings.tmdbLogLevel}
            onValueChange={(value) => {
              haptics.light();
              updateSetting('tmdbLogLevel', value);
            }}
          >
            <SelectTrigger
              id="tmdb-log-level"
              className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minimal">Minimal (Failures only)</SelectItem>
              <SelectItem value="standard">Standard (Published + Failures)</SelectItem>
              <SelectItem value="full">Full (Queued + Scheduled + Published + Failures)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">
            Controls how much TMDb activity is shown in the activity page.
          </p>
        </div>

        <div>
          <Label htmlFor="discovery-cache" className="text-[#9CA3AF]">Discovery Cache TTL (hours)</Label>
          <Input
            id="discovery-cache"
            type="number"
            min="1"
            max="48"
            value={tmdbSettings.discoveryCacheTTL}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('discoveryCacheTTL', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>

        <div>
          <Label htmlFor="credits-cache" className="text-[#9CA3AF]">Credits Cache TTL (days)</Label>
          <Input
            id="credits-cache"
            type="number"
            min="1"
            max="90"
            value={tmdbSettings.creditsCacheTTL}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('creditsCacheTTL', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>

        <div>
          <Label htmlFor="caption-cache" className="text-[#9CA3AF]">Caption Cache TTL (days)</Label>
          <Input
            id="caption-cache"
            type="number"
            min="1"
            max="90"
            value={tmdbSettings.captionCacheTTL}
            onFocus={() => haptics.light()}
            onChange={(e) => {
              haptics.light();
              updateSetting('captionCacheTTL', e.target.value);
            }}
            className="bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"
          />
        </div>
      </div>

      {/* Autopost Engine Header */}
      <div>
        <h2 className="text-gray-900 dark:text-white mb-1">Autopost Engine</h2>
        <p className="text-sm text-gray-600 dark:text-[#9CA3AF]">
          Centralized posting orchestration with feed-aware prioritization and rate governance
        </p>
      </div>

      {/* Auto-Post & Platform Configuration */}
      <div className="space-y-4">
        {/* Today's Releases */}
        {tmdbSettings.enableToday && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#9CA3AF]">Today's Releases Auto-Post</span>
              <Switch
                checked={tmdbSettings.todayAutoPost}
                onCheckedChange={(checked) => updateSetting('todayAutoPost', checked)}
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block text-[#6B7280] dark:text-[#9CA3AF]">PLATFORMS</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {Object.entries(tmdbSettings.todayPlatforms).map(([platform, enabled]) => {
                  const Icon = platformIcons[platform];
                  return Icon ? (
                    <button
                      key={platform}
                      onClick={() => {
                        haptics.light();
                        updateSetting('todayPlatforms', {
                          ...tmdbSettings.todayPlatforms,
                          [platform]: !enabled
                        });
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${enabled
                        ? 'bg-[#ec1e24] text-white'
                        : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                        }`}
                      title={platformLabels[platform]}
                    >
                      <Icon className={platform === 'x' ? 'w-4 h-4' : platform === 'facebook' || platform === 'youtube' ? 'w-6 h-6' : 'w-5 h-5'} />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Weekly Releases */}
        {tmdbSettings.enableWeekly && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#9CA3AF]">Weekly Releases Auto-Post</span>
              <Switch
                checked={tmdbSettings.weeklyAutoPost}
                onCheckedChange={(checked) => updateSetting('weeklyAutoPost', checked)}
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block text-[#6B7280] dark:text-[#9CA3AF]">PLATFORMS</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {Object.entries(tmdbSettings.weeklyPlatforms).map(([platform, enabled]) => {
                  const Icon = platformIcons[platform];
                  return Icon ? (
                    <button
                      key={platform}
                      onClick={() => {
                        haptics.light();
                        updateSetting('weeklyPlatforms', {
                          ...tmdbSettings.weeklyPlatforms,
                          [platform]: !enabled
                        });
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${enabled
                        ? 'bg-[#ec1e24] text-white'
                        : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                        }`}
                      title={platformLabels[platform]}
                    >
                      <Icon className={platform === 'x' ? 'w-4 h-4' : platform === 'facebook' || platform === 'youtube' ? 'w-6 h-6' : 'w-5 h-5'} />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Monthly Previews */}
        {tmdbSettings.enableMonthly && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#9CA3AF]">Monthly Previews Auto-Post</span>
              <Switch
                checked={tmdbSettings.monthlyAutoPost}
                onCheckedChange={(checked) => updateSetting('monthlyAutoPost', checked)}
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block text-[#6B7280] dark:text-[#9CA3AF]">PLATFORMS</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {Object.entries(tmdbSettings.monthlyPlatforms).map(([platform, enabled]) => {
                  const Icon = platformIcons[platform];
                  return Icon ? (
                    <button
                      key={platform}
                      onClick={() => {
                        haptics.light();
                        updateSetting('monthlyPlatforms', {
                          ...tmdbSettings.monthlyPlatforms,
                          [platform]: !enabled
                        });
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${enabled
                        ? 'bg-[#ec1e24] text-white'
                        : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                        }`}
                      title={platformLabels[platform]}
                    >
                      <Icon className={platform === 'x' ? 'w-4 h-4' : platform === 'facebook' || platform === 'youtube' ? 'w-6 h-6' : 'w-5 h-5'} />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Anniversaries */}
        {tmdbSettings.enableAnniversaries && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#9CA3AF]">Anniversaries Auto-Post</span>
              <Switch
                checked={tmdbSettings.anniversaryAutoPost}
                onCheckedChange={(checked) => updateSetting('anniversaryAutoPost', checked)}
              />
            </div>
            <div>
              <Label className="text-xs mb-2 block text-[#6B7280] dark:text-[#9CA3AF]">PLATFORMS</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {Object.entries(tmdbSettings.anniversaryPlatforms).map(([platform, enabled]) => {
                  const Icon = platformIcons[platform];
                  return Icon ? (
                    <button
                      key={platform}
                      onClick={() => {
                        haptics.light();
                        updateSetting('anniversaryPlatforms', {
                          ...tmdbSettings.anniversaryPlatforms,
                          [platform]: !enabled
                        });
                      }}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${enabled
                        ? 'bg-[#ec1e24] text-white'
                        : 'bg-white dark:bg-[#000000] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#222222]'
                        }`}
                      title={platformLabels[platform]}
                    >
                      <Icon className={platform === 'x' ? 'w-4 h-4' : platform === 'facebook' || platform === 'youtube' ? 'w-6 h-6' : 'w-5 h-5'} />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
