export type Gender = 'male' | 'female';
export type Segment = { id: string; start: number; end: number; text: string; gender: Gender };
export const MAX_DURATION = 900;
export const MAX_SEGMENTS = 500;
export function validateSegments(input: unknown, duration = MAX_DURATION): Segment[] {
  if (!Array.isArray(input) || !input.length || input.length > MAX_SEGMENTS) throw new Error('Provide 1–500 subtitle segments.');
  let previousEnd = 0;
  return input.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`Invalid subtitle ${i+1}.`);
    const {start,end,text,gender} = item as Record<string, unknown>;
    if (typeof start !== 'number' || typeof end !== 'number' || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + .05) throw new Error(`Subtitle ${i+1}: times must fit inside the video, with end after start.`);
    if (start < previousEnd - .001) throw new Error(`Subtitle ${i+1} overlaps the previous subtitle.`);
    if (typeof text !== 'string' || !text.trim() || text.length > 3000) throw new Error(`Subtitle ${i+1}: enter 1–3000 characters.`);
    if (gender !== 'male' && gender !== 'female') throw new Error(`Subtitle ${i+1}: choose male or female.`);
    previousEnd = end;
    return {id:String(i+1), start, end, text, gender};
  });
}
export function parseTimestamp(s: string): number {
  const match = s.trim().match(/^(\d{2,}):([0-5]\d):([0-5]\d)[,.](\d{3})$/);
  if (!match) throw new Error(`Invalid SRT timestamp: ${s}`);
  return Number(match[1])*3600 + Number(match[2])*60 + Number(match[3]) + Number(match[4])/1000;
}
export function parseSubtitles(input: string, duration: number): Segment[] {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION) throw new Error('Load a video of up to 15 minutes first.');
  if (input.length > 500_000) throw new Error('Subtitle input is too large (500,000 characters maximum).');
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g,'\n').trim();
  if (!text) throw new Error('Paste Khmer text or upload an SRT file.');
  let segments: Segment[];
  if (text.includes('-->')) {
    segments = text.split(/\n\s*\n/).map((block,i) => {
      const lines = block.split('\n');
      if (/^\d+$/.test(lines[0].trim())) lines.shift();
      const timing = lines.shift()?.match(/^(.*?)\s*-->\s*(.*?)\s*$/);
      if (!timing || !lines.length) throw new Error(`Invalid SRT block ${i+1}.`);
      return {id:String(i+1),start:parseTimestamp(timing[1]),end:parseTimestamp(timing[2]),text:lines.join('\n'),gender:'female'};
    });
  } else {
    const lines = text.split('\n').filter(line=>line.trim());
    segments = lines.map((line,i)=>({id:String(i+1),start:i*duration/lines.length,end:(i+1)*duration/lines.length,text:line,gender:'female'}));
  }
  return validateSegments(segments,duration);
}
export function timestamp(seconds: number): string {
  const total = Math.round(seconds*1000);
  return `${String(Math.floor(total/3600000)).padStart(2,'0')}:${String(Math.floor(total/60000)%60).padStart(2,'0')}:${String(Math.floor(total/1000)%60).padStart(2,'0')},${String(total%1000).padStart(3,'0')}`;
}
export function toSrt(segments: Segment[]): string {
  return validateSegments(segments).map((s,i)=>`${i+1}\n${timestamp(s.start)} --> ${timestamp(s.end)}\n${s.text}`).join('\n\n')+'\n';
}
export function offsetSegments(segments: Segment[], offset: number): Segment[] {
  return segments.map(s=>({...s,start:s.start+offset,end:s.end+offset}));
}

export function subtitleAt(segments: readonly Segment[], seconds: number): string {
  return segments.find(segment => segment.start <= seconds && seconds < segment.end)?.text ?? '';
}
