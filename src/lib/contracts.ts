export const GEMINI_BASE='https://generativelanguage.googleapis.com/v1beta';
export function modelNames(value:string):string[]{
  const models=[...new Set(value.split(/\s+/).filter(Boolean).map(s=>s.replace(/^models\//,'')))];
  if(!models.length||models.length>30||models.some(s=>!/^gemini-[a-zA-Z0-9._-]{1,100}$/.test(s)))throw new Error('Enter 1–30 Gemini model names, one per line.');
  return models;
}
export function escapeXml(value:string):string {return value.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));}
export function speechRequest(body:unknown):{text:string;voice:string;region:string;key:string}{
  if(!body||typeof body!=='object')throw new Error('Invalid speech request.');
  const {text,voice,region,key}=body as Record<string,unknown>;
  if(typeof text!=='string'||!text.trim()||text.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw new Error('Speech text must contain 1–3000 valid characters.');
  if(voice!=='km-KH-PisethNeural'&&voice!=='km-KH-SreymomNeural')throw new Error('Unsupported Khmer voice.');
  if(typeof region!=='string'||! /^[a-z][a-z0-9]{2,30}$/.test(region))throw new Error('Enter a valid Azure region, such as southeastasia.');
  if(typeof key!=='string'||! /^[A-Za-z0-9_-]{20,256}$/.test(key))throw new Error('Enter a valid Azure Speech key.');
  return {text,voice,region,key};
}
export function ssml(text:string,voice:string):string{return `<speak version="1.0" xml:lang="km-KH"><voice name="${escapeXml(voice)}">${escapeXml(text)}</voice></speak>`;}
export function retryable(status:number):boolean {return status===404||status===429||status===500||status===502||status===503||status===504;}
export function jsonText(text:string):unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''));
}

/** Preserve available preferences; replace missing entries with discovered candidates. */
export function reconcileModels(configured:string,available:string[],kind:'text'|'speech'):string {
  const candidates=[...new Set(available)].filter(name=>/^gemini-[a-zA-Z0-9._-]{1,100}$/.test(name)).filter(name=>kind==='speech'?/tts/i.test(name):!/tts|image|robotics|computer|embedding|native-audio|live|deep-research/i.test(name));
  const preferred=configured.split(/\s+/).filter(name=>candidates.includes(name));
  const remaining=candidates.filter(name=>!preferred.includes(name)).sort((a,b)=>Number(/flash/i.test(b))-Number(/flash/i.test(a)));
  return [...new Set([...preferred,...remaining])].slice(0,30).join('\n');
}

/** Script guard, not a claim that grammar or meaning has been independently verified. */
export function requireKhmer(text:string):void {
  if(/[\u0E00-\u0E7F]/u.test(text))throw new Error('Translation contains Thai script. Khmer (ភាសាខ្មែរ) is required.');
  if(/\p{L}/u.test(text)&&!/[\u1780-\u17B3]/u.test(text))throw new Error('Translation does not contain Khmer letters. Khmer (ភាសាខ្មែរ) is required.');
}
