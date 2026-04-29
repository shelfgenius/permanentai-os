import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, ChevronDown, Globe, Image, Languages, Brain } from 'lucide-react';
import useStore from '../store/useStore.js';

const DOMAIN_MODES = [
  { id: null,           label: 'Auto',          icon: Globe,     color: '#0071e3', placeholder: 'Ask me anything...' },
  { id: 'image_gen',    label: 'Canvas',        icon: Image,     color: '#e040fb', placeholder: 'Describe the image you want to create...' },
  { id: 'translation',  label: 'Lexi',          icon: Languages,  color: '#00b8ff', placeholder: 'Paste text to translate...' },
  { id: 'general_ai',   label: 'Aura',          icon: Brain,     color: '#00cc66', placeholder: 'Ask me anything, test my limits and your vision...' },
];

export default function InputBox({ onSend, onStop, isStreaming, disabled }) {
  const [text, setText] = useState('');
  const [domainMode, setDomainMode] = useState(null);
  const [showModes, setShowModes] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [text]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    if (isStreaming) { onStop(); return; }
    onSend(text.trim());
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const activeDomain = DOMAIN_MODES.find((m) => m.id === domainMode) ?? DOMAIN_MODES[0];
  const ModeIcon = activeDomain.icon;
  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="relative">
      <motion.div
        className="relative flex items-end gap-2 px-3 py-2 rounded-[22px]"
        style={{
          background: '#ffffff',
          border: `1.5px solid ${isStreaming ? 'rgba(0,113,227,0.5)' : 'rgba(0,0,0,0.1)'}`,
          boxShadow: isStreaming ? '0 0 0 3px rgba(0,113,227,0.1)' : '0 2px 8px rgba(0,0,0,0.07)',
          backdropFilter: 'saturate(180%) blur(20px)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {/* Domain selector */}
        <div className="relative flex-shrink-0 self-end pb-1">
          <motion.button
            className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs transition-colors"
            style={{ color: 'rgba(29,29,31,0.4)', background: 'rgba(0,0,0,0.04)' }}
            onClick={() => setShowModes(!showModes)}
            type="button"
            whileTap={{ scale: 0.92 }}
          >
            <ModeIcon size={12} />
            <ChevronDown size={9} className={`transition-transform duration-200 ${showModes ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {showModes && (
              <motion.div
                className="absolute bottom-full mb-2 left-0 rounded-2xl overflow-hidden z-50 min-w-[150px]"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  backdropFilter: 'blur(20px)',
                }}
                initial={{ opacity: 0, y: 6, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                {DOMAIN_MODES.map((mode) => {
                  const Icon = mode.icon;
                  const isActive = domainMode === mode.id;
                  return (
                    <motion.button
                      key={String(mode.id)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left"
                      style={{
                        color: isActive ? '#0071e3' : 'rgba(29,29,31,0.65)',
                        background: isActive ? 'rgba(0,113,227,0.08)' : 'transparent',
                        fontWeight: isActive ? 600 : 400,
                        transition: 'background 0.15s',
                      }}
                      whileHover={{ background: isActive ? 'rgba(0,113,227,0.1)' : 'rgba(0,0,0,0.04)' }}
                      onClick={() => { setDomainMode(mode.id); setShowModes(false); }}
                    >
                      <Icon size={12} />
                      {mode.label}
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Generating…' : (DOMAIN_MODES.find(m => m.id === domainMode)?.placeholder || 'Ask me anything...')}
          disabled={disabled && !isStreaming}
          rows={1}
          className="flex-1 bg-transparent text-sm leading-relaxed resize-none outline-none min-h-[24px] max-h-[160px] scrollbar-thin py-1.5"
          style={{ color: '#1d1d1f' }}
        />

        {/* Send / Stop */}
        <motion.button
          type="button"
          onClick={isStreaming ? onStop : handleSubmit}
          disabled={!isStreaming && !canSend}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full self-end mb-0.5"
          style={{
            background: isStreaming ? '#ff3b30' : canSend ? '#0071e3' : 'rgba(0,0,0,0.1)',
            color: '#ffffff',
            cursor: !isStreaming && !canSend ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
          whileTap={canSend || isStreaming ? { scale: 0.86 } : {}}
          animate={{ scale: canSend || isStreaming ? 1 : 0.92, opacity: canSend || isStreaming ? 1 : 0.5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {isStreaming ? <Square size={12} fill="white" /> : <Send size={12} />}
        </motion.button>
      </motion.div>

      {/* Hint row */}
      <div className="flex items-center justify-between mt-1.5 px-2">
        <span className="text-[10px]" style={{ color: 'rgba(29,29,31,0.22)' }}>
          Return to send · Shift+Return new line
        </span>
        {isStreaming && (
          <motion.span
            className="text-[10px] flex items-center gap-1.5"
            style={{ color: '#0071e3' }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#0071e3' }} />
            Generating
          </motion.span>
        )}
      </div>
    </div>
  );
}
