import { listSlugs } from './lib/dioramas.ts';
import { fetchWithRetry, imageSources } from './lib/site-check.ts';

const site = process.argv[2];
if (!site) {
	console.error(
		'использование: bun run scripts/smoke.ts https://brofrong.github.io/voxel-diorama/',
	);
	process.exit(1);
}
const root = site.endsWith('/') ? site : `${site}/`;
const urls = new Set<string>();

const home = await (await fetchWithRetry(root)).text();
for (const src of imageSources(home)) urls.add(new URL(src, root).href);
for (const slug of listSlugs()) {
	urls.add(new URL(`d/${slug}`, root).href);
	urls.add(new URL(`baked/${slug}.vxb`, root).href);
}

let failed = false;
for (const url of urls) {
	try {
		await fetchWithRetry(url);
		console.log(`✓ ${url}`);
	} catch (error) {
		failed = true;
		console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
	}
}
process.exit(failed ? 1 : 0);
