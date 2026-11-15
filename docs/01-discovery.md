# Reference discovery — 14 November 2026

Reference: https://meta-12.github.io/MetaFreeDubbingTool/

## Evidence and boundaries
Inspected the rendered website in the browser, including all three settings tabs, both processing modes, all three voice engine branches, theme toggle, support modal, and missing-key validation. No credentials or personal media were used. No authentication was bypassed. The delivered script URL is `app.js?v=9c8211a7`; direct inspection was blocked by the browser. Network request bodies and successful AI processing were therefore **not observed**. No original code or protected assets were copied.

## Sitemap
One observed route `/MetaFreeDubbingTool/`. Providers, Pipeline and Subtitles are in-page tabs. External links: Google AI Studio key creation and Telegram donation. No observed registration, login, account dashboard, search, payment checkout, subscription, admin page, or database CRUD.

## Observed interface
Sticky brand header, support button, light/dark toggle; centered Khmer dubbing hero and four badges; bordered upload card; original audio volume (default zero); split process/mode control; three progress stages; status message; clearable backend log; three settings tabs; footer support link. Dark navy background, violet/cyan gradient accents, rounded cards. Light theme uses pale lavender and white surfaces. At the observed ~847 px viewport the two main cards are vertically stacked.

## Features and workflows
1. Local video picker/drop zone advertises MP4, MOV, WebM; action disabled before video selection.
2. Full Dub: transcribe → translate → auto male/female Khmer voice and play.
3. Translate Only: transcribe/translate, then edit subtitles and gender before voice generation (described by the mode menu; post-upload editor not accessed).
4. Gemini enable checkbox, one key per password box, remove/add, show/hide, verify-all, key count, editable ordered models and load-models control. Empty-key load shows “Add a Gemini key first” both in status and log.
5. Edge voices: auto by subtitle gender, Piseth only, Sreymom only.
6. Gemini voices: 30 named voices in female/male groups, ordered editable TTS model list.
7. Device Khmer voice is explicitly labeled “no export”.
8. Optional SRT upload or pasted SRT/plain Khmer. Description says this bypasses transcription and translation, preserves wording, and spreads plain lines evenly across video.
9. Support modal describes donations and links to `https://t.me/donateTOmeta`; Maybe later closes it.
10. Export is advertised as frame-accurate, but exact format, controls and execution were not verified.

## Important uncertainty
The page claims video stays local. That does not establish whether extracted audio is sent to AI providers. Provider endpoints, key storage, retry policy, media extraction, export implementation, persistence and mobile breakpoints remain unknown. No backend or database architecture can be recovered from this evidence. Advertised capabilities are not equivalent to successfully tested capabilities.
