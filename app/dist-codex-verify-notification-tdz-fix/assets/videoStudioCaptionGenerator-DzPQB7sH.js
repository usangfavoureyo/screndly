import{a as s,b2 as n}from"./index-DWJke1Xb.js";const c={review:`You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for review-driven content about movies or TV shows.

INPUT: Voiceover transcript from a review video
OUTPUT: Review-focused caption (120-250 characters)

Guidelines:
- Use the title, cast (if mentioned), and review details from the voiceover
- Keep it short: 120-250 characters
- NO emojis
- Include a call to action to follow Screen Render for more (vary the phrasing)
- Use line breaks for readability when necessary
- Focus on the review perspective and insights
- Make it compelling and authentic`,releases:`You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for upcoming or newly released titles for the month.

INPUT: Voiceover transcript about monthly releases
OUTPUT: Release-focused caption (120-250 characters)

Guidelines:
- Based on the voiceover, capture the excitement of new releases
- Keep it short: 120-250 characters
- NO emojis
- Sometimes include a call to action to watch the video (vary the phrasing)
- Use line breaks for readability when necessary
- Match the tone of the release slate (blockbusters, awards season, holiday films, etc.)`,scenes:`You are a social media caption writer for Screen Render, a movie and TV trailer platform. Generate captions specifically for scene-based clips cut from movies or shows.

INPUT: Voiceover transcript from a specific scene
OUTPUT: Scene-focused caption (120-250 characters)

Guidelines:
- Use the title, cast (if applicable), and scene details pertaining to that scene
- Keep it short: 120-250 characters
- NO emojis
- Include a call to action to follow Screen Render for more (vary the phrasing)
- Use line breaks for readability when necessary
- Focus on what makes this particular scene compelling
- Capture the emotion, drama, or significance of the moment`},l={x:"X",threads:"Threads",facebook:"Facebook",instagram:"Instagram",youtube:"YouTube",tiktok:"TikTok",pinterest:"Pinterest"};function r(e,t){const a=Number(e);return Number.isFinite(a)&&a>0?a:t}function d(e){return[e.prompt,"Additional Constraints:",`- Preferred tone: ${e.tone}.`,`- Keep the caption under ${e.maxLength} characters.`,e.includeEmojis?"- Emojis are allowed only when they genuinely improve the caption.":"- Do not use emojis.",e.includeHashtags?"- Add concise relevant hashtags only if they fit naturally at the end.":"- Do not use hashtags."].join(`
`)}function o(e){if(e.movieTitle?.trim())return e.movieTitle.trim();switch(e.contentType){case"scenes":return"Scene Clip";case"releases":return"Monthly Releases";case"review":default:return"Review Video"}}function p(e){return[e.description,e.transcript?`Transcript context: ${e.transcript}`:void 0,e.startTime&&e.endTime?`Clip window: ${e.startTime}s to ${e.endTime}s`:void 0,e.duration?`Duration: ${e.duration}s`:void 0].filter(Boolean).join(". ")}function u(e){return[e.contentType,e.movieTitle,e.duration?`${e.duration}s clip`:void 0,...e.detectedObjects||[]].filter(t=>!!(t&&t.trim()))}function m(e){return e?.length&&e.map(a=>l[a.toLowerCase()]||a).find(Boolean)||"X"}function h(e){const t=o(e);switch(e.contentType){case"scenes":return`${t}

A standout scene worth watching.`;case"releases":return`${t}

A new slate of titles worth keeping an eye on.`;case"review":default:return`${t}

A fresh take from Video Studio.`}}function f(e){let t={};try{const i=localStorage.getItem("screndly_video_studio_settings");i&&(t=JSON.parse(i))}catch(i){console.error("Failed to load Video Studio settings:",i)}const a={review:"captionReviewPrompt",releases:"captionReleasesPrompt",scenes:"captionScenesPrompt"};return{model:t.captionOpenaiModel||n.videoStudio,prompt:t[a[e]]||c[e],temperature:r(t.captionTemperature,.7),maxTokens:r(t.captionMaxTokens,500),maxLength:r(t.captionMaxLength,280),tone:t.captionTone||"engaging",includeEmojis:t.captionIncludeEmojis!==!1,includeHashtags:t.captionIncludeHashtags!==!1}}async function v(e){const t=f(e.contentType);try{const a=await s.post("/api/ai/generate/studio-caption",{fileName:o(e),fileDescription:p(e),detectedObjects:u(e),platform:m(e.platforms),tone:t.tone,model:t.model,customSystemPrompt:d(t),customTemperature:t.temperature,customMaxTokens:t.maxTokens});if(!a.success||!a.data?.content)throw new Error(a.error?.message||"Failed to generate Video Studio caption");let i=a.data.content.trim();return i.length>t.maxLength&&(i=`${i.substring(0,t.maxLength-3).trimEnd()}...`),{caption:i,charCount:i.length,settings:t}}catch(a){console.error("Failed to generate Video Studio caption:",a);const i=h(e);return{caption:i,charCount:i.length,settings:t}}}export{v as g};
