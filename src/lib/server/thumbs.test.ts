import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { thumbUrl, worldPath } from './thumbs.ts';

const dir = mkdtempSync(join(tmpdir(), 'thumbs-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('нет скриншота → null', () => {
	expect(thumbUrl('quiet-valley', dir)).toBeNull();
});

test('есть скриншот → URL с версией по содержимому', () => {
	mkdirSync(join(dir, 'thumbs'));
	writeFileSync(join(dir, 'thumbs', 'quiet-valley.webp'), 'x');
	expect(thumbUrl('quiet-valley', dir)).toBe('/thumbs/quiet-valley.webp?v=2d711642b7');
});

test('мир: с версией, если запечён; без — в dev', () => {
	expect(worldPath('river-mill', dir)).toBe('/baked/river-mill.vxb');
	mkdirSync(join(dir, 'baked'));
	writeFileSync(join(dir, 'baked', 'river-mill.vxb'), 'x');
	expect(worldPath('river-mill', dir)).toBe('/baked/river-mill.vxb?v=2d711642b7');
});
