import {execFile} from 'node:child_process';
import {join} from 'node:path';
import {boundedJson, error} from '@/lib/server';

export const runtime = 'nodejs';
const voices = new Set(['km-KH-PisethNeural', 'km-KH-SreymomNeural']);
const localOrigins = new Set(['http://127.0.0.1:3000', 'http://localhost:3000']);
let active = false;

export async function POST(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  const localDevelopment = process.env.NODE_ENV !== 'production' &&
    localOrigins.has(origin) && request.headers.get('host') === new URL(origin).host;
  const protectedHost = Boolean(process.env.STUDIO_ACCESS_PASSWORD) &&
    origin.startsWith('https://') && origin === process.env.APP_ORIGIN;
  if ((!localDevelopment && !protectedHost) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return error('Edge voice requires localhost development or a protected HTTPS deployment.', 403);
  }

  let payload;
  try {
    payload = await boundedJson(request) as {text?: unknown; voice?: unknown} | null;
  } catch {
    return error('Invalid voice request.', 400);
  }
  const text = payload?.text;
  const voice = payload?.voice;
  if (typeof text !== 'string' || !text.trim() || text.length > 3000 ||
      typeof voice !== 'string' || !voices.has(voice)) {
    return error('Send up to 3,000 characters and select a Khmer voice.', 400);
  }
  if (active) return error('Edge voice is handling another clip. Try again shortly.', 429);
  active = true;
  try {
    const audio = await new Promise<Buffer>((resolve, reject) => {
      const python = process.env.EDGE_TTS_PYTHON || join(process.cwd(), '.venv-edge', 'bin', 'python');
      const child = execFile(python, [join(process.cwd(), 'scripts', 'edge_voice.py')], {
        encoding: 'buffer',
        maxBuffer: 4 * 1024 * 1024,
        timeout: 45_000,
        signal: request.signal
      }, (failure, output, stderr) => {
        if (!failure) return resolve(output);
        if (failure.code === 'ENOENT' || stderr.toString().includes("No module named 'edge_tts'")) {
          return reject(new Error('Edge voice setup is missing. Run the setup commands in README.md.'));
        }
        reject(new Error('Microsoft Edge speech did not return audio.'));
      });
      child.stdin?.on('error', () => {});
      child.stdin?.end(JSON.stringify({text, voice}));
    });
    if (!audio.length) return error('Microsoft Edge speech returned an empty clip.', 502);
    return new Response(Uint8Array.from(audio), {headers: {'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store'}});
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : 'Edge voice unavailable.';
    return error(message, message.startsWith('Edge voice setup') ? 503 : 502);
  } finally {
    active = false;
  }
}
