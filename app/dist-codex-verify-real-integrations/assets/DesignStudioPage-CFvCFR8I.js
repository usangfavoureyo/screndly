import{c as Be,a as ae,aS as et,r as o,j as e,b as ue,d as he,e as me,g as ge,L as F,I as K,h as s,q as Ce,ar as Ee,B as $,a0 as de,t as k,D as tt,E as at,G as rt,H as st,J as ee,aq as it,i as xe,aT as $e,aU as Re,aI as Me,aV as ze,aW as Ue,aX as ot,ax as nt,a9 as Te,f as Ve,R as lt,n as He,a5 as Le,X as ct,m as dt,F as ut,Y as ht,k as mt,P as gt,aw as xt,p as pt,T as De,aY as yt,aZ as bt,u as ft,s as vt}from"./index-uw5K4AUM.js";import{b as ne,a as wt,T as kt,f as jt,C as Ge,F as Nt,d as Fe,e as Pe}from"./ColorPickerPopup-BdczsgFi.js";/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const St=[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",key:"ep3f8r"}],["path",{d:"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",key:"1p4c4q"}],["path",{d:"M17.599 6.5a3 3 0 0 0 .399-1.375",key:"tmeiqw"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M19.938 10.5a4 4 0 0 1 .585.396",key:"1qfode"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M19.967 17.484A4 4 0 0 1 18 18",key:"159ez6"}]],Ct=Be("brain",St);/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Tt=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["circle",{cx:"10",cy:"12",r:"2",key:"737tya"}],["path",{d:"m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22",key:"wt3hpn"}]],qe=Be("file-image",Tt);function Lt(t){let a={};try{const r=localStorage.getItem("screndly_design_studio_settings");r&&(a=JSON.parse(r))}catch(r){console.error("Failed to load Design Studio settings:",r)}const l={poster:"captionPosterPrompt",carousel:"captionCarouselPrompt",story:"captionStoryPrompt",announcement:"captionAnnouncementPrompt",general:"captionGeneralPrompt"}[t];return{model:a.captionOpenaiModel||et.designStudio,prompt:a[l]||Dt(t),temperature:a.captionTemperature||.7,maxTokens:a.captionMaxTokens||500,maxLength:a.captionMaxLength||280,tone:a.captionTone||"engaging",includeEmojis:a.captionIncludeEmojis!==!1,includeHashtags:a.captionIncludeHashtags!==!1}}function Dt(t){return{poster:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for movie/TV poster announcements and promotional graphics.

INPUT: Movie/TV title, tagline, release info, and any additional context
OUTPUT: Poster-focused caption (120-280 characters)

Guidelines:
- Create excitement around the visual/poster reveal
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Include relevant movie/show details (release date, cast, etc.)
- Use line breaks for readability when necessary
- Focus on visual appeal and announcement energy`,carousel:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for multi-image carousel posts featuring cast photos, stills, or behind-the-scenes content.

INPUT: Movie/TV title, carousel theme, and context about the images
OUTPUT: Carousel-focused caption (120-280 characters)

Guidelines:
- Encourage users to swipe through the carousel
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use phrases like "Swipe to see", "Slide through", or variations
- Highlight what makes the carousel valuable`,story:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for Instagram/Facebook Story-style vertical graphics (9:16).

INPUT: Movie/TV title, story theme, and quick announcement details
OUTPUT: Story-focused caption (80-200 characters)

Guidelines:
- Keep it VERY short and punchy: 80-200 characters
- NO emojis unless specifically requested
- Perfect for quick announcements, quotes, or teases
- Use conversational, immediate language`,announcement:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions specifically for major announcements (cast reveals, release dates, awards, box office milestones).

INPUT: Announcement type and details (cast, date, award, milestone, etc.)
OUTPUT: Announcement-focused caption (120-280 characters)

Guidelines:
- Lead with the most important information
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Use clear, direct language for maximum impact
- Include specific details (dates, names, numbers)`,general:`You are a social media caption writer for Screndly, a movie and TV content platform. Generate captions for general movie/TV content that doesn't fit other specific categories.

INPUT: Content description and context
OUTPUT: General caption (120-280 characters)

Guidelines:
- Adapt tone to match the content
- Keep it short: 120-280 characters
- NO emojis unless specifically requested
- Focus on what makes the content interesting
- Clear, engaging language`}[t]}async function Ft(t){const a=Lt(t.contentType),i=[t.tagline,t.releaseInfo,t.castInfo,t.context].filter(Boolean),l=await ae.post("/api/ai/generate/studio-caption",{fileName:t.title||`${t.contentType} design`,fileDescription:i.join(" | ")||"No extra context provided",tone:a.tone,model:a.model,customSystemPrompt:a.prompt,customTemperature:a.temperature,customMaxTokens:a.maxTokens});if(!l.success||!l.data?.content)throw console.error("Failed to generate Design Studio caption:",l.error),new Error(l.error?.message||"Failed to generate caption");let r=l.data.content.trim();return r.length>a.maxLength&&(r=`${r.substring(0,a.maxLength-3)}...`),{caption:r,charCount:r.length,settings:a}}function Pt({open:t,onOpenChange:a,templateName:i,aspectRatio:l,initialData:r,hasSubtext:p=!1,hasOverlay:y=!1,onSave:b,onChange:d,isRendering:w=!1}){const[f,g]=o.useState(r?.headerText||""),[n,S]=o.useState(r?.subtext||""),[v,P]=o.useState(r?.headerTextColor||"#000000"),[C,M]=o.useState(r?.subtextColor||"#000000"),[O,c]=o.useState(r?.backgroundImage||""),[T,E]=o.useState(r?.imageFocalPoint||{x:50,y:50}),[R,z]=o.useState(r?.imageZoom||1),[A,W]=o.useState(""),[I,q]=o.useState([]),[ie,re]=o.useState(!1),[pe,se]=o.useState(null),[H,J]=o.useState(!1),[ye,be]=o.useState(!1),[Z,oe]=o.useState(r?.overlayEnabled||!1),[U,_]=o.useState(r?.overlayColor||"#000000"),[G,u]=o.useState(r?.overlayOpacity||70),[m,x]=o.useState(r?.gradientPosition||"top"),[j,D]=o.useState(!1),[B,N]=o.useState(!1),[L,Y]=o.useState(!1),[X,Xe]=o.useState("general"),[Q,fe]=o.useState(""),[ve,we]=o.useState(!1);o.useEffect(()=>{r&&(g(r.headerText||""),S(r.subtext||""),P(r.headerTextColor||"#000000"),M(r.subtextColor||"#000000"),c(r.backgroundImage||""),E(r.imageFocalPoint||{x:50,y:50}),z(r.imageZoom||1),oe(r.overlayEnabled||!1),_(r.overlayColor||"#000000"),u(r.overlayOpacity||70),x(r.gradientPosition||"top"))},[r]),o.useEffect(()=>{d&&t&&d({headerText:f,subtext:p?n:void 0,headerTextColor:v,subtextColor:C,backgroundImage:O,imageFocalPoint:T,imageZoom:R,overlayEnabled:Z,overlayColor:U,overlayOpacity:G,gradientPosition:m})},[f,n,v,C,O,T.x,T.y,R,Z,U,G,t,p,m]);const Qe=h=>{s.light();const V=h.target.files?.[0];if(V){const Se=new FileReader;Se.onload=Je=>{const Ze=Je.target?.result;c(Ze),k.success("Image uploaded")},Se.readAsDataURL(V)}},ke=async()=>{A.trim()&&(s.medium(),re(!0),setTimeout(()=>{const h=[{id:1,title:A,backdrop:"https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800",poster:"https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400"},{id:2,title:`${A} 2`,backdrop:"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",poster:"https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400"}];q(h),re(!1)},1e3))},je=h=>{s.light(),c(h),se(h),q([]),W(""),k.success("Image selected from TMDb")},Ke=()=>{if(!f.trim()){k.error("Header text is required");return}s.medium(),b({headerText:f,subtext:p?n:void 0,headerTextColor:v,subtextColor:C,backgroundImage:O,imageFocalPoint:T,imageZoom:R,overlayEnabled:Z,overlayColor:U,overlayOpacity:G,gradientPosition:m,caption:Q||void 0,contentType:X})},We=()=>{s.light(),a(!1)},Ne=()=>{switch(l){case"1:1":return"aspect-square";case"16:9":return"aspect-video";case"9:16":return"aspect-[9/16]";case"4:5":return"aspect-[4/5]";case"5:4":return"aspect-[5/4]";default:return"aspect-square"}};return e.jsxs(e.Fragment,{children:[e.jsxs(ue,{open:t,onOpenChange:a,children:[e.jsxs(he,{children:[e.jsx(me,{className:"text-gray-900 dark:text-white",children:"Edit Design"}),e.jsx("p",{className:"text-xs text-[#6B7280] mt-1",children:"Customize text, colors, and images for your design"})]}),e.jsx(ge,{children:e.jsxs("div",{className:"space-y-4","data-scrollable":!0,children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsxs(F,{className:"text-gray-900 dark:text-white",children:["Header Text ",e.jsx("span",{className:"text-[#ec1e24]",children:"*"})]}),e.jsxs("span",{className:`text-xs ${f.length>90?"text-[#ec1e24] font-medium":f.length>70?"text-yellow-600 dark:text-yellow-500":"text-gray-500 dark:text-[#6B7280]"}`,children:[f.length,"/90"]})]}),e.jsx(K,{value:f,onChange:h=>{s.light();const V=h.target.value;V.length<=120&&g(V)},placeholder:"Enter header text...",className:"bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"}),f.length>90&&e.jsx("p",{className:"text-xs text-[#ec1e24] mt-1",children:"⚠️ Exceeds recommended limit (may use smaller font)"}),f.length>60&&f.length<=90&&e.jsx("p",{className:"text-xs text-yellow-600 dark:text-yellow-500 mt-1",children:"💡 Medium font size will be used"}),e.jsxs("div",{className:"mt-3",children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Header Text Color"}),e.jsx("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:v.toUpperCase()})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>{s.light(),N(!0)},className:"w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform",style:{backgroundColor:v},title:v}),e.jsx("input",{type:"text",value:v,onChange:h=>{s.light(),P(h.target.value)},onFocus:()=>s.light(),className:"flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]",placeholder:"#000000"})]})]})]}),p&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Subtext"}),e.jsxs("span",{className:`text-xs ${n.length>120?"text-[#ec1e24] font-medium":n.length>90?"text-yellow-600 dark:text-yellow-500":"text-gray-500 dark:text-[#6B7280]"}`,children:[n.length,"/120"]})]}),e.jsx(Ce,{value:n,onChange:h=>{s.light();const V=h.target.value;V.length<=150&&S(V)},placeholder:"Enter subtext (optional)...",rows:3,className:"bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] resize-none"}),n.length>120&&e.jsx("p",{className:"text-xs text-[#ec1e24] mt-1",children:"⚠️ Exceeds recommended limit (may use smaller font)"}),n.length>90&&n.length<=120&&e.jsx("p",{className:"text-xs text-yellow-600 dark:text-yellow-500 mt-1",children:"💡 Medium font size will be used"}),e.jsxs("div",{className:"mt-3",children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Subtext Color"}),e.jsx("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:C.toUpperCase()})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>{s.light(),Y(!0)},className:"w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform",style:{backgroundColor:C},title:C}),e.jsx("input",{type:"text",value:C,onChange:h=>{s.light(),M(h.target.value)},onFocus:()=>s.light(),className:"flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]",placeholder:"#000000"})]})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-gray-900 dark:text-white mb-2 block",children:"Background Image"}),e.jsx("div",{className:"mb-3",children:e.jsxs("label",{className:"block",children:[e.jsx("input",{type:"file",accept:"image/*",onChange:Qe,className:"hidden"}),e.jsxs("div",{className:"border border-gray-200 dark:border-[#333333] rounded-lg p-4 text-center cursor-pointer hover:border-[#ec1e24] transition-colors",children:[e.jsx(Ee,{className:"w-6 h-6 text-gray-400 dark:text-[#666666] mx-auto mb-2"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Upload from device"})]})]})}),e.jsxs("div",{className:"mb-3",children:[e.jsxs("div",{className:"flex gap-2",children:[e.jsx(K,{value:A,onChange:h=>{s.light(),W(h.target.value)},onKeyDown:h=>{h.key==="Enter"&&ke()},placeholder:"Search TMDb for movie/TV...",className:"flex-1 bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"}),e.jsx($,{onClick:ke,disabled:ie||!A.trim(),className:"bg-[#ec1e24] hover:bg-[#d01a20] text-white",children:"Search"})]}),I.length>0&&e.jsx("div",{className:"mt-3 space-y-2 max-h-48 overflow-y-auto",children:I.map(h=>e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"text-sm text-gray-900 dark:text-white",children:h.title}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsxs("button",{onClick:()=>je(h.backdrop),className:"relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors",children:[e.jsx("img",{src:h.backdrop,alt:"Backdrop",className:"w-full h-full object-cover"}),e.jsx("div",{className:"absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded",children:"Backdrop"})]}),e.jsxs("button",{onClick:()=>je(h.poster),className:"relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors",children:[e.jsx("img",{src:h.poster,alt:"Poster",className:"w-full h-full object-cover"}),e.jsx("div",{className:"absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded",children:"Poster"})]})]})]},h.id))})]}),O&&e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]",children:[e.jsx("button",{onClick:()=>{s.light(),J(!0)},className:"w-full",children:e.jsx("img",{src:O,alt:"Selected background",className:"w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"})}),e.jsx("button",{onClick:()=>{s.light(),c(""),se(null),E({x:50,y:50}),z(1)},className:"absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black transition-colors",children:e.jsx(de,{className:"w-4 h-4 text-white"})})]}),e.jsxs("div",{className:"bg-white dark:bg-black rounded-lg p-4 space-y-3",children:[e.jsx("p",{className:"text-sm text-gray-900 dark:text-white",children:"Adjust Composition"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Reposition the image to ensure your subject is properly framed"}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Horizontal Position"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[T.x,"%"]})]}),e.jsx("input",{type:"range",min:"0",max:"100",value:T.x,onChange:h=>{s.light(),E({...T,x:Number(h.target.value)})},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"Left"}),e.jsx("span",{children:"Center"}),e.jsx("span",{children:"Right"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Vertical Position"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[T.y,"%"]})]}),e.jsx("input",{type:"range",min:"0",max:"100",value:T.y,onChange:h=>{s.light(),E({...T,y:Number(h.target.value)})},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"Top"}),e.jsx("span",{children:"Center"}),e.jsx("span",{children:"Bottom"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Zoom"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[Math.round(R*100),"%"]})]}),e.jsx("input",{type:"range",min:"0.5",max:"2",step:"0.1",value:R,onChange:h=>{s.light(),z(Number(h.target.value))},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"50%"}),e.jsx("span",{children:"100%"}),e.jsx("span",{children:"200%"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Composition Preview"}),e.jsxs("div",{className:`relative ${Ne()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`,children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:`url(${O})`,backgroundSize:`${R*100}%`,backgroundPosition:`${T.x}% ${T.y}%`,backgroundRepeat:"no-repeat"}}),e.jsx("div",{className:"absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded",children:"Live Preview"})]})]}),e.jsx($,{onClick:()=>{s.light(),E({x:50,y:50}),z(1),k.success("Composition reset to defaults")},variant:"outline",size:"sm",className:"w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs",children:"Reset to Center"})]})]})]}),y&&e.jsxs("div",{children:[e.jsx(F,{className:"text-gray-900 dark:text-white mb-2 block",children:"Text Overlay Settings"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Adjust the gradient overlay to ensure your text is readable"}),e.jsxs("div",{className:"bg-white dark:bg-black rounded-lg p-4 space-y-3",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Overlay Color"}),e.jsx("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:U.toUpperCase()})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>{s.light(),D(!0)},className:"w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform",style:{backgroundColor:U},title:U}),e.jsx("input",{type:"text",value:U,onChange:h=>{s.light(),_(h.target.value)},onFocus:()=>s.light(),className:"flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]",placeholder:"#000000"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Overlay Strength"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[G,"%"]})]}),e.jsx("input",{type:"range",min:"0",max:"100",value:G,onChange:h=>{s.light(),u(Number(h.target.value))},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"Transparent"}),e.jsx("span",{children:"Subtle"}),e.jsx("span",{children:"Strong"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Gradient Position"}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx($,{onClick:()=>{s.light(),x("top")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${m==="top"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Top"}),e.jsx($,{onClick:()=>{s.light(),x("bottom")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${m==="bottom"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Bottom"}),e.jsx($,{onClick:()=>{s.light(),x("left")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${m==="left"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Left"}),e.jsx($,{onClick:()=>{s.light(),x("right")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${m==="right"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Right"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Overlay Preview"}),e.jsxs("div",{className:`relative ${Ne()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`,children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:O?`url(${O})`:"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",backgroundSize:O?`${R*100}%`:"cover",backgroundPosition:O?`${T.x}% ${T.y}%`:"center",backgroundRepeat:"no-repeat"}}),e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:`linear-gradient(${{top:"to bottom",bottom:"to top",left:"to right",right:"to left"}[m]||"to bottom"}, ${U}${Math.round(G*2.55).toString(16).padStart(2,"0")} 0%, transparent 100%)`}}),e.jsx("div",{className:"absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded",children:"Live Preview"})]})]}),e.jsx($,{onClick:()=>{s.light(),_("#000000"),u(70),x("top"),k.success("Overlay reset to defaults")},variant:"outline",size:"sm",className:"w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#000000] text-xs",children:"Reset Overlay"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-gray-900 dark:text-white mb-2 block",children:"Social Media Caption"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Generate AI-powered captions for your design"}),e.jsxs("div",{className:"bg-white dark:bg-black rounded-lg p-4 space-y-3",children:[e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Content Type"}),e.jsxs(tt,{value:X,onValueChange:h=>{s.light(),Xe(h)},children:[e.jsx(at,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white",children:e.jsx(rt,{})}),e.jsxs(st,{children:[e.jsx(ee,{value:"poster",children:"Poster/Announcement"}),e.jsx(ee,{value:"carousel",children:"Carousel Post"}),e.jsx(ee,{value:"story",children:"Story (Vertical)"}),e.jsx(ee,{value:"announcement",children:"Breaking News"}),e.jsx(ee,{value:"general",children:"General Content"})]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-2",children:"Select the type of content to customize caption style"})]}),e.jsxs($,{onClick:async()=>{if(!f.trim()){k.error("Add header text first to generate caption");return}s.medium(),we(!0);try{const h=await Ft({contentType:X,title:f,tagline:n,context:i});fe(h.caption),k.success(`Caption generated! (${h.charCount} characters)`),s.success()}catch(h){k.error("Failed to generate caption"),console.error("Caption generation error:",h)}finally{we(!1)}},disabled:ve||!f.trim(),variant:"outline",className:"w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A]",children:[e.jsx(it,{className:"w-4 h-4 mr-2"}),ve?"Generating...":"Generate Caption with AI"]}),Q&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Generated Caption"}),e.jsxs("span",{className:`text-xs ${Q.length>280?"text-[#ec1e24]":Q.length>250?"text-yellow-600 dark:text-yellow-500":"text-gray-500 dark:text-[#6B7280]"}`,children:[Q.length,"/280"]})]}),e.jsx(Ce,{value:Q,onChange:h=>{s.light(),fe(h.target.value)},placeholder:"Generated caption will appear here...",rows:6,className:"bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-2",children:"You can edit the caption before saving"})]})]})]})]})}),e.jsx(xe,{children:e.jsxs("div",{className:"flex gap-3 w-full",children:[e.jsx($,{onClick:We,variant:"outline",className:"flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]",children:"Cancel"}),e.jsx($,{onClick:Ke,disabled:w||!f.trim(),className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50",children:w?"Rendering...":"Save & Render"})]})})]}),O&&e.jsx($e,{open:H,onOpenChange:J,children:e.jsxs(Re,{className:"max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none",hideCloseButton:!0,children:[e.jsxs(Me,{children:[e.jsx(ze,{children:"Background Image Preview"}),e.jsx(Ue,{children:"Full size preview of selected background image"})]}),e.jsxs("div",{className:"relative",children:[e.jsx("button",{onClick:()=>{s.light(),J(!1)},className:"absolute top-4 right-4 z-50 bg-black/80 text-white p-2 rounded-full hover:bg-black transition-colors",children:e.jsx(de,{className:"w-6 h-6"})}),e.jsx("img",{src:O,alt:"Selected background",className:"w-full h-auto max-h-[90vh] object-contain rounded-lg"})]})]})}),e.jsx(ne,{isOpen:j,onClose:()=>D(!1),currentColor:U,onColorSelect:h=>{s.light(),_(h)}}),e.jsx(ne,{isOpen:B,onClose:()=>N(!1),currentColor:v,onColorSelect:h=>{s.light(),P(h)}}),e.jsx(ne,{isOpen:L,onClose:()=>Y(!1),currentColor:C,onColorSelect:h=>{s.light(),M(h)}})]})}const At={x:"x",threads:"threads",facebook:"facebook",youtube:"youtube",instagram:"instagram",pinterest:"pinterest",tiktok:"tiktok"},Ae=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];function It({selectedPlatforms:t,onTimeSelect:a,className:i=""}){const[l,r]=o.useState(!1),[p,y]=o.useState([]);o.useEffect(()=>{const g=[];for(const n of t){const S=At[n];if(!S)continue;const v=ot.getOptimalPostTime(S);if(v){const P=v.hour,C=P>=12?"PM":"AM",M=P===0?12:P>12?P-12:P;g.push({platform:n,hour:v.hour,dayOfWeek:v.dayOfWeek,confidence:v.confidence,formattedTime:`${M}:00 ${C}`})}}y(g)},[t]);const b=o.useMemo(()=>p.length===0?null:p.reduce((n,S)=>S.confidence>n.confidence?S:n),[p]),d=o.useMemo(()=>{if(!b)return null;const g=new Date,n=b.hour,S=b.dayOfWeek,v=new Date(g);v.setHours(n,0,0,0);const P=g.getDay();let C=S-P;return(C<0||C===0&&g.getHours()>=n)&&(C+=7),v.setDate(v.getDate()+C),v},[b]),w=()=>{d&&a&&a(d)};if(t.length===0||p.length===0)return null;const f=p.reduce((g,n)=>g+n.confidence,0)/p.length;return e.jsxs("div",{className:`rounded-lg border border-gray-200 dark:border-[#333333] overflow-hidden ${i}`,children:[e.jsxs("button",{onClick:()=>r(!l),className:"w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"p-1.5 rounded-full bg-[#ec1e24]/10",children:e.jsx(Ct,{className:"w-3.5 h-3.5 text-[#ec1e24]"})}),e.jsxs("div",{className:"text-left",children:[e.jsx("span",{className:"text-sm font-medium text-gray-900 dark:text-white",children:"Optimal Posting Time"}),b&&e.jsxs("span",{className:"ml-2 text-xs text-[#ec1e24]",children:[b.formattedTime," (",Ae[b.dayOfWeek].slice(0,3),")"]})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[f>=.5&&e.jsxs("span",{className:"text-xs px-2 py-0.5 rounded-full bg-[#ec1e24]/10 text-[#ec1e24]",children:[Math.round(f*100),"% confident"]}),l?e.jsx(wt,{className:"w-4 h-4 text-gray-500 dark:text-[#6B7280]"}):e.jsx(nt,{className:"w-4 h-4 text-gray-500 dark:text-[#6B7280]"})]})]}),l&&e.jsxs("div",{className:"px-4 py-3 bg-white dark:bg-[#0a0a0a] space-y-3 border-t border-gray-200 dark:border-[#333333]",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsxs("p",{className:"text-xs text-gray-500 dark:text-[#9CA3AF] flex items-center gap-1",children:[e.jsx(kt,{className:"w-3 h-3"}),"Based on your analytics data"]}),e.jsx("div",{className:"grid gap-2",children:p.map(g=>e.jsxs("div",{className:"flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-[#111111]",children:[e.jsx("span",{className:"text-gray-700 dark:text-gray-300 capitalize",children:g.platform}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Te,{className:"w-3.5 h-3.5 text-gray-400 dark:text-[#6B7280]"}),e.jsx("span",{className:"text-gray-900 dark:text-white font-medium",children:g.formattedTime}),e.jsx("span",{className:"text-xs text-gray-500 dark:text-[#9CA3AF]",children:Ae[g.dayOfWeek].slice(0,3)}),e.jsxs("span",{className:`text-xs px-1.5 py-0.5 rounded ${g.confidence>=.7?"bg-[#ec1e24]/10 text-[#ec1e24]":g.confidence>=.4?"bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400":"bg-gray-100 dark:bg-[#222222] text-gray-500 dark:text-[#6B7280]"}`,children:[Math.round(g.confidence*100),"%"]})]})]},g.platform))})]}),a&&d&&e.jsxs("button",{onClick:w,className:"w-full py-2.5 rounded-lg bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2",children:[e.jsx(Te,{className:"w-4 h-4"}),"Schedule for ",d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})," at ",b?.formattedTime]}),e.jsx("p",{className:"text-xs text-gray-400 dark:text-[#6B7280] text-center",children:"Recommendations improve as more posts are analyzed"})]})]})}function Ot({open:t,onOpenChange:a,title:i="Publish",description:l="Select platforms and customize your caption",initialCaption:r="",onPublish:p,onCaptionGenerate:y,isGeneratingCaption:b=!1}){const[d,w]=o.useState(r),[f,g]=o.useState(!1),[n,S]=o.useState({x:!1,threads:!1,facebook:!1,youtube:!1,instagram:!1,pinterest:!1}),[v,P]=o.useState(""),[C,M]=o.useState(""),[O,c]=o.useState(""),[T,E]=o.useState("");o.useEffect(()=>{if(t&&!d&&y){const I=y();w(I)}},[t,d,y]),o.useEffect(()=>{r&&w(r)},[r]);const R=o.useMemo(()=>Object.entries(n).filter(([,I])=>I).map(([I])=>I),[n]),z=()=>{if(s.light(),y){const I=y();w(I),g(!1)}},A=()=>{s.medium(),p&&p(d,n),a(!1),w(""),g(!1)},W=()=>{s.light(),a(!1),w(""),g(!1)};return e.jsxs(ue,{open:t,onOpenChange:a,children:[e.jsxs(he,{children:[e.jsx(me,{className:"text-gray-900 dark:text-white",children:i}),e.jsx(Ve,{className:"text-[#6B7280] dark:text-[#9CA3AF]",children:l})]}),e.jsxs(ge,{children:[e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Social Media Caption"}),y&&e.jsx("button",{onClick:z,disabled:b,className:"text-sm text-black dark:text-white hover:opacity-70 disabled:opacity-50 flex items-center gap-1",children:e.jsx(lt,{className:`w-3.5 h-3.5 ${b?"animate-spin":""}`})})]}),e.jsxs("div",{className:"relative",children:[e.jsx("textarea",{value:d,onFocus:()=>{s.light()},onChange:I=>{s.light(),w(I.target.value),g(!0)},placeholder:b?"Generating caption...":"Caption will appear here",disabled:b,className:"w-full min-h-[120px] px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#ec1e24] transition-colors resize-none disabled:opacity-50"}),e.jsxs("div",{className:"absolute bottom-2 right-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:[d.length," chars"]})]}),f&&e.jsxs("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1",children:[e.jsx(He,{className:"w-3 h-3"}),"Caption edited manually"]})]}),e.jsx(Le,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-3 pt-4",children:[e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Select Platforms"}),e.jsx("div",{className:"flex justify-center",children:e.jsxs("div",{className:"grid grid-cols-3 gap-3 max-w-fit",children:[e.jsx("button",{onClick:()=>{s.light(),S({...n,x:!n.x})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${n.x?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"X",children:e.jsx(ct,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>{s.light(),S({...n,threads:!n.threads})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${n.threads?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Threads",children:e.jsx(dt,{className:"w-5 h-5"})}),e.jsx("button",{onClick:()=>{s.light(),S({...n,facebook:!n.facebook})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${n.facebook?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Facebook",children:e.jsx(ut,{className:"w-5.5 h-5.5"})}),e.jsx("button",{onClick:()=>{s.light(),S({...n,youtube:!n.youtube})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${n.youtube?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"YouTube",children:e.jsx(ht,{className:"w-6 h-6"})}),e.jsx("button",{onClick:()=>{s.light(),S({...n,instagram:!n.instagram})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${n.instagram?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Instagram",children:e.jsx(mt,{className:"w-5.5 h-5.5"})}),e.jsx("button",{onClick:()=>{s.light(),S({...n,pinterest:!n.pinterest})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${n.pinterest?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Pinterest",children:e.jsx(gt,{className:"w-5.5 h-5.5"})})]})})]}),e.jsx(It,{selectedPlatforms:R,className:"mt-4"}),n.pinterest&&e.jsxs("div",{className:"space-y-3 pt-4",children:[e.jsx(Le,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Pinterest Details"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:"Pinterest requires structured content for better discovery"}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Title (100 chars max)"}),e.jsx(K,{type:"text",value:v,onFocus:()=>s.light(),onChange:I=>{s.light(),P(I.target.value)},placeholder:"e.g., The Batman (2025) - Official Movie Trailer",maxLength:100,className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"}),e.jsxs("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:[v.length,"/100 characters"]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Description (500 chars max)"}),e.jsx("textarea",{value:C,onFocus:()=>s.light(),onChange:I=>{s.light(),M(I.target.value)},placeholder:"e.g., The Batman returns in 2025! Matt Reeves' epic sequel...",maxLength:500,rows:4,className:"w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#292929] transition-colors resize-none"}),e.jsxs("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:[C.length,"/500 characters"]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Link URL (Required)"}),e.jsx(K,{type:"url",value:O,onFocus:()=>s.light(),onChange:I=>{s.light(),c(I.target.value)},placeholder:"https://youtube.com/watch?v=...",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Board Name (Required)"}),e.jsx(K,{type:"text",value:T,onFocus:()=>s.light(),onChange:I=>{s.light(),E(I.target.value)},placeholder:"e.g., Movies & TV Shows",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:"Must match an existing board on your Pinterest account"})]})]})]}),e.jsx(xe,{children:e.jsxs("div",{className:"flex gap-3 w-full",children:[e.jsx($,{onClick:W,variant:"outline",className:"flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]",children:"Cancel"}),e.jsx($,{onClick:A,className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100",children:"Publish"})]})})]})}function Bt({open:t,onSelectTemplate:a,onClose:i}){const[l,r]=o.useState(!1),[p,y]=o.useState([]),[b,d]=o.useState([]),[w,f]=o.useState(""),[g,n]=o.useState(null);o.useEffect(()=>{t&&(S(),f(""),n(null))},[t]),o.useEffect(()=>{if(w.trim()){const c=p.filter(T=>T.fileName.toLowerCase().includes(w.toLowerCase()));d(c)}else d(p)},[w,p]);const S=async()=>{r(!0),s.light();try{const c=await jt();if(c.success&&c.files)y(c.files),d(c.files),c.files.length===0?k.info("No templates found",{description:"Upload PSD templates to your Backblaze Design bucket first"}):(s.success(),k.success(`Found ${c.files.length} template${c.files.length>1?"s":""}`,{description:"Select one to load into Design Studio"}));else throw new Error(c.error||"Failed to load templates")}catch(c){s.error(),k.error("Failed to load Backblaze templates",{description:c instanceof Error?c.message:"Check your credentials"})}finally{r(!1)}},v=c=>{n(c),s.light()},P=()=>{g&&(s.success(),a(g),k.success("Template loaded from Backblaze",{description:g.fileName}),i())},C=c=>{const T=["B","KB","MB","GB"];if(c===0)return"0 B";const E=Math.floor(Math.log(c)/Math.log(1024));return`${(c/Math.pow(1024,E)).toFixed(1)} ${T[E]}`},M=c=>new Date(c).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}),O=c=>c.replace(/^design-studio\/templates\//,"").replace(/^templates\//,"").replace(/\.psd$/i,"");return e.jsxs(ue,{open:t,onOpenChange:i,heightMode:"full",children:[e.jsx(he,{children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(Ge,{className:"w-7 h-7 text-[#ec1e24]"}),e.jsxs("div",{children:[e.jsx(me,{children:"Backblaze B2 Templates"}),e.jsx(Ve,{children:"Select a PSD template from your cloud storage"})]})]})}),e.jsxs(ge,{className:"flex flex-col gap-4 flex-1 overflow-hidden",children:[e.jsxs("div",{className:"relative",children:[e.jsx(xt,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"}),e.jsx(K,{value:w,onChange:c=>{s.light(),f(c.target.value)},onFocus:()=>s.light(),placeholder:"Search templates by filename...",className:"pl-10 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] focus:border-[#292929] dark:focus:border-[#292929]",disabled:l})]}),e.jsx("div",{className:"flex-1 overflow-y-auto -mx-6 px-6",children:l?e.jsxs("div",{className:"flex flex-col items-center justify-center py-12",children:[e.jsx(pt,{className:"w-12 h-12 text-[#ec1e24] animate-spin mb-4"}),e.jsx("p",{className:"text-gray-600 dark:text-gray-400",children:"Loading templates from Backblaze..."})]}):b.length===0?e.jsxs("div",{className:"text-center py-12",children:[e.jsx(Nt,{className:"w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"}),e.jsx("p",{className:"text-gray-500 dark:text-gray-400 mb-2",children:w?"No templates match your search":"No templates found"}),e.jsx("p",{className:"text-sm text-gray-400 dark:text-gray-500",children:!w&&"Upload PSD templates to your Backblaze Design bucket to see them here"})]}):e.jsx("div",{className:"space-y-2",children:b.map(c=>e.jsx("button",{onClick:()=>v(c),className:`
                    w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                    ${g?.fileId===c.fileId?"border-[#ec1e24] bg-red-50 dark:bg-red-900/10":"border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-gray-600"}
                  `,children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("div",{className:`
                      flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                      ${g?.fileId===c.fileId?"bg-[#ec1e24] text-white":"bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}
                    `,children:g?.fileId===c.fileId?e.jsx(He,{className:"w-5 h-5"}):e.jsx(qe,{className:"w-5 h-5"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-gray-900 dark:text-white truncate mb-1",children:O(c.fileName)}),e.jsxs("div",{className:"flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400",children:[e.jsx("span",{children:C(c.contentLength)}),e.jsx("span",{children:"•"}),e.jsx("span",{children:M(c.uploadTimestamp)})]})]})]})},c.fileId))})})]}),e.jsxs(xe,{children:[e.jsx($,{onClick:i,variant:"outline",className:"flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]",children:"Cancel"}),e.jsx($,{onClick:P,disabled:!g,className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50",children:"Load Template"})]})]})}function Et({templatePreviewUrl:t,designData:a,aspectRatio:i}){if(!a)return e.jsx("img",{src:t,alt:"Template preview",className:"w-full h-full object-cover"});const{backgroundImage:l,imageFocalPoint:r={x:50,y:50},imageZoom:p=1,overlayColor:y="#000000",overlayOpacity:b=70,gradientPosition:d="top",headerText:w="",subtext:f=""}=a,g=r.x,n=r.y,S=`${p*100}%`,v=Math.round(b*2.55).toString(16).padStart(2,"0"),C={top:"to bottom",bottom:"to top",left:"to right",right:"to left"}[d]||"to bottom";return e.jsxs("div",{className:"relative w-full h-full overflow-hidden",children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:l?`url(${l})`:`url(${t})`,backgroundSize:S,backgroundPosition:`${g}% ${n}%`,backgroundRepeat:"no-repeat"}}),e.jsx("div",{className:"absolute inset-0",style:{background:`linear-gradient(${C}, ${y}${v} 0%, transparent 100%)`}}),e.jsxs("div",{className:"absolute inset-0 flex flex-col justify-start items-center p-6 pt-12",children:[w&&e.jsx("h2",{className:"text-white text-center mb-2",style:{textShadow:"0 2px 8px rgba(0,0,0,0.5)",fontSize:i==="9:16"?"1.5rem":"1.25rem",lineHeight:"1.2"},children:w}),f&&e.jsx("p",{className:"text-white/90 text-center text-sm",style:{textShadow:"0 2px 4px rgba(0,0,0,0.4)"},children:f})]})]})}function $t({template:t,onDelete:a,onEdit:i,onExpand:l,livePreviewData:r,isBeingEdited:p}){const[y,b]=o.useState(0),[d,w]=o.useState(!1),[f,g]=o.useState("none"),n=o.useRef(0),S=o.useRef(0),v=o.useRef(0),P=o.useRef(0),C=c=>{n.current=c.touches[0].clientX,S.current=c.touches[0].clientY,g("none")},M=c=>{v.current=c.touches[0].clientX,P.current=c.touches[0].clientY;const T=Math.abs(v.current-n.current),E=Math.abs(P.current-S.current);if(f==="none"&&(T>10||E>10)&&(T>E*1.5?(g("horizontal"),w(!0)):g("vertical")),f==="horizontal"){c.stopPropagation(),c.preventDefault();const R=v.current-n.current;if(R<=0){const z=Math.max(-120,R);b(z)}}},O=()=>{f==="horizontal"&&y<-90&&(s.medium(),a(t.id)),w(!1),g("none"),b(0)};return e.jsxs("div",{className:"relative overflow-hidden rounded-2xl",children:[e.jsx("div",{className:"absolute inset-0 flex justify-end items-center bg-[#ec1e24] rounded-2xl",children:e.jsx("div",{className:"flex items-center justify-center px-6 text-white transition-opacity h-full",style:{opacity:y<0?1:0,width:"120px"},children:e.jsxs("div",{className:"flex flex-col items-center gap-1",children:[e.jsx(De,{className:"w-5 h-5"}),e.jsx("span",{className:"text-xs whitespace-nowrap",children:"Delete"})]})})}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] overflow-hidden hover:border-[#ec1e24] transition-all group relative",style:{transform:`translateX(${y}px)`,transition:d?"none":"transform 0.3s ease-out"},onTouchStart:C,onTouchMove:M,onTouchEnd:O,children:[e.jsxs("div",{className:"relative w-full aspect-video bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden",children:[e.jsx("button",{onClick:c=>{c.stopPropagation(),s.medium(),a(t.id)},className:"hidden lg:block absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-[#ec1e24] dark:hover:text-[#ec1e24]","aria-label":"Delete template",children:e.jsx(De,{className:"w-4 h-4"})}),e.jsxs("button",{onClick:()=>l(t),className:"absolute inset-0 w-full h-full",children:[p&&r?e.jsx(Et,{templatePreviewUrl:t.previewUrl,designData:r,aspectRatio:t.aspectRatio}):e.jsx("img",{src:t.previewUrl,alt:t.name,className:"w-full h-full object-cover"}),e.jsx("div",{className:"absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center",children:e.jsx(yt,{className:"w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"})})]}),e.jsx("div",{className:"absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white pointer-events-none",children:t.aspectRatio}),p&&e.jsxs("div",{className:"absolute top-3 left-3 px-2 py-1 bg-[#ec1e24] backdrop-blur-sm rounded text-xs text-white flex items-center gap-1 pointer-events-none",children:[e.jsx("div",{className:"w-2 h-2 bg-white rounded-full animate-pulse"}),"Live Preview"]})]}),e.jsxs("div",{className:"p-4",children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1 truncate",children:t.name}),e.jsxs("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF] mb-3 capitalize",children:[t.source," · ",t.width,"×",t.height]}),e.jsx("div",{className:"flex gap-2",children:e.jsx($,{onClick:()=>i(t),className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm",size:"sm",children:"Edit"})})]})]})]})}function _e(t){const a=t.replace("#",""),i=parseInt(a.substring(0,2),16),l=parseInt(a.substring(2,4),16),r=parseInt(a.substring(4,6),16);return{r:i,g:l,b:r}}function Rt(t,a,i,l,r,p){const y=r*a,b=p*a,d=t.x/100*y,w=t.y/100*b,f=i/2-d,g=l/2-w;return{translateX:f,translateY:g,scale:a}}function Ye(t){return`
function findLayerByPattern(patterns) {
  var doc = app.activeDocument;
  
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerNameLower = layer.name.toLowerCase();
      
      for (var j = 0; j < patterns.length; j++) {
        if (layerNameLower.indexOf(patterns[j].toLowerCase()) !== -1) {
          return layer;
        }
      }
      
      // Recursively search layer sets (groups)
      if (layer.typename === "LayerSet") {
        var found = searchLayers(layer.layers);
        if (found) return found;
      }
    }
    return null;
  }
  
  return searchLayers(doc.layers);
}

