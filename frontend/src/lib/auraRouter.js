/**
 * Aura Command Router
 *
 * Parses user intent from natural language and routes to the correct app.
 * Returns { action, app, route, params, spokenResponse } or null if no match.
 *
 * Supported intents:
 *   - Music/YouTube:  "play [song]", "search [song]", "stop music"
 *   - Smart home:     "turn off AC", "set temperature", "lights on/off"
 *   - 3D/Design:      "create 3d model", "sculpt [thing]", "design [thing]"
 *   - Image/Canvas:   "draw [thing]", "generate image", "create art"
 *   - Presentation:   "make presentation", "create slides about [topic]"
 *   - Weather:        "what's the weather", "forecast"
 *   - Maps:           "navigate to", "find [place]", "directions to"
 *   - Code/Echo:      "write code", "debug", "refactor"
 *   - Search/Lexi:    "search for", "research about", "look up"
 */

// ── Intent patterns ──────────────────────────────────────────────

const INTENTS = [
  // ── YouTube / Music ──
  {
    id: 'play_music',
    patterns: [
      /^(?:play|put on|start playing|listen to)\s+(.+)/i,
      /^(?:play|pune|dă drumul la|ascultă)\s+(.+)/i, // Romanian
    ],
    app: 'youtube',
    route: '/youtube',
    action: 'play',
    getParams: (m) => ({ query: m[1].trim() }),
    response: (m) => `Playing "${m[1].trim()}" on YouTube...`,
  },
  {
    id: 'search_music',
    patterns: [
      /^(?:search|find)(?:\s+(?:for|a))?\s+(?:song|music|video)\s+(.+)/i,
      /^(?:caută|găsește)\s+(?:melodia?|cântecul?|muzică)\s+(.+)/i,
    ],
    app: 'youtube',
    route: '/youtube',
    action: 'search',
    getParams: (m) => ({ query: m[1].trim() }),
    response: (m) => `Searching for "${m[1].trim()}" on YouTube...`,
  },
  {
    id: 'stop_music',
    patterns: [
      /^(?:stop|pause|mute)\s+(?:the\s+)?(?:music|song|video|playback)/i,
      /^(?:oprește|pauză|stop)\s+(?:muzica|cântecul)/i,
    ],
    app: 'youtube',
    route: null, // don't navigate, just action
    action: 'stop_music',
    getParams: () => ({}),
    response: () => 'Stopping music.',
  },

  // ── Smart Home / Nexus ──
  {
    id: 'ac_control',
    patterns: [
      /^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(?:ac|air\s*condition(?:er|ing)?|a\.?c\.?)/i,
      /^(?:ac|air\s*condition(?:er|ing)?|a\.?c\.?)\s+(on|off)/i,
      /^(?:pornește|oprește|deschide|închide)\s+(?:aerul\s*condiționat|ac-?ul)/i,
    ],
    app: 'nexus',
    route: '/nexus',
    action: 'ac_control',
    getParams: (m) => ({ state: m[1]?.toLowerCase() === 'on' || /pornește|deschide/.test(m[0]) ? 'on' : 'off' }),
    response: (m) => {
      const on = m[1]?.toLowerCase() === 'on' || /pornește|deschide/.test(m[0]);
      return `Turning the AC ${on ? 'on' : 'off'}.`;
    },
  },
  {
    id: 'temperature',
    patterns: [
      /^(?:set|change)\s+(?:the\s+)?(?:temperature|temp)\s+(?:to\s+)?(\d+)/i,
      /^(?:temperature|temp)\s+(?:to\s+)?(\d+)/i,
      /^(?:setează|pune)\s+(?:temperatura)\s+(?:la|pe)\s+(\d+)/i,
    ],
    app: 'nexus',
    route: '/nexus',
    action: 'set_temperature',
    getParams: (m) => ({ temperature: parseInt(m[1]) }),
    response: (m) => `Setting temperature to ${m[1]}°C.`,
  },
  {
    id: 'lights',
    patterns: [
      /^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(?:lights?|lamp)/i,
      /^(?:lights?|lamp)\s+(on|off)/i,
      /^(?:pornește|oprește|deschide|închide)\s+(?:lumina|luminile|lampa)/i,
    ],
    app: 'nexus',
    route: '/nexus',
    action: 'lights_control',
    getParams: (m) => ({ state: m[1]?.toLowerCase() === 'on' || /pornește|deschide/.test(m[0]) ? 'on' : 'off' }),
    response: (m) => {
      const on = m[1]?.toLowerCase() === 'on' || /pornește|deschide/.test(m[0]);
      return `Turning the lights ${on ? 'on' : 'off'}.`;
    },
  },
  {
    id: 'tv_control',
    patterns: [
      /^(?:turn|switch)\s+(on|off)\s+(?:the\s+)?(?:tv|television)/i,
      /^(?:tv|television)\s+(on|off)/i,
      /^(?:pornește|oprește|deschide|închide)\s+(?:tv-?ul|televizorul)/i,
    ],
    app: 'nexus',
    route: '/nexus',
    action: 'tv_control',
    getParams: (m) => ({ state: m[1]?.toLowerCase() === 'on' || /pornește|deschide/.test(m[0]) ? 'on' : 'off' }),
    response: (m) => {
      const on = m[1]?.toLowerCase() === 'on' || /pornește|deschide/.test(m[0]);
      return `Turning the TV ${on ? 'on' : 'off'}.`;
    },
  },

  // ── 3D / Sculpt ──
  {
    id: 'create_3d',
    patterns: [
      /^(?:create|make|generate|build)\s+(?:a\s+)?(?:3d\s*model|3d\s*object|sculpture|3d)\s*(?:of\s+)?(.+)?/i,
      /^(?:sculpt|model)\s+(?:a\s+)?(.+)/i,
      /^(?:creează|fă|generează)\s+(?:un\s+)?(?:model\s*3d|obiect\s*3d|sculptură)\s*(?:de|cu)?\s*(.+)?/i,
    ],
    app: 'sculpt',
    route: '/sculpt',
    action: 'create_3d',
    getParams: (m) => ({ prompt: (m[1] || '').trim() }),
    response: (m) => m[1] ? `Opening Sculpt to create a 3D model of "${m[1].trim()}"...` : 'Opening Sculpt...',
  },

  // ── Image / Canvas ──
  {
    id: 'create_image',
    patterns: [
      /^(?:create|make|generate|draw|paint)\s+(?:an?\s+)?(?:image|picture|art|illustration|drawing|poster|design)\s*(?:of\s+)?(.+)?/i,
      /^(?:draw|paint|sketch)\s+(?:a\s+)?(.+)/i,
      /^(?:creează|fă|generează|desenează)\s+(?:o\s+)?(?:imagine|poză|artă|ilustrație|desen)\s*(?:de|cu)?\s*(.+)?/i,
    ],
    app: 'canvas',
    route: '/canvas',
    action: 'create_image',
    getParams: (m) => ({ prompt: (m[1] || '').trim() }),
    response: (m) => m[1] ? `Opening Canvas to create "${m[1].trim()}"...` : 'Opening Canvas...',
  },

  // ── Presentation / Slides ──
  {
    id: 'create_presentation',
    patterns: [
      /^(?:create|make|generate|build)\s+(?:a\s+)?(?:presentation|ppt|powerpoint|slides?|deck)\s*(?:about|on|for)?\s*(.+)?/i,
      /^(?:creează|fă|generează)\s+(?:o\s+)?(?:prezentare|slide-?uri)\s*(?:despre|pe tema|pentru)?\s*(.+)?/i,
    ],
    app: 'slide',
    route: '/slide',
    action: 'create_presentation',
    getParams: (m) => ({ topic: (m[1] || '').trim() }),
    response: (m) => m[1] ? `Creating a presentation about "${m[1].trim()}"...` : 'Opening SlideHub...',
  },

  // ── Weather / Sky ──
  {
    id: 'weather',
    patterns: [
      /^(?:what(?:'s| is)\s+(?:the\s+)?)?(?:weather|forecast|temperature\s+outside)/i,
      /^(?:how(?:'s| is)\s+(?:the\s+)?)?weather/i,
      /^(?:cum\s+e|care\s+e)\s+(?:vremea|temperatura)/i,
      /^(?:prognoza?\s+meteo|vremea)/i,
    ],
    app: 'sky',
    route: '/sky',
    action: 'show_weather',
    getParams: () => ({}),
    response: () => 'Checking the weather for you...',
  },

  // ── Maps / Navigation ──
  {
    id: 'navigate_to',
    patterns: [
      /^(?:navigate|directions?|take me|go)\s+(?:to\s+)?(.+)/i,
      /^(?:find|show|where\s+is)\s+(.+?)\s+(?:on\s+(?:the\s+)?map)?$/i,
      /^(?:navighează|du-mă|mergi)\s+(?:la|spre|către)\s+(.+)/i,
    ],
    app: 'mappy',
    route: '/mappy',
    action: 'navigate',
    getParams: (m) => ({ destination: m[1].trim() }),
    response: (m) => `Opening maps to navigate to "${m[1].trim()}"...`,
  },

  // ── Code / Echo ──
  {
    id: 'write_code',
    patterns: [
      /^(?:write|code|create|build)\s+(?:a\s+)?(?:code|program|script|function|app|website)\s*(?:for|that|to)?\s*(.+)?/i,
      /^(?:debug|fix|refactor|optimize)\s+(.+)?/i,
      /^(?:scrie|creează)\s+(?:un\s+)?(?:cod|program|script|funcție)\s*(?:pentru|care|să)?\s*(.+)?/i,
    ],
    app: 'echo',
    route: '/echo',
    action: 'code',
    getParams: (m) => ({ prompt: (m[1] || '').trim() }),
    response: (m) => m[1] ? `Opening Echo to work on "${m[1].trim()}"...` : 'Opening Echo...',
  },

  // ── Research / Lexi ──
  {
    id: 'research',
    patterns: [
      /^(?:research|deep\s*dive|analyze|investigate)\s+(?:about\s+)?(.+)/i,
      /^(?:cercetează|analizează|investighează)\s+(.+)/i,
    ],
    app: 'lexi',
    route: '/lexi',
    action: 'research',
    getParams: (m) => ({ query: m[1].trim() }),
    response: (m) => `Opening Lexi to research "${m[1].trim()}"...`,
  },

  // ── Open app by name ──
  {
    id: 'open_app',
    patterns: [
      /^(?:open|launch|go\s+to|show|switch\s+to)\s+(.+)/i,
      /^(?:deschide|lansează|du-mă\s+la|arată)\s+(.+)/i,
    ],
    app: null, // resolved dynamically
    route: null,
    action: 'open_app',
    getParams: (m) => ({ appName: m[1].trim().toLowerCase() }),
    response: null, // set dynamically
  },
];

// App name → route mapping
const APP_ROUTES = {
  youtube:      '/youtube',
  'youtube aura': '/youtube',
  music:        '/youtube',
  sculpt:       '/sculpt',
  '3d':         '/sculpt',
  canvas:       '/canvas',
  design:       '/canvas',
  draw:         '/canvas',
  art:          '/canvas',
  slide:        '/slide',
  slides:       '/slide',
  presentation: '/slide',
  powerpoint:   '/slide',
  ppt:          '/slide',
  sky:          '/sky',
  weather:      '/sky',
  mappy:        '/mappy',
  maps:         '/mappy',
  map:          '/mappy',
  echo:         '/echo',
  code:         '/echo',
  lexi:         '/lexi',
  search:       '/lexi',
  nexus:        '/nexus',
  home:         '/nexus',
  dashboard:    '/nexus',
  aura:         '/aura',
  settings:     '/aura',
};

/**
 * Parse a user message and determine if it's a command for another app.
 *
 * @param {string} message - The user's raw text
 * @returns {{ action: string, app: string, route: string|null, params: object, spokenResponse: string } | null}
 */
export function parseAuraCommand(message) {
  if (!message || message.trim().length < 2) return null;

  const text = message.trim();

  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      const match = text.match(pattern);
      if (match) {
        // Handle "open app" specially — resolve app name
        if (intent.id === 'open_app') {
          const appName = match[1].trim().toLowerCase();
          const route = APP_ROUTES[appName];
          if (route) {
            return {
              action: 'open_app',
              app: appName,
              route,
              params: {},
              spokenResponse: `Opening ${appName}...`,
            };
          }
          // No matching app — fall through to let AI answer
          return null;
        }

        return {
          action: intent.action,
          app: intent.app,
          route: intent.route,
          params: intent.getParams(match),
          spokenResponse: typeof intent.response === 'function' ? intent.response(match) : '',
        };
      }
    }
  }

  return null;
}

/**
 * Execute a routed command.
 * Navigates to the target app and optionally passes params via sessionStorage.
 *
 * @param {{ action, app, route, params, spokenResponse }} cmd
 * @param {object} options
 * @param {Function} options.navigate - React router navigate or window.location
 * @param {Function} [options.onSpeak] - TTS callback
 * @param {Function} [options.onMusicAction] - For music play/pause/stop
 */
export function executeAuraCommand(cmd, { navigate, onSpeak, onMusicAction } = {}) {
  if (!cmd) return;

  // Speak the response
  if (onSpeak && cmd.spokenResponse) {
    onSpeak(cmd.spokenResponse);
  }

  // Store params for the target app to pick up
  if (cmd.params && Object.keys(cmd.params).length > 0) {
    sessionStorage.setItem(`aura_cmd_${cmd.app}`, JSON.stringify({
      action: cmd.action,
      params: cmd.params,
      ts: Date.now(),
    }));
  }

  // Music control (don't navigate)
  if (cmd.action === 'stop_music' && onMusicAction) {
    onMusicAction('stop');
    return;
  }

  // Navigate to the target app
  if (cmd.route) {
    setTimeout(() => {
      if (typeof navigate === 'function') {
        navigate(cmd.route);
      } else {
        window.location.href = cmd.route;
      }
    }, 1200); // delay so TTS starts before navigation
  }
}

/**
 * Check if the target app has a pending Aura command.
 * Call this in the target app's useEffect to pick up commands.
 *
 * @param {string} appName - e.g. 'youtube', 'sculpt', 'canvas'
 * @returns {{ action: string, params: object } | null}
 */
export function consumeAuraCommand(appName) {
  const key = `aura_cmd_${appName}`;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    const cmd = JSON.parse(raw);
    // Only consume commands less than 30 seconds old
    if (Date.now() - cmd.ts > 30000) {
      sessionStorage.removeItem(key);
      return null;
    }
    sessionStorage.removeItem(key);
    return { action: cmd.action, params: cmd.params };
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}
