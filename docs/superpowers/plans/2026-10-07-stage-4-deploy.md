# Этап 4 «Деплой» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сайт публикуется на `https://brofrong.github.io/voxel-diorama/` через GitHub Actions на каждый push в `main`; ссылки работают на подпути, версии файлов — по хешу содержимого, сборка защищена от неверного окружения.

**Architecture:** Чистые функции (проверка окружения, версия по хешу, проверка собранного HTML) живут в `scripts/lib/` и `src/lib/server/` и покрыты `bun test`. Компоненты строят адреса через `$app/paths` (`resolve` для страниц, хелпер `withBase` для статики). Workflow собирает, проверяет `build/`, выкладывает Pages и делает smoke-проверку живого сайта.

**Tech Stack:** Bun 1.4.2, SvelteKit 3 (`@sveltejs/kit` 3.0.1, adapter-static), GitHub Actions (`oven-sh/setup-bun@v2`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-10-07-stage-4-deploy-design.md`

## Global Constraints

- Всё из этапов 1–3 в силе: Bun; алиасы `#lib/…ts`, `#sdk`, `#engine`; в `scripts`/`vite`/`src/engine`/`src/sdk` — относительные импорты с `.ts`; Biome; `bun run format && bun run check` перед коммитом; сообщения по-русски; Conventional Commits с трейлером `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Адрес сайта: `SITE_ORIGIN=https://brofrong.github.io`, `BASE_PATH=/voxel-diorama`. В dev base пустой.
- `SITE_ORIGIN`: `http(s)://host[:port]` без пути и без `/` в конце. `BASE_PATH`: пусто или `/сегмент(/сегмент)*` без `/` в конце.
- Версия файла в URL — первые 10 hex sha256 содержимого.
- Внешние действия (создание репозитория, push, включение Pages) — только после явного подтверждения пользователя.

## Review Focus

1. **Переход по карточке и «← Все диорамы» на подпути** → ведут на `/voxel-diorama/d/<slug>` и `/voxel-diorama/`, а не на корень `brofrong.github.io`. Тесты: Task 3 (регрессия атрибутов), Task 4 (`findRootPaths` по собранному HTML).
2. **`og:image` при prerender с относительным base** → абсолютный `https://brofrong.github.io/voxel-diorama/thumbs/…`. Тест: Task 4 (`checkOgImages`).
3. **`SITE_ORIGIN` с завершающим `/` или путём, `BASE_PATH` без ведущего `/`** → сборка падает с понятной ошибкой до запекания. Тест: Task 1.
4. **Свежий checkout в CI (mtime другой)** → те же `?v=` у скриншотов и миров, что локально. Тест: Task 2.
5. **Pages ещё раскатывает деплой (404 первые секунды)** → smoke повторяет запросы до ~60 с и падает только по таймауту. Тест: Task 4 (`fetchWithRetry`).

---

## Карта файлов

```
scripts/lib/build-env.ts        checkBuildEnv (чистая)                                 — T1
scripts/bake-all.ts             вызывает checkBuildEnv первым                           — T1
package.json                    build:local                                             — T1
src/lib/server/version.ts       contentVersion (sha256 → 10 hex)                        — T2
src/lib/server/thumbs.ts        thumbUrl по хешу                                        — T2
src/lib/server/dioramas.ts      CardData.world                                          — T2
src/lib/types.ts                CardData.world                                          — T2
src/lib/paths.ts                withBase                                                — T3
vite.config.ts                  paths.base                                              — T3
src/lib/components/*.svelte, src/routes/d/[slug]/+page.svelte                         — T3
src/lib/paths.test.ts           регрессия корневых путей                                 — T3
scripts/lib/site-check.ts       findRootPaths, checkOgImages, expectedFiles, fetchWithRetry — T4
scripts/verify-build.ts, scripts/smoke.ts                                               — T4
.github/workflows/deploy.yml                                                            — T5
CLAUDE.md, .claude/skills/new-diorama/SKILL.md                                          — T6
```

---

### Task 1: Проверка окружения сборки

**Files:**
- Create: `scripts/lib/build-env.ts`, `scripts/lib/build-env.test.ts`
- Modify: `scripts/bake-all.ts`, `package.json`

**Interfaces:**
- Produces: `checkBuildEnv(env: Record<string, string | undefined>): { origin: string; base: string }` — бросает `Error` с русским текстом.

- [ ] **Step 1: Падающие тесты** — `scripts/lib/build-env.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { checkBuildEnv } from './build-env.ts';

test('корректное окружение', () => {
	expect(checkBuildEnv({ SITE_ORIGIN: 'https://brofrong.github.io', BASE_PATH: '/voxel-diorama' })).toEqual({
		origin: 'https://brofrong.github.io',
		base: '/voxel-diorama',
	});
	expect(checkBuildEnv({ SITE_ORIGIN: 'http://localhost:4173' })).toEqual({
		origin: 'http://localhost:4173',
		base: '',
	});
});

test('нет SITE_ORIGIN — понятная ошибка', () => {
	expect(() => checkBuildEnv({})).toThrow('SITE_ORIGIN не задан');
});

test('неверный SITE_ORIGIN', () => {
	for (const bad of ['brofrong.github.io', 'https://brofrong.github.io/', 'https://x.io/path', 'ftp://x.io']) {
		expect(() => checkBuildEnv({ SITE_ORIGIN: bad })).toThrow('SITE_ORIGIN');
	}
});

test('неверный BASE_PATH', () => {
	for (const bad of ['voxel-diorama', '/voxel-diorama/', '/', '/a b']) {
		expect(() => checkBuildEnv({ SITE_ORIGIN: 'https://x.io', BASE_PATH: bad })).toThrow('BASE_PATH');
	}
	expect(checkBuildEnv({ SITE_ORIGIN: 'https://x.io', BASE_PATH: '' }).base).toBe('');
	expect(checkBuildEnv({ SITE_ORIGIN: 'https://x.io', BASE_PATH: '/a/b-c' }).base).toBe('/a/b-c');
});
```

- [ ] **Step 2: Тесты падают** — Run: `bun test scripts/lib/build-env.test.ts` — Expected: FAIL, модуль не найден.

- [ ] **Step 3: `scripts/lib/build-env.ts`**

```ts
const ORIGIN_RE = /^https?:\/\/[^/\s]+$/;
const BASE_RE = /^(\/[A-Za-z0-9._~-]+)+$/;

/** Проверяет переменные продакшен-сборки до запекания. Бросает понятную ошибку. */
export function checkBuildEnv(env: Record<string, string | undefined>): { origin: string; base: string } {
	const origin = env.SITE_ORIGIN;
	if (!origin) {
		throw new Error(
			'SITE_ORIGIN не задан — нужен для абсолютных og:image. Пример: SITE_ORIGIN=https://brofrong.github.io (локально: bun run build:local)',
		);
	}
	if (!ORIGIN_RE.test(origin)) {
		throw new Error(`SITE_ORIGIN="${origin}": ожидается http(s)://хост без пути и без / в конце`);
	}
	const base = env.BASE_PATH ?? '';
	if (base !== '' && !BASE_RE.test(base)) {
		throw new Error(`BASE_PATH="${base}": ожидается пусто или /сегмент без / в конце (например /voxel-diorama)`);
	}
	return { origin, base };
}
```

- [ ] **Step 4: Тесты проходят** — Run: `bun test scripts/lib/build-env.test.ts` — Expected: PASS.

- [ ] **Step 5: Подключение**

В начало `scripts/bake-all.ts` (после импортов):

```ts
import { checkBuildEnv } from './lib/build-env.ts';

