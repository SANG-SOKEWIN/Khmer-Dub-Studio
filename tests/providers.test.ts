import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generate,listModels,transcribe,translate,geminiSpeech} from '../src/lib/providers.ts';
const config=()=>({keys:['test-key'],models:'gemini-test',signal:new AbortController().signal,log:()=>{}});
const response=(text:string)=>Response.json({candidates:[{content:{parts:[{text}]}}]});
// These are contract tests with synthetic HTTP responses, never live provider tests.
test('provider fallback attempts next configured model on 503',async()=>{const original=globalThis.fetch;const urls:string[]=[];globalThis.fetch=async input=>{urls.push(String(input));return urls.length===1?new Response('',{status:503}):response('ok');};try{await generate({...config(),models:'gemini-first\ngemini-second'},{contents:[]});assert.equal(urls.length,2);assert.ok(urls[1].includes('gemini-second'));assert.ok(!urls[0].includes('test-key'));}finally{globalThis.fetch=original;}});
test('invalid key fails immediately, without retrying permission errors',async()=>{const original=globalThis.fetch;let count=0;globalThis.fetch=async()=>{count++;return new Response('',{status:403});};try{await assert.rejects(generate({...config(),models:'gemini-one\ngemini-two'},{}),/403/);assert.equal(count,1);}finally{globalThis.fetch=original;}});
test('empty or safety-blocked output is an error',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({promptFeedback:{blockReason:'SAFETY'}});try{await assert.rejects(generate(config(),{}),/no content/);}finally{globalThis.fetch=original;}});
test('transcription accepts no speech and validates timings',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>response('[]');try{assert.deepEqual(await transcribe(new ArrayBuffer(2),1,config()),[]);globalThis.fetch=async()=>response('[{"start":0,"end":10,"text":"x","gender":"female"}]');await assert.rejects(transcribe(new ArrayBuffer(2),1,config()),/times/);}finally{globalThis.fetch=original;}});
test('translation preserves timing and rejects ID mismatches',async()=>{const original=globalThis.fetch;const segment={id:'1',start:0,end:1,text:'Hello',gender:'female' as const};globalThis.fetch=async()=>response('[{"id":"1","text":"សួស្តី"}]');try{const translated=await translate([segment],config());assert.equal(translated[0].text,'សួស្តី');assert.equal(translated[0].end,1);globalThis.fetch=async()=>response('[{"id":"9","text":"សួស្តី"}]');await assert.rejects(translate([segment],config()),/mismatched/);}finally{globalThis.fetch=original;}});
test('voice response supports raw little-endian PCM',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'audio/L16;codec=pcm;rate=24000',data:'AAAAAA=='}}]}}]});try{const wav=await geminiSpeech('សួស្តី','Kore',config());assert.equal(new DataView(wav).getUint32(24,true),24000);assert.equal(wav.byteLength,48);}finally{globalThis.fetch=original;}});
test('model discovery handles pages and filters non-generation models',async()=>{const original=globalThis.fetch;let i=0;globalThis.fetch=async()=>Response.json(++i===1?{models:[{name:'models/gemini-one',supportedGenerationMethods:['generateContent']}],nextPageToken:'page2'}:{models:[{name:'models/embedding',supportedGenerationMethods:['embedContent']},{name:'models/gemini-two',supportedGenerationMethods:['generateContent']}]});try{assert.deepEqual(await listModels('test-key'),['gemini-one','gemini-two']);}finally{globalThis.fetch=original;}});
test('cancellation stops requests before transmission',async()=>{const controller=new AbortController();controller.abort();await assert.rejects(generate({...config(),signal:controller.signal},{}));});

test('404-only exhaustion directs model refresh instead of waiting for quota',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:404});
  try{await assert.rejects(generate(config(),{}),/Click Providers → Load models/);}finally{globalThis.fetch=original;}
});
test('429 exhaustion reports rate or quota limits',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:429});
  try{await assert.rejects(generate(config(),{}),/reached a rate or quota limit/);}finally{globalThis.fetch=original;}
});

test('job resolves stale captured settings without waiting for UI verification',async()=>{
  const {resolveProviderConfig}=await import('../src/lib/providers.ts');
  const original=globalThis.fetch;const urls:string[]=[];
  globalThis.fetch=async input=>{const url=String(input);urls.push(url);return url.includes('/models?')?Response.json({models:[{name:'models/gemini-discovered-flash',supportedGenerationMethods:['generateContent']}]}):response('ok');};
  try{const resolved=await resolveProviderConfig(config());await generate(resolved,{});assert.equal(resolved.models,'gemini-discovered-flash');assert.equal(urls.length,2);assert.ok(urls[1].includes('gemini-discovered-flash:generateContent'));}finally{globalThis.fetch=original;}
});
test('404 refresh discovers a working model and updates config for next chunk',async()=>{
  const original=globalThis.fetch;const urls:string[]=[];
  globalThis.fetch=async input=>{const url=String(input);urls.push(url);if(url.includes('/models?'))return Response.json({models:[{name:'models/gemini-working',supportedGenerationMethods:['generateContent']}]});return url.includes('gemini-working:')?response('ok'):new Response('',{status:404});};
  try{const c=config();await generate(c,{});await generate(c,{});assert.equal(c.models,'gemini-working');assert.equal(urls.filter(u=>u.includes('/models?')).length,1);assert.equal(urls.filter(u=>u.includes('gemini-test:')).length,1);}finally{globalThis.fetch=original;}
});
test('404 discovery does not loop or retry the same unavailable model',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async input=>{calls++;return String(input).includes('/models?')?Response.json({models:[{name:'models/gemini-test',supportedGenerationMethods:['generateContent']}]}):new Response('',{status:404});};
  try{await assert.rejects(generate(config(),{}),/HTTP 404/);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});

