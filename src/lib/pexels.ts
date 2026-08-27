// =============================================================================
//  lib/pexels.ts — stock photo and video search via the Pexels API
// =============================================================================
//
//  Server-only. The API key never reaches the browser. Two jobs: search (a
//  thin proxy the picker calls) and resolve-by-id (used at import time so the
//  server, not the client, decides the canonical file URL and the credit).
//
//    Env: PEXELS_API_KEY
//
// =============================================================================

import 'server-only';

const KEY = process.env.PEXELS_API_KEY || '';
const PHOTO_SEARCH = 'https://api.pexels.com/v1/search';
const VIDEO_SEARCH = 'https://api.pexels.com/videos/search';
const PHOTO_BY_ID = 'https://api.pexels.com/v1/photos';
const VIDEO_BY_ID = 'https://api.pexels.com/videos/videos';

export function pexelsConfigured(): boolean {
  return !!KEY;
}

export type MediaKind = 'image' | 'video';

/** What the picker renders: a thumbnail and enough to import by id. */
export interface PexelsResult {
  id: string;
  kind: MediaKind;
  thumb: string;
  width: number;
  height: number;
  credit: string;
  creditUrl: string;
}

/** What import needs: the file to fetch and how to record it. */
export interface PexelsImport {
  url: string;
  kind: MediaKind;
  contentType: string;
  filename: string;
  credit: string;
  creditUrl: string;
}

async function px<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: KEY }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  return (await res.json()) as T;
}

// --- search -----------------------------------------------------------------

interface PexelsPhoto {
  id: number; width: number; height: number; url: string;
  photographer: string; photographer_url: string;
  src: { tiny: string; small: string; medium: string; large: string; large2x: string; original: string };
}
interface PexelsVideoFile { id: number; quality: string; file_type: string; width: number | null; height: number | null; link: string }
interface PexelsVideo {
  id: number; width: number; height: number; url: string; image: string; duration: number;
  user: { name: string; url: string };
  video_files: PexelsVideoFile[];
}

export async function searchPexels(query: string, kind: MediaKind, page = 1): Promise<{ results: PexelsResult[]; hasMore: boolean }> {
  const q = query.trim();
  if (!q) return { results: [], hasMore: false };
  const perPage = 24;
  const qs = `query=${encodeURIComponent(q)}&per_page=${perPage}&page=${Math.max(1, page)}`;

  if (kind === 'video') {
    const data = await px<{ videos: PexelsVideo[]; total_results: number }>(`${VIDEO_SEARCH}?${qs}`);
    return {
      results: data.videos.map((v) => ({
        id: String(v.id), kind: 'video', thumb: v.image, width: v.width, height: v.height,
        credit: `Video by ${v.user?.name ?? 'a Pexels contributor'}`, creditUrl: v.url,
      })),
      hasMore: page * perPage < (data.total_results ?? 0),
    };
  }

  const data = await px<{ photos: PexelsPhoto[]; total_results: number }>(`${PHOTO_SEARCH}?${qs}`);
  return {
    results: data.photos.map((p) => ({
      id: String(p.id), kind: 'image', thumb: p.src.small, width: p.width, height: p.height,
      credit: `Photo by ${p.photographer}`, creditUrl: p.url,
    })),
    hasMore: page * perPage < (data.total_results ?? 0),
  };
}

// --- resolve one item for import (server picks the file, not the client) ----

/** Choose a sensible video file: an mp4 at 1080p or below, largest that fits,
 *  so a hero clip is good quality without importing a 4K monster. */
function pickVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  const mp4 = files.filter((f) => f.file_type === 'video/mp4' && f.link);
  if (mp4.length === 0) return null;
  const withinHd = mp4.filter((f) => (f.height ?? 0) <= 1080);
  const pool = withinHd.length ? withinHd : mp4;
  // Largest within the cap.
  return pool.slice().sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0] ?? null;
}

export async function resolvePexelsImport(id: string, kind: MediaKind): Promise<PexelsImport | null> {
  if (!/^\d+$/.test(id)) return null;

  if (kind === 'video') {
    const v = await px<PexelsVideo>(`${VIDEO_BY_ID}/${id}`).catch(() => null);
    if (!v) return null;
    const file = pickVideoFile(v.video_files || []);
    if (!file) return null;
    return {
      url: file.link, kind: 'video', contentType: 'video/mp4', filename: `pexels-${id}.mp4`,
      credit: `Video by ${v.user?.name ?? 'a Pexels contributor'}`, creditUrl: v.url,
    };
  }

  const p = await px<PexelsPhoto>(`${PHOTO_BY_ID}/${id}`).catch(() => null);
  if (!p) return null;
  return {
    // 'large' is a good web size (~1880px wide), not the huge original.
    url: p.src.large, kind: 'image', contentType: 'image/jpeg', filename: `pexels-${id}.jpg`,
    credit: `Photo by ${p.photographer}`, creditUrl: p.url,
  };
}

/** The file host must be a Pexels host. Defence in depth: the import route
 *  streams this URL server-side, so it must never be attacker-controlled. */
export function isPexelsFileUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'pexels.com' || h.endsWith('.pexels.com');
  } catch {
    return false;
  }
}
