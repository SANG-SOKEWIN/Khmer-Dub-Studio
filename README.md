# Khmer Dub Studio

Independent browser-first rebuild of the observable MT Dubber Free workflow. Next.js, React, TypeScript, Tailwind, Node API handlers, PostgreSQL and Prisma.

**Deployment status:** The studio runs locally. See the deployment section below to host the default Edge voice workflow.

## What is included
- Single-page dubbing workspace, original audio mix, provider keys/model lists, full/translation-only modes, three voice engines, subtitles, editor and exports.
- Real Gemini request adapter; real Azure Speech route using the same named Khmer voices as the reference's Edge option; browser speech fallback.
- SRT/plain-text parser, chunked transcription, translation, Web Audio rendering, local media handling, WAV/SRT and MediaRecorder video export.
- Anonymous session backend, PostgreSQL migration, origin checks and atomic per-session budget. No invented user accounts or stored media.
- Core/contract tests, Playwright test definitions and database integration tests.

## Local setup
Prerequisites: Node 22.18+ (Node 24 LTS recommended), npm, PostgreSQL 17 or Docker. Network access to npm is required the first time.

```sh
npm install
cp .env.example .env
```

Set a strong local database password in `.env`'s `DATABASE_URL`, and match `APP_ORIGIN` to the exact origin you open. Default is `http://localhost:3000`; `127.0.0.1` is a different origin. For Docker:

```sh
POSTGRES_PASSWORD='your-local-password' docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. Do not enter real credentials until you trust your deployment. The UI stores keys only in React memory; reload clears them. Only the theme is saved in localStorage. Database connectivity is needed for the Microsoft speech adapter; Google and device speech processing are browser-local apart from their direct provider calls.

## First workflow
1. Choose an MP4/MOV/WebM video up to 500 MB and 15 minutes.
2. In Providers, add a Gemini key and verify it. Load account-available models if the defaults are unavailable.
3. In Pipeline choose a voice engine. Microsoft needs an Azure Speech key/region. Gemini needs a TTS-capable model. Device voice requires an installed Khmer voice.
4. Select Translate Only to inspect the transcript before speech, or Full Dub for the full pipeline.
5. Alternatively, paste Khmer text or SRT in Subtitles; no transcription/translation request is made.
6. Edit text/timing/gender, generate voice, play video, set original-audio volume and export.

Google receives extracted audio for transcription and text for translation/TTS. Microsoft receives subtitle text; its key and text pass through this application's server. Video files are not uploaded. Provider pricing and quotas apply. The Microsoft option is an independent Azure replacement, not the original free Edge service.

## Verification
```sh
npm test                 # no installed third-party dependencies required
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e          # launches the development server
# With a development server running and a disposable test PostgreSQL DB:
npm run db:test
```

Integration tests require DATABASE_URL in the test process environment (Node's test runner does not implicitly load .env). Use `node --env-file=.env --experimental-strip-types --test tests/integration/*.test.ts`, after pointing the file at a dedicated test database. They create temporary sessions and delete only those exact test records. Provider unit tests use synthetic HTTP responses and are not proof of live provider availability. Playwright tests generate a tiny local WebM fixture; no user media is transmitted.

## Production deployment
Use a Node-capable host (container, VM, or Next.js host) and PostgreSQL. This Node/Prisma implementation is not a Cloudflare Workers bundle and must not be presented as a static Pages deployment.

1. Install on a network-enabled machine, review dependencies, resolve security advisories, and commit the generated `package-lock.json`.
2. Provision PostgreSQL with TLS and least-privileged credentials. Set DATABASE_URL and exact HTTPS APP_ORIGIN as secrets. No Google/Azure provider keys belong in public environment variables or the database.
3. Run `npm run db:migrate`, `npm run typecheck`, `npm test`, `npm run build`, then `npm start` behind HTTPS.
4. Configure an edge request/body limiter and request timeout, including session creation. Never enable request-body logging on `/api/speech` because it carries a visitor's key.
5. Run desktop/mobile E2E, database integration, real provider acceptance and exported media checks against staging. Review CSP: Next inline bootstrap requires the current inline allowance; tighten with per-request nonces if your deployment requires stricter CSP.
6. Publish after acceptance gates pass; add monitoring that excludes keys, bodies, transcripts and raw provider errors. Back up/expire session storage appropriately.

For container builds, use the included Dockerfile after creating a reviewed lockfile. Set DATABASE_URL/APP_ORIGIN at runtime; run migrations as a separate release task before serving traffic.

## Known differences
- Azure Speech replaces inaccessible Edge service, requiring another key and possibly payment.
- Export is real-time browser recording, up to 1080p/30 fps and WebM/MP4 depending on codecs. No frame-accuracy or unchanged resolution guarantee.
- User presses Play after voice generation; no guaranteed autoplay.
- Device speech cannot be exported and uses the installed Khmer voice, without reliable gender selection.
- 45-second transcription boundaries may split speech; overlap/timing validation can reject imperfect model output rather than silently corrupt it. Use the manual subtitle path to correct inputs.
- Failed voice generation currently restarts the sequence on retry. Google/Microsoft quota errors are shown; no background job resume service.
- Video and edits are not persisted across reload. No account-based project history was observed or invented.
- Private source, network payloads, successful reference processing, post-upload UI, precise mobile behavior and export behavior were not accessible for direct comparison.

## Documentation map
- `docs/01-discovery.md`: observed evidence and unknowns
- `docs/02-architecture.md`: initial blueprint, boundaries, entities
- `docs/03-feature-parity.md`: per-feature status and remaining gates
- `docs/04-api.md`: endpoint contracts and integration references
- `docs/05-test-results.md`: actual verification results and limits
- `prisma/`: schema and initial SQL migration
- `.env.example`: environment template

Original source and branding assets were not copied. The support link remains explicitly attributed to the original creator; this independent app is not affiliated with MT Dubber Free.

### Local Edge voice setup

Run these once from the project folder, then start or restart the app with `npm run dev`:

```bash
python3 -m venv .venv-edge
.venv-edge/bin/python -m pip install -r requirements-edge.txt
npm run dev
```

At http://localhost:3000, Edge voice defaults to Piseth. Select Sreymom or automatic voice selection in Pipeline. Gemini handles transcription and translation. Edge speech sends only subtitle text to Microsoft through the local server and uses no Azure Speech key. The community Edge client depends on Microsoft’s online speech service. The local Edge route listens on port 3000.

### Deploy the full studio from GitHub

Connect the GitHub repository to a web host that runs Docker and supports outbound
WebSocket connections to Microsoft. Build using the included Dockerfile and serve
port 3000. Set these runtime environment variables in the host dashboard:

- `APP_ORIGIN`: exact HTTPS URL for the studio, with no trailing slash. On Render, the Edge route defaults to Render’s assigned HTTPS URL.
- `STUDIO_ACCESS_PASSWORD`: strong private password. Sign in as `studio`.

The password protects the hosted studio and its Edge voice route. Keep it out of
source control. The default Edge workflow does not need PostgreSQL. If you use
the optional Azure voice route, configure `DATABASE_URL` and apply the Prisma
migrations. GitHub Pages alone cannot run the Node and Python voice endpoint.

After deployment, open the HTTPS URL, sign in, and run a small Khmer dub through
preview and video download to verify the host's speech connectivity.

### Private access

Keep the source repository private. Use the password-protected Docker service
above for remote access, or `npm run dev` for access on this machine only.
The Docker service requires `STUDIO_ACCESS_PASSWORD` at startup.
