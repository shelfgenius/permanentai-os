import { useState, useRef, useEffect } from 'react';
import { useAppStore, AGENT_MODELS } from '@construct/store/useAppStore';
import { Card, CardContent } from '@construct/components/ui/card';
import { Badge } from '@construct/components/ui/badge';
import { Button } from '@construct/components/ui/button';
import { ScrollArea } from '@construct/components/ui/scroll-area';
import { Input } from '@construct/components/ui/input';
import { MessageSquare, Send, Bot, User, Sparkles } from 'lucide-react';

export function ChatPanel() {
  const { chatMessages, sendChatRefinement, isGenerating, project } = useAppStore();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const msg = input.trim();
    setInput('');
    setIsSending(true);
    try {
      await sendChatRefinement(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          Design Refinement Chat
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Chat with AI agents to refine your design after generation</p>
      </div>

      {/* Agent models info */}
      <div className="p-3 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Connected Agents</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(AGENT_MODELS).map(([id, agent]) => (
            <Badge key={id} variant="outline" className="text-[9px] border-slate-700 gap-1"
              style={{ color: agent.color, borderColor: agent.color + '40' }}>
              <span>{agent.icon}</span>
              <span>{agent.model}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden" ref={scrollRef}>
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {!project && (
              <div className="text-center py-12 text-slate-600">
                <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No project loaded</p>
                <p className="text-xs">Generate a building first, then refine it here.</p>
              </div>
            )}

            {project && chatMessages.length === 0 && (
              <div className="text-center py-12 text-slate-600">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs mt-1">Ask the agents to modify layouts, change materials, adjust spacing, etc.</p>
                <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <div className="bg-slate-800/60 rounded px-3 py-1.5 cursor-pointer hover:bg-slate-700/60"
                    onClick={() => setInput('Make the living rooms 20% larger')}>
                    "Make the living rooms 20% larger"
                  </div>
                  <div className="bg-slate-800/60 rounded px-3 py-1.5 cursor-pointer hover:bg-slate-700/60"
                    onClick={() => setInput('Change all columns to steel HEA sections')}>
                    "Change all columns to steel HEA sections"
                  </div>
                  <div className="bg-slate-800/60 rounded px-3 py-1.5 cursor-pointer hover:bg-slate-700/60"
                    onClick={() => setInput('Add balconies to all bedrooms')}>
                    "Add balconies to all bedrooms"
                  </div>
                </div>
              </div>
            )}

            {chatMessages.map((msg) => (
              <Card key={msg.id} className={`${msg.role === 'user' ? 'bg-blue-900/30 border-blue-700/40 ml-8' : 'bg-slate-800/60 border-slate-700/60 mr-8'}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600/30' : 'bg-slate-700'}`}>
                      {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-blue-300" /> : <Bot className="w-3.5 h-3.5 text-slate-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-300">
                          {msg.role === 'user' ? 'You' : msg.agentName}
                        </span>
                        {msg.model && (
                          <Badge variant="outline" className="text-[9px] border-slate-600 text-slate-500">
                            {msg.model}
                          </Badge>
                        )}
                        <span className="text-[10px] text-slate-600">{msg.timestamp.toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                Agents analyzing...
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <Input
            className="flex-1 bg-slate-800 border-slate-700 text-sm text-white placeholder:text-slate-500"
            placeholder={project ? "Describe what you'd like to change..." : "Generate a building first"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!project || isSending || isGenerating}
          />
          <Button size="icon" className="bg-blue-600 hover:bg-blue-500 w-9 h-9" onClick={handleSend}
            disabled={!input.trim() || isSending || !project}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
