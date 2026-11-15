import {NextRequest} from 'next/server';
import {authorizeSpeech,boundedJson,error} from '@/lib/server';
import {speechRequest,ssml} from '@/lib/contracts';
export const runtime='nodejs';
export async function POST(request:NextRequest){
  try{
    const status=await authorizeSpeech(request);
    if(status!==200)return error(status===429?'Speech request limit reached. Wait one minute.':status===401?'Session required.':'Origin not allowed.',status);
    let input;try{input=speechRequest(await boundedJson(request));}catch(e){return error(e instanceof Error?e.message:'Invalid request.',400);}
    const response=await fetch(`https://${input.region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':input.key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'riff-24khz-16bit-mono-pcm','User-Agent':'IndependentKhmerStudio'},body:ssml(input.text,input.voice),signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});
    if(!response.ok)return error(`Microsoft Speech rejected the request (HTTP ${response.status}). Check your key, region and quota.`,response.status===429?429:502);
    const bytes=await response.arrayBuffer();if(bytes.byteLength>30_000_000||bytes.byteLength<44)return error('Invalid speech audio response.',502);
    return new Response(bytes,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});
  }catch{return error('Speech service unavailable or timed out. Check server configuration.',503);}
}
