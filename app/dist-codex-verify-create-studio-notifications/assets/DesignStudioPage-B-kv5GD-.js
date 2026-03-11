import{k as $e,b6 as Y,b7 as tt,a as se,b5 as at,b8 as te,r as n,j as e,b as ge,c as me,d as xe,f as pe,L as F,I as K,h as i,s as Te,ar as Re,B as $,as as he,t as k,E as rt,G as st,H as ot,J as it,M as ae,aK as nt,g as ye,b9 as Me,ba as ze,aW as He,bb as Ue,bc as Ve,aL as lt,a3 as Le,e as Ge,R as ct,o as _e,W as Fe,X as dt,n as ut,F as ht,Y as gt,l as mt,P as xt,az as pt,q as yt,T as Pe,bd as ft,aj as bt,u as vt,v as wt}from"./index-DtAjeZVN.js";import{b as ce,a as kt,T as jt,f as Nt,C as Qe,d as Ae,e as Ie}from"./ColorPickerPopup-DCPc5N05.js";/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const St=[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",key:"ep3f8r"}],["path",{d:"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",key:"1p4c4q"}],["path",{d:"M17.599 6.5a3 3 0 0 0 .399-1.375",key:"tmeiqw"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M19.938 10.5a4 4 0 0 1 .585.396",key:"1qfode"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M19.967 17.484A4 4 0 0 1 18 18",key:"159ez6"}]],Ct=$e("brain",St);/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Dt=[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["circle",{cx:"10",cy:"12",r:"2",key:"737tya"}],["path",{d:"m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22",key:"wt3hpn"}]],Tt=$e("file-image",Dt);class Lt{config=Y.getConfig();getOptimalPostTime(t,s=new Date,o){if(!this.config.enabled||!this.config.postTimeOptimization)return s;if(tt.shouldExplore())return this.logDecision({type:"timing",decision:"Using earliest time (exploration mode)",reasoning:"Random exploration to gather diverse data",confidence:0,isExploration:!0,timestamp:Date.now()}),s;const a=Y.getSignals();if(!a||a.platforms[t].confidence<this.config.confidenceThreshold)return s;const c=a.platforms[t],g=this.findBestHourInRange(c.optimalHours,s,o),u=new Date(s);return u.setHours(g,0,0,0),u<s&&u.setDate(u.getDate()+1),o&&u>o?this.findClosestToOptimalInRange(g,s,o):(this.logDecision({type:"timing",decision:`Optimal time: ${u.toLocaleTimeString()}`,reasoning:`Hour ${g} has score ${c.optimalHours[g]}`,confidence:c.confidence,isExploration:!1,timestamp:Date.now()}),u)}findBestHourInRange(t,s,o){const a=s.getHours(),c=o?o.getHours():23,g=!o||s.toDateString()===o.toDateString();let u=a,l=0;for(let f=0;f<24;f++)g&&(f<a||f>c)||t[f]>l&&(l=t[f],u=f);return u}findClosestToOptimalInRange(t,s,o){const a=new Date(s);return a.setHours(t,0,0,0),a>=s&&a<=o||(a.setDate(a.getDate()+1),a>=s&&a<=o)?a:o}shouldShiftTime(t,s,o){if(!this.config.enabled||!this.config.postTimeOptimization)return{shift:!1,newTime:s};const a=Y.getSignals();if(!a||a.platforms[t].confidence<this.config.confidenceThreshold)return{shift:!1,newTime:s};const c=this.getOptimalPostTime(t,o.earliest,o.latest),g=Math.abs(c.getTime()-s.getTime())/6e4;return g<=this.config.maxTimeShiftMinutes&&g>=30?{shift:!0,newTime:c}:{shift:!1,newTime:s}}getHeatmap(t){const s=Y.getSignals();if(!s)return{hours:Object.fromEntries(Array.from({length:24},(a,c)=>[c,50])),days:Object.fromEntries(Array.from({length:7},(a,c)=>[c,50])),confidence:0};const o=s.platforms[t];return{hours:{...o.optimalHours},days:{...o.optimalDays},confidence:o.confidence}}getRecommendedWindows(t){const s=Y.getSignals();if(!s)return[];const o=s.platforms[t].optimalHours,a=[];let c=null,g=0,u=0;for(let l=0;l<24;l++){const f=o[l];f>=60?(c===null&&(c=l),g+=f,u+=1):c!==null&&(a.push({start:c,end:l-1,score:Math.round(g/u)}),c=null,g=0,u=0)}return c!==null&&a.push({start:c,end:23,score:Math.round(g/u)}),a.sort((l,f)=>f.score-l.score)}logDecision(t){(this.config.verbose||this.config.dryRun)&&console.log(`[PostTimeOptimizer] ${t.type}: ${t.decision} (${t.reasoning})`),Y.logDecision(t)}}const Ft=new Lt;function Pt(r){let t={};try{const a=localStorage.getItem("screndly_design_studio_settings");a&&(t=JSON.parse(a))}catch(a){console.error("Failed to load Design Studio settings:",a)}const o={poster:"captionPosterPrompt",carousel:"captionCarouselPrompt",story:"captionStoryPrompt",announcement:"captionAnnouncementPrompt",general:"captionGeneralPrompt"}[r];return{model:t.captionOpenaiModel||at.designStudio,prompt:t[o]||At(r),temperature:t.captionTemperature||.7,maxTokens:t.captionMaxTokens||500,maxLength:t.captionMaxLength||280,tone:t.captionTone||"engaging",includeEmojis:t.captionIncludeEmojis!==!1,includeHashtags:t.captionIncludeHashtags!==!1}}function At(r){return{poster:te.captionPosterPrompt,carousel:te.captionCarouselPrompt,story:te.captionStoryPrompt,announcement:te.captionAnnouncementPrompt,general:te.captionGeneralPrompt}[r]}async function It(r){const t=Pt(r.contentType),s=[r.tagline,r.releaseInfo,r.castInfo,r.context].filter(Boolean),o=await se.post("/api/ai/generate/studio-caption",{fileName:r.title||`${r.contentType} design`,fileDescription:s.join(" | ")||"No extra context provided",tone:t.tone,model:t.model,customSystemPrompt:t.prompt,customTemperature:t.temperature,customMaxTokens:t.maxTokens});if(!o.success||!o.data?.content)throw console.error("Failed to generate Design Studio caption:",o.error),new Error(o.error?.message||"Failed to generate caption");let a=o.data.content.trim();return a.length>t.maxLength&&(a=`${a.substring(0,t.maxLength-3)}...`),{caption:a,charCount:a.length,settings:t}}function Bt({open:r,onOpenChange:t,templateName:s,aspectRatio:o,initialData:a,hasSubtext:c=!1,hasOverlay:g=!1,onSave:u,onChange:l,isRendering:f=!1}){const[v,y]=n.useState(a?.headerText||""),[d,S]=n.useState(a?.subtext||""),[w,P]=n.useState(a?.headerTextColor||"#000000"),[C,M]=n.useState(a?.subtextColor||"#000000"),[B,h]=n.useState(a?.backgroundImage||""),[D,E]=n.useState(a?.imageFocalPoint||{x:50,y:50}),[R,z]=n.useState(a?.imageZoom||1),[A,J]=n.useState(""),[I,_]=n.useState([]),[ne,oe]=n.useState(!1),[fe,ie]=n.useState(null),[V,Z]=n.useState(!1),[be,ve]=n.useState(!1),[ee,le]=n.useState(a?.overlayEnabled||!1),[H,Q]=n.useState(a?.overlayColor||"#000000"),[G,m]=n.useState(a?.overlayOpacity||70),[p,b]=n.useState(a?.gradientPosition||"top"),[j,L]=n.useState(!1),[O,N]=n.useState(!1),[T,X]=n.useState(!1),[W,qe]=n.useState("general"),[q,we]=n.useState(""),[ke,je]=n.useState(!1);n.useEffect(()=>{a&&(y(a.headerText||""),S(a.subtext||""),P(a.headerTextColor||"#000000"),M(a.subtextColor||"#000000"),h(a.backgroundImage||""),E(a.imageFocalPoint||{x:50,y:50}),z(a.imageZoom||1),le(a.overlayEnabled||!1),Q(a.overlayColor||"#000000"),m(a.overlayOpacity||70),b(a.gradientPosition||"top"))},[a]),n.useEffect(()=>{l&&r&&l({headerText:v,subtext:c?d:void 0,headerTextColor:w,subtextColor:C,backgroundImage:B,imageFocalPoint:D,imageZoom:R,overlayEnabled:ee,overlayColor:H,overlayOpacity:G,gradientPosition:p})},[v,d,w,C,B,D.x,D.y,R,ee,H,G,r,c,p]);const Ye=x=>{i.light();const U=x.target.files?.[0];if(U){const De=new FileReader;De.onload=Ze=>{const et=Ze.target?.result;h(et),k.success("Image uploaded")},De.readAsDataURL(U)}},Ne=async()=>{A.trim()&&(i.medium(),oe(!0),setTimeout(()=>{const x=[{id:1,title:A,backdrop:"https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800",poster:"https://images.unsplash.com/photo-1594908900066-3f47337549d8?w=400"},{id:2,title:`${A} 2`,backdrop:"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800",poster:"https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400"}];_(x),oe(!1)},1e3))},Se=x=>{i.light(),h(x),ie(x),_([]),J(""),k.success("Image selected from TMDb")},Ke=()=>{if(!v.trim()){k.error("Header text is required");return}i.medium(),u({headerText:v,subtext:c?d:void 0,headerTextColor:w,subtextColor:C,backgroundImage:B,imageFocalPoint:D,imageZoom:R,overlayEnabled:ee,overlayColor:H,overlayOpacity:G,gradientPosition:p,caption:q||void 0,contentType:W})},Je=()=>{i.light(),t(!1)},Ce=()=>{switch(o){case"1:1":return"aspect-square";case"16:9":return"aspect-video";case"9:16":return"aspect-[9/16]";case"4:5":return"aspect-[4/5]";case"5:4":return"aspect-[5/4]";default:return"aspect-square"}};return e.jsxs(e.Fragment,{children:[e.jsxs(ge,{open:r,onOpenChange:t,children:[e.jsxs(me,{children:[e.jsx(xe,{className:"text-gray-900 dark:text-white",children:"Edit Design"}),e.jsx("p",{className:"text-xs text-[#6B7280] mt-1",children:"Customize text, colors, and images for your design"})]}),e.jsx(pe,{children:e.jsxs("div",{className:"space-y-4","data-scrollable":!0,children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsxs(F,{className:"text-gray-900 dark:text-white",children:["Header Text ",e.jsx("span",{className:"text-[#ec1e24]",children:"*"})]}),e.jsxs("span",{className:`text-xs ${v.length>90?"text-[#ec1e24] font-medium":v.length>70?"text-yellow-600 dark:text-yellow-500":"text-gray-500 dark:text-[#6B7280]"}`,children:[v.length,"/90"]})]}),e.jsx(K,{value:v,onChange:x=>{i.light();const U=x.target.value;U.length<=120&&y(U)},placeholder:"Enter header text...",className:"bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"}),v.length>90&&e.jsx("p",{className:"text-xs text-[#ec1e24] mt-1",children:"⚠️ Exceeds recommended limit (may use smaller font)"}),v.length>60&&v.length<=90&&e.jsx("p",{className:"text-xs text-yellow-600 dark:text-yellow-500 mt-1",children:"💡 Medium font size will be used"}),e.jsxs("div",{className:"mt-3",children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Header Text Color"}),e.jsx("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:w.toUpperCase()})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>{i.light(),N(!0)},className:"w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform",style:{backgroundColor:w},title:w}),e.jsx("input",{type:"text",value:w,onChange:x=>{i.light(),P(x.target.value)},onFocus:()=>i.light(),className:"flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]",placeholder:"#000000"})]})]})]}),c&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Subtext"}),e.jsxs("span",{className:`text-xs ${d.length>120?"text-[#ec1e24] font-medium":d.length>90?"text-yellow-600 dark:text-yellow-500":"text-gray-500 dark:text-[#6B7280]"}`,children:[d.length,"/120"]})]}),e.jsx(Te,{value:d,onChange:x=>{i.light();const U=x.target.value;U.length<=150&&S(U)},placeholder:"Enter subtext (optional)...",rows:3,className:"bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] resize-none"}),d.length>120&&e.jsx("p",{className:"text-xs text-[#ec1e24] mt-1",children:"⚠️ Exceeds recommended limit (may use smaller font)"}),d.length>90&&d.length<=120&&e.jsx("p",{className:"text-xs text-yellow-600 dark:text-yellow-500 mt-1",children:"💡 Medium font size will be used"}),e.jsxs("div",{className:"mt-3",children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Subtext Color"}),e.jsx("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:C.toUpperCase()})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>{i.light(),X(!0)},className:"w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform",style:{backgroundColor:C},title:C}),e.jsx("input",{type:"text",value:C,onChange:x=>{i.light(),M(x.target.value)},onFocus:()=>i.light(),className:"flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]",placeholder:"#000000"})]})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-gray-900 dark:text-white mb-2 block",children:"Background Image"}),e.jsx("div",{className:"mb-3",children:e.jsxs("label",{className:"block",children:[e.jsx("input",{type:"file",accept:"image/*",onChange:Ye,className:"hidden"}),e.jsxs("div",{className:"border border-gray-200 dark:border-[#333333] rounded-lg p-4 text-center cursor-pointer hover:border-[#ec1e24] transition-colors",children:[e.jsx(Re,{className:"w-6 h-6 text-gray-400 dark:text-[#666666] mx-auto mb-2"}),e.jsx("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF]",children:"Upload from device"})]})]})}),e.jsxs("div",{className:"mb-3",children:[e.jsxs("div",{className:"flex gap-2",children:[e.jsx(K,{value:A,onChange:x=>{i.light(),J(x.target.value)},onKeyDown:x=>{x.key==="Enter"&&Ne()},placeholder:"Search TMDb for movie/TV...",className:"flex-1 bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929]"}),e.jsx($,{onClick:Ne,disabled:ne||!A.trim(),className:"bg-[#ec1e24] hover:bg-[#d01a20] text-white",children:"Search"})]}),I.length>0&&e.jsx("div",{className:"mt-3 space-y-2 max-h-48 overflow-y-auto",children:I.map(x=>e.jsxs("div",{className:"space-y-2",children:[e.jsx("p",{className:"text-sm text-gray-900 dark:text-white",children:x.title}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsxs("button",{onClick:()=>Se(x.backdrop),className:"relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors",children:[e.jsx("img",{src:x.backdrop,alt:"Backdrop",className:"w-full h-full object-cover"}),e.jsx("div",{className:"absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded",children:"Backdrop"})]}),e.jsxs("button",{onClick:()=>Se(x.poster),className:"relative aspect-[2/3] rounded-lg overflow-hidden border-2 border-transparent hover:border-[#ec1e24] transition-colors",children:[e.jsx("img",{src:x.poster,alt:"Poster",className:"w-full h-full object-cover"}),e.jsx("div",{className:"absolute bottom-1 left-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded",children:"Poster"})]})]})]},x.id))})]}),B&&e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"relative rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]",children:[e.jsx("button",{onClick:()=>{i.light(),Z(!0)},className:"w-full",children:e.jsx("img",{src:B,alt:"Selected background",className:"w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"})}),e.jsx("button",{onClick:()=>{i.light(),h(""),ie(null),E({x:50,y:50}),z(1)},className:"absolute top-2 right-2 p-1 bg-black/70 rounded-full hover:bg-black transition-colors",children:e.jsx(he,{className:"w-4 h-4 text-white"})})]}),e.jsxs("div",{className:"bg-white dark:bg-black rounded-lg p-4 space-y-3",children:[e.jsx("p",{className:"text-sm text-gray-900 dark:text-white",children:"Adjust Composition"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Reposition the image to ensure your subject is properly framed"}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Horizontal Position"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[D.x,"%"]})]}),e.jsx("input",{type:"range",min:"0",max:"100",value:D.x,onChange:x=>{i.light(),E({...D,x:Number(x.target.value)})},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"Left"}),e.jsx("span",{children:"Center"}),e.jsx("span",{children:"Right"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Vertical Position"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[D.y,"%"]})]}),e.jsx("input",{type:"range",min:"0",max:"100",value:D.y,onChange:x=>{i.light(),E({...D,y:Number(x.target.value)})},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"Top"}),e.jsx("span",{children:"Center"}),e.jsx("span",{children:"Bottom"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Zoom"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[Math.round(R*100),"%"]})]}),e.jsx("input",{type:"range",min:"0.5",max:"2",step:"0.1",value:R,onChange:x=>{i.light(),z(Number(x.target.value))},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"50%"}),e.jsx("span",{children:"100%"}),e.jsx("span",{children:"200%"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Composition Preview"}),e.jsxs("div",{className:`relative ${Ce()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`,children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:`url(${B})`,backgroundSize:`${R*100}%`,backgroundPosition:`${D.x}% ${D.y}%`,backgroundRepeat:"no-repeat"}}),e.jsx("div",{className:"absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded",children:"Live Preview"})]})]}),e.jsx($,{onClick:()=>{i.light(),E({x:50,y:50}),z(1),k.success("Composition reset to defaults")},variant:"outline",size:"sm",className:"w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs",children:"Reset to Center"})]})]})]}),g&&e.jsxs("div",{children:[e.jsx(F,{className:"text-gray-900 dark:text-white mb-2 block",children:"Text Overlay Settings"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Adjust the gradient overlay to ensure your text is readable"}),e.jsxs("div",{className:"bg-white dark:bg-black rounded-lg p-4 space-y-3",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Overlay Color"}),e.jsx("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:H.toUpperCase()})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("button",{onClick:()=>{i.light(),L(!0)},className:"w-12 h-12 rounded-lg border border-gray-200 dark:border-[#333333] cursor-pointer hover:scale-105 transition-transform",style:{backgroundColor:H},title:H}),e.jsx("input",{type:"text",value:H,onChange:x=>{i.light(),Q(x.target.value)},onFocus:()=>i.light(),className:"flex-1 px-4 py-2 bg-white dark:bg-black border border-gray-200 dark:border-[#333333] rounded-xl text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#292929]",placeholder:"#000000"})]})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Overlay Strength"}),e.jsxs("span",{className:"text-xs text-gray-600 dark:text-[#6B7280]",children:[G,"%"]})]}),e.jsx("input",{type:"range",min:"0",max:"100",value:G,onChange:x=>{i.light(),m(Number(x.target.value))},className:"w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#ec1e24]"}),e.jsxs("div",{className:"flex justify-between text-xs text-gray-500 dark:text-[#6B7280] mt-1",children:[e.jsx("span",{children:"Transparent"}),e.jsx("span",{children:"Subtle"}),e.jsx("span",{children:"Strong"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Gradient Position"}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsx($,{onClick:()=>{i.light(),b("top")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${p==="top"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Top"}),e.jsx($,{onClick:()=>{i.light(),b("bottom")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${p==="bottom"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Bottom"}),e.jsx($,{onClick:()=>{i.light(),b("left")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${p==="left"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Left"}),e.jsx($,{onClick:()=>{i.light(),b("right")},variant:"outline",size:"sm",className:`w-full border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white text-xs ${p==="right"?"bg-[#ec1e24] border-[#ec1e24] text-white hover:bg-[#ec1e24] hover:text-white dark:bg-[#ec1e24] dark:text-white dark:hover:bg-[#ec1e24]":"bg-white dark:bg-[#000000] hover:bg-gray-50 dark:hover:bg-[#000000]"}`,children:"Right"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Overlay Preview"}),e.jsxs("div",{className:`relative ${Ce()} rounded-lg overflow-hidden border border-gray-200 dark:border-[#333333]`,children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:B?`url(${B})`:"linear-gradient(135deg, #667eea 0%, #764ba2 100%)",backgroundSize:B?`${R*100}%`:"cover",backgroundPosition:B?`${D.x}% ${D.y}%`:"center",backgroundRepeat:"no-repeat"}}),e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:`linear-gradient(${{top:"to bottom",bottom:"to top",left:"to right",right:"to left"}[p]||"to bottom"}, ${H}${Math.round(G*2.55).toString(16).padStart(2,"0")} 0%, transparent 100%)`}}),e.jsx("div",{className:"absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded",children:"Live Preview"})]})]}),e.jsx($,{onClick:()=>{i.light(),Q("#000000"),m(70),b("top"),k.success("Overlay reset to defaults")},variant:"outline",size:"sm",className:"w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#000000] text-xs",children:"Reset Overlay"})]})]}),e.jsxs("div",{children:[e.jsx(F,{className:"text-gray-900 dark:text-white mb-2 block",children:"Social Media Caption"}),e.jsx("p",{className:"text-xs text-gray-600 dark:text-[#9CA3AF] mb-3",children:"Generate AI-powered captions for your design"}),e.jsxs("div",{className:"bg-white dark:bg-black rounded-lg p-4 space-y-3",children:[e.jsxs("div",{children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF] mb-2 block",children:"Content Type"}),e.jsxs(rt,{value:W,onValueChange:x=>{i.light(),qe(x)},children:[e.jsx(st,{className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white",children:e.jsx(ot,{})}),e.jsxs(it,{children:[e.jsx(ae,{value:"poster",children:"Poster/Announcement"}),e.jsx(ae,{value:"carousel",children:"Carousel Post"}),e.jsx(ae,{value:"story",children:"Story (Vertical)"}),e.jsx(ae,{value:"announcement",children:"Breaking News"}),e.jsx(ae,{value:"general",children:"General Content"})]})]}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-2",children:"Select the type of content to customize caption style"})]}),e.jsxs($,{onClick:async()=>{if(!v.trim()){k.error("Add header text first to generate caption");return}i.medium(),je(!0);try{const x=await It({contentType:W,title:v,tagline:d,context:s});we(x.caption),k.success(`Caption generated! (${x.charCount} characters)`),i.success()}catch(x){k.error("Failed to generate caption"),console.error("Caption generation error:",x)}finally{je(!1)}},disabled:ke||!v.trim(),variant:"outline",className:"w-full bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#1A1A1A]",children:[e.jsx(nt,{className:"w-4 h-4 mr-2"}),ke?"Generating...":"Generate Caption with AI"]}),q&&e.jsxs("div",{children:[e.jsxs("div",{className:"flex justify-between items-center mb-2",children:[e.jsx(F,{className:"text-xs text-gray-700 dark:text-[#9CA3AF]",children:"Generated Caption"}),e.jsxs("span",{className:`text-xs ${q.length>280?"text-[#ec1e24]":q.length>250?"text-yellow-600 dark:text-yellow-500":"text-gray-500 dark:text-[#6B7280]"}`,children:[q.length,"/280"]})]}),e.jsx(Te,{value:q,onChange:x=>{i.light(),we(x.target.value)},placeholder:"Generated caption will appear here...",rows:6,className:"bg-white dark:bg-black border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#292929] resize-none"}),e.jsx("p",{className:"text-xs text-gray-500 dark:text-[#6B7280] mt-2",children:"You can edit the caption before saving"})]})]})]})]})}),e.jsx(ye,{children:e.jsxs("div",{className:"flex gap-3 w-full",children:[e.jsx($,{onClick:Je,variant:"outline",className:"flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]",children:"Cancel"}),e.jsx($,{onClick:Ke,disabled:f||!v.trim(),className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50",children:f?"Rendering...":"Save & Render"})]})})]}),B&&e.jsx(Me,{open:V,onOpenChange:Z,children:e.jsxs(ze,{className:"max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none",hideCloseButton:!0,children:[e.jsxs(He,{children:[e.jsx(Ue,{children:"Background Image Preview"}),e.jsx(Ve,{children:"Full size preview of selected background image"})]}),e.jsxs("div",{className:"relative",children:[e.jsx("button",{onClick:()=>{i.light(),Z(!1)},className:"absolute top-4 right-4 z-50 bg-black/80 text-white p-2 rounded-full hover:bg-black transition-colors",children:e.jsx(he,{className:"w-6 h-6"})}),e.jsx("img",{src:B,alt:"Selected background",className:"w-full h-auto max-h-[90vh] object-contain rounded-lg"})]})]})}),e.jsx(ce,{isOpen:j,onClose:()=>L(!1),currentColor:H,onColorSelect:x=>{i.light(),Q(x)}}),e.jsx(ce,{isOpen:O,onClose:()=>N(!1),currentColor:w,onColorSelect:x=>{i.light(),P(x)}}),e.jsx(ce,{isOpen:T,onClose:()=>X(!1),currentColor:C,onColorSelect:x=>{i.light(),M(x)}})]})}const Ot={x:"x",threads:"threads",facebook:"facebook",youtube:"youtube",instagram:"instagram",pinterest:"pinterest",tiktok:"tiktok"},Be=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];function Et({selectedPlatforms:r,onTimeSelect:t,className:s=""}){const[o,a]=n.useState(!1),[c,g]=n.useState([]);n.useEffect(()=>{const y=[];for(const d of r){const S=Ot[d];if(!S)continue;const w=Ft.getOptimalPostTime(S);if(w){const P=w.hour,C=P>=12?"PM":"AM",M=P===0?12:P>12?P-12:P;y.push({platform:d,hour:w.hour,dayOfWeek:w.dayOfWeek,confidence:w.confidence,formattedTime:`${M}:00 ${C}`})}}g(y)},[r]);const u=n.useMemo(()=>c.length===0?null:c.reduce((d,S)=>S.confidence>d.confidence?S:d),[c]),l=n.useMemo(()=>{if(!u)return null;const y=new Date,d=u.hour,S=u.dayOfWeek,w=new Date(y);w.setHours(d,0,0,0);const P=y.getDay();let C=S-P;return(C<0||C===0&&y.getHours()>=d)&&(C+=7),w.setDate(w.getDate()+C),w},[u]),f=()=>{l&&t&&t(l)};if(r.length===0||c.length===0)return null;const v=c.reduce((y,d)=>y+d.confidence,0)/c.length;return e.jsxs("div",{className:`rounded-lg border border-gray-200 dark:border-[#333333] overflow-hidden ${s}`,children:[e.jsxs("button",{onClick:()=>a(!o),className:"w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"p-1.5 rounded-full bg-[#ec1e24]/10",children:e.jsx(Ct,{className:"w-3.5 h-3.5 text-[#ec1e24]"})}),e.jsxs("div",{className:"text-left",children:[e.jsx("span",{className:"text-sm font-medium text-gray-900 dark:text-white",children:"Optimal Posting Time"}),u&&e.jsxs("span",{className:"ml-2 text-xs text-[#ec1e24]",children:[u.formattedTime," (",Be[u.dayOfWeek].slice(0,3),")"]})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[v>=.5&&e.jsxs("span",{className:"text-xs px-2 py-0.5 rounded-full bg-[#ec1e24]/10 text-[#ec1e24]",children:[Math.round(v*100),"% confident"]}),o?e.jsx(kt,{className:"w-4 h-4 text-gray-500 dark:text-[#6B7280]"}):e.jsx(lt,{className:"w-4 h-4 text-gray-500 dark:text-[#6B7280]"})]})]}),o&&e.jsxs("div",{className:"px-4 py-3 bg-white dark:bg-[#0a0a0a] space-y-3 border-t border-gray-200 dark:border-[#333333]",children:[e.jsxs("div",{className:"space-y-2",children:[e.jsxs("p",{className:"text-xs text-gray-500 dark:text-[#9CA3AF] flex items-center gap-1",children:[e.jsx(jt,{className:"w-3 h-3"}),"Based on your analytics data"]}),e.jsx("div",{className:"grid gap-2",children:c.map(y=>e.jsxs("div",{className:"flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-[#111111]",children:[e.jsx("span",{className:"text-gray-700 dark:text-gray-300 capitalize",children:y.platform}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(Le,{className:"w-3.5 h-3.5 text-gray-400 dark:text-[#6B7280]"}),e.jsx("span",{className:"text-gray-900 dark:text-white font-medium",children:y.formattedTime}),e.jsx("span",{className:"text-xs text-gray-500 dark:text-[#9CA3AF]",children:Be[y.dayOfWeek].slice(0,3)}),e.jsxs("span",{className:`text-xs px-1.5 py-0.5 rounded ${y.confidence>=.7?"bg-[#ec1e24]/10 text-[#ec1e24]":y.confidence>=.4?"bg-gray-200 dark:bg-[#333333] text-gray-600 dark:text-gray-400":"bg-gray-100 dark:bg-[#222222] text-gray-500 dark:text-[#6B7280]"}`,children:[Math.round(y.confidence*100),"%"]})]})]},y.platform))})]}),t&&l&&e.jsxs("button",{onClick:f,className:"w-full py-2.5 rounded-lg bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2",children:[e.jsx(Le,{className:"w-4 h-4"}),"Schedule for ",l.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})," at ",u?.formattedTime]}),e.jsx("p",{className:"text-xs text-gray-400 dark:text-[#6B7280] text-center",children:"Recommendations improve as more posts are analyzed"})]})]})}function $t({open:r,onOpenChange:t,title:s="Publish",description:o="Select platforms and customize your caption",initialCaption:a="",onPublish:c,onCaptionGenerate:g,isGeneratingCaption:u=!1}){const[l,f]=n.useState(a),[v,y]=n.useState(!1),[d,S]=n.useState({x:!1,threads:!1,facebook:!1,youtube:!1,instagram:!1,pinterest:!1}),[w,P]=n.useState(""),[C,M]=n.useState(""),[B,h]=n.useState(""),[D,E]=n.useState("");n.useEffect(()=>{if(r&&!l&&g){const I=g();f(I)}},[r,l,g]),n.useEffect(()=>{a&&f(a)},[a]);const R=n.useMemo(()=>Object.entries(d).filter(([,I])=>I).map(([I])=>I),[d]),z=()=>{if(i.light(),g){const I=g();f(I),y(!1)}},A=()=>{i.medium(),c&&c(l,d),t(!1),f(""),y(!1)},J=()=>{i.light(),t(!1),f(""),y(!1)};return e.jsxs(ge,{open:r,onOpenChange:t,children:[e.jsxs(me,{children:[e.jsx(xe,{className:"text-gray-900 dark:text-white",children:s}),e.jsx(Ge,{className:"text-[#6B7280] dark:text-[#9CA3AF]",children:o})]}),e.jsxs(pe,{children:[e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Social Media Caption"}),g&&e.jsx("button",{onClick:z,disabled:u,className:"text-sm text-black dark:text-white hover:opacity-70 disabled:opacity-50 flex items-center gap-1",children:e.jsx(ct,{className:`w-3.5 h-3.5 ${u?"animate-spin":""}`})})]}),e.jsxs("div",{className:"relative",children:[e.jsx("textarea",{value:l,onFocus:()=>{i.light()},onChange:I=>{i.light(),f(I.target.value),y(!0)},placeholder:u?"Generating caption...":"Caption will appear here",disabled:u,className:"w-full min-h-[120px] px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#ec1e24] transition-colors resize-none disabled:opacity-50"}),e.jsxs("div",{className:"absolute bottom-2 right-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:[l.length," chars"]})]}),v&&e.jsxs("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1",children:[e.jsx(_e,{className:"w-3 h-3"}),"Caption edited manually"]})]}),e.jsx(Fe,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsxs("div",{className:"space-y-3 pt-4",children:[e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Select Platforms"}),e.jsx("div",{className:"flex justify-center",children:e.jsxs("div",{className:"grid grid-cols-3 gap-3 max-w-fit",children:[e.jsx("button",{onClick:()=>{i.light(),S({...d,x:!d.x})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${d.x?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"X",children:e.jsx(dt,{className:"w-4 h-4"})}),e.jsx("button",{onClick:()=>{i.light(),S({...d,threads:!d.threads})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${d.threads?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Threads",children:e.jsx(ut,{className:"w-5 h-5"})}),e.jsx("button",{onClick:()=>{i.light(),S({...d,facebook:!d.facebook})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${d.facebook?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Facebook",children:e.jsx(ht,{className:"w-5.5 h-5.5"})}),e.jsx("button",{onClick:()=>{i.light(),S({...d,youtube:!d.youtube})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${d.youtube?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"YouTube",children:e.jsx(gt,{className:"w-6 h-6"})}),e.jsx("button",{onClick:()=>{i.light(),S({...d,instagram:!d.instagram})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${d.instagram?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Instagram",children:e.jsx(mt,{className:"w-5.5 h-5.5"})}),e.jsx("button",{onClick:()=>{i.light(),S({...d,pinterest:!d.pinterest})},className:`flex items-center justify-center w-14 h-14 rounded-lg transition-all ${d.pinterest?"bg-[#ec1e24]/10 border-2 border-[#ec1e24]":"bg-gray-100 dark:bg-[#111111] border-2 border-transparent opacity-40"}`,title:"Pinterest",children:e.jsx(xt,{className:"w-5.5 h-5.5"})})]})})]}),e.jsx(Et,{selectedPlatforms:R,className:"mt-4"}),d.pinterest&&e.jsxs("div",{className:"space-y-3 pt-4",children:[e.jsx(Fe,{className:"bg-gray-200 dark:bg-[#1F1F1F]"}),e.jsx(F,{className:"text-gray-900 dark:text-white",children:"Pinterest Details"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:"Pinterest requires structured content for better discovery"}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Title (100 chars max)"}),e.jsx(K,{type:"text",value:w,onFocus:()=>i.light(),onChange:I=>{i.light(),P(I.target.value)},placeholder:"e.g., The Batman (2025) - Official Movie Trailer",maxLength:100,className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"}),e.jsxs("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:[w.length,"/100 characters"]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Description (500 chars max)"}),e.jsx("textarea",{value:C,onFocus:()=>i.light(),onChange:I=>{i.light(),M(I.target.value)},placeholder:"e.g., The Batman returns in 2025! Matt Reeves' epic sequel...",maxLength:500,rows:4,className:"w-full px-4 py-3 bg-white dark:bg-[#000000] border border-gray-200 dark:border-[#333333] rounded-lg text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:border-[#292929] transition-colors resize-none"}),e.jsxs("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:[C.length,"/500 characters"]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Link URL (Required)"}),e.jsx(K,{type:"url",value:B,onFocus:()=>i.light(),onChange:I=>{i.light(),h(I.target.value)},placeholder:"https://youtube.com/watch?v=...",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(F,{className:"text-[#6B7280] dark:text-[#9CA3AF] text-sm",children:"Board Name (Required)"}),e.jsx(K,{type:"text",value:D,onFocus:()=>i.light(),onChange:I=>{i.light(),E(I.target.value)},placeholder:"e.g., Movies & TV Shows",className:"bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white focus:border-[#292929]"}),e.jsx("p",{className:"text-xs text-[#6B7280] dark:text-[#9CA3AF]",children:"Must match an existing board on your Pinterest account"})]})]})]}),e.jsx(ye,{children:e.jsxs("div",{className:"flex gap-3 w-full",children:[e.jsx($,{onClick:J,variant:"outline",className:"flex-1 border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]",children:"Cancel"}),e.jsx($,{onClick:A,className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white shadow-none hover:shadow-none active:shadow-none focus:shadow-none hover:scale-100 active:scale-100",children:"Publish"})]})})]})}function Rt({open:r,onSelectTemplate:t,onClose:s}){const[o,a]=n.useState(!1),[c,g]=n.useState([]),[u,l]=n.useState([]),[f,v]=n.useState(""),[y,d]=n.useState(null);n.useEffect(()=>{r&&(S(),v(""),d(null))},[r]),n.useEffect(()=>{if(f.trim()){const h=c.filter(D=>D.fileName.toLowerCase().includes(f.toLowerCase()));l(h)}else l(c)},[f,c]);const S=async()=>{a(!0),i.light();try{const h=await Nt();if(h.success&&h.files)g(h.files),l(h.files),h.files.length===0?k.info("No templates found",{description:"Upload PSD templates to your Backblaze Design bucket first"}):(i.success(),k.success(`Found ${h.files.length} template${h.files.length>1?"s":""}`,{description:"Select one to load into Design Studio"}));else throw new Error(h.error||"Failed to load templates")}catch(h){i.error(),k.error("Failed to load Backblaze templates",{description:h instanceof Error?h.message:"Check your credentials"})}finally{a(!1)}},w=h=>{d(h),i.light()},P=()=>{y&&(i.success(),t(y),k.success("Template loaded from Backblaze",{description:y.fileName}),s())},C=h=>{const D=["B","KB","MB","GB"];if(h===0)return"0 B";const E=Math.floor(Math.log(h)/Math.log(1024));return`${(h/Math.pow(1024,E)).toFixed(1)} ${D[E]}`},M=h=>new Date(h).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}),B=h=>h.replace(/^design-studio\/templates\//,"").replace(/^templates\//,"").replace(/\.psd$/i,"");return e.jsxs(ge,{open:r,onOpenChange:s,heightMode:"full",children:[e.jsx(me,{children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx(Qe,{className:"w-7 h-7 text-[#ec1e24]"}),e.jsxs("div",{children:[e.jsx(xe,{children:"Backblaze B2 Templates"}),e.jsx(Ge,{children:"Select a PSD template from your cloud storage"})]})]})}),e.jsxs(pe,{className:"flex flex-col gap-4 flex-1 overflow-hidden",children:[e.jsxs("div",{className:"relative",children:[e.jsx(pt,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"}),e.jsx(K,{value:f,onChange:h=>{i.light(),v(h.target.value)},onFocus:()=>i.light(),placeholder:"Search templates by filename...",className:"pl-10 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] focus:border-[#292929] dark:focus:border-[#292929]",disabled:o})]}),e.jsx("div",{className:"flex-1 overflow-y-auto -mx-6 px-6",children:o?e.jsxs("div",{className:"flex flex-col items-center justify-center py-12",children:[e.jsx(yt,{className:"w-12 h-12 text-[#ec1e24] animate-spin mb-4"}),e.jsx("p",{className:"text-gray-600 dark:text-gray-400",children:"Loading templates from Backblaze..."})]}):u.length===0?e.jsxs("div",{className:"text-center py-12",children:[e.jsx("p",{className:"text-gray-500 dark:text-gray-400 mb-2",children:f?"No templates match your search":"No templates found"}),e.jsx("p",{className:"text-sm text-gray-400 dark:text-gray-500",children:!f&&"Upload PSD templates to your Backblaze Design bucket to see them here"})]}):e.jsx("div",{className:"space-y-2",children:u.map(h=>e.jsx("button",{onClick:()=>w(h),className:`
                    w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                    ${y?.fileId===h.fileId?"border-[#ec1e24] bg-red-50 dark:bg-red-900/10":"border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-gray-600"}
                  `,children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx("div",{className:`
                      flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                      ${y?.fileId===h.fileId?"bg-[#ec1e24] text-white":"bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}
                    `,children:y?.fileId===h.fileId?e.jsx(_e,{className:"w-5 h-5"}):e.jsx(Tt,{className:"w-5 h-5"})}),e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsx("p",{className:"text-gray-900 dark:text-white truncate mb-1",children:B(h.fileName)}),e.jsxs("div",{className:"flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400",children:[e.jsx("span",{children:C(h.contentLength)}),e.jsx("span",{children:"•"}),e.jsx("span",{children:M(h.uploadTimestamp)})]})]})]})},h.fileId))})})]}),e.jsxs(ye,{children:[e.jsx($,{onClick:s,variant:"outline",className:"flex-1 bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-[#111111]",children:"Cancel"}),e.jsx($,{onClick:P,disabled:!y,className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white disabled:opacity-50",children:"Load Template"})]})]})}function Mt({templatePreviewUrl:r,designData:t,aspectRatio:s}){if(!t)return e.jsx("img",{src:r,alt:"Template preview",className:"w-full h-full object-cover"});const{backgroundImage:o,imageFocalPoint:a={x:50,y:50},imageZoom:c=1,overlayColor:g="#000000",overlayOpacity:u=70,gradientPosition:l="top",headerText:f="",subtext:v=""}=t,y=a.x,d=a.y,S=`${c*100}%`,w=Math.round(u*2.55).toString(16).padStart(2,"0"),C={top:"to bottom",bottom:"to top",left:"to right",right:"to left"}[l]||"to bottom";return e.jsxs("div",{className:"relative w-full h-full overflow-hidden",children:[e.jsx("div",{className:"absolute inset-0",style:{backgroundImage:o?`url(${o})`:`url(${r})`,backgroundSize:S,backgroundPosition:`${y}% ${d}%`,backgroundRepeat:"no-repeat"}}),e.jsx("div",{className:"absolute inset-0",style:{background:`linear-gradient(${C}, ${g}${w} 0%, transparent 100%)`}}),e.jsxs("div",{className:"absolute inset-0 flex flex-col justify-start items-center p-6 pt-12",children:[f&&e.jsx("h2",{className:"text-white text-center mb-2",style:{textShadow:"0 2px 8px rgba(0,0,0,0.5)",fontSize:s==="9:16"?"1.5rem":"1.25rem",lineHeight:"1.2"},children:f}),v&&e.jsx("p",{className:"text-white/90 text-center text-sm",style:{textShadow:"0 2px 4px rgba(0,0,0,0.4)"},children:v})]})]})}function zt({template:r,onDelete:t,onEdit:s,onExpand:o,livePreviewData:a,isBeingEdited:c}){const[g,u]=n.useState(0),[l,f]=n.useState(!1),[v,y]=n.useState("none"),d=n.useRef(0),S=n.useRef(0),w=n.useRef(0),P=n.useRef(0),C=h=>{d.current=h.touches[0].clientX,S.current=h.touches[0].clientY,y("none")},M=h=>{w.current=h.touches[0].clientX,P.current=h.touches[0].clientY;const D=Math.abs(w.current-d.current),E=Math.abs(P.current-S.current);if(v==="none"&&(D>10||E>10)&&(D>E*1.5?(y("horizontal"),f(!0)):y("vertical")),v==="horizontal"){h.stopPropagation(),h.preventDefault();const R=w.current-d.current;if(R<=0){const z=Math.max(-120,R);u(z)}}},B=()=>{v==="horizontal"&&g<-90&&(i.medium(),t(r.id)),f(!1),y("none"),u(0)};return e.jsxs("div",{className:"relative overflow-hidden rounded-2xl",children:[e.jsx("div",{className:"absolute inset-0 flex justify-end items-center bg-[#ec1e24] rounded-2xl",children:e.jsx("div",{className:"flex items-center justify-center px-6 text-white transition-opacity h-full",style:{opacity:g<0?1:0,width:"120px"},children:e.jsxs("div",{className:"flex flex-col items-center gap-1",children:[e.jsx(Pe,{className:"w-5 h-5"}),e.jsx("span",{className:"text-xs whitespace-nowrap",children:"Delete"})]})})}),e.jsxs("div",{className:"bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] overflow-hidden hover:border-[#ec1e24] transition-all group relative",style:{transform:`translateX(${g}px)`,transition:l?"none":"transform 0.3s ease-out"},onTouchStart:C,onTouchMove:M,onTouchEnd:B,children:[e.jsxs("div",{className:"relative w-full aspect-video bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden",children:[e.jsx("button",{onClick:h=>{h.stopPropagation(),i.medium(),t(r.id)},className:"hidden lg:block absolute bottom-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 dark:text-gray-400 hover:text-[#ec1e24] dark:hover:text-[#ec1e24]","aria-label":"Delete template",children:e.jsx(Pe,{className:"w-4 h-4"})}),e.jsxs("button",{onClick:()=>o(r),className:"absolute inset-0 w-full h-full",children:[c&&a?e.jsx(Mt,{templatePreviewUrl:r.previewUrl,designData:a,aspectRatio:r.aspectRatio}):e.jsx("img",{src:r.previewUrl,alt:r.name,className:"w-full h-full object-cover"}),e.jsx("div",{className:"absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center",children:e.jsx(ft,{className:"w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"})})]}),e.jsx("div",{className:"absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur-sm rounded text-xs text-white pointer-events-none",children:r.aspectRatio}),c&&e.jsxs("div",{className:"absolute top-3 left-3 px-2 py-1 bg-[#ec1e24] backdrop-blur-sm rounded text-xs text-white flex items-center gap-1 pointer-events-none",children:[e.jsx("div",{className:"w-2 h-2 bg-white rounded-full animate-pulse"}),"Live Preview"]})]}),e.jsxs("div",{className:"p-4",children:[e.jsx("h3",{className:"text-gray-900 dark:text-white mb-1 truncate",children:r.name}),e.jsxs("p",{className:"text-sm text-gray-600 dark:text-[#9CA3AF] mb-3 capitalize",children:[r.source," · ",r.width,"×",r.height]}),e.jsx("div",{className:"flex gap-2",children:e.jsx($,{onClick:()=>s(r),className:"flex-1 bg-[#ec1e24] hover:bg-[#d01a20] text-white text-sm",size:"sm",children:"Edit"})})]})]})]})}function Xe(r){const t=r.replace("#",""),s=parseInt(t.substring(0,2),16),o=parseInt(t.substring(2,4),16),a=parseInt(t.substring(4,6),16);return{r:s,g:o,b:a}}function Ht(r,t,s,o,a,c){const g=a*t,u=c*t,l=r.x/100*g,f=r.y/100*u,v=s/2-l,y=o/2-f;return{translateX:v,translateY:y,scale:t}}function We(r){return`
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

var targetLayer = findLayerByPattern(${JSON.stringify(r)});
`}function Oe(r,t,s){const o=s?Xe(s):null;return`
${We(r)}

if (targetLayer && targetLayer.kind === LayerKind.TEXT) {
  targetLayer.textItem.contents = ${JSON.stringify(t)};
  
  ${o?`
  var textColor = new SolidColor();
  textColor.rgb.red = ${o.r};
  textColor.rgb.green = ${o.g};
  textColor.rgb.blue = ${o.b};
  targetLayer.textItem.color = textColor;
  `:""}
} else {
  // Layer not found or not a text layer
  var errorMsg = targetLayer ? "Layer found but not text type" : "Layer not found";
  // Continue execution - non-critical error
}
`}function Ut(r,t,s){return`
${We(r)}

if (targetLayer) {
  // Store original bounds
  var originalBounds = targetLayer.bounds;
  var docWidth = app.activeDocument.width.value;
  var docHeight = app.activeDocument.height.value;
  
  try {
    // Method 1: Try Smart Object replacement
    if (targetLayer.kind === LayerKind.SMARTOBJECT) {
      // Open new image
      var imageFile = ${JSON.stringify(t)};
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
      var imageFile = ${JSON.stringify(t)};
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
    
    ${s?`
    // Apply transforms
    var scale = ${s.scale};
    var translateX = ${s.translateX};
    var translateY = ${s.translateY};
    
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
`}function Vt(r,t,s,o){const a=Xe(t);return`
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
var activeOverlay = overlays["${o}"];

if (activeOverlay) {
  activeOverlay.visible = true;
  activeOverlay.opacity = ${s};
  
  // Apply color to solid color adjustment layer
  try {
    // Method 1: Try solid color fill layer
    if (activeOverlay.kind === LayerKind.SOLIDFILL) {
      var solidColor = new SolidColor();
      solidColor.rgb.red = ${a.r};
      solidColor.rgb.green = ${a.g};
      solidColor.rgb.blue = ${a.b};
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
      descRGB.putDouble(charIDToTypeID("Rd  "), ${a.r});
      descRGB.putDouble(charIDToTypeID("Grn "), ${a.g});
      descRGB.putDouble(charIDToTypeID("Bl  "), ${a.b});
      descColor.putObject(idClr, charIDToTypeID("RGBC"), descRGB);
      desc.putObject(idT, charIDToTypeID("SoFi"), descColor);
      
      executeAction(idsetd, desc, DialogModes.NO);
    }
  } catch (e) {
    // Fallback: just adjust opacity
    activeOverlay.opacity = ${s};
  }
}
`}
`}function Gt(r,t){const s=[];if(r.headerText&&s.push(Oe(["header","title","headline","main"],r.headerText,r.headerTextColor)),t.hasSubtext&&r.subtext&&s.push(Oe(["subtext","subtitle","description","caption","body"],r.subtext,r.subtextColor)),r.backgroundImage){let o;(r.imageFocalPoint||r.imageZoom)&&(o=Ht(r.imageFocalPoint||{x:50,y:50},r.imageZoom||1,t.width,t.height,t.width,t.height)),s.push(Ut(["background","image","photo","artwork","bg"],r.backgroundImage,o))}return t.hasOverlay&&r.overlayColor&&r.overlayOpacity!==void 0&&s.push(Vt(!0,r.overlayColor,r.overlayOpacity,r.gradientPosition||"top")),s.push(`
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
`),s.join(`

`)}function _t(){return`
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
`}class Qt{iframe=null;messageQueue=[];isReady=!1;async initialize(){if(!this.iframe)return new Promise((t,s)=>{try{this.iframe=document.createElement("iframe"),this.iframe.style.display="none",this.iframe.style.position="fixed",this.iframe.style.top="-9999px",this.iframe.style.left="-9999px",this.iframe.style.width="1px",this.iframe.style.height="1px",this.iframe.src="https://www.photopea.com",this.iframe.onerror=()=>{console.error("[Photopea] Failed to load iframe"),this.cleanup(),s(new Error("Failed to load Photopea. Please check your internet connection."))},document.body.appendChild(this.iframe);let o=0;const a=20,c=setInterval(()=>{if(o++,o>=a){clearInterval(c),this.cleanup(),s(new Error("Photopea initialization timed out. Please try again."));return}try{this.iframe?.contentWindow&&(this.isReady=!0,clearInterval(c),this.setupMessageListener(),console.log("[Photopea] Initialized successfully"),t())}catch{}},1e3)}catch(o){this.cleanup();const a=o instanceof Error?o.message:"Unknown error";s(new Error(`Photopea initialization failed: ${a}`))}})}cleanup(){this.iframe&&this.iframe.parentNode&&this.iframe.parentNode.removeChild(this.iframe),this.iframe=null,this.isReady=!1,this.messageQueue=[]}setupMessageListener(){window.addEventListener("message",t=>{if(t.source!==this.iframe?.contentWindow)return;const s=t.data;if(this.messageQueue.length>0){const o=this.messageQueue[0];s.done?(o.resolve(s.result||null),this.messageQueue.shift(),this.messageQueue.length>0&&this.executeNextInQueue()):s.error&&(o.reject(new Error(s.error)),this.messageQueue.shift(),this.messageQueue.length>0&&this.executeNextInQueue())}})}executeNextInQueue(){if(this.messageQueue.length===0)return;const{script:t}=this.messageQueue[0];this.iframe?.contentWindow&&this.iframe.contentWindow.postMessage(t,"*")}async executeScript(t){return(!this.isReady||!this.iframe)&&await this.initialize(),new Promise((s,o)=>{this.messageQueue.push({script:t,resolve:s,reject:o}),this.messageQueue.length===1&&this.executeNextInQueue()})}async loadPSD(t){return this.isReady||await this.initialize(),new Promise((s,o)=>{const a=new FileReader;a.onload=async c=>{const g=c.target?.result,l=`
          var arr = [${new Array.from(new Uint8Array(g)).join(",")}];
          var file = new File(arr, "template.psd");
          app.open(file);
        `;try{await this.executeScript(l),s()}catch(f){o(f)}},a.onerror=()=>o(new Error("Failed to read PSD file")),a.readAsArrayBuffer(t)})}async loadPSDFromURL(t){this.isReady||await this.initialize();const s=`
      app.open("${t}");
    `;await this.executeScript(s)}async analyzeLayers(){const t=_t(),s=await this.executeScript(t);if(!s)throw new Error("Failed to analyze layers");return JSON.parse(s)}async renderDesign(t,s){const o=Gt(t,s);await this.executeScript(o);const c=await this.executeScript(`
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
    `);if(!c)throw new Error("Failed to export image");const g=atob(c),u=new Uint8Array(g.length);for(let l=0;l<g.length;l++)u[l]=g.charCodeAt(l);return new Blob([u],{type:"image/jpeg"})}async getPreview(){return await this.executeScript(`
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
    `)}destroy(){this.iframe&&(document.body.removeChild(this.iframe),this.iframe=null,this.isReady=!1,this.messageQueue=[])}}let de=null;function Ee(){return de||(de=new Qt),de}async function Xt(){const r=await se.get("/api/design-studio/state");if(!r.success||!r.data)throw new Error(r.error?.message||"Failed to load Design Studio state");return r.data}async function Wt(r){const t=await se.put("/api/design-studio/state",r);if(!t.success)throw new Error(t.error?.message||"Failed to save Design Studio state")}async function ue(r,t){const s=await se.uploadFile("/api/design-studio/upload-asset",r,void 0,{folder:t});if(!s.success||!s.data)throw new Error(s.error?.message||"Failed to upload Design Studio asset");return s.data}async function re(r,t){const s=await se.post("/api/design-studio/activity",{type:r,details:t});if(!s.success)throw new Error(s.error?.message||"Failed to save Design Studio activity")}function qt(r){return{...r,lastEdited:new Date(r.lastEdited)}}function Yt(r){return{...r,createdAt:new Date(r.createdAt)}}function Kt(r){return r.map(t=>({...t,lastEdited:t.lastEdited.toISOString()}))}function Jt(r){return r.map(t=>({...t,createdAt:t.createdAt.toISOString()}))}function Zt(r,t){const[s,o]=r.split(",");if(!s||!o)throw new Error("Invalid preview data");const c=s.match(/data:(.*?);base64/)?.[1]||"image/png",g=atob(o),u=new Uint8Array(g.length);for(let l=0;l<g.length;l+=1)u[l]=g.charCodeAt(l);return new File([u],t,{type:c})}function aa({onNavigate:r,previousPage:t}){const{addNotification:s}=bt(),{showUndo:o}=vt(),[a,c]=n.useState([]),[g,u]=n.useState([]),[l,f]=n.useState(null),[v,y]=n.useState(!1),[d,S]=n.useState(null),[w,P]=n.useState(!1),[C,M]=n.useState(!1),[B,h]=n.useState(null),[D,E]=n.useState(null),[R,z]=n.useState(!1),[A,J]=n.useState(null),[I,_]=n.useState(!1),[ne,oe]=n.useState(!0),fe=n.useRef(null);n.useEffect(()=>{let m=!0;return(async()=>{try{const b=await Xt();if(!m)return;c((b.templates||[]).map(qt)),u((b.renderedDesigns||[]).map(Yt))}catch(b){console.error("Failed to load Design Studio state:",b),m&&k.error("Failed to load Design Studio data")}finally{m&&oe(!1)}})(),()=>{m=!1}},[]);const ie=(m,p)=>{const b=(N,T)=>T===0?N:b(T,N%T),j=b(m,p),L=m/j,O=p/j;return L===16&&O===9?"16:9":L===9&&O===16?"9:16":L===1&&O===1?"1:1":L===4&&O===5?"4:5":L===5&&O===4?"5:4":L===3&&O===4?"3:4":L===4&&O===3?"4:3":`${L}:${O}`},V=async(m,p)=>{await Wt({templates:Kt(m),renderedDesigns:Jt(p)})},Z=async m=>{const p=m.target.files?.[0];if(p){if(!p.name.endsWith(".psd")){k.error("Please upload a PSD file");return}i.medium(),k.success("Processing PSD template with Photopea...");try{const b=Ee();await b.initialize(),await b.loadPSD(p);const j=await b.analyzeLayers(),L=await b.getPreview(),O=Zt(L,`${p.name.replace(/\.psd$/i,"")}-preview.png`),[N,T]=await Promise.all([ue(p,"templates"),ue(O,"template-previews")]),X={id:`template-${Date.now()}`,name:p.name.replace(".psd",""),previewUrl:T.url,aspectRatio:ie(j.width,j.height),width:j.width,height:j.height,source:"upload",lastEdited:new Date,hasSubtext:j.detectedLayers.hasSubtext,hasCategory:!1,hasSource:!1,psdData:{layers:j.layers,detectedLayers:j.detectedLayers,b2Url:N.url,fileName:N.fileName,previewFileName:T.fileName}},W=[X,...a];await V(W,g),c(W),await re("template_uploaded",{templateName:X.name}),k.success(`Template "${X.name}" analyzed and uploaded!`),await b.closeDocument()}catch(b){console.error("Photopea analysis error:",b),k.error(b instanceof Error?b.message:"Failed to process PSD template")}finally{m.target.value=""}}},be=async()=>{i.medium(),_(!0)},ve=async m=>{const p=m.map(j=>({id:`bb-${j.fileId}-${Date.now()}`,name:j.fileName.replace(".psd","").replace("templates/",""),previewUrl:j.url.replace(".psd","_preview.jpg"),aspectRatio:"4:5",width:1080,height:1350,source:"backblaze",lastEdited:j.lastModified,hasSubtext:!0,psdData:{b2Url:j.url,fileName:j.fileName}})),b=[...p,...a];await V(b,g),c(b),await re("templates_loaded",{source:"backblaze",count:p.length}),k.success(`${p.length} template${p.length!==1?"s":""} loaded from Backblaze`),i.success(),_(!1)},ee=m=>{i.light(),S(m),y(!0)},le=m=>{i.light(),f(m),E(m.id),P(!0)},H=async m=>{if(l){z(!0),P(!1),k.success("Rendering design with Photopea...");try{const p=Ee();await p.initialize();const b=l.psdData?.b2Url||l.psdData?.fileUrl;if(!b)throw new Error("Template source file is missing");await p.loadPSDFromURL(b);const j=await p.renderDesign(m,{width:l.width,height:l.height,hasSubtext:l.hasSubtext||!1,hasOverlay:!0}),L=new File([j],`${l.name.replace(/[^a-zA-Z0-9-_]+/g,"-")}.jpg`,{type:"image/jpeg"}),O=await ue(L,"renders"),N={id:`design-${Date.now()}`,templateId:l.id,templateName:l.name,outputUrl:O.url,data:m,createdAt:new Date,aspectRatio:l.aspectRatio,caption:m.caption,contentType:m.contentType},T=[N,...g];await V(a,T),u(T),z(!1),await re("design_rendered",{templateName:l.name,designId:N.id}),Ae({title:l.name,platform:"Design Studio",status:"success",type:"designstudio"}),Ie({videoTitle:l.name,platform:"Design Studio",status:"success",type:"designstudio"}),s({type:"success",title:"Design Rendered",message:`"${l.name}" rendered successfully`,source:"design_studio",actionPage:"design-studio-activity"}),await p.closeDocument(),k.success("Design rendered successfully!"),i.success()}catch(p){console.error("Photopea rendering error:",p),z(!1),k.error(p instanceof Error?p.message:"Failed to render design")}}},Q=async(m,p)=>{if(A){i.medium();try{const b=await wt(p,{text:m||A.caption||A.templateName,title:A.templateName,imageUrl:A.outputUrl});if(!b.success||!b.data){k.error(b.error?.message||"Failed to publish design");return}const j=b.data.results.filter(T=>T.status==="posted").map(T=>T.platform),L=b.data.results.filter(T=>T.status==="failed").map(T=>`${T.platform}${T.error?`: ${T.error}`:""}`);if(j.length===0){k.error(L[0]||"Failed to publish design");return}const O=g.map(T=>T.id===A.id?{...T,caption:m||T.caption}:T);await V(a,O),u(O);const N=j.join(", ");if(await re("design_published",{templateName:A.templateName,designId:A.id,platforms:N}),Ae({title:A.templateName,platform:N,status:"success",type:"designstudio"}),Ie({videoTitle:A.templateName,platform:N,status:"success",type:"designstudio",errorDetails:L.length>0?L.join(" | "):void 0}),s({type:"success",title:"Design Published",message:`"${A.templateName}" published to ${N}`,source:"design_studio",actionPage:"design-studio-activity"}),L.length>0){k.success(`Published to ${N}`,{description:`Failed: ${L.join(" | ")}`});return}k.success("Design published to selected platforms!")}catch(b){console.error("Failed to finish Design Studio publish flow:",b),k.error(b instanceof Error?b.message:"Failed to publish design")}}},G=async m=>{const p=a.find(N=>N.id===m);if(!p)return;const b=[...a],j=[...g],L=a.filter(N=>N.id!==m),O=g.filter(N=>N.templateId!==m);try{await V(L,O),c(L),u(O),await re("template_deleted",{templateName:p.name}),i.medium(),k.success("Template deleted"),o({id:`undo-template-${m}`,itemName:p.name,onUndo:async()=>{await V(b,j),c(b),u(j),i.light(),k.success("Template restored")}})}catch(N){console.error("Failed to delete template:",N),k.error(N instanceof Error?N.message:"Failed to delete template")}};return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-gray-900 dark:text-white mb-2",children:"Design Studio"}),e.jsx("p",{className:"text-[#6B7280] dark:text-[#9CA3AF]",children:"PSD-driven creative automation workspace"})]}),e.jsx($,{onClick:()=>{i.light(),r("design-studio-activity")},variant:"outline",className:"text-gray-900 dark:text-white border-gray-200 dark:border-[#333333] hover:bg-gray-50 dark:bg-[#000000] dark:hover:bg-[#000000]",children:"View Activity"})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-4",children:[e.jsxs("label",{className:"block cursor-pointer",children:[e.jsx("input",{ref:fe,type:"file",accept:".psd",onChange:Z,className:"hidden"}),e.jsxs("div",{className:"border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]",children:[e.jsx(Re,{className:"w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3"}),e.jsx("p",{className:"text-gray-900 dark:text-white",children:"Upload PSD Template"})]})]}),e.jsxs("button",{onClick:be,className:"border border-gray-200 dark:border-[#333333] rounded-2xl p-6 text-center hover:border-[#ec1e24] transition-colors bg-white dark:bg-[#000000]",children:[e.jsx(Qe,{className:"w-8 h-8 text-gray-400 dark:text-[#666666] mx-auto mb-3"}),e.jsx("p",{className:"text-gray-900 dark:text-white",children:"Load from Backblaze"})]})]}),ne?e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:[1,2,3].map(m=>e.jsx("div",{className:"h-72 rounded-2xl border border-gray-200 dark:border-[#333333] bg-gray-100 dark:bg-[#111111] animate-pulse"},m))}):a.length===0?e.jsxs("div",{className:"bg-white dark:bg-[#000000] rounded-2xl border border-gray-200 dark:border-[#333333] p-12 text-center",children:[e.jsx("p",{className:"text-gray-600 dark:text-[#9CA3AF] mb-2",children:"No templates yet"}),e.jsx("p",{className:"text-sm text-gray-500 dark:text-[#6B7280]",children:"Upload a PSD template or load from Backblaze to get started"})]}):e.jsx("div",{className:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6",children:a.map(m=>e.jsx(zt,{template:m,onDelete:G,onEdit:le,onExpand:ee,livePreviewData:D===m.id?B:null,isBeingEdited:D===m.id},m.id))}),l&&e.jsx(Bt,{open:w,onOpenChange:m=>{P(m),m||(E(null),h(null))},templateName:l.name,hasSubtext:l.hasSubtext,hasOverlay:!0,onSave:H,onChange:m=>h(m),isRendering:R}),A&&e.jsx($t,{open:C,onOpenChange:M,title:"Publish Design",description:"Select platforms and customize your caption",initialCaption:A.caption||"",onPublish:(m,p)=>Q(m,p),onCaptionGenerate:()=>A.caption||A.templateName||"New design created!"}),d&&e.jsx(Me,{open:v,onOpenChange:y,children:e.jsxs(ze,{className:"max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none",hideCloseButton:!0,children:[e.jsxs(He,{children:[e.jsx(Ue,{children:d.name}),e.jsxs(Ve,{children:["Full size preview of ",d.name," (",d.aspectRatio,")"]})]}),e.jsxs("div",{className:"relative",children:[e.jsx("button",{onClick:()=>{i.light(),y(!1)},className:"absolute top-4 right-4 z-50 bg-black/80 text-white p-2 rounded-full hover:bg-black transition-colors",children:e.jsx(he,{className:"w-6 h-6"})}),e.jsx("img",{src:d.previewUrl,alt:d.name,className:"w-full h-auto max-h-[90vh] object-contain rounded-lg"})]})]})}),e.jsx(Rt,{open:I,onSelectTemplate:m=>{ve([m]).catch(p=>{console.error("Failed to load template from Backblaze:",p),k.error(p instanceof Error?p.message:"Failed to load template")})},onClose:()=>{i.light(),_(!1)}})]})}export{aa as default};