var targetLayer = findLayerByPattern(${JSON.stringify(t)});
`}function Ie(t,a,i){const l=i?_e(i):null;return`
${Ye(t)}

if (targetLayer && targetLayer.kind === LayerKind.TEXT) {
  targetLayer.textItem.contents = ${JSON.stringify(a)};
  
  ${l?`
  var textColor = new SolidColor();
  textColor.rgb.red = ${l.r};
  textColor.rgb.green = ${l.g};
  textColor.rgb.blue = ${l.b};
  targetLayer.textItem.color = textColor;
  `:""}
} else {
  // Layer not found or not a text layer
  var errorMsg = targetLayer ? "Layer found but not text type" : "Layer not found";
  // Continue execution - non-critical error
}
`}function Mt(t,a,i){return`
${Ye(t)}

if (targetLayer) {
  // Store original bounds
  var originalBounds = targetLayer.bounds;
  var docWidth = app.activeDocument.width.value;
  var docHeight = app.activeDocument.height.value;
  
  try {
    // Method 1: Try Smart Object replacement
    if (targetLayer.kind === LayerKind.SMARTOBJECT) {
      // Open new image
      var imageFile = ${JSON.stringify(a)};
      app.open(new File(imageFile));
      var imageDoc = app.activeDocument;
      
      // Copy image
      imageDoc.activeLayer.duplicate(targetLayer.parent, ElementPlacement.PLACEBEFORE);
      imageDoc.close(SaveOptions.DONOTSAVECHANGES);
      
      // Remove old layer and rename new one
      var newLayer = targetLayer.parent.layers[0];
      var oldName = targetLayer.name;
      targetLayer.remove();
      newLayer.name = oldName;
      targetLayer = newLayer;
    } 
    // Method 2: Replace regular image layer
    else if (targetLayer.kind === LayerKind.NORMAL || targetLayer.kind === LayerKind.PIXEL) {
      // Open and place new image
      var imageFile = ${JSON.stringify(a)};
      app.open(new File(imageFile));
      var imageDoc = app.activeDocument;
      
      // Select all and copy
      imageDoc.selection.selectAll();
      imageDoc.selection.copy();
      imageDoc.close(SaveOptions.DONOTSAVECHANGES);
      
      // Paste into original document
      app.activeDocument = targetLayer.parent.parent;
      targetLayer.remove();
      app.activeDocument.paste();
      var newLayer = app.activeDocument.activeLayer;
      newLayer.name = oldName;
      targetLayer = newLayer;
    }
    
    ${i?`
    // Apply transforms
    var scale = ${i.scale};
    var translateX = ${i.translateX};
    var translateY = ${i.translateY};
    
    // Resize layer based on scale
    var currentWidth = targetLayer.bounds[2] - targetLayer.bounds[0];
    var currentHeight = targetLayer.bounds[3] - targetLayer.bounds[1];
    var newWidth = currentWidth * scale;
    var newHeight = currentHeight * scale;
    
    targetLayer.resize(newWidth / currentWidth * 100, newHeight / currentHeight * 100, AnchorPosition.MIDDLECENTER);
    
    // Translate to position focal point
    targetLayer.translate(translateX, translateY);
    `:""}
    
  } catch (e) {
    // Error handling - continue execution
  }
}
`}function zt(t,a,i,l){const r=_e(a);return`
// Find all overlay variants
function findOverlayVariants() {
  var doc = app.activeDocument;
  var overlays = {
    top: null,
    bottom: null,
    left: null,
    right: null
  };
  
  function searchLayers(layers) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var nameLower = layer.name.toLowerCase();
      
      // Match overlay direction variants
      if (nameLower.match(/overlay.*top/)) {
        overlays.top = layer;
      } else if (nameLower.match(/overlay.*bottom/)) {
        overlays.bottom = layer;
      } else if (nameLower.match(/overlay.*left/)) {
        overlays.left = layer;
      } else if (nameLower.match(/overlay.*right/)) {
        overlays.right = layer;
      }
      
      // Recursively search layer sets
      if (layer.typename === "LayerSet") {
        searchLayers(layer.layers);
      }
    }
  }
  
  searchLayers(doc.layers);
  return overlays;
}

