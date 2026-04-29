import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const AGENT_COLORS = {
  Aura: '#0a84ff', Nexus: '#30d158', Mappy: '#ff9f0a', Sky: '#00b4d8', Echo: '#ff6b35',
};
const AGENT_ICONS = {
  Aura: '◉', Nexus: '⬡', Mappy: '▶', Sky: '🌍', Echo: '💻',
};

function CopyButton({ text, small }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md transition-all"
      style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(29,29,31,0.45)' }}
      onClick={handleCopy}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SourcesPanel({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-2 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors"
        style={{ background: '#f2f2f7', color: 'rgba(29,29,31,0.45)' }}
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium">{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div style={{ background: '#ffffff' }}>
          {sources.map((src, i) => (
            <div key={i} className="px-3 py-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="text-xs font-semibold truncate" style={{ color: '#ff9500' }}>{src.title || src.source || 'Document'}</div>
              {src.excerpt && <p className="text-[11px] mt-0.5 line-clamp-2 leading-relaxed" style={{ color: 'rgba(29,29,31,0.45)' }}>{src.excerpt}</p>}
              {src.score !== undefined && <div className="text-[10px] mt-1" style={{ color: 'rgba(29,29,31,0.3)' }}>Relevance: {(src.score * 100).toFixed(0)}%</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');
  if (!inline && match) {
    return (
      <div className="my-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
        <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#f2f2f7', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <span className="text-[11px] font-mono" style={{ color: 'rgba(29,29,31,0.38)', fontFamily: 'SF Mono, JetBrains Mono, monospace' }}>{match[1]}</span>
          <CopyButton text={code} />
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, background: '#fafafa', fontSize: '13px', lineHeight: '1.6', border: 'none' }}
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code style={{ background: 'rgba(0,0,0,0.06)', color: '#af52de', padding: '2px 7px', borderRadius: '6px', fontSize: '0.875em', fontFamily: 'SF Mono, JetBrains Mono, monospace' }} {...props}>
      {children}
    </code>
  );
};

export function TypingIndicator() {
  return (
    <motion.div
      className="flex items-end gap-2 px-4 py-1.5"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div className="px-4 py-3 bubble-ai">
        <div className="flex items-center gap-1">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Parse multi-agent response: splits on [AgentName]: tags.
 * Falls back to standard markdown if no tags found.
 */
function AgentTaggedContent({ content }) {
  const segments = useMemo(() => {
    if (!content) return [];
    // Split on [AgentName]: pattern
    const re = /\[(\w+)\]:\s*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = re.exec(content)) !== null) {
      // Push any text before this tag as continuation of previous segment
      if (match.index > lastIndex && parts.length > 0) {
        parts[parts.length - 1].text += content.slice(lastIndex, match.index);
      }
      parts.push({ agent: match[1], text: '' });
      lastIndex = re.lastIndex;
    }

    // Remaining text
    if (lastIndex < content.length) {
      if (parts.length > 0) {
        parts[parts.length - 1].text += content.slice(lastIndex);
      } else {
        // No agent tags found — render as plain
        parts.push({ agent: null, text: content });
      }
    }

    return parts;
  }, [content]);

  // No agent tags — standard markdown
  if (segments.length <= 1 && !segments[0]?.agent) {
    return (
      <div className="prose-dark">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ code: CodeBlock }}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {segments.map((seg, i) => {
        const color = AGENT_COLORS[seg.agent] || '#8e8e93';
        const icon = AGENT_ICONS[seg.agent] || '•';
        return (
          <div key={i}>
            {seg.agent && (
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    background: `${color}15`,
                    color: color,
                    border: `1px solid ${color}30`,
                    letterSpacing: '0.06em',
                  }}
                >
                  <span style={{ fontSize: 10 }}>{icon}</span>
                  {seg.agent}
                </span>
              </div>
            )}
            <div className="prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ code: CodeBlock }}>
                {seg.text.trim()}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MessageBubble({ message, isLast }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      className={`flex items-end gap-2 px-4 py-1 ${isUser ? 'flex-row-reverse' : ''}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Bubble */}
        <div className={isUser ? 'bubble-user px-4 py-2.5 text-sm leading-relaxed' : 'bubble-ai px-4 py-2.5 text-sm leading-relaxed'}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <AgentTaggedContent content={message.content} />
          )}
        </div>

        {!isUser && message.sources && (
          <div className="w-full">
            <SourcesPanel sources={message.sources} />
          </div>
        )}

        {/* Timestamp + copy */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px]" style={{ color: 'rgba(29,29,31,0.28)' }}>
            {new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {!isUser && message.content && <CopyButton text={message.content} />}
        </div>
      </div>
    </motion.div>
  );
}
