export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  if (!Number.isInteger(rate) || rate<8000 || rate>192000) throw new Error('Unsupported sample rate.');
  const buffer = new ArrayBuffer(44+samples.length*2), view = new DataView(buffer);
  const str=(at:number,s:string)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
  str(0,'RIFF'); view.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((sample,i)=>{const x=Math.max(-1,Math.min(1,Number.isFinite(sample)?sample:0));view.setInt16(44+i*2,Math.round(x*(x<0?32768:32767)),true);});
  return buffer;
}
export function pcmToWav(bytes: Uint8Array, rate=24000): ArrayBuffer {
  if (bytes.byteLength%2) throw new Error('Invalid PCM payload.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), samples=new Float32Array(bytes.byteLength/2);
  for(let i=0;i<samples.length;i++) samples[i]=view.getInt16(i*2,true)/32768;
  return encodeWav(samples,rate);
}
export function chunkRanges(length:number, sampleRate:number, seconds=45): {start:number;end:number;offset:number}[] {
  if (!Number.isInteger(length)||length<=0||!Number.isInteger(sampleRate)||sampleRate<1||seconds<=0) throw new Error('Invalid audio length.');
  const result=[]; const size=Math.floor(sampleRate*seconds);
  if(size<1)throw new Error('Chunk is too short.');
  for(let start=0;start<length;start+=size)result.push({start,end:Math.min(length,start+size),offset:start/sampleRate});
  return result;
}
