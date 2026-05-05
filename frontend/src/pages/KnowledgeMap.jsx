import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Plus, Search, Database, BookOpen, Code, FlaskConical, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore';

// Node type colors matching the blueprint
const TYPE_COLORS = {
  code:     { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF', icon: Code },      // Blue
  note:     { bg: '#D1FAE5', border: '#10B981', text: '#065F46', icon: BookOpen },   // Green
  research: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E', icon: FlaskConical }, // Gold
  chat:     { bg: '#F3E8FF', border: '#8B5CF6', text: '#5B21B6', icon: Database },   // Purple
};

function KnowledgeNode({ data }) {
  const style = TYPE_COLORS[data.source_type] || TYPE_COLORS.note;
  const Icon = style.icon;

  return (
    <div
      className="rounded-2xl border-2 shadow-lg px-4 py-3 min-w-[180px] max-w-[260px] backdrop-blur-sm"
      style={{ borderColor: style.border, background: style.bg + 'E6' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} style={{ color: style.text }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: style.text }}>
          {data.source_type}
        </span>
      </div>
      <p className="text-xs font-medium leading-snug" style={{ color: style.text }}>
        {data.title || data.content?.slice(0, 80) + '...'}
      </p>
      {data.source_url && (
        <p className="text-[9px] mt-1 opacity-60 truncate" style={{ color: style.text }}>
          {data.source_url}
        </p>
      )}
    </div>
  );
}

const nodeTypes = { knowledge: KnowledgeNode };

function positionNodes(entries) {
  // Arrange nodes in a force-like layout by type
  const groups = {};
  entries.forEach((e, i) => {
    const type = e.source_type || 'note';
    if (!groups[type]) groups[type] = [];
    groups[type].push({ ...e, _idx: i });
  });

  const nodes = [];
  const typeKeys = Object.keys(groups);
  const angleStep = (2 * Math.PI) / Math.max(typeKeys.length, 1);

  typeKeys.forEach((type, gi) => {
    const items = groups[type];
    const cx = 400 + Math.cos(angleStep * gi) * 350;
    const cy = 300 + Math.sin(angleStep * gi) * 250;

    items.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / items.length;
      const r = 80 + items.length * 20;
      nodes.push({
        id: item.id,
        type: 'knowledge',
        position: {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
        },
        data: item,
      });
    });
  });

  return nodes;
}