const env = checkBuildEnv(process.env);
console.log(`сборка для ${env.origin}${env.base}/`);
```

(при ошибке `bun` печатает сообщение и выходит с кодом 1 — этого достаточно).

`package.json`, в `scripts`: `"build:local": "SITE_ORIGIN=http://localhost:4173 bun run build",`.

- [ ] **Step 6: Проверки**

```bash
bun run build; echo "exit=$?"
bun run build:local
```

Expected: первая команда — `SITE_ORIGIN не задан …`, `exit=1`; вторая — успешная сборка.

- [ ] **Step 7: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "feat(build): fail production build without a valid SITE_ORIGIN

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Версии по хешу содержимого

**Files:**
- Create: `src/lib/server/version.ts`, `src/lib/server/version.test.ts`
- Modify: `src/lib/server/thumbs.ts`, `src/lib/server/thumbs.test.ts`, `src/lib/types.ts`, `src/lib/server/dioramas.ts`

**Interfaces:**
- Produces: `contentVersion(file: string): string | null`; `thumbUrl(slug, staticDir?): string | null` → `/thumbs/<slug>.webp?v=<10hex>`; `worldPath(slug, staticDir?): string` → `/baked/<slug>.vxb?v=<10hex>` или `/baked/<slug>.vxb`; `CardData.world: string`.

- [ ] **Step 1: Падающие тесты**

`src/lib/server/version.test.ts`:

```ts
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
```

`src/lib/server/thumbs.test.ts` — заменить второй тест и добавить тест мира:

```ts
test('есть скриншот → URL с версией по содержимому', () => {
	mkdirSync(join(dir, 'thumbs'));
	writeFileSync(join(dir, 'thumbs', 'quiet-valley.webp'), 'x');
	expect(thumbUrl('quiet-valley', dir)).toBe('/thumbs/quiet-valley.webp?v=2d711642b7');
});

