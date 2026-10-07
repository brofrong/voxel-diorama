import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checkBuildEnv } from './lib/build-env.ts';
import { listSlugs, ROOT } from './lib/dioramas.ts';
import { checkOgImages, expectedFiles, findRootPaths } from './lib/site-check.ts';

const { origin, base } = checkBuildEnv(process.env);
const out = join(ROOT, 'build');
const problems: string[] = [];

for (const file of expectedFiles(listSlugs())) {
	if (!existsSync(join(out, file))) problems.push(`нет build/${file}`);
}

const htmlFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = join(dir, e.name);
		return e.isDirectory() ? htmlFiles(p) : p.endsWith('.html') ? [p] : [];
	});

for (const file of htmlFiles(out)) {
	const html = readFileSync(file, 'utf8');
	const name = relative(out, file);
	for (const p of findRootPaths(html, base)) problems.push(`${name}: путь от корня без base: ${p}`);
	for (const p of checkOgImages(html, `${origin}${base}/`))
		problems.push(`${name}: og:image не абсолютный: ${p}`);
}

if (problems.length > 0) {
	for (const p of problems) console.error(`✗ ${p}`);
	process.exit(1);
}
console.log(`✓ build/ в порядке для ${origin}${base}/`);
