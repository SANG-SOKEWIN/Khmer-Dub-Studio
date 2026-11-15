'use client';
import {useRef,useState} from 'react';
import {listModels,VOICES} from '@/lib/providers';
import {reconcileModels} from '@/lib/contracts';
export type SettingsValue={keys:string[];enabled:boolean;models:string;engine:'edge'|'azure'|'gemini'|'device';edgeVoice:'auto'|'male'|'female';geminiVoice:string;ttsModels:string;azureKey:string;azureRegion:string;subtitleInput:string};
const githubPages = process.env.NEXT_PUBLIC_GITHUB_PAGES === '1';
export const INITIAL_SETTINGS:SettingsValue={keys:[''],enabled:true,models:'gemini-flash-lite-latest',engine:githubPages?'gemini':'edge',edgeVoice:'male',geminiVoice:'Zephyr',ttsModels:'gemini-3.8-flash-lite-tts',azureKey:'',azureRegion:'southeastasia',subtitleInput:''};
export default function Settings({value,onChange,log,disabled}:{value:SettingsValue;onChange:(s:SettingsValue)=>void;log:(m:string)=>void;disabled:boolean}){
  const [tab,setTab]=useState('Providers'),[show,setShow]=useState(false),[checking,setChecking]=useState(false),[statuses,setStatuses]=useState<Record<number,string>>({});
  const busy=useRef(false);const current=useRef(value);current.current=value;
  const update=(patch:Partial<SettingsValue>)=>onChange({...current.current,...patch});
  async function check(index?:number,load=false){
    if(busy.current)return;busy.current=true;setChecking(true);
    const checkedKeys=[...value.keys];
    try{
      const entries=checkedKeys.map((key,i)=>({key,i})).filter(k=>(index===undefined||index===k.i)&&k.key.trim());
      if(!entries.length)throw new Error('Add a Gemini key first.');
      for(const entry of entries){
        try{
          const models=await listModels(entry.key);
          if(current.current.keys[entry.i]!==entry.key)continue;
          setStatuses(s=>({...s,[entry.i]:'Ready'}));
          log(`Key ${entry.i+1}: valid; ${models.length} models found.`);
          if(load){
            const tts=reconcileModels(current.current.ttsModels,models,'speech').split('\n').filter(Boolean);
            if(!models.includes(current.current.ttsModels)&&tts.length)update({ttsModels:tts[0]});
            log(`Selected text model kept: ${current.current.models}. ${models.includes(current.current.models)?'Listed by Google.':'Not listed by Google; select another model explicitly if needed.'}`);
          }
          if(load)break;
        }
        catch(e){const message=e instanceof Error?e.message:'Key verification failed.';if(current.current.keys[entry.i]===entry.key)setStatuses(s=>({...s,[entry.i]:message}));log(`Key ${entry.i+1}: ${message}`);}
      }
    }catch(e){log(e instanceof Error?e.message:'Key verification failed.');}finally{busy.current=false;setChecking(false);}
  }
  return <section className="card settings" aria-label="Dubbing settings">
    <div role="tablist" aria-label="Settings" className="tabs">{['Providers','Pipeline','Subtitles'].map((name,i)=><button key={name} id={`tab-${name}`} role="tab" aria-selected={tab===name} aria-controls={`panel-${name}`} tabIndex={tab===name?0:-1} onKeyDown={e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();const names=['Providers','Pipeline','Subtitles'];const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setTab(names[next]);document.getElementById(`tab-${names[next]}`)?.focus();}}} onClick={()=>setTab(name)}>{name}</button>)}</div>
    <fieldset disabled={disabled||checking} className="settings-fields"><div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
    {tab==='Providers'&&<>
      <p className="hint">Add your own Gemini keys. Verification contacts Google. Keys stay in this tab’s memory and disappear when you reload.</p>
      <div className="provider-heading"><label className="inline"><input type="checkbox" checked={value.enabled} onChange={e=>update({enabled:e.target.checked})}/> <strong>Gemini</strong><span className="pill">transcribe · translate · voice</span></label><a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a key ↗</a></div>
      {value.keys.map((key,i)=><div key={i} className="key-entry"><span className="key-number">{i+1}</span><div className="grow"><input aria-label={`Gemini key ${i+1}`} autoComplete="off" spellCheck={false} type={show?'text':'password'} value={key} placeholder="Paste Gemini API key" onBlur={()=>{if(key.trim())void check(i);}} onChange={e=>{update({keys:value.keys.map((k,j)=>j===i?e.target.value:k)});setStatuses(s=>({...s,[i]:''}));}}/>{statuses[i]&&<span className="hint">{statuses[i]}</span>}</div><button type="button" aria-label={`Remove key ${i+1}`} onClick={()=>{update({keys:value.keys.length===1?['']:value.keys.filter((_,j)=>j!==i)});setStatuses({});}}>×</button></div>)}
      <div className="button-row"><button onClick={()=>update({keys:[...value.keys,'']})} disabled={value.keys.length>=10}>＋ Add key</button><button onClick={()=>setShow(!show)}>{show?'Hide':'Show'} keys</button><button onClick={()=>void check()}>{checking?'Checking…':'✓ Check keys'}</button><span className="hint">{value.keys.filter(k=>k.trim()).length} keys</span></div>
      <div className="label-row"><label htmlFor="models">Text model (one)</label><button onClick={()=>void check(undefined,true)}>↻ Load models</button></div><textarea id="models" rows={1} value={value.models} onChange={e=>update({models:e.target.value})}/><p className="hint">Transcription and translation use this model only. Temporary server errors retry the same model; no automatic switching.</p>
    </>}
    {tab==='Pipeline'&&<>
      <label htmlFor="engine">Khmer voice</label><select id="engine" value={value.engine} onChange={e=>update({engine:e.target.value as SettingsValue['engine']})}>{!githubPages&&<><option value="edge">Edge voice — Sreymom / Piseth</option><option value="azure">Microsoft Khmer voices — Piseth / Sreymom</option></>}<option value="gemini">Gemini voice — exportable</option><option value="device">This device’s Khmer voice — playback only</option></select>
      {value.engine==='edge'&&<div className="stack">
        <label htmlFor="edge-selection">Edge voice</label>
        <select id="edge-selection" value={value.edgeVoice} onChange={e=>update({edgeVoice:e.target.value as SettingsValue['edgeVoice']})}>
          <option value="auto">Auto from subtitle gender</option>
          <option value="male">Piseth · one voice throughout</option>
          <option value="female">Sreymom · one voice throughout</option>
        </select>
        <p className="hint">Subtitle text is sent to Microsoft for speech generation. Your video stays on this device.</p>
      </div>}
      {value.engine==='azure'&&<div className="stack"><p className="notice">Independent equivalent to the reference’s Edge voice option. Uses Microsoft Azure Speech and requires your own key; provider charges may apply. Text and key pass through this app’s server to Microsoft.</p><label htmlFor="edge-voice">Voice selection</label><select id="edge-voice" value={value.edgeVoice} onChange={e=>update({edgeVoice:e.target.value as SettingsValue['edgeVoice']})}><option value="auto">Auto from subtitle gender (♂ Piseth / ♀ Sreymom)</option><option value="male">Piseth · male only</option><option value="female">Sreymom · female only</option></select><div className="field-grid"><div><label htmlFor="azure-key">Azure Speech key</label><input id="azure-key" type="password" autoComplete="off" value={value.azureKey} onChange={e=>update({azureKey:e.target.value})}/></div><div><label htmlFor="azure-region">Azure region</label><input id="azure-region" value={value.azureRegion} onChange={e=>update({azureRegion:e.target.value.trim()})}/></div></div></div>}
      {value.engine==='gemini'&&<div className="stack"><label htmlFor="gemini-voice">Gemini voice style</label><select id="gemini-voice" value={value.geminiVoice} onChange={e=>update({geminiVoice:e.target.value})}><optgroup label="Female voice styles">{VOICES.slice(0,14).map(v=><option key={v}>{v}</option>)}</optgroup><optgroup label="Male voice styles">{VOICES.slice(14).map(v=><option key={v}>{v}</option>)}</optgroup></select><label htmlFor="tts-models">Voice model (one)</label><textarea id="tts-models" rows={1} value={value.ttsModels} onChange={e=>update({ttsModels:e.target.value})}/><p className="hint">Khmer pronunciation depends on model support. Use Voice on a subtitle to audition it.</p></div>}
      {value.engine==='device'&&<p className="notice">Requires an installed Khmer speech voice. Device speech is played live and cannot be captured for WAV or video export. We never substitute another language silently.</p>}
    </>}
    {tab==='Subtitles'&&<>
      <p className="hint">Optional: paste Khmer SRT or plain Khmer text. This bypasses transcription and translation and keeps your wording. Plain lines are spread evenly across the video.</p>
      <label className="file-label" htmlFor="subtitle-file">Import .srt or .txt</label><input id="subtitle-file" type="file" accept=".srt,.txt,text/plain" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>500000){log('Subtitle file must be under 500 KB.');return;}try{update({subtitleInput:await f.text()});log('Subtitle file loaded.');}catch{log('Could not read subtitle file.');}e.target.value='';}}/>
      <label htmlFor="subtitle-input">Khmer subtitles or text</label><textarea id="subtitle-input" rows={8} placeholder={'1\n00:00:00,000 --> 00:00:03,000\nសួស្តី!'} value={value.subtitleInput} onChange={e=>update({subtitleInput:e.target.value})}/>
    </>}
    </div></fieldset>
  </section>;
}
