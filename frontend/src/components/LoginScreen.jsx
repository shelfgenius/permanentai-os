import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Turnstile } from '@marsidev/react-turnstile';
import useAuth from '../store/useAuth.js';
import useStore from '../store/useStore.js';
import TermsModal from './TermsModal.jsx';
import { TC_VERSION } from '../lib/legal.js';
import { supabase } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

const log = logger('oauth');

const DOMAIN_OPTIONS = [
  { id: 'general_ai',   label: 'Aura',             icon: '🧠', color: '#00cc66' },
  { id: 'image_gen',    label: 'Canvas',           icon: '🎨', color: '#e040fb' },
  { id: 'translation',  label: 'Lexi',             icon: '🌐', color: '#0a84ff' },
];

const inputStyle = (focused) => ({
  background: '#ffffff',
  border: `1px solid ${focused ? 'rgba(0,113,227,0.6)' : 'rgba(0,0,0,0.12)'}`,
  boxShadow: focused ? '0 0 0 3px rgba(0,113,227,0.12)' : 'none',
  color: '#1d1d1f',
  borderRadius: 12,
  transition: 'border-color 0.2s, box-shadow 0.2s',
});

function AppleInput({ value, onChange, type = 'text', placeholder, autoFocus, required }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      autoFocus={autoFocus}
      required={required}
      className="w-full px-4 py-3 text-sm outline-none"
      style={inputStyle(focused)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function BackendStatus({ backendOk, backendUrl }) {
  const { setBackendUrl } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isCloud = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');

  const save = () => {
    if (!draft.trim()) return;
    const url = draft.trim().replace(/\/$/, '');
    localStorage.setItem('backendUrl', url);
    setBackendUrl(url);
    setEditing(false);
  };

  if (backendOk === true) {
    return (
      <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl text-xs"
        style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.25)' }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#34c759' }} />
        <span style={{ color: '#34c759' }}>Backend conectat</span>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mb-5 p-3.5 rounded-2xl space-y-2.5"
        style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.2)' }}>
        <p className="text-[11px]" style={{ color: 'rgba(29,29,31,0.5)' }}>
          URL din fereastra <strong style={{ color: 'rgba(29,29,31,0.7)' }}>AI Tunnel</strong> (START.bat):
        </p>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="https://xxxx.trycloudflare.com"
            autoFocus
            className="flex-1 px-3 py-2 rounded-xl text-xs outline-none font-mono"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)', color: '#1d1d1f' }}
          />
          <button onClick={save}
            className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.3)', color: '#34c759' }}>
            OK
          </button>
          <button onClick={() => setEditing(false)}
            className="px-2.5 py-2 rounded-xl text-xs"
            style={{ color: 'rgba(29,29,31,0.35)', border: '1px solid rgba(0,0,0,0.1)' }}>
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,69,58,0.22)' }}>
      <div className="flex items-center gap-2 px-3 py-2.5 text-xs"
        style={{ background: 'rgba(255,59,48,0.05)' }}>
        <motion.div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: backendOk === null ? '#8e8e93' : '#ff3b30' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity }} />
        <span style={{ color: backendOk === null ? 'rgba(29,29,31,0.35)' : '#ff3b30' }}>
          {backendOk === null ? 'Verificare backend…' : 'Backend offline'}
        </span>
      </div>
      {backendOk === false && (
        <div className="px-3 py-2.5 space-y-2" style={{ background: 'rgba(242,242,247,0.9)' }}>
          {isCloud ? (
            <>
              <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(29,29,31,0.45)' }}>
                Pornești <strong style={{ color: 'rgba(29,29,31,0.65)' }}>START.bat</strong> pe PC și introdu URL-ul Tunnel:
              </p>
              <motion.button
                onClick={() => { setDraft(''); setEditing(true); }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', color: '#ff3b30' }}>
                Setează URL Tunnel
              </motion.button>
            </>
          ) : (
            <p className="text-[11px]" style={{ color: 'rgba(29,29,31,0.45)' }}>
              Pornești <strong style={{ color: 'rgba(29,29,31,0.65)' }}>START.bat</strong> și reîncarcă pagina.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function LoginScreen({ onLoggedIn, onShowLegal, onShowCerts }) {
  const { login, register, signInWithOAuth, initSupabaseSession } = useAuth();
  const { backendUrl } = useStore();

  const [mode, setMode]           = useState('login');
  const [email, setEmail]         = useState('');
  const [displayName, setDisplay] = useState('');
  const [password, setPassword]   = useState('');
  const [domain, setDomain]       = useState('general_ai');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [backendOk, setBackendOk] = useState(null);

  // T&C gate for new accounts and OAuth
  const [showTc, setShowTc]           = useState(false);
  const [pendingAction, setPending]   = useState(null); // fn to run after tc accept
  const [oauthLoading, setOauthLoad]  = useState('');
  const [captchaToken, setCaptchaToken] = useState();
  const turnstileRef = useRef(null);

  useEffect(() => {
    const check = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch(`${backendUrl}/health`, { signal: ctrl.signal });
        clearTimeout(t);
        setBackendOk(r.ok);
      } catch { clearTimeout(t); setBackendOk(false); }
    };
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, [backendUrl]);

  // Handle Supabase OAuth redirect callback automatically
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.access_token) {
        log.info('OAuth callback received, event=%s', event);
        const savedVer = localStorage.getItem('tc_accepted_version');
        const doFinish = async () => {
          try {
            const user = await initSupabaseSession();
            if (user) onLoggedIn(user);
          } catch (err) {
            log.error('OAuth session init failed', err);
            setError(err.message || 'OAuth sign-in failed.');
          }
        };
        if (savedVer === TC_VERSION) {
          await doFinish();
        } else {
          setPending(() => doFinish);
          setShowTc(true);
        }
      }
    });
    return () => subscription?.unsubscribe();
  }, [onLoggedIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'register') {
      if (!displayName.trim()) { setError('Introdu numele tău'); return; }
      const savedVer = localStorage.getItem('tc_accepted_version');
      if (savedVer !== TC_VERSION) {
        setPending(() => async () => {
          setLoading(true);
          try {
            const user = await register(email, password, displayName, domain, captchaToken);
            onLoggedIn(user);
          } catch (err) { setError(err.message || 'Eroare necunoscută'); turnstileRef.current?.reset(); setCaptchaToken(undefined); }
          finally { setLoading(false); }
        });
        setShowTc(true);
        return;
      }
    }
    setLoading(true);
    try {
      let user;
      if (mode === 'login') {
        user = await login(email, password, captchaToken);
      } else {
        user = await register(email, password, displayName, domain, captchaToken);
      }
      onLoggedIn(user);
    } catch (err) {
      setError(err.message || 'Eroare necunoscută');
      turnstileRef.current?.reset();
      setCaptchaToken(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    const savedVer = localStorage.getItem('tc_accepted_version');
    if (savedVer !== TC_VERSION) {
      setPending(() => async () => {
        setOauthLoad(provider);
        try { await signInWithOAuth(provider); }
        catch (err) { setError(err.message || 'Eroare OAuth'); setOauthLoad(''); }
      });
      setShowTc(true);
      return;
    }
    setOauthLoad(provider);
    try { await signInWithOAuth(provider); }
    catch (err) { setError(err.message || 'Eroare OAuth'); setOauthLoad(''); }
  };

  const handleTcAccept = useCallback((tcMeta) => {
    setShowTc(false);
    if (pendingAction) { pendingAction(tcMeta); setPending(null); }
  }, [pendingAction]);

  const handleTcCancel = useCallback(() => {
    setShowTc(false);
    setPending(null);
    setOauthLoad('');
  }, []);

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #f5f5f7 0%, #ffffff 50%, #f0f0f5 100%)', fontFamily: 'var(--font)' }}
    >
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute rounded-full" style={{ width: 700, height: 700, top: '-15%', left: '-12%', background: 'radial-gradient(circle, rgba(0,113,227,0.06) 0%, transparent 70%)' }} />
        <div className="absolute rounded-full" style={{ width: 550, height: 550, bottom: '-8%', right: '-8%', background: 'radial-gradient(circle, rgba(94,92,230,0.04) 0%, transparent 70%)' }} />
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[400px] mx-4 rounded-[24px] overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          backdropFilter: 'saturate(180%) blur(40px)',
          WebkitBackdropFilter: 'saturate(180%) blur(40px)',
        }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-7">
            <motion.div
              className="w-14 h-14 rounded-[16px] flex items-center justify-center text-2xl mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #0071e3 0%, #5e5ce6 100%)', boxShadow: '0 8px 26px rgba(0,113,227,0.28)' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            >
              ✦
            </motion.div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: '#1d1d1f' }}>Personal AI OS</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(29,29,31,0.45)' }}>
              {mode === 'login' ? 'Intră în contul tău' : 'Creează un cont nou'}
            </p>
          </div>

          {/* Backend status */}
          <BackendStatus backendOk={backendOk} backendUrl={backendUrl} />

          {/* Mode tab toggle */}
          <div className="flex gap-1 mb-6 p-1 rounded-[14px]" style={{ background: 'rgba(0,0,0,0.06)' }}>
            {['login', 'register'].map(m => (
              <motion.button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 rounded-[10px] text-sm relative overflow-hidden"
                style={{ color: mode === m ? '#1d1d1f' : 'rgba(29,29,31,0.4)', fontWeight: mode === m ? 600 : 400 }}
              >
                {mode === m && (
                  <motion.div layoutId="loginTabBg" className="absolute inset-0 rounded-[10px]"
                    style={{ background: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} />
                )}
                <span className="relative z-10">{m === 'login' ? 'Conectare' : 'Cont nou'}</span>
              </motion.button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgba(29,29,31,0.5)' }}>Email</label>
              <AppleInput value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="name@example.com" autoFocus required />
            </div>

            <AnimatePresence>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgba(29,29,31,0.5)' }}>Numele afișat</label>
                  <AppleInput value={displayName} onChange={e => setDisplay(e.target.value)} placeholder="ex: Maher" />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'rgba(29,29,31,0.5)' }}>Parolă</label>
              <AppleInput value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" required />
            </div>

            <AnimatePresence>
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <label className="text-xs font-medium block mb-2" style={{ color: 'rgba(29,29,31,0.5)' }}>Domeniu preferat</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {DOMAIN_OPTIONS.map(d => (
                      <motion.button
                        key={d.id} type="button"
                        onClick={() => setDomain(d.id)}
                        whileTap={{ scale: 0.93 }}
                        className="flex flex-col items-center py-2 px-1 rounded-xl text-[10px] transition-all"
                        style={{
                          background: domain === d.id ? `${d.color}15` : '#f2f2f7',
                          border: `1px solid ${domain === d.id ? d.color + '50' : 'rgba(0,0,0,0.08)'}`,
                          color: domain === d.id ? d.color : 'rgba(29,29,31,0.4)',
                        }}
                      >
                        <span className="text-base mb-0.5">{d.icon}</span>
                        <span className="font-medium leading-tight text-center">{d.label.split(' ')[0]}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-xs px-3.5 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.22)', color: '#ff3b30' }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cloudflare Turnstile CAPTCHA */}
            <div className="flex justify-center mt-1">
              <Turnstile
                ref={turnstileRef}
                siteKey="0x4AAAAAADCtFCQsISlYmQgt"
                onSuccess={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(undefined)}
                options={{ theme: 'light', size: 'normal' }}
              />
            </div>

            <motion.button
              type="submit" disabled={loading || !captchaToken}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.97 }}
              className="w-full py-3 rounded-[12px] font-semibold text-sm mt-1"
              style={{
                background: (loading || !captchaToken) ? 'rgba(0,0,0,0.1)' : '#0071e3',
                color: (loading || !captchaToken) ? 'rgba(29,29,31,0.3)' : '#ffffff',
                boxShadow: (loading || !captchaToken) ? 'none' : '0 4px 16px rgba(0,113,227,0.28)',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  Se procesează…
                </span>
              ) : (
                mode === 'login' ? 'Conectare' : 'Creare cont'
              )}
            </motion.button>
          </form>

          {/* OAuth divider */}
          <div className="flex items-center gap-3 mt-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
            <span className="text-[11px]" style={{ color: 'rgba(29,29,31,0.35)' }}>sau continuă cu</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* OAuth buttons */}
          <div className="flex gap-2 mt-3">
            {[
              { id: 'google',  label: 'Google',  icon: (<svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.9 0 7.1 1.3 9.5 3.5l7-7C36.4 2.1 30.6 0 24 0 14.7 0 6.7 5.4 2.8 13.3l8.1 6.3C12.7 13.3 17.9 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z"/><path fill="#FBBC05" d="M10.9 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.2 13c-1.4 2.8-2.2 6-2.2 9.3 0 3.4.8 6.6 2.2 9.5l8.7-3.2z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.6-5.9c-2.2 1.5-5 2.4-8.4 2.4-6.1 0-11.3-4-13.1-9.4l-8.7 3.2C6.7 42.7 14.7 48 24 48z"/></svg>) },
              { id: 'github',  label: 'GitHub',  icon: (<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.44 9.82 8.21 11.4.6.11.82-.26.82-.57v-2.01c-3.34.73-4.04-1.61-4.04-1.61-.54-1.37-1.33-1.74-1.33-1.74-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.01 2.05.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.69.82.57C20.56 21.82 24 17.31 24 12c0-6.63-5.37-12-12-12z"/></svg>) },
            ].map(({ id, label, icon }) => (
              <motion.button
                key={id}
                type="button"
                onClick={() => handleOAuth(id)}
                disabled={!!oauthLoading}
                whileHover={{ scale: oauthLoading ? 1 : 1.02 }}
                whileTap={{ scale: oauthLoading ? 1 : 0.97 }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] text-sm font-medium"
                style={{
                  background: '#f2f2f7',
                  border: '1px solid rgba(0,0,0,0.1)',
                  color: '#1d1d1f',
                  opacity: oauthLoading && oauthLoading !== id ? 0.5 : 1,
                }}
              >
                {oauthLoading === id
                  ? <motion.div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'rgba(0,0,0,0.15)', borderTopColor: '#1d1d1f' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  : icon}
                <span>{label}</span>
              </motion.button>
            ))}
          </div>

          {/* Footer links */}
          <div className="mt-5 flex items-center justify-center gap-3 text-[11px]" style={{ color: 'rgba(29,29,31,0.35)' }}>
            <button onClick={() => onShowLegal?.()} className="hover:underline" style={{ color: 'rgba(29,29,31,0.45)' }}>Termeni &amp; Condiții</button>
            <span>·</span>
            <button onClick={() => onShowCerts?.()} className="hover:underline" style={{ color: 'rgba(29,29,31,0.45)' }}>Furnizori</button>
            <span>·</span>
            <span>AI Operator OS</span>
          </div>
        </div>
      </motion.div>

      {/* T&C modal */}
      <TermsModal
        open={showTc}
        onAccept={handleTcAccept}
        onCancel={handleTcCancel}
        context={pendingAction ? 'register' : 'oauth'}
      />
    </div>
  );
}
