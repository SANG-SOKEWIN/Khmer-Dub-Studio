# Feature parity and running checklist

Status vocabulary: **Tested core** = dependency-free automated tests passed; **Written / unverified** = implementation exists but browser/framework or live-provider verification is incomplete; **Difference** = intentional independent substitute or known gap. Nothing below claims full end-to-end completion.

| Reference feature | Input → action → expected output | Implementation / verification |
|---|---|---|
| Single page and three settings tabs | Select tab → show provider, pipeline or subtitle panel | Written / unverified; Playwright suite supplied |
| Light/dark | Toggle → switch theme, retain preference | Written / unverified; only theme persisted |
| Video import/drop | MP4/MOV/WebM → decode metadata → preview and enable processing | Written / unverified; 500 MB / 15 min caps; codec errors surfaced |
| Original audio volume | 0–100% → source volume → preview/export mix | Mix algorithm tested core; playback unverified |
| Full Dub | Video + keys → transcribe/translate/synthesize → editable subtitles and dubbed preview | Written / unverified end-to-end; provider contracts tested with synthetic responses |
| Translate Only | Video + keys → transcribe/translate → editor, no voice call | Written / unverified; later voice generation separate |
| Subtitle override | SRT/plain Khmer → skip AI transcription/translation → timed segments | Parser and exact text/timing round trip tested core; UI unverified |
| SRT errors | Invalid/overlapping/out-of-range times → error → no synthesis/export | Tested core; stricter validation than unverified reference behavior |
| Key management | Add/remove/reveal/verify keys → Google model list → status | Written / unverified live; pagination and filtering contract tested |
| Model fallback | Ordered model list → bounded fallback for 404/429/5xx → output or explicit error | Tested core with synthetic HTTP; no live quota claim |
| Providers enable | Disable Gemini → reject operations requiring it | Written / unverified UI |
| Microsoft/Edge voices | Text + gender → Piseth/Sreymom → audio | **Difference:** documented Azure API, BYOK key/region, server/DB needed; no reverse-engineered Edge relay |
| Gemini voices | Text + one of 30 observed voice names → PCM/WAV → audio | PCM conversion and response contract tested; live Khmer quality unverified |
| Device voice | Khmer installed voice + segments → synchronized live speech | Written / unverified; explicit error if no Khmer voice; no export |
| Edit text/times/gender | Change segment → invalidate previous audio → regeneration | Written / unverified. Post-upload reference UI inferred from mode description, not inspected |
| Per-line voice preview | Select Voice → synthesize/play only that line | Written / unverified live |
| Progress/log clearing | Stage/chunk response → progress/status; Clear → remove log entries | Written / unverified UI |
| SRT download | Valid segments → serialized SRT → file | Serialization tested core; download workflow unverified |
| WAV download | Generated speech + original mix → RIFF PCM WAV | WAV bytes and mixing tested core; full speech workflow unverified |
| Video export | Original video + generated mix → MediaRecorder → WebM/MP4 | Written / unverified; real time, max 1080p/30 fps; **not frame-accurate parity** |
| Automatic playback after Full Dub | Generated voice → playback | **Difference:** user presses Play to avoid autoplay restrictions |
| Support modal | Open → original Telegram link or close | Written / unverified; clearly attributed to original creator |
| Responsive layout | Narrow viewport → stacked controls/cards | CSS written; mobile browser verification pending |
| Cancel/errors | Abort → stop requests/playback/recording → preserve existing editor data | Request cancellation tested core; browser cleanup unverified |
| Authentication | No account UI observed | No account UI added; anonymous server sessions only |
| Database | No reference database observed | New session-only PostgreSQL schema/migration supplied; DB integration tests not run |

## Remaining acceptance gates
- [x] Inspect all reachable settings, processing menus, theme and support interactions.
- [x] Complete initial architecture plan before application implementation.
- [x] Independently write browser processing and real provider/server code.
- [x] Run 24 core and synthetic provider-contract tests.
- [ ] Install dependencies and resolve/pin a lockfile (npm DNS unavailable here).
- [ ] Run Prisma generation, Next.js build, TypeScript checks and dependency audit.
- [ ] Run PostgreSQL session tests and concurrent rate-limit tests.
- [ ] Run Playwright desktop/mobile workflows; save reference/rebuild comparison screenshots.
- [ ] Validate real video audio extraction, device speech, generated audio and exported media in each target browser.
- [ ] Validate Google and Microsoft integrations using authorized test credentials.
- [ ] Measure accessibility and performance with the built app.
- [ ] Deploy only after these gates pass. No deployment has occurred.
