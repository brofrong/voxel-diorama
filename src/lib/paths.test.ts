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

// Строки '/thumbs/…', '/baked/…' вне серверных хелперов допустимы только через withBase() или в dev-ветке.
const STATIC_PATH = /['"`]\/(?:thumbs|baked)\//;
const ALLOWED = /withBase\(|\bdev\s*\?/;

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		if (e.isDirectory()) return p.endsWith('server') ? [] : sourceFiles(p);
		return /\.(svelte|ts)$/.test(p) && !p.endsWith('.test.ts') ? [p] : [];
	});
}

test('пути к static/ в клиентском коде идут через withBase() (иначе 404 на подпути)', () => {
	const offenders = ROOTS.flatMap(sourceFiles).flatMap((file) =>
		readFileSync(file, 'utf8')
			.split('\n')
			.flatMap((line, i) =>
				STATIC_PATH.test(line) && !ALLOWED.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
			),
	);
	expect(offenders).toEqual([]);
});

test('путь мира и src картинок в разметке — только через withBase()', () => {
	const RAW_WORLD = /\.world\b(?![^(]*\))/; // .world вне скобок withBase(...)
	const RAW_SRC = /\bsrc=\{(?!withBase\()(?!favicon\})/;
	const offenders = ROOTS.flatMap(svelteFiles).flatMap((file) =>
		readFileSync(file, 'utf8')
			.split('\n')
			.flatMap((line, i) => {
				const rawWorld = RAW_WORLD.test(line) && !line.includes('withBase(');
				return rawWorld || RAW_SRC.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [];
			}),
	);
	expect(offenders).toEqual([]);
});
