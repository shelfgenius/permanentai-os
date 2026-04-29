import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type, Image as ImageIcon, FileText, Globe,
  ArrowLeftRight, Mic, Volume2, Star, Copy, X,
  Upload, Loader2, Check,
} from 'lucide-react';
import useStore from '../store/useStore.js';
import VoiceOrb from '../components/VoiceOrb.jsx';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

/* ═══════════════════════════════════════════════════════════
   LANGUAGE LIST — Riva 4.0B supports 180+ languages
═══════════════════════════════════════════════════════════ */
const LANGUAGES = [
  { code: 'auto', name: 'Detect language' },
  { code: 'en', name: 'English' },
  { code: 'ro', name: 'Romanian' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'tr', name: 'Turkish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'cs', name: 'Czech' },
  { code: 'fi', name: 'Finnish' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'da', name: 'Danish' },
  { code: 'no', name: 'Norwegian' },
];

const CONTENT_TABS = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'website', label: 'Websites', icon: Globe },
];

/* ═══════════════════════════════════════════════════════════
   LANGUAGE PICKER — dropdown
═══════════════════════════════════════════════════════════ */
function LangPicker({ value, onChange, excludeAuto = false, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const filtered = excludeAuto ? LANGUAGES.filter(l => l.code !== 'auto') : LANGUAGES;
  const active = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '10px 18px', borderRadius: 10,
          background: open ? 'rgba(26,115,232,0.08)' : 'transparent',
          border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 500,
          color: open ? '#1a73e8' : '#1d1d1f',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {active.name}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: '100%', marginTop: 6,
              [align]: 0,
              width: 220, maxHeight: 320, overflowY: 'auto',
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.14)',
              border: '1px solid rgba(0,0,0,0.06)',
              zIndex: 100,
              padding: '6px 0',
            }}
          >
            {filtered.map(l => (
              <button
                key={l.code}
                onClick={() => { onChange(l.code); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '9px 16px',
                  background: value === l.code ? 'rgba(26,115,232,0.08)' : 'transparent',
                  color: value === l.code ? '#1a73e8' : '#1d1d1f',
                  fontSize: 13, fontWeight: value === l.code ? 500 : 400,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
                onMouseEnter={e => { if (value !== l.code) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
                onMouseLeave={e => { if (value !== l.code) e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{l.name}</span>
                {value === l.code && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TEXT TRANSLATOR — split pane, auto-translate with debounce
═══════════════════════════════════════════════════════════ */
function TextTranslator({ sourceLang, targetLang, backendUrl }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const debounceRef = useRef(null);
  const audioRef = useRef(null);
  const recognitionRef = useRef(null);

  // Voice orb → source input
  useEffect(() => {
    const onVoice = (e) => {
      if (e.detail?.agent === 'lexi') setInput(e.detail.text);
    };
    window.addEventListener('voiceorb:transcript', onVoice);
    return () => window.removeEventListener('voiceorb:transcript', onVoice);
  }, []);

  // Debounced auto-translate
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) { setOutput(''); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${backendUrl}/nvidia/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: input,
            source_lang: sourceLang === 'auto' ? 'en' : sourceLang,
            target_lang: targetLang,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setOutput(data.translation || '');
      } catch (err) {
        setOutput(`[Translation error: ${err.message}]`);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, sourceLang, targetLang, backendUrl]);

  const handleCopy = useCallback(() => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [output]);

  const handleSave = useCallback(() => {
    if (!input.trim() || !output.trim()) return;
    try {
      const saved = JSON.parse(localStorage.getItem('lexi_phrasebook') || '[]');
      saved.unshift({
        src: input, tgt: output,
        srcLang: sourceLang, tgtLang: targetLang,
        ts: Date.now(),
      });
      localStorage.setItem('lexi_phrasebook', JSON.stringify(saved.slice(0, 100)));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {}
  }, [input, output, sourceLang, targetLang]);

  const handleTTS = useCallback(async (text, lang) => {
    if (!text || !text.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/nvidia/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, language: lang === 'auto' ? 'en' : lang,
          voice: 'multilingual_female',
        }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play();
    } catch (err) {
      // Fallback to browser TTS
      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang;
        window.speechSynthesis.speak(utter);
      }
    }
  }, [backendUrl]);

  const handleMic = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input not supported on this browser.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = sourceLang === 'auto' ? 'en-US' : sourceLang;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }, [listening, sourceLang]);

  return (
    <div style={paneContainerStyle}>
      {/* SOURCE */}
      <div style={paneStyle}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value.slice(0, 5000))}
          placeholder="Enter text"
          style={{
            flex: 1, resize: 'none',
            padding: '20px 22px',
            fontSize: 22, lineHeight: 1.45,
            border: 'none', outline: 'none',
            background: 'transparent',
            color: '#1d1d1f',
            fontFamily: 'inherit',
          }}
        />
        {/* Source tools */}
        <div style={toolbarStyle}>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton
              icon={Mic} active={listening}
              onClick={handleMic}
              title="Voice input"
            />
            <IconButton
              icon={Volume2}
              onClick={() => handleTTS(input, sourceLang)}
              disabled={!input.trim()}
              title="Listen"
            />
          </div>
          <div style={{ fontSize: 12, color: 'rgba(29,29,31,0.4)' }}>
            {input.length} / 5000
          </div>
        </div>
      </div>

      {/* TARGET */}
      <div style={{ ...paneStyle, background: '#f7f9fc' }}>
        <div style={{
          flex: 1, padding: '20px 22px',
          fontSize: 22, lineHeight: 1.45,
          color: output ? '#1d1d1f' : 'rgba(29,29,31,0.3)',
          overflowY: 'auto', whiteSpace: 'pre-wrap',
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(29,29,31,0.4)', fontSize: 16 }}>
              <Loader2 size={16} className="animate-spin" /> Translating…
            </div>
          ) : (output || 'Translation')}
        </div>
        {/* Target tools */}
        <div style={toolbarStyle}>
          <div style={{ display: 'flex', gap: 4 }}>
            <IconButton
              icon={Volume2}
              onClick={() => handleTTS(output, targetLang)}
              disabled={!output.trim()}
              title="Listen"
            />
            <IconButton
              icon={Star} active={saved}
              onClick={handleSave}
              disabled={!output.trim()}
              title="Save to phrasebook"
            />
            <IconButton
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              disabled={!output.trim()}
              title="Copy"
            />
          </div>
          {copied && <span style={{ fontSize: 12, color: '#1a73e8' }}>Copied</span>}
          {saved && <span style={{ fontSize: 12, color: '#f59e0b' }}>Saved</span>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   IMAGE TRANSLATOR — upload image, extract text, translate
═══════════════════════════════════════════════════════════ */
function ImageTranslator({ sourceLang, targetLang, backendUrl }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      setImgSrc(e.target.result);
      setLoading(true);
      // Browser OCR via Tesseract would be ideal but heavy;
      // For now prompt user to paste text manually — real OCR would require backend endpoint
      setExtractedText('(Paste image text below — OCR coming soon)');
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!extractedText.trim() || extractedText.startsWith('(')) { setTranslated(''); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${backendUrl}/nvidia/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: extractedText,
            source_lang: sourceLang === 'auto' ? 'en' : sourceLang,
            target_lang: targetLang,
          }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTranslated(data.translation || '');
      } catch { setTranslated('[Translation failed]'); }
      finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(id);
  }, [extractedText, sourceLang, targetLang, backendUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 22 }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        onChange={e => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />

      {!imgSrc ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed rgba(26,115,232,0.3)',
            borderRadius: 14, padding: '60px 24px',
            textAlign: 'center', cursor: 'pointer',
            background: 'rgba(26,115,232,0.02)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(26,115,232,0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(26,115,232,0.02)'}
        >
          <Upload size={36} style={{ color: '#1a73e8', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1d1d1f', marginBottom: 6 }}>
            Upload or take a photo
          </div>
          <div style={{ fontSize: 13, color: 'rgba(29,29,31,0.5)' }}>
            JPG, PNG, WebP · Camera on mobile
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 400 }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#f5f5f7' }}>
            <img src={imgSrc} alt="Source" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <button
              onClick={() => { setImgSrc(null); setExtractedText(''); setTranslated(''); }}
              style={{
                position: 'absolute', top: 10, right: 10,
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', color: '#fff',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={extractedText}
              onChange={e => setExtractedText(e.target.value)}
              placeholder="Paste text from image here"
              style={{
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.1)', outline: 'none',
                fontSize: 14, minHeight: 120, resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: '#f7f9fc', border: '1px solid rgba(0,0,0,0.06)',
              fontSize: 14, minHeight: 120, whiteSpace: 'pre-wrap',
              color: translated ? '#1d1d1f' : 'rgba(29,29,31,0.4)',
            }}>
              {loading ? 'Translating…' : (translated || 'Translation will appear here')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENT TRANSLATOR — upload file, extract and translate
═══════════════════════════════════════════════════════════ */
function DocumentTranslator({ sourceLang, targetLang, backendUrl }) {
  const [fileName, setFileName] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const text = await file.text();
        setExtractedText(text.slice(0, 10000));
      } else {
        setExtractedText(`(${file.name} — PDF/DOCX extraction requires backend. Paste text below.)`);
      }
    } catch (err) {
      setExtractedText(`[Error reading file: ${err.message}]`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!extractedText.trim() || extractedText.startsWith('(')) { setTranslated(''); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${backendUrl}/nvidia/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: extractedText,
            source_lang: sourceLang === 'auto' ? 'en' : sourceLang,
            target_lang: targetLang,
          }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTranslated(data.translation || '');
      } catch { setTranslated('[Translation failed]'); }
      finally { setLoading(false); }
    }, 700);
    return () => clearTimeout(id);
  }, [extractedText, sourceLang, targetLang, backendUrl]);

  return (
    <div style={{ padding: 22 }}>
      <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx,.pptx,.xlsx"
        onChange={e => handleFile(e.target.files?.[0])}
        style={{ display: 'none' }}
      />
      {!fileName ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed rgba(26,115,232,0.3)',
            borderRadius: 14, padding: '60px 24px',
            textAlign: 'center', cursor: 'pointer',
            background: 'rgba(26,115,232,0.02)',
          }}
        >
          <FileText size={36} style={{ color: '#1a73e8', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1d1d1f', marginBottom: 6 }}>
            Drop file here or click to browse
          </div>
          <div style={{ fontSize: 13, color: 'rgba(29,29,31,0.5)' }}>
            .txt · .md · .pdf · .docx · .pptx · .xlsx
          </div>
        </div>
      ) : (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(26,115,232,0.06)', marginBottom: 16,
          }}>
            <FileText size={18} style={{ color: '#1a73e8' }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#1d1d1f', flex: 1 }}>{fileName}</span>
            <button
              onClick={() => { setFileName(''); setExtractedText(''); setTranslated(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(29,29,31,0.5)' }}
            >
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 300 }}>
            <textarea
              value={extractedText}
              onChange={e => setExtractedText(e.target.value)}
              style={{
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid rgba(0,0,0,0.1)', outline: 'none',
                fontSize: 13, resize: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: '#f7f9fc', border: '1px solid rgba(0,0,0,0.06)',
              fontSize: 13, whiteSpace: 'pre-wrap', overflowY: 'auto',
              color: translated ? '#1d1d1f' : 'rgba(29,29,31,0.4)',
            }}>
              {loading ? 'Translating…' : (translated || 'Translation')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WEBSITE TRANSLATOR — enter URL, show translated version
═══════════════════════════════════════════════════════════ */
function WebsiteTranslator({ targetLang }) {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [iframeError, setIframeError] = useState(false);

  const handleSubmit = () => {
    if (!url.trim()) return;
    let clean = url.trim();
    if (!clean.startsWith('http')) clean = 'https://' + clean;
    setIframeError(false);
    const translateUrl = `https://translate.google.com/translate?sl=auto&tl=${targetLang}&u=${encodeURIComponent(clean)}`;
    setSubmitted(translateUrl);
  };

  const openExternal = () => {
    if (submitted) window.open(submitted, '_blank', 'noopener');
  };

  return (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="https://example.com"
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.12)', outline: 'none',
            fontSize: 14, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            padding: '0 22px', borderRadius: 10,
            background: '#1a73e8', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
          }}
        >
          Translate
        </button>
      </div>
      {submitted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(26,115,232,0.06)',
          }}>
            <span style={{ fontSize: 12, color: 'rgba(29,29,31,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              Translating: {url}
            </span>
            <button onClick={openExternal} style={{
              padding: '6px 14px', borderRadius: 8,
              background: '#1a73e8', color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
            }}>
              Open in new tab ↗
            </button>
          </div>
          {iframeError ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center', borderRadius: 10,
              background: 'rgba(255,59,48,0.04)', border: '1px solid rgba(255,59,48,0.12)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#ff3b30', marginBottom: 8 }}>
                This site blocked embedding
              </div>
              <div style={{ fontSize: 13, color: 'rgba(29,29,31,0.5)', marginBottom: 14 }}>
                Click "Open in new tab" above to view the translated version.
              </div>
            </div>
          ) : (
            <iframe
              src={submitted}
              title="Translated site"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              referrerPolicy="no-referrer"
              onError={() => setIframeError(true)}
              onLoad={(e) => {
                try { e.target.contentDocument; } catch { setIframeError(true); }
              }}
              style={{
                width: '100%', height: '70vh',
                border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
              }}
            />
          )}
        </div>
      ) : (
        <div style={{
          padding: '40px 20px', textAlign: 'center',
          color: 'rgba(29,29,31,0.4)', fontSize: 14,
        }}>
          Enter a URL above to translate an entire website
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ICON BUTTON
═══════════════════════════════════════════════════════════ */
function IconButton({ icon: Icon, onClick, disabled, active, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 38, height: 38, borderRadius: 10,
        background: active ? 'rgba(26,115,232,0.1)' : 'transparent',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        color: active ? '#1a73e8' : 'rgba(29,29,31,0.6)',
        opacity: disabled ? 0.35 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={17} />
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN LEXI HUB
═══════════════════════════════════════════════════════════ */
export default function LexiHub({ onBack }) {
  const { backendUrl } = useStore();
  const [activeTab, setActiveTab] = useState('text');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('ro');

  const swapLangs = () => {
    if (sourceLang === 'auto') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#fafbfc',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* TOP BAR */}
      <div style={{
        flexShrink: 0,
        padding: 'max(14px, env(safe-area-inset-top, 14px)) 20px 14px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={onBack}
          style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(29,29,31,0.5)',
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8,
            padding: '7px 12px', cursor: 'pointer',
          }}
        >
          ← Menu
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 14,
          }}>
            L
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>Lexi</div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: 'rgba(29,29,31,0.4)', textTransform: 'uppercase' }}>
              Riva 4.0B · 180+ languages
            </div>
          </div>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* CONTENT TABS */}
      <div style={{
        flexShrink: 0,
        display: 'flex', gap: 4, padding: '12px 20px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: '#fff',
        overflowX: 'auto',
      }}>
        {CONTENT_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 10,
                background: isActive ? 'rgba(26,115,232,0.1)' : 'transparent',
                color: isActive ? '#1a73e8' : 'rgba(29,29,31,0.6)',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* LANGUAGE BAR */}
      <div style={{
        flexShrink: 0,
        padding: '10px 20px',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: '#fff',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <LangPicker value={sourceLang} onChange={setSourceLang} />
        </div>
        <button
          onClick={swapLangs}
          disabled={sourceLang === 'auto'}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(0,0,0,0.04)', border: 'none',
            cursor: sourceLang === 'auto' ? 'default' : 'pointer',
            opacity: sourceLang === 'auto' ? 0.35 : 1,
            color: 'rgba(29,29,31,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          title="Swap languages"
        >
          <ArrowLeftRight size={15} />
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          <LangPicker value={targetLang} onChange={setTargetLang} excludeAuto />
        </div>
      </div>

      {/* CONTENT AREA */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            style={{ minHeight: '100%' }}
          >
            {activeTab === 'text' && (
              <TextTranslator sourceLang={sourceLang} targetLang={targetLang} backendUrl={backendUrl} />
            )}
            {activeTab === 'image' && (
              <ImageTranslator sourceLang={sourceLang} targetLang={targetLang} backendUrl={backendUrl} />
            )}
            {activeTab === 'document' && (
              <DocumentTranslator sourceLang={sourceLang} targetLang={targetLang} backendUrl={backendUrl} />
            )}
            {activeTab === 'website' && (
              <WebsiteTranslator targetLang={targetLang} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Voice orb — transcript fills source input via window event ── */}
      <VoiceOrb agent="lexi" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════════════════════ */
const paneContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 1,
  minHeight: 'calc(100vh - 200px)',
  background: 'rgba(0,0,0,0.06)',
};

const paneStyle = {
  display: 'flex', flexDirection: 'column',
  background: '#fff',
  minHeight: 280,
};

const toolbarStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 14px 12px',
  borderTop: '1px solid rgba(0,0,0,0.04)',
};
