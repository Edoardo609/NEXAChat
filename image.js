import { config } from 'hatchable';
export const access='public'; export const methods=['POST','OPTIONS'];

const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const strip=s=>clean(String(s||'').replace(/<[^>]*>/g,' ').replace(/&quot;/g,'"').replace(/&#x27;/g,"'"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function webGrounding(query){
 const facts=[];
 try{
  const r=await withTimeout('https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch='+encodeURIComponent(query)+'&format=json&srlimit=3',{},7000);
  if(r.ok){const d=await r.json();for(const x of(d?.query?.search||[]).slice(0,3)){const s=strip(x.snippet);if(s)facts.push(x.title+': '+s)}}
 }catch{}
 try{
  const r=await withTimeout('https://html.duckduckgo.com/html/?q='+encodeURIComponent(query),{headers:{'User-Agent':'Mozilla/5.0'}},7000);
  if(r.ok){const html=await r.text();const re=/<a[^>]*class="result__a"[^>]*>[\s\S]*?<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;let m,n=0;while((m=re.exec(html))&&n<3){const s=strip(m[1]);if(s){facts.push(s);n++}}}
 }catch{}
 return facts.slice(0,5).join(' | ').slice(0,1800);
}

// Get one real public reference image for technical subjects. This is not copied:
// it is used only as visual conditioning so the model understands the geometry.
async function getReferenceImage(query){
 // First try Wikipedia article imagery.
 try{
  const url='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query)+'&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=1400&format=json&origin=*';
  const r=await withTimeout(url,{},6000);
  if(r.ok){const d=await r.json();const pages=Object.values(d?.query?.pages||{});const img=pages.find(p=>p?.thumbnail?.source)?.thumbnail?.source;if(img)return String(img);}
 }catch{}
 // Reliable fallback: search Wikimedia Commons directly for a real public photo.
 try{
  const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query)+'&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=1400&format=json&origin=*';
  const r=await withTimeout(url,{},7000);
  if(r.ok){const d=await r.json();const pages=Object.values(d?.query?.pages||{});for(const p of pages){const ii=p?.imageinfo?.[0];const img=ii?.thumburl||ii?.url;if(img)return String(img);}}
 }catch{}
 return '';
}

function needsVisualResearch(prompt){
 const p=String(prompt||'');
 return /\b(boeing|airbus|cessna|lockheed|f\/?a|f-\d+|737|747|777|787|a\d{3}|concorde|titanic|apollo|iss|nasa|ferrari|lamborghini|porsche|dodge|mustang|tesla|formula\s?1|mclaren)\b/i.test(p)
  || /\b[A-Z][A-Za-z]+\s+[A-Z0-9][A-Za-z0-9-]{2,}\b/.test(p)
  || /\b\d{3,4}[- ]?(?:800|900|max|gt|r)\b/i.test(p);
}

async function withTimeout(url,opts={},ms=90000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),ms);
 try{return await fetch(url,{...opts,signal:controller.signal})}
 finally{clearTimeout(timer)}
}

