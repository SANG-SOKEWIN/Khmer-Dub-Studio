'use client';
import {useEffect,useRef,useState} from 'react';
import Settings,{INITIAL_SETTINGS,type SettingsValue} from './Settings';
import SubtitleEditor from './SubtitleEditor';
import {MAX_DURATION,parseSubtitles,validateSegments,toSrt,offsetSegments,subtitleAt,type Segment} from '@/lib/subtitles';
import {azureSpeech,edgeSpeech,geminiSpeech,transcribe,translate,type ProviderConfig} from '@/lib/providers';
import {chunkRanges,encodeWav} from '@/lib/wav';
import {download,extractAudio,renderDub,mixTracks,trackBlob,exportVideo,type AudioTrack} from '@/lib/media';
export default function Studio(){
  const [settings,setSettings]=useState<SettingsValue>(INITIAL_SETTINGS),[dark,setDark]=useState(true),[mode,setMode]=useState<'full'|'translate'>('full'),[menu,setMenu]=useState(false);
  const [file,setFile]=useState<File|null>(null),[videoUrl,setVideoUrl]=useState(''),[duration,setDuration]=useState(0),[volume,setVolume]=useState(0),[segments,setSegments]=useState<Segment[]>([]),[logs,setLogs]=useState<string[]>([]),[status,setStatus]=useState('Ready when you are.'),[busy,setBusy]=useState(false),[stage,setStage]=useState(0),[progress,setProgress]=useState(0),[dubbed,setDubbed]=useState<{track:AudioTrack;captions:Segment[]}|null>(null),[dubUrl,setDubUrl]=useState(''),[dragging,setDragging]=useState(false),[deviceReady,setDeviceReady]=useState(false);
  const [includeSubtitles, setIncludeSubtitles] = useState(false);
  const [captionTime, setCaptionTime] = useState(0);
  const dub = dubbed?.track ?? null;
  const caption = includeSubtitles ? subtitleAt(dubbed?.captions ?? segments, captionTime) : '';
  const video=useRef<HTMLVideoElement>(null),audio=useRef<HTMLAudioElement>(null),picker=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),original=useRef<AudioTrack|null>(null),previewAudio=useRef<HTMLAudioElement|null>(null),previewUrl=useRef(''),spoken=useRef<string|null>(null),mounted=useRef(true),modeWrap=useRef<HTMLDivElement>(null);
  const voiceClips = useRef(new Map<string, ArrayBuffer>());
  const log=(message:string)=>{setStatus(message);setLogs(prev=>[...prev.slice(-199),`${new Date().toLocaleTimeString()}  ${message}`]);};
  useEffect(()=>{mounted.current=true;try{setDark(localStorage.getItem('khmer-studio-theme')!=='light');}catch{}return()=>{mounted.current=false;controller.current?.abort();window.speechSynthesis?.cancel();previewAudio.current?.pause();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);};},[]);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('khmer-studio-theme',dark?'dark':'light');}catch{}},[dark]);
  useEffect(()=>{if(!menu)return;const listener=(e:PointerEvent)=>{if(!modeWrap.current?.contains(e.target as Node))setMenu(false);};document.addEventListener('pointerdown',listener);return()=>document.removeEventListener('pointerdown',listener);},[menu]);
  useEffect(()=>{if(video.current)video.current.volume=volume;},[volume,videoUrl]);
  useEffect(()=>{if(!dub){setDubUrl('');return;}const url=URL.createObjectURL(trackBlob(dub));setDubUrl(url);return()=>URL.revokeObjectURL(url);},[dub]);
  useEffect(()=>()=>{if(videoUrl)URL.revokeObjectURL(videoUrl);},[videoUrl]);
  const invalidate=()=>{setDubbed(null);setDeviceReady(false);window.speechSynthesis?.cancel();spoken.current=null;audio.current?.pause();};
  function updateSettings(next:SettingsValue){const voiceChanged=next.engine!==settings.engine||next.edgeVoice!==settings.edgeVoice||next.geminiVoice!==settings.geminiVoice||next.ttsModels!==settings.ttsModels;if(voiceChanged)invalidate();setSettings(next);}
  function chooseFile(next:File){
    if(busy)return;
    if(!/\.(mp4|mov|webm)$/i.test(next.name)){log('Choose an MP4, MOV or WebM video.');return;}
    if(!next.size||next.size>500*1024*1024){log('Choose a non-empty video under 500 MB.');return;}
    video.current?.pause();invalidate();voiceClips.current.clear();setCaptionTime(0);original.current=null;setFile(next);setVideoUrl(URL.createObjectURL(next));setDuration(0);setSegments([]);setProgress(0);setStage(0);log(`Loaded ${next.name}. Reading media information…`);
  }
  function metadata(){const d=video.current?.duration??0;if(d===Infinity&&video.current){video.current.currentTime=1e10;log('Resolving recorded video duration…');return;}if(!Number.isFinite(d)||d<=0||d>MAX_DURATION){setDuration(0);log('Use a playable video of up to 15 minutes.');return;}if(video.current&&video.current.currentTime>d)video.current.currentTime=0;setDuration(d);log(`Ready · ${d.toFixed(1)} seconds · video stays on this device.`);}
  function config(signal:AbortSignal,models=settings.models):ProviderConfig{if(!settings.enabled)throw new Error('Enable Gemini in Providers for transcription, translation or Gemini speech.');return {keys:settings.keys,models,singleModel:true,signal,log};}
  async function run(work:(signal:AbortSignal)=>Promise<void>){
    if(controller.current)return;const abort=new AbortController();controller.current=abort;setBusy(true);video.current?.pause();audio.current?.pause();window.speechSynthesis?.cancel();previewAudio.current?.pause();
    try{await work(abort.signal);}catch(e){if(mounted.current)log(abort.signal.aborted?'Cancelled. Existing subtitle edits are preserved.':e instanceof Error?e.message:'Operation failed.');}finally{controller.current=null;if(mounted.current)setBusy(false);}
  }
  async function getOriginal(signal:AbortSignal){if(!file)throw new Error('Load a video first.');if(!original.current)original.current=await extractAudio(file,signal,log);return original.current;}
  async function speech(segment:Segment,signal:AbortSignal,position?:string):Promise<ArrayBuffer>{
    signal.throwIfAborted();
    const gender = settings.edgeVoice === 'auto' ? segment.gender : settings.edgeVoice;
    const voice = gender === 'male' ? 'km-KH-PisethNeural' : 'km-KH-SreymomNeural';
    const gemini = settings.engine === 'gemini';
    const cacheKey = JSON.stringify(gemini
      ? ['gemini', settings.ttsModels.trim(), settings.geminiVoice, segment.text]
      : [settings.engine, settings.engine === 'azure' ? settings.azureRegion : '', voice, segment.text]);
    const cached = voiceClips.current.get(cacheKey);
    if (cached) {
      if (position) log(`Reusing Khmer voice ${position}…`);
      return cached;
    }
    if (position) log(`Generating Khmer voice ${position}…`);
    const clip = settings.engine === 'edge'
      ? await edgeSpeech(segment.text,voice,signal)
      : gemini
      ? await geminiSpeech(segment.text,settings.geminiVoice,config(signal,settings.ttsModels))
      : await azureSpeech(segment.text,voice,settings.azureKey,settings.azureRegion,signal);
    signal.throwIfAborted();
    voiceClips.current.set(cacheKey, clip);
    return clip;
  }
  function deviceVoice(){if(!window.speechSynthesis)throw new Error('This browser does not support device speech.');const voices=window.speechSynthesis.getVoices().filter(v=>v.lang.toLowerCase().startsWith('km'));if(!voices.length)throw new Error('No Khmer device voice is installed. Install one, or select Gemini/Microsoft.');return voices[0];}
  function speakDevice(text:string){const voice=deviceVoice();window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.onerror=e=>{if(!['interrupted','canceled'].includes(e.error))log('Device voice failed: '+e.error);};window.speechSynthesis.speak(utterance);}
  async function makeVoice(input:Segment[],signal:AbortSignal){
    const clean=validateSegments(input,duration);invalidate();setStage(3);setProgress(0);
    if(settings.engine==='device'){deviceVoice();setDeviceReady(true);setProgress(1);log('Device voice ready. Play the video to hear it; export is unavailable for device speech.');return;}
    const clips:(ArrayBuffer|null)[]=[];
    for (let i = 0; i < clean.length; i++) {
      try {
        if (/^[\p{P}\p{Z}\s]+$/u.test(clean[i].text)) {
          clips.push(null);
          log(`Subtitle ${i + 1}/${clean.length} contains only punctuation. Keeping its timing as silence.`);
        } else {
          clips.push(await speech(clean[i], signal, `${i + 1}/${clean.length}`));
        }
      } catch (error) {
        if (signal.aborted) throw error;
        const reason = error instanceof Error ? error.message : 'Voice generation failed.';
        throw new Error(`Khmer voice stopped at subtitle ${i + 1}/${clean.length}. ${reason} Keep this tab open and click Generate Khmer voice again when ready. Completed clips will be reused.`);
      }
      setProgress((i + 1) / clean.length);
    }
    const {track, captions, overflowSeconds} = await renderDub(clean, clips, duration, signal);
    setDubbed({track, captions});
    log(overflowSeconds > 0.05
      ? `Dub ready at normal speed. The video ends ${overflowSeconds.toFixed(1)} seconds before the narration finishes. Shorten the subtitle wording and regenerate if you need the full ending.`
      : 'Dub ready at normal speed. Click Preview Khmer dub to watch before downloading.');
    setStage(4);
  }
  async function processVideo(signal:AbortSignal){
    if(!file||!duration)throw new Error('Load a supported video first.');invalidate();setSegments([]);setProgress(0);
    let next:Segment[];
    if(settings.subtitleInput.trim()){next=parseSubtitles(settings.subtitleInput,duration);log('Imported subtitles. Transcription and translation skipped.');setSegments(next);}
    else{
      const provider=config(signal);log(`Using selected model: ${provider.models}. Automatic switching is off.`);setStage(1);log('Extracting audio locally…');const track=await getOriginal(signal);const ranges=chunkRanges(track.samples.length,track.rate,15);const transcript:Segment[]=[];
      for(let i=0;i<ranges.length;i++){signal.throwIfAborted();const part=ranges[i];log(`Transcribing audio chunk ${i+1}/${ranges.length}…`);const result=await transcribe(encodeWav(track.samples.slice(part.start,part.end),track.rate),(part.end-part.start)/track.rate,provider);transcript.push(...offsetSegments(result,part.offset));setProgress((i+1)/ranges.length);}
      if(!transcript.length)throw new Error('No speech was detected. You can supply Khmer subtitles instead.');
      const valid=validateSegments(transcript.map((s,i)=>({...s,id:String(i+1),end:Math.min(s.end,duration)})),duration);setStage(2);setProgress(0);next=[];
      for(let i=0;i<valid.length;i+=40){const part=valid.slice(i,i+40);const translated=await translate(part,provider);next.push(...translated.map((s,j)=>({...s,id:String(i+j+1)})));setProgress(Math.min(1,(i+40)/valid.length));}
      next=validateSegments(next,duration);setSegments(next);log('Translation ready. Review Khmer subtitles and voice hints below.');
    }
    if(mode==='full')await makeVoice(next,signal);else{setStage(2);setProgress(1);}
  }
  async function audition(segment:Segment){await run(async signal=>{validateSegments([segment],duration);if(settings.engine==='device'){speakDevice(segment.text);return;}const bytes=await speech(segment,signal);if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current=URL.createObjectURL(new Blob([bytes],{type:settings.engine==='edge'?'audio/mpeg':'audio/wav'}));previewAudio.current=new Audio(previewUrl.current);await previewAudio.current.play();log('Playing subtitle voice preview.');});}
  function sync(play=false, align=false){
    const player=video.current;
    const voice=audio.current;
    if(!player)return;
    if(voice && dubUrl){
      voice.playbackRate=player.playbackRate;
      if(voice.readyState && (align || Math.abs(voice.currentTime-player.currentTime)>.15)){
        voice.currentTime=Math.min(player.currentTime,voice.duration||duration);
      }
      if(play && !player.paused && !player.seeking && voice.paused){
        void voice.play().catch(error=>{
          if(error instanceof DOMException && error.name==='AbortError')return;
          player.pause();
          log('Khmer audio could not play. Press Preview Khmer dub to try again.');
        });
      }
    }
    if(deviceReady){
      const segment=segments.find(s=>player.currentTime>=s.start&&player.currentTime<s.end);
      if(segment&&spoken.current!==segment.id&&!player.paused){
        spoken.current=segment.id;
        try{speakDevice(segment.text);}
        catch(e){log(e instanceof Error?e.message:'Device voice unavailable.');}
      }
      if(!segment){window.speechSynthesis.cancel();spoken.current=null;}
    }
  }
  function previewDub(){
    const player=video.current;
    if(!player||!dubUrl)return;
    player.scrollIntoView({block:'nearest'});
    player.currentTime=0;
    void player.play().catch(()=>log('Could not start the preview. Press Play on the video.'));
  }
  function pause(){audio.current?.pause();window.speechSynthesis?.cancel();spoken.current=null;}
  async function retranslate(signal:AbortSignal){
    const current=validateSegments(segments,duration),provider=config(signal),corrected:Segment[]=[];
    setStage(2);setProgress(0);log('Translating existing subtitle text to Khmer; no video transcription needed.');
    for(let i=0;i<current.length;i+=40){const batch=await translate(current.slice(i,i+40),provider);corrected.push(...batch);setProgress(Math.min(1,(i+40)/current.length));}
    signal.throwIfAborted();invalidate();setSegments(validateSegments(corrected,duration));log('Khmer-script check passed. Review the wording, then generate the voice.');
  }
  function subtitleDownload(){try{download(new Blob([toSrt(validateSegments(dubbed?.captions ?? segments,duration))],{type:'application/x-subrip;charset=utf-8'}),'khmer-subtitles.srt');log('SRT downloaded.');}catch(e){log(e instanceof Error?e.message:'Invalid subtitles.');}}
  async function exportMedia(kind:'audio'|'video',signal:AbortSignal){if(!dub||!file)throw new Error('Generate an exportable voice first.');const source=volume>0?await getOriginal(signal):null;const mix=mixTracks(dub,source,volume);if(kind==='audio'){download(trackBlob(mix),'khmer-dub.wav');log('Mixed WAV downloaded.');}else{log('Exporting in real time. Keep this tab visible until complete.');setProgress(0);const result=await exportVideo(file,mix,signal,setProgress,includeSubtitles?(dubbed?.captions ?? []):[]);download(result.blob,`khmer-dub.${result.extension}`);log('Video exported.');}}
  return <>
    <header className="site-header"><a href="/" className="brand"><span className="brand-icon" aria-hidden="true">◖◗</span><span><strong>Khmer Dub Studio</strong><small>AI video dubbing · your voice, in Khmer</small></span></a><div className="header-actions"><button aria-label="Toggle light or dark theme" onClick={()=>setDark(!dark)}>◐</button></div></header>
    <main>
      <section className="hero"><div className="eyebrow hero-badge"><span className="status-dot"/> AI DUBBING STUDIO · <span lang="km">ភាសាខ្មែរ</span></div><h1>Dub any video into <span>Khmer</span></h1><p>Transcribe, translate and voice-over in one workspace.<br className="desktop-break"/> Your video stays on your device. Your stories go further.</p><div className="badges"><span>✦ Bring your own keys</span><span>✦ Natural Khmer voices</span><span>✦ Local video editing</span><span>✦ Audio + video export</span></div></section>
      <section className="card workspace" aria-label="Video workspace">
        <input ref={picker} className="sr-only" type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" aria-label="Choose video" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)chooseFile(f);e.target.value='';}}/>
        <button className={`dropzone ${dragging?'dragging':''}`} disabled={busy} onClick={()=>picker.current?.click()} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)chooseFile(f);}}><span className="upload-icon">↑</span><span><strong>{file?file.name:'Drop a video here or click to browse'}</strong><small>{file?'Click to replace · '+(file.size/1024/1024).toFixed(1)+' MB':'MP4, MOV, WebM · up to 500 MB / 15 minutes'}</small></span><span className="file-tag">{file?'CHANGE':'LOCAL FILE'}</span></button>
        {videoUrl&&<div className="player"><div className="preview-picture"><video ref={video} src={videoUrl} controls playsInline onLoadedMetadata={metadata} onDurationChange={metadata} onError={()=>{setDuration(0);log('This video cannot be decoded. Try MP4 H.264/AAC or WebM.');}} onPlay={()=>{if(busy)video.current?.pause();}} onPlaying={()=>sync(true,true)} onPause={pause} onWaiting={pause} onEnded={pause} onTimeUpdate={event=>{if(includeSubtitles)setCaptionTime(event.currentTarget.currentTime);sync();}} onRateChange={()=>sync(false,true)} onSeeking={pause} onSeeked={event=>{if(includeSubtitles)setCaptionTime(event.currentTarget.currentTime);sync(true,true);}}/>{caption&&<div className="preview-subtitles" lang="km"><span>{caption}</span></div>}</div>{dubUrl&&<audio ref={audio} src={dubUrl} preload="auto" onLoadedMetadata={()=>sync(true,true)}/>}<span className="player-caption">{dub?'Dubbed preview':deviceReady?'Live device voice':'Original preview'} · use Original audio to mix source sound</span></div>}
        <div className="processing-row"><label className="volume">◖ Original audio<input aria-label="Original audio volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><span>{Math.round(volume*100)}%</span></label><div className="process-split" ref={modeWrap}><button className="primary" disabled={!duration||busy} onClick={()=>void run(processVideo)}>{busy?'Processing…':mode==='full'?'✦ Dub to Khmer':'✎ Translate to Khmer'}</button><button aria-label="Choose processing mode" aria-expanded={menu} disabled={busy} onClick={()=>setMenu(!menu)} onKeyDown={e=>{if(e.key==='Escape')setMenu(false);}}>{mode==='full'?'Full Dub':'Translate Only'} ▾</button>{menu&&<div className="mode-menu"><button onClick={()=>{setMode('full');setMenu(false);}}>✦ Full Dub<strong>Transcribe → translate → Khmer voice</strong></button><button onClick={()=>{setMode('translate');setMenu(false);}}>✎ Translate Only<strong>Edit subtitles and gender before audio</strong></button></div>}</div>{busy&&<button className="cancel" onClick={()=>controller.current?.abort()}>Cancel</button>}</div>
        <progress max="1" value={progress} aria-label="Processing progress"/>
        <ol className="steps">{['Transcribe','Translate','Khmer voice'].map((label,i)=><li key={label} className={stage===i+1?'active':stage>i+1?'complete':''}><span>{stage>i+1?'✓':i+1}</span>{label}</li>)}</ol>
        <p className="status" role="status" aria-live="polite">{status}</p>
        <div className="log"><div><span>● ● ● &nbsp; BACKEND LOG</span><button onClick={()=>setLogs([])}>Clear</button></div><pre tabIndex={0} aria-label="Processing log">{logs.length?logs.join('\n'):'Waiting for your first video…'}</pre></div>
      </section>
      <Settings value={settings} onChange={updateSettings} log={log} disabled={busy}/>
      {!!segments.length&&<><SubtitleEditor segments={segments} onChange={next=>{invalidate();setSegments(next);}} onVoice={s=>void audition(s)} disabled={busy}/><section className="card export-card"><div><span className="eyebrow">READY FOR THE NEXT STEP</span><h2>Preview. Refine. Export.</h2><p className="hint">SRT keeps your text. WAV includes the chosen original-audio mix. Video export records at up to 1080p/30 fps in real time; timing and codec support vary by browser.</p></div><div className="button-row"><button disabled={busy} onClick={()=>void run(retranslate)}>Translate text to Khmer</button><button className="primary" disabled={busy||!duration} onClick={()=>void run(signal=>makeVoice(segments,signal))}>✦ Generate Khmer voice</button>{dubUrl&&<button disabled={busy} onClick={previewDub}>▶ Preview Khmer dub</button>}<button type="button" disabled={busy} aria-pressed={includeSubtitles} onClick={()=>{
          setCaptionTime(video.current?.currentTime ?? 0);
          setIncludeSubtitles(!includeSubtitles);
        }}>Include Khmer subtitles: {includeSubtitles?'On':'Off'}</button><button disabled={busy} onClick={subtitleDownload}>↓ SRT</button><button disabled={busy||!dub} onClick={()=>void run(signal=>exportMedia('audio',signal))}>↓ WAV</button><button disabled={busy||!dub} onClick={()=>void run(signal=>exportMedia('video',signal))}>↓ Download video</button></div><p className="hint" aria-live="polite">{!dub ? (status.includes('HTTP 429') ? 'Google is limiting speech requests. When quota is available, click Generate Khmer voice to resume.' : 'Preview and download unlock when the full Khmer audio track is ready.') : 'Preview the Khmer dub above or download the video with the same mix.'}</p></section></>}
      <aside className="privacy-note"><strong>A clear note on privacy</strong><p>Video stays local. Transcription sends extracted audio to Google; translation and speech send text to your chosen provider. API keys live only in this open tab. Microsoft speech passes through this app’s server. Check provider terms and pricing before processing.</p></aside>
    </main>
    <footer>Built independently for Khmer creators<small>Inspired by MT Dubber Free. No affiliation or copied source code.</small></footer>
  </>;
}