test('мир: с версией, если запечён; без — в dev', () => {
	expect(worldPath('river-mill', dir)).toBe('/baked/river-mill.vxb');
	mkdirSync(join(dir, 'baked'));
	writeFileSync(join(dir, 'baked', 'river-mill.vxb'), 'x');
	expect(worldPath('river-mill', dir)).toBe('/baked/river-mill.vxb?v=2d711642b7');
});
```

(импорт `worldPath` рядом с `thumbUrl`; `2d711642b7` — sha256("x").)

- [ ] **Step 2: Тесты падают** — Run: `bun test src/lib/server` — Expected: FAIL.

- [ ] **Step 3: Реализация**

`src/lib/server/version.ts`:

```ts
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/** Версия файла для URL: первые 10 hex sha256 содержимого; нет файла — null. */
export function contentVersion(file: string): string | null {
	if (!existsSync(file)) return null;
	return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
}
```

`src/lib/server/thumbs.ts`:

```ts
import { join } from 'node:path';
import { contentVersion } from './version.ts';

/** Путь скриншота (без base) с версией по содержимому или null. */
export function thumbUrl(slug: string, staticDir = 'static'): string | null {
	const v = contentVersion(join(staticDir, 'thumbs', `${slug}.webp`));
	return v ? `/thumbs/${slug}.webp?v=${v}` : null;
}

/** Путь запечённого мира (без base): при сборке — с версией, в dev — без (печётся на лету). */
export function worldPath(slug: string, staticDir = 'static'): string {
	const v = contentVersion(join(staticDir, 'baked', `${slug}.vxb`));
	return v ? `/baked/${slug}.vxb?v=${v}` : `/baked/${slug}.vxb`;
}
```

`src/lib/types.ts`, в `CardData`:

```ts
	/** Путь запечённого мира (без base), с версией по содержимому после bake-all. */
	world: string;
```

`src/lib/server/dioramas.ts`: импорт `worldPath`; в `toCard` — `world: worldPath(slug),`.

- [ ] **Step 4: Тесты проходят** — Run: `bun test src/lib` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "feat(site): version thumbnails and worlds by content hash

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Сайт на подпути

**Files:**
- Create: `src/lib/paths.ts`, `src/lib/paths.test.ts`
- Modify: `vite.config.ts`, `src/lib/components/DioramaCard.svelte`, `src/lib/components/Viewer.svelte`, `src/routes/d/[slug]/+page.svelte`

**Interfaces:**
- Consumes: `CardData.thumb`, `CardData.world` (Task 2).
- Produces: `withBase(path: string): string` (`path` начинается с `/`).

- [ ] **Step 1: Падающий тест** — `src/lib/paths.test.ts` (регрессия корневых путей в разметке):

```ts
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
```

- [ ] **Step 2: Тест падает** — Run: `bun test src/lib/paths.test.ts` — Expected: FAIL, в списке `DioramaCard.svelte` (`href="/d/…`) и `Viewer.svelte` (`href="/"`).

- [ ] **Step 3: Реализация**

`src/lib/paths.ts`:

```ts
import { base } from '$app/paths';

/** Путь к файлу из static/ с учётом base (на Pages сайт живёт на подпути). `path` начинается с /. */
export function withBase(path: string): string {
	return `${base}${path}`;
}
```

`vite.config.ts`, в `sveltekit({ … })`:

```ts
			// На Pages сайт живёт на подпути (BASE_PATH=/voxel-diorama); в dev — корень.
			paths: {
				base: (process.env.BASE_PATH ?? '') as '' | `/${string}`,
				origin: process.env.SITE_ORIGIN ?? 'http://localhost:5173',
			},
```