var overlays = findOverlayVariants();

${`
// Hide all overlays first
if (overlays.top) overlays.top.visible = false;
if (overlays.bottom) overlays.bottom.visible = false;
if (overlays.left) overlays.left.visible = false;
if (overlays.right) overlays.right.visible = false;

// Activate selected overlay variant
var activeOverlay = overlays["${l}"];

if (activeOverlay) {
  activeOverlay.visible = true;
  activeOverlay.opacity = ${i};
  
  // Apply color to solid color adjustment layer
  try {
    // Method 1: Try solid color fill layer
    if (activeOverlay.kind === LayerKind.SOLIDFILL) {
      var solidColor = new SolidColor();
      solidColor.rgb.red = ${r.r};
      solidColor.rgb.green = ${r.g};
      solidColor.rgb.blue = ${r.b};
      activeOverlay.fillColor = solidColor;
    }
    // Method 2: Try adjustment layer (Color Fill)
    else {
      var idsetd = charIDToTypeID("setd");
      var desc = new ActionDescriptor();
      var idnull = charIDToTypeID("null");
      var ref = new ActionReference();
      ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      desc.putReference(idnull, ref);
      
      var idT = charIDToTypeID("T   ");
      var descColor = new ActionDescriptor();
      var idClr = charIDToTypeID("Clr ");
      var descRGB = new ActionDescriptor();
      descRGB.putDouble(charIDToTypeID("Rd  "), ${r.r});
      descRGB.putDouble(charIDToTypeID("Grn "), ${r.g});
      descRGB.putDouble(charIDToTypeID("Bl  "), ${r.b});
      descColor.putObject(idClr, charIDToTypeID("RGBC"), descRGB);
      desc.putObject(idT, charIDToTypeID("SoFi"), descColor);
      
      executeAction(idsetd, desc, DialogModes.NO);
    }
  } catch (e) {
    // Fallback: just adjust opacity
    activeOverlay.opacity = ${i};
  }
}
`}
`}function Ut(t,a){const i=[];if(t.headerText&&i.push(Ie(["header","title","headline","main"],t.headerText,t.headerTextColor)),a.hasSubtext&&t.subtext&&i.push(Ie(["subtext","subtitle","description","caption","body"],t.subtext,t.subtextColor)),t.backgroundImage){let l;(t.imageFocalPoint||t.imageZoom)&&(l=Rt(t.imageFocalPoint||{x:50,y:50},t.imageZoom||1,a.width,a.height,a.width,a.height)),i.push(Mt(["background","image","photo","artwork","bg"],t.backgroundImage,l))}return a.hasOverlay&&t.overlayColor&&t.overlayOpacity!==void 0&&i.push(zt(!0,t.overlayColor,t.overlayOpacity,t.gradientPosition||"top")),i.push(`
// Flatten and export
try {
  // Flatten all layers
  app.activeDocument.flatten();
  
  // Save as JPEG
  var jpegOptions = new JPEGSaveOptions();
  jpegOptions.quality = 12; // Max quality
  jpegOptions.embedColorProfile = true;
  
  var outputFile = new File(app.activeDocument.path + "/output.jpg");
  app.activeDocument.saveAs(outputFile, jpegOptions, true);
  
} catch (e) {
  // Error in export
}
`),i.join(`

