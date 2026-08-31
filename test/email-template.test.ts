// The branded email must carry the operator's identity, never break out of the
// HTML (everything user-supplied escaped), validate the colour it drops into a
// style attribute, and honour the white-label toggle.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  esc, safeHex, renderBrandedEmail, emailP, emailFacts, emailButton,
} from '../src/lib/email-template.ts';

test('esc neutralises HTML metacharacters', () => {
  assert.equal(esc('<b>Tom & "Jerry"</b>'), '&lt;b&gt;Tom &amp; &quot;Jerry&quot;&lt;/b&gt;');
});

test('safeHex only passes a real 6-digit hex, else the fallback', () => {
  assert.equal(safeHex('#1B2B5B'), '#1B2B5B');
  assert.equal(safeHex('red'), '#0e6e5c');
  assert.equal(safeHex('#12'), '#0e6e5c');
  assert.equal(safeHex(null, '#123456'), '#123456');
  assert.equal(safeHex('#fff; }body{}'), '#0e6e5c'); // no injection through the colour
});

const brand = { operatorName: 'Acme Tours', logoUrl: 'https://cdn.example.com/logo.png', accent: '#1B2B5B' };

test('a logo brand shows the logo; a no-logo brand shows the name', () => {
  const withLogo = renderBrandedEmail(brand, { previewText: 'hi', contentHtml: emailP('Body') });
  assert.ok(withLogo.includes('src="https://cdn.example.com/logo.png"'));
  const noLogo = renderBrandedEmail({ operatorName: 'Acme Tours', accent: '#1B2B5B' }, { previewText: 'hi', contentHtml: emailP('Body') });
  assert.ok(!noLogo.includes('<img'));
  assert.ok(noLogo.includes('Acme Tours'));
});

test('an http (non-https) or junk logo is dropped, not rendered', () => {
  const html = renderBrandedEmail({ operatorName: 'Acme', logoUrl: 'http://evil/x.png' }, { previewText: 'h', contentHtml: '' });
  assert.ok(!html.includes('<img'));
});

test('the powered-by credit obeys the white-label toggle', () => {
  const shown = renderBrandedEmail(brand, { previewText: 'h', contentHtml: '' });
  assert.ok(shown.includes('Powered by Travelgenix Trips'));
  const hidden = renderBrandedEmail({ ...brand, hidePoweredBy: true }, { previewText: 'h', contentHtml: '' });
  assert.ok(!hidden.includes('Powered by Travelgenix Trips'));
});

test('helpers escape their inputs', () => {
  assert.ok(emailP('a <script> b').includes('&lt;script&gt;'));
  assert.ok(emailButton('Go', 'https://x/"onmouseover="alert(1)', '#1B2B5B').includes('&quot;'));
  const facts = emailFacts([['Ref', 'A&B'], ['Empty', ''], ['Skip', '']]);
  assert.ok(facts.includes('A&amp;B'));
  assert.ok(!facts.includes('Empty')); // rows with no value are dropped
});
