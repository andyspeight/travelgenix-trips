// An operator's typeface name reaches a stylesheet URL and a CSS declaration,
// so the allowlist is a security control, not a convenience.

import test from 'node:test';
import assert from 'node:assert/strict';
import { operatorFont } from '../src/lib/fonts.ts';

test('a requested face resolves to a stack and a stylesheet', () => {
  const f = operatorFont('DM Sans');
  assert.equal(f.name, 'DM Sans');
  assert.ok(f.stack.startsWith('"DM Sans"'));
  assert.ok(f.href?.startsWith('https://fonts.googleapis.com/css2?family=DM+Sans:'));
});

test('every stack ends in a real fallback, never a bare family', () => {
  for (const name of ['DM Sans', 'Lora', 'Inter']) {
    assert.ok(operatorFont(name).stack.includes('serif'), `${name} needs a fallback`);
  }
});

test('a serif choice falls back to a serif, not to sans', () => {
  assert.ok(operatorFont('Playfair Display').stack.includes('Georgia'));
  assert.ok(!operatorFont('DM Sans').stack.includes('Georgia'));
});

test('matching is forgiving about case and spacing', () => {
  assert.equal(operatorFont('dm sans').name, 'DM Sans');
  assert.equal(operatorFont('  DM   Sans  ').name, 'DM Sans');
});

test('an unknown face falls back and loads nothing', () => {
  const f = operatorFont('Comic Sans MS');
  assert.equal(f.name, 'system');
  assert.equal(f.href, null);
  assert.ok(f.stack.includes('system-ui'));
});

test('absent input is fine', () => {
  for (const v of [null, undefined, '', '   ']) {
    const f = operatorFont(v as string);
    assert.equal(f.name, 'system');
    assert.equal(f.href, null);
  }
});

test('a hostile name cannot escape into CSS or the URL', () => {
  const hostile = [
    'Foo"); @import url(https://evil.example/x.css); x:("',
    'Inter&text=<script>',
    '../../../etc/passwd',
    'Inter", url("https://evil.example/f.woff2',
    'javascript:alert(1)',
  ];
  for (const name of hostile) {
    const f = operatorFont(name);
    assert.equal(f.href, null, `${name} must load nothing`);
    assert.equal(f.name, 'system');
    assert.ok(!f.stack.includes('evil'), 'no attacker text reaches the stack');
    assert.ok(!f.stack.includes('@import'));
  }
});

test('a near-miss on an allowed name still falls back rather than guessing', () => {
  assert.equal(operatorFont('DM Sanz').name, 'system');
});
