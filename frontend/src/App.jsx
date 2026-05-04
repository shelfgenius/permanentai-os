import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LoginScreen           from './components/LoginScreen.jsx';
import IntroScreen           from './components/IntroScreen.jsx';
import BackendStatusBanner   from './components/BackendStatusBanner.jsx';
import MiniPlayer            from './components/MiniPlayer.jsx';
import MainMenu              from './pages/MainMenu.jsx';
import useStore      from './store/useStore.js';
import useAuth       from './store/useAuth.js';
import { applyTheme } from './themes.js';
import { fetchGlobalSetting, subscribeGlobalSettings } from './lib/supabaseData.js';

// Lazy-loaded pages — each becomes its own JS chunk, downloaded only when visited
const AIHub      = lazy(() => import(/* webpackChunkName: "aura" */    './pages/AIHub.jsx'));
const LexiHub    = lazy(() => import(/* webpackChunkName: "lexi" */    './pages/LexiHub.jsx'));
const CanvasHub  = lazy(() => import(/* webpackChunkName: "canvas" */  './pages/CanvasHub.jsx'));
const NexusHub   = lazy(() => import(/* webpackChunkName: "nexus" */   './pages/NexusHub.jsx'));
const MappyHub   = lazy(() => import(/* webpackChunkName: "mappy" */   './pages/MappyHub.jsx'));
const SkyHub     = lazy(() => import(/* webpackChunkName: "sky" */     './pages/SkyHub.jsx'));
const EchoHub    = lazy(() => import(/* webpackChunkName: "echo" */    './pages/EchoHub.jsx'));
const SculptHub  = lazy(() => import(/* webpackChunkName: "sculpt" */  './pages/SculptHub.jsx'));
const YouTubeHub = lazy(() => import(/* webpackChunkName: "youtube" */ './pages/YouTubeHub.jsx'));
const SlideHub   = lazy(() => import(/* webpackChunkName: "slide" */   './pages/SlideHub.jsx'));
const AuraChat   = lazy(() => import(/* webpackChunkName: "aura-chat" */ './pages/AuraChat.jsx'));
const LegalPage  = lazy(() => import(/* webpackChunkName: "legal" */   './pages/LegalPage.jsx'));
const CertsPage  = lazy(() => import(/* webpackChunkName: "certs" */   './pages/CertsPage.jsx'));
const ConstructHub = lazy(() => import(/* webpackChunkName: "construct" */ './pages/ConstructHub.jsx'));

// Minimal loading spinner shown while a lazy chunk downloads
function PageLoader() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid rgba(0,113,227,0.15)', borderTopColor: '#0071e3', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const pageStyle = { position: 'fixed', inset: 0, width: '100%', height: '100dvh', overflowY: 'auto' };