(вместо прежней строки `paths: { origin: … }`).

`src/lib/components/DioramaCard.svelte`: импорт `import { resolve } from '$app/paths';` и `import { withBase } from '#lib/paths.ts';`; `href={resolve('/d/[slug]', { slug: card.slug })}`; `src={withBase(card.thumb)}`.

`src/lib/components/Viewer.svelte`:
- импорты `resolve` из `$app/paths`, `withBase` из `#lib/paths.ts`;
- `const worldUrl = (): string => (dev ? `/baked/${card.slug}.vxb?t=${Date.now()}` : withBase(card.world));` и все вызовы `worldUrl(…)` → `worldUrl()`;
- `<a class="back" href={resolve('/')}>`;
- обе `<img … src={card.thumb}` → `src={withBase(card.thumb)}`.

`src/routes/d/[slug]/+page.svelte`: импорт `withBase`;
`const ogImage = $derived(data.card.thumb ? new URL(withBase(data.card.thumb), page.url).href : null);`
(база `page.url`, а не `origin`: при prerender base относительный).

- [ ] **Step 4: Тест проходит** — Run: `bun test src/lib` — Expected: PASS.

- [ ] **Step 5: Проверки**

```bash
bun run format && bun run check
BASE_PATH=/voxel-diorama SITE_ORIGIN=https://brofrong.github.io bun run build
grep -o 'og:image" content="[^"]*' build/d/river-mill.html
grep -o 'href="[^"]*"' build/index.html | head
```

Expected: сборка зелёная; `og:image` = `https://brofrong.github.io/voxel-diorama/thumbs/river-mill.webp?v=…`; `href` относительные (`./d/…`) или с `/voxel-diorama/`. Визуально (контроллер): `bun run dev` — главная, переход в диораму, «← Все диорамы», скриншот-фон при загрузке работают как раньше.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(site): serve the site from a base path

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Проверка сборки и smoke живого сайта

**Files:**
- Create: `scripts/lib/site-check.ts`, `scripts/lib/site-check.test.ts`, `scripts/verify-build.ts`, `scripts/smoke.ts`

**Interfaces:**
- Consumes: `checkBuildEnv` (Task 1), `listSlugs` (`scripts/lib/dioramas.ts`).
- Produces: `findRootPaths(html: string, base: string): string[]`, `checkOgImages(html: string, prefix: string): string[]`, `expectedFiles(slugs: string[]): string[]`, `fetchWithRetry(url, opts?): Promise<Response>`, `imageSources(html: string): string[]`.

- [ ] **Step 1: Падающие тесты** — `scripts/lib/site-check.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { checkOgImages, expectedFiles, fetchWithRetry, findRootPaths, imageSources } from './site-check.ts';

test('findRootPaths: корневые пути без base — нарушения, относительные и с base — нет', () => {
	const html = '<a href="/d/x">a</a><a href="./d/y">b</a><img src="/voxel-diorama/thumbs/x.webp"><link href="//cdn.io/a">';
	expect(findRootPaths(html, '/voxel-diorama')).toEqual(['/d/x']);
	expect(findRootPaths(html, '')).toEqual([]);
});

test('checkOgImages: og:image должен быть абсолютным с адресом сайта', () => {
	const ok = '<meta property="og:image" content="https://brofrong.github.io/voxel-diorama/thumbs/a.webp?v=1">';
	const bad = '<meta property="og:image" content="/thumbs/a.webp">';
	expect(checkOgImages(ok, 'https://brofrong.github.io/voxel-diorama/')).toEqual([]);
	expect(checkOgImages(bad, 'https://brofrong.github.io/voxel-diorama/')).toEqual(['/thumbs/a.webp']);
});

test('expectedFiles: главная, страница и мир каждой диорамы', () => {
	expect(expectedFiles(['a', 'b'])).toEqual(['index.html', 'd/a.html', 'baked/a.vxb', 'd/b.html', 'baked/b.vxb']);
});

test('imageSources: src картинок', () => {
	expect(imageSources('<img src="./thumbs/a.webp?v=1" alt=""><img alt="" src="x.png">')).toEqual([
		'./thumbs/a.webp?v=1',
		'x.png',
	]);
});

test('fetchWithRetry: повторяет до 200, затем отдаёт ответ', async () => {
	let calls = 0;
	const fake = async () => new Response('', { status: ++calls < 3 ? 404 : 200 });
	const res = await fetchWithRetry('https://x.io', { fetchFn: fake, delayMs: 1, attempts: 5 });
	expect(res.status).toBe(200);
	expect(calls).toBe(3);
});

test('fetchWithRetry: после всех попыток — ошибка с URL и статусом', async () => {
	const fake = async () => new Response('', { status: 404 });
	await expect(fetchWithRetry('https://x.io/a', { fetchFn: fake, delayMs: 1, attempts: 2 })).rejects.toThrow(
		'https://x.io/a → 404',
	);
});
```

