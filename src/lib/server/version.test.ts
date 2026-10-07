import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contentVersion } from './version.ts';

const dir = mkdtempSync(join(tmpdir(), 'version-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('нет файла → null', () => {
	expect(contentVersion(join(dir, 'none.webp'))).toBeNull();
});

test('10 hex sha256; не зависит от mtime, меняется с содержимым', () => {
	const file = join(dir, 'a.bin');
	writeFileSync(file, 'hello');
	const v = contentVersion(file);
	expect(v).toBe('2cf24dba5f'); // sha256("hello")
	utimesSync(file, new Date(2000, 0, 1), new Date(2000, 0, 1));
	expect(contentVersion(file)).toBe(v);
	writeFileSync(file, 'hello!');
	expect(contentVersion(file)).not.toBe(v);
});