export default function KnowledgeMap({ onBack }) {
  const { backendUrl } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [showIngest, setShowIngest] = useState(false);
  const [ingestForm, setIngestForm] = useState({ content: '', title: '', source_type: 'note', source_url: '' });
  const [ingesting, setIngesting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Load knowledge entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/brain/knowledge?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (e) {
      console.error('Failed to load knowledge:', e);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Build graph whenever entries change
  useEffect(() => {
    const graphNodes = positionNodes(entries);
    setNodes(graphNodes);

    // Create edges between nodes of same type (cluster links)
    const newEdges = [];
    const groups = {};
    entries.forEach(e => {
      const t = e.source_type || 'note';
      if (!groups[t]) groups[t] = [];
      groups[t].push(e.id);
    });
    Object.values(groups).forEach(ids => {
      for (let i = 0; i < ids.length - 1; i++) {
        newEdges.push({
          id: `e-${ids[i]}-${ids[i + 1]}`,
          source: ids[i],
          target: ids[i + 1],
          animated: true,
          style: { stroke: '#CBD5E1', strokeWidth: 1 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#CBD5E1' },
        });
      }
    });
    setEdges(newEdges);
  }, [entries, setNodes, setEdges]);

  // Ingest handler
  const handleIngest = async () => {
    if (!ingestForm.content.trim()) return;
    setIngesting(true);
    try {
      const res = await fetch(`${backendUrl}/brain/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingestForm),
      });
      if (res.ok) {
        setIngestForm({ content: '', title: '', source_type: 'note', source_url: '' });
        setShowIngest(false);
        fetchEntries();
      }
    } catch (e) {
      console.error('Ingest failed:', e);
    } finally {
      setIngesting(false);
    }
  };

  // Search handler
  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    try {
      const res = await fetch(`${backendUrl}/brain/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, top_k: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.context || 'No results found.');
      }
    } catch (e) {
      setSearchResults('Search failed.');
    }
  };

  // Delete handler
  const handleDelete = async (id) => {
    try {
      await fetch(`${backendUrl}/brain/knowledge/${id}`, { method: 'DELETE' });
      fetchEntries();
    } catch {}
  };

  return (
    <div className="flex flex-col bg-white" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-xl shrink-0 z-10">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-[rgba(184,115,51,0.2)] text-[#B87333] hover:border-[rgba(184,115,51,0.5)] transition-all"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Knowledge Map</h2>
          <p className="text-xs text-[#A0A0A0]">{entries.length} entries in the Global Brain</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[rgba(0,0,0,0.03)] rounded-lg border border-transparent focus-within:border-[rgba(184,115,51,0.3)]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search knowledge..."
              className="bg-transparent px-3 py-1.5 text-xs outline-none w-40"
            />
            <button onClick={handleSearch} className="px-2 text-[#A0A0A0] hover:text-[#B87333]">
              <Search size={14} />
            </button>
          </div>
          <button
            onClick={() => setShowIngest(!showIngest)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#B87333] text-white hover:bg-[#A0652D] transition-all"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Search Results */}
      <AnimatePresence>
        {searchResults && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-blue-50/80 border-b border-blue-100 overflow-hidden"
          >
            <div className="px-5 py-3 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-600">RAG Search Results</span>
                <button onClick={() => setSearchResults(null)} className="text-xs text-blue-400 hover:text-blue-600">
                  Close
                </button>
              </div>
              <pre className="text-xs text-[#333] whitespace-pre-wrap font-mono">{searchResults}</pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ingest Panel */}
      <AnimatePresence>
        {showIngest && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#FEFAF6] border-b border-[rgba(184,115,51,0.1)] overflow-hidden"
          >
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-3">
                <input
                  value={ingestForm.title}
                  onChange={e => setIngestForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Title (optional)"
                  className="flex-1 bg-white rounded-lg px-3 py-2 text-xs border border-[rgba(0,0,0,0.08)] outline-none focus:border-[rgba(184,115,51,0.3)]"
                />
                <select
                  value={ingestForm.source_type}
                  onChange={e => setIngestForm(f => ({ ...f, source_type: e.target.value }))}
                  className="bg-white rounded-lg px-3 py-2 text-xs border border-[rgba(0,0,0,0.08)] outline-none"
                >
                  <option value="note">Note</option>
                  <option value="code">Code</option>
                  <option value="research">Research</option>
                </select>
              </div>
              <textarea
                value={ingestForm.content}
                onChange={e => setIngestForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Content to ingest into the Global Brain..."
                rows={3}
                className="w-full bg-white rounded-lg px-3 py-2 text-xs border border-[rgba(0,0,0,0.08)] outline-none focus:border-[rgba(184,115,51,0.3)] resize-none"
              />
              <div className="flex items-center gap-3">
                <input
                  value={ingestForm.source_url}
                  onChange={e => setIngestForm(f => ({ ...f, source_url: e.target.value }))}
                  placeholder="Source URL (optional)"
                  className="flex-1 bg-white rounded-lg px-3 py-2 text-xs border border-[rgba(0,0,0,0.08)] outline-none"
                />
                <button
                  onClick={handleIngest}
                  disabled={ingesting || !ingestForm.content.trim()}
                  className="px-4 py-2 rounded-lg bg-[#B87333] text-white text-xs font-medium disabled:opacity-40 hover:bg-[#A0652D] transition-all flex items-center gap-1.5"
                >
                  {ingesting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Ingest
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* React Flow Graph */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-[#B87333]" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Database size={40} className="text-[#B87333]/30 mb-4" />
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-1">Empty Knowledge Graph</h3>
            <p className="text-sm text-[#6B6B6B] max-w-xs mb-4">
              Ingest code, notes, and research to build your AI's persistent memory.
            </p>
            <button
              onClick={() => setShowIngest(true)}
              className="px-4 py-2 rounded-xl bg-[#B87333] text-white text-sm hover:bg-[#A0652D] transition-all"
            >
              Add First Entry
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.3}
            maxZoom={2}
            defaultEdgeOptions={{ animated: true }}
          >
            <Background color="#E5E7EB" gap={24} size={1} />
            <Controls className="!rounded-xl !border-[rgba(0,0,0,0.08)] !shadow-lg" />
            <MiniMap
              nodeColor={(node) => {
                const type = node.data?.source_type || 'note';
                return TYPE_COLORS[type]?.border || '#ccc';
              }}
              className="!rounded-xl !border-[rgba(0,0,0,0.08)]"
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl border border-[rgba(0,0,0,0.06)] px-4 py-3 shadow-lg z-10">
          <p className="text-[10px] font-semibold text-[#888] uppercase tracking-wider mb-2">Node Types</p>
          <div className="flex gap-4">
            {Object.entries(TYPE_COLORS).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: style.border }} />
                <span className="text-[10px] text-[#666] capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