- [ ] **Step 2: Тесты падают** — Run: `bun test scripts/lib/site-check.test.ts` — Expected: FAIL.

- [ ] **Step 3: `scripts/lib/site-check.ts`**

```ts
const ATTR_RE = /\b(?:href|src)="([^"]*)"/g;
const OG_IMAGE_RE = /<meta property="og:image" content="([^"]*)"/g;
const IMG_RE = /<img\b[^>]*\bsrc="([^"]*)"/g;

/** Пути от корня сайта (`/…`, не `//…`), не начинающиеся с base. */
export function findRootPaths(html: string, base: string): string[] {
	const out: string[] = [];
	for (const [, value] of html.matchAll(ATTR_RE)) {
		if (!value.startsWith('/') || value.startsWith('//')) continue;
		if (base && (value === base || value.startsWith(`${base}/`))) continue;
		if (!base) continue;
		out.push(value);
	}
	return out;
}

/** og:image, не начинающиеся с абсолютного адреса сайта `prefix` (origin + base + '/'). */
export function checkOgImages(html: string, prefix: string): string[] {
	return [...html.matchAll(OG_IMAGE_RE)].map((m) => m[1]).filter((v) => !v.startsWith(prefix));
}

export function expectedFiles(slugs: string[]): string[] {
	return ['index.html', ...slugs.flatMap((s) => [`d/${s}.html`, `baked/${s}.vxb`])];
}

export function imageSources(html: string): string[] {
	return [...html.matchAll(IMG_RE)].map((m) => m[1]);
}

export interface RetryOptions {
	attempts?: number;
	delayMs?: number;
	fetchFn?: (url: string) => Promise<Response>;
}

/** GET с повторами: Pages раскатывает деплой не мгновенно. */
export async function fetchWithRetry(url: string, opts: RetryOptions = {}): Promise<Response> {
	const { attempts = 12, delayMs = 5000, fetchFn = (u) => fetch(u) } = opts;
	let status = 0;
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await fetchFn(url);
			if (res.ok) return res;
			status = res.status;
		} catch {
			status = 0;
		}
		if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
	}
	throw new Error(`${url} → ${status || 'нет ответа'} после ${attempts} попыток`);
}
```

- [ ] **Step 4: Тесты проходят** — Run: `bun test scripts/lib` — Expected: PASS.

- [ ] **Step 5: CLI**

`scripts/verify-build.ts`:

```ts
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
	for (const p of checkOgImages(html, `${origin}${base}/`)) problems.push(`${name}: og:image не абсолютный: ${p}`);
}

if (problems.length > 0) {
	for (const p of problems) console.error(`✗ ${p}`);
	process.exit(1);
}
console.log(`✓ build/ в порядке для ${origin}${base}/`);
```

`scripts/smoke.ts`:

```ts
import { listSlugs } from './lib/dioramas.ts';
import { fetchWithRetry, imageSources } from './lib/site-check.ts';

