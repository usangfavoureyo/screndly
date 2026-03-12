import{r as u,ab as e,ap as l}from"./vendor-5iQPokUk.js";import{h as a,L as i,U as C,aa as I,ab as O}from"./index-C_2wrC0o.js";import{I as n}from"./input-C0lF3xX2.js";import{S as c,a as h,b as x,c as m,d as o}from"./select-BV8SsH3M.js";import{P as M}from"./pinterest-board-select-CAOjIoxt.js";import{A as U}from"./AnalyticsSelfOptimization-B_-sz9m5.js";import"./vendor-ui-CHjGGgqY.js";import"./vendor-icons-ufHCceTv.js";import"./vendor-charts-DchDvYbt.js";import"./switch-7RMm2O8W.js";import"./InstagramIcon-CKY9arHU.js";import"./TikTokIcon-BMpoZu8x.js";const D="trailer, teaser, official, first look, sneak peek",G="24",v="process-backlog",d="future-only",E=Array.from({length:24},(r,s)=>String(s+1));function Q({settings:r,updateSetting:s,updateSettings:k,onBack:j}){const[N,f]=u.useState(2),[Y,R]=u.useState(!1);u.useEffect(()=>{},[]);const w=t=>{a.light();const p=parseInt(t)||2;s("fetchInterval",t),f(p),l.success(`Polling interval updated to ${p} minute(s)`)},T=t=>{a.light(),s("advancedFilters",t),l.success("Trailer keywords updated")},A=t=>{a.light();const p=parseInt(t)||10;s("postInterval",t),l.success(`Post interval updated to ${p} minute(s)`)},P=t=>{a.light(),s("videoAgeGateHours",t),l.success(t==="off"?"Upload age gate turned off":`Only videos from the last ${t} hour${t==="1"?"":"s"} will be considered`)},S=t=>{a.light(),k({videoBacklogMode:t,videoFutureOnlySince:t===d?new Date().toISOString():""}),l.success(t===d?"Future-only mode enabled from now":"Backlog processing enabled")},F=typeof r.videoAgeGateHours=="number"?String(r.videoAgeGateHours):typeof r.videoAgeGateHours=="string"&&r.videoAgeGateHours.trim().length>0?r.videoAgeGateHours:G,b=r.videoBacklogMode===d?d:v,g=b===d&&typeof r.videoFutureOnlySince=="string"&&r.videoFutureOnlySince?new Date(r.videoFutureOnlySince):null,y=g&&!Number.isNaN(g.getTime())?g.toLocaleString():"";return e.jsxs("div",{className:"fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto",children:[e.jsxs("div",{className:"sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3",children:[e.jsx("button",{className:"text-gray-900 dark:text-white p-1",onClick:()=>{a.light(),j()},children:e.jsx("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M22 12H2M9 19l-7-7 7-7"})})}),e.jsx("h2",{className:"text-gray-900 dark:text-white text-xl",children:"Video"})]}),e.jsxs("div",{className:"p-6 space-y-6",children:[e.jsx(U,{storageKey:"video_settings",description:"Enable AI-powered optimization to automatically improve captions, posting times, and model selection for video content based on performance analytics."}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-3",children:"Polling Interval"}),e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Polling Interval (minutes)"}),e.jsx(n,{type:"number",min:"1",max:"60",value:r.fetchInterval??N,onFocus:()=>a.light(),onChange:t=>w(t.target.value),className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"})]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-3",children:"Post Interval"}),e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Post Interval (minutes)"}),e.jsx(n,{type:"number",min:"1",max:"1440",value:r.postInterval??10,onFocus:()=>a.light(),onChange:t=>A(t.target.value),className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"})]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-3",children:"Trailer Detection"}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Trailer Keywords (comma-separated)"}),e.jsx(n,{value:r.advancedFilters??"",onFocus:()=>a.light(),onChange:t=>T(t.target.value),placeholder:D,className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Only saved keyword values are sent to the backend poller. Placeholder text is not treated as an active rule."})]}),e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Region Filter (optional)"}),e.jsx(n,{value:r.regionFilter??"",onFocus:()=>a.light(),onChange:t=>{a.light(),s("regionFilter",t.target.value)},placeholder:"US,UK,CA",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"})]}),e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Upload Age Gate"}),e.jsxs(c,{value:F,onValueChange:P,children:[e.jsx(h,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(x,{placeholder:"Select upload age gate"})}),e.jsxs(m,{children:[e.jsx(o,{value:"off",children:"Off"}),E.map(t=>e.jsxs(o,{value:t,children:[t," hour",t==="1"?"":"s"]},t))]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Default is 24 hours. Turn it off to allow older unprocessed uploads in the recent feed scan."})]}),e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Backlog Mode"}),e.jsxs(c,{value:b,onValueChange:S,children:[e.jsx(h,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(x,{placeholder:"Select backlog mode"})}),e.jsxs(m,{children:[e.jsx(o,{value:v,children:"Process backlog"}),e.jsx(o,{value:d,children:"Future uploads only"})]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Future uploads only ignores videos already in the feed and starts from the moment you enable it."}),y?e.jsxs("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:["Current future-only cutoff: ",y]}):null]})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-3",children:"Format Detection"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Filter videos by aspect ratio and quality to ensure only 16:9 landscape trailers at 1080p or higher are processed."}),e.jsxs("div",{className:"space-y-3",children:[e.jsx("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4",children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("div",{className:"flex-shrink-0 mt-0.5",children:e.jsx(n,{type:"checkbox",id:"exclude-shorts",checked:r.excludeShorts!==!1,onChange:t=>{a.light(),s("excludeShorts",t.target.checked),l.success(t.target.checked?"YouTube Shorts will be excluded":"YouTube Shorts will be allowed")},className:"w-4 h-4 border-gray-300 dark:border-[#333333] accent-black dark:accent-white"})}),e.jsxs("div",{className:"flex-1",children:[e.jsx(i,{htmlFor:"exclude-shorts",className:"text-gray-900 dark:text-white cursor-pointer",children:"Exclude YouTube Shorts (9:16 vertical videos)"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mt-1",children:"Automatically skip videos with /shorts/ URL and #shorts in title. Only process 16:9 landscape trailers with a minimum 1080p source."})]})]})}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4",children:[e.jsx("h4",{className:"text-sm text-gray-900 dark:text-white mb-2",children:"Detection Criteria"}),e.jsxs("div",{className:"space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"✓"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"1080p Minimum:"})," Only landscape trailers at 1920x1080 or higher are accepted"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"✗"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Below 1080p:"})," 720p, 480p, and lower resolution uploads are skipped"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"✗"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"URL Pattern:"})," Videos with /shorts/ in URL are skipped"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"✗"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Title Indicators:"})," #shorts, #short, (shorts) in title"]})]})]})]}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4",children:[e.jsx("h4",{className:"text-sm text-gray-900 dark:text-white mb-2",children:"Platform Upload Settings"}),e.jsxs("div",{className:"space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]",children:[e.jsx("p",{className:"text-gray-900 dark:text-white mb-1",children:"All platforms receive the original 1080p+ source file:"}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"YouTube:"})," Native 16:9 (1080p, 4K)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"TikTok:"})," Letterboxed 16:9 (users can rotate to landscape)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Instagram:"})," 16:9 Feed/IGTV (landscape)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Facebook/Threads/X/Bluesky:"})," Native 16:9"]})]}),e.jsx("p",{className:"text-[#ec1e24] mt-2 italic",children:"✓ Original aspect ratio preserved • No cropping or distortion"})]})]})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Caption Generation"}),e.jsx("p",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-3",children:"AI-powered caption generation from Video content for social media publishing"}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-openai-model",className:"text-[#9CA3AF]",children:"Caption AI Model"}),e.jsxs(c,{value:r.videoOpenaiModel||C.video,onValueChange:t=>{a.light(),s("videoOpenaiModel",t),l.success(`AI Model changed to ${O(t)}`)},children:[e.jsx(h,{id:"video-openai-model",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(x,{})}),e.jsx(m,{children:I.map(t=>e.jsx(o,{value:t.id,children:t.displayName},t.id))})]})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Universal Social Media Caption Generation"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Single prompt generates optimized captions for all 5 platforms in one API call"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-universal-caption-prompt",className:"text-[#9CA3AF]",children:"Universal Caption Generation Prompt"}),e.jsx("textarea",{id:"video-universal-caption-prompt",value:r.videoUniversalCaptionPrompt||`You are a social media caption writer for Screen Render. Generate platform-optimized captions for all 5 platforms in one response using Google Search API context.

INPUT: Movie/TV title, 1-2 major cast members, release date, synopsis, Google Search API trending data
OUTPUT: JSON object with 5 platform-specific captions

Platform Requirements:

X (Twitter) - Culture Crave Style:
- Format: "#TitleNoSpaces hits [platform/theatres] [date] — [1-2 cast] [hook]"
- Max 280 characters
- 1-2 emojis max
- Human, conversational tone
- Example: "#DunePartTwo hits theatres March 1 — Timothée Chalamet and Zendaya bring the spice again."

Facebook:
- Strong opening hook (15-20 words)
- 150-300 words total
- 4-6 emojis throughout
- Storytelling, community-building
- Include call-to-action

Instagram:
- Eye-catching opening (8-12 words)
- 150-200 words
- 150-200 words
- 5-8 emojis
- Line breaks for readability
- Visual, aesthetic language

Threads:
- Conversational opening (10-15 words)
- Under 500 characters
- Under 500 characters
- 2-4 emojis
- Discussion-starting, authentic

TikTok:
- Hook-first (5-8 words, can be lowercase)
- Under 300 characters
- Under 300 characters
- 2-3 emojis
- Gen Z, meme-friendly, viral

Output Format (JSON):
{
  "x": "Caption text here...",
  "facebook": "Caption text here...",
  "instagram": "Caption text here...",
  "threads": "Caption text here...",
  "tiktok": "Caption text here..."
}

IMPORTANT: Return ONLY valid JSON. Use Google Search data for trending context and buzz.

Tone: Platform-aware, optimized for engagement, culturally relevant`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoUniversalCaptionPrompt",t.target.value)},rows:38,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Generates all 5 platform captions in one API call with JSON output"})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"YouTube Upload Settings"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"AI-powered title, description, and playlist detection for YouTube uploads"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-youtube-title-prompt",className:"text-[#9CA3AF]",children:"YouTube Title Generation Prompt"}),e.jsx("textarea",{id:"video-youtube-title-prompt",value:r.videoYoutubeTitlePrompt||`You are a YouTube SEO expert for Screen Render. Create optimized YouTube titles using Google Search API to determine content type.

INPUT: Movie/TV title, trailer type, year, Google Search API data
OUTPUT: YouTube title in strict format

REQUIRED FORMAT:
[Title] | [Trailer Type] | ([Year] [TV Show OR Movie])

Examples:
- "Mottoehead Season 1 | Official Trailer | (2025 TV Show)"
- "The Holy Trinity | Official Trailer | (2025 Movie)"
- "The Surfer | 'My Board' Movie Clip | (2025 Movie)"
- "Gladiator II | Official Trailer | (2024 Movie)"
- "House of the Dragon Season 3 | Teaser Trailer | (2026 TV Show)"

Guidelines:
- Use Google Search API to determine if content is TV Show or Movie
- For TV shows: Include "Season X" if applicable
- For movie clips: Include clip name in single quotes
- Use " | " (space-pipe-space) as separator
- Always end with year and type in parentheses
- Keep total under 70 characters
- Use title case

Tone: Professional, SEO-optimized, consistent format`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoYoutubeTitlePrompt",t.target.value)},rows:20,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:'Strict format: "Title | Trailer Type | (Year TV Show/Movie)" with Google Search API'})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-youtube-description-prompt",className:"text-[#9CA3AF]",children:"YouTube Description Generation Prompt"}),e.jsx("textarea",{id:"video-youtube-description-prompt",value:r.videoYoutubeDescriptionPrompt||`You are a YouTube SEO expert for Screen Render, a movie and TV trailer platform. Create optimized YouTube video descriptions for trailer uploads.

INPUT: Movie/TV title, cast, release date, synopsis, director, studio
OUTPUT: YouTube-optimized video description

Guidelines:
- First 2 lines (150 chars) are most important - front-load key info
- Include movie/show title, release date, and key cast in opening
- Add full synopsis (2-3 paragraphs)
- Include:
  * Director and key crew
  * Main cast list
  * Release date and studio
  * Relevant links (official site, tickets, etc.)
- Include:
- Include timestamps if applicable
- Add "Subscribe for more trailers" CTA
- Use proper formatting with line breaks

Structure:
[Opening hook with title and release date]

[Synopsis paragraph 1]

[Synopsis paragraph 2]

Director: [Name]
Cast: [Names]
Release Date: [Date]
Studio: [Studio]

🔔 Subscribe to Screen Render for the latest movie and TV trailers!

#MovieTitle #Trailers

Tone: Professional, informative, SEO-rich`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoYoutubeDescriptionPrompt",t.target.value)},rows:20,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Full SEO-optimized description with structure, metadata, and CTAs"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-youtube-playlist-prompt",className:"text-[#9CA3AF]",children:"YouTube Playlist Detection Prompt"}),e.jsx("textarea",{id:"video-youtube-playlist-prompt",value:r.videoYoutubePlaylistPrompt||`You are a content categorization expert for Screen Render's YouTube channel. Analyze trailer videos and determine which playlist(s) they belong to.

INPUT: Movie/TV title, genre, content type, studio, trailer metadata
OUTPUT: JSON array of matching playlist names

Available Playlists:
- "Movie Trailers" - All theatrical movie trailers
- "TV Show Trailers" - All TV series, limited series, and streaming show trailers
- "Movie Clips" - Exclusive clips, scenes, and featurettes from movies
- "Anime Trailers" - Anime films and series trailers
- "Horror Trailers" - Horror genre films and shows
- "Action Trailers" - Action genre films and shows
- "Comedy Trailers" - Comedy genre films and shows
- "Documentary Trailers" - Documentary films and series
- "4K Trailers" - High quality 4K resolution trailers
- "Coming Soon 2025" - All content releasing in 2025
- "Awards Season" - Oscar bait and awards contenders

Detection Rules:
- A video can belong to multiple playlists
- Always include the primary category (Movie/TV/Clip/Anime)
- Add genre-specific playlist if applicable
- Add "4K Trailers" if video quality is 4K
- Add year-specific playlist based on release date
- Add "Awards Season" for prestige films (September-February releases, A24, Searchlight, etc.)

Output Format:
Return ONLY a JSON array: ["Playlist 1", "Playlist 2", "Playlist 3"]

Example outputs:
- Action movie in 4K releasing 2025: ["Movie Trailers", "Action Trailers", "4K Trailers", "Coming Soon 2025"]
- Horror anime film: ["Anime Trailers", "Movie Trailers", "Horror Trailers"]
- TV drama for awards season: ["TV Show Trailers", "Awards Season"]`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoYoutubePlaylistPrompt",t.target.value)},rows:22,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"AI automatically categorizes trailers into appropriate YouTube playlists"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-youtube-playlists",className:"text-[#9CA3AF]",children:"YouTube Playlists (comma-separated)"}),e.jsx("textarea",{id:"video-youtube-playlists",value:r.videoYoutubePlaylists||"Movie Trailers, TV Show Trailers, Movie Clips, Anime Trailers, Horror Trailers, Action Trailers, Comedy Trailers, Documentary Trailers, 4K Trailers, Coming Soon 2025, Awards Season",onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoYoutubePlaylists",t.target.value)},rows:4,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"List of available playlists on your YouTube channel (one per line or comma-separated)"})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Pinterest Publishing Settings"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Pinterest requires structured content: Title + Description + Link + Board. Configure AI generation for each field."})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-pinterest-title-prompt",className:"text-[#9CA3AF]",children:"Pinterest Title Generation Prompt"}),e.jsx("textarea",{id:"video-pinterest-title-prompt",value:r.videoPinterestTitlePrompt||`You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movie and TV trailers.

INPUT: Movie/TV title, release date, trailer type, cast, Google Search API data
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + Year + Content Type (Movie/TV Show)
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "The Batman (2025) - Official Movie Trailer | Robert Pattinson"
- "Stranger Things Season 5 Trailer (2025) | Netflix Series"
- "Dune: Part Three Official Trailer | 2026 Sci-Fi Epic"
- "Wednesday Season 2 Teaser | 2025 Netflix Series"

Guidelines:
- Use Google Search API to confirm title, year, and type
- Include 1-2 key cast members if space allows
- Use " | " separator for clarity
- Always include year for searchability
- Prioritize search terms users would type

Tone: Clear, searchable, informative, optimized for Pinterest discovery`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoPinterestTitlePrompt",t.target.value)},rows:24,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Search-optimized titles under 100 characters with keywords front-loaded"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-pinterest-description-prompt",className:"text-[#9CA3AF]",children:"Pinterest Description Generation Prompt"}),e.jsx("textarea",{id:"video-pinterest-description-prompt",value:r.videoPinterestDescriptionPrompt||`You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movie and TV trailers.

INPUT: Movie/TV title, synopsis, cast, director, release date, genre, Google Search API data
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load key information: Title, release date, hook
- Include relevant keywords naturally throughout
- Include relevant keywords naturally throughout
- Optimize for search and discovery
- Include a call-to-action
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - Most important
2. Synopsis/context (2-3 sentences)
3. Key cast/director mention
4. Release date and platform
5. CTA (Watch now, Get tickets, etc.)

Example:
"The Batman returns in 2025! 🦇 Matt Reeves' epic sequel reunites Robert Pattinson as the Dark Knight facing his deadliest enemy yet. Colin Farrell returns as The Penguin in this darker, grittier take on Gotham. Coming to theaters Summer 2025.

Watch the trailer now! 🎬"

Guidelines:
- Use Google Search API for accurate cast, dates, platform info
- Natural keyword integration (no keyword stuffing)
- Use emojis strategically (1-2 max)
- Use emojis strategically (1-2 max)
- Make first sentence compelling and complete
- Add urgency or exclusivity when relevant

Tone: Engaging, searchable, benefit-focused, optimized for Pinterest users seeking inspiration and planning`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoPinterestDescriptionPrompt",t.target.value)},rows:32,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"SEO-optimized descriptions with front-loaded hooks and strategic hashtags"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-pinterest-board",className:"text-[#9CA3AF]",children:"Default Pinterest Board"}),e.jsx(M,{id:"video-pinterest-board",value:r.videoPinterestBoard||"Movie Trailers",onChange:t=>{s("videoPinterestBoard",t),l.success("Pinterest board updated")},placeholder:"Movie Trailers",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Board name where trailer videos will be published (must match existing Pinterest board)"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-pinterest-link-strategy",className:"text-[#9CA3AF]",children:"Link Strategy"}),e.jsxs(c,{value:r.videoPinterestLinkStrategy||"youtube",onValueChange:t=>{a.light(),s("videoPinterestLinkStrategy",t),l.success("Pinterest link strategy updated")},children:[e.jsx(h,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(x,{})}),e.jsxs(m,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]",children:[e.jsx(o,{value:"youtube",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"YouTube Trailer URL"}),e.jsx(o,{value:"tmdb",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"TMDb Movie/Show Page"}),e.jsx(o,{value:"screenrender",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"Screen Render Movie Page"}),e.jsx(o,{value:"custom",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"Custom URL (set per post)"})]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Default link destination for Pinterest pins (auto-generated based on source)"})]}),r.videoPinterestLinkStrategy==="custom"&&e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-pinterest-default-link",className:"text-[#9CA3AF]",children:"Default Custom Link"}),e.jsx(n,{id:"video-pinterest-default-link",value:r.videoPinterestDefaultLink||"",onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoPinterestDefaultLink",t.target.value)},placeholder:"https://screenrender.com",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Fallback URL when custom link is not specified per post"})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Pre-Download Content Filtering"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"GPT-5 Nano with Google Search API filters trailers before download"})]}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4",children:[e.jsx("h4",{className:"text-sm text-gray-900 dark:text-white mb-2",children:"Filtering Strategy"}),e.jsxs("div",{className:"space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Step 1:"})," YouTube watcher detects new trailer video"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Step 2:"})," Google Search API fetches title, country, language, genres"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Step 3:"})," GPT-5 Nano validates if content matches criteria (YES/NO)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Step 4:"})," Only queue video for download if GPT returns YES"]})]})]})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-filter-prompt",className:"text-[#9CA3AF]",children:"Content Filtering Prompt (GPT-5 Nano)"}),e.jsx("textarea",{id:"video-filter-prompt",value:r.videoFilterPrompt||`You are a content filter for Screen Render. Validate trailer titles using Google Search API data.

INPUT: Trailer title, Google Search API results (title, country, language, genres from IMDb/TMDb/Wikipedia)
OUTPUT: YES or NO

Criteria (ALL must match):
✓ Production: US or British-produced only
✓ Language: English-language only (original language must be "en")
✓ Genres: Must be ONE of: action, adventure, thriller, sci-fi, drama, fantasy, comedy, science fiction, romance
✗ Exclude: wrestling, sports, documentary, WWE, boxing, reality shows, cooking shows, foreign dubs, non-English content

Instructions:
1. Use Google Search API to fetch: title, production country, original language, genres
2. Validate against criteria above
3. Answer ONLY "YES" or "NO" (no explanation)

Examples:
Input: "Emily In Paris" (France, French, drama)
Output: NO (French-produced)

Input: "Dune: Part Two" (US, English, sci-fi/adventure)
Output: YES

Input: "WWE Monday Night RAW" (US, English, sports/wrestling)
Output: NO (wrestling/sports excluded)

Input: "Squid Game Season 2" (South Korea, Korean, thriller)
Output: NO (Korean-produced, non-English)

Tone: Binary validation, strict criteria enforcement`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoFilterPrompt",t.target.value)},rows:24,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"GPT-5 Nano validates US/UK English-language content only, excludes foreign/dubbed/sports"})]}),e.jsxs("div",{children:[e.jsx(i,{className:"text-[#9CA3AF]",children:"Filtering Performance Settings"}),e.jsxs("div",{className:"space-y-2 mt-1",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(n,{type:"checkbox",id:"video-filter-cache",checked:r.videoFilterCache!==!1,onChange:t=>{a.light(),s("videoFilterCache",t.target.checked)},className:"w-4 h-4 border-gray-300 dark:border-[#333333] accent-black dark:accent-white"}),e.jsx(i,{htmlFor:"video-filter-cache",className:"text-xs text-gray-600 dark:text-[#9CA3AF] cursor-pointer",children:"Cache filtered titles to reduce API calls"})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(n,{type:"checkbox",id:"video-filter-tmdb-validation",checked:r.videoFilterTmdbValidation!==!1,onChange:t=>{a.light(),s("videoFilterTmdbValidation",t.target.checked)},className:"w-4 h-4 border-gray-300 dark:border-[#333333] accent-black dark:accent-white"}),e.jsx(i,{htmlFor:"video-filter-tmdb-validation",className:"text-xs text-gray-600 dark:text-[#9CA3AF] cursor-pointer",children:"Validate with TMDb API (country code: US/GB, language: en)"})]})]})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"TMDb Asset Fetching & Matching"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Reliable title matching and asset fetching from TMDb API"})]}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4",children:[e.jsx("h4",{className:"text-sm text-gray-900 dark:text-white mb-2",children:"Title Matching Pipeline"}),e.jsxs("div",{className:"space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"1."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Extract:"}),' Remove "Official Trailer", "Teaser", "2025", "HD" from YouTube title using regex']})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"2."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Search TMDb:"})," GET /search/movie or /search/tv with cleaned title + year"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"3."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Filter:"})," Keep only original_language=en, production_countries=US/GB, matching genres"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"4."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Rank:"})," Exact title match, then release year match, then GPT confirmation"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"5."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Fetch Assets:"})," GET /movie/","{id}","/images for backdrop, logo, poster"]})]})]})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-title-cleaning-regex",className:"text-[#9CA3AF]",children:"Title Cleaning Regex"}),e.jsx(n,{id:"video-title-cleaning-regex",value:r.videoTitleCleaningRegex||"(?:\\s*[–-]\\s*(?:Official|Teaser|Trailer|HD|4K|2024|2025|2026).*$)",onChange:t=>{a.light(),s("videoTitleCleaningRegex",t.target.value)},placeholder:"Regex pattern to remove trailer keywords",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 font-mono text-xs"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:'Regex to strip "Official Trailer", years, etc. from YouTube titles'})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-tmdb-fallback",className:"text-[#9CA3AF]",children:"TMDb Asset Fallback Behavior"}),e.jsxs(c,{value:r.videoTmdbFallback||"use-youtube-thumbnail",onValueChange:t=>{a.light(),s("videoTmdbFallback",t),l.success(`TMDb fallback changed to ${t}`)},children:[e.jsx(h,{id:"video-tmdb-fallback",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(x,{})}),e.jsxs(m,{children:[e.jsx(o,{value:"use-youtube-thumbnail",children:"Use YouTube Auto-Generated Thumbnail"}),e.jsx(o,{value:"skip-upload",children:"Skip Upload (Manual Intervention)"}),e.jsx(o,{value:"backdrop-only",children:"Use Backdrop Without Logo"}),e.jsx(o,{value:"poster-only",children:"Use Poster Only"})]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"What to do if TMDb returns no valid backdrop or logo"})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Platform-Specific Thumbnail System"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Automated thumbnail generation using TMDb assets (poster for social, backdrop+logo for YouTube/X)"})]}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4",children:[e.jsx("h4",{className:"text-sm text-gray-900 dark:text-white mb-2",children:"Thumbnail Strategy"}),e.jsxs("div",{className:"space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Portrait (Poster):"})," Instagram, Facebook, Threads, TikTok use TMDb poster directly"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Landscape (Backdrop + Logo):"})," YouTube (1280x720), X (1280x720) use backdrop with logo overlay"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24]",children:"•"}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Processing:"})," Sharp composites backdrop + logo centered at bottom third"]})]})]})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-youtube-x-thumbnail-prompt",className:"text-[#9CA3AF]",children:"YouTube & X Thumbnail (Backdrop + Logo)"}),e.jsx("textarea",{id:"video-youtube-x-thumbnail-prompt",value:r.videoYoutubeXThumbnailPrompt||`You are a thumbnail designer for Screen Render. Generate YouTube and X thumbnails using TMDb backdrop + logo.

INPUT: TMDb backdrop URL, TMDb logo URL (transparent PNG), movie/TV title
OUTPUT: Thumbnail composition instructions (JSON)

Technical Specs:
- Dimensions: 1280x720px (16:9 aspect ratio)
- File size: Under 2MB
- Format: JPG or PNG
- Platforms: YouTube, X (Twitter)

Processing (using Sharp):
1. Download TMDb backdrop image
2. Resize to 1280x720px (smart crop if needed)
3. Download TMDb logo (transparent PNG)
4. Composite logo centered horizontally at bottom third of backdrop
5. If no logo: use backdrop only (no text overlay)
6. Export as JPG/PNG under 2MB

Logo Placement:
- Position: Center-bottom (horizontally centered, bottom third vertically)
- Max width: 60% of backdrop width
- Max height: 25% of backdrop height
- Maintain aspect ratio
- Add subtle drop shadow for visibility

Output Format (JSON):
{
  "backdropUrl": "https://image.tmdb.org/t/p/original/...",
  "logoUrl": "https://image.tmdb.org/t/p/original/..." or null,
  "dimensions": { "width": 1280, "height": 720 },
  "logoPlacement": {
    "position": "center-bottom",
    "maxWidthPercent": 60,
    "maxHeightPercent": 25,
    "verticalOffset": "bottom-third"
  }
}

Tone: Clean, minimal, professional`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoYoutubeXThumbnailPrompt",t.target.value)},rows:24,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Sharp composites TMDb backdrop + logo (centered bottom) for YouTube and X"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-social-thumbnail-prompt",className:"text-[#9CA3AF]",children:"Instagram/Facebook/Threads/TikTok Thumbnail (Poster)"}),e.jsx("textarea",{id:"video-social-thumbnail-prompt",value:r.videoSocialThumbnailPrompt||`You are a thumbnail designer for Screen Render. Generate social media thumbnails using TMDb poster.

INPUT: TMDb poster URL, movie/TV title
OUTPUT: Thumbnail specifications (JSON)

Technical Specs:
- Source: TMDb poster (portrait 2:3 ratio)
- Platforms: Instagram, Facebook, Threads, TikTok
- File size: Under 2MB
- Format: JPG or PNG

Processing (using Sharp):
1. Download TMDb poster image
2. Use poster as-is (already optimized for portrait viewing)
3. Optional: Resize to 1080x1920 (9:16 for Reels/Stories)
4. Export as JPG/PNG under 2MB

Note: TMDb posters work perfectly for vertical platforms - no logo overlay needed

Output Format (JSON):
{
  "posterUrl": "https://image.tmdb.org/t/p/original/...",
  "targetDimensions": { "width": 1080, "height": 1920 },
  "platforms": ["instagram", "facebook", "threads", "tiktok"]
}

Tone: Clean poster presentation`,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoSocialThumbnailPrompt",t.target.value)},rows:20,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"TMDb poster used directly for Instagram, Facebook, Threads, TikTok"})]})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Complete Automation Pipeline"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"End-to-end workflow from detection to multi-platform upload"})]}),e.jsx("div",{className:"bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-4 space-y-3",children:e.jsxs("div",{className:"space-y-2 text-xs text-gray-600 dark:text-[#9CA3AF]",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"1."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Detect:"})," YouTube RSS polling finds new trailer"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"2."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Filter:"})," Google Search API + GPT-5 Nano validates US/UK English content"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"3."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Download:"})," yt-dlp downloads video (only if GPT returns YES)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"4."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Clean Title:"}),' Regex strips "Official Trailer", years, keywords']})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"5."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"TMDb Match:"})," Search TMDb with cleaned title, filter by language/country/genre"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"6."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Fetch Assets:"})," Get backdrop, logo, poster, cast, release_date from TMDb"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"7."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Google Context:"})," GPT-5 Nano queries Google Search for trending data"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"8."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Generate Content:"})," GPT-5 Nano creates title, description, tags, captions (Culture Crave style)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"9."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Thumbnails:"})," Sharp composites backdrop+logo (YouTube/X), uses poster (Instagram/Facebook/Threads/TikTok)"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"10."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Playlists:"})," GPT-5 Nano + Google Search determines YouTube playlists"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"11."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Upload:"})," Post to all enabled platforms with platform-specific thumbnails"]})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx("span",{className:"text-[#ec1e24] shrink-0 w-5",children:"12."}),e.jsxs("span",{children:[e.jsx("span",{className:"text-gray-900 dark:text-white",children:"Queue:"})," Respect post intervals to avoid spam limits"]})]})]})})]}),e.jsx("div",{className:"border-t border-gray-200 dark:border-[#333333]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Activity Retention"}),e.jsx("p",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF]",children:"Hide older YouTube detection items in the Video Activity page after a specified time period"})]}),e.jsxs("div",{children:[e.jsx(i,{htmlFor:"video-activity-retention",className:"text-[#6B7280] dark:text-[#9CA3AF]",children:"Activity Retention (hours)"}),e.jsx(n,{id:"video-activity-retention",type:"number",value:r.videoActivityRetention||24,onFocus:()=>a.light(),onChange:t=>{a.light(),s("videoActivityRetention",parseInt(t.target.value,10)||24)},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1",children:"Older YouTube detection items will be hidden in the Video Activity page after this time period (Default: 24 hours)"})]})]})]})]})}export{Q as VideoSettings};
