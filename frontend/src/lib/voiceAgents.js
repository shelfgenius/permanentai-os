/**
 * Voice Agent Registry — XTTS metadata for the 5-agent ensemble.
 *
 * Every response block should be prefixed with [AgentName]: so the
 * TTS pipeline can route to the correct XTTS speaker embedding.
 *
 * Format: [Aura]: Hello Maher, ...
 *
 * The Python TTS server parses the agent tag and loads the matching
 * reference audio file for Coqui XTTS voice cloning.
 */

export const VOICE_AGENTS = {
  Aura: {
    id: 'aura',
    name: 'Aura',
    role: 'Lead AI Strategist',
    voice: 'female_calm',
    kokoroVoice: 'bf_emma',
    style: 'Calm, composed, elegant — F.R.I.D.A.Y.-like',
    color: '#0a84ff',
    referenceAudio: 'voices/aura_calm.wav',
    xttsSettings: { temperature: 0.65, repetition_penalty: 5.0, speed: 1.0 },
  },
  Nexus: {
    id: 'nexus',
    name: 'Nexus',
    role: 'Home Automation',
    voice: 'male_deep',
    kokoroVoice: 'am_adam',
    style: 'Steady, reliable, grounded',
    color: '#30d158',
    referenceAudio: 'voices/nexus_deep.wav',
    xttsSettings: { temperature: 0.5, repetition_penalty: 5.0, speed: 0.95 },
  },
  Mappy: {
    id: 'mappy',
    name: 'Mappy',
    role: 'GPS Navigation',
    voice: 'male_highpitch',
    kokoroVoice: 'bm_lewis',
    style: 'Stressed, agitated, hurried',
    color: '#ff9f0a',
    referenceAudio: 'voices/mappy_agitated.wav',
    xttsSettings: { temperature: 0.8, repetition_penalty: 4.0, speed: 1.15 },
  },
  Sky: {
    id: 'sky',
    name: 'Sky',
    role: 'Weather Forecast',
    voice: 'female_anxious',
    kokoroVoice: 'af_sky',
    style: 'Worried, nervous, concerned',
    color: '#00b4d8',
    referenceAudio: 'voices/sky_anxious.wav',
    xttsSettings: { temperature: 0.75, repetition_penalty: 4.5, speed: 1.05 },
  },
  Echo: {
    id: 'echo',
    name: 'Echo',
    role: 'Coding AI',
    voice: 'male_normal',
    kokoroVoice: 'am_michael',
    style: 'Pragmatic, straightforward, conversational',
    color: '#ff6b35',
    referenceAudio: 'voices/echo_normal.wav',
    xttsSettings: { temperature: 0.6, repetition_penalty: 5.0, speed: 1.0 },
  },
};

/**
 * Parse agent tag from a response line.
 * Input: "[Aura]: Hello there" → { agent: 'Aura', text: 'Hello there' }
 * Input: "Some plain text" → { agent: null, text: 'Some plain text' }
 */
export function parseAgentTag(line) {
  const match = line.match(/^\[(\w+)\]:\s*(.*)/);
  if (match) {
    const agentName = match[1];
    const text = match[2];
    return { agent: VOICE_AGENTS[agentName] || null, agentName, text };
  }
  return { agent: null, agentName: null, text: line };
}

/**
 * Split a multi-agent response into tagged segments.
 * Each segment is { agent, text } ready for XTTS routing.
 */
export function splitAgentResponse(fullText) {
  const lines = fullText.split('\n');
  const segments = [];
  let current = null;

  for (const line of lines) {
    const { agent, agentName, text } = parseAgentTag(line);
    if (agentName && agent) {
      if (current) segments.push(current);
      current = { agent, agentName, text };
    } else if (current) {
      current.text += '\n' + line;
    } else {
      // No agent tag yet — default to Aura
      current = { agent: VOICE_AGENTS.Aura, agentName: 'Aura', text: line };
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Stream buffer — accumulates text until a sentence boundary,
 * then fires the callback with the complete sentence for TTS.
 * This achieves "Gemini-like" speed by sending sentences as
 * they are generated rather than waiting for the whole paragraph.
 */
export class StreamBuffer {
  constructor(onSentence) {
    this.buffer = '';
    this.onSentence = onSentence;
    this.currentAgent = null;
  }

  /** Feed new text chunk from SSE stream */
  push(chunk) {
    // Check for agent tag at start of chunk
    const tagMatch = chunk.match(/^\[(\w+)\]:\s*/);
    if (tagMatch) {
      // Flush previous buffer before switching agent
      this.flush();
      this.currentAgent = VOICE_AGENTS[tagMatch[1]] || VOICE_AGENTS.Aura;
      chunk = chunk.replace(tagMatch[0], '');
    }

    this.buffer += chunk;

    // Sentence boundary detection: . ! ? followed by space or end
    const sentenceEnd = /[.!?]\s+|[.!?]$/;
    let match;
    while ((match = sentenceEnd.exec(this.buffer)) !== null) {
      const sentence = this.buffer.slice(0, match.index + match[0].length).trim();
      this.buffer = this.buffer.slice(match.index + match[0].length);
      if (sentence.length > 2) {
        this.onSentence({
          text: sentence,
          agent: this.currentAgent || VOICE_AGENTS.Aura,
        });
      }
    }
  }

  /** Flush remaining buffer */
  flush() {
    if (this.buffer.trim().length > 2) {
      this.onSentence({
        text: this.buffer.trim(),
        agent: this.currentAgent || VOICE_AGENTS.Aura,
      });
    }
    this.buffer = '';
  }
}
