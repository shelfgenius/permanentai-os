import { useAppStore } from '@construct/store/useAppStore';
import { Card, CardContent, CardHeader, CardTitle } from '@construct/components/ui/card';
import { Badge } from '@construct/components/ui/badge';
import { ScrollArea } from '@construct/components/ui/scroll-area';
import { Button } from '@construct/components/ui/button';
import { Brain, CheckCircle, AlertTriangle, MessageSquare, Clock, Flame, Shield, Zap, Home, Wrench, Scale } from 'lucide-react';

const agentIcons: Record<string, typeof Brain> = {
  'structural': Shield,
  'architectural': Home,
  'mep': Wrench,
  'fire': Flame,
  'energy': Zap,
  'smart': Brain,
  'security': Shield,
  'moderator': Scale,
};

export function AgentPanel() {
  const { agentMessages, activeDebates, clearAgentMessages } = useAppStore();
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'position': return <MessageSquare className="w-3 h-3" />;
      case 'objection': return <AlertTriangle className="w-3 h-3" />;
      case 'proposal': return <Brain className="w-3 h-3" />;
      case 'compromise': return <CheckCircle className="w-3 h-3" />;
      case 'override': return <Scale className="w-3 h-3" />;
      default: return <MessageSquare className="w-3 h-3" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'position': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'objection': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'proposal': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'compromise': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'override': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            AI Agent Debate Feed
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time Design Narrative — Multi-agent reasoning log</p>
        </div>
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={clearAgentMessages}>
          Clear
        </Button>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Agent Messages Feed */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live Agent Messages</span>
            <Badge variant="outline" className="text-xs">{agentMessages.length} Messages</Badge>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
              {agentMessages.length === 0 && (
                <div className="text-center py-8 text-slate-600">
                  <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No agent messages yet.</p>
                  <p className="text-xs">Start AI generation to see agent reasoning.</p>
                </div>
              )}
              
              {agentMessages.map((msg) => {
                const Icon = agentIcons[msg.agentId] || Brain;
                return (
                  <Card key={msg.id} className="bg-slate-800/60 border-slate-700/60">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: msg.agentColor + '20', color: msg.agentColor }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-slate-200">{msg.agentName}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${getTypeColor(msg.type)}`}>
                              {getTypeIcon(msg.type)} <span className="ml-1">{msg.type}</span>
                            </Badge>
                            {msg.impact === 'high' && <Badge variant="destructive" className="text-[10px]">High Impact</Badge>}
                          </div>
                          
                          <p className="text-sm text-slate-300 leading-relaxed">{msg.message}</p>
                          
                          {msg.codeReference && (
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                                {msg.codeReference}
                              </Badge>
                            </div>
                          )}
                          
                          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {msg.timestamp.toLocaleTimeString()}
                            </span>
                            <span>Confidence: {(msg.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Active Debates */}
        <div className="w-80 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Debates</span>
            <Badge variant="outline" className="text-xs">{activeDebates.length}</Badge>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {activeDebates.length === 0 && (
                <div className="text-center py-6 text-slate-600">
                  <Scale className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No active debates</p>
                </div>
              )}
              
              {activeDebates.map((debate) => (
                <Card key={debate.id} className="bg-slate-800/60 border-slate-700/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-200">{debate.topic}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <Badge className={
                      debate.status === 'resolved' ? 'bg-emerald-500/20 text-emerald-400' :
                      debate.status === 'escalated' ? 'bg-red-500/20 text-red-400' :
                      'bg-amber-500/20 text-amber-400'
                    }>
                      {debate.status}
                    </Badge>
                    
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>Agents: {debate.involvedAgents.join(', ')}</div>
                      {debate.moderatorDecision && (
                        <div className="text-emerald-400">{debate.moderatorDecision}</div>
                      )}
                      {debate.userOverride?.applied && (
                        <div className="text-amber-400">User override: {debate.userOverride.reason}</div>
                      )}
                    </div>
                    
                    <div className="space-y-1 mt-2">
                      {debate.messages.slice(-3).map((msg) => (
                        <div key={msg.id} className="flex items-center gap-2 text-xs">
                          <span style={{ color: msg.agentColor }}>{msg.agentName}</span>
                          <span className="text-slate-500 truncate">{msg.message.slice(0, 40)}...</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
