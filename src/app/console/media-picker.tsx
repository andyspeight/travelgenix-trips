'use client';

// =============================================================================
//  Media picker — upload and reuse images and video
// =============================================================================
//  Replaces every "paste a link" field. Operators upload from their device
//  (drag and drop or choose a file) straight to Vercel Blob, and pick from
//  everything they have uploaded before. Images and video both.
//
//  MediaField is a single slot (hero, a section image). MediaListField is a
//  set (a gallery, a day's photos). Both open the same MediaPicker dialog.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { isVideoUrl } from '@/lib/url';

interface MediaItem { id: string; url: string; kind: 'image' | 'video'; filename: string | null }
type Accept = 'image' | 'both';

// --- shared library state (fetched once per mount tree) ---------------------

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

function Thumb({ item }: { item: MediaItem }) {
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

// --- the dialog -------------------------------------------------------------

function MediaPicker({ accept, onSelect, onClose }: { accept: Accept; onSelect: (url: string) => void; onClose: () => void }) {
  const { items, loaded, error, prepend } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = accept === 'image' ? items.filter((i) => i.kind === 'image') : items;
  const acceptAttr = accept === 'image' ? 'image/*' : 'image/*,video/*';

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (accept === 'image' && !file.type.startsWith('image/')) continue;
        const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/media/upload' });
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: blob.url, filename: file.name, contentType: file.type, size: file.size }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.message || 'Upload could not be saved.');
        }
        const { item } = await res.json();
        prepend(item);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : '';
      // @vercel/blob throws its own "Failed to retrieve the client token" before
      // our friendly 503 body is seen, so translate it here.
      const friendly = /client token|store|blob/i.test(raw)
        ? 'Uploads are not switched on yet. A Vercel Blob store needs connecting to this project, then a redeploy.'
        : (raw || 'Upload failed. Please try again.');
      setUploadError(friendly);
    } finally {
      setBusy(false);
    }
  }, [accept, prepend]);

  return (
    <div className="mp-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="mp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mp-head">
          <strong>Choose {accept === 'image' ? 'an image' : 'media'}</strong>
          <button type="button" className="c-btn c-btn--quiet" onClick={onClose} aria-label="Close">×</button>
        </div>

        <label
          className={`mp-drop${busy ? ' is-busy' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        >
          <input ref={inputRef} type="file" accept={acceptAttr} multiple hidden
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.currentTarget.value = ''; }} />
          {busy
            ? 'Uploading...'
            : accept === 'image'
              ? 'Drag an image here, or click to choose'
              : 'Drag an image or video here, or click to choose'}
        </label>
        {uploadError && <p className="mp-err">{uploadError}</p>}

        <div className="mp-grid">
          {!loaded && <p className="mp-note">Loading your library...</p>}
          {loaded && shown.length === 0 && !error && (
            <p className="mp-note">Nothing here yet. Upload your first file above.</p>
          )}
          {error && <p className="mp-err">{error}</p>}
          {shown.map((it) => (
            <button key={it.id} type="button" className="mp-item" onClick={() => { onSelect(it.url); onClose(); }}>
              <Thumb item={it} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
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
          <Thumb item={{ id: 'v', url: value, kind: isVideoUrl(value) ? 'video' : 'image', filename: null }} />
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
            <Thumb item={{ id: String(i), url, kind: isVideoUrl(url) ? 'video' : 'image', filename: null }} />
            <button type="button" className="mp-remove" aria-label="Remove" onClick={() => onChange(values.filter((_, k) => k !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="mp-add-tile" onClick={() => setOpen(true)}>+ Add</button>
      </div>
      {open && (
        <MediaPicker
          accept={accept}
          onSelect={(url) => { if (!values.includes(url)) onChange([...values, url]); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
