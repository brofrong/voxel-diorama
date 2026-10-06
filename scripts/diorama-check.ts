import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
	bakeToVxb,
	bakeWarnings,
	checkEntities,
	entityWarnings,
	SIZE_LIMIT_BYTES,
	SLUG_RE,
} from '#sdk';
import { listSlugs, loadDiorama, ROOT } from './lib/dioramas.ts';

const args = process.argv.slice(2);
const skipTypes = args.includes('--no-types');
const requested = args.filter((a) => !a.startsWith('--'));
const targets = requested.length > 0 ? requested : listSlugs();
let failed = false;

const formatBytes = (n: number): string =>
	n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} КБ` : `${(n / 1024 / 1024).toFixed(2)} МБ`;

if (!skipTypes) {
	console.log('▸ Проверка типов (svelte-check)…');
	const result = Bun.spawnSync(['bun', 'run', 'check:types'], {
		cwd: ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	if (result.exitCode === 0) {
		console.log('  ✓ типы в порядке');
	} else {
		failed = true;
		console.log(result.stdout.toString());
		console.error(result.stderr.toString());
		console.error('  ✗ ошибки типов');
	}
}

if (targets.length === 0) console.log('\nДиорам нет: src/dioramas пуст.');

for (const slug of targets) {
	console.log(`\n▸ ${slug}`);
	try {
		if (!SLUG_RE.test(slug)) throw new Error(`некорректный slug "${slug}"`);
		const diorama = await loadDiorama(slug);
		const started = performance.now();
		const { stats, result } = await bakeToVxb(diorama);
		const ms = Math.round(performance.now() - started);
		if (stats.bytes > SIZE_LIMIT_BYTES) {
			throw new Error(
				`.vxb весит ${formatBytes(stats.bytes)} — больше лимита ${formatBytes(SIZE_LIMIT_BYTES)}`,
			);
		}
		console.log(
			`  «${diorama.meta.title}» · ${diorama.meta.createdAt} · size ${diorama.size.join('×')}`,
		);
		console.log(
			`  вокселей ${stats.voxels.toLocaleString('ru-RU')} · чанков ${stats.chunks} · материалов ${stats.materials} · ${formatBytes(stats.bytes)} · ${ms} мс`,
		);
		const entityStats = checkEntities(diorama, result);
		if (entityStats.entities > 0) {
			console.log(
				`  сущностей ${entityStats.entities} · экземпляров ${entityStats.instances} · частей ${entityStats.parts}`,
			);
		}
		for (const warning of [...bakeWarnings(stats), ...entityWarnings(entityStats)]) {
			console.log(`  ⚠ ${warning}`);
		}
		if (!existsSync(join(ROOT, 'static/thumbs', `${slug}.webp`))) {
			console.log(
				`  ⚠ нет скриншота static/thumbs/${slug}.webp — сделай его (skill new-diorama, шаг 5)`,
			);
		}
		console.log('  ✓ ok');
	} catch (error) {
		failed = true;
		console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
	}
}

process.exit(failed ? 1 : 0);