// Map internal page IDs → URL paths
const PAGE_ROUTES = {
  ai:      '/aura',
  nexus:   '/nexus',
  mappy:   '/mappy',
  weather: '/sky',
  echo:    '/echo',
  sculpt:  '/sculpt',
  youtube: '/youtube',
  legal:   '/legal',
  certs:   '/certs',
  pascal:  '/pascal',
};

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setBackendUrl } = useStore();
  const { user, logout, initSupabaseSession } = useAuth();

  const [introDone, setIntroDone] = useState(
    () => localStorage.getItem('introCompleted') === 'true',
  );

  /* ── Persist last route so reload restores exact page ─────────── */
  useEffect(() => {
    if (user && location.pathname !== '/') {
      localStorage.setItem('lastRoute', location.pathname);
    }
  }, [location.pathname, user]);

  // Restore last route on login/reload if landing on root
  useEffect(() => {
    if (user && location.pathname === '/') {
      const last = localStorage.getItem('lastRoute');
      if (last && last !== '/') navigate(last, { replace: true });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Apply saved theme on first load ───────────────────────────── */
  useEffect(() => {
    const savedTheme = localStorage.getItem('themeId') || 'default';
    applyTheme(savedTheme);
  }, []);

  useEffect(() => {
    initSupabaseSession();
  }, [initSupabaseSession]);

  /* ── Electron backend URL IPC (desktop build) ──────────────────── */
  useEffect(() => {
    if (window.electron?.getBackendUrl) {
      window.electron.getBackendUrl().then((url) => url && setBackendUrl(url));
    }
  }, [setBackendUrl]);

  /* ── Global backend_url from Supabase (any user sets, all accounts receive) ── */
  useEffect(() => {
    const locked = () => localStorage.getItem('backendUrl_locked') === '1';
    const apply = async () => {
      if (locked()) return;
      const url = await fetchGlobalSetting('backend_url');
      if (url && url.length > 5) setBackendUrl(url);
    };
    apply();
    const unsub = subscribeGlobalSettings((key, value) => {
      if (key === 'backend_url' && value && value.length > 5 && !locked()) setBackendUrl(value);
    });
    return () => unsub();
  }, [setBackendUrl]);

  /* ── Handlers ──────────────────────────────────────────────────── */
  const handleIntroComplete = (profile) => {
    setIntroDone(true);
    if (profile?.name) sessionStorage.setItem('introName', profile.name);
  };

  const handleLoggedIn = () => {
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const goBack = () => navigate('/');

  // Navigate to a page by internal ID (used by MainMenu.onSelect)
  const handleSelect = (id) => {
    const path = PAGE_ROUTES[id];
    if (path) navigate(path);
  };

  /* ── Intro (first-time only) ───────────────────────────────────── */
  if (!introDone) {
    return (
      <AnimatePresence>
        <IntroScreen onComplete={handleIntroComplete} />
      </AnimatePresence>
    );
  }

  /* ── Login gate — legal/certs accessible before login ───────────── */
  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/legal" element={<LegalPage onBack={() => navigate('/')} />} />
          <Route path="/certs" element={<CertsPage onBack={() => navigate('/')} />} />
          <Route path="*" element={
            <LoginScreen
              onLoggedIn={handleLoggedIn}
              onShowLegal={() => navigate('/legal')}
              onShowCerts={() => navigate('/certs')}
            />
          } />
        </Routes>
      </Suspense>
    );
  }

  /* ── Authenticated routes ─────────────────────────────────────── */
  return (
    <>
      <BackendStatusBanner />
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={pageStyle}
          >
            <Routes location={location}>
              <Route path="/" element={
                <MainMenu currentUser={user} onLogout={handleLogout} onSelect={handleSelect} />
              } />
              <Route path="/aura" element={
                <AIHub currentUser={user} onBack={goBack} onLogout={handleLogout} onNavigate={navigate} />
              } />
              <Route path="/aura-chat" element={
                <AuraChat onBack={goBack} />
              } />
              <Route path="/lexi" element={
                <LexiHub onBack={goBack} />
              } />
              <Route path="/canvas" element={
                <CanvasHub onBack={goBack} />
              } />
              <Route path="/nexus" element={
                <NexusHub onBack={goBack} />
              } />
              <Route path="/mappy" element={
                <MappyHub onBack={goBack} />
              } />
              <Route path="/sky" element={
                <SkyHub onBack={goBack} />
              } />
              <Route path="/echo" element={
                <EchoHub onBack={goBack} />
              } />
              <Route path="/sculpt" element={
                <SculptHub onBack={goBack} />
              } />
              <Route path="/youtube" element={
                <YouTubeHub onBack={goBack} />
              } />
              <Route path="/slide" element={
                <SlideHub onBack={goBack} />
              } />
              <Route path="/legal" element={
                <LegalPage onBack={goBack} />
              } />
              <Route path="/certs" element={
                <CertsPage onBack={goBack} />
              } />
              <Route path="/pascal" element={
                <ConstructHub onBack={goBack} />
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <MiniPlayer />
    </>
  );
}