test('request timeout falls back instead of terminating the job',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{if(++calls===1)throw new DOMException('deadline','TimeoutError');return response('ok');};
  try{const c={...config(),models:'gemini-slow\ngemini-fast'};await generate(c,{});assert.equal(calls,2);assert.ok(c.models.startsWith('gemini-fast'));}finally{globalThis.fetch=original;}
});
test('two timeouts stop bounded fallback with an actionable error',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw new DOMException('deadline','TimeoutError');};
  try{await assert.rejects(generate({...config(),models:'gemini-a\ngemini-b\ngemini-c'},{}),/Two Google requests timed out/);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
test('user cancellation during fetch never falls back',async()=>{
  const original=globalThis.fetch;const abort=new AbortController();let calls=0;
  globalThis.fetch=async()=>{calls++;abort.abort();throw new DOMException('cancelled','AbortError');};
  try{await assert.rejects(generate({...config(),models:'gemini-a\ngemini-b',signal:abort.signal},{}),{name:'AbortError'});assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test('timeout while reading a response also permits fallback',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{if(++calls===1){const r=response('ok');r.json=async()=>{throw new DOMException('deadline','TimeoutError');};return r;}return response('ok');};
  try{await generate({...config(),models:'gemini-a\ngemini-b'},{});assert.equal(calls,2);}finally{globalThis.fetch=original;}
});

test('single-model mode retries 503 on the same model without discovery',async()=>{
 const original=globalThis.fetch;const urls:string[]=[];globalThis.fetch=async input=>{urls.push(String(input));return urls.length===1?new Response('',{status:503}):response('ok');};
 try{await generate({...config(),models:'gemini-flash-lite-latest',singleModel:true},{});assert.equal(urls.length,2);assert.equal(urls[0],urls[1]);}finally{globalThis.fetch=original;}
});
test('single-model 404 stops without discovery or fallback',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return new Response('',{status:404});};
 try{await assert.rejects(generate({...config(),singleModel:true},{}),/No other model was tried/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});

test('Thai translation is corrected on the same model and timing is preserved',async()=>{
 const original=globalThis.fetch;let calls=0;const urls:string[]=[];
 globalThis.fetch=async input=>{urls.push(String(input));return response(JSON.stringify([{id:'1',text:++calls===1?'สวัสดี':'សួស្តី'}]));};
 try{const result=await translate([{id:'1',start:1,end:3,text:'Hello',gender:'female'}],{...config(),singleModel:true});assert.equal(result[0].text,'សួស្តី');assert.equal(result[0].start,1);assert.equal(result[0].end,3);assert.equal(calls,2);assert.equal(urls[0],urls[1]);}finally{globalThis.fetch=original;}
});
test('repeated Thai output is rejected instead of becoming completed subtitles',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return response('[{"id":"1","text":"สวัสดี"}]');};
 try{await assert.rejects(translate([{id:'1',start:0,end:1,text:'Hello',gender:'female'}],config()),/Thai script/);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});

test('only rejected lines are repaired and valid Khmer wording stays unchanged',async()=>{
 const original=globalThis.fetch;let calls=0;let repair='';
 globalThis.fetch=async(_,init)=>{calls++;if(calls===1)return response('[{"id":"41","text":"សួស្តី"},{"id":"42","text":"Dublin"}]');repair=String(init?.body);return response('[{"id":"42","text":"ដាប់លីន"}]');};
 try{const result=await translate([{id:'41',start:0,end:1,text:'Hello',gender:'female'},{id:'42',start:1,end:2,text:'Dublin',gender:'male'}],config());assert.equal(result[0].text,'សួស្តី');assert.equal(result[1].text,'ដាប់លីន');assert.ok(!repair.includes('Hello'));assert.ok(repair.includes('Dublin'));}finally{globalThis.fetch=original;}
});
test('failed repair identifies the exact rejected line and text',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>response('[{"id":"7","text":"Dublin"}]');
 try{await assert.rejects(translate([{id:'7',start:0,end:1,text:'Dublin',gender:'male'}],config()),/Subtitle 7:.*Returned text: "Dublin"/);}finally{globalThis.fetch=original;}
});
