import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/lib', 'src/routes'];
const ROOT_ATTR = /\b(?:href|src)=(?:"\/|\{`\/|\{'\/|\{"\/)/;

function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		return e.isDirectory() ? svelteFiles(p) : p.endsWith('.svelte') ? [p] : [];
	});
}

test('в разметке нет ссылок от корня сайта (на Pages сайт живёт на подпути)', () => {
	const offenders = ROOTS.flatMap(svelteFiles).flatMap((file) =>
		readFileSync(file, 'utf8')
			.split('\n')
			.flatMap((line, i) => (ROOT_ATTR.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
	);
	expect(offenders).toEqual([]);
});