`)}function Vt(){return`
function analyzeLayers() {
  var doc = app.activeDocument;
  var result = {
    width: doc.width.value,
    height: doc.height.value,
    layers: [],
    detectedLayers: {
      hasHeader: false,
      hasSubtext: false,
      hasOverlay: false,
      hasBackground: false,
      hasHeaderVariants: false, // Multi-size headline support
      hasSubtextVariants: false
    },
    textVariants: {
      header: {
        large: null,
        medium: null,
        small: null
      },
      subtext: {
        large: null,
        medium: null,
        small: null
      }
    }
  };
  
  function scanLayers(layers, path) {
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      var layerInfo = {
        name: layer.name,
        type: layer.kind.toString(),
        visible: layer.visible,
        opacity: layer.opacity,
        path: path + "/" + layer.name
      };
      
      var nameLower = layer.name.toLowerCase();
      
      // Detect layer purposes
      if (layer.kind === LayerKind.TEXT) {
        layerInfo.isText = true;
        layerInfo.textContent = layer.textItem.contents;
        
        // Check for multi-size header variants (Strategy 2)
        if (nameLower.match(/header.*large|headline.*large|title.*large/)) {
          result.detectedLayers.hasHeader = true;
          result.detectedLayers.hasHeaderVariants = true;
          result.textVariants.header.large = layer.name;
          layerInfo.purpose = "header_large";
        } else if (nameLower.match(/header.*medium|headline.*medium|title.*medium/)) {
          result.detectedLayers.hasHeader = true;
          result.detectedLayers.hasHeaderVariants = true;
          result.textVariants.header.medium = layer.name;
          layerInfo.purpose = "header_medium";
        } else if (nameLower.match(/header.*small|headline.*small|title.*small/)) {
          result.detectedLayers.hasHeader = true;
          result.detectedLayers.hasHeaderVariants = true;
          result.textVariants.header.small = layer.name;
          layerInfo.purpose = "header_small";
        } else if (nameLower.match(/header|title|headline|main/)) {
          result.detectedLayers.hasHeader = true;
          layerInfo.purpose = "header";
        }
        
        // Check for multi-size subtext variants
        if (nameLower.match(/subtext.*large|subtitle.*large|description.*large/)) {
          result.detectedLayers.hasSubtext = true;
          result.detectedLayers.hasSubtextVariants = true;
          result.textVariants.subtext.large = layer.name;
          layerInfo.purpose = "subtext_large";
        } else if (nameLower.match(/subtext.*medium|subtitle.*medium|description.*medium/)) {
          result.detectedLayers.hasSubtext = true;
          result.detectedLayers.hasSubtextVariants = true;
          result.textVariants.subtext.medium = layer.name;
          layerInfo.purpose = "subtext_medium";
        } else if (nameLower.match(/subtext.*small|subtitle.*small|description.*small/)) {
          result.detectedLayers.hasSubtext = true;
          result.detectedLayers.hasSubtextVariants = true;
          result.textVariants.subtext.small = layer.name;
          layerInfo.purpose = "subtext_small";
        } else if (nameLower.match(/subtext|subtitle|description|caption|body/)) {
          result.detectedLayers.hasSubtext = true;
          layerInfo.purpose = "subtext";
        }
      }
      
      if (nameLower.match(/background|image|photo|artwork|bg/) || layer.kind === LayerKind.SMARTOBJECT) {
        result.detectedLayers.hasBackground = true;
        layerInfo.purpose = "background";
      }
      
      if (nameLower.match(/overlay|gradient/) && (layer.kind === LayerKind.GRADIENTFILL || layer.kind === LayerKind.NORMAL)) {
        result.detectedLayers.hasOverlay = true;
        layerInfo.purpose = "overlay";
      }
      
      result.layers.push(layerInfo);
      
      // Recursively scan layer sets
      if (layer.typename === "LayerSet") {
        scanLayers(layer.layers, path + "/" + layer.name);
      }
    }
  }
  
  scanLayers(doc.layers, "");
  
  return JSON.stringify(result);
}

