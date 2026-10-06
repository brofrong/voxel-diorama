import { existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Diorama } from '#sdk';

export const ROOT = resolve(import.meta.dir, '../..');
export const DIORAMAS_DIR = join(ROOT, 'src/dioramas');

/** Все подпапки src/dioramas (включая некорректные — для проверки имён). */
export function listDioramaDirs(): string[] {
	if (!existsSync(DIORAMAS_DIR)) return [];
	return readdirSync(DIORAMAS_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

/** slug'и диорам: подпапки с index.ts. */
export function listSlugs(): string[] {
	return listDioramaDirs().filter((dir) => existsSync(join(DIORAMAS_DIR, dir, 'index.ts')));
}

function isDiorama(value: unknown): value is Diorama {
	return (
		typeof value === 'object' &&
		value !== null &&
		'meta' in value &&
		'size' in value &&
		'build' in value
	);
}

/** Импортирует диораму. Ошибки схемы прилетают из defineDiorama при импорте. */
export async function loadDiorama(slug: string): Promise<Diorama> {
	const file = join(DIORAMAS_DIR, slug, 'index.ts');
	if (!existsSync(file)) throw new Error(`нет файла ${relative(ROOT, file)}`);
	const mod = (await import(file)) as { default?: unknown };
	if (!isDiorama(mod.default)) {
		throw new Error(`${relative(ROOT, file)}: ожидается export default defineDiorama({ … })`);
	}
	return mod.default;
}

/** Локальная дата YYYY-MM-DD. */
export function today(date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}
