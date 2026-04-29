import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Upload, RefreshCw, Trash2, FileText,
  Box, Package, CheckCircle, AlertCircle, Clock,
  Search, Filter, ChevronDown, X, Plus
} from 'lucide-react';
import useStore from '../store/useStore.js';

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: '#0071e3' }} />
        <div>
          <div className="text-lg font-semibold" style={{ color: '#1d1d1f' }}>{value}</div>
          <div className="text-xs" style={{ color: 'rgba(29,29,31,0.45)' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUpload }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const submit = () => {
    if (files.length === 0) return;
    onUpload(files, category);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="rounded-xl p-6 w-full max-w-md"
        style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: '#1d1d1f' }}>Upload Documents</h3>
          <button onClick={onClose} style={{ color: 'rgba(29,29,31,0.4)' }} className="hover:opacity-80">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(29,29,31,0.55)' }}>Category (optional)</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#f2f2f7', border: '1px solid rgba(0,0,0,0.1)', color: '#1d1d1f' }}
          >
            <option value="">Select category</option>
            <option value="construction">Construction</option>
            <option value="maritime">Maritime</option>
            <option value="interior">Interior Design</option>
            <option value="driving">Driving</option>
            <option value="education">Education</option>
            <option value="3d-printing">3D Printing</option>
            <option value="3d-modeling">3D Modeling</option>
          </select>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-[#0071e3] bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-input-kb').click()}
        >
          <Upload size={20} className="mx-auto mb-2" style={{ color: 'rgba(29,29,31,0.35)' }} />
          <p className="text-sm" style={{ color: 'rgba(29,29,31,0.5)' }}>Drop files here or click to browse</p>
          <p className="text-[11px] mt-1" style={{ color: 'rgba(29,29,31,0.32)' }}>PDF, DOCX, TXT, MD, CSV supported</p>
          <input
            id="file-input-kb"
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files))}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2" style={{ color: 'rgba(29,29,31,0.55)' }}>Selected files:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {files.map((file, i) => (
                <div key={i} className="text-xs px-2 py-1 rounded" style={{ color: 'rgba(29,29,31,0.5)', background: '#f2f2f7' }}>
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#1d1d1f' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={files.length === 0}
            className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#0071e3' }}
          >
            Upload & Index
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function KnowledgeBase() {
  const { backendUrl, setKnowledgeStats, knowledgeStats } = useStore();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/knowledge/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.documents ?? []);
        setKnowledgeStats(data.stats ?? null);
      } else {
        console.warn('Knowledge API returned', res.status);
        setDocs([]);
      }
    } catch (err) {
      console.warn('Knowledge API unavailable:', err.message);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, setKnowledgeStats]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (files, category) => {
    setShowUpload(false);
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (category) formData.append('category', category);

    try {
      const res = await fetch(`${backendUrl}/knowledge/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        setTimeout(fetchDocs, 1500);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleDelete = async (docId) => {
    try {
      const res = await fetch(`${backendUrl}/knowledge/documents/${docId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDocs();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const filtered = docs.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase()) ||
                         doc.content.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || doc.category === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f5f7' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#ffffff' }}>
        <div className="flex items-center gap-2.5">
          <Database size={16} style={{ color: '#0071e3' }} />
          <h1 className="text-sm font-semibold" style={{ color: '#1d1d1f' }}>Knowledge Base</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#1d1d1f' }}
            onClick={() => { setSyncing(true); setTimeout(() => { fetchDocs(); setSyncing(false); }, 1000); }}
            disabled={syncing}
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            Sync
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors"
            style={{ background: '#0071e3' }}
            onClick={() => setShowUpload(true)}
          >
            <Plus size={12} /> Add Documents
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4">
        <StatCard icon={FileText}  label="Total Documents"  value={knowledgeStats?.total_docs || 0} />
        <StatCard icon={Database}  label="Indexed Chunks"   value={knowledgeStats?.total_chunks || 0} />
        <StatCard icon={Box}       label="3D Assets"        value={knowledgeStats?.total_assets || 0} />
        <StatCard icon={Package}   label="Parts Inventory"  value={knowledgeStats?.total_parts || 0} />
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#ffffff' }}>
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(29,29,31,0.35)' }} />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: '#f2f2f7', border: '1px solid rgba(0,0,0,0.1)', color: '#1d1d1f' }}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: '#f2f2f7', border: '1px solid rgba(0,0,0,0.1)', color: '#1d1d1f' }}
        >
          <option value="all">All Categories</option>
          <option value="construction">Construction</option>
          <option value="maritime">Maritime</option>
          <option value="interior">Interior Design</option>
          <option value="driving">Driving</option>
          <option value="education">Education</option>
          <option value="3d-printing">3D Printing</option>
          <option value="3d-modeling">3D Modeling</option>
        </select>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={24} className="animate-spin" style={{ color: 'rgba(29,29,31,0.35)' }} />
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-lg p-4 transition-colors cursor-pointer"
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium mb-1" style={{ color: '#1d1d1f' }}>{doc.title}</h3>
                    <p className="text-xs line-clamp-2 mb-2" style={{ color: 'rgba(29,29,31,0.48)' }}>{doc.content}</p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'rgba(29,29,31,0.32)' }}>
                      <span className="flex items-center gap-1">
                        <FileText size={10} />
                        {doc.category || 'Uncategorized'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Box size={10} />
                        {doc.chunk_count} chunks
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="ml-3 transition-colors hover:opacity-70"
                    style={{ color: 'rgba(29,29,31,0.35)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Database size={28} className="mb-3" style={{ color: 'rgba(29,29,31,0.18)' }} />
            <p className="text-sm" style={{ color: 'rgba(29,29,31,0.4)' }}>{search ? 'No matching documents' : 'No documents yet'}</p>
            {!search && (
              <button
                className="mt-3 text-xs transition-colors"
                style={{ color: '#0071e3' }}
                onClick={() => setShowUpload(true)}
              >
                Upload your first document
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showUpload && (
          <UploadModal onClose={() => setShowUpload(false)} onUpload={handleUpload} />
        )}
      </AnimatePresence>
    </div>
  );
}
