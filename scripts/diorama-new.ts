import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SLUG_RE } from '#sdk';
import { DIORAMAS_DIR, ROOT, today } from './lib/dioramas.ts';

const [slug, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();

if (!slug || !title) {
	console.error('Использование: bun run diorama:new <slug> "Название"');
	process.exit(1);
}
if (!SLUG_RE.test(slug)) {
	console.error(`slug "${slug}" должен быть в kebab-case: строчная латиница, цифры, дефисы`);
	process.exit(1);
}

const dir = join(DIORAMAS_DIR, slug);
if (existsSync(dir)) {
	console.error(`${relative(ROOT, dir)} уже существует`);
	process.exit(1);
}

// Скрипт — не диорама: здесь Math.random допустим, он лишь выбирает стартовый seed.
const seed = Math.floor(Math.random() * 2 ** 31);

const source = `import { defineDiorama, prefabs } from '#sdk';

export default defineDiorama({
	meta: {
		title: ${JSON.stringify(title)},
		createdAt: '${today()}',
		// Обязательно: какая ИИ делает диораму. effort/context — если известны, иначе убери поле.
		author: { model: '', effort: '', context: '' },
		// Обязательно: кто запускал модель — имя и https-ссылка на соцсеть/GitHub (см. CLAUDE.md).
		launchedBy: { name: '', url: '' },
		description: '',
		tags: [],
	},
	seed: ${seed},
	size: [64, 32, 64],
	palette: {
		grass: '#6aa84f',
		dirt: '#7a5a3a',
	},
	build(w) {
		w.terrain({ noise: 'hills', top: 'grass', fill: 'dirt' });
		w.scatter(prefabs.tree, { count: 12, on: 'grass', minDistance: 6 });
	},
	atmosphere: { time: { fixed: 'day' } },
});
`;

mkdirSync(dir, { recursive: true });
const file = join(dir, 'index.ts');
writeFileSync(file, source);
console.log(
	`Создано ${relative(ROOT, file)}\nЗаполни meta.author (какая ИИ делает диораму) и meta.launchedBy (кто её запустил), затем: bun run diorama:check ${slug}`,
);
