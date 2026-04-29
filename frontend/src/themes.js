export const THEMES = {
  default: {
    id: 'default',
    name: '🍎 Apple',
    vars: {
      '--bg':               '#f5f5f7',
      '--bg-grad':          'linear-gradient(180deg, #ffffff 0%, #f5f5f7 100%)',
      '--surface':          '#ffffff',
      '--surface2':         '#f2f2f7',
      '--surface3':         '#e5e5ea',
      '--border':           'rgba(0,0,0,0.1)',
      '--border-light':     'rgba(0,0,0,0.06)',
      '--accent':           '#0071e3',
      '--accent2':          '#0077ed',
      '--text':             '#1d1d1f',
      '--text-secondary':   'rgba(29,29,31,0.55)',
      '--text-muted':       'rgba(29,29,31,0.32)',
      '--glow':             'none',
      '--font':             "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, 'Helvetica Neue', sans-serif",
      '--vibrancy':         'rgba(255,255,255,0.85)',
      '--vibrancy-border':  'rgba(0,0,0,0.08)',
    },
    scanlines: false,
  },
  retro: {
    id: 'retro',
    name: '🟣 Retro',
    vars: {
      '--bg':        '#07041a',
      '--bg-grad':   'radial-gradient(ellipse at 30% 40%, #1a0a3a 0%, #07041a 50%, #040a1e 100%)',
      '--surface':   '#0e0824',
      '--surface2':  '#160b30',
      '--border':    '#2d1b5e',
      '--accent':    '#a855f7',
      '--accent2':   '#3b82f6',
      '--text':      '#d4b8ff',
      '--text-muted':'#7c5cbf',
      '--glow':      '0 0 20px #a855f755, 0 0 40px #3b82f622',
      '--font':      "'Courier New', 'Courier', monospace",
    },
    scanlines: true,
  },
  neon: {
    id: 'neon',
    name: '💚 Neon',
    vars: {
      '--bg':        '#020a06',
      '--bg-grad':   'radial-gradient(ellipse at 50% 50%, #001a0f 0%, #020a06 70%)',
      '--surface':   '#040f07',
      '--surface2':  '#071508',
      '--border':    '#004422',
      '--accent':    '#00ff88',
      '--accent2':   '#ff0080',
      '--text':      '#ccffe8',
      '--text-muted':'#338855',
      '--glow':      '0 0 18px #00ff8855',
      '--font':      "'Orbitron', monospace",
    },
    scanlines: false,
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: '🟡 Cyberpunk',
    vars: {
      '--bg':        '#0a0600',
      '--bg-grad':   'radial-gradient(ellipse at 70% 30%, #1a0a00 0%, #0a0600 60%)',
      '--surface':   '#0f0800',
      '--surface2':  '#160c00',
      '--border':    '#3a2000',
      '--accent':    '#f0c040',
      '--accent2':   '#ff007f',
      '--text':      '#fff0b3',
      '--text-muted':'#886633',
      '--glow':      '0 0 20px #f0c04044',
      '--font':      "'Orbitron', monospace",
    },
    scanlines: false,
  },
  ocean: {
    id: 'ocean',
    name: '🔵 Ocean',
    vars: {
      '--bg':        '#020d1a',
      '--bg-grad':   'radial-gradient(ellipse at 50% 0%, #001a33 0%, #020d1a 60%)',
      '--surface':   '#040f1e',
      '--surface2':  '#071525',
      '--border':    '#0a2a44',
      '--accent':    '#00d4ff',
      '--accent2':   '#0066cc',
      '--text':      '#b3e8ff',
      '--text-muted':'#3366aa',
      '--glow':      '0 0 15px #00d4ff44',
      '--font':      "'Orbitron', monospace",
    },
    scanlines: false,
  },
};

export function getTheme(id) {
  return THEMES[id] ?? THEMES.default;
}

export function applyTheme(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  // Scanlines class
  if (theme.scanlines) {
    document.body.classList.add('theme-scanlines');
  } else {
    document.body.classList.remove('theme-scanlines');
  }
  return theme;
}
