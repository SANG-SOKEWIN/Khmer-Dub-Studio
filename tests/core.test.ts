import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSubtitles,parseTimestamp,toSrt,validateSegments,timestamp,offsetSegments} from '../src/lib/subtitles.ts';
import {encodeWav,pcmToWav,chunkRanges} from '../src/lib/wav.ts';
import {modelNames,speechRequest,ssml,retryable,jsonText} from '../src/lib/contracts.ts';
const srt='1\r\n00:00:00,000 --> 00:00:01,500\r\nសួស្តី!\r\n\r\n2\r\n00:00:02,000 --> 00:00:03,000\r\nអរគុណ។';
test('SRT round trip preserves Khmer, text, timing and line breaks',()=>{const x=parseSubtitles(srt,3);assert.equal(x[0].text,'សួស្តី!');assert.deepEqual(parseSubtitles(toSrt(x),3),x);});
test('plain lines are distributed evenly without rewriting wording',()=>{const x=parseSubtitles('  សួស្តី\nពិភពលោក\nអរគុណ  ',9);assert.deepEqual(x.map(s=>[s.start,s.end]),[[0,3],[3,6],[6,9]]);});
test('multiline text and UTF-8 BOM are accepted',()=>{const x=parseSubtitles('\uFEFF1\n00:00:00.000 --> 00:00:01.000\nសួស្តី\nHello',2);assert.equal(x[0].text,'សួស្តី\nHello');});
test('timestamps validate minutes and milliseconds',()=>{assert.equal(parseTimestamp('01:02:03,004'),3723.004);for(const t of ['00:99:00,000','1:00:00,000','00:00:00,0'])assert.throws(()=>parseTimestamp(t));assert.equal(timestamp(59.9999),'00:01:00,000');});
test('invalid and overlapping subtitle times are rejected',()=>{for(const [start,end] of [[-1,1],[1,1],[2,1],[0,5],[NaN,1],[0,Infinity]])assert.throws(()=>validateSegments([{start,end,text:'x',gender:'female'}],3));assert.throws(()=>parseSubtitles('1\n00:00:00,000 --> 00:00:02,000\nx\n\n2\n00:00:01,000 --> 00:00:03,000\ny',3),/overlaps/);});
test('empty, too long, malformed, and too many subtitles fail',()=>{assert.throws(()=>parseSubtitles('',2));assert.throws(()=>parseSubtitles('hello',901));assert.throws(()=>parseSubtitles('hello --> broken',2));assert.throws(()=>parseSubtitles(Array(501).fill('a').join('\n'),10));assert.throws(()=>parseSubtitles('a'.repeat(500001),10));});
test('gender and text validation rejects provider drift',()=>{assert.throws(()=>validateSegments([{start:0,end:1,text:'',gender:'female'}]));assert.throws(()=>validateSegments([{start:0,end:1,text:'x',gender:'other'}]));});
test('audio chunk offsets preserve global timing',()=>{assert.deepEqual(chunkRanges(100,10,4),[{start:0,end:40,offset:0},{start:40,end:80,offset:4},{start:80,end:100,offset:8}]);assert.equal(offsetSegments(parseSubtitles('hello',2),45)[0].end,47);assert.throws(()=>chunkRanges(0,10));});
test('WAV headers and clipping are correct',()=>{const wav=encodeWav(new Float32Array([-2,-1,0,1,2,NaN]),24000),v=new DataView(wav);assert.equal(new TextDecoder().decode(wav.slice(0,4)),'RIFF');assert.equal(v.getUint32(24,true),24000);assert.equal(v.getUint32(40,true),12);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(50,true),32767);assert.equal(v.getInt16(54,true),0);assert.throws(()=>encodeWav(new Float32Array(1),1));});
test('raw PCM is wrapped as mono WAV',()=>{const bytes=new Uint8Array([0,0,255,127,0,128]);const v=new DataView(pcmToWav(bytes));assert.equal(v.getUint16(22,true),1);assert.equal(v.getInt16(48,true),-32768);assert.throws(()=>pcmToWav(new Uint8Array(3)));});
test('model names cannot inject URL paths or queries',()=>{assert.deepEqual(modelNames('models/gemini-2.5-flash\ngemini-2.5-flash'),['gemini-2.5-flash']);for(const x of ['','https://evil.test','gemini-a?key=secret','gemini-../../'])assert.throws(()=>modelNames(x));});
test('SSML escapes markup and provider input is bounded',()=>{assert.ok(ssml('<tag>&"\'','km-KH-PisethNeural').includes('&lt;tag&gt;&amp;&quot;&apos;'));const valid={text:'សួស្តី',voice:'km-KH-PisethNeural',region:'southeastasia',key:'a'.repeat(32)};assert.deepEqual(speechRequest(valid),valid);for(const change of [{region:'foo/evil'},{region:'foo.example.com'},{voice:'evil'},{text:'x'.repeat(3001)},{text:'x\u0000'},{key:'x'}])assert.throws(()=>speechRequest({...valid,...change}));});
test('only transient/unavailable model statuses allow fallback',()=>{assert.ok(retryable(429));assert.ok(retryable(503));assert.ok(retryable(404));assert.equal(retryable(403),false);assert.equal(retryable(400),false);});
test('JSON parser accepts fenced JSON but never executes text',()=>{assert.deepEqual(jsonText('```json\n[{"x":1}]\n```'),[{x:1}]);assert.throws(()=>jsonText('alert(1)'));});

test('model refresh replaces retired defaults using account-discovered names',async()=>{
  const {reconcileModels}=await import('../src/lib/contracts.ts');
  assert.equal(reconcileModels('gemini-retired', ['gemini-current-pro','gemini-current-flash','gemini-current-tts','gemini-live'], 'text'),'gemini-current-flash\ngemini-current-pro');
  assert.equal(reconcileModels('gemini-current-pro', ['gemini-current-pro','gemini-current-flash'], 'text'),'gemini-current-pro\ngemini-current-flash');
  assert.equal(reconcileModels('gemini-retired-tts', ['gemini-current-flash','gemini-current-tts'], 'speech'),'gemini-current-tts');
  assert.equal(reconcileModels('gemini-retired', [], 'text'),'');
});

test('Khmer guard rejects Thai, mixed Thai/Khmer, and romanized output',async()=>{
 const {requireKhmer}=await import('../src/lib/contracts.ts');
 requireKhmer('សួស្តី!');requireKhmer('១២៣');requireKhmer('1875');
 for(const text of ['สวัสดี','សួស្តី สวัสดี','Hello','suosdei'])assert.throws(()=>requireKhmer(text));
});
