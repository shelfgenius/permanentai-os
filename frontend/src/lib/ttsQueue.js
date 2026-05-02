/**
 * ttsQueue.js — singleton TTS serializer with Web Audio API queue
 *
 * Strategy:
 *   1. LLM streams text → each complete sentence is enqueued here.
 *   2. Each sentence is sent to /elevenlabs/tts which handles language
 *      detection, voice routing (Irish EN / Romanian), and sentence-level
 *      audio generation via ElevenLabs eleven_v3.
 *   3. Audio arrives as MP3, decoded via Web Audio API, queued for
 *      gapless playback.
 *   4. Fallback: browser speechSynthesis if backend TTS fails.
 */

// ── Web Audio API context (lazy-init on first play) ─────────────
let _ctx = null;
function _getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Audio buffer queue for gapless playback ─────────────────────
const _audioQueue = [];       // ArrayBuffer[]
let _isPlaying = false;
let _currentSource = null;    // AudioBufferSourceNode
let _nextStartTime = 0;

function _scheduleNext() {
  if (_audioQueue.length === 0) {
    _isPlaying = false;
    return;
  }
  _isPlaying = true;
  const ctx = _getCtx();
  const raw = _audioQueue.shift();

  ctx.decodeAudioData(raw.slice(0))  // slice to detach
    .then(buffer => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      _currentSource = source;

      // Schedule gaplessly: start at end of previous chunk
      const startAt = Math.max(ctx.currentTime, _nextStartTime);
      source.start(startAt);
      _nextStartTime = startAt + buffer.duration;

      source.onended = () => {
        _currentSource = null;
        _scheduleNext();
      };
    })
    .catch(() => {
      // If decode fails (bad format), skip to next
      _currentSource = null;
      _scheduleNext();
    });
}

function _enqueueAudioChunk(arrayBuffer) {
  _audioQueue.push(arrayBuffer);
  if (!_isPlaying) {
    _nextStartTime = 0;
    _scheduleNext();
  }
}

// ── ElevenLabs direct config (fetched once from backend) ────────
let _elConfig = null;       // { key, voice_en, voice_ro, model, output_format }
let _elConfigFetched = false;

// Romanian detection — handles text with AND without diacritics
const _RO_DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;
const _RO_WORDS_RE = new RegExp(
  '\\b(' +
  // Common Romanian words (with and without diacritics)
  'si|și|este|sunt|sunt|pentru|care|sau|dar|cum|unde|cand|când|' +
  'ce|nu|da|bine|foarte|acest|aceasta|această|prin|acum|aici|' +
  'trebuie|poate|atunci|acolo|doar|despre|avea|face|spune|merge|' +
  'lucru|insa|însă|daca|dacă|ori|fie|nici|mai|tot|din|' +
  'la|de|cu|pe|in|în|le|se|va|ne|te|ma|mă|' +
  'unui|unei|unor|cele|cel|cea|cei|ale|lui|lor|' +
  'putea|vreau|vrei|vrea|vrem|vreti|vor|' +
  'am|ai|are|avem|aveti|au|era|eram|erai|erau|' +
  'fost|fac|faci|facem|faceti|faci|' +
  'asta|asta|astea|astia|acestea|acestia|' +
  'undeva|nicaieri|nicăieri|oriunde|' +
  'buna|bună|salut|multumesc|mulțumesc|' +
  'stiu|știu|stii|știi|stie|știe|' +
  'cum|cat|cât|cati|câți|cate|câte|' +
  'mai|mult|multa|multă|multi|mulți|multe|' +
  'frumos|frumoasa|frumoasă|mare|mic|mica|mică|' +
  'timp|casa|casă|om|oameni|copil|copii|' +
  'lucrez|lucrezi|lucreaza|lucrează|' +
  'Romania|România|roman|român|romana|română|romanesc|românesc|' +
  'limba|limbă|vorbesc|vorbeste|vorbește' +
  ')\\b', 'gi'
);
function _detectLang(text) {
  if (_RO_DIACRITICS.test(text)) return 'ro';
  const hits = (text.match(_RO_WORDS_RE) || []).length;
  const wordCount = Math.max(text.split(/\s+/).length, 1);
  // Lower threshold: if >5% of words are Romanian, or >3 Romanian words in short text
  if (hits / wordCount > 0.05 || (hits >= 3 && wordCount < 30)) return 'ro';
  return 'en';
}

async function _getElConfig(base) {
  if (_elConfig) return _elConfig;
  if (_elConfigFetched) return null; // already tried and failed
  _elConfigFetched = true;
  try {
    const res = await fetch(`${base}/elevenlabs/config`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      _elConfig = await res.json();
      return _elConfig;
    }
  } catch (_) {}
  return null;
}

// ── Text utterance queue (serialises TTS requests) ──────────────
const _queue = [];            // { text, backendUrl, resolve }
let _processing = false;

