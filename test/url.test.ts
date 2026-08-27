// Operator media URLs are rendered into the public page, so the host allowlist
// and the image/video split are both worth pinning down.

import test from 'node:test';
import assert from 'node:assert/strict';
import { safeImageUrl, safeMediaUrl, isVideoUrl } from '../src/lib/url.ts';

const BLOB = 'https://abc123.public.blob.vercel-storage.com';

test('only https on an allowlisted host survives', () => {
  assert.equal(safeImageUrl(`${BLOB}/pic.jpg`), `${BLOB}/pic.jpg`);
  assert.equal(safeImageUrl('https://images.unsplash.com/x.jpg'), 'https://images.unsplash.com/x.jpg');
  assert.equal(safeImageUrl('https://evil.example/x.jpg'), null, 'off-allowlist host');
  assert.equal(safeImageUrl('http://images.unsplash.com/x.jpg'), null, 'plain http');
  assert.equal(safeImageUrl('javascript:alert(1)'), null);
  assert.equal(safeImageUrl(''), null);
});

test('safeMediaUrl shares the host rule', () => {
  assert.equal(safeMediaUrl(`${BLOB}/clip.mp4`), `${BLOB}/clip.mp4`);
  assert.equal(safeMediaUrl('https://evil.example/clip.mp4'), null);
});

test('isVideoUrl detects video by extension', () => {
  for (const ext of ['mp4', 'webm', 'mov', 'm4v']) {
    assert.equal(isVideoUrl(`${BLOB}/clip.${ext}`), true, ext);
    assert.equal(isVideoUrl(`${BLOB}/clip.${ext.toUpperCase()}`), true, `${ext} upper`);
  }
  assert.equal(isVideoUrl(`${BLOB}/photo.jpg`), false);
  assert.equal(isVideoUrl(`${BLOB}/clip.mp4?v=2`), true, 'query string tolerated');
  assert.equal(isVideoUrl(''), false);
  assert.equal(isVideoUrl(null), false);
});