const site = process.argv[2];
if (!site) {
	console.error('использование: bun run scripts/smoke.ts https://brofrong.github.io/voxel-diorama/');
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
```

- [ ] **Step 6: Проверки**

```bash
BASE_PATH=/voxel-diorama SITE_ORIGIN=https://brofrong.github.io bun run build
BASE_PATH=/voxel-diorama SITE_ORIGIN=https://brofrong.github.io bun run scripts/verify-build.ts
bun run build:local && bun run scripts/verify-build.ts; echo "exit=$?"
```

Expected: первая проверка `✓ build/ в порядке…`; последняя — `SITE_ORIGIN не задан` (verify тоже требует окружение), `exit=1`.

- [ ] **Step 7: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "feat(build): verify built site and smoke-test the deployed one

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Workflow GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Workflow**

```yaml
name: deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

env:
  SITE_ORIGIN: https://brofrong.github.io
  BASE_PATH: /voxel-diorama

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: bun install --frozen-lockfile
      - run: bun run check
      - run: bun run build
      - run: bun run scripts/verify-build.ts
      - run: touch build/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.4.2
      - run: bun run scripts/smoke.ts "${{ steps.deployment.outputs.page_url }}"
```

- [ ] **Step 2: Проверка синтаксиса и шагов локально**

```bash
bun -e "const w = Bun.YAML.parse(await Bun.file('.github/workflows/deploy.yml').text()); console.log(Object.keys(w.jobs).join(','))"
BASE_PATH=/voxel-diorama SITE_ORIGIN=https://brofrong.github.io sh -c 'bun run check && bun run build && bun run scripts/verify-build.ts'
```

Expected: первая команда печатает `build,deploy`; последняя строка — `✓ build/ в порядке для https://brofrong.github.io/voxel-diorama/` (повтор шагов job `build`; окончательно workflow проверит первый запуск в Task 7).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: build, verify and deploy the site to GitHub Pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Документация

**Files:**
- Modify: `CLAUDE.md`, `.claude/skills/new-diorama/SKILL.md`

- [ ] **Step 1: CLAUDE.md**

В таблицу команд после строки `bun run build`:

```markdown
| `bun run build:local` | сборка для локального `bun run preview` (`SITE_ORIGIN=http://localhost:4173`) |
```

строку `bun run build` заменить на:

```markdown
| `bun run build` | запекание всех диорам в `static/baked` + статическая сборка в `build/`; требует `SITE_ORIGIN` (и `BASE_PATH` для подпути) |
```

В конец файла раздел:

```markdown
## Публикация

- Сайт: https://brofrong.github.io/voxel-diorama/ (GitHub Pages, репозиторий `brofrong/voxel-diorama`).
- Каждый push в `main` → `.github/workflows/deploy.yml`: `check` → `build` (`SITE_ORIGIN=https://brofrong.github.io`, `BASE_PATH=/voxel-diorama`) → проверка `build/` → деплой → smoke живого сайта. Статус: `gh run list --workflow deploy.yml -L 1`, `gh run watch`.
- Ссылки в разметке — только через `resolve()` (страницы) и `withBase()` (`#lib/paths.ts`, файлы из `static/`); тест `src/lib/paths.test.ts` ловит пути от корня.
- Версии скриншотов и миров в URL — хеш содержимого (`src/lib/server/version.ts`).
```

- [ ] **Step 2: Skill**

В `.claude/skills/new-diorama/SKILL.md`, раздел «## 6. Финал», последнюю строку заменить на:

```markdown
Покажи пользователю скриншот (`![](абсолютный/путь/к/static/thumbs/<slug>.webp)`) и 2–3 строки о сцене. **Коммит и push — только по команде пользователя.** После push в `main` сайт обновится сам: проверь `gh run watch` (или `gh run list --workflow deploy.yml -L 1`) и дай ссылку `https://brofrong.github.io/voxel-diorama/d/<slug>`.
```

- [ ] **Step 3: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "docs: describe publishing to GitHub Pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Публикация (контроллер, с подтверждениями пользователя)

Шаги — внешние действия; перед каждым — явное «да» пользователя.

- [ ] **Step 1: Репозиторий и push**

```bash
gh repo create brofrong/voxel-diorama --public --source . --remote origin --push
```

- [ ] **Step 2: Включить Pages (источник — GitHub Actions)**

```bash
gh api -X POST repos/brofrong/voxel-diorama/pages -f build_type=workflow
```

(если Pages уже создан первым запуском workflow — `gh api -X PUT repos/brofrong/voxel-diorama/pages -f build_type=workflow`).

- [ ] **Step 3: Первый деплой**

```bash
gh workflow run deploy.yml   # если push-запуск упал из-за ещё не включённого Pages
gh run watch --exit-status
```

Expected: все job'ы зелёные, smoke `✓` по всем URL.

- [ ] **Step 4: Визуальная проверка (браузер T3)**

`https://brofrong.github.io/voxel-diorama/`: три карточки со скриншотами; переход в каждую диораму — 3D грузится; меню ⚙; «← Все диорамы» ведёт на главную подпути; пресет iPhone; в консоли нет ошибок. `curl -s …/d/winter-night | grep og:image` — абсолютный URL.
