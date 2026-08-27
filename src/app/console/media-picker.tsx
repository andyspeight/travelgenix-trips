'use client';

// =============================================================================
//  Media picker — upload, reuse, and search stock (Pexels)
// =============================================================================
//  Three ways to fill an image or video slot: pick from the operator's library,
//  upload from the device, or search Pexels. A stock pick is imported into the
//  operator's own library (server-side) so we own the file and it is reusable.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { upload } from '@vercel/blob/client';
import { isVideoUrl } from '@/lib/url';

interface MediaItem { id: string; url: string; kind: 'image' | 'video'; filename: string | null }
interface StockResult { id: string; kind: 'image' | 'video'; thumb: string; credit: string }
type Accept = 'image' | 'both';
type Tab = 'library' | 'upload' | 'stock';

function useLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/media')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((d) => { if (live) { setItems(d.media ?? []); setLoaded(true); } })
      .catch(() => { if (live) { setError('Could not load your library.'); setLoaded(true); } });
    return () => { live = false; };
  }, []);

  const prepend = useCallback((it: MediaItem) => {
    setItems((prev) => (prev.some((p) => p.url === it.url) ? prev : [it, ...prev]));
  }, []);

  return { items, loaded, error, prepend };
}

function Thumb({ item }: { item: { url: string; kind: 'image' | 'video'; filename?: string | null } }) {
  return item.kind === 'video' || isVideoUrl(item.url) ? (
    <div className="mp-thumb mp-thumb--video">
      <video src={item.url} muted preload="metadata" />
      <span className="mp-badge">Video</span>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="mp-thumb" src={item.url} alt={item.filename ?? ''} loading="lazy" />
  );
}