async function _processNext() {
  if (_processing || _queue.length === 0) return;
  _processing = true;

  const { text, backendUrl, resolve } = _queue.shift();
  const base = backendUrl.replace(/\/+$/, '');

  try {
    let streamed = false;

    // ── 1. ElevenLabs DIRECT from browser (bypasses Render IP) ──
    if (!streamed) {
      try {
        const cfg = await _getElConfig(base);
        if (cfg?.key) {
          const lang = _detectLang(text);
          const voiceId = lang === 'ro' ? cfg.voice_ro : cfg.voice_en;
          const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
              'xi-api-key': cfg.key,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: cfg.model || 'eleven_v3',
              output_format: cfg.output_format || 'mp3_44100_128',
              voice_settings: { stability: 0.6, similarity_boost: 0.8 },
            }),
            signal: AbortSignal.timeout(25000),
          });
          if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 100) {
              _enqueueAudioChunk(await blob.arrayBuffer());
              streamed = true;
            }
          }
        }
      } catch (_) { /* direct ElevenLabs failed */ }
    }

    // ── 2. Backend ElevenLabs proxy (handles Romanian voices + local proxy) ──
    if (!streamed) {
      try {
        const lang = _detectLang(text);
        const res = await fetch(`${base}/elevenlabs/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: lang }),
          signal: AbortSignal.timeout(25000),
        });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 100) {
            _enqueueAudioChunk(await blob.arrayBuffer());
            streamed = true;
          }
        }
      } catch (_) { /* backend ElevenLabs proxy failed */ }
    }

    // ── 3. NVIDIA cloud Magpie TTS (fallback) ──
    if (!streamed) {
      try {
        const lang = _detectLang(text);
        const res = await fetch(`${base}/nvidia/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'multilingual_female', language: lang }),
          signal: AbortSignal.timeout(12000),
        });
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 100) {
            _enqueueAudioChunk(await blob.arrayBuffer());
            streamed = true;
          }
        }
      } catch (_) { /* cloud TTS unavailable */ }
    }

    // ── 4. Streaming TTS (Kokoro/legacy) ──
    if (!streamed) {
      try {
        const res = await fetch(`${base}/tts/stream-chunks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, domain: 'general', first_buffer_words: 4 }),
        });
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          let buffer = new Uint8Array(0);
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const tmp = new Uint8Array(buffer.length + value.length);
            tmp.set(buffer);
            tmp.set(value, buffer.length);
            buffer = tmp;
            while (buffer.length >= 4) {
              const len = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
              if (buffer.length < 4 + len) break;
              const chunk = buffer.slice(4, 4 + len).buffer;
              buffer = buffer.slice(4 + len);
              _enqueueAudioChunk(chunk);
              streamed = true;
            }
          }
        }
      } catch (_) { /* streaming failed */ }
    }

    // ── 5. XTTS / legacy TTS ──
    if (!streamed) {
      try {
        const lang = _detectLang(text);
        let resp = await fetch(`${base}/xtts/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, agent: 'aura', language: lang }),
        });
        if (!resp.ok) throw new Error('xtts fail');
        const blob = await resp.blob();
        if (blob.size > 0) { _enqueueAudioChunk(await blob.arrayBuffer()); streamed = true; }
      } catch {
        try {
          const resp = await fetch(`${base}/tts/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, domain: 'general' }),
          });
          if (resp?.ok) {
            const blob = await resp.blob();
            if (blob.size > 0) { _enqueueAudioChunk(await blob.arrayBuffer()); streamed = true; }
          }
        } catch (_) {}
      }
    }

    // ── 6. Browser speechSynthesis (last resort) ──
    if (!streamed) {
      _browserSpeakFallback(text);
    }
  } catch (_) {
    _browserSpeakFallback(text);
  } finally {
    _processing = false;
    resolve?.();
    _processNext();
  }
}

// ── Browser speechSynthesis fallback ─────────────────────────────
let _browserSpeaking = false;
function _browserSpeakFallback(text) {
  if (!text?.trim()) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const lang = _detectLang(text);
    const voices = window.speechSynthesis.getVoices();
    let preferred;
    if (lang === 'ro') {
      preferred = voices.find(v => /ro/i.test(v.lang))
        || voices.find(v => /ro/i.test(v.name));
      utterance.lang = 'ro-RO';
    } else {
      preferred = voices.find(v => /en.*us/i.test(v.lang) && /natural|neural|premium/i.test(v.name))
        || voices.find(v => /en.*us/i.test(v.lang))
        || voices.find(v => /en/i.test(v.lang));
    }
    if (preferred) utterance.voice = preferred;
    _browserSpeaking = true;
    utterance.onend = () => { _browserSpeaking = false; };
    utterance.onerror = () => { _browserSpeaking = false; };
    window.speechSynthesis.speak(utterance);
  } catch (_) { _browserSpeaking = false; }
}

/**
 * Enqueue text for TTS. Returns a Promise that resolves when the
 * audio has been scheduled (not necessarily finished playing).
 */
export function enqueueSpeak(text, backendUrl, domain = 'general', agent = null) {
  if (!text?.trim() || !backendUrl) return Promise.resolve();
  return new Promise((resolve) => {
    _queue.push({ text, backendUrl, resolve });
    _processNext();
  });
}

/**
 * Enqueue agent-tagged text for voice routing.
 * Parses [AgentName]: prefix.
 */
export function enqueueAgentSpeak(taggedText, backendUrl) {
  if (!taggedText?.trim() || !backendUrl) return Promise.resolve();
  const match = taggedText.match(/^\[(\w+)\]:\s*(.*)/);
  const text = match ? match[2] : taggedText;
  return enqueueSpeak(text, backendUrl);
}

/**
 * Stop current playback immediately and discard all pending items.
 */
export function clearTtsQueue() {
  while (_queue.length) {
    _queue.shift().resolve?.();
  }
  _processing = false;

  _audioQueue.length = 0;

  if (_currentSource) {
    try { _currentSource.stop(); } catch (_) {}
    _currentSource = null;
  }
  _isPlaying = false;
  _nextStartTime = 0;

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }
  _browserSpeaking = false;
}

/** True if audio is currently playing or queued */
export function isTtsSpeaking() {
  return _isPlaying || _audioQueue.length > 0 || _processing || _browserSpeaking
    || (typeof window !== 'undefined' && window.speechSynthesis?.speaking);
}