analyzeLayers();
`}class Ht{iframe=null;messageQueue=[];isReady=!1;async initialize(){if(!this.iframe)return new Promise((a,i)=>{try{this.iframe=document.createElement("iframe"),this.iframe.style.display="none",this.iframe.style.position="fixed",this.iframe.style.top="-9999px",this.iframe.style.left="-9999px",this.iframe.style.width="1px",this.iframe.style.height="1px",this.iframe.src="https://www.photopea.com",this.iframe.onerror=()=>{console.error("[Photopea] Failed to load iframe"),this.cleanup(),i(new Error("Failed to load Photopea. Please check your internet connection."))},document.body.appendChild(this.iframe);let l=0;const r=20,p=setInterval(()=>{if(l++,l>=r){clearInterval(p),this.cleanup(),i(new Error("Photopea initialization timed out. Please try again."));return}try{this.iframe?.contentWindow&&(this.isReady=!0,clearInterval(p),this.setupMessageListener(),console.log("[Photopea] Initialized successfully"),a())}catch{}},1e3)}catch(l){this.cleanup();const r=l instanceof Error?l.message:"Unknown error";i(new Error(`Photopea initialization failed: ${r}`))}})}cleanup(){this.iframe&&this.iframe.parentNode&&this.iframe.parentNode.removeChild(this.iframe),this.iframe=null,this.isReady=!1,this.messageQueue=[]}setupMessageListener(){window.addEventListener("message",a=>{if(a.source!==this.iframe?.contentWindow)return;const i=a.data;if(this.messageQueue.length>0){const l=this.messageQueue[0];i.done?(l.resolve(i.result||null),this.messageQueue.shift(),this.messageQueue.length>0&&this.executeNextInQueue()):i.error&&(l.reject(new Error(i.error)),this.messageQueue.shift(),this.messageQueue.length>0&&this.executeNextInQueue())}})}executeNextInQueue(){if(this.messageQueue.length===0)return;const{script:a}=this.messageQueue[0];this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage(a,"*")}async executeScript(a){return(!this.isReady||!this.iframe)&&await this.initialize(),new Promise((i,l)=>{this.messageQueue.push({script:a,resolve:i,reject:l}),this.messageQueue.length===1&&this.executeNextInQueue()})}async loadPSD(a){return this.isReady||await this.initialize(),new Promise((i,l)=>{const r=new FileReader;r.onload=async p=>{const y=p.target?.result,d=`
          var arr = [${new Array.from(new Uint8Array(y)).join(",")}];
          var file = new File(arr, "template.psd");
          app.open(file);
        `;try{await this.executeScript(d),i()}catch(w){l(w)}},r.onerror=()=>l(new Error("Failed to read PSD file")),r.readAsArrayBuffer(a)})}async loadPSDFromURL(a){this.isReady||await this.initialize();const i=`
      app.open("${a}");
    `;await this.executeScript(i)}async analyzeLayers(){const a=Vt(),i=await this.executeScript(a);if(!i)throw new Error("Failed to analyze layers");return JSON.parse(i)}async renderDesign(a,i){const l=Ut(a,i);await this.executeScript(l);const p=await this.executeScript(`
      var jpegOptions = new JPEGSaveOptions();
      jpegOptions.quality = 12;
      jpegOptions.embedColorProfile = true;
      
      var tempFile = new File(Folder.temp + "/screndly-output.jpg");
      app.activeDocument.saveAs(tempFile, jpegOptions, true);
      
      // Read file as base64
      tempFile.encoding = "BINARY";
      tempFile.open("r");
      var content = tempFile.read();
      tempFile.close();
      
      btoa(content);
    `);if(!p)throw new Error("Failed to export image");const y=atob(p),b=new Uint8Array(y.length);for(let d=0;d<y.length;d++)b[d]=y.charCodeAt(d);return new Blob([b],{type:"image/jpeg"})}async getPreview(){return await this.executeScript(`
      // Flatten copy
      var originalDoc = app.activeDocument;
      var tempDoc = originalDoc.duplicate();
      app.activeDocument = tempDoc;
      tempDoc.flatten();
      
      // Export as PNG to temp
      var pngOptions = new PNGSaveOptions();
      var tempFile = new File(Folder.temp + "/preview.png");
      tempDoc.saveAs(tempFile, pngOptions, true);
      tempDoc.close(SaveOptions.DONOTSAVECHANGES);
      
      app.activeDocument = originalDoc;
      
      // Read as base64
      tempFile.encoding = "BINARY";
      tempFile.open("r");
      var content = tempFile.read();
      tempFile.close();
      
      "data:image/png;base64," + btoa(content);
    `)||""}async closeDocument(){await this.executeScript(`
      if (app.documents.length > 0) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    `)}destroy(){this.iframe&&(document.body.removeChild(this.iframe),this.iframe=null,this.isReady=!1,this.messageQueue=[])}}let le=null;function Oe(){return le||(le=new Ht),le}async function Gt(){const t=await ae.get("/api/design-studio/state");if(!t.success||!t.data)throw new Error(t.error?.message||"Failed to load Design Studio state");return t.data}async function qt(t){const a=await ae.put("/api/design-studio/state",t);if(!a.success)throw new Error(a.error?.message||"Failed to save Design Studio state")}async function ce(t,a){const i=await ae.uploadFile("/api/design-studio/upload-asset",t,void 0,{folder:a});if(!i.success||!i.data)throw new Error(i.error?.message||"Failed to upload Design Studio asset");return i.data}async function te(t,a){const i=await ae.post("/api/design-studio/activity",{type:t,details:a});if(!i.success)throw new Error(i.error?.message||"Failed to save Design Studio activity")}function _t(t){return{...t,lastEdited:new Date(t.lastEdited)}}function Yt(t){return{...t,createdAt:new Date(t.createdAt)}}function Xt(t){return t.map(a=>({...a,lastEdited:a.lastEdited.toISOString()}))}function Qt(t){return t.map(a=>({...a,createdAt:a.createdAt.toISOString()}))}function Kt(t,a){const[i,l]=t.split(",");if(!i||!l)throw new Error("Invalid preview data");const p=i.match(/data:(.*?);base64/)?.[1]||"image/png",y=atob(l),b=new Uint8Array(y.length);for(let d=0;d<y.length;d+=1)b[d]=y.charCodeAt(d);return new File([b],a,{type:p})}function Zt({onNavigate:t,previousPage:a}){const{addNotification:i}=bt(),{showUndo:l}=ft(),[r,p]=o.useState([]),[y,b]=o.useState([]),[d,w]=o.useState(null),[f,g]=o.useState(!1),[n,S]=o.useState(null),[v,P]=o.useState(!1),[C,M]=o.useState(!1),[O,c]=o.useState(null),[T,E]=o.useState(null),[R,z]=o.useState(!1),[A,W]=o.useState(null),[I,q]=o.useState(!1),[ie,re]=o.useState(!0),pe=o.useRef(null);o.useEffect(()=>{let u=!0;return(async()=>{try{const x=await Gt();if(!u)return;p((x.templates||[]).map(_t)),b((x.renderedDesigns||[]).map(Yt))}catch(x){console.error("Failed to load Design Studio state:",x),u&&k.error("Failed to load Design Studio data")}finally{u&&re(!1)}})(),()=>{u=!1}},[]);const se=(u,m)=>{const x=(N,L)=>L===0?N:x(L,N%L),j=x(u,m),D=u/j,B=m/j;return D===16&&B===9?"16:9":D===9&&B===16?"9:16":D===1&&B===1?"1:1":D===4&&B===5?"4:5":D===5&&B===4?"5:4":D===3&&B===4?"3:4":D===4&&B===3?"4:3":`${D}:${B}`},H=async(u,m)=>{await qt({templates:Xt(u),renderedDesigns:Qt(m)})},J=async u=>{const m=u.target.files?.[0];if(m){if(!m.name.endsWith(".psd")){k.error("Please upload a PSD file");return}s.medium(),k.success("Processing PSD template with Photopea...");try{const x=Oe();await x.initialize(),await x.loadPSD(m);const j=await x.analyzeLayers(),D=await x.getPreview(),B=Kt(D,`${m.name.replace(/\.psd$/i,"")}-preview.png`),[N,L]=await Promise.all([ce(m,"templates"),ce(B,"template-previews")]),Y={id:`template-${Date.now()}`,name:m.name.replace(".psd",""),previewUrl:L.url,aspectRatio:se(j.width,j.height),width:j.width,height:j.height,source:"upload",lastEdited:new Date,hasSubtext:j.detectedLayers.hasSubtext,hasCategory:!1,hasSource:!1,psdData:{layers:j.layers,detectedLayers:j.detectedLayers,b2Url:N.url,fileName:N.fileName,previewFileName:L.fileName}},X=[Y,...r];await H(X,y),p(X),await te("template_uploaded",{templateName:Y.name}),k.success(`Template "${Y.name}" analyzed and uploaded!`),await x.closeDocument()}catch(x){console.error("Photopea analysis error:",x),k.error(x instanceof Error?x.message:"Failed to process PSD template")}finally{u.target.value=""}}},ye=async()=>{s.medium(),q(!0)},be=async u=>{const m=u.map(j=>({id:`bb-${j.fileId}-${Date.now()}`,name:j.fileName.replace(".psd","").replace("templates/",""),previewUrl:j.url.replace(".psd","_preview.jpg"),aspectRatio:"4:5",width:1080,height:1350,source:"backblaze",lastEdited:j.lastModified,hasSubtext:!0,psdData:{b2Url:j.url,fileName:j.fileName}})),x=[...m,...r];await H(x,y),p(x),await te("templates_loaded",{source:"backblaze",count:m.length}),k.success(`${m.length} template${m.length!==1?"s":""} loaded from Backblaze`),s.success(),q(!1)},Z=u=>{s.light(),S(u),g(!0)},oe=u=>{s.light(),w(u),E(u.id),P(!0)},U=async u=>{if(d){z(!0),P(!1),k.success("Rendering design with Photopea...");try{const m=Oe();await m.initialize();const x=d.psdData?.b2Url||d.psdData?.fileUrl;if(!x)throw new Error("Template source file is missing");await m.loadPSDFromURL(x);const j=await m.renderDesign(u,{width:d.width,height:d.height,hasSubtext:d.hasSubtext||!1,hasOverlay:!0}),D=new File([j],`${d.name.replace(/[^a-zA-Z0-9-_]+/g,"-")}.jpg`,{type:"image/jpeg"}),B=await ce(D,"renders"),N={id:`design-${Date.now()}`,templateId:d.id,templateName:d.name,outputUrl:B.url,data:u,createdAt:new Date,aspectRatio:d.aspectRatio,caption:u.caption,contentType:u.contentType},L=[N,...y];await H(r,L),b(L),z(!1),await te("design_rendered",{templateName:d.name,designId:N.id}),Fe({title:d.name,platform:"Design Studio",status:"success",type:"designstudio"}),Pe({videoTitle:d.name,platform:"Design Studio",status:"success",type:"designstudio"}),i({type:"success",title:"Design Rendered",message:`"${d.name}" rendered successfully`,source:"design_studio",actionPage:"design-studio-activity"}),await m.closeDocument(),k.success("Design rendered successfully!"),s.success()}catch(m){console.error("Photopea rendering error:",m),z(!1),k.error(m instanceof Error?m.message:"Failed to render design")}}},_=async(u,m)=>{if(A){s.medium();try{const x=await vt(m,{text:u||A.caption||A.templateName,title:A.templateName,imageUrl:A.outputUrl});if(!x.success||!x.data){k.error(x.error?.message||"Failed to publish design");return}const j=x.data.results.filter(L=>L.status==="posted").map(L=>L.platform),D=x.data.results.filter(L=>L.status==="failed").map(L=>`${L.platform}${L.error?`: ${L.error}`:""}`);if(j.length===0){k.error(D[0]||"Failed to publish design");return}const B=y.map(L=>L.id===A.id?{...L,caption:u||L.caption}:L);await H(r,B),b(B);const N=j.join(", ");if(await te("design_published",{templateName:A.templateName,designId:A.id,platforms:N}),Fe({title:A.templateName,platform:N,status:"success",type:"designstudio"}),Pe({videoTitle:A.templateName,platform:N,status:"success",type:"designstudio",errorDetails:D.length>0?D.join(" | "):void 0}),i({type:"success",title:"Design Published",message:`"${A.templateName}" published to ${N}`,source:"design_studio",actionPage:"design-studio-activity"}),D.length>0){k.success(`Published to ${N}`,{description:`Failed: ${D.join(" | ")}`});return}k.success("Design published to selected platforms!")}catch(x){console.error("Failed to finish Design Studio publish flow:",x),k.error(x instanceof Error?x.message:"Failed to publish design")}}},G=async u=>{const m=r.find(N=>N.id===u);if(!m)return;const x=[...r],j=[...y],D=r.filter(N=>N.id!==u),B=y.filter(N=>N.templateId!==u);try{await H(D,B),p(D),b(B),await te("template_deleted",{templateName:m.name}),s.medium(),k.success("Template deleted"),l({id:`undo-template-${u}`,itemName:m.name,onUndo:async()=>{await H(x,j),p(x),b(j),s.light(),k.success("Template restored")}})}catch(N){console.error("Failed to delete template:",N),k.error(N instanceof Error?N.message:"Failed to delete template")}};return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-gray-900 dark:text-white mb-2",children:"Design Studio"}),e.jsx("p",{className:"text-[#6B7280] dark:text-[#9CA3AF]",children:"PSD-driven creative automation workspace"})]}),e.jsx($,{onClick:()=>{s.light(),t("design-studio-activity")},variant:"outline",className:"text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]",children:"View Activity"})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsxs("label",{className:"block cursor-pointer",children:[e.jsx("input",{ref:pe,type:"file",accept:".psd",onChange:J,className:"hidden"}),e.jsxs("div",{className:"border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]",children:[e.jsx(Ee,{className:"w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3"}),e.jsx("p",{className:"text-gray-900 dark:text-white",children:"Upload PSD Template"})]})]}),e.jsxs("button",{onClick:ye,className:"border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]",children:[e.jsx(Ge,{className:"w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3"}),e.jsx("p",{className:"text-gray-900 dark:text-white",children:"Load from Backblaze"})]})]}),ie?e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:[1,2,3].map(u=>e.jsx("div",{className:"h-72 rounded-2xl border border-gray-200 dark:border-[#333333] bg-gray-100 dark:bg-[#111111] animate-pulse"},u))}):r.length===0?e.jsxs("div",{className:"bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center",children:[e.jsx(qe,{className:"w-12 h-12 text-gray-400 dark:text-[#666666] mx-auto mb-4"}),e.jsx("p",{className:"text-gray-600 dark:text-[#9CA3AF] mb-2",children:"No templates yet"}),e.jsx("p",{className:"text-sm text-gray-500 dark:text-[#6B7280]",children:"Upload a PSD template or load from Backblaze to get started"})]}):e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:r.map(u=>e.jsx($t,{template:u,onDelete:G,onEdit:oe,onExpand:Z,livePreviewData:T===u.id?O:null,isBeingEdited:T===u.id},u.id))}),d&&e.jsx(Pt,{open:v,onOpenChange:u=>{P(u),u||(E(null),c(null))},templateName:d.name,hasSubtext:d.hasSubtext,hasOverlay:!0,onSave:U,onChange:u=>c(u),isRendering:R}),A&&e.jsx(Ot,{open:C,onOpenChange:M,title:"Publish Design",description:"Select platforms and customize your caption",initialCaption:A.caption||"",onPublish:(u,m)=>_(u,m),onCaptionGenerate:()=>A.caption||A.templateName||"New design created!"}),n&&e.jsx($e,{open:f,onOpenChange:g,children:e.jsxs(Re,{className:"max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none",hideCloseButton:!0,children:[e.jsxs(Me,{children:[e.jsx(ze,{children:n.name}),e.jsxs(Ue,{children:["Full size preview of ",n.name," (",n.aspectRatio,")"]})]}),e.jsxs("div",{className:"relative",children:[e.jsx("button",{onClick:()=>{s.light(),g(!1)},className:"absolute top-4 right-4 z-50 bg-black/80 text-white p-2 rounded-full hover:bg-black transition-colors",children:e.jsx(de,{className:"w-6 h-6"})}),e.jsx("img",{src:n.previewUrl,alt:n.name,className:"w-full h-auto max-h-[90vh] object-contain rounded-lg"})]})]})}),e.jsx(Bt,{open:I,onSelectTemplate:u=>{be([u]).catch(m=>{console.error("Failed to load template from Backblaze:",m),k.error(m instanceof Error?m.message:"Failed to load template")})},onClose:()=>{s.light(),q(!1)}})]})}export{Zt as default};
