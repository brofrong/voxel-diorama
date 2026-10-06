import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bakeToVxb, SIZE_LIMIT_BYTES } from '#sdk';
import { listSlugs, loadDiorama, ROOT } from './lib/dioramas.ts';

const outDir = join(ROOT, 'static/baked');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const slug of listSlugs()) {
	const { bytes, stats } = await bakeToVxb(await loadDiorama(slug));
	if (stats.bytes > SIZE_LIMIT_BYTES) {
		throw new Error(`${slug}: .vxb больше лимита (${stats.bytes} байт)`);
	}
	writeFileSync(join(outDir, `${slug}.vxb`), bytes);
	console.log(`baked ${slug}.vxb (${(stats.bytes / 1024).toFixed(1)} КБ)`);
}
