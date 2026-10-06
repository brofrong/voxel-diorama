import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { thumbUrl } from './thumbs.ts';

const dir = mkdtempSync(join(tmpdir(), 'thumbs-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('нет скриншота → null', () => {
	expect(thumbUrl('quiet-valley', dir)).toBeNull();
});

test('есть скриншот → URL с версией для сброса кэша', () => {
	mkdirSync(join(dir, 'thumbs'));
	writeFileSync(join(dir, 'thumbs', 'quiet-valley.webp'), 'x');
	expect(thumbUrl('quiet-valley', dir)).toMatch(/^\/thumbs\/quiet-valley\.webp\?v=\d+$/);
});
