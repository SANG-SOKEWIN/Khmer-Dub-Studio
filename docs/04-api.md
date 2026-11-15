# API contracts

Reference network payloads were not accessible. These are independent implementation contracts, not recovered private APIs.

## POST /api/session
Same-origin only. Send `Origin` matching `APP_ORIGIN`. No request body. Returns `200 {"ok":true}` and an opaque `studio_session` cookie (HttpOnly, SameSite=Strict, Secure in production, 8-hour max age). Only SHA-256 of the 256-bit token is stored. An unexpired session is reused. Expired rows are pruned on creation. 403 origin mismatch; 503 database/configuration unavailable.

## POST /api/speech
Same origin, valid session, `Content-Type: application/json`. Maximum body: 16,000 bytes.

```json
{
  "text": "សួស្តី",
  "voice": "km-KH-SreymomNeural",
  "region": "southeastasia",
  "key": "YOUR_AZURE_SPEECH_KEY"
}
```

`text`: 1–3000 characters; XML control characters rejected and markup escaped. `voice`: Piseth or Sreymom only. Region is an alphanumeric Azure region identifier, not a URL. Key forwarded to Microsoft, never logged/stored. Server emits bounded SSML to `https://{region}.tts.speech.microsoft.com/cognitiveservices/v1`, requests `riff-24khz-16bit-mono-pcm`, and returns `audio/wav` with `Cache-Control: no-store`.

Errors: 400 invalid input; 401 missing/expired session; 403 cross origin; 429 30 requests/minute session budget or provider quota; 502 upstream rejection; 503 unavailable/timeout. Responses use `{ "error": "safe description" }`. Anonymous sessions are a resource budget, not account authentication or a strong anti-abuse boundary. Deploy behind an edge request limiter, particularly for session creation. BYOK prevents server-owned speech credits from being consumed.

## Direct browser → Google
- `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000[&pageToken=…]`
- `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- Credentials via `x-goog-api-key`, never URL parameters.
- Transcription: `contents[].parts` includes instruction + WAV `inlineData`; response requested as JSON segment array.
- Translation: JSON text entries; IDs/count must match; timings are retained locally.
- Speech: `responseModalities: ["AUDIO"]`, selected prebuilt voice; PCM is wrapped in WAV when needed.
- 45-second 16 kHz mono WAV chunks keep inline audio requests bounded. 90-second call timeout; model/key fallback for transient/unavailable statuses; no retry for permission/input errors. No automatic sleep/retry loop that runs indefinitely.

## External references used for the independent adapters
- https://ai.google.dev/gemini-api/docs/generate-content/speech-generation
- https://ai.google.dev/api/generate-content
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech

Model names and provider availability change. Use Load models with your account and validate speech support. The observed reference's model list is not treated as proof that every listed model exists or supports Khmer.
