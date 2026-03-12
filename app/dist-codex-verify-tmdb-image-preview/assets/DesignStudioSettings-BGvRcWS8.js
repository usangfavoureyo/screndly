import{r as f,ab as e,ap as c}from"./vendor-5iQPokUk.js";import{k as M,$ as C,U as D,h as a,L as r,aa as L,i as U,ab as B}from"./index-C_2wrC0o.js";import{I as m}from"./input-C0lF3xX2.js";import{S as h,a as g,b as p,c as u,d as n}from"./select-BV8SsH3M.js";import{S as w}from"./switch-7RMm2O8W.js";import{S as v}from"./separator-CHEMKlV0.js";import{P as O}from"./pinterest-board-select-CAOjIoxt.js";import{A as R}from"./AnalyticsSelfOptimization-B_-sz9m5.js";import"./vendor-ui-CHjGGgqY.js";import"./vendor-icons-ufHCceTv.js";import"./vendor-charts-DchDvYbt.js";import"./InstagramIcon-CKY9arHU.js";import"./TikTokIcon-BMpoZu8x.js";const S="screndly_culturecrave_design_studio_prompts_v1",N=new Set(["captionPosterPrompt","captionCarouselPrompt","captionStoryPrompt","captionAnnouncementPrompt","captionGeneralPrompt","designStudioPinterestTitlePrompt","designStudioPinterestDescriptionPrompt","designStudioPinterestBoardPrompt"]),x={captionOpenaiModel:D.designStudio,captionTemperature:.7,captionMaxTokens:500,captionPosterPrompt:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for movie/TV poster announcements and promotional graphics.

INPUT: Movie/TV title, tagline, release info, and any additional context
OUTPUT: Poster-focused caption (120-280 characters)

Guidelines:
- Create excitement around the visual/poster reveal
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Include relevant movie/show details (release date, cast, etc.)
- Use line breaks for readability when necessary
- Focus on visual appeal and announcement energy
- Match the tone to the content (blockbuster hype, indie charm, prestige drama, etc.)
- Examples of style:
  * "First look at [TITLE] starring [CAST]. Coming to theaters [DATE]."
  * "[TITLE] drops [DATE]. This is going to be incredible."
  * "New poster for [TITLE]. Everything you've heard is true."`,captionCarouselPrompt:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for multi-image carousel posts featuring cast photos, stills, or behind-the-scenes content.

INPUT: Movie/TV title, carousel theme, and context about the images
OUTPUT: Carousel-focused caption (120-280 characters)

Guidelines:
- Encourage users to swipe through the carousel
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use phrases like "Swipe to see", "Slide through", or variations
- Highlight what makes the carousel valuable (cast reveal, evolution, comparison, etc.)
- Use line breaks for readability when necessary
- Match the tone to the content type
- Examples of style:
  * "Swipe through for the full [TITLE] cast reveal. Thoughts?"
  * "The evolution of [CHARACTER] across all [NUMBER] films."
  * "Behind the scenes of [TITLE]. Slide to see the transformation."`,captionStoryPrompt:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for Instagram/Facebook Story-style vertical graphics (9:16).

INPUT: Movie/TV title, story theme, and quick announcement details
OUTPUT: Story-focused caption (80-200 characters)

Guidelines:
- Keep it VERY short and punchy: 80-200 characters
- NO emojis unless specifically requested
- Perfect for quick announcements, quotes, or teases
- Use conversational, immediate language
- Focus on urgency or FOMO when appropriate
- Use line breaks sparingly due to character limit
- Examples of style:
  * "[TITLE] is finally here"
  * "This scene from [TITLE] lives rent free in my head"
  * "Dropping tomorrow: [TITLE]"
  * "[TITLE] just broke the internet"`,captionAnnouncementPrompt:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for major announcements (cast reveals, release dates, awards, box office milestones).

INPUT: Announcement type and details (cast, date, award, milestone, etc.)
OUTPUT: Announcement-focused caption (120-280 characters)

Guidelines:
- Lead with the most important information
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use clear, direct language for maximum impact
- Include specific details (dates, names, numbers)
- Use line breaks to separate key information
- Match urgency to announcement importance
- Examples of style:
  * "BREAKING: [ACTOR] joins [TITLE] cast. Production starts [DATE]."
  * "[TITLE] crosses $500M worldwide. Now playing everywhere."
  * "Best Picture nominee [TITLE] expands to 2,000+ theaters this weekend."
  * "First trailer for [TITLE] drops tomorrow at 9am PT."`,captionGeneralPrompt:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions for general movie/TV content that doesn't fit other specific categories.

INPUT: Content description and context
OUTPUT: General caption (120-280 characters)

Guidelines:
- Adapt tone to the specific content
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Be authentic and engaging
- Use line breaks for readability when necessary
- Include relevant details without overcrowding
- Vary call-to-action phrasing
- Examples of style:
  * "Everything you need to know about [TITLE]."
  * "This moment from [TITLE] deserves its own appreciation post."
  * "Celebrating the legacy of [TITLE] on its [NUMBER]th anniversary."`,captionIncludeEmojis:!1,captionIncludeHashtags:!0,captionMaxLength:280,captionTone:"engaging",designStudioPinterestTitlePrompt:`You are a Pinterest SEO expert for Screen Render. Create optimized Pinterest pin titles for movie and TV show design graphics.

INPUT: Movie/TV title, design type (poster/carousel/story/announcement), content context
OUTPUT: Pinterest-optimized title (100 characters max)

Pinterest Title Requirements:
- Front-load the most important keywords
- Include: Title + Design Type/Context
- Optimize for Pinterest search discovery
- Use natural language, not hashtags
- Keep under 100 characters

Examples:
- "The Batman (2025) - Official Movie Poster | DC Comics"
- "Stranger Things Cast Photos - Netflix Series Carousel"
- "Wednesday Season 2 Announcement | 2025 Netflix Series"
- "Dune: Part Three Character Posters | 2026 Sci-Fi Epic"

Guidelines:
- Identify the design type and purpose
- Include year for searchability when relevant
- Use " | " separator for clarity
- Prioritize search terms users would type
- Focus on visual content being shared

Tone: Clear, searchable, design-focused, optimized for Pinterest discovery`,designStudioPinterestDescriptionPrompt:`You are a Pinterest content strategist for Screen Render. Create optimized Pinterest pin descriptions for movie and TV show design graphics.

INPUT: Movie/TV title, design type, content details, context
OUTPUT: Pinterest-optimized description (500 characters max)

Pinterest Description Requirements:
- First 50-60 characters are critical (preview text)
- Front-load key information: Title, design type, hook
- Include relevant keywords naturally throughout
- Use 3-5 hashtags at the end (trending + branded)
- Optimize for search and discovery
- Include a call-to-action
- Keep under 500 characters total

Structure:
1. Opening hook (50-60 chars) - Most important
2. Design description (2-3 sentences)
3. Key details (cast, release date, etc.)
4. Hashtags (3-5 relevant tags)
5. CTA (Save for later, Get inspiration, etc.)

Example:
"Official poster for The Batman (2025)! 🦇 Matt Reeves' epic sequel features this stunning new poster design showcasing Robert Pattinson as the Dark Knight. The darker, grittier aesthetic perfectly captures Gotham's atmosphere. Coming to theaters Summer 2025. #TheBatman #MoviePoster #DCComics #FilmDesign #GraphicDesign

Save this for your watchlist! 🎬"

Guidelines:
- Describe the visual/design prominently
- Natural keyword integration (no keyword stuffing)
- Use emojis strategically (1-2 max)
- Include searchable hashtags (design + content)
- Make first sentence compelling and complete
- Appeal to design enthusiasts and fans

Tone: Inspiring, design-focused, visually-oriented, optimized for Pinterest users seeking creative inspiration`,designStudioPinterestBoardPrompt:`You are a Pinterest board strategist for Screen Render. Suggest the most appropriate Pinterest board name for movie and TV show design graphics.

INPUT: Movie/TV title, design type (poster/carousel/story/announcement), genre, context
OUTPUT: Pinterest board name (maximum 50 characters)

Board Selection Guidelines:
- Match content type to board purpose
- Consider existing Screen Render boards
- Optimize for discoverability
- Keep names clear and searchable

Suggested Boards by Design Type:
- Movie Posters → "Movie Posters & Film Design"
- TV Show Posters → "TV Show Posters & Series Design"
- Cast Carousels → "Cast Photos & Character Design"
- Announcements → "Movie & TV News"
- Story Graphics → "Entertainment News & Updates"
- Character Posters → "Character Posters & Concepts"
- General Design → "Film & TV Graphic Design"

Output Format:
Return only the board name, nothing else. Maximum 50 characters.

Examples:
- "Movie Posters & Film Design"
- "TV Show Posters & Series Design"
- "Cast Photos & Character Design"
- "Entertainment News & Updates"

Tone: Clear, category-focused, SEO-friendly`,autoPreviewEnabled:!0,renderQuality:"high",exportFormat:"jpeg",jpegQuality:90,...C};function Z({onSave:T,onBack:A}){const{settings:b,updateSetting:j}=M(),[s,y]=f.useState(x),[P,F]=f.useState(!1),k=f.useRef(null);k.current===null&&(k.current=Object.fromEntries(Object.entries(b).filter(([t])=>N.has(t)))),f.useEffect(()=>{const t=k.current||{},o=localStorage.getItem("screndly_design_studio_settings"),d=!localStorage.getItem(S);if(o)try{const l=JSON.parse(o),I=d?{...x,...t,...l,...C}:{...x,...t,...l};y(I)}catch(l){console.error("Error loading Design Studio settings:",l),y({...x,...t})}else y({...x,...t});d&&localStorage.setItem(S,"true"),F(!0)},[]),f.useEffect(()=>{P&&localStorage.setItem("screndly_design_studio_settings",JSON.stringify(s))},[s,P]);const i=(t,o)=>{if(y(d=>{const l={...d,[t]:o};return localStorage.setItem("screndly_design_studio_settings",JSON.stringify(l)),l}),N.has(t)&&j(t,o),t==="captionOpenaiModel"&&c.success(`Caption AI Model changed to ${B(o)}`),t==="captionTone"){const d={engaging:"Engaging",hype:"Hype & Excitement",professional:"Professional",casual:"Casual & Friendly"};c.success(`Caption Tone: ${d[o]||o}`)}if(t==="renderQuality"){const d={low:"Low (Faster)",medium:"Medium",high:"High (Recommended)",maximum:"Maximum (Slower)"};c.success(`Render Quality: ${d[o]||o}`)}T&&setTimeout(T,100)},E=()=>{y(x),c.success("Reset to recommended settings")};return e.jsxs("div",{className:"fixed top-0 right-0 bottom-0 w-full lg:w-[600px] bg-white dark:bg-[#000000] z-50 overflow-y-auto",children:[e.jsxs("div",{className:"sticky top-0 bg-white dark:bg-[#000000] border-b border-gray-200 dark:border-[#333333] p-4 flex items-center gap-3 z-10",children:[e.jsx("button",{className:"text-gray-900 dark:text-white p-1",onClick:()=>{a.light(),A()},children:e.jsx("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1",strokeLinecap:"round",strokeLinejoin:"round",children:e.jsx("path",{d:"M22 12H2M9 19l-7-7 7-7"})})}),e.jsx("h2",{className:"text-gray-900 dark:text-white text-xl",children:"Design Studio"})]}),e.jsxs("div",{className:"p-6 space-y-6",children:[e.jsx(R,{storageKey:"design_studio_settings",description:"Enable AI-powered optimization to automatically improve captions and model selection for design content based on performance analytics."}),e.jsx(v,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsx("h3",{className:"text-gray-900 dark:text-white",children:"Caption Generation"}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"caption-model",className:"text-[#9CA3AF]",children:"Caption AI Model"}),e.jsxs(h,{value:s.captionOpenaiModel,onValueChange:t=>{a.light(),i("captionOpenaiModel",t)},children:[e.jsx(g,{id:"caption-model",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(p,{})}),e.jsx(u,{children:L.map(t=>e.jsx(n,{value:t.id,children:t.displayName},t.id))})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Model used to generate social media captions for static designs"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"caption-temperature",className:"text-[#9CA3AF]",children:"Caption Temperature"}),e.jsxs("div",{className:"flex gap-3 items-center mt-1",children:[e.jsx(m,{id:"caption-temperature",type:"number",min:"0",max:"2",step:"0.1",value:s.captionTemperature,onFocus:()=>a.light(),onChange:t=>{a.light(),i("captionTemperature",parseFloat(t.target.value))},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"}),e.jsx("span",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap min-w-[100px]",children:s.captionTemperature<.5?"Focused":s.captionTemperature<1?"Balanced":"Creative"})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Recommended: 0.7 — Balanced creativity for engaging captions"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"caption-max-tokens",className:"text-[#9CA3AF]",children:"Caption Max Tokens"}),e.jsx(m,{id:"caption-max-tokens",type:"number",min:"100",max:"1000",step:"50",value:s.captionMaxTokens,onFocus:()=>a.light(),onChange:t=>{a.light(),i("captionMaxTokens",parseInt(t.target.value))},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Maximum tokens for caption generation (Recommended: 500)"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"caption-tone",className:"text-[#9CA3AF]",children:"Caption Tone"}),e.jsxs(h,{value:s.captionTone,onValueChange:t=>{a.light(),i("captionTone",t)},children:[e.jsx(g,{id:"caption-tone",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(p,{})}),e.jsxs(u,{children:[e.jsx(n,{value:"engaging",children:"Engaging"}),e.jsx(n,{value:"hype",children:"Hype & Excitement"}),e.jsx(n,{value:"professional",children:"Professional"}),e.jsx(n,{value:"casual",children:"Casual & Friendly"})]})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Overall tone and style for generated captions"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"caption-max-length",className:"text-[#9CA3AF]",children:"Caption Max Length"}),e.jsx(m,{id:"caption-max-length",type:"number",min:"100",max:"500",step:"10",value:s.captionMaxLength,onFocus:()=>a.light(),onChange:t=>{a.light(),i("captionMaxLength",parseInt(t.target.value))},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Maximum character length for generated captions (Recommended: 250-280)"})]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(r,{htmlFor:"caption-emojis",className:"text-[#9CA3AF]",children:"Include Emojis"}),e.jsx(w,{id:"caption-emojis",checked:s.captionIncludeEmojis,onCheckedChange:t=>{a.light(),i("captionIncludeEmojis",t)}})]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(r,{htmlFor:"caption-hashtags",className:"text-[#9CA3AF]",children:"Include Hashtags"}),e.jsx(w,{id:"caption-hashtags",checked:s.captionIncludeHashtags,onCheckedChange:t=>{a.light(),i("captionIncludeHashtags",t)}})]})]}),e.jsx(v,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white",children:"Content-Specific Caption Prompts"}),e.jsx("p",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF]",children:"Customize caption generation prompts for different design types"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"caption-general-prompt",className:"text-[#9CA3AF]",children:"General Caption Prompt"}),e.jsx(U,{id:"caption-general-prompt",value:s.captionGeneralPrompt,onFocus:()=>a.light(),onChange:t=>{a.light(),i("captionGeneralPrompt",t.target.value)},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1 min-h-[200px] font-mono text-xs",placeholder:"Enter caption prompt for general content..."}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Prompt used for generating captions for general movie/TV content"})]})]}),e.jsx(v,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1",children:"Pinterest Publishing Settings"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Pinterest requires structured content: Title + Description + Link + Board. Configure AI generation for design graphics."})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-pinterest-title-prompt",className:"text-[#9CA3AF]",children:"Pinterest Title Generation Prompt"}),e.jsx("textarea",{id:"design-studio-pinterest-title-prompt",value:s.designStudioPinterestTitlePrompt,onFocus:()=>a.light(),onChange:t=>{a.light(),i("designStudioPinterestTitlePrompt",t.target.value)},rows:18,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Search-optimized titles under 100 characters with design-focused keywords"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-pinterest-description-prompt",className:"text-[#9CA3AF]",children:"Pinterest Description Generation Prompt"}),e.jsx("textarea",{id:"design-studio-pinterest-description-prompt",value:s.designStudioPinterestDescriptionPrompt,onFocus:()=>a.light(),onChange:t=>{a.light(),i("designStudioPinterestDescriptionPrompt",t.target.value)},rows:24,className:"w-full bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg p-3 text-sm text-gray-900 dark:text-white font-mono mt-1 resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"SEO-optimized descriptions with visual-focused hooks and design hashtags"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-default-pinterest-board",className:"text-[#9CA3AF]",children:"Default Pinterest Board"}),e.jsx(O,{id:"design-studio-default-pinterest-board",value:s.designStudioDefaultPinterestBoard||"Movie Posters",onChange:t=>{i("designStudioDefaultPinterestBoard",t),c.success("Default Pinterest board updated")},placeholder:"Movie Posters",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Board where design graphics will be published"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-pinterest-link-strategy",className:"text-[#9CA3AF]",children:"Link Strategy"}),e.jsxs(h,{value:s.designStudioPinterestLinkStrategy||"tmdb",onValueChange:t=>{a.light(),i("designStudioPinterestLinkStrategy",t),c.success("Pinterest link strategy updated")},children:[e.jsx(g,{id:"design-studio-pinterest-link-strategy",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(p,{})}),e.jsxs(u,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333]",children:[e.jsx(n,{value:"tmdb",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"TMDb Movie/Show Page"}),e.jsx(n,{value:"screenrender",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"Screen Render Movie Page"}),e.jsx(n,{value:"custom",className:"text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1a1a1a]",children:"Custom URL (set per post)"})]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Default link destination for Pinterest pins (auto-generated based on movie/show data)"})]}),s.designStudioPinterestLinkStrategy==="custom"&&e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-pinterest-default-link",className:"text-[#9CA3AF]",children:"Default Custom Link"}),e.jsx(m,{id:"design-studio-pinterest-default-link",value:s.designStudioPinterestDefaultLink||"",onFocus:()=>a.light(),onChange:t=>{a.light(),i("designStudioPinterestDefaultLink",t.target.value)},placeholder:"https://screenrender.com",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:"Fallback URL when custom link is not specified per post"})]})]}),e.jsx(v,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white",children:"Photopea Integration"}),e.jsx("p",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF]",children:"Configure Photopea rendering engine settings"})]}),e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx(r,{htmlFor:"auto-preview",className:"text-[#9CA3AF]",children:"Auto-Preview Enabled"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1",children:"Automatically generate live previews while editing"})]}),e.jsx(w,{id:"auto-preview",checked:s.autoPreviewEnabled,onCheckedChange:t=>{a.light(),i("autoPreviewEnabled",t)}})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"render-quality",className:"text-[#9CA3AF]",children:"Render Quality"}),e.jsxs(h,{value:s.renderQuality,onValueChange:t=>{a.light(),i("renderQuality",t)},children:[e.jsx(g,{id:"render-quality",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(p,{})}),e.jsxs(u,{children:[e.jsx(n,{value:"low",children:"Low (Faster)"}),e.jsx(n,{value:"medium",children:"Medium"}),e.jsx(n,{value:"high",children:"High (Recommended)"}),e.jsx(n,{value:"maximum",children:"Maximum (Slower)"})]})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Higher quality = slower rendering but better output"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"export-format",className:"text-[#9CA3AF]",children:"Export Format"}),e.jsxs(h,{value:s.exportFormat,onValueChange:t=>{a.light(),i("exportFormat",t)},children:[e.jsx(g,{id:"export-format",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(p,{})}),e.jsxs(u,{children:[e.jsx(n,{value:"jpeg",children:"JPEG (Smaller, Recommended)"}),e.jsx(n,{value:"png",children:"PNG (Larger, Transparent)"})]})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"JPEG is recommended for social media uploads"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"jpeg-quality",className:"text-[#9CA3AF]",children:"JPEG Quality"}),e.jsxs("div",{className:"flex gap-3 items-center mt-1",children:[e.jsx(m,{id:"jpeg-quality",type:"number",min:"1",max:"100",step:"5",value:s.jpegQuality,onFocus:()=>a.light(),onChange:t=>{a.light(),i("jpegQuality",parseInt(t.target.value))},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white"}),e.jsx("span",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap min-w-[100px]",children:s.jpegQuality>=90?"Excellent":s.jpegQuality>=75?"Good":"Compressed"})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-2",children:"Recommended: 90 — Balance between quality and file size"})]})]}),e.jsx(v,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("h3",{className:"text-gray-900 dark:text-white",children:"Activity Retention"}),e.jsx("p",{className:"text-sm text-[#6B7280] dark:text-[#9CA3AF]",children:"Hide older design activity items in the page and remove them during backend cleanup after a specified time period"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-activity-retention",className:"text-[#6B7280] dark:text-[#9CA3AF]",children:"Activity Retention (hours)"}),e.jsx(m,{id:"design-studio-activity-retention",type:"number",value:b.designStudioActivityRetention||24,onFocus:()=>a.light(),onChange:t=>{a.light(),j("designStudioActivityRetention",parseInt(t.target.value,10)||24)},className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1",children:"Older design activity items are hidden in the Design Studio activity page immediately and removed during backend cleanup after this time period (Default: 24 hours)"})]}),e.jsxs("div",{children:[e.jsx(r,{htmlFor:"design-studio-log-level",className:"text-[#6B7280] dark:text-[#9CA3AF]",children:"Log Level"}),e.jsxs(h,{value:b.designStudioLogLevel||"standard",onValueChange:t=>{a.light(),j("designStudioLogLevel",t)},children:[e.jsx(g,{id:"design-studio-log-level",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1",children:e.jsx(p,{})}),e.jsxs(u,{children:[e.jsx(n,{value:"minimal",children:"Minimal (Published designs only)"}),e.jsx(n,{value:"standard",children:"Standard (Rendered + Published)"}),e.jsx(n,{value:"full",children:"Full (All activity)"})]})]}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1",children:"Controls how much design activity is shown in the Design Studio activity page."})]})]}),e.jsx("div",{className:"pt-4",children:e.jsx("button",{onClick:()=>{a.medium(),E()},className:"w-full px-4 py-2 bg-white dark:bg-[#000000] border border-gray-300 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1A1A1A] active:bg-white dark:active:bg-[#000000] transition-colors",children:"Reset to Recommended Settings"})})]})]})}export{Z as DesignStudioSettings};
