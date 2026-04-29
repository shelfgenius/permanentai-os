/**
 * DeepResearchPanel — AI-powered deep research → PDF export.
 *
 * Floating panel that can be embedded in any hub.
 * User enters a topic, selects depth, gets a PDF they can download or email.
 */
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Loader2, Mail, CheckCircle, X, Search, BookOpen,
} from 'lucide-react';
import useStore from '../store/useStore.js';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

const DEPTHS = [
  { id: 'brief',    label: 'Brief',    pages: 2, desc: '~2 pages, quick overview' },
  { id: 'standard', label: 'Standard', pages: 5, desc: '~5 pages, balanced depth' },
  { id: 'deep',     label: 'Deep',     pages: 10, desc: '~10 pages, comprehensive' },
];

export default function DeepResearchPanel({ open, onClose }) {
  const { backendUrl } = useStore();
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState('standard');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null); // { filename, download_url, title, content_preview }
  const [error, setError] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);

  const generate = useCallback(async () => {
    if (!topic.trim() || !backendUrl) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${backendUrl}/pdf/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          depth,
          pages: DEPTHS.find(d => d.id === depth)?.pages || 5,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }, [topic, depth, backendUrl]);

  const downloadPdf = useCallback(() => {
    if (!result?.download_url || !backendUrl) return;
    const a = document.createElement('a');
    a.href = `${backendUrl}${result.download_url}`;
    a.download = result.filename;
    a.click();
  }, [result, backendUrl]);

  const emailPdf = useCallback(async () => {
    if (!result?.download_url || !backendUrl) return;
    setEmailStatus('sending');
    try {
      const res = await fetch(`${backendUrl}/email/send-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: `${backendUrl}${result.download_url}`,
          filename: result.filename,
          subject: `Research PDF: ${result.title || topic}`,
          body: `Your deep research document is attached.\n\nTopic: ${result.title || topic}\nDepth: ${depth}\nGenerated: ${new Date().toLocaleString()}`,
        }),
      });
      if (!res.ok) throw new Error();
      setEmailStatus('sent');
      setTimeout(() => setEmailStatus(null), 4000);
    } catch {
      setEmailStatus('error');
      setTimeout(() => setEmailStatus(null), 4000);
    }
  }, [result, backendUrl, topic, depth]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="deep-research-overlay"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        style={{
          position: 'fixed', bottom: 80, right: 20, zIndex: 100,
          width: 380, maxHeight: '70vh',
          background: 'rgba(16,16,24,0.95)', backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="#0071e3" />
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
              Deep Research → PDF
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', padding: 4,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {/* Topic */}
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Enter a research topic, e.g. 'Impact of AI on maritime logistics'"
            rows={3}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, color: '#fff', padding: '10px 12px',
              fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
            }}
          />

          {/* Depth selector */}
          <div style={{ display: 'flex', gap: 6 }}>
            {DEPTHS.map(d => (
              <button
                key={d.id}
                onClick={() => setDepth(d.id)}
                title={d.desc}
                style={{
                  flex: 1, padding: '8px 6px', borderRadius: 8,
                  background: depth === d.id ? 'rgba(0,113,227,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${depth === d.id ? '#0071e3' : 'rgba(255,255,255,0.06)'}`,
                  color: depth === d.id ? '#4da6ff' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', fontFamily: MONO, fontSize: 9,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={generate}
            disabled={generating || !topic.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 16px', borderRadius: 10,
              background: generating ? 'rgba(0,113,227,0.3)' : '#0071e3',
              color: '#fff', border: 'none',
              cursor: generating || !topic.trim() ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600,
              opacity: !topic.trim() ? 0.5 : 1,
            }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {generating ? 'Researching & generating PDF...' : 'Generate Research PDF'}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)',
              color: '#ff8088', fontSize: 12,
            }}>
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              padding: 12, borderRadius: 10,
              background: 'rgba(0,113,227,0.06)', border: '1px solid rgba(0,113,227,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileText size={16} color="#0071e3" />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#fff', flex: 1 }}>
                  {result.title || result.filename}
                </span>
              </div>
              {result.content_preview && (
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
                  marginBottom: 10, maxHeight: 80, overflow: 'hidden',
                }}>
                  {result.content_preview}...
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={downloadPdf} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                  fontSize: 11, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  <Download size={12} /> Download
                </button>
                <button
                  onClick={emailPdf}
                  disabled={emailStatus === 'sending'}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 8,
                    background: emailStatus === 'sent' ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.06)',
                    color: emailStatus === 'sent' ? '#34c759' : 'rgba(255,255,255,0.85)',
                    border: `1px solid ${emailStatus === 'sent' ? 'rgba(52,199,89,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    cursor: emailStatus === 'sending' ? 'wait' : 'pointer',
                    fontSize: 11, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}
                >
                  {emailStatus === 'sending' ? <Loader2 size={12} className="animate-spin" />
                    : emailStatus === 'sent' ? <CheckCircle size={12} />
                    : <Mail size={12} />}
                  {emailStatus === 'sent' ? 'Sent!' : emailStatus === 'error' ? 'Failed' : 'Email'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
