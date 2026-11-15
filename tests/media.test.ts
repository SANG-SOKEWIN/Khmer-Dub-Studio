import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mixTracks,trackBlob,renderDub} from '../src/lib/media.ts';
test('audio mixing aligns sample rates, respects source volume and clips safely',()=>{const dub={samples:new Float32Array([.5,.5,.5,.5]),rate:24000};const original={samples:new Float32Array([1,0]),rate:12000};assert.deepEqual(Array.from(mixTracks(dub,original,0).samples),[.5,.5,.5,.5]);assert.deepEqual(Array.from(mixTracks(dub,original,1).samples),[1,1,.5,.5]);assert.deepEqual(Array.from(dub.samples),[.5,.5,.5,.5]);});
test('WAV download is a real RIFF payload, not a renamed audio placeholder',async()=>{const blob=trackBlob({samples:new Float32Array(240),rate:24000});assert.equal(blob.type,'audio/wav');const bytes=await blob.arrayBuffer();assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'RIFF');assert.equal(bytes.byteLength,524);});

test('dub captions follow queued speech at normal speed and stop at the video end', async () => {
  const original = globalThis.OfflineAudioContext;
  const starts: number[] = [];
  class FakeOfflineAudioContext {
    destination = {};
    async decodeAudioData(clip: ArrayBuffer) { return {duration: new Uint8Array(clip)[0]}; }
    createBufferSource() {
      return {buffer: null, connect() {}, start(seconds: number) { starts.push(seconds); }};
    }
    async startRendering() { return {getChannelData: () => new Float32Array(1)}; }
  }
  globalThis.OfflineAudioContext = FakeOfflineAudioContext as unknown as typeof OfflineAudioContext;
  try {
    const segments = [0, 1, 2].map(start => ({
      id: String(start), start, end: start + 1, text: 'សួស្តី', gender: 'female' as const,
    }));
    const {captions, overflowSeconds} = await renderDub(
      segments, [Uint8Array.of(2).buffer, Uint8Array.of(2).buffer, null], 3, new AbortController().signal,
    );
    assert.deepEqual(starts, [0, 2]);
    assert.deepEqual(captions.map(({start, end}) => [start, end]), [[0, 2], [2, 3]]);
    assert.equal(overflowSeconds, 1);
  } finally {
    globalThis.OfflineAudioContext = original;
  }
});