export default async function(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, X-ChatNEXA-User');
 res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).end();
 const prompt=clean(req.body?.prompt);
 const sourceImageUrl=clean(req.body?.sourceImageUrl);
 if(!prompt)return res.status(400).json({error:'Prompt immagine mancante'});
 if(prompt.length>1600)return res.status(400).json({error:'Prompt troppo lungo'});

 const lower=prompt.toLowerCase();
 const is737=lower.includes('737-800')||lower.includes('737 800')||lower.includes('boeing 737');
 const isF18=lower.includes('f-18')||lower.includes('f/a-18')||lower.includes('fa18')||lower.includes('hornet')||lower.includes('super hornet');
 const isFerrari=/\b(ferrari|f40|f50|f8|sf90|laferrari|296\s?gtb|812\s?(superfast|gts)?|roma)\b/i.test(prompt);
 const isSpecificCar=isFerrari||/\b(lamborghini|porsche|dodge|challenger|mustang|tesla|mclaren|bugatti|corvette|mercedes|bmw|audi)\b/i.test(prompt);
 let finalPrompt=prompt;

 // For technical subjects, short and exact prompts are more reliable than long expansions.
 if(is737){
   // Lock the identity with the features that visually distinguish a 737-800.
   finalPrompt='REAL BOEING 737-800 ONLY. A narrow-body twin-engine passenger airliner, exactly TWO turbofan engines mounted under the wings, low swept wings, conventional single vertical tail, short-to-medium narrow fuselage, Boeing 737 Next Generation cockpit shape and nose, correct proportions. Side three-quarter aviation photograph. NOT a Boeing 747, NOT a wide-body aircraft, NOT four engines, NOT a double deck aircraft, NOT a fictional aircraft, no extra wings or engines. '+prompt;
 } else if(isF18){
   finalPrompt='REAL BOEING F/A-18 HORNET ONLY. Accurate twin-engine carrier fighter, exactly two outward-canted vertical tails, leading-edge extensions, swept wings and correct Hornet canopy. NOT a different aircraft and no extra wings or engines. '+prompt;
 } else if(isSpecificCar){
   // Keep the user's request almost untouched: long negative prompts were degrading composition.
   // Translate only the crucial constraints so the generator receives colour + scene directly.
   const colorMap={giallo:'bright yellow',gialla:'bright yellow',yellow:'bright yellow',rosso:'red',rossa:'red',blu:'blue',blue:'blue',nero:'black',nera:'black',bianco:'white',bianca:'white',verde:'green',green:'green',arancione:'orange',orange:'orange',grigio:'grey',grigia:'grey'};
   let translated=prompt;
   for(const [it,en] of Object.entries(colorMap))translated=translated.replace(new RegExp('\\b'+it+'\\b','gi'),en);
   translated=translated.replace(/\bstrada\b/gi,'road').replace(/\bvia\b/gi,'street').replace(/\bparcheggiata\b/gi,'parked').replace(/\brealistica\b/gi,'photorealistic');
   finalPrompt='Photorealistic image: '+translated+'. Preserve exactly the requested colour, vehicle and location. Do not substitute the colour or location.';
 } else {
   try{
    const key=String((await config.get('GROQ_API_KEY'))||'').trim();
    if(key){
     const instruction='Rewrite the user request as one concise English image prompt. Keep the exact requested subject. Do not add people or unrelated objects. Do not overcomplicate it. Return only the prompt. Request: '+prompt;
     const r=await withTimeout('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify({model:'openai/gpt-oss-20b',messages:[{role:'user',content:instruction}],temperature:.1,max_completion_tokens:350})},25000);
     if(r.ok){const d=await r.json();const p=clean(d.choices?.[0]?.message?.content);if(p)finalPrompt=p}
    }
   }catch(_){}
 }

 // Research is used only when it produces useful grounding. Do not dump search snippets
 // into the prompt: noisy snippets were making the image model lose the main subject.
 let research='';
 if(needsVisualResearch(prompt)) research=await webGrounding(prompt);
 // Restore web grounding, but keep it compact so it helps identify real subjects without
 // overwhelming the image model. This is especially useful when a name/model is ambiguous.
 if(research && !isSpecificCar){
  finalPrompt+=' Web reference facts for subject identity: '+research.slice(0,420)+'.';
 }

 const isAircraft=is737||isF18||/\b(aircraft|airplane|airliner|boeing|airbus|jet|aereo|aeroplano)\b/i.test(prompt);

 // Cloudflare Workers AI: primary generator using secrets stored in Hatchable Vault.
 // No credentials are ever exposed to the browser.
 try{
  const accountId=String((await config.get('CLOUDFLARE_ACCOUNT_ID'))||'').trim();
  const apiToken=String((await config.get('CLOUDFLARE_API_TOKEN'))||'').trim();
  if(accountId&&apiToken){
   const cfModel='@cf/black-forest-labs/flux-2-klein-9b';
   const cfPrompt=sourceImageUrl ? finalPrompt+' IMPORTANT: Edit input image 0 according to the user request. Preserve the subject, composition and all details not explicitly requested to change.' : finalPrompt;
   const form=new FormData();
   form.append('prompt',cfPrompt);
   form.append('width',String((isAircraft||isSpecificCar)?1280:1024));
   form.append('height',String((isAircraft||isSpecificCar)?720:1024));
   if(sourceImageUrl){
    try{
     let blob;
     // Generated images are stored client-side as data: URLs. Convert them directly
     // instead of trying to fetch a data URL from the server runtime.
     if(/^data:image\//i.test(sourceImageUrl)){
      const m=String(sourceImageUrl).match(/^data:(image\/[^;,]+);base64,(.+)$/i);
      if(!m)throw Error('invalid source image data');
      const bytes=Buffer.from(m[2],'base64');
      blob=new Blob([bytes],{type:m[1]});
     }else{
      const src=await fetch(sourceImageUrl);
      if(!src.ok)throw Error('source image unavailable');
      blob=await src.blob();
     }
     form.append('input_image_0',blob,'source.png');
    }catch(e){console.warn('Cloudflare edit source:',e?.message||e);throw e}
   }
   // Retry Cloudflare once: consecutive image requests can briefly hit a busy worker.
   let cf=null;
   for(let cfTry=0;cfTry<2;cfTry++){
    if(cfTry>0)await sleep(900);
    const retryForm=cfTry===0?form:new FormData();
    if(cfTry>0){retryForm.append('prompt',cfPrompt);retryForm.append('width',String((isAircraft||isSpecificCar)?1280:1024));retryForm.append('height',String((isAircraft||isSpecificCar)?720:1024));}
    cf=await withTimeout('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(accountId)+'/ai/run/'+encodeURIComponent(cfModel),{method:'POST',headers:{'Authorization':'Bearer '+apiToken},body:retryForm},70000);
    if(!cf.ok)continue;
    const type=cf.headers.get('content-type')||'';
    if(type.startsWith('image/')){
     const bytes=Buffer.from(await cf.arrayBuffer());
     if(bytes.length>15000)return res.json({imageData:'data:'+type.split(';')[0]+';base64,'+bytes.toString('base64'),model:'cloudflare-flux-2-klein'});
    }else{
     const data=await cf.json().catch(()=>null);
     const b64=data?.result?.image||data?.result?.base64||data?.image;
     if(b64)return res.json({imageData:b64.startsWith('data:')?b64:'data:image/png;base64,'+b64,model:'cloudflare-flux-2-klein'});
    }
   }
  }
 }catch(e){console.warn('Cloudflare AI fallback:',e?.message||e)}

 // Free anonymous fallback when Cloudflare is unavailable.
 const width=(isAircraft||isSpecificCar)?1280:1024;
 const height=(isAircraft||isSpecificCar)?720:1024;
 // Technical vehicles need identity locking rather than generic artistic prompt expansion.
 const enhanced=isAircraft
  ? 'Professional high-resolution aviation photography. The aircraft is the ONLY main subject. Preserve exact real-world aircraft identity and correct engineering geometry. Sharp focus across the whole aircraft, realistic scale and proportions, documentary aviation photograph. '+finalPrompt
  : isSpecificCar
   ? 'Professional high-resolution automotive photography. ONE real car is the ONLY main subject. Preserve exact real-world vehicle identity and correct engineering geometry. Full vehicle visible, sharp focus, realistic proportions, natural reflections, documentary automotive photograph. '+finalPrompt
   : 'High quality photorealistic image. Sharp, realistic, natural lighting. '+finalPrompt;
 let lastError='Generatore immagini temporaneamente occupato';

 // Try the two free models in parallel. This prevents the second image in the same
 // conversation from waiting behind a temporarily busy provider. Every generation
 // always gets a fresh seed and nonce.
 // Restore the previous model preference that gave better visual compositions.
 const models=['zimage','flux'];
 const makeAttempt=async(model,round)=>{
  const seed=Math.floor(Math.random()*2147483647);
  const nonce=Date.now().toString(36)+'-'+round+'-'+model+'-'+Math.random().toString(36).slice(2,9);
  const editInstruction=sourceImageUrl?' EDIT THE PROVIDED SOURCE IMAGE. Preserve the original subject, composition and identity unless the user explicitly asks to change them. Apply only the requested modification: '+prompt:'';
  const imageUrl='https://image.pollinations.ai/prompt/'+encodeURIComponent(enhanced+editInstruction)+'?width='+width+'&height='+height+'&seed='+seed+'&nologo=true&model='+model+'&nonce='+nonce+'&safe=false'+(sourceImageUrl?'&image='+encodeURIComponent(sourceImageUrl):'');
  const r=await withTimeout(imageUrl,{},28000);
  const type=r.headers.get('content-type')||'';
  if(!r.ok||!type.startsWith('image/'))throw Error('invalid image response');
  const bytes=Buffer.from(await r.arrayBuffer());
  if(bytes.length<=15000)throw Error('image too small');
  const mime=type.split(';')[0]||'image/jpeg';
  return {imageData:'data:'+mime+';base64,'+bytes.toString('base64'),model};
 };
 for(let round=0;round<2;round++){
  try{
   const result=await Promise.any(models.map(model=>makeAttempt(model,round)));
   return res.json({...result,attempt:round+1});
  }catch(e){
   lastError='Servizio immagini momentaneamente occupato';
   if(round===0)await sleep(1200);
  }
 }
 return res.status(503).json({error:lastError+'. Riprova tra qualche secondo.'});
}