function MediaPicker({ accept, onSelect, onClose }: { accept: Accept; onSelect: (url: string) => void; onClose: () => void }) {
  const { items, loaded, error, prepend } = useLibrary();
  const [tab, setTab] = useState<Tab>('library');

  // upload
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // stock
  const [query, setQuery] = useState('');
  const [stockKind, setStockKind] = useState<'image' | 'video'>('image');
  const [results, setResults] = useState<StockResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const shown = accept === 'image' ? items.filter((i) => i.kind === 'image') : items;
  const acceptAttr = accept === 'image' ? 'image/*' : 'image/*,video/*';
  const effectiveStockKind: 'image' | 'video' = accept === 'image' ? 'image' : stockKind;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError(null); setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (accept === 'image' && !file.type.startsWith('image/')) continue;
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/media/upload' });
        const res = await fetch('/api/media', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: blob.url, filename: file.name, contentType: file.type, size: file.size }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Upload could not be saved.'); }
        const { item } = await res.json();
        prepend(item);
      }
      setTab('library');
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      setUploadError(/client token|store|blob/i.test(raw)
        ? 'Uploads are not switched on yet. A Vercel Blob store needs connecting to this project, then a redeploy.'
        : (raw || 'Upload failed. Please try again.'));
    } finally { setBusy(false); }
  }, [accept, prepend]);

  const runSearch = useCallback(async (q: string, kind: 'image' | 'video') => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true); setStockError(null);
    try {
      const res = await fetch(`/api/media/pexels?q=${encodeURIComponent(q)}&kind=${kind}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Stock search is unavailable.');
      }
      const d = await res.json();
      setResults(d.results ?? []);
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Stock search failed.');
      setResults([]);
    } finally { setSearching(false); }
  }, []);

  const importStock = useCallback(async (r: StockResult) => {
    setImporting(r.id); setStockError(null);
    try {
      const res = await fetch('/api/media/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, kind: r.kind }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Could not add that item.'); }
      const { item } = await res.json();
      prepend(item);
      onSelect(item.url);
      onClose();
    } catch (e) {
      setStockError(e instanceof Error ? e.message : 'Could not add that item.');
    } finally { setImporting(null); }
  }, [prepend, onSelect, onClose]);

  const dialog = (
    <div className="mp-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mp-head">
          <div className="mp-tabs">
            <button type="button" className={tab === 'library' ? 'is-on' : ''} onClick={() => setTab('library')}>Your library</button>
            <button type="button" className={tab === 'upload' ? 'is-on' : ''} onClick={() => setTab('upload')}>Upload</button>
            <button type="button" className={tab === 'stock' ? 'is-on' : ''} onClick={() => setTab('stock')}>Search stock</button>
          </div>
          <button type="button" className="c-btn c-btn--quiet" onClick={onClose} aria-label="Close">×</button>
        </div>

        {tab === 'upload' && (
          <>
            <label
              className={`mp-drop${busy ? ' is-busy' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
            >
              <input type="file" accept={acceptAttr} multiple hidden
                onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.currentTarget.value = ''; }} />
              {busy ? 'Uploading...' : accept === 'image' ? 'Drag an image here, or click to choose' : 'Drag an image or video here, or click to choose'}
            </label>
            {uploadError && <p className="mp-err">{uploadError}</p>}
          </>
        )}

        {tab === 'stock' && (
          <div className="mp-stock">
            <div className="mp-search">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(query, effectiveStockKind); } }}
                placeholder="Search Pexels, e.g. safari, beach, city"
              />
              {accept === 'both' && (
                <div className="mp-kind">
                  <button type="button" className={effectiveStockKind === 'image' ? 'is-on' : ''} onClick={() => { setStockKind('image'); if (query.trim()) runSearch(query, 'image'); }}>Photos</button>
                  <button type="button" className={effectiveStockKind === 'video' ? 'is-on' : ''} onClick={() => { setStockKind('video'); if (query.trim()) runSearch(query, 'video'); }}>Video</button>
                </div>
              )}
              <button type="button" className="c-btn c-btn--primary" onClick={() => runSearch(query, effectiveStockKind)}>Search</button>
            </div>
            {stockError && <p className="mp-err">{stockError}</p>}
            <div className="mp-grid">
              {searching && <p className="mp-note">Searching...</p>}
              {!searching && results.length === 0 && !stockError && <p className="mp-note">Search for a subject to see stock {effectiveStockKind === 'video' ? 'video' : 'photos'}.</p>}
              {results.map((r) => (
                <button key={r.id} type="button" className="mp-item" onClick={() => importStock(r)} disabled={!!importing} title={r.credit}>
                  <Thumb item={{ url: r.thumb, kind: r.kind }} />
                  {importing === r.id && <span className="mp-importing">Adding...</span>}
                </button>
              ))}
            </div>
            <p className="mp-credit-note">Stock media from Pexels. It is added to your library and hosted with your other media.</p>
          </div>
        )}

        {tab === 'library' && (
          <div className="mp-grid">
            {!loaded && <p className="mp-note">Loading your library...</p>}
            {loaded && shown.length === 0 && !error && <p className="mp-note">Nothing here yet. Upload a file or search stock.</p>}
            {error && <p className="mp-err">{error}</p>}
            {shown.map((it) => (
              <button key={it.id} type="button" className="mp-item" onClick={() => { onSelect(it.url); onClose(); }}>
                <Thumb item={it} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog;
}

// --- fields -----------------------------------------------------------------

export function MediaField({ value, onChange, accept = 'image', label }: {
  value: string; onChange: (url: string) => void; accept?: Accept; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mp-field">
      {label && <span className="mp-label">{label}</span>}
      {value ? (
        <div className="mp-current">
          <Thumb item={{ url: value, kind: isVideoUrl(value) ? 'video' : 'image' }} />
          <div className="mp-current-actions">
            <button type="button" className="c-btn" onClick={() => setOpen(true)}>Change</button>
            <button type="button" className="c-btn c-btn--quiet" onClick={() => onChange('')}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="mp-empty" onClick={() => setOpen(true)}>
          {accept === 'image' ? 'Add an image' : 'Add image or video'}
        </button>
      )}
      {open && <MediaPicker accept={accept} onSelect={onChange} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function MediaListField({ values, onChange, accept = 'image', label }: {
  values: string[]; onChange: (urls: string[]) => void; accept?: Accept; label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mp-field">
      {label && <span className="mp-label">{label}</span>}
      <div className="mp-list">
        {values.map((url, i) => (
          <div key={i} className="mp-list-item">
            <Thumb item={{ url, kind: isVideoUrl(url) ? 'video' : 'image' }} />
            <button type="button" className="mp-remove" aria-label="Remove" onClick={() => onChange(values.filter((_, k) => k !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="mp-add-tile" onClick={() => setOpen(true)}>+ Add</button>
      </div>
      {open && (
        <MediaPicker accept={accept} onSelect={(url) => { if (!values.includes(url)) onChange([...values, url]); }} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
