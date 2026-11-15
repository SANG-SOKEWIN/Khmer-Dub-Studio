# Independent architecture — initial plan (before implementation)

## Stack and rationale
Next.js App Router, React, TypeScript and Tailwind CSS; Node.js route handlers; PostgreSQL/Prisma for anonymous session expiry and atomic per-session request budgets. No invented account registration. Browser-first media handling preserves local video and avoids a video upload database. API keys remain in page memory; never persisted in localStorage or database.

Only the Microsoft speech equivalent needs a server. Use Microsoft's documented Azure Speech API with the same Piseth/Sreymom voices instead of attempting to reproduce an inaccessible Edge relay. This requires the visitor's Azure key/region and differs from the reference's advertised free Edge path. Gemini requests go directly from the browser to Google using the visitor's key. Local device speech needs no credentials but depends on installed Khmer voices and cannot export audio.

## Routes and components
`/`: Studio → Header, Hero, VideoWorkspace, ProcessingControls, Progress, Log, SettingsTabs (Providers/Pipeline/Subtitles), SubtitleEditor, Exports, SupportDialog.
`POST /api/session`: issue/reuse an opaque HttpOnly SameSite session, hashed in PostgreSQL, eight-hour expiry.
`POST /api/speech`: validate origin/session/budget/body, proxy bounded SSML requests to a fixed Azure hostname, return WAV. No arbitrary proxy target.

## Responsibilities
Browser: video decode/audio extraction, WAV encoding, bounded audio chunks, SRT parsing/validation, provider/model fallbacks, subtitle editing/gender selection, voice synthesis scheduling, Web Audio mixing, native video preview, SRT/WAV download, real-time canvas/MediaRecorder video export, cancellation and error feedback.
Server: Microsoft key never stored; bounded provider call; input/SSML validation; origin/CSRF checks; timeouts; session rate limit; generic safe errors.
Database: Session(id hash PK, expiresAt, createdAt, windowStart, requestCount). No media, transcripts, identities or provider credentials stored. Expired sessions pruned during issuance. No user-facing persistence claim.

## Pipeline
1. Validate video type/size, load metadata and reject unsupported/overlong media.
2. If subtitles supplied, parse exact text/times or distribute lines. Otherwise extract audio locally, chunk to bounded WAVs, transcribe via Gemini structured JSON, then translate text to Khmer while preserving timing.
3. Expose editable segments and genders. Translate Only stops here.
4. Synthesize each segment using Gemini PCM/WAV, Azure Khmer voices, or installed device voice. Fit generated audio to each slot; gaps remain silent. Preview synchronized with original volume.
5. Export SRT and mixed WAV; video export captures the original video through canvas plus the mixed audio. Browser-dependent WebM/MP4 codecs, real-time recording: explicitly not a promise of frame accuracy or source codec preservation.

## Security and limits
No credentials in logs or URLs. Fixed upstream hostnames, XML escaping, strict region/model names, per-call deadline, bounded input and provider output checks, cancellation through AbortSignal. Session cookie Secure in production, same-origin POST enforcement, persistent rate limiting. Credentials are BYOK so anonymous sessions cannot spend a server-owned key. CSP permits Google provider access and local blobs. No remote media URLs accepted. Browser processing capped at 15 minutes/500 MB to bound memory; disclose this difference.

## Verification plan
Node native TypeScript tests: subtitle round trips, Unicode, invalid timing/overlap, limits, PCM/WAV, chunk offsets, schema/model sanitization, provider retry classification, SSML escaping. Playwright workflow tests: import, modes, tabs, key visibility, validation, subtitle editing/download, themes/mobile, mocked provider contracts (explicitly not live AI verification). PostgreSQL integration: session expiry, cross-origin rejection, rate limits. Real provider test requires valid visitor credentials; do not fabricate success.
