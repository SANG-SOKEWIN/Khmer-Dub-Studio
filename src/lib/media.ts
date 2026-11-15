import {subtitleAt} from './subtitles.ts';
import {encodeWav} from './wav.ts';
import type {Segment} from './subtitles.ts';
export type AudioTrack={samples:Float32Array;rate:number};
export function download(blob:Blob,filename:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function cancelled(signal:AbortSignal){signal.throwIfAborted();}
export function once(target:EventTarget,event:string,signal:AbortSignal,timeout=30000):Promise<void>{
  return new Promise((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);target.removeEventListener(event,done);target.removeEventListener('error',fail);signal.removeEventListener('abort',abort);};
    const done=()=>{cleanup();resolve();}; const fail=()=>{cleanup();reject(new Error('The browser could not decode this media. Try MP4 with H.264/AAC or WebM.'));}; const abort=()=>{cleanup();reject(signal.reason??new Error('Cancelled.'));};
    const timer=setTimeout(()=>{cleanup();reject(new Error('Media operation timed out.'));},timeout);
    target.addEventListener(event,done,{once:true});target.addEventListener('error',fail,{once:true});signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  });
}
export async function seek(video:HTMLVideoElement,time:number,signal:AbortSignal){if(Math.abs(video.currentTime-time)<.001)return;const done=once(video,'seeked',signal);video.currentTime=time;await done;}
export async function extractAudio(file:File,signal:AbortSignal,log:(s:string)=>void):Promise<AudioTrack>{
  cancelled(signal);
  const context=new AudioContext();
  try {
    let buffer:AudioBuffer;
    try {buffer=await context.decodeAudioData(await file.arrayBuffer());}
    catch {
      log('Direct audio decoding unavailable; extracting during local playback. Keep this tab active.');
      buffer=await captureAudio(file,context,signal);
    }
    cancelled(signal);
    const offline=new OfflineAudioContext(1,Math.ceil(buffer.duration*16000),16000);
    const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();
    const mono=await offline.startRendering();cancelled(signal);
    return {samples:mono.getChannelData(0).slice(),rate:16000};
  } finally {await context.close();}
}
async function captureAudio(file:File,context:AudioContext,signal:AbortSignal):Promise<AudioBuffer>{
  const cleanupController=new AbortController();signal=AbortSignal.any([signal,cleanupController.signal]);
  const video=document.createElement('video'),url=URL.createObjectURL(file);video.src=url;video.playsInline=true;video.preload='auto';
  const source=context.createMediaElementSource(video),processor=context.createScriptProcessor(4096,2,1),mute=context.createGain();mute.gain.value=0;
  const chunks:Float32Array[]=[];
  processor.onaudioprocess=(event)=>{if(!video.paused&&!video.ended){const input=event.inputBuffer;const out=new Float32Array(input.length);for(let c=0;c<input.numberOfChannels;c++){const data=input.getChannelData(c);for(let i=0;i<out.length;i++)out[i]+=data[i]/input.numberOfChannels;}chunks.push(out);}};
  source.connect(processor);processor.connect(mute);mute.connect(context.destination);
  try {
    if(video.readyState<1)await once(video,'loadedmetadata',signal);
    if(!Number.isFinite(video.duration)||video.duration>900)throw new Error('Video must be at most 15 minutes.');
    await context.resume();const ended=once(video,'ended',signal,(video.duration+30)*1000);void ended.catch(()=>{});await video.play();await ended;
    const length=chunks.reduce((n,c)=>n+c.length,0);if(!length)throw new Error('No decodable audio track was found.');
    const buffer=context.createBuffer(1,length,context.sampleRate),channel=buffer.getChannelData(0);let offset=0;for(const chunk of chunks){channel.set(chunk,offset);offset+=chunk.length;}return buffer;
  } finally {cleanupController.abort();video.pause();video.removeAttribute('src');video.load();processor.onaudioprocess=null;processor.disconnect();source.disconnect();mute.disconnect();URL.revokeObjectURL(url);}
}
export async function renderDub(
  segments: Segment[],
  audio: (ArrayBuffer | null)[],
  duration: number,
  signal: AbortSignal,
): Promise<{track: AudioTrack; captions: Segment[]; overflowSeconds: number}> {
  const rate = 24000;
  const offline = new OfflineAudioContext(1, Math.ceil(duration * rate), rate);
  let speechEnd = 0;
  const captions: Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    cancelled(signal);
    const clip = audio[i];
    if (!clip) continue;
    const buffer = await offline.decodeAudioData(clip.slice(0));
    const start = Math.max(segments[i].start, speechEnd);
    speechEnd = start + buffer.duration;
    if (start >= duration || buffer.duration <= 0) continue;
    captions.push({...segments[i], start, end: Math.min(duration, speechEnd)});
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(start);
  }
  const rendered = await offline.startRendering();
  cancelled(signal);
  return {
    track: {samples: rendered.getChannelData(0).slice(), rate},
    captions,
    overflowSeconds: Math.max(0, speechEnd - duration),
  };
}
export function mixTracks(dub:AudioTrack,original:AudioTrack|null,volume:number):AudioTrack{
  const samples=dub.samples.slice();if(original&&volume>0){for(let i=0;i<samples.length;i++){const p=i*original.rate/dub.rate,index=Math.floor(p),fraction=p-index;const x=(original.samples[index]??0)*(1-fraction)+(original.samples[index+1]??0)*fraction;samples[i]=Math.max(-1,Math.min(1,samples[i]+x*volume));}}return {samples,rate:dub.rate};
}
export function trackBlob(track:AudioTrack):Blob{return new Blob([encodeWav(track.samples,track.rate)],{type:'audio/wav'});}
function drawSubtitle(paint: CanvasRenderingContext2D, text: string, width: number, height: number) {
  if (!text) return;
  const size = Math.max(8, Math.round(Math.min(width, height) * 0.058));
  const lineHeight = size * 1.6;
  const padding = size * 0.45;
  paint.save();
  paint.font = `600 ${size}px "Kantumruy Pro", "Khmer Sangam MN", "Noto Sans Khmer", sans-serif`;
  paint.textAlign = 'center';
  paint.textBaseline = 'middle';
  const lines: string[] = [];
  const words = new Intl.Segmenter('km', {granularity: 'word'});
  for (const paragraph of text.trim().split(/\r?\n/)) {
    let line = '';
    for (const {segment} of words.segment(paragraph)) {
      if (line && paint.measureText(line + segment).width > width * 0.84) {
        lines.push(line.trim());
        line = segment.trimStart();
      } else {
        line += segment;
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  const bottom = height * 0.08;
  for (const [index, line] of lines.entries()) {
    const rowWidth = Math.min(width * 0.9, paint.measureText(line).width + 2 * padding);
    const y = height - bottom - (lines.length - index - 0.5) * lineHeight;
    paint.fillStyle = 'rgba(0, 0, 0, 0.78)';
    paint.fillRect((width - rowWidth) / 2, y - lineHeight / 2, rowWidth, lineHeight);
    paint.fillStyle = '#fff';
    paint.fillText(line, width / 2, y, rowWidth - 2 * padding);
  }
  paint.restore();
}
export async function exportVideo(file:File,track:AudioTrack,signal:AbortSignal,onProgress:(n:number)=>void,captions:readonly Segment[]=[]):Promise<{blob:Blob;extension:string}>{
  const cleanupController=new AbortController();signal=AbortSignal.any([signal,cleanupController.signal]);
  if(typeof MediaRecorder==='undefined')throw new Error('This browser cannot record video. Export WAV and SRT, or use a browser with MediaRecorder.');
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
  if(!mime)throw new Error('No supported video export codec. Try a current Chromium browser.');
  const video=document.createElement('video'),url=URL.createObjectURL(file);video.src=url;video.muted=true;video.playsInline=true;
  const context=new AudioContext({sampleRate:track.rate});let stream:MediaStream|undefined;let raf=0;let recorder:MediaRecorder|undefined;let audioSource:AudioBufferSourceNode|undefined;
  try{
    if(video.readyState<1)await once(video,'loadedmetadata',signal);
    const canvas=document.createElement('canvas');const scale=Math.min(1,1920/video.videoWidth,1080/video.videoHeight);canvas.width=Math.max(2,Math.round(video.videoWidth*scale/2)*2);canvas.height=Math.max(2,Math.round(video.videoHeight*scale/2)*2);
    const paint=canvas.getContext('2d');if(!paint)throw new Error('Canvas export unavailable.');
    stream=canvas.captureStream(30);const destination=context.createMediaStreamDestination();destination.stream.getAudioTracks().forEach(t=>stream!.addTrack(t));
    const buffer=context.createBuffer(1,track.samples.length,track.rate);buffer.copyToChannel(Float32Array.from(track.samples),0);audioSource=context.createBufferSource();audioSource.buffer=buffer;audioSource.connect(destination);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6_000_000});const chunks:Blob[]=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
    const stopped=new Promise<void>((resolve,reject)=>{recorder!.onstop=()=>resolve();recorder!.onerror=()=>reject(new Error('Video encoding failed.'));});
    // Mark rejection handled while playback is active; await it below for result.
    void stopped.catch(()=>{});
    const draw=()=>{paint.drawImage(video,0,0,canvas.width,canvas.height);if(captions.length)drawSubtitle(paint,subtitleAt(captions,video.currentTime),canvas.width,canvas.height);onProgress(video.currentTime/video.duration);if(!video.ended&&!signal.aborted)raf=requestAnimationFrame(draw);};
    await context.resume();const ended=once(video,'ended',signal,(video.duration+45)*1000);void ended.catch(()=>{});
    recorder.start(1000);await video.play();audioSource.start();draw();await ended;cancelAnimationFrame(raf);recorder.stop();await stopped;cancelled(signal);onProgress(1);
    if(!chunks.length)throw new Error('Video encoder returned no data.');return {blob:new Blob(chunks,{type:mime}),extension:mime.startsWith('video/mp4')?'mp4':'webm'};
  }finally{cleanupController.abort();cancelAnimationFrame(raf);video.pause();if(recorder&&recorder.state!=='inactive')recorder.stop();try{audioSource?.stop();}catch{}stream?.getTracks().forEach(t=>t.stop());await context.close();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
