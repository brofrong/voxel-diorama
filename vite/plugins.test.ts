import { expect, test } from 'bun:test';
import { parseBakedPath, slugFromChangedFile } from './diorama-dev.ts';
import { isWebp, parseThumbPath } from './thumbnail.ts';

test('parseBakedPath', () => {
	expect(parseBakedPath('/quiet-valley.vxb')).toBe('quiet-valley');
	expect(parseBakedPath('/quiet-valley.vxb?t=123')).toBe('quiet-valley');
	expect(parseBakedPath('/../etc.vxb')).toBeNull();
	expect(parseBakedPath('/Bad.vxb')).toBeNull();
	expect(parseBakedPath('/x.png')).toBeNull();
});

test('slugFromChangedFile', () => {
	expect(slugFromChangedFile('/p', '/p/src/dioramas/quiet-valley/index.ts')).toBe('quiet-valley');
	expect(slugFromChangedFile('/p', '/p/src/dioramas/quiet-valley/models.ts')).toBe('quiet-valley');
	expect(slugFromChangedFile('/p', '/p/src/sdk/prefabs/tree.ts')).toBe('*');
	expect(slugFromChangedFile('/p', '/p/src/routes/+page.svelte')).toBeNull();
});

test('parseThumbPath', () => {
	expect(parseThumbPath('/quiet-valley')).toBe('quiet-valley');
	expect(parseThumbPath('/quiet-valley/')).toBe('quiet-valley');
	expect(parseThumbPath('/../../etc/passwd')).toBeNull();
	expect(parseThumbPath('/a/b')).toBeNull();
});

test('isWebp', () => {
	const webp = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56]);
	expect(isWebp(webp)).toBe(true);
	expect(isWebp(new TextEncoder().encode('<html>not an image</html>'))).toBe(false);
});
