# Этап 1 «Каркас» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Работающий статический сайт-витрина: главная с карточками, 3D-вьюер воксельной диорамы, SDK для описания диорам, запекание в `.vxb`, мешинг в воркерах, пайплайн скриншотов через браузер T3 и skill для агента — с одной статичной демо-диорамой.

**Architecture:** Три независимых слоя. `src/sdk` — чистый TS (builder, префабы, zod-схема, запекание), без Three.js. `src/engine` — Three.js `WebGPURenderer` + воркеры greedy-мешинга, без Svelte. `src/routes` + `src/lib` — SvelteKit 3, полностью prerender (`adapter-static`); вьюер динамически импортирует движок. Диорамы — модули `src/dioramas/<slug>/index.ts`, которые в dev запекаются Vite-плагином на лету, а при сборке — bun-скриптом в `static/baked/`.

**Tech Stack:** Bun 1.4, SvelteKit 3 + Svelte 5 (runes), Vite 8, Three.js r186 (`three/webgpu`, `three/tsl`), zod 4, Biome 2.5, svelte-check, TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-10-06-voxel-diorama-design.md`

## Global Constraints

- Пакетный менеджер, раннер скриптов и тестов — только Bun (`bun add`, `bun run`, `bun test`). Никаких npm/yarn/pnpm, никакого Playwright.
- SvelteKit 3: конфиг кита — внутри `sveltekit({...})` в `vite.config.ts` (файла `svelte.config.js` нет); модуль окружения — `$app/env` (не `$app/environment`); origin для prerender — `paths.origin`.
- Алиасы — через `"imports"` в `package.json`: `#lib/*` (с явным расширением файла, например `#lib/server/dioramas.ts`), `#sdk`, `#engine`. Внутри `src/engine`, `src/sdk`, `scripts`, `vite` — относительные импорты с явным `.ts`.
- `src/engine` не импортирует Svelte и `#lib`; `src/sdk` не импортирует `three`. Диорамы импортируют только `#sdk`.
- Three.js: классы — из `'three/webgpu'`, узлы TSL — из `'three/tsl'`, аддоны — из `'three/addons/...'`. Никогда не импортировать из `'three'` в движке.
- `Math.random` запрещён в `src/sdk` и `src/dioramas` — только `w.rng` / `createRng`.
- Y вверх, целочисленные координаты, 1 воксель = 1 единица мира. Чанк 32³. Не более 255 материалов на диораму (индекс 0 — пустота). Имя материала `air` зарезервировано.
- slug: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, он же имя папки и URL `/d/<slug>`.
- Скриншот: `static/thumbs/<slug>.webp`, 1200×800.
- Весь текст UI — на русском, `<html lang="ru">`.
- Поля этапов 2–3 (`entities`, `particles`, `lights`) в схеме отсутствуют; схема strict и отвергает их.
- Перед каждым коммитом: `bun run format` (Biome: табы, ширина 100, одинарные кавычки). Коммиты — Conventional Commits с трейлером `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Отклонения от спека (осознанные)

- Спек §5: «Vite-плагин `vite/bake` при `build` эмитит `.vxb`». В плане: в **dev** запекает Vite-плагин (`vite/diorama-dev.ts`) — как в спеке; при **сборке** запекает `scripts/bake-all.ts` в `static/baked/` перед `vite build`. Причина: Vite при сборке работает под Node и не умеет исполнять TS-модули диорам вне своего графа, а Bun умеет; результат идентичен.

## Review Focus

1. **Неизвестный материал** в `build()` / `terrain` / `scatter({ on })` → понятная ошибка с именем материала и списком палитры, а не «undefined» в воксельных данных. Тест: Task 8.
2. **Объекты частично за границами мира** (дерево у края, сфера больше мира) → обрезаются, считаются в `outOfBounds`, без исключения; `diorama:check` показывает предупреждение. Тесты: Task 7, 8, 9.
3. **Пустая диорама** (build ничего не ставит) → запекается, `diorama:check` предупреждает, кодирование/декодирование мира с 0 чанков работает, вьюер получает прогресс 100%. Тесты: Task 4, 9.
4. **Повреждённый или устаревший `.vxb`** (чужой файл, другая версия, обрезанный) → `VxbError` с человеческим текстом; вьюер показывает ошибку и «Повторить». Тест: Task 4.
5. **У диорамы ещё нет скриншота** → карточка показывает плейсхолдер, вьюер грузится без размытого фона, OG-картинка не выводится. Тест: Task 14 (`thumbUrl` → `null`).

---

## Карта файлов

```
package.json, vite.config.ts, tsconfig.json, biome.json, .gitignore      — Task 1
src/app.html, src/app.d.ts, src/app.css                                  — Task 1, 14
src/engine/types.ts                         общие типы (Vec3, Material, SceneConfig…)    — Task 3
src/engine/voxel/constants.ts               CHUNK, PAD, коды видов, индексаторы         — Task 3
src/engine/voxel/world.ts                   VoxelWorld: разреженные чанки                — Task 3
src/engine/voxel/palette.ts                 sRGB→linear, PaletteLUT                     — Task 3
src/engine/voxel/vxb.ts                     формат .vxb: encode/decode                  — Task 4
src/engine/voxel/mesher.ts                  greedy meshing + AO                         — Task 5
src/engine/voxel/mesh.worker.ts             воркер мешинга                              — Task 6
src/engine/voxel/mesher-pool.ts             пул воркеров                                — Task 6
src/engine/load.ts                          fetch с прогрессом                          — Task 12
src/engine/atmosphere/presets.ts            пресеты света по времени суток              — Task 12
src/engine/atmosphere/sky.ts                градиентное небо (TSL)                      — Task 12
src/engine/render/renderer.ts               WebGPURenderer + fallback                   — Task 12
src/engine/render/materials.ts              воксельные материалы (TSL)                  — Task 12
src/engine/render/stage.ts                  сцена, камера, свет, тени, подставка        — Task 12
src/engine/world-mesh.ts                    чанки → Three.js Mesh                       — Task 12
src/engine/index.ts                         mountDiorama, публичные типы                — Task 12
src/sdk/rng.ts, src/sdk/noise.ts            детерминированные rng и шум                 — Task 2
src/sdk/slug.ts                             SLUG_RE, slug из пути                       — Task 2
src/sdk/materials.ts                        нормализация материалов                     — Task 7
src/sdk/builder/canvas.ts                   примитивы: set/box/sphere/cylinder/line     — Task 7
src/sdk/builder/model.ts                    Model + model()                             — Task 7
src/sdk/builder/world-builder.ts            WorldBuilder: terrain/water/place/scatter   — Task 8
src/sdk/schema.ts                           zod-схема, defineDiorama, toSceneConfig     — Task 9
src/sdk/bake.ts                             bakeDiorama, bakeToVxb, bakeWarnings        — Task 9
src/sdk/prefabs/{tree,pine,house,rock,index}.ts                                         — Task 10
src/sdk/index.ts                            публичное API SDK                           — Task 9, 10
scripts/lib/dioramas.ts                     поиск/загрузка диорам для скриптов          — Task 11
scripts/diorama-new.ts, diorama-check.ts, bake-all.ts                                   — Task 11
src/dioramas/quiet-valley/index.ts          демо-диорама                                — Task 11
src/dioramas/content.test.ts                контентный тест всех диорам                 — Task 11
vite/diorama-dev.ts                         dev-запекание + HMR-событие                 — Task 13
vite/thumbnail.ts                           dev-приёмник скриншотов                     — Task 13
src/lib/types.ts, src/lib/format.ts         типы карточки/вьюера, формат даты           — Task 14
src/lib/server/thumbs.ts, src/lib/server/dioramas.ts                                    — Task 14
src/lib/components/DioramaCard.svelte, src/lib/components/Viewer.svelte                 — Task 14
src/routes/+layout.ts, +layout.svelte, +page.server.ts, +page.svelte                    — Task 14
src/routes/d/[slug]/+page.server.ts, +page.svelte                                       — Task 14
CLAUDE.md, .claude/skills/new-diorama/SKILL.md                                          — Task 15
```

Тесты лежат рядом с кодом: `*.test.ts`.

---

### Task 1: Каркас проекта (SvelteKit 3 + Bun + Biome)

**Files:**
- Create (из шаблона `sv`): `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `.npmrc`, `.vscode/extensions.json`, `src/app.html`, `src/app.d.ts`, `src/lib/index.ts`, `src/lib/assets/favicon.svg`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `static/robots.txt`
- Create: `biome.json`, `src/routes/+layout.ts`
- Modify: всё перечисленное ниже по шагам

**Interfaces:**
- Produces: скрипты `bun run dev | build | check | check:types | lint | format | test | diorama:new | diorama:check`; алиасы `#lib`, `#lib/*`, `#sdk`, `#engine`.

- [ ] **Step 1: Сгенерировать шаблон во временную папку и перенести в репозиторий**

`sv create` не работает в непустой папке, поэтому генерируем рядом и копируем:

```bash
rm -rf /tmp/vd-scaffold
bunx sv@latest create /tmp/vd-scaffold --template minimal --types ts --no-add-ons --install bun
rsync -a --exclude node_modules --exclude .svelte-kit --exclude README.md --exclude bun.lock /tmp/vd-scaffold/ ./
rm -rf /tmp/vd-scaffold
```

Expected: в корне появились `package.json`, `vite.config.ts`, `tsconfig.json`, `src/`, `static/`.

- [ ] **Step 2: Поставить зависимости**

```bash
bun remove @sveltejs/adapter-auto
bun add three zod
bun add -d @sveltejs/adapter-static @biomejs/biome @types/bun @types/three
```

- [ ] **Step 3: Привести `package.json` к нужному виду**

Заменить поля `name`, `scripts` и `imports` (зависимости не трогать):

```json
{
	"name": "voxel-diorama",
	"scripts": {
		"dev": "vite dev",
		"build": "bun run scripts/bake-all.ts && vite build",
		"preview": "vite preview",
		"prepare": "svelte-kit sync || echo ''",
		"check:types": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --threshold error",
		"lint": "biome check .",
		"format": "biome check --write .",
		"test": "bun test",
		"check": "bun run lint && bun run check:types && bun test",
		"diorama:new": "bun run scripts/diorama-new.ts",
		"diorama:check": "bun run scripts/diorama-check.ts"
	},
	"imports": {
		"#lib": "./src/lib/index.js",
		"#lib/*": "./src/lib/*",
		"#sdk": "./src/sdk/index.ts",
		"#engine": "./src/engine/index.ts"
	}
}
```

- [ ] **Step 4: `vite.config.ts`**

```ts
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Runes-режим для всего проекта, кроме библиотек.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
			},
			adapter: adapter({ strict: true }),
			// Абсолютные URL (og:image) при prerender. На деплое задаётся SITE_ORIGIN.
			paths: { origin: process.env.SITE_ORIGIN ?? 'http://localhost:5173' },
		}),
	],
});
```

- [ ] **Step 5: `tsconfig.json`**

`$app/tsconfig` задаёт `"types": ["$app/types"]`, поэтому типы Bun нужно добавить явно:

```json
{
	"extends": "$app/tsconfig",
	"compilerOptions": {
		"strict": true,
		"types": ["$app/types", "bun"]
	},
	"include": ["src", "scripts", "vite", "vite.config.ts"]
}
```

- [ ] **Step 6: `biome.json`**

```json
{
	"$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
	"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
	"files": {
		"ignoreUnknown": true,
		"includes": ["**", "!**/.svelte-kit", "!**/build", "!**/static/baked"]
	},
	"formatter": { "enabled": true, "indentStyle": "tab", "lineWidth": 100 },
	"javascript": { "formatter": { "quoteStyle": "single" } },
	"html": { "experimentalFullSupportEnabled": true },
	"linter": { "enabled": true, "rules": { "preset": "recommended" } },
	"assist": { "enabled": true, "actions": { "source": { "organizeImports": "on" } } }
}
```

- [ ] **Step 7: Мелкие правки шаблона**

`.gitignore` — добавить в конец:

```
# Запечённые диорамы (генерируются scripts/bake-all.ts)
/static/baked
```

`src/app.html` — заменить `<html lang="en">` на `<html lang="ru">`.

`src/app.d.ts` — добавить первой строкой `/// <reference types="vite/client" />` (нужно для `import.meta.glob` и `import.meta.hot`).

`.vscode/extensions.json`:

```json
{
	"recommendations": ["svelte.svelte-vscode", "biomejs.biome"]
}
```

`src/routes/+layout.ts`:

```ts
export const prerender = true;
```

`src/routes/+page.svelte` — временная заглушка (заменяется в Task 14):

```svelte
<h1>Воксельные диорамы</h1>
```

- [ ] **Step 8: Проверить, что каркас собирается**

```bash
bun run format && bun run lint && bun run check:types && bun run vite build
```

Expected: Biome без ошибок; `svelte-check` — `0 ERRORS`; `vite build` заканчивается `Wrote site to "build"`. (`bun run build` пока не запускаем: `scripts/bake-all.ts` появится в Task 11.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit 3 + Bun + Biome project

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Детерминированные rng, шум и slug

**Files:**
- Create: `src/sdk/rng.ts`, `src/sdk/noise.ts`, `src/sdk/slug.ts`
- Test: `src/sdk/rng.test.ts`, `src/sdk/noise.test.ts`, `src/sdk/slug.test.ts`

**Interfaces:**
- Produces:
  - `interface Rng { next(): number; float(min, max): number; int(min, max): number; pick<T>(items: readonly T[]): T; chance(p: number): boolean; fork(): Rng }`
  - `createRng(seed: number): Rng`
  - `interface Noise2D { value(x, z): number; fbm(x, z, octaves?: number): number }` (оба в `[0, 1]`)
  - `createNoise2D(seed: number): Noise2D`
  - `SLUG_RE: RegExp`, `slugFromDioramaPath(path: string): string | null`

- [ ] **Step 1: Написать падающие тесты**

`src/sdk/rng.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createRng } from './rng.ts';

describe('createRng', () => {
	test('одинаковый seed — одинаковая последовательность', () => {
		const a = createRng(42);
		const b = createRng(42);
		const seqA = Array.from({ length: 10 }, () => a.next());
		const seqB = Array.from({ length: 10 }, () => b.next());
		expect(seqA).toEqual(seqB);
	});

	test('разные seed — разные последовательности', () => {
		expect(createRng(1).next()).not.toBe(createRng(2).next());
	});

	test('next() в [0, 1)', () => {
		const rng = createRng(7);
		for (let i = 0; i < 10_000; i++) {
			const v = rng.next();
			expect(v >= 0 && v < 1).toBe(true);
		}
	});

	test('int(min, max) включает обе границы и не выходит за них', () => {
		const rng = createRng(3);
		const seen = new Set<number>();
		for (let i = 0; i < 10_000; i++) {
			const v = rng.int(2, 5);
			expect(v >= 2 && v <= 5 && Number.isInteger(v)).toBe(true);
			seen.add(v);
		}
		expect([...seen].sort()).toEqual([2, 3, 4, 5]);
	});

	test('pick бросает на пустом массиве', () => {
		expect(() => createRng(1).pick([])).toThrow('пустой');
	});

	test('fork детерминирован и не совпадает с родителем', () => {
		const a = createRng(9).fork();
		const b = createRng(9).fork();
		expect(a.next()).toBe(b.next());
		const parent = createRng(9);
		const child = parent.fork();
		expect(child.next()).not.toBe(parent.next());
	});
});
```

`src/sdk/noise.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { createNoise2D } from './noise.ts';

describe('createNoise2D', () => {
	test('детерминирован по seed', () => {
		expect(createNoise2D(5).fbm(3.3, 7.1)).toBe(createNoise2D(5).fbm(3.3, 7.1));
	});

	test('разные seed дают разный шум', () => {
		expect(createNoise2D(1).value(10.5, 10.5)).not.toBe(createNoise2D(2).value(10.5, 10.5));
	});

	test('value и fbm в [0, 1]', () => {
		const n = createNoise2D(11);
		for (let x = -20; x < 20; x += 0.37) {
			for (let z = -20; z < 20; z += 0.41) {
				const v = n.value(x, z);
				const f = n.fbm(x, z, 5);
				expect(v >= 0 && v <= 1).toBe(true);
				expect(f >= 0 && f <= 1).toBe(true);
			}
		}
	});

	test('непрерывен: маленький шаг — маленькое изменение', () => {
		const n = createNoise2D(3);
		for (let x = 0; x < 10; x += 0.5) {
			expect(Math.abs(n.value(x, 2) - n.value(x + 0.01, 2))).toBeLessThan(0.05);
		}
	});
});
```

`src/sdk/slug.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { SLUG_RE, slugFromDioramaPath } from './slug.ts';

test('SLUG_RE принимает kebab-case и отвергает остальное', () => {
	for (const ok of ['quiet-valley', 'a', 'castle-2']) expect(SLUG_RE.test(ok)).toBe(true);
	for (const bad of ['Quiet', 'two--dashes', '-x', 'x-', 'с-кириллицей', 'a_b', '']) {
		expect(SLUG_RE.test(bad)).toBe(false);
	}
});

test('slugFromDioramaPath достаёт имя папки', () => {
	expect(slugFromDioramaPath('../../dioramas/quiet-valley/index.ts')).toBe('quiet-valley');
	expect(slugFromDioramaPath('/src/dioramas/x/models.ts')).toBeNull();
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `bun test src/sdk`
Expected: FAIL — `Cannot find module './rng.ts'` (и аналогично для noise/slug).

- [ ] **Step 3: Реализация**

`src/sdk/rng.ts`:

```ts
/** Детерминированный генератор случайных чисел. В диорамах — единственный источник случайности. */
export interface Rng {
	/** Равномерное число в [0, 1). */
	next(): number;
	/** Число в [min, max). */
	float(min: number, max: number): number;
	/** Целое в [min, max] включительно. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	chance(probability: number): boolean;
	/** Независимый поток, детерминированно выведенный из текущего. */
	fork(): Rng;
}

/** mulberry32: быстрый 32-битный генератор, достаточный для процедурной генерации. */
export function createRng(seed: number): Rng {
	let state = seed >>> 0;

	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	function pick<T>(items: readonly T[]): T {
		if (items.length === 0) throw new Error('rng.pick: пустой массив');
		return items[Math.floor(next() * items.length)] as T;
	}

	return {
		next,
		float: (min, max) => min + next() * (max - min),
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		pick,
		chance: (probability) => next() < probability,
		fork: () => createRng(Math.floor(next() * 4294967296)),
	};
}
```

`src/sdk/noise.ts`:

```ts
/** Двумерный value noise. Все значения в [0, 1]. */
export interface Noise2D {
	value(x: number, z: number): number;
	/** Фрактальный шум: сумма октав с убывающей амплитудой. */
	fbm(x: number, z: number, octaves?: number): number;
}

export function createNoise2D(seed: number): Noise2D {
	const s = seed | 0;

	const hash = (ix: number, iz: number): number => {
		let h = s ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1);
		h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
		h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967295;
	};

	const smooth = (t: number): number => t * t * (3 - 2 * t);

	const value = (x: number, z: number): number => {
		const x0 = Math.floor(x);
		const z0 = Math.floor(z);
		const fx = smooth(x - x0);
		const fz = smooth(z - z0);
		const a = hash(x0, z0);
		const b = hash(x0 + 1, z0);
		const c = hash(x0, z0 + 1);
		const d = hash(x0 + 1, z0 + 1);
		const near = a + (b - a) * fx;
		const far = c + (d - c) * fx;
		return near + (far - near) * fz;
	};

	const fbm = (x: number, z: number, octaves = 4): number => {
		let sum = 0;
		let amplitude = 1;
		let frequency = 1;
		let norm = 0;
		for (let i = 0; i < octaves; i++) {
			// Сдвиг на октаву убирает совпадение узлов решётки между октавами.
			sum += amplitude * value(x * frequency + i * 17.3, z * frequency - i * 9.1);
			norm += amplitude;
			amplitude *= 0.5;
			frequency *= 2;
		}
		return sum / norm;
	};

	return { value, fbm };
}
```

`src/sdk/slug.ts`:

```ts
/** slug диорамы = имя папки = часть URL `/d/<slug>`. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `…/dioramas/<slug>/index.ts` → `<slug>`; для остальных путей — null. */
export function slugFromDioramaPath(path: string): string | null {
	const match = /\/dioramas\/([^/]+)\/index\.ts$/.exec(path);
	return match?.[1] ?? null;
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/sdk`
Expected: PASS (11 тестов).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(sdk): add seeded rng, value noise and slug helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Общие типы, VoxelWorld и палитра

**Files:**
- Create: `src/engine/types.ts`, `src/engine/voxel/constants.ts`, `src/engine/voxel/world.ts`, `src/engine/voxel/palette.ts`
- Test: `src/engine/voxel/world.test.ts`, `src/engine/voxel/palette.test.ts`

**Interfaces:**
- Produces:
  - `type Vec3 = [number, number, number]`, `type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night'`, `type BaseStyle = 'none' | 'wood' | 'stone'`, `type MaterialKind = 'solid' | 'water' | 'glass'`
  - `interface Material { color: string /* #rrggbb lowercase */; emissive: number; kind: MaterialKind }`
  - `interface CameraConfig { position: Vec3; target: Vec3; autoRotate: boolean; minDistance: number; maxDistance: number }`
  - `interface SceneConfig { size: Vec3; time: TimeOfDay; fog: number; camera: CameraConfig; base: BaseStyle }`
  - `CHUNK = 32`, `CHUNK_SHIFT = 5`, `CHUNK_VOLUME`, `PAD = 34`, `PAD_VOLUME`, `KIND_EMPTY = 0`, `KIND_SOLID = 1`, `KIND_WATER = 2`, `KIND_GLASS = 3`, `MAX_MATERIALS = 255`, `chunkIndex(x, y, z)`, `padIndex(x, y, z)` (x, y, z в `-1..32`)
  - `interface ChunkData { coord: Vec3; data: Uint8Array }`
  - `class VoxelWorld { size; chunks: Map<string, ChunkData>; static key(cx, cy, cz); inBounds(x, y, z); get(x, y, z): number; set(x, y, z, v): boolean; setChunk(coord, data); extractPadded(cx, cy, cz): Uint8Array; countVoxels(): number; usedMaterials(): Set<number>; pruneEmpty(): void }`
  - `interface PaletteLUT { kinds: Uint8Array; colors: Float32Array; emissive: Float32Array }` (по 256 записей; цвета линейные RGB)
  - `KIND_CODE: Record<MaterialKind, number>`, `KIND_NAME: Record<number, MaterialKind | undefined>`, `hexToRgb8(hex): [number, number, number]`, `rgb8ToHex(r, g, b): string`, `srgbToLinear(c): number`, `buildPaletteLUT(materials: readonly Material[]): PaletteLUT` (материал `i` → индекс `i + 1`)

- [ ] **Step 1: Падающие тесты**

`src/engine/voxel/world.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { CHUNK, padIndex } from './constants.ts';
import { VoxelWorld } from './world.ts';

describe('VoxelWorld', () => {
	test('set/get и ленивое создание чанков', () => {
		const w = new VoxelWorld([64, 64, 64]);
		expect(w.chunks.size).toBe(0);
		expect(w.set(1, 2, 3, 7)).toBe(true);
		expect(w.get(1, 2, 3)).toBe(7);
		expect(w.get(0, 0, 0)).toBe(0);
		expect(w.chunks.size).toBe(1);
		w.set(40, 0, 0, 1);
		expect(w.chunks.size).toBe(2);
	});

	test('запись вне границ возвращает false, чтение даёт 0', () => {
		const w = new VoxelWorld([10, 10, 10]);
		expect(w.set(10, 0, 0, 1)).toBe(false);
		expect(w.set(-1, 0, 0, 1)).toBe(false);
		expect(w.get(10, 0, 0)).toBe(0);
		expect(w.get(-1, 5, 5)).toBe(0);
	});

	test('запись нуля в отсутствующий чанк не создаёт его', () => {
		const w = new VoxelWorld([64, 64, 64]);
		w.set(5, 5, 5, 0);
		expect(w.chunks.size).toBe(0);
	});

	test('extractPadded захватывает соседей по границе чанка', () => {
		const w = new VoxelWorld([96, 64, 64]);
		w.set(0, 0, 0, 1);
		w.set(CHUNK, 0, 0, 2); // первый воксель соседнего чанка по +x
		const padded = w.extractPadded(0, 0, 0);
		expect(padded[padIndex(0, 0, 0)]).toBe(1);
		expect(padded[padIndex(CHUNK, 0, 0)]).toBe(2);
		expect(padded[padIndex(-1, 0, 0)]).toBe(0);
	});

	test('countVoxels, usedMaterials, pruneEmpty', () => {
		const w = new VoxelWorld([64, 64, 64]);
		w.set(0, 0, 0, 3);
		w.set(1, 0, 0, 3);
		w.set(40, 40, 40, 5);
		expect(w.countVoxels()).toBe(3);
		expect([...w.usedMaterials()].sort()).toEqual([3, 5]);
		w.set(40, 40, 40, 0);
		w.pruneEmpty();
		expect(w.chunks.size).toBe(1);
	});
});
```

`src/engine/voxel/palette.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { KIND_SOLID, KIND_WATER } from './constants.ts';
import { buildPaletteLUT, hexToRgb8, rgb8ToHex, srgbToLinear } from './palette.ts';

test('hexToRgb8 / rgb8ToHex туда-обратно', () => {
	expect(hexToRgb8('#ff8000')).toEqual([255, 128, 0]);
	expect(rgb8ToHex(255, 128, 0)).toBe('#ff8000');
});

test('srgbToLinear на опорных точках', () => {
	expect(srgbToLinear(0)).toBe(0);
	expect(srgbToLinear(1)).toBeCloseTo(1, 6);
	expect(srgbToLinear(128 / 255)).toBeCloseTo(0.2158, 3);
});

test('buildPaletteLUT: индекс i+1, виды, линейные цвета, emissive', () => {
	const lut = buildPaletteLUT([
		{ color: '#ffffff', emissive: 0, kind: 'solid' },
		{ color: '#000000', emissive: 2, kind: 'water' },
	]);
	expect(lut.kinds[0]).toBe(0);
	expect(lut.kinds[1]).toBe(KIND_SOLID);
	expect(lut.kinds[2]).toBe(KIND_WATER);
	expect(lut.colors[3]).toBeCloseTo(1, 6);
	expect(lut.colors[6]).toBe(0);
	expect(lut.emissive[2]).toBe(2);
});

test('buildPaletteLUT отвергает больше 255 материалов', () => {
	const many = Array.from({ length: 256 }, () => ({
		color: '#ffffff',
		emissive: 0,
		kind: 'solid' as const,
	}));
	expect(() => buildPaletteLUT(many)).toThrow('255');
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/voxel`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Реализация**

`src/engine/types.ts`:

```ts
export type Vec3 = [number, number, number];
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';
export type BaseStyle = 'none' | 'wood' | 'stone';
export type MaterialKind = 'solid' | 'water' | 'glass';

export interface Material {
	/** sRGB, `#rrggbb` в нижнем регистре. */
	color: string;
	/** Сила свечения (0 — не светится). */
	emissive: number;
	kind: MaterialKind;
}

export interface CameraConfig {
	position: Vec3;
	target: Vec3;
	autoRotate: boolean;
	minDistance: number;
	maxDistance: number;
}

/** Всё, что движку нужно знать о диораме помимо вокселей. Сериализуемо (идёт из prerender). */
export interface SceneConfig {
	size: Vec3;
	time: TimeOfDay;
	fog: number;
	camera: CameraConfig;
	base: BaseStyle;
}
```

`src/engine/voxel/constants.ts`:

```ts
export const CHUNK = 32;
export const CHUNK_SHIFT = 5;
export const CHUNK_MASK = CHUNK - 1;
export const CHUNK_VOLUME = CHUNK ** 3;
/** Чанк с рамкой в 1 воксель от соседей — вход мешера. */
export const PAD = CHUNK + 2;
export const PAD_VOLUME = PAD ** 3;

export const KIND_EMPTY = 0;
export const KIND_SOLID = 1;
export const KIND_WATER = 2;
export const KIND_GLASS = 3;

/** Индекс 0 — пустота, поэтому материалов не больше 255. */
export const MAX_MATERIALS = 255;

/** Локальные координаты внутри чанка (0..31). */
export const chunkIndex = (x: number, y: number, z: number): number => x + CHUNK * (y + CHUNK * z);

/** Координаты в рамке чанка (-1..32). */
export const padIndex = (x: number, y: number, z: number): number =>
	x + 1 + PAD * (y + 1 + PAD * (z + 1));
```

`src/engine/voxel/world.ts`:

```ts
import type { Vec3 } from '../types.ts';
import {
	CHUNK,
	CHUNK_MASK,
	CHUNK_SHIFT,
	CHUNK_VOLUME,
	PAD_VOLUME,
	chunkIndex,
	padIndex,
} from './constants.ts';

export interface ChunkData {
	coord: Vec3;
	data: Uint8Array;
}

/** Разреженный воксельный мир: хранятся только чанки, в которые что-то писали. */
export class VoxelWorld {
	readonly size: Vec3;
	readonly chunks = new Map<string, ChunkData>();

	constructor(size: Vec3) {
		this.size = [size[0], size[1], size[2]];
	}

	static key(cx: number, cy: number, cz: number): string {
		return `${cx},${cy},${cz}`;
	}

	inBounds(x: number, y: number, z: number): boolean {
		return (
			x >= 0 && y >= 0 && z >= 0 && x < this.size[0] && y < this.size[1] && z < this.size[2]
		);
	}

	get(x: number, y: number, z: number): number {
		if (!this.inBounds(x, y, z)) return 0;
		const chunk = this.chunks.get(
			VoxelWorld.key(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT, z >> CHUNK_SHIFT),
		);
		return chunk ? chunk.data[chunkIndex(x & CHUNK_MASK, y & CHUNK_MASK, z & CHUNK_MASK)] : 0;
	}

	/** Возвращает false, если точка вне мира (запись проигнорирована). */
	set(x: number, y: number, z: number, value: number): boolean {
		if (!this.inBounds(x, y, z)) return false;
		const cx = x >> CHUNK_SHIFT;
		const cy = y >> CHUNK_SHIFT;
		const cz = z >> CHUNK_SHIFT;
		const key = VoxelWorld.key(cx, cy, cz);
		let chunk = this.chunks.get(key);
		if (!chunk) {
			if (value === 0) return true;
			chunk = { coord: [cx, cy, cz], data: new Uint8Array(CHUNK_VOLUME) };
			this.chunks.set(key, chunk);
		}
		chunk.data[chunkIndex(x & CHUNK_MASK, y & CHUNK_MASK, z & CHUNK_MASK)] = value;
		return true;
	}

	setChunk(coord: Vec3, data: Uint8Array): void {
		this.chunks.set(VoxelWorld.key(coord[0], coord[1], coord[2]), {
			coord: [coord[0], coord[1], coord[2]],
			data,
		});
	}

	/** Чанк 34³ с рамкой из соседей — вход для мешера. */
	extractPadded(cx: number, cy: number, cz: number): Uint8Array {
		const out = new Uint8Array(PAD_VOLUME);
		const center = this.chunks.get(VoxelWorld.key(cx, cy, cz))?.data;
		const ox = cx * CHUNK;
		const oy = cy * CHUNK;
		const oz = cz * CHUNK;
		for (let z = -1; z <= CHUNK; z++) {
			for (let y = -1; y <= CHUNK; y++) {
				for (let x = -1; x <= CHUNK; x++) {
					const interior = x >= 0 && y >= 0 && z >= 0 && x < CHUNK && y < CHUNK && z < CHUNK;
					out[padIndex(x, y, z)] = interior
						? (center?.[chunkIndex(x, y, z)] ?? 0)
						: this.get(ox + x, oy + y, oz + z);
				}
			}
		}
		return out;
	}

	countVoxels(): number {
		let count = 0;
		for (const { data } of this.chunks.values()) {
			for (let i = 0; i < data.length; i++) if (data[i] !== 0) count++;
		}
		return count;
	}

	usedMaterials(): Set<number> {
		const used = new Set<number>();
		for (const { data } of this.chunks.values()) {
			for (let i = 0; i < data.length; i++) if (data[i] !== 0) used.add(data[i]);
		}
		return used;
	}

	/** Удаляет чанки, в которых не осталось ни одного вокселя. */
	pruneEmpty(): void {
		for (const [key, { data }] of this.chunks) {
			if (!data.some((v) => v !== 0)) this.chunks.delete(key);
		}
	}
}
```

`src/engine/voxel/palette.ts`:

```ts
import type { Material, MaterialKind } from '../types.ts';
import { KIND_GLASS, KIND_SOLID, KIND_WATER, MAX_MATERIALS } from './constants.ts';

export const KIND_CODE: Record<MaterialKind, number> = {
	solid: KIND_SOLID,
	water: KIND_WATER,
	glass: KIND_GLASS,
};

export const KIND_NAME: Record<number, MaterialKind | undefined> = {
	[KIND_SOLID]: 'solid',
	[KIND_WATER]: 'water',
	[KIND_GLASS]: 'glass',
};

/** Таблицы по индексу материала (0..255) — вход мешера. */
export interface PaletteLUT {
	kinds: Uint8Array;
	/** Линейный RGB, по 3 числа на индекс. */
	colors: Float32Array;
	emissive: Float32Array;
}

export function hexToRgb8(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb8ToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function buildPaletteLUT(materials: readonly Material[]): PaletteLUT {
	if (materials.length > MAX_MATERIALS) {
		throw new Error(`слишком много материалов: ${materials.length} (максимум ${MAX_MATERIALS})`);
	}
	const kinds = new Uint8Array(256);
	const colors = new Float32Array(256 * 3);
	const emissive = new Float32Array(256);
	materials.forEach((material, i) => {
		const id = i + 1;
		const [r, g, b] = hexToRgb8(material.color);
		kinds[id] = KIND_CODE[material.kind];
		colors[id * 3] = srgbToLinear(r / 255);
		colors[id * 3 + 1] = srgbToLinear(g / 255);
		colors[id * 3 + 2] = srgbToLinear(b / 255);
		emissive[id] = material.emissive;
	});
	return { kinds, colors, emissive };
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/engine/voxel`
Expected: PASS (9 тестов).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(engine): add VoxelWorld chunk storage and palette LUT

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Формат `.vxb`

**Files:**
- Create: `src/engine/voxel/vxb.ts`
- Test: `src/engine/voxel/vxb.test.ts`

**Interfaces:**
- Consumes: `VoxelWorld`, `Material`, `KIND_CODE`, `KIND_NAME`, `hexToRgb8`, `rgb8ToHex`, `CHUNK_VOLUME`, `MAX_MATERIALS` (Task 3).
- Produces:
  - `VXB_VERSION = 1`
  - `class VxbError extends Error`
  - `interface VxbData { world: VoxelWorld; materials: Material[] }`
  - `encodeVxb(data: VxbData): Promise<Uint8Array>`
  - `decodeVxb(input: ArrayBuffer | Uint8Array): Promise<VxbData>`

Формат: 4 несжатых байта `V` `X` `B` `<версия>`, затем deflate-raw payload: `u16 sx, sy, sz` · `u8 число материалов` · на материал `u8 r, g, b, u8 kind, f32 emissive` · `u32 число чанков` · на чанк `u16 cx, cy, cz, u32 число серий, серии (u16 длина, u8 значение)`. Little-endian.

- [ ] **Step 1: Падающие тесты**

`src/engine/voxel/vxb.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { Material } from '../types.ts';
import { CHUNK } from './constants.ts';
import { VXB_VERSION, VxbError, decodeVxb, encodeVxb } from './vxb.ts';
import { VoxelWorld } from './world.ts';

const materials: Material[] = [
	{ color: '#6aa84f', emissive: 0, kind: 'solid' },
	{ color: '#3a7bd5', emissive: 0, kind: 'water' },
	{ color: '#ffd27a', emissive: 1.5, kind: 'glass' },
];

describe('vxb', () => {
	test('кодирование и декодирование туда-обратно', async () => {
		const world = new VoxelWorld([70, 40, 33]);
		world.set(0, 0, 0, 1);
		world.set(69, 39, 32, 2);
		world.set(CHUNK + 1, 5, 7, 3);
		const decoded = await decodeVxb(await encodeVxb({ world, materials }));
		expect(decoded.world.size).toEqual([70, 40, 33]);
		expect(decoded.materials).toEqual(materials);
		expect(decoded.world.get(0, 0, 0)).toBe(1);
		expect(decoded.world.get(69, 39, 32)).toBe(2);
		expect(decoded.world.get(CHUNK + 1, 5, 7)).toBe(3);
		expect(decoded.world.countVoxels()).toBe(3);
	});

	test('пустые чанки не попадают в файл', async () => {
		const world = new VoxelWorld([64, 64, 64]);
		world.set(1, 1, 1, 1);
		world.set(40, 40, 40, 1);
		world.set(40, 40, 40, 0);
		const decoded = await decodeVxb(await encodeVxb({ world, materials }));
		expect(decoded.world.chunks.size).toBe(1);
	});

	test('мир без вокселей кодируется и декодируется', async () => {
		const world = new VoxelWorld([16, 16, 16]);
		const decoded = await decodeVxb(await encodeVxb({ world, materials: [] }));
		expect(decoded.world.chunks.size).toBe(0);
		expect(decoded.materials).toEqual([]);
	});

	test('сплошной чанк сжимается до десятков байт', async () => {
		const world = new VoxelWorld([32, 32, 32]);
		for (let x = 0; x < 32; x++)
			for (let y = 0; y < 32; y++) for (let z = 0; z < 32; z++) world.set(x, y, z, 1);
		const bytes = await encodeVxb({ world, materials });
		expect(bytes.length).toBeLessThan(100);
	});

	test('чужой файл → VxbError', async () => {
		const junk = new TextEncoder().encode('<!doctype html><html>');
		await expect(decodeVxb(junk)).rejects.toBeInstanceOf(VxbError);
	});

	test('другая версия → VxbError с номером версии', async () => {
		const bytes = await encodeVxb({ world: new VoxelWorld([8, 8, 8]), materials });
		bytes[3] = VXB_VERSION + 1;
		await expect(decodeVxb(bytes)).rejects.toThrow(`версия .vxb: ${VXB_VERSION + 1}`);
	});

	test('обрезанный файл → VxbError', async () => {
		const world = new VoxelWorld([64, 64, 64]);
		world.set(3, 3, 3, 1);
		const bytes = await encodeVxb({ world, materials });
		await expect(decodeVxb(bytes.subarray(0, bytes.length - 6))).rejects.toBeInstanceOf(VxbError);
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/voxel/vxb.test.ts`
Expected: FAIL — `Cannot find module './vxb.ts'`.

- [ ] **Step 3: Реализация**

`src/engine/voxel/vxb.ts`:

```ts
import type { Material, Vec3 } from '../types.ts';
import { CHUNK_VOLUME, MAX_MATERIALS } from './constants.ts';
import { KIND_CODE, KIND_NAME, hexToRgb8, rgb8ToHex } from './palette.ts';
import { VoxelWorld } from './world.ts';

export const VXB_VERSION = 1;
const MAGIC = [0x56, 0x58, 0x42]; // "VXB"

export class VxbError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'VxbError';
	}
}

export interface VxbData {
	world: VoxelWorld;
	/** Материал `i` хранится в вокселях как индекс `i + 1`. */
	materials: Material[];
}

class ByteWriter {
	private buf = new Uint8Array(4096);
	private view = new DataView(this.buf.buffer);
	length = 0;

	private ensure(extra: number): void {
		if (this.length + extra <= this.buf.length) return;
		let capacity = this.buf.length * 2;
		while (capacity < this.length + extra) capacity *= 2;
		const next = new Uint8Array(capacity);
		next.set(this.buf.subarray(0, this.length));
		this.buf = next;
		this.view = new DataView(next.buffer);
	}

	u8(v: number): void {
		this.ensure(1);
		this.view.setUint8(this.length, v);
		this.length += 1;
	}

	u16(v: number): void {
		this.ensure(2);
		this.view.setUint16(this.length, v, true);
		this.length += 2;
	}

	u32(v: number): void {
		this.ensure(4);
		this.view.setUint32(this.length, v, true);
		this.length += 4;
	}

	f32(v: number): void {
		this.ensure(4);
		this.view.setFloat32(this.length, v, true);
		this.length += 4;
	}

	bytes(): Uint8Array {
		return this.buf.slice(0, this.length);
	}
}

class ByteReader {
	private readonly view: DataView;
	private offset = 0;

	constructor(bytes: Uint8Array) {
		this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}

	private take(n: number): number {
		if (this.offset + n > this.view.byteLength) throw new VxbError('файл .vxb обрезан');
		const at = this.offset;
		this.offset += n;
		return at;
	}

	u8(): number {
		return this.view.getUint8(this.take(1));
	}

	u16(): number {
		return this.view.getUint16(this.take(2), true);
	}

	u32(): number {
		return this.view.getUint32(this.take(4), true);
	}

	f32(): number {
		return this.view.getFloat32(this.take(4), true);
	}
}

async function transform(
	data: Uint8Array,
	stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
	const response = new Response(new Blob([new Uint8Array(data)]).stream().pipeThrough(stream));
	return new Uint8Array(await response.arrayBuffer());
}

export async function encodeVxb({ world, materials }: VxbData): Promise<Uint8Array> {
	if (materials.length > MAX_MATERIALS) {
		throw new VxbError(`слишком много материалов: ${materials.length} (максимум ${MAX_MATERIALS})`);
	}
	const w = new ByteWriter();
	w.u16(world.size[0]);
	w.u16(world.size[1]);
	w.u16(world.size[2]);
	w.u8(materials.length);
	for (const m of materials) {
		const [r, g, b] = hexToRgb8(m.color);
		w.u8(r);
		w.u8(g);
		w.u8(b);
		w.u8(KIND_CODE[m.kind]);
		w.f32(m.emissive);
	}

	const chunks = [...world.chunks.values()]
		.filter(({ data }) => data.some((v) => v !== 0))
		.sort((a, b) => a.coord[2] - b.coord[2] || a.coord[1] - b.coord[1] || a.coord[0] - b.coord[0]);
	w.u32(chunks.length);
	for (const { coord, data } of chunks) {
		w.u16(coord[0]);
		w.u16(coord[1]);
		w.u16(coord[2]);
		const runs: number[] = [];
		let value = data[0];
		let length = 1;
		for (let i = 1; i < data.length; i++) {
			if (data[i] === value) {
				length++;
			} else {
				runs.push(length, value);
				value = data[i];
				length = 1;
			}
		}
		runs.push(length, value);
		w.u32(runs.length / 2);
		for (let i = 0; i < runs.length; i += 2) {
			w.u16(runs[i]);
			w.u8(runs[i + 1]);
		}
	}

	const payload = await transform(w.bytes(), new CompressionStream('deflate-raw'));
	const out = new Uint8Array(4 + payload.length);
	out.set(MAGIC);
	out[3] = VXB_VERSION;
	out.set(payload, 4);
	return out;
}

export async function decodeVxb(input: ArrayBuffer | Uint8Array): Promise<VxbData> {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	if (
		bytes.length < 4 ||
		bytes[0] !== MAGIC[0] ||
		bytes[1] !== MAGIC[1] ||
		bytes[2] !== MAGIC[2]
	) {
		throw new VxbError('это не файл .vxb');
	}
	if (bytes[3] !== VXB_VERSION) {
		throw new VxbError(
			`неподдерживаемая версия .vxb: ${bytes[3]} (ожидается ${VXB_VERSION}) — перезапеките диораму`,
		);
	}

	let payload: Uint8Array;
	try {
		payload = await transform(bytes.subarray(4), new DecompressionStream('deflate-raw'));
	} catch {
		throw new VxbError('не удалось распаковать .vxb — файл повреждён');
	}

	const r = new ByteReader(payload);
	const size: Vec3 = [r.u16(), r.u16(), r.u16()];
	const materialCount = r.u8();
	const materials: Material[] = [];
	for (let i = 0; i < materialCount; i++) {
		const color = rgb8ToHex(r.u8(), r.u8(), r.u8());
		const kind = KIND_NAME[r.u8()];
		if (!kind) throw new VxbError(`неизвестный вид материала #${i + 1}`);
		const emissive = Math.round(r.f32() * 1000) / 1000;
		materials.push({ color, emissive, kind });
	}

	const world = new VoxelWorld(size);
	const chunkCount = r.u32();
	for (let c = 0; c < chunkCount; c++) {
		const coord: Vec3 = [r.u16(), r.u16(), r.u16()];
		const runCount = r.u32();
		const data = new Uint8Array(CHUNK_VOLUME);
		let offset = 0;
		for (let i = 0; i < runCount; i++) {
			const length = r.u16();
			const value = r.u8();
			if (offset + length > CHUNK_VOLUME) throw new VxbError('повреждённый чанк в .vxb');
			data.fill(value, offset, offset + length);
			offset += length;
		}
		if (offset !== CHUNK_VOLUME) throw new VxbError('повреждённый чанк в .vxb');
		world.setChunk(coord, data);
	}
	return { world, materials };
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/engine/voxel/vxb.test.ts`
Expected: PASS (7 тестов).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(engine): add .vxb binary format with RLE and deflate

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Greedy-мешер с ambient occlusion

**Files:**
- Create: `src/engine/voxel/mesher.ts`
- Test: `src/engine/voxel/mesher.test.ts`

**Interfaces:**
- Consumes: `CHUNK`, `KIND_SOLID`, `padIndex`, `PAD_VOLUME` (Task 3), `PaletteLUT`, `buildPaletteLUT` (Task 3), `Vec3`.
- Produces:
  - `interface MeshData { positions: Float32Array; normals: Float32Array; colors: Float32Array; ao: Float32Array; emissive: Float32Array; indices: Uint32Array }`
  - `interface ChunkMesh { opaque: MeshData | null; water: MeshData | null; glass: MeshData | null }`
  - `AO_CURVE: readonly [0.45, 0.65, 0.82, 1]`
  - `meshChunk(padded: Uint8Array, lut: PaletteLUT, origin: Vec3): ChunkMesh`: позиции уже в мировых координатах (`origin + локальные`)
  - `meshTransferables(mesh: ChunkMesh): ArrayBuffer[]`

Правила видимости грани вокселя A в сторону соседа B: грань видна, если `B` — пустота, или `B` прозрачный (`water`/`glass`) и `B !== A`. AO считается только по `solid`-соседям. Квады сливаются, только если совпадают и материал, и все четыре значения AO.

- [ ] **Step 1: Падающие тесты**

`src/engine/voxel/mesher.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { CHUNK, PAD_VOLUME, padIndex } from './constants.ts';
import { type MeshData, meshChunk } from './mesher.ts';
import { buildPaletteLUT } from './palette.ts';

const lut = buildPaletteLUT([
	{ color: '#ff0000', emissive: 0, kind: 'solid' }, // 1
	{ color: '#00ff00', emissive: 0, kind: 'solid' }, // 2
	{ color: '#0000ff', emissive: 0, kind: 'water' }, // 3
	{ color: '#ffffff', emissive: 2, kind: 'solid' }, // 4
]);

function padded(voxels: Array<[number, number, number, number]>): Uint8Array {
	const out = new Uint8Array(PAD_VOLUME);
	for (const [x, y, z, m] of voxels) out[padIndex(x, y, z)] = m;
	return out;
}

const quads = (m: MeshData | null): number => (m ? m.indices.length / 6 : 0);

describe('meshChunk', () => {
	test('один воксель — 6 квадов, 24 вершины', () => {
		const mesh = meshChunk(padded([[0, 0, 0, 1]]), lut, [0, 0, 0]);
		expect(quads(mesh.opaque)).toBe(6);
		expect(mesh.opaque?.positions.length).toBe(24 * 3);
		expect(mesh.water).toBeNull();
		expect(mesh.glass).toBeNull();
	});

	test('ряд одинаковых вокселей сливается в 6 квадов', () => {
		const mesh = meshChunk(
			padded([
				[0, 0, 0, 1],
				[1, 0, 0, 1],
				[2, 0, 0, 1],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(6);
	});

	test('разные материалы не сливаются', () => {
		const mesh = meshChunk(
			padded([
				[0, 0, 0, 1],
				[1, 0, 0, 2],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(10);
	});

	test('сплошной чанк — 6 квадов', () => {
		const voxels: Array<[number, number, number, number]> = [];
		for (let x = 0; x < CHUNK; x++)
			for (let y = 0; y < CHUNK; y++) for (let z = 0; z < CHUNK; z++) voxels.push([x, y, z, 1]);
		const mesh = meshChunk(padded(voxels), lut, [0, 0, 0]);
		expect(quads(mesh.opaque)).toBe(6);
		expect(Math.max(...(mesh.opaque?.positions ?? []))).toBe(CHUNK);
	});

	test('сосед из рамки скрывает грань', () => {
		const mesh = meshChunk(
			padded([
				[CHUNK - 1, 0, 0, 1],
				[CHUNK, 0, 0, 1],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(5);
	});

	test('origin сдвигает позиции в мировые координаты', () => {
		const mesh = meshChunk(padded([[0, 0, 0, 1]]), lut, [32, 0, 64]);
		const p = mesh.opaque?.positions ?? new Float32Array();
		const xs: number[] = [];
		const zs: number[] = [];
		for (let i = 0; i < p.length; i += 3) {
			xs.push(p[i]);
			zs.push(p[i + 2]);
		}
		expect(Math.min(...xs)).toBe(32);
		expect(Math.min(...zs)).toBe(64);
	});

	test('треугольники смотрят наружу (обход против часовой)', () => {
		const m = meshChunk(padded([[0, 0, 0, 1]]), lut, [0, 0, 0]).opaque;
		if (!m) throw new Error('нет меша');
		const v = (i: number) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
		for (let t = 0; t < m.indices.length; t += 3) {
			const [a, b, c] = [v(m.indices[t]), v(m.indices[t + 1]), v(m.indices[t + 2])];
			const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
			const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
			const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
			const i0 = m.indices[t];
			const dot =
				n[0] * m.normals[i0 * 3] + n[1] * m.normals[i0 * 3 + 1] + n[2] * m.normals[i0 * 3 + 2];
			expect(dot).toBeGreaterThan(0);
		}
	});

	test('граница твёрдого и воды: твёрдая грань рисуется, водная — нет', () => {
		const mesh = meshChunk(
			padded([
				[0, 0, 0, 1],
				[1, 0, 0, 3],
			]),
			lut,
			[0, 0, 0],
		);
		expect(quads(mesh.opaque)).toBe(6);
		expect(quads(mesh.water)).toBe(5);
	});

	test('AO: верх куба на плите освещён полностью, плита у куба затенена', () => {
		const voxels: Array<[number, number, number, number]> = [[1, 1, 1, 1]];
		for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) voxels.push([x, 0, z, 1]);
		const m = meshChunk(padded(voxels), lut, [0, 0, 0]).opaque;
		if (!m) throw new Error('нет меша');
		const topOfCube: number[] = [];
		const topOfSlab: number[] = [];
		for (let i = 0; i < m.ao.length; i++) {
			if (m.normals[i * 3 + 1] !== 1) continue;
			const y = m.positions[i * 3 + 1];
			if (y === 2) topOfCube.push(m.ao[i]);
			if (y === 1) topOfSlab.push(m.ao[i]);
		}
		expect(topOfCube.length).toBeGreaterThan(0);
		expect(topOfCube.every((a) => a === 1)).toBe(true);
		expect(topOfSlab.some((a) => a < 1)).toBe(true);
	});

	test('emissive переносится в атрибут', () => {
		const m = meshChunk(padded([[0, 0, 0, 4]]), lut, [0, 0, 0]).opaque;
		expect(m?.emissive.every((e) => e === 2)).toBe(true);
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/voxel/mesher.test.ts`
Expected: FAIL — `Cannot find module './mesher.ts'`.

- [ ] **Step 3: Реализация**

`src/engine/voxel/mesher.ts`:

```ts
import type { Vec3 } from '../types.ts';
import { CHUNK, KIND_SOLID, padIndex } from './constants.ts';
import type { PaletteLUT } from './palette.ts';

export interface MeshData {
	positions: Float32Array;
	normals: Float32Array;
	/** Линейный RGB. */
	colors: Float32Array;
	/** Яркость вершины 0..1 (ambient occlusion). */
	ao: Float32Array;
	emissive: Float32Array;
	indices: Uint32Array;
}

export interface ChunkMesh {
	opaque: MeshData | null;
	water: MeshData | null;
	glass: MeshData | null;
}

/** Яркость вершины по уровню AO (0 — сильнее всего закрыта соседями, 3 — открыта). */
export const AO_CURVE = [0.45, 0.65, 0.82, 1] as const;

class MeshBuilder {
	private readonly positions: number[] = [];
	private readonly normals: number[] = [];
	private readonly colors: number[] = [];
	private readonly ao: number[] = [];
	private readonly emissive: number[] = [];
	private readonly indices: number[] = [];
	private vertexCount = 0;

	pushQuad(corners: Vec3[], normal: Vec3, color: Vec3, emissive: number, ao: number[]): void {
		const base = this.vertexCount;
		for (let k = 0; k < 4; k++) {
			this.positions.push(corners[k][0], corners[k][1], corners[k][2]);
			this.normals.push(normal[0], normal[1], normal[2]);
			this.colors.push(color[0], color[1], color[2]);
			this.ao.push(ao[k]);
			this.emissive.push(emissive);
		}
		// Диагональ через более светлые вершины — иначе AO даёт заметную анизотропию.
		if (ao[0] + ao[2] < ao[1] + ao[3]) {
			this.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
		} else {
			this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
		}
		this.vertexCount += 4;
	}

	build(): MeshData | null {
		if (this.vertexCount === 0) return null;
		return {
			positions: new Float32Array(this.positions),
			normals: new Float32Array(this.normals),
			colors: new Float32Array(this.colors),
			ao: new Float32Array(this.ao),
			emissive: new Float32Array(this.emissive),
			indices: new Uint32Array(this.indices),
		};
	}
}

const vertexAO = (side1: number, side2: number, corner: number): number =>
	side1 && side2 ? 0 : 3 - (side1 + side2 + corner);

/**
 * Greedy meshing чанка 32³ с рамкой 34³.
 * Для каждой оси d и направления dir строим маску видимых граней слоя,
 * затем жадно сливаем одинаковые (материал + AO) клетки в прямоугольники.
 */
export function meshChunk(padded: Uint8Array, lut: PaletteLUT, origin: Vec3): ChunkMesh {
	const kinds = lut.kinds;
	const builders: Record<number, MeshBuilder> = {
		1: new MeshBuilder(),
		2: new MeshBuilder(),
		3: new MeshBuilder(),
	};
	const mask = new Int32Array(CHUNK * CHUNK);
	const p: Vec3 = [0, 0, 0];
	const q: Vec3 = [0, 0, 0];
	const t: Vec3 = [0, 0, 0];

	const solidAt = (u: number, v: number, du: number, dv: number): number => {
		t[0] = q[0];
		t[1] = q[1];
		t[2] = q[2];
		t[u] += du;
		t[v] += dv;
		return kinds[padded[padIndex(t[0], t[1], t[2])]] === KIND_SOLID ? 1 : 0;
	};

	for (let d = 0; d < 3; d++) {
		const u = (d + 1) % 3;
		const v = (d + 2) % 3;
		for (const dir of [1, -1]) {
			for (let i = 0; i < CHUNK; i++) {
				// 1. Маска видимых граней слоя i.
				for (let b = 0; b < CHUNK; b++) {
					for (let a = 0; a < CHUNK; a++) {
						p[d] = i;
						p[u] = a;
						p[v] = b;
						const A = padded[padIndex(p[0], p[1], p[2])];
						let key = 0;
						if (A !== 0) {
							q[0] = p[0];
							q[1] = p[1];
							q[2] = p[2];
							q[d] += dir;
							const B = padded[padIndex(q[0], q[1], q[2])];
							const visible = B === 0 || (kinds[B] !== KIND_SOLID && B !== A);
							if (visible) {
								const su0 = solidAt(u, v, -1, 0);
								const su1 = solidAt(u, v, 1, 0);
								const sv0 = solidAt(u, v, 0, -1);
								const sv1 = solidAt(u, v, 0, 1);
								const c0 = vertexAO(su0, sv0, solidAt(u, v, -1, -1));
								const c1 = vertexAO(su1, sv0, solidAt(u, v, 1, -1));
								const c2 = vertexAO(su1, sv1, solidAt(u, v, 1, 1));
								const c3 = vertexAO(su0, sv1, solidAt(u, v, -1, 1));
								key = A | ((c0 | (c1 << 2) | (c2 << 4) | (c3 << 6)) << 8);
							}
						}
						mask[a + b * CHUNK] = key;
					}
				}

				// 2. Жадное слияние прямоугольников.
				for (let b = 0; b < CHUNK; b++) {
					for (let a = 0; a < CHUNK; ) {
						const key = mask[a + b * CHUNK];
						if (key === 0) {
							a++;
							continue;
						}
						let w = 1;
						while (a + w < CHUNK && mask[a + w + b * CHUNK] === key) w++;
						let h = 1;
						grow: while (b + h < CHUNK) {
							for (let x = 0; x < w; x++) {
								if (mask[a + x + (b + h) * CHUNK] !== key) break grow;
							}
							h++;
						}

						const material = key & 255;
						const ao = key >> 8;
						const plane = i + (dir > 0 ? 1 : 0);
						const uv: Array<[number, number]> = [
							[a, b],
							[a + w, b],
							[a + w, b + h],
							[a, b + h],
						];
						const order = dir > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
						const corners: Vec3[] = [];
						const aoValues: number[] = [];
						for (const k of order) {
							const c: Vec3 = [origin[0], origin[1], origin[2]];
							c[d] += plane;
							c[u] += uv[k][0];
							c[v] += uv[k][1];
							corners.push(c);
							aoValues.push(AO_CURVE[(ao >> (2 * k)) & 3]);
						}
						const normal: Vec3 = [0, 0, 0];
						normal[d] = dir;
						const color: Vec3 = [
							lut.colors[material * 3],
							lut.colors[material * 3 + 1],
							lut.colors[material * 3 + 2],
						];
						builders[kinds[material]].pushQuad(
							corners,
							normal,
							color,
							lut.emissive[material],
							aoValues,
						);

						for (let y = 0; y < h; y++) {
							for (let x = 0; x < w; x++) mask[a + x + (b + y) * CHUNK] = 0;
						}
						a += w;
					}
				}
			}
		}
	}

	return { opaque: builders[1].build(), water: builders[2].build(), glass: builders[3].build() };
}

/** Буферы меша для передачи из воркера без копирования. */
export function meshTransferables(mesh: ChunkMesh): ArrayBuffer[] {
	const out: ArrayBuffer[] = [];
	for (const data of [mesh.opaque, mesh.water, mesh.glass]) {
		if (!data) continue;
		for (const arr of [data.positions, data.normals, data.colors, data.ao, data.emissive, data.indices]) {
			out.push(arr.buffer as ArrayBuffer);
		}
	}
	return out;
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/engine/voxel/mesher.test.ts`
Expected: PASS (10 тестов).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(engine): add greedy chunk mesher with per-vertex AO

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Пул воркеров мешинга

**Files:**
- Create: `src/engine/voxel/mesh.worker.ts`, `src/engine/voxel/mesher-pool.ts`
- Test: `src/engine/voxel/mesher-pool.test.ts`

**Interfaces:**
- Consumes: `meshChunk`, `meshTransferables`, `ChunkMesh` (Task 5), `PaletteLUT` (Task 3).
- Produces:
  - `type WorkerRequest = { type: 'init'; lut: PaletteLUT } | { type: 'mesh'; id: number; padded: Uint8Array; origin: Vec3 }`
  - `type WorkerResponse = { id: number; mesh: ChunkMesh } | { id: number; error: string }`
  - `defaultPoolSize(): number` (от 1 до 4), `createMeshWorker(): Worker`
  - `class MesherPool { constructor(lut, size = defaultPoolSize(), createWorker = createMeshWorker); mesh(padded: Uint8Array, origin: Vec3): Promise<ChunkMesh>; dispose(): void }`. `padded` передаётся (transfer) и после вызова становится пустым.

- [ ] **Step 1: Падающий тест**

`src/engine/voxel/mesher-pool.test.ts`:

```ts
import { afterEach, describe, expect, test } from 'bun:test';
import { PAD_VOLUME, padIndex } from './constants.ts';
import { MesherPool } from './mesher-pool.ts';
import { buildPaletteLUT } from './palette.ts';

const lut = buildPaletteLUT([{ color: '#ff0000', emissive: 0, kind: 'solid' }]);

function singleVoxel(): Uint8Array {
	const p = new Uint8Array(PAD_VOLUME);
	p[padIndex(0, 0, 0)] = 1;
	return p;
}

describe('MesherPool', () => {
	let pool: MesherPool | null = null;
	afterEach(() => pool?.dispose());

	test('мешит чанк в воркере', async () => {
		pool = new MesherPool(lut, 2);
		const mesh = await pool.mesh(singleVoxel(), [0, 0, 0]);
		expect(mesh.opaque?.indices.length).toBe(36);
	});

	test('выполняет много задач параллельно', async () => {
		pool = new MesherPool(lut, 2);
		const meshes = await Promise.all(
			Array.from({ length: 10 }, (_, i) => pool?.mesh(singleVoxel(), [i * 32, 0, 0])),
		);
		expect(meshes.every((m) => m?.opaque?.indices.length === 36)).toBe(true);
	});

	test('dispose отклоняет ожидающие задачи', async () => {
		pool = new MesherPool(lut, 1);
		const pending = pool.mesh(singleVoxel(), [0, 0, 0]);
		pool.dispose();
		await expect(pending).rejects.toThrow('уничтожен');
		await expect(pool.mesh(singleVoxel(), [0, 0, 0])).rejects.toThrow('уничтожен');
	});
});
```

- [ ] **Step 2: Тест падает**

Run: `bun test src/engine/voxel/mesher-pool.test.ts`
Expected: FAIL — `Cannot find module './mesher-pool.ts'`.

- [ ] **Step 3: Реализация**

`src/engine/voxel/mesh.worker.ts`:

```ts
import type { Vec3 } from '../types.ts';
import { type ChunkMesh, meshChunk, meshTransferables } from './mesher.ts';
import type { PaletteLUT } from './palette.ts';

export type WorkerRequest =
	| { type: 'init'; lut: PaletteLUT }
	| { type: 'mesh'; id: number; padded: Uint8Array; origin: Vec3 };

export type WorkerResponse = { id: number; mesh: ChunkMesh } | { id: number; error: string };

let lut: PaletteLUT | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const msg = event.data;
	if (msg.type === 'init') {
		lut = msg.lut;
		return;
	}
	try {
		if (!lut) throw new Error('mesh worker: палитра не инициализирована');
		const mesh = meshChunk(msg.padded, lut, msg.origin);
		const response: WorkerResponse = { id: msg.id, mesh };
		postMessage(response, { transfer: meshTransferables(mesh) });
	} catch (error) {
		const response: WorkerResponse = {
			id: msg.id,
			error: error instanceof Error ? error.message : String(error),
		};
		postMessage(response);
	}
};
```

`src/engine/voxel/mesher-pool.ts`:

```ts
import type { Vec3 } from '../types.ts';
import type { WorkerRequest, WorkerResponse } from './mesh.worker.ts';
import type { ChunkMesh } from './mesher.ts';
import type { PaletteLUT } from './palette.ts';

interface Job {
	id: number;
	padded: Uint8Array;
	origin: Vec3;
	resolve: (mesh: ChunkMesh) => void;
	reject: (error: Error) => void;
}

export function defaultPoolSize(): number {
	const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
	return Math.max(1, Math.min(4, cores - 1));
}

export function createMeshWorker(): Worker {
	return new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' });
}

/** Очередь задач мешинга поверх нескольких воркеров. */
export class MesherPool {
	private readonly workers: Worker[] = [];
	private readonly idle: Worker[] = [];
	private readonly queue: Job[] = [];
	private readonly active = new Map<number, { job: Job; worker: Worker }>();
	private nextId = 1;
	private disposed = false;

	constructor(lut: PaletteLUT, size = defaultPoolSize(), createWorker = createMeshWorker) {
		for (let i = 0; i < size; i++) {
			const worker = createWorker();
			worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.onResult(worker, event.data);
			worker.onerror = (event: ErrorEvent) => this.onCrash(worker, event);
			const init: WorkerRequest = { type: 'init', lut };
			worker.postMessage(init);
			this.workers.push(worker);
			this.idle.push(worker);
		}
	}

	mesh(padded: Uint8Array, origin: Vec3): Promise<ChunkMesh> {
		if (this.disposed) return Promise.reject(new Error('MesherPool уничтожен'));
		return new Promise((resolve, reject) => {
			this.queue.push({ id: this.nextId++, padded, origin, resolve, reject });
			this.pump();
		});
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const worker of this.workers) worker.terminate();
		const error = new Error('MesherPool уничтожен');
		for (const job of this.queue) job.reject(error);
		for (const { job } of this.active.values()) job.reject(error);
		this.queue.length = 0;
		this.active.clear();
	}

	private pump(): void {
		while (!this.disposed && this.idle.length > 0 && this.queue.length > 0) {
			const worker = this.idle.pop() as Worker;
			const job = this.queue.shift() as Job;
			this.active.set(job.id, { job, worker });
			const request: WorkerRequest = {
				type: 'mesh',
				id: job.id,
				padded: job.padded,
				origin: job.origin,
			};
			worker.postMessage(request, [job.padded.buffer as ArrayBuffer]);
		}
	}

	private onResult(worker: Worker, response: WorkerResponse): void {
		const entry = this.active.get(response.id);
		if (!entry) return;
		this.active.delete(response.id);
		this.idle.push(worker);
		if ('error' in response) entry.job.reject(new Error(response.error));
		else entry.job.resolve(response.mesh);
		this.pump();
	}

	private onCrash(worker: Worker, event: ErrorEvent): void {
		for (const [id, entry] of this.active) {
			if (entry.worker !== worker) continue;
			this.active.delete(id);
			entry.job.reject(new Error(`mesh worker упал: ${event.message}`));
		}
		this.idle.push(worker);
		this.pump();
	}
}
```

- [ ] **Step 4: Тест проходит**

Run: `bun test src/engine/voxel/mesher-pool.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(engine): add mesh worker pool

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Материалы SDK, примитивы рисования и модели

**Files:**
- Create: `src/sdk/materials.ts`, `src/sdk/builder/canvas.ts`, `src/sdk/builder/model.ts`
- Test: `src/sdk/builder/model.test.ts`

**Interfaces:**
- Consumes: `Material`, `MaterialKind`, `Vec3` (Task 3), `MAX_MATERIALS` (Task 3).
- Produces:
  - `type MaterialInput = string | { color: string; emissive?: number; kind?: MaterialKind }`
  - `HEX_COLOR: RegExp`, `AIR = 'air'`, `normalizeMaterial(input: MaterialInput): Material`, `materialSignature(name: string, m: Material): string`
  - `abstract class VoxelCanvas { set(p, mat); box(a, b, mat); sphere(center, radius, mat); cylinder(base, radius, height, mat); line(a, b, mat); clear(a, b) }`: углы `box` включительно и в любом порядке, `mat === 'air'` вырезает воксели, запись за границами молча игнорируется.
  - `interface Model { readonly size: Vec3; readonly data: Uint8Array; readonly materials: ReadonlyArray<{ name: string; material: Material }> }`: локальный индекс `i` соответствует `materials[i - 1]`.
  - `interface ModelOptions { size: Vec3; palette: Record<string, MaterialInput> }`
  - `class ModelBuilder extends VoxelCanvas { readonly size; get(p: Vec3): string | null; toModel(): Model }`
  - `model(options: ModelOptions, draw: (m: ModelBuilder) => void): Model`
  - `modelIndex(size: Vec3, x, y, z): number`

- [ ] **Step 1: Падающие тесты**

`src/sdk/builder/model.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { normalizeMaterial } from '../materials.ts';
import { type Model, model, modelIndex } from './model.ts';

const count = (m: Model): number => m.data.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
const palette = { stone: '#888888', wood: '#6b4a2b' };

describe('примитивы на ModelBuilder', () => {
	test('box включает оба угла и не зависит от их порядка', () => {
		const a = model({ size: [10, 10, 10], palette }, (m) => m.box([1, 1, 1], [2, 3, 4], 'stone'));
		const b = model({ size: [10, 10, 10], palette }, (m) => m.box([2, 3, 4], [1, 1, 1], 'stone'));
		expect(count(a)).toBe(2 * 3 * 4);
		expect(a.data).toEqual(b.data);
	});

	test('sphere радиуса 2 — 33 вокселя', () => {
		const m = model({ size: [9, 9, 9], palette }, (b) => b.sphere([4, 4, 4], 2, 'stone'));
		expect(count(m)).toBe(33);
	});

	test('cylinder радиуса 1 и высоты 3 — 15 вокселей', () => {
		const m = model({ size: [5, 5, 5], palette }, (b) => b.cylinder([2, 0, 2], 1, 3, 'stone'));
		expect(count(m)).toBe(15);
	});

	test('line по диагонали без дыр', () => {
		const m = model({ size: [5, 5, 5], palette }, (b) => b.line([0, 0, 0], [3, 3, 0], 'stone'));
		expect(count(m)).toBe(4);
	});

	test("'air' вырезает, clear очищает", () => {
		const m = model({ size: [5, 5, 5], palette }, (b) => {
			b.box([0, 0, 0], [4, 4, 4], 'stone');
			b.set([2, 2, 2], 'air');
			b.clear([0, 0, 0], [4, 0, 4]);
		});
		expect(count(m)).toBe(125 - 1 - 25);
	});

	test('за границами — молча обрезается', () => {
		const m = model({ size: [4, 4, 4], palette }, (b) => b.box([-3, -3, -3], [10, 0, 10], 'stone'));
		expect(count(m)).toBe(16);
	});

	test('дробные координаты округляются вниз', () => {
		const m = model({ size: [4, 4, 4], palette }, (b) => {
			b.set([1.7, 0.2, 2.9], 'wood');
			expect(b.get([1, 0, 2])).toBe('wood');
		});
		expect(m.data[modelIndex(m.size, 1, 0, 2)]).toBe(2);
	});

	test('неизвестный материал — ошибка со списком доступных', () => {
		expect(() => model({ size: [4, 4, 4], palette }, (b) => b.set([0, 0, 0], 'gold'))).toThrow(
			'неизвестный материал "gold". Доступны: stone, wood',
		);
	});

	test('materials модели нормализованы и упорядочены как палитра', () => {
		const m = model({ size: [1, 1, 1], palette: { glow: { color: '#FFD27A', emissive: 1 } } }, () => {});
		expect(m.materials).toEqual([{ name: 'glow', material: { color: '#ffd27a', emissive: 1, kind: 'solid' } }]);
	});
});

describe('normalizeMaterial', () => {
	test('строка → solid без свечения', () => {
		expect(normalizeMaterial('#AABBCC')).toEqual({ color: '#aabbcc', emissive: 0, kind: 'solid' });
	});

	test('неверный цвет → ошибка', () => {
		expect(() => normalizeMaterial('red')).toThrow('#rrggbb');
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk/builder`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Реализация**

`src/sdk/materials.ts`:

```ts
import type { Material, MaterialKind } from '../engine/types.ts';

export type MaterialInput = string | { color: string; emissive?: number; kind?: MaterialKind };

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Зарезервированное имя: запись 'air' стирает воксели. */
export const AIR = 'air';

export function normalizeMaterial(input: MaterialInput): Material {
	const m = typeof input === 'string' ? { color: input } : input;
	if (!HEX_COLOR.test(m.color)) {
		throw new Error(`неверный цвет "${m.color}" — ожидается #rrggbb`);
	}
	return { color: m.color.toLowerCase(), emissive: m.emissive ?? 0, kind: m.kind ?? 'solid' };
}

/** Ключ для дедупликации материалов префабов: одинаковое имя + одинаковые свойства. */
export function materialSignature(name: string, m: Material): string {
	return `${name}|${m.color}|${m.kind}|${m.emissive}`;
}
```

`src/sdk/builder/canvas.ts`:

```ts
import type { Vec3 } from '../../engine/types.ts';
import { AIR } from '../materials.ts';

const sorted = (a: number, b: number): [number, number] => {
	const x = Math.floor(a);
	const y = Math.floor(b);
	return x <= y ? [x, y] : [y, x];
};

/**
 * Общие примитивы для мира и моделей. Координаты целые (дробные округляются вниз), Y вверх.
 * Запись за границами молча игнорируется — наследник может её посчитать.
 */
export abstract class VoxelCanvas {
	/** Записать индекс материала (0 — пустота). */
	protected abstract write(x: number, y: number, z: number, index: number): void;
	/** Имя материала → индекс. 'air' → 0. Неизвестное имя — исключение. */
	protected abstract resolve(material: string): number;

	set(p: Vec3, material: string): void {
		this.write(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), this.resolve(material));
	}

	/** Параллелепипед, оба угла включительно. */
	box(a: Vec3, b: Vec3, material: string): void {
		const id = this.resolve(material);
		const [x0, x1] = sorted(a[0], b[0]);
		const [y0, y1] = sorted(a[1], b[1]);
		const [z0, z1] = sorted(a[2], b[2]);
		for (let z = z0; z <= z1; z++)
			for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.write(x, y, z, id);
	}

	/** Все воксели, чей центр не дальше radius от center. */
	sphere(center: Vec3, radius: number, material: string): void {
		const id = this.resolve(material);
		const [cx, cy, cz] = center;
		const r2 = radius * radius;
		for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
			for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
				for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
					if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r2) this.write(x, y, z, id);
				}
			}
		}
	}

	/** Вертикальный цилиндр: base — центр нижнего слоя. */
	cylinder(base: Vec3, radius: number, height: number, material: string): void {
		const id = this.resolve(material);
		const [cx, by, cz] = base;
		const r2 = radius * radius;
		for (let y = Math.floor(by); y < Math.floor(by) + height; y++) {
			for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
				for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
					if ((x - cx) ** 2 + (z - cz) ** 2 <= r2) this.write(x, y, z, id);
				}
			}
		}
	}

	/** Отрезок без разрывов. */
	line(a: Vec3, b: Vec3, material: string): void {
		const id = this.resolve(material);
		const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
		for (let i = 0; i <= steps; i++) {
			const t = steps === 0 ? 0 : i / steps;
			this.write(
				Math.round(a[0] + (b[0] - a[0]) * t),
				Math.round(a[1] + (b[1] - a[1]) * t),
				Math.round(a[2] + (b[2] - a[2]) * t),
				id,
			);
		}
	}

	clear(a: Vec3, b: Vec3): void {
		this.box(a, b, AIR);
	}
}
```

`src/sdk/builder/model.ts`:

```ts
import type { Material, Vec3 } from '../../engine/types.ts';
import { MAX_MATERIALS } from '../../engine/voxel/constants.ts';
import { AIR, type MaterialInput, normalizeMaterial } from '../materials.ts';
import { VoxelCanvas } from './canvas.ts';

/** Маленькая воксельная сетка со своей палитрой (префаб, мебель, персонаж…). */
export interface Model {
	readonly size: Vec3;
	/** Локальный индекс i → materials[i - 1]; 0 — пустота. */
	readonly data: Uint8Array;
	readonly materials: ReadonlyArray<{ name: string; material: Material }>;
}

export interface ModelOptions {
	size: Vec3;
	palette: Record<string, MaterialInput>;
}

export const modelIndex = (size: Vec3, x: number, y: number, z: number): number =>
	x + size[0] * (y + size[1] * z);

export class ModelBuilder extends VoxelCanvas {
	readonly size: Vec3;
	private readonly data: Uint8Array;
	private readonly names: string[];
	private readonly materials: Material[];

	constructor(options: ModelOptions) {
		super();
		for (const s of options.size) {
			if (!Number.isInteger(s) || s < 1 || s > 256) {
				throw new Error(`размер модели должен быть целым 1..256, получено [${options.size.join(', ')}]`);
			}
		}
		this.size = [options.size[0], options.size[1], options.size[2]];
		this.data = new Uint8Array(this.size[0] * this.size[1] * this.size[2]);
		this.names = Object.keys(options.palette);
		if (this.names.length > MAX_MATERIALS) throw new Error('модель: больше 255 материалов');
		this.materials = this.names.map((name) => normalizeMaterial(options.palette[name]));
	}

	protected write(x: number, y: number, z: number, index: number): void {
		const [sx, sy, sz] = this.size;
		if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return;
		this.data[modelIndex(this.size, x, y, z)] = index;
	}

	protected resolve(material: string): number {
		if (material === AIR) return 0;
		const i = this.names.indexOf(material);
		if (i < 0) {
			throw new Error(
				`модель: неизвестный материал "${material}". Доступны: ${this.names.join(', ')}`,
			);
		}
		return i + 1;
	}

	get(p: Vec3): string | null {
		const [x, y, z] = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])];
		const [sx, sy, sz] = this.size;
		if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return null;
		const id = this.data[modelIndex(this.size, x, y, z)];
		return id === 0 ? null : (this.names[id - 1] ?? null);
	}

	toModel(): Model {
		return {
			size: this.size,
			data: this.data,
			materials: this.names.map((name, i) => ({ name, material: this.materials[i] })),
		};
	}
}

export function model(options: ModelOptions, draw: (m: ModelBuilder) => void): Model {
	const builder = new ModelBuilder(options);
	draw(builder);
	return builder.toModel();
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/sdk/builder`
Expected: PASS (11 тестов).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(sdk): add drawing primitives and voxel models

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: WorldBuilder (рельеф, вода, установка и расстановка)

**Files:**
- Create: `src/sdk/builder/world-builder.ts`
- Test: `src/sdk/builder/world-builder.test.ts`

**Interfaces:**
- Consumes: `VoxelCanvas`, `Model`, `model`, `modelIndex` (Task 7), `normalizeMaterial`, `materialSignature`, `AIR` (Task 7), `VoxelWorld`, `MAX_MATERIALS` (Task 3), `createRng`, `Rng`, `createNoise2D`, `Noise2D` (Task 2).
- Produces:
  - `type Rotation = 0 | 90 | 180 | 270`, `type TerrainNoise = 'flat' | 'hills' | 'mountains'`
  - `interface TerrainOptions { noise?: TerrainNoise; base?: number; amp?: number; scale?: number; top: string; fill: string }`
  - `interface WaterOptions { level: number; material?: string }`
  - `interface PlaceOptions { rotate?: Rotation }`
  - `type ModelSource = Model | ((options: { rng: Rng }) => Model)`
  - `interface ScatterOptions { count: number; on?: string | string[]; minDistance?: number; area?: [number, number, number, number] }` (`area = [x0, z0, x1, z1]` включительно)
  - `DEFAULT_WATER: Material`
  - `class WorldBuilder extends VoxelCanvas { readonly world: VoxelWorld; readonly size: Vec3; readonly rng: Rng; readonly noise: Noise2D; outOfBounds: number; constructor(size: Vec3, palette: Record<string, Material>, seed: number); get materialList(): readonly Material[]; get materialNames(): readonly string[]; get(p: Vec3): string | null; heightAt(x, z): number; terrain(o); water(o); place(model, at, o?); scatter(source, o): number }`
  - Семантика: `heightAt` — y самого верхнего `solid`-вокселя колонки или `-1`. `place(model, at)`: `at` — **нижний центр** модели. Палитра диорамы переопределяет одноимённый материал префаба. Одинаковые по имени, но разные по свойствам материалы префабов становятся разными материалами.

- [ ] **Step 1: Падающие тесты**

`src/sdk/builder/world-builder.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { normalizeMaterial } from '../materials.ts';
import { model } from './model.ts';
import { DEFAULT_WATER, WorldBuilder } from './world-builder.ts';

const palette = {
	grass: normalizeMaterial('#6aa84f'),
	dirt: normalizeMaterial('#7a5a3a'),
	sand: normalizeMaterial('#d9c48a'),
};

const flatWorld = (size: [number, number, number] = [32, 16, 32], seed = 1) => {
	const w = new WorldBuilder(size, palette, seed);
	w.terrain({ noise: 'flat', base: 2, top: 'grass', fill: 'dirt' });
	return w;
};

describe('WorldBuilder: материалы', () => {
	test('неизвестный материал — ошибка с именем и палитрой', () => {
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		expect(() => w.box([0, 0, 0], [1, 1, 1], 'lava')).toThrow(
			'неизвестный материал "lava". В палитре: grass, dirt, sand',
		);
	});

	test('запись за границами считается, но не падает', () => {
		const w = new WorldBuilder([4, 4, 4], palette, 1);
		w.box([-2, 0, 0], [5, 0, 0], 'grass');
		expect(w.outOfBounds).toBe(4);
		expect(w.world.countVoxels()).toBe(4);
	});
});

describe('WorldBuilder: рельеф и вода', () => {
	test('flat: ровная поверхность top поверх fill', () => {
		const w = flatWorld([8, 8, 8]);
		for (let x = 0; x < 8; x++) {
			for (let z = 0; z < 8; z++) {
				expect(w.heightAt(x, z)).toBe(2);
				expect(w.get([x, 2, z])).toBe('grass');
				expect(w.get([x, 1, z])).toBe('dirt');
				expect(w.get([x, 3, z])).toBeNull();
			}
		}
	});

	test('hills: высота меняется, остаётся в границах и детерминирована', () => {
		const make = () => {
			const w = new WorldBuilder([64, 32, 64], palette, 5);
			w.terrain({ noise: 'hills', base: 12, amp: 10, top: 'grass', fill: 'dirt' });
			return w;
		};
		const a = make();
		const b = make();
		const heights = new Set<number>();
		for (let x = 0; x < 64; x += 3) {
			for (let z = 0; z < 64; z += 3) {
				const h = a.heightAt(x, z);
				expect(h).toBe(b.heightAt(x, z));
				expect(h >= 0 && h < 32).toBe(true);
				heights.add(h);
			}
		}
		expect(heights.size).toBeGreaterThan(3);
	});

	test('water заполняет только пустоту ниже уровня; heightAt игнорирует воду', () => {
		const w = flatWorld([8, 12, 8]);
		w.water({ level: 5 });
		expect(w.get([3, 2, 3])).toBe('grass');
		expect(w.get([3, 5, 3])).toBe('water');
		expect(w.get([3, 6, 3])).toBeNull();
		expect(w.heightAt(3, 3)).toBe(2);
		expect(w.materialList.at(-1)).toEqual(DEFAULT_WATER);
	});
});

describe('WorldBuilder: place', () => {
	const box3x2x1 = model({ size: [3, 2, 1], palette: { wood: '#6b4a2b' } }, (m) =>
		m.box([0, 0, 0], [2, 1, 0], 'wood'),
	);

	test('at — нижний центр модели', () => {
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		w.place(box3x2x1, [10, 5, 10]);
		expect(w.get([9, 5, 10])).toBe('wood');
		expect(w.get([11, 6, 10])).toBe('wood');
		expect(w.get([12, 5, 10])).toBeNull();
		expect(w.get([10, 4, 10])).toBeNull();
	});

	test('rotate 90 поворачивает вокруг Y', () => {
		const marked = model({ size: [3, 1, 1], palette: { a: '#ff0000', b: '#0000ff' } }, (m) => {
			m.set([0, 0, 0], 'a');
			m.box([1, 0, 0], [2, 0, 0], 'b');
		});
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		w.place(marked, [10, 0, 10], { rotate: 90 });
		expect(w.get([10, 0, 9])).toBe('a');
		expect(w.get([10, 0, 10])).toBe('b');
		expect(w.get([10, 0, 11])).toBe('b');
	});

	test('палитра диорамы переопределяет материал префаба с тем же именем', () => {
		const red = model({ size: [1, 1, 1], palette: { grass: '#ff0000' } }, (m) =>
			m.set([0, 0, 0], 'grass'),
		);
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		w.place(red, [4, 0, 4]);
		expect(w.get([4, 0, 4])).toBe('grass');
		expect(w.materialList.length).toBe(3);
	});

	test('одноимённые материалы с разными цветами — разные материалы', () => {
		const roof = (color: string) =>
			model({ size: [1, 1, 1], palette: { roof: color } }, (m) => m.set([0, 0, 0], 'roof'));
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		w.place(roof('#aa0000'), [1, 0, 1]);
		w.place(roof('#0000aa'), [3, 0, 3]);
		w.place(roof('#aa0000'), [5, 0, 5]);
		expect(w.materialList.length).toBe(5);
	});

	test('больше 255 материалов — понятная ошибка', () => {
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		expect(() => {
			for (let i = 0; i < 300; i++) {
				const color = `#${i.toString(16).padStart(6, '0')}`;
				w.place(
					model({ size: [1, 1, 1], palette: { c: color } }, (m) => m.set([0, 0, 0], 'c')),
					[0, 0, 0],
				);
			}
		}).toThrow('слишком много материалов');
	});
});

describe('WorldBuilder: scatter', () => {
	const pole = model({ size: [1, 3, 1], palette: { wood: '#6b4a2b' } }, (m) =>
		m.box([0, 0, 0], [0, 2, 0], 'wood'),
	);

	test('ставит нужное число объектов на нужный материал с минимальной дистанцией', () => {
		const w = flatWorld();
		const placed = w.scatter(pole, { count: 5, on: 'grass', minDistance: 4 });
		expect(placed).toBe(5);
		const spots: Array<[number, number]> = [];
		for (let x = 0; x < 32; x++)
			for (let z = 0; z < 32; z++) if (w.get([x, 3, z]) === 'wood') spots.push([x, z]);
		expect(spots.length).toBe(5);
		for (const [ax, az] of spots)
			for (const [bx, bz] of spots)
				if (ax !== bx || az !== bz) expect((ax - bx) ** 2 + (az - bz) ** 2).toBeGreaterThanOrEqual(16);
	});

	test('детерминирован по seed', () => {
		const snapshot = (w: WorldBuilder) => {
			const out: string[] = [];
			for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) if (w.get([x, 3, z])) out.push(`${x},${z}`);
			return out;
		};
		const a = flatWorld([32, 16, 32], 9);
		const b = flatWorld([32, 16, 32], 9);
		a.scatter(pole, { count: 6, on: 'grass' });
		b.scatter(pole, { count: 6, on: 'grass' });
		expect(snapshot(a)).toEqual(snapshot(b));
	});

	test('нет подходящей поверхности — 0 объектов', () => {
		expect(flatWorld().scatter(pole, { count: 5, on: 'sand' })).toBe(0);
	});

	test('неизвестный материал в on — ошибка', () => {
		expect(() => flatWorld().scatter(pole, { count: 5, on: 'snow' })).toThrow('"snow"');
	});

	test('фабрика получает rng', () => {
		const w = flatWorld();
		let calls = 0;
		w.scatter(
			({ rng }) => {
				calls++;
				expect(typeof rng.next()).toBe('number');
				return pole;
			},
			{ count: 3, on: 'grass' },
		);
		expect(calls).toBe(3);
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk/builder/world-builder.test.ts`
Expected: FAIL — `Cannot find module './world-builder.ts'`.

- [ ] **Step 3: Реализация**

`src/sdk/builder/world-builder.ts`:

```ts
import type { Material, Vec3 } from '../../engine/types.ts';
import { MAX_MATERIALS } from '../../engine/voxel/constants.ts';
import { VoxelWorld } from '../../engine/voxel/world.ts';
import { AIR, materialSignature } from '../materials.ts';
import { type Noise2D, createNoise2D } from '../noise.ts';
import { type Rng, createRng } from '../rng.ts';
import { VoxelCanvas } from './canvas.ts';
import { type Model, modelIndex } from './model.ts';

export type Rotation = 0 | 90 | 180 | 270;
export type TerrainNoise = 'flat' | 'hills' | 'mountains';

export interface TerrainOptions {
	noise?: TerrainNoise;
	/** Средняя высота поверхности. По умолчанию — четверть высоты мира. */
	base?: number;
	/** Размах высот вокруг base. */
	amp?: number;
	/** Частота шума: меньше — шире холмы. */
	scale?: number;
	top: string;
	fill: string;
}

export interface WaterOptions {
	/** Вода заполняет пустоту на y ≤ level. */
	level: number;
	material?: string;
}

export interface PlaceOptions {
	rotate?: Rotation;
}

export type ModelSource = Model | ((options: { rng: Rng }) => Model);

export interface ScatterOptions {
	count: number;
	/** Материал(ы) поверхности, на которую можно ставить. */
	on?: string | string[];
	minDistance?: number;
	/** [x0, z0, x1, z1] включительно. По умолчанию — весь мир. */
	area?: [number, number, number, number];
}

const TERRAIN_PRESETS: Record<TerrainNoise, { amp: number; scale: number; octaves: number }> = {
	flat: { amp: 0, scale: 1, octaves: 1 },
	hills: { amp: 10, scale: 1 / 40, octaves: 4 },
	mountains: { amp: 28, scale: 1 / 64, octaves: 5 },
};

export const DEFAULT_WATER: Material = { color: '#3a7bd5', emissive: 0, kind: 'water' };

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** Строитель мира диорамы — объект `w` в `build(w)`. */
export class WorldBuilder extends VoxelCanvas {
	readonly world: VoxelWorld;
	readonly size: Vec3;
	readonly rng: Rng;
	readonly noise: Noise2D;
	/** Сколько записей отброшено из-за выхода за границы мира. */
	outOfBounds = 0;

	private readonly materials: Material[] = [];
	private readonly names: string[] = [];
	private readonly byName = new Map<string, number>();
	private readonly bySignature = new Map<string, number>();
	private readonly paletteNames: ReadonlySet<string>;

	constructor(size: Vec3, palette: Record<string, Material>, seed: number) {
		super();
		this.size = [size[0], size[1], size[2]];
		this.world = new VoxelWorld(this.size);
		this.rng = createRng(seed);
		this.noise = createNoise2D(seed ^ 0x5bd1e995);
		for (const [name, material] of Object.entries(palette)) {
			this.byName.set(name, this.push(name, material));
		}
		this.paletteNames = new Set(Object.keys(palette));
	}

	/** Материалы в порядке индексов: материал i хранится как i + 1. */
	get materialList(): readonly Material[] {
		return this.materials;
	}

	get materialNames(): readonly string[] {
		return this.names;
	}

	protected write(x: number, y: number, z: number, index: number): void {
		if (!this.world.set(x, y, z, index)) this.outOfBounds++;
	}

	protected resolve(material: string): number {
		if (material === AIR) return 0;
		const id = this.byName.get(material);
		if (id === undefined) {
			const known = [...this.paletteNames].join(', ') || '(пусто)';
			throw new Error(`неизвестный материал "${material}". В палитре: ${known}`);
		}
		return id;
	}

	private push(name: string, material: Material): number {
		if (this.materials.length >= MAX_MATERIALS) {
			throw new Error(
				`слишком много материалов (максимум ${MAX_MATERIALS}) — сократите палитру или число вариантов префабов`,
			);
		}
		this.materials.push(material);
		this.names.push(name);
		return this.materials.length;
	}

	/** Палитра диорамы переопределяет одноимённый материал префаба; остальные дедуплицируются. */
	private resolveModelMaterial(name: string, material: Material): number {
		if (this.paletteNames.has(name)) return this.resolve(name);
		const signature = materialSignature(name, material);
		const known = this.bySignature.get(signature);
		if (known !== undefined) return known;
		const id = this.push(name, material);
		this.bySignature.set(signature, id);
		return id;
	}

	/** Имя материала в точке; null — пустота или вне мира. */
	get(p: Vec3): string | null {
		const id = this.world.get(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]));
		return id === 0 ? null : (this.names[id - 1] ?? null);
	}

	/** y самого верхнего твёрдого (kind 'solid') вокселя в колонке или -1. */
	heightAt(x: number, z: number): number {
		const cx = Math.floor(x);
		const cz = Math.floor(z);
		for (let y = this.size[1] - 1; y >= 0; y--) {
			const id = this.world.get(cx, y, cz);
			if (id !== 0 && this.materials[id - 1]?.kind === 'solid') return y;
		}
		return -1;
	}

	terrain(options: TerrainOptions): void {
		const noiseKind = options.noise ?? 'hills';
		const preset = TERRAIN_PRESETS[noiseKind];
		const amp = options.amp ?? preset.amp;
		const scale = options.scale ?? preset.scale;
		const base = options.base ?? Math.floor(this.size[1] * 0.25);
		const top = this.resolve(options.top);
		const fill = this.resolve(options.fill);
		const [sx, sy, sz] = this.size;
		for (let x = 0; x < sx; x++) {
			for (let z = 0; z < sz; z++) {
				const n = this.noise.fbm(x * scale, z * scale, preset.octaves);
				const h = Math.max(0, Math.min(sy - 1, Math.round(base + amp * (n - 0.5) * 2)));
				for (let y = 0; y < h; y++) this.write(x, y, z, fill);
				this.write(x, h, z, top);
			}
		}
	}

	water(options: WaterOptions): void {
		const name = options.material ?? 'water';
		let id = this.byName.get(name);
		if (id === undefined) {
			if (name !== 'water') id = this.resolve(name);
			else {
				id = this.push('water', DEFAULT_WATER);
				this.byName.set('water', id);
			}
		}
		const [sx, sy, sz] = this.size;
		const level = Math.min(Math.floor(options.level), sy - 1);
		for (let x = 0; x < sx; x++)
			for (let z = 0; z < sz; z++)
				for (let y = 0; y <= level; y++) if (this.world.get(x, y, z) === 0) this.world.set(x, y, z, id);
	}

	/** Ставит модель так, что `at` — её нижний центр. Пустота модели не стирает мир. */
	place(source: Model, at: Vec3, options: PlaceOptions = {}): void {
		const rotate = options.rotate ?? 0;
		const [sx, sy, sz] = source.size;
		const ids = source.materials.map(({ name, material }) => this.resolveModelMaterial(name, material));
		const sideways = rotate === 90 || rotate === 270;
		const footX = sideways ? sz : sx;
		const footZ = sideways ? sx : sz;
		const ox = Math.floor(at[0]) - Math.floor(footX / 2);
		const oy = Math.floor(at[1]);
		const oz = Math.floor(at[2]) - Math.floor(footZ / 2);
		for (let z = 0; z < sz; z++) {
			for (let y = 0; y < sy; y++) {
				for (let x = 0; x < sx; x++) {
					const local = source.data[modelIndex(source.size, x, y, z)];
					if (local === 0) continue;
					let rx: number;
					let rz: number;
					switch (rotate) {
						case 0:
							rx = x;
							rz = z;
							break;
						case 90:
							rx = sz - 1 - z;
							rz = x;
							break;
						case 180:
							rx = sx - 1 - x;
							rz = sz - 1 - z;
							break;
						case 270:
							rx = z;
							rz = sx - 1 - x;
							break;
						default:
							throw new Error(`rotate должен быть 0, 90, 180 или 270, получено ${rotate}`);
					}
					this.write(ox + rx, oy + y, oz + rz, ids[local - 1]);
				}
			}
		}
	}

	/** Случайно расставляет модели по поверхности. Возвращает число поставленных. */
	scatter(source: ModelSource, options: ScatterOptions): number {
		const { count, minDistance = 0 } = options;
		const on =
			options.on === undefined
				? null
				: new Set(Array.isArray(options.on) ? options.on : [options.on]);
		for (const name of on ?? []) this.resolve(name);
		const [x0, z0, x1, z1] = options.area ?? [0, 0, this.size[0] - 1, this.size[2] - 1];
		const min2 = minDistance * minDistance;
		const placed: Array<[number, number]> = [];
		let attempts = count * 30;
		while (placed.length < count && attempts > 0) {
			attempts--;
			const x = this.rng.int(x0, x1);
			const z = this.rng.int(z0, z1);
			const h = this.heightAt(x, z);
			if (h < 0 || h + 1 >= this.size[1]) continue;
			if (on && !on.has(this.get([x, h, z]) ?? '')) continue;
			if (this.world.get(x, h + 1, z) !== 0) continue;
			if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < min2)) continue;
			const m = typeof source === 'function' ? source({ rng: this.rng.fork() }) : source;
			this.place(m, [x, h + 1, z], { rotate: this.rng.pick(ROTATIONS) });
			placed.push([x, z]);
		}
		return placed.length;
	}
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/sdk/builder`
Expected: PASS (все тесты builder: 11 из Task 7 + 15 новых).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(sdk): add WorldBuilder with terrain, water, place and scatter

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Схема диорамы, запекание и публичное API SDK

**Files:**
- Create: `src/sdk/schema.ts`, `src/sdk/bake.ts`, `src/sdk/index.ts`
- Test: `src/sdk/schema.test.ts`, `src/sdk/bake.test.ts`

**Interfaces:**
- Consumes: `WorldBuilder` (Task 8), `normalizeMaterial`, `HEX_COLOR`, `AIR` (Task 7), `encodeVxb`, `VoxelWorld` (Task 3–4), `SceneConfig`, `Material`, `Vec3` (Task 3), `MAX_MATERIALS`, `SLUG_RE`, `slugFromDioramaPath` (Task 2).
- Produces:
  - `dioramaSchema` (zod), `type DioramaInput`, `type Diorama`
  - `class DioramaValidationError extends Error`
  - `defineDiorama(input: DioramaInput): Diorama`: бросает `DioramaValidationError`
  - `toSceneConfig(d: Diorama): SceneConfig`
  - `interface BakeStats { voxels; chunks; materials; unusedPalette: string[]; outOfBounds }`, `interface BakeResult { world: VoxelWorld; materials: Material[]; stats: BakeStats }`
  - `bakeDiorama(d: Diorama): BakeResult`, `bakeToVxb(d): Promise<{ bytes: Uint8Array; stats: BakeStats & { bytes: number } }>`, `bakeWarnings(stats: BakeStats & { bytes: number }): string[]`
  - `SIZE_WARN_BYTES = 2 MiB`, `SIZE_LIMIT_BYTES = 8 MiB`
  - `src/sdk/index.ts` реэкспортирует всё перечисленное, а также `model`, `ModelBuilder`, `WorldBuilder`, `SLUG_RE`, `slugFromDioramaPath` и типы. `prefabs` добавляется в Task 10.

- [ ] **Step 1: Падающие тесты**

`src/sdk/schema.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { type DioramaInput, DioramaValidationError, defineDiorama, toSceneConfig } from './schema.ts';

const minimal = (): DioramaInput => ({
	meta: { title: 'Тест', createdAt: '2026-10-06' },
	size: [64, 32, 48],
	palette: { grass: '#6aa84f' },
	build() {},
});

describe('defineDiorama', () => {
	test('заполняет значения по умолчанию', () => {
		const d = defineDiorama(minimal());
		expect(d.seed).toBe(1);
		expect(d.base).toBe('none');
		expect(d.meta.tags).toEqual([]);
		expect(d.meta.description).toBe('');
		expect(d.atmosphere).toEqual({ time: { fixed: 'day' }, fog: 0 });
		expect(d.camera.autoRotate).toBe(true);
		expect(d.palette.grass).toEqual({ color: '#6aa84f', emissive: 0, kind: 'solid' });
	});

	test('неверный цвет — DioramaValidationError с путём и названием', () => {
		const input = { ...minimal(), palette: { grass: 'green' } };
		expect(() => defineDiorama(input)).toThrow(DioramaValidationError);
		expect(() => defineDiorama(input)).toThrow('Тест');
		expect(() => defineDiorama(input)).toThrow('palette');
	});

	test("'air' нельзя объявить в палитре", () => {
		expect(() => defineDiorama({ ...minimal(), palette: { air: '#ffffff' } })).toThrow('зарезервирован');
	});

	test('поля будущих этапов отвергаются (strict)', () => {
		const input = { ...minimal(), entities: [] } as unknown as DioramaInput;
		expect(() => defineDiorama(input)).toThrow('entities');
	});

	test('несуществующая дата отвергается', () => {
		expect(() => defineDiorama({ ...minimal(), meta: { title: 'X', createdAt: '2026-13-45' } })).toThrow(
			DioramaValidationError,
		);
	});

	test('размер мира — целые 1..1024', () => {
		expect(() => defineDiorama({ ...minimal(), size: [0, 10, 10] })).toThrow(DioramaValidationError);
		expect(() => defineDiorama({ ...minimal(), size: [10.5, 10, 10] })).toThrow(DioramaValidationError);
	});
});

describe('toSceneConfig', () => {
	test('камера по умолчанию смотрит в центр мира', () => {
		const scene = toSceneConfig(defineDiorama(minimal()));
		expect(scene.camera.target).toEqual([32, 6.4, 24]);
		expect(scene.camera.position[1]).toBeGreaterThan(scene.camera.target[1]);
		expect(scene.camera.maxDistance).toBeGreaterThan(scene.camera.minDistance);
		expect(scene.time).toBe('day');
		expect(scene.base).toBe('none');
	});

	test('явные параметры камеры сохраняются', () => {
		const scene = toSceneConfig(
			defineDiorama({ ...minimal(), camera: { position: [1, 2, 3], target: [4, 5, 6], autoRotate: false } }),
		);
		expect(scene.camera.position).toEqual([1, 2, 3]);
		expect(scene.camera.target).toEqual([4, 5, 6]);
		expect(scene.camera.autoRotate).toBe(false);
	});
});
```

`src/sdk/bake.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { decodeVxb } from '../engine/voxel/vxb.ts';
import { bakeDiorama, bakeToVxb, bakeWarnings } from './bake.ts';
import { type DioramaInput, defineDiorama } from './schema.ts';

const valley = (build: DioramaInput['build']) =>
	defineDiorama({
		meta: { title: 'Долина', createdAt: '2026-10-06' },
		seed: 3,
		size: [40, 24, 40],
		palette: { grass: '#6aa84f', dirt: '#7a5a3a', gold: '#ffd700' },
		build,
	});

describe('bake', () => {
	test('запекание детерминировано', async () => {
		const d = valley((w) => w.terrain({ noise: 'hills', top: 'grass', fill: 'dirt' }));
		const a = await bakeToVxb(d);
		const b = await bakeToVxb(d);
		expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
	});

	test('статистика и неиспользуемые материалы', () => {
		const { stats } = bakeDiorama(valley((w) => w.box([0, 0, 0], [1, 0, 0], 'grass')));
		expect(stats.voxels).toBe(2);
		expect(stats.chunks).toBe(1);
		expect(stats.materials).toBe(1);
		expect(stats.unusedPalette).toEqual(['dirt', 'gold']);
	});

	test('пустой мир запекается и даёт предупреждение', async () => {
		const { bytes, stats } = await bakeToVxb(valley(() => {}));
		expect(stats.voxels).toBe(0);
		expect(bakeWarnings(stats).join('\n')).toContain('мир пустой');
		const decoded = await decodeVxb(bytes);
		expect(decoded.world.chunks.size).toBe(0);
	});

	test('выход за границы — предупреждение, не ошибка', async () => {
		const { stats } = await bakeToVxb(valley((w) => w.sphere([0, 0, 0], 3, 'grass')));
		expect(stats.outOfBounds).toBeGreaterThan(0);
		expect(bakeWarnings(stats).join('\n')).toContain('за границами');
	});

	test('ошибка в build оборачивается с названием диорамы', () => {
		const d = valley(() => {
			throw new Error('бум');
		});
		expect(() => bakeDiorama(d)).toThrow('ошибка в build() диорамы «Долина»: бум');
	});

	test('материалы префабов попадают в .vxb', async () => {
		const { bytes } = await bakeToVxb(
			valley((w) => {
				w.terrain({ noise: 'flat', base: 2, top: 'grass', fill: 'dirt' });
				w.water({ level: 4 });
			}),
		);
		const { materials } = await decodeVxb(bytes);
		expect(materials.map((m) => m.kind)).toEqual(['solid', 'solid', 'solid', 'water']);
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk/schema.test.ts src/sdk/bake.test.ts`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Реализация**

`src/sdk/schema.ts`:

```ts
import { z } from 'zod';
import type { SceneConfig, Vec3 } from '../engine/types.ts';
import { MAX_MATERIALS } from '../engine/voxel/constants.ts';
import type { WorldBuilder } from './builder/world-builder.ts';
import { AIR, HEX_COLOR, normalizeMaterial } from './materials.ts';

const hexColor = z.string().regex(HEX_COLOR, 'ожидается цвет в формате #rrggbb');
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const dimension = z.number().int().min(1).max(1024);

const materialInput = z.union([
	hexColor,
	z.strictObject({
		color: hexColor,
		emissive: z.number().min(0).max(10).optional(),
		kind: z.enum(['solid', 'water', 'glass']).optional(),
	}),
]);

const materialName = z
	.string()
	.regex(/^[a-z][a-zA-Z0-9_-]*$/, 'имя материала: латиница, с маленькой буквы')
	.refine((name) => name !== AIR, '"air" зарезервирован под пустоту');

export const dioramaSchema = z.strictObject({
	meta: z.strictObject({
		title: z.string().trim().min(1).max(80),
		createdAt: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, 'дата в формате YYYY-MM-DD')
			.refine((s) => {
				const d = new Date(`${s}T00:00:00Z`);
				return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
			}, 'несуществующая дата'),
		description: z.string().max(280).default(''),
		tags: z.array(z.string().min(1).max(24)).max(8).default([]),
	}),
	seed: z.number().int().default(1),
	size: z.tuple([dimension, dimension, dimension]),
	palette: z
		.record(materialName, materialInput)
		.refine((p) => Object.keys(p).length <= MAX_MATERIALS, `максимум ${MAX_MATERIALS} материалов`)
		.transform((p) =>
			Object.fromEntries(Object.entries(p).map(([name, input]) => [name, normalizeMaterial(input)])),
		),
	build: z.custom<(w: WorldBuilder) => void>(
		(v) => typeof v === 'function',
		'build должен быть функцией (w) => { … }',
	),
	atmosphere: z
		.strictObject({
			time: z
				.strictObject({ fixed: z.enum(['dawn', 'day', 'sunset', 'night']) })
				.prefault({ fixed: 'day' }),
			fog: z.number().min(0).max(0.05).default(0),
		})
		.prefault({}),
	camera: z
		.strictObject({
			position: vec3.optional(),
			target: vec3.optional(),
			autoRotate: z.boolean().default(true),
			minDistance: z.number().positive().optional(),
			maxDistance: z.number().positive().optional(),
		})
		.prefault({}),
	base: z.enum(['none', 'wood', 'stone']).default('none'),
});

export type DioramaInput = z.input<typeof dioramaSchema>;
export type Diorama = z.output<typeof dioramaSchema>;

export class DioramaValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DioramaValidationError';
	}
}

/** Проверяет и нормализует диораму. Всегда `export default defineDiorama({...})`. */
export function defineDiorama(input: DioramaInput): Diorama {
	const result = dioramaSchema.safeParse(input);
	if (!result.success) {
		const title = (input as { meta?: { title?: unknown } }).meta?.title;
		const name = typeof title === 'string' ? title : '?';
		throw new DioramaValidationError(
			`Диорама «${name}» невалидна:\n${z.prettifyError(result.error)}`,
		);
	}
	return result.data;
}

/** Сериализуемая часть диорамы для движка. Камера по умолчанию — изометрия на центр. */
export function toSceneConfig(d: Diorama): SceneConfig {
	const [sx, sy, sz] = d.size;
	const span = Math.max(sx, sz);
	const target: Vec3 = d.camera.target ?? [sx / 2, sy * 0.2, sz / 2];
	const distance = span * 1.25;
	const position: Vec3 = d.camera.position ?? [
		target[0] + distance * 0.8,
		target[1] + distance * 0.7,
		target[2] + distance * 0.8,
	];
	return {
		size: [sx, sy, sz],
		time: d.atmosphere.time.fixed,
		fog: d.atmosphere.fog,
		base: d.base,
		camera: {
			position,
			target,
			autoRotate: d.camera.autoRotate,
			minDistance: d.camera.minDistance ?? span * 0.3,
			maxDistance: d.camera.maxDistance ?? span * 3,
		},
	};
}
```

`src/sdk/bake.ts`:

```ts
import type { Material } from '../engine/types.ts';
import { encodeVxb } from '../engine/voxel/vxb.ts';
import type { VoxelWorld } from '../engine/voxel/world.ts';
import { WorldBuilder } from './builder/world-builder.ts';
import type { Diorama } from './schema.ts';

export const SIZE_WARN_BYTES = 2 * 1024 * 1024;
export const SIZE_LIMIT_BYTES = 8 * 1024 * 1024;

export interface BakeStats {
	voxels: number;
	chunks: number;
	/** Сколько разных материалов реально стоит в мире. */
	materials: number;
	/** Материалы палитры диорамы, которые не использованы. */
	unusedPalette: string[];
	outOfBounds: number;
}

export interface BakeResult {
	world: VoxelWorld;
	materials: Material[];
	stats: BakeStats;
}

export function bakeDiorama(d: Diorama): BakeResult {
	const w = new WorldBuilder(d.size, d.palette, d.seed);
	try {
		d.build(w);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`ошибка в build() диорамы «${d.meta.title}»: ${message}`, { cause: error });
	}
	w.world.pruneEmpty();
	const used = w.world.usedMaterials();
	return {
		world: w.world,
		materials: [...w.materialList],
		stats: {
			voxels: w.world.countVoxels(),
			chunks: w.world.chunks.size,
			materials: used.size,
			// Палитра диорамы регистрируется первой: её материал i имеет индекс i + 1.
			unusedPalette: Object.keys(d.palette).filter((_, i) => !used.has(i + 1)),
			outOfBounds: w.outOfBounds,
		},
	};
}

export async function bakeToVxb(
	d: Diorama,
): Promise<{ bytes: Uint8Array; stats: BakeStats & { bytes: number } }> {
	const result = bakeDiorama(d);
	const bytes = await encodeVxb(result);
	return { bytes, stats: { ...result.stats, bytes: bytes.length } };
}

export function bakeWarnings(stats: BakeStats & { bytes: number }): string[] {
	const warnings: string[] = [];
	if (stats.voxels === 0) warnings.push('мир пустой — build() не поставил ни одного вокселя');
	if (stats.outOfBounds > 0) {
		warnings.push(`${stats.outOfBounds} вокселей за границами size отброшено`);
	}
	if (stats.unusedPalette.length > 0) {
		warnings.push(`неиспользуемые материалы палитры: ${stats.unusedPalette.join(', ')}`);
	}
	if (stats.bytes > SIZE_WARN_BYTES) {
		const mb = (stats.bytes / 1024 / 1024).toFixed(1);
		warnings.push(`.vxb весит ${mb} МБ (> 2 МБ) — на мобилках будет грузиться долго`);
	}
	return warnings;
}
```

`src/sdk/index.ts`:

```ts
export type { Material, MaterialKind, SceneConfig, TimeOfDay, Vec3 } from '../engine/types.ts';
export {
	type BakeResult,
	type BakeStats,
	SIZE_LIMIT_BYTES,
	SIZE_WARN_BYTES,
	bakeDiorama,
	bakeToVxb,
	bakeWarnings,
} from './bake.ts';
export { type Model, ModelBuilder, type ModelOptions, model } from './builder/model.ts';
export {
	type ModelSource,
	type PlaceOptions,
	type Rotation,
	type ScatterOptions,
	type TerrainNoise,
	type TerrainOptions,
	type WaterOptions,
	WorldBuilder,
} from './builder/world-builder.ts';
export type { MaterialInput } from './materials.ts';
export type { Noise2D } from './noise.ts';
export type { Rng } from './rng.ts';
export {
	type Diorama,
	type DioramaInput,
	DioramaValidationError,
	defineDiorama,
	toSceneConfig,
} from './schema.ts';
export { SLUG_RE, slugFromDioramaPath } from './slug.ts';
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/sdk`
Expected: PASS (все тесты sdk).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(sdk): add diorama schema, baking and public SDK entry

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Базовые префабы

**Files:**
- Create: `src/sdk/prefabs/tree.ts`, `src/sdk/prefabs/pine.ts`, `src/sdk/prefabs/house.ts`, `src/sdk/prefabs/rock.ts`, `src/sdk/prefabs/index.ts`
- Modify: `src/sdk/index.ts` (добавить экспорт `prefabs`)
- Test: `src/sdk/prefabs/prefabs.test.ts`

**Interfaces:**
- Consumes: `model`, `Model` (Task 7), `createRng`, `Rng` (Task 2).
- Produces:
  - `tree(o?: { rng?: Rng; height?: number; leaves?: string; trunk?: string }): Model`
  - `pine(o?: { rng?: Rng; height?: number; needles?: string }): Model`
  - `house(o?: { rng?: Rng; width?: number; depth?: number; walls?: string; roof?: string }): Model`
  - `rock(o?: { rng?: Rng; size?: number }): Model`
  - Все стоят основанием на `y = 0` и подходят для `w.scatter(prefabs.tree, …)`: фабрика получает `{ rng }`. Без `rng` модель детерминирована (`createRng(1)`).
  - `import { prefabs } from '#sdk'` → `prefabs.tree(…)` и т.д.

- [ ] **Step 1: Падающий тест**

`src/sdk/prefabs/prefabs.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { Model } from '../builder/model.ts';
import { modelIndex } from '../builder/model.ts';
import { createRng } from '../rng.ts';
import { house, pine, rock, tree } from './index.ts';

const factories = { tree, pine, house, rock } as const;

const hasGroundContact = (m: Model): boolean => {
	for (let x = 0; x < m.size[0]; x++)
		for (let z = 0; z < m.size[2]; z++) if (m.data[modelIndex(m.size, x, 0, z)] !== 0) return true;
	return false;
};

describe.each(Object.entries(factories))('%s', (_, make) => {
	test('детерминирован по rng', () => {
		expect(make({ rng: createRng(4) }).data).toEqual(make({ rng: createRng(4) }).data);
	});

	test('не пустой и стоит на земле', () => {
		const m = make({ rng: createRng(8) });
		expect(m.data.some((v) => v !== 0)).toBe(true);
		expect(hasGroundContact(m)).toBe(true);
	});

	test('варьируется между seed', () => {
		const variants = new Set(
			[1, 2, 3, 4, 5, 6].map((s) => Array.from(make({ rng: createRng(s) }).data).join('')),
		);
		expect(variants.size).toBeGreaterThan(1);
	});
});

test('у дома светящиеся окна', () => {
	expect(house().materials.some(({ material }) => material.emissive > 0)).toBe(true);
});

test('цвета префабов настраиваются', () => {
	const leaves = tree({ leaves: '#ff00ff' }).materials.find((m) => m.name === 'leaves');
	expect(leaves?.material.color).toBe('#ff00ff');
	const roof = house({ roof: '#123456' }).materials.find((m) => m.name === 'roof');
	expect(roof?.material.color).toBe('#123456');
});
```

- [ ] **Step 2: Тест падает**

Run: `bun test src/sdk/prefabs`
Expected: FAIL — `Cannot find module './index.ts'`.

- [ ] **Step 3: Реализация**

`src/sdk/prefabs/tree.ts`:

```ts
import { type Model, model } from '../builder/model.ts';
import { type Rng, createRng } from '../rng.ts';

export interface TreeOptions {
	rng?: Rng;
	height?: number;
	leaves?: string;
	trunk?: string;
}

/** Лиственное дерево: ствол-столб и крона из нескольких сфер. Основание — y = 0. */
export function tree(options: TreeOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(4, 6);
	const radius = rng.int(2, 3);
	const size = radius * 2 + 3;
	const c = radius + 1;
	const crown = height + radius - 1;
	return model(
		{
			size: [size, height + radius * 2 + 1, size],
			palette: { trunk: options.trunk ?? '#6b4a2b', leaves: options.leaves ?? '#4f8f3a' },
		},
		(m) => {
			m.sphere([c, crown, c], radius, 'leaves');
			for (let i = 0; i < 3; i++) {
				m.sphere(
					[c + rng.int(-1, 1), crown + rng.int(-1, 1), c + rng.int(-1, 1)],
					radius - 1,
					'leaves',
				);
			}
			m.box([c, 0, c], [c, height, c], 'trunk');
		},
	);
}
```

`src/sdk/prefabs/pine.ts`:

```ts
import { type Model, model } from '../builder/model.ts';
import { type Rng, createRng } from '../rng.ts';

export interface PineOptions {
	rng?: Rng;
	height?: number;
	needles?: string;
}

/** Ель: ствол и ярусный конус хвои. Основание — y = 0. */
export function pine(options: PineOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(7, 11);
	const radius = Math.max(2, Math.floor(height / 3));
	const size = radius * 2 + 1;
	const c = radius;
	return model(
		{
			size: [size, height + 2, size],
			palette: { trunk: '#5a3b22', needles: options.needles ?? '#2f6b3a' },
		},
		(m) => {
			m.box([c, 0, c], [c, height, c], 'trunk');
			for (let y = 2; y <= height + 1; y++) {
				const t = (y - 2) / (height - 1);
				let r = Math.round(radius * (1 - t));
				// Каждый третий слой уже — получаются «юбки» ярусов.
				if ((y - 2) % 3 === 2) r = Math.max(0, r - 1);
				m.cylinder([c, y, c], r, 1, 'needles');
			}
		},
	);
}
```

`src/sdk/prefabs/house.ts`:

```ts
import { type Model, model } from '../builder/model.ts';
import { type Rng, createRng } from '../rng.ts';

export interface HouseOptions {
	rng?: Rng;
	width?: number;
	depth?: number;
	walls?: string;
	roof?: string;
}

/** Домик: стены, двускатная крыша со свесом, дверь, светящиеся окна, труба. Фасад смотрит в -z. */
export function house(options: HouseOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const width = options.width ?? rng.pick([5, 7]);
	const depth = options.depth ?? rng.int(5, 7);
	const wallHeight = 4;
	const roofLayers = Math.floor((width + 1) / 2) + 1;
	const mid = Math.floor((width + 1) / 2);
	return model(
		{
			size: [width + 2, wallHeight + roofLayers + 1, depth + 2],
			palette: {
				wall: options.walls ?? '#e8dcc0',
				roof: options.roof ?? '#b5452f',
				door: '#5a3a22',
				window: { color: '#ffd27a', emissive: 0.8 },
				chimney: '#7d7d7d',
			},
		},
		(m) => {
			m.box([1, 0, 1], [width, wallHeight - 1, depth], 'wall');
			// Двускатная крыша вдоль оси z со свесом в 1 воксель.
			for (let k = 0; k < roofLayers && k <= width + 1 - k; k++) {
				m.box([k, wallHeight + k, 0], [width + 1 - k, wallHeight + k, depth + 1], 'roof');
			}
			m.box([mid, 0, 1], [mid, 1, 1], 'door');
			for (const z of [1, depth]) {
				m.set([2, 2, z], 'window');
				m.set([width - 1, 2, z], 'window');
			}
			const side = Math.floor((depth + 1) / 2);
			m.set([1, 2, side], 'window');
			m.set([width, 2, side], 'window');
			m.box([width - 1, wallHeight, 2], [width - 1, wallHeight + roofLayers, 2], 'chimney');
		},
	);
}
```

`src/sdk/prefabs/rock.ts`:

```ts
import { type Model, model } from '../builder/model.ts';
import { type Rng, createRng } from '../rng.ts';

export interface RockOptions {
	rng?: Rng;
	/** Радиус 1..3. */
	size?: number;
}

/** Валун: купол из двух пересекающихся полусфер двух оттенков. */
export function rock(options: RockOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const r = options.size ?? rng.int(1, 3);
	const size = r * 2 + 3;
	const c = r + 1;
	return model(
		{
			size: [size, r + 1, size],
			palette: { stone: '#8a8a8a', 'stone-dark': '#6f6f6f' },
		},
		(m) => {
			m.sphere([c, 0, c], r, 'stone');
			m.sphere([c + rng.int(-1, 1), 0, c + rng.int(-1, 1)], Math.max(1, r - 1), 'stone-dark');
		},
	);
}
```

`src/sdk/prefabs/index.ts`:

```ts
export { type HouseOptions, house } from './house.ts';
export { type PineOptions, pine } from './pine.ts';
export { type RockOptions, rock } from './rock.ts';
export { type TreeOptions, tree } from './tree.ts';
```

`src/sdk/index.ts`: добавить в конец:

```ts
export * as prefabs from './prefabs/index.ts';
```

- [ ] **Step 4: Тест проходит**

Run: `bun test src/sdk`
Expected: PASS (все тесты sdk, включая 14 новых по префабам).

- [ ] **Step 5: Commit**

```bash
bun run format
git add -A
git commit -m "feat(sdk): add tree, pine, house and rock prefabs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Скрипты агента, демо-диорама и контентный тест

**Files:**
- Create: `scripts/lib/dioramas.ts`, `scripts/diorama-new.ts`, `scripts/diorama-check.ts`, `scripts/bake-all.ts`, `src/dioramas/quiet-valley/index.ts`
- Test: `scripts/lib/dioramas.test.ts`, `src/dioramas/content.test.ts`

**Interfaces:**
- Consumes: `#sdk`: `Diorama`, `bakeToVxb`, `bakeWarnings`, `SIZE_LIMIT_BYTES`, `SLUG_RE`, `defineDiorama`, `prefabs` (Task 2, 9, 10).
- Produces:
  - `ROOT`, `DIORAMAS_DIR`, `listDioramaDirs(): string[]` (все подпапки), `listSlugs(): string[]` (подпапки с `index.ts`, по алфавиту), `loadDiorama(slug): Promise<Diorama>`, `today(date?: Date): string`
  - CLI: `bun run diorama:new <slug> "Название"`, `bun run diorama:check [slug…] [--no-types]` (код выхода 1 при ошибках), `bun run scripts/bake-all.ts` (пишет `static/baked/<slug>.vxb`)
  - Демо `src/dioramas/quiet-valley/index.ts`

- [ ] **Step 1: Падающие тесты**

`scripts/lib/dioramas.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { listSlugs, loadDiorama, today } from './dioramas.ts';

test('today форматирует локальную дату как YYYY-MM-DD', () => {
	expect(today(new Date(2026, 9, 6))).toBe('2026-10-06');
	expect(today(new Date(2027, 0, 1))).toBe('2027-01-01');
});

test('listSlugs находит демо-диораму', () => {
	expect(listSlugs()).toContain('quiet-valley');
});

test('loadDiorama: несуществующая диорама — понятная ошибка', async () => {
	await expect(loadDiorama('no-such-diorama')).rejects.toThrow('нет файла');
});
```

`src/dioramas/content.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { SIZE_LIMIT_BYTES, SLUG_RE, bakeToVxb } from '#sdk';
import { listDioramaDirs, listSlugs, loadDiorama } from '../../scripts/lib/dioramas.ts';

test('папки диорам названы в kebab-case', () => {
	for (const dir of listDioramaDirs()) expect(dir).toMatch(SLUG_RE);
});

test('в каждой папке диорамы есть index.ts', () => {
	expect(listSlugs()).toEqual(listDioramaDirs());
});

for (const slug of listSlugs()) {
	test(
		`${slug}: валидна, запекается детерминированно и укладывается в бюджет`,
		async () => {
			const diorama = await loadDiorama(slug);
			const a = await bakeToVxb(diorama);
			const b = await bakeToVxb(diorama);
			expect(a.stats.voxels).toBeGreaterThan(0);
			expect(a.stats.bytes).toBeLessThan(SIZE_LIMIT_BYTES);
			expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
		},
		30_000,
	);
}
```

- [ ] **Step 2: Тесты падают**

Run: `bun test scripts src/dioramas`
Expected: FAIL — `Cannot find module './dioramas.ts'`.

- [ ] **Step 3: Общие функции скриптов**

`scripts/lib/dioramas.ts`:

```ts
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
```

- [ ] **Step 4: Демо-диорама**

`src/dioramas/quiet-valley/index.ts`:

```ts
import { defineDiorama, prefabs } from '#sdk';

export default defineDiorama({
	meta: {
		title: 'Тихая долина',
		createdAt: '2026-10-06',
		description: 'Домик у озера среди холмов на закате',
		tags: ['деревня', 'озеро', 'закат'],
	},
	seed: 7,
	size: [96, 40, 96],
	palette: {
		grass: '#6aa84f',
		dirt: '#7a5a3a',
		sand: '#d9c48a',
		water: { color: '#3a7bd5', kind: 'water' },
	},
	build(w) {
		w.terrain({ noise: 'hills', base: 12, amp: 10, top: 'grass', fill: 'dirt' });

		// Песчаный берег у воды.
		for (let x = 0; x < w.size[0]; x++) {
			for (let z = 0; z < w.size[2]; z++) {
				const h = w.heightAt(x, z);
				if (h >= 0 && h <= 11) w.set([x, h, z], 'sand');
			}
		}
		w.water({ level: 10 });

		// Ровная площадка под дом.
		const hx = 62;
		const hz = 40;
		const ground = Math.max(w.heightAt(hx, hz), 12);
		w.box([hx - 6, 0, hz - 6], [hx + 6, ground - 1, hz + 6], 'dirt');
		w.box([hx - 6, ground, hz - 6], [hx + 6, ground, hz + 6], 'grass');
		w.clear([hx - 6, ground + 1, hz - 6], [hx + 6, w.size[1] - 1, hz + 6]);
		w.place(prefabs.house({ roof: '#b5452f', rng: w.rng.fork() }), [hx, ground + 1, hz], {
			rotate: 180,
		});

		w.scatter(prefabs.tree, { count: 28, on: 'grass', minDistance: 6 });
		w.scatter(prefabs.pine, { count: 14, on: 'grass', minDistance: 7, area: [0, 0, 40, 95] });
		w.scatter(prefabs.rock, { count: 10, on: ['grass', 'sand'], minDistance: 5 });
	},
	atmosphere: { time: { fixed: 'sunset' }, fog: 0.003 },
});
```

- [ ] **Step 5: Тесты проходят**

Run: `bun test scripts src/dioramas`
Expected: PASS (6 тестов: 3 в `dioramas.test.ts`, 3 в контентном тесте).

- [ ] **Step 6: Скрипты CLI**

`scripts/diorama-new.ts`:

```ts
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
console.log(`Создано ${relative(ROOT, file)}\nДальше: bun run diorama:check ${slug}`);
```

`scripts/diorama-check.ts`:

```ts
import { SIZE_LIMIT_BYTES, SLUG_RE, bakeToVxb, bakeWarnings } from '#sdk';
import { ROOT, listSlugs, loadDiorama } from './lib/dioramas.ts';

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
		const { stats } = await bakeToVxb(diorama);
		const ms = Math.round(performance.now() - started);
		if (stats.bytes > SIZE_LIMIT_BYTES) {
			throw new Error(`.vxb весит ${formatBytes(stats.bytes)} — больше лимита ${formatBytes(SIZE_LIMIT_BYTES)}`);
		}
		console.log(`  «${diorama.meta.title}» · ${diorama.meta.createdAt} · size ${diorama.size.join('×')}`);
		console.log(
			`  вокселей ${stats.voxels.toLocaleString('ru-RU')} · чанков ${stats.chunks} · материалов ${stats.materials} · ${formatBytes(stats.bytes)} · ${ms} мс`,
		);
		for (const warning of bakeWarnings(stats)) console.log(`  ⚠ ${warning}`);
		console.log('  ✓ ok');
	} catch (error) {
		failed = true;
		console.error(`  ✗ ${error instanceof Error ? error.message : String(error)}`);
	}
}

process.exit(failed ? 1 : 0);
```

`scripts/bake-all.ts`:

```ts
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIZE_LIMIT_BYTES, bakeToVxb } from '#sdk';
import { ROOT, listSlugs, loadDiorama } from './lib/dioramas.ts';

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
```

- [ ] **Step 7: Проверить CLI вручную**

```bash
bun run diorama:check quiet-valley --no-types
bun run diorama:new tmp-check "Проверка"
bun run diorama:check tmp-check --no-types
bun run diorama:new tmp-check "Ещё раз"     # должно упасть: уже существует
bun run diorama:new Bad_Slug "Плохо"         # должно упасть: kebab-case
rm -rf src/dioramas/tmp-check
bun run scripts/bake-all.ts && ls -la static/baked
```

Expected:
- `quiet-valley` — строка со статистикой, `✓ ok`, код выхода 0. Предупреждения про `за границами` допустимы: деревья обрезаются у края мира.
- `tmp-check` создаётся и проходит проверку.
- Повторное создание и плохой slug завершаются с кодом 1 и понятным текстом.
- `static/baked/quiet-valley.vxb` существует.

- [ ] **Step 8: Полный прогон**

Run: `bun run check`
Expected: Biome, svelte-check и все тесты зелёные.

- [ ] **Step 9: Commit**

```bash
bun run format
git add -A
git commit -m "feat: add diorama CLI scripts, demo diorama and content test

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Движок рендера (`mountDiorama`)

**Files:**
- Create: `src/engine/load.ts`, `src/engine/atmosphere/presets.ts`, `src/engine/atmosphere/sky.ts`, `src/engine/render/renderer.ts`, `src/engine/render/materials.ts`, `src/engine/render/stage.ts`, `src/engine/world-mesh.ts`, `src/engine/index.ts`
- Test: `src/engine/load.test.ts`

**Interfaces:**
- Consumes: `decodeVxb`, `VxbError` (Task 4), `buildPaletteLUT` (Task 3), `MesherPool` (Task 6), `MeshData`, `ChunkMesh` (Task 5), `VoxelWorld`, `CHUNK` (Task 3), `SceneConfig`, `TimeOfDay`, `Vec3` (Task 3).
- Produces (`#engine`):
  - `mountDiorama(canvas: HTMLCanvasElement, config: SceneConfig, options: MountOptions): Promise<DioramaController>`
  - `interface MountOptions { url: string; onProgress?: (progress: number) => void }` (прогресс 0..1: скачивание 0–0.5, мешинг 0.5–1)
  - `interface DioramaController { readonly backend: 'webgpu' | 'webgl2'; readonly paused: boolean; setTime(t: TimeOfDay): void; pause(): void; resume(): void; reloadWorld(url: string): Promise<void>; captureThumbnail(o?: { width?: number; height?: number; quality?: number }): Promise<Blob>; dispose(): void }`
  - `class NoGraphicsError`, `class LoadError`, реэкспорт `VxbError` и типов `SceneConfig`, `TimeOfDay`, `Vec3`, `CameraConfig`, `BaseStyle`
  - `fetchBytes(url, onProgress?, fetchImpl?): Promise<Uint8Array>`
  - Промис `mountDiorama` резолвится, когда **весь** мир смеширован. Чанки появляются в сцене по мере готовности, от центра к краям.

- [ ] **Step 1: Падающий тест загрузчика**

`src/engine/load.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { LoadError, fetchBytes } from './load.ts';

describe('fetchBytes', () => {
	test('возвращает байты и доводит прогресс до 1', async () => {
		const payload = new Uint8Array(10_000).map((_, i) => i % 251);
		const progress: number[] = [];
		const bytes = await fetchBytes(
			'/baked/x.vxb',
			(p) => progress.push(p),
			async () => new Response(payload, { headers: { 'content-length': String(payload.length) } }),
		);
		expect(bytes).toEqual(payload);
		expect(progress.at(-1)).toBe(1);
		expect(progress.every((p, i) => i === 0 || p >= progress[i - 1])).toBe(true);
	});

	test('HTTP-ошибка → LoadError со статусом', async () => {
		const run = fetchBytes('/baked/missing.vxb', undefined, async () => new Response('nope', { status: 404 }));
		await expect(run).rejects.toBeInstanceOf(LoadError);
		await expect(run).rejects.toThrow('HTTP 404');
	});

	test('сетевая ошибка → LoadError', async () => {
		const run = fetchBytes('/baked/x.vxb', undefined, async () => {
			throw new TypeError('Failed to fetch');
		});
		await expect(run).rejects.toThrow('сеть');
	});
});
```

- [ ] **Step 2: Тест падает**

Run: `bun test src/engine/load.test.ts`
Expected: FAIL — `Cannot find module './load.ts'`.

- [ ] **Step 3: Загрузчик**

`src/engine/load.ts`:

```ts
export class LoadError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = 'LoadError';
	}
}

type Fetcher = (url: string) => Promise<Response>;

/** Скачивает файл целиком, сообщая прогресс 0..1 (если сервер прислал content-length). */
export async function fetchBytes(
	url: string,
	onProgress?: (progress: number) => void,
	fetchImpl: Fetcher = (u) => fetch(u),
): Promise<Uint8Array> {
	let response: Response;
	try {
		response = await fetchImpl(url);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new LoadError(`сеть недоступна: ${reason}`);
	}
	if (!response.ok) {
		throw new LoadError(`не удалось загрузить ${url}: HTTP ${response.status}`, response.status);
	}
	const total = Number(response.headers.get('content-length')) || 0;
	if (!response.body) {
		const bytes = new Uint8Array(await response.arrayBuffer());
		onProgress?.(1);
		return bytes;
	}
	const reader = response.body.getReader();
	const parts: Uint8Array[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		parts.push(value);
		received += value.length;
		if (total > 0) onProgress?.(Math.min(1, received / total));
	}
	const out = new Uint8Array(received);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	onProgress?.(1);
	return out;
}
```

- [ ] **Step 4: Тест проходит**

Run: `bun test src/engine/load.test.ts`
Expected: PASS (3 теста).

- [ ] **Step 5: Атмосфера: пресеты и небо**

`src/engine/atmosphere/presets.ts`:

```ts
import type { TimeOfDay, Vec3 } from '../types.ts';

export interface LightingPreset {
	/** Направление «от сцены к солнцу» (нормализуется при применении). */
	sunDirection: Vec3;
	sunColor: string;
	sunIntensity: number;
	hemiSky: string;
	hemiGround: string;
	hemiIntensity: number;
	zenith: string;
	horizon: string;
	fog: string;
	exposure: number;
}

export const LIGHTING: Record<TimeOfDay, LightingPreset> = {
	dawn: {
		sunDirection: [1, 0.3, -0.4],
		sunColor: '#ffd2b0',
		sunIntensity: 2,
		hemiSky: '#d8c8ff',
		hemiGround: '#3a3540',
		hemiIntensity: 0.9,
		zenith: '#5a6fb0',
		horizon: '#f7c6b0',
		fog: '#e9c8c0',
		exposure: 1,
	},
	day: {
		sunDirection: [0.5, 1, 0.3],
		sunColor: '#fff4e0',
		sunIntensity: 3,
		hemiSky: '#bfd9ff',
		hemiGround: '#5b4a3a',
		hemiIntensity: 1.2,
		zenith: '#3d7bd9',
		horizon: '#bcd8f5',
		fog: '#bcd8f5',
		exposure: 1,
	},
	sunset: {
		sunDirection: [-1, 0.35, 0.4],
		sunColor: '#ffb070',
		sunIntensity: 2.6,
		hemiSky: '#ffcfa8',
		hemiGround: '#3a2c3a',
		hemiIntensity: 0.9,
		zenith: '#2b3a6b',
		horizon: '#ff9a5c',
		fog: '#e8a07a',
		exposure: 1,
	},
	night: {
		sunDirection: [-0.3, 1, -0.5],
		sunColor: '#9bb4ff',
		sunIntensity: 0.6,
		hemiSky: '#2a3a66',
		hemiGround: '#0b0d14',
		hemiIntensity: 0.5,
		zenith: '#05070f',
		horizon: '#1b2747',
		fog: '#141c33',
		exposure: 1.2,
	},
};
```

`src/engine/atmosphere/sky.ts`:

```ts
import { mix, normalize, positionLocal, smoothstep, uniform } from 'three/tsl';
import { BackSide, Color, Mesh, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu';

export interface Sky {
	mesh: Mesh;
	setColors(zenith: string, horizon: string): void;
	dispose(): void;
}

/** Сфера неба с градиентом горизонт → зенит. Каждый кадр двигается вместе с камерой. */
export function createSky(radius: number): Sky {
	const zenith = uniform(new Color());
	const horizon = uniform(new Color());
	const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
	material.colorNode = mix(horizon, zenith, smoothstep(-0.05, 0.6, normalize(positionLocal).y));
	const geometry = new SphereGeometry(radius, 32, 16);
	const mesh = new Mesh(geometry, material);
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	return {
		mesh,
		setColors(z, h) {
			zenith.value.set(z);
			horizon.value.set(h);
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}
```

- [ ] **Step 6: Рендерер, материалы, сцена**

`src/engine/render/renderer.ts`:

```ts
import { AgXToneMapping, PCFShadowMap, WebGPURenderer } from 'three/webgpu';

export class NoGraphicsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NoGraphicsError';
	}
}

/** WebGPU, а где его нет — автоматически WebGL2. Если нет ничего — NoGraphicsError. */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
	let renderer: WebGPURenderer | null = null;
	try {
		renderer = new WebGPURenderer({ canvas, antialias: true });
		await renderer.init();
	} catch (error) {
		renderer?.dispose();
		const reason = error instanceof Error ? error.message : String(error);
		throw new NoGraphicsError(`браузер не поддерживает ни WebGPU, ни WebGL2 (${reason})`);
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.toneMapping = AgXToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFShadowMap;
	return renderer;
}

export function backendName(renderer: WebGPURenderer): 'webgpu' | 'webgl2' {
	return (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
}
```

`src/engine/render/materials.ts`:

```ts
import { attribute, float } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { BaseStyle } from '../types.ts';

export type VoxelLayer = 'opaque' | 'water' | 'glass';

const OPACITY: Record<Exclude<VoxelLayer, 'opaque'>, number> = { water: 0.78, glass: 0.35 };

/** Материал вокселей: цвет и AO из вершинных атрибутов, свечение = цвет × emissive. */
export function createVoxelMaterial(layer: VoxelLayer): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({
		metalness: 0,
		roughness: layer === 'opaque' ? 0.9 : 0.15,
	});
	const color = attribute('color', 'vec3');
	material.colorNode = color.mul(attribute('ao', 'float'));
	material.emissiveNode = color.mul(attribute('emissive', 'float'));
	if (layer !== 'opaque') {
		material.transparent = true;
		material.depthWrite = false;
		material.opacityNode = float(OPACITY[layer]);
	}
	return material;
}

export function createWorldMaterials(): Record<VoxelLayer, MeshStandardNodeMaterial> {
	return {
		opaque: createVoxelMaterial('opaque'),
		water: createVoxelMaterial('water'),
		glass: createVoxelMaterial('glass'),
	};
}

export function createBaseMaterial(style: Exclude<BaseStyle, 'none'>): MeshStandardNodeMaterial {
	return new MeshStandardNodeMaterial({
		color: style === 'wood' ? '#6b4a2f' : '#5d5f66',
		roughness: 0.85,
		metalness: 0,
	});
}
```

`src/engine/render/stage.ts`:

```ts
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
	BoxGeometry,
	DirectionalLight,
	FogExp2,
	Group,
	HemisphereLight,
	Mesh,
	PerspectiveCamera,
	Scene,
	Vector3,
	type WebGPURenderer,
} from 'three/webgpu';
import { LIGHTING } from '../atmosphere/presets.ts';
import { type Sky, createSky } from '../atmosphere/sky.ts';
import type { SceneConfig, TimeOfDay } from '../types.ts';
import { createBaseMaterial } from './materials.ts';

function disposeGroup(group: Group): void {
	group.traverse((object) => {
		if (object instanceof Mesh) object.geometry.dispose();
	});
}

/** Сцена диорамы: камера с orbit-управлением, небо, солнце с тенью, подставка, группа мира. */
export class Stage {
	readonly scene = new Scene();
	readonly camera: PerspectiveCamera;
	readonly controls: OrbitControls;
	world = new Group();

	private readonly sun = new DirectionalLight();
	private readonly hemi = new HemisphereLight();
	private readonly sky: Sky;
	private readonly fog: FogExp2;
	private readonly center: Vector3;
	private readonly radius: number;
	private base: Mesh | null = null;

	constructor(
		private readonly renderer: WebGPURenderer,
		config: SceneConfig,
	) {
		const [sx, sy, sz] = config.size;
		this.center = new Vector3(sx / 2, sy / 2, sz / 2);
		this.radius = Math.hypot(sx, sy, sz) / 2;

		const far = config.camera.maxDistance * 2 + this.radius * 4;
		this.camera = new PerspectiveCamera(40, 1, 0.5, far);
		this.camera.position.set(...config.camera.position);

		this.controls = new OrbitControls(this.camera, renderer.domElement);
		this.controls.target.set(...config.camera.target);
		this.controls.enableDamping = true;
		this.controls.autoRotate = config.camera.autoRotate;
		this.controls.autoRotateSpeed = 0.5;
		this.controls.minDistance = config.camera.minDistance;
		this.controls.maxDistance = config.camera.maxDistance;
		this.controls.maxPolarAngle = Math.PI * 0.49;
		this.controls.update();

		this.sky = createSky(far * 0.9);
		this.fog = new FogExp2('#ffffff', config.fog);
		if (config.fog > 0) this.scene.fog = this.fog;

		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		this.sun.shadow.bias = -0.0005;
		this.sun.shadow.normalBias = 0.05;
		const shadowCamera = this.sun.shadow.camera;
		shadowCamera.left = -this.radius;
		shadowCamera.right = this.radius;
		shadowCamera.top = this.radius;
		shadowCamera.bottom = -this.radius;
		shadowCamera.near = 0.5;
		shadowCamera.far = this.radius * 4;
		shadowCamera.updateProjectionMatrix();

		this.scene.add(this.sky.mesh, this.sun, this.sun.target, this.hemi, this.world);

		if (config.base !== 'none') {
			this.base = new Mesh(new BoxGeometry(sx + 4, 3, sz + 4), createBaseMaterial(config.base));
			this.base.position.set(sx / 2, -1.5, sz / 2);
			this.base.receiveShadow = true;
			this.scene.add(this.base);
		}

		this.setTime(config.time);
	}

	setTime(time: TimeOfDay): void {
		const p = LIGHTING[time];
		const direction = new Vector3(...p.sunDirection).normalize();
		this.sun.position.copy(this.center).addScaledVector(direction, this.radius * 2);
		this.sun.target.position.copy(this.center);
		this.sun.color.set(p.sunColor);
		this.sun.intensity = p.sunIntensity;
		this.hemi.color.set(p.hemiSky);
		this.hemi.groundColor.set(p.hemiGround);
		this.hemi.intensity = p.hemiIntensity;
		this.sky.setColors(p.zenith, p.horizon);
		this.fog.color.set(p.fog);
		this.renderer.toneMappingExposure = p.exposure;
	}

	resize(width: number, height: number): void {
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	render(): void {
		this.controls.update();
		this.sky.mesh.position.copy(this.camera.position);
		this.renderer.render(this.scene, this.camera);
	}

	/** Подменяет мир целиком (HMR): новая группа уже полностью смеширована. */
	replaceWorld(next: Group): void {
		this.scene.remove(this.world);
		disposeGroup(this.world);
		this.world = next;
		this.scene.add(next);
	}

	dispose(): void {
		disposeGroup(this.world);
		this.controls.dispose();
		this.sky.dispose();
		if (this.base) {
			this.base.geometry.dispose();
			(this.base.material as { dispose(): void }).dispose();
		}
	}
}
```

- [ ] **Step 7: Мир → меши и `mountDiorama`**

`src/engine/world-mesh.ts`:

```ts
import { BufferAttribute, BufferGeometry, type Group, Mesh, type MeshStandardNodeMaterial } from 'three/webgpu';
import type { VoxelLayer } from './render/materials.ts';
import type { Vec3 } from './types.ts';
import { CHUNK } from './voxel/constants.ts';
import type { ChunkMesh, MeshData } from './voxel/mesher.ts';
import type { MesherPool } from './voxel/mesher-pool.ts';
import type { VoxelWorld } from './voxel/world.ts';

export function toGeometry(data: MeshData): BufferGeometry {
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
	geometry.setAttribute('normal', new BufferAttribute(data.normals, 3));
	geometry.setAttribute('color', new BufferAttribute(data.colors, 3));
	geometry.setAttribute('ao', new BufferAttribute(data.ao, 1));
	geometry.setAttribute('emissive', new BufferAttribute(data.emissive, 1));
	geometry.setIndex(new BufferAttribute(data.indices, 1));
	geometry.computeBoundingSphere();
	return geometry;
}

function addChunk(
	group: Group,
	mesh: ChunkMesh,
	materials: Record<VoxelLayer, MeshStandardNodeMaterial>,
): void {
	for (const layer of ['opaque', 'water', 'glass'] as const) {
		const data = mesh[layer];
		if (!data) continue;
		const object = new Mesh(toGeometry(data), materials[layer]);
		object.castShadow = layer === 'opaque';
		object.receiveShadow = layer !== 'glass';
		group.add(object);
	}
}

/** Мешит все чанки (от центра к краям) и добавляет их в group по мере готовности. */
export async function meshWorld(
	world: VoxelWorld,
	pool: MesherPool,
	group: Group,
	materials: Record<VoxelLayer, MeshStandardNodeMaterial>,
	onProgress?: (fraction: number) => void,
): Promise<void> {
	const cx = world.size[0] / 2 / CHUNK;
	const cz = world.size[2] / 2 / CHUNK;
	const chunks = [...world.chunks.values()].sort(
		(a, b) =>
			(a.coord[0] + 0.5 - cx) ** 2 + (a.coord[2] + 0.5 - cz) ** 2 -
			((b.coord[0] + 0.5 - cx) ** 2 + (b.coord[2] + 0.5 - cz) ** 2),
	);
	if (chunks.length === 0) {
		onProgress?.(1);
		return;
	}
	let done = 0;
	onProgress?.(0);
	await Promise.all(
		chunks.map(async ({ coord }) => {
			const origin: Vec3 = [coord[0] * CHUNK, coord[1] * CHUNK, coord[2] * CHUNK];
			const mesh = await pool.mesh(world.extractPadded(coord[0], coord[1], coord[2]), origin);
			addChunk(group, mesh, materials);
			done++;
			onProgress?.(done / chunks.length);
		}),
	);
}
```

`src/engine/index.ts`:

```ts
import { Group } from 'three/webgpu';
import { fetchBytes } from './load.ts';
import { createWorldMaterials } from './render/materials.ts';
import { backendName, createRenderer } from './render/renderer.ts';
import { Stage } from './render/stage.ts';
import type { SceneConfig, TimeOfDay } from './types.ts';
import { MesherPool } from './voxel/mesher-pool.ts';
import { buildPaletteLUT } from './voxel/palette.ts';
import { decodeVxb } from './voxel/vxb.ts';
import { meshWorld } from './world-mesh.ts';

export { LoadError } from './load.ts';
export { NoGraphicsError } from './render/renderer.ts';
export type { BaseStyle, CameraConfig, SceneConfig, TimeOfDay, Vec3 } from './types.ts';
export { VxbError } from './voxel/vxb.ts';

export interface MountOptions {
	/** URL запечённого мира (.vxb). */
	url: string;
	/** 0..1: скачивание — первая половина, мешинг — вторая. */
	onProgress?: (progress: number) => void;
}

export interface CaptureOptions {
	width?: number;
	height?: number;
	quality?: number;
}

export interface DioramaController {
	readonly backend: 'webgpu' | 'webgl2';
	readonly paused: boolean;
	setTime(time: TimeOfDay): void;
	pause(): void;
	resume(): void;
	/** Перезагрузить мир без перезагрузки страницы (камера сохраняется). */
	reloadWorld(url: string): Promise<void>;
	/** Кадр в заданном разрешении, webp. */
	captureThumbnail(options?: CaptureOptions): Promise<Blob>;
	dispose(): void;
}

/** Монтирует диораму в canvas. Резолвится, когда весь мир загружен и смеширован. */
export async function mountDiorama(
	canvas: HTMLCanvasElement,
	config: SceneConfig,
	options: MountOptions,
): Promise<DioramaController> {
	const renderer = await createRenderer(canvas);
	const stage = new Stage(renderer, config);
	const materials = createWorldMaterials();
	let pool: MesherPool | null = null;
	let userPaused = false;
	let disposed = false;

	const resize = (): void => stage.resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();

	const loop = (): void => stage.render();
	const syncLoop = (): void => {
		const running = !userPaused && !document.hidden && !disposed;
		void renderer.setAnimationLoop(running ? loop : null);
	};
	document.addEventListener('visibilitychange', syncLoop);
	syncLoop();

	const loadWorld = async (url: string, progressive: boolean): Promise<void> => {
		const report = options.onProgress;
		const bytes = await fetchBytes(url, (p) => report?.(p * 0.5));
		const { world, materials: palette } = await decodeVxb(bytes);
		pool?.dispose();
		const meshPool = new MesherPool(buildPaletteLUT(palette));
		pool = meshPool;
		const target = progressive ? stage.world : new Group();
		try {
			await meshWorld(world, meshPool, target, materials, (f) => report?.(0.5 + 0.5 * f));
		} finally {
			// Воркеры нужны только на время мешинга.
			meshPool.dispose();
			if (pool === meshPool) pool = null;
		}
		if (!progressive) stage.replaceWorld(target);
	};

	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		void renderer.setAnimationLoop(null);
		observer.disconnect();
		document.removeEventListener('visibilitychange', syncLoop);
		pool?.dispose();
		stage.dispose();
		for (const material of Object.values(materials)) material.dispose();
		renderer.dispose();
	};

	try {
		await loadWorld(options.url, true);
	} catch (error) {
		dispose();
		throw error;
	}

	return {
		backend: backendName(renderer),
		get paused() {
			return userPaused;
		},
		setTime: (time) => stage.setTime(time),
		pause() {
			userPaused = true;
			syncLoop();
		},
		resume() {
			userPaused = false;
			syncLoop();
		},
		reloadWorld: (url) => loadWorld(url, false),
		async captureThumbnail({ width = 1200, height = 800, quality = 0.9 } = {}) {
			const previousRatio = renderer.getPixelRatio();
			renderer.setPixelRatio(1);
			stage.resize(width, height);
			try {
				// render и toBlob в одной задаче — буфер кадра ещё не сброшен.
				return await new Promise<Blob>((resolve, reject) => {
					stage.render();
					canvas.toBlob(
						(blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob вернул null'))),
						'image/webp',
						quality,
					);
				});
			} finally {
				renderer.setPixelRatio(previousRatio);
				resize();
			}
		},
		dispose,
	};
}
```

- [ ] **Step 8: Типы и линт**

Run: `bun run format && bun run check:types && bun test`
Expected: `0 ERRORS`, все тесты зелёные. Если `@types/three` ругается на конкретный метод (например, сигнатуру `uniform(new Color())`), сверьтесь с `node_modules/@types/three/src/nodes/...` и поправьте тип точечно (`as` у значения, а не `any`). Рендер визуально проверяется в Task 14.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(engine): add WebGPU renderer, stage, sky and mountDiorama

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Dev-плагины Vite: запекание на лету и приём скриншотов

**Files:**
- Create: `vite/diorama-dev.ts`, `vite/thumbnail.ts`
- Modify: `vite.config.ts`
- Test: `vite/plugins.test.ts`

**Interfaces:**
- Consumes: `SLUG_RE` (Task 2), `bakeToVxb` и `Diorama` через `server.ssrLoadModule('/src/sdk/bake.ts')` (Task 9).
- Produces:
  - `GET /baked/<slug>.vxb` в dev: запекает диораму на лету, кэширует до изменения модуля, при ошибке отвечает 500 с текстом ошибки.
  - HMR-событие `diorama:update` с `{ slug: string }`: при изменении `src/dioramas/<slug>/…` приходит этот slug, при изменении `src/sdk/…` приходит `'*'`.
  - `POST /__dev/thumb/<slug>` (тело — `image/webp`) пишет `static/thumbs/<slug>.webp` и отвечает `{ ok, path, bytes }` или `{ ok: false, error }` (400/404/413/415).
  - Чистые функции `parseBakedPath(url)`, `slugFromChangedFile(root, file)`, `parseThumbPath(url)`, `isWebp(bytes)`.

- [ ] **Step 1: Падающие тесты**

`vite/plugins.test.ts`:

```ts
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
```

- [ ] **Step 2: Тесты падают**

Run: `bun test vite`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Реализация**

`vite/diorama-dev.ts`:

```ts
import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';
import { SLUG_RE } from '../src/sdk/slug.ts';

type BakeModule = typeof import('../src/sdk/bake.ts');
type DioramaModule = { default: import('../src/sdk/schema.ts').Diorama };

/** `/<slug>.vxb[?…]` → slug (после того как middleware срезал префикс /baked). */
export function parseBakedPath(url: string): string | null {
	const match = /^\/([^/?]+)\.vxb(?:\?.*)?$/.exec(url);
	const slug = match?.[1];
	return slug && SLUG_RE.test(slug) ? slug : null;
}

/** Какую диораму затронуло изменение файла: slug, '*' (всё SDK) или null. */
export function slugFromChangedFile(root: string, file: string): string | null {
	const rel = relative(root, file).split(sep).join('/');
	const match = /^src\/dioramas\/([^/]+)\//.exec(rel);
	if (match?.[1]) return match[1];
	if (rel.startsWith('src/sdk/')) return '*';
	return null;
}

/** Dev: запекание диорам на лету и HMR-событие `diorama:update`. */
export function dioramaDev(): Plugin {
	return {
		name: 'diorama-dev',
		apply: 'serve',
		configureServer(server) {
			const cache = new Map<string, { source: unknown; bytes: Uint8Array }>();

			server.middlewares.use('/baked', async (req, res, next) => {
				const slug = parseBakedPath(req.url ?? '');
				if (!slug) return next();
				const entry = `/src/dioramas/${slug}/index.ts`;
				if (!existsSync(join(server.config.root, entry))) {
					res.statusCode = 404;
					res.end(`диорама "${slug}" не найдена`);
					return;
				}
				try {
					const mod = (await server.ssrLoadModule(entry)) as DioramaModule;
					let hit = cache.get(slug);
					if (!hit || hit.source !== mod.default) {
						const { bakeToVxb } = (await server.ssrLoadModule('/src/sdk/bake.ts')) as BakeModule;
						const { bytes } = await bakeToVxb(mod.default);
						hit = { source: mod.default, bytes };
						cache.set(slug, hit);
					}
					res.setHeader('Content-Type', 'application/octet-stream');
					res.setHeader('Content-Length', String(hit.bytes.length));
					res.setHeader('Cache-Control', 'no-store');
					res.end(hit.bytes);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					server.config.logger.error(`[diorama-dev] ${slug}: ${message}`);
					res.statusCode = 500;
					res.setHeader('Content-Type', 'text/plain; charset=utf-8');
					res.end(message);
				}
			});

			server.watcher.on('change', (file) => {
				const slug = slugFromChangedFile(server.config.root, file);
				if (slug) server.ws.send({ type: 'custom', event: 'diorama:update', data: { slug } });
			});
		},
	};
}
```

`vite/thumbnail.ts`:

```ts
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { SLUG_RE } from '../src/sdk/slug.ts';

export const THUMB_MAX_BYTES = 8 * 1024 * 1024;

/** `/<slug>[/]` → slug (после среза префикса /__dev/thumb). */
export function parseThumbPath(url: string): string | null {
	const match = /^\/([^/?]+)\/?(?:\?.*)?$/.exec(url);
	const slug = match?.[1];
	return slug && SLUG_RE.test(slug) ? slug : null;
}

export function isWebp(bytes: Uint8Array): boolean {
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
	return bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
}

/** Dev: принимает скриншот диорамы и кладёт его в static/thumbs/<slug>.webp. */
export function thumbnailDev(): Plugin {
	return {
		name: 'thumbnail-dev',
		apply: 'serve',
		configureServer(server) {
			server.middlewares.use('/__dev/thumb', async (req, res, next) => {
				if (req.method !== 'POST') return next();
				const reply = (status: number, body: object) => {
					res.statusCode = status;
					res.setHeader('Content-Type', 'application/json; charset=utf-8');
					res.end(JSON.stringify(body));
				};
				const slug = parseThumbPath(req.url ?? '');
				if (!slug) return reply(400, { ok: false, error: 'некорректный slug' });
				const root = server.config.root;
				if (!existsSync(join(root, 'src/dioramas', slug, 'index.ts'))) {
					return reply(404, { ok: false, error: `диорама "${slug}" не найдена` });
				}
				const chunks: Buffer[] = [];
				let size = 0;
				for await (const chunk of req) {
					const buffer = Buffer.from(chunk as Uint8Array);
					size += buffer.length;
					if (size > THUMB_MAX_BYTES) return reply(413, { ok: false, error: 'слишком большой файл' });
					chunks.push(buffer);
				}
				const bytes = new Uint8Array(Buffer.concat(chunks));
				if (!isWebp(bytes)) return reply(415, { ok: false, error: 'ожидается image/webp' });
				const dir = join(root, 'static/thumbs');
				await mkdir(dir, { recursive: true });
				await writeFile(join(dir, `${slug}.webp`), bytes);
				reply(200, { ok: true, path: `static/thumbs/${slug}.webp`, bytes: bytes.length });
			});
		},
	};
}
```

`vite.config.ts`: подключить плагины **перед** `sveltekit(...)`:

```ts
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { dioramaDev } from './vite/diorama-dev.ts';
import { thumbnailDev } from './vite/thumbnail.ts';

export default defineConfig({
	plugins: [
		dioramaDev(),
		thumbnailDev(),
		sveltekit({
			compilerOptions: {
				// Runes-режим для всего проекта, кроме библиотек.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
			},
			adapter: adapter({ strict: true }),
			// Абсолютные URL (og:image) при prerender. На деплое задаётся SITE_ORIGIN.
			paths: { origin: process.env.SITE_ORIGIN ?? 'http://localhost:5173' },
		}),
	],
});
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test vite`
Expected: PASS (4 теста).

- [ ] **Step 5: Проверить middleware вживую**

```bash
bun run dev --port 5173 --strictPort &
sleep 4
curl -s -o /tmp/qv.vxb -w '%{http_code} %{size_download}\n' http://localhost:5173/baked/quiet-valley.vxb
head -c 4 /tmp/qv.vxb | xxd
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/baked/nope.vxb
curl -s -X POST --data 'hello' http://localhost:5173/__dev/thumb/quiet-valley
kill %1
```

Expected: первый запрос — `200 <размер>`, в начале файла `5658 4201` (`VXB\x01`); `nope` → `404`; POST не-webp → `{"ok":false,"error":"ожидается image/webp"}`.

- [ ] **Step 6: Commit**

```bash
bun run format
git add -A
git commit -m "feat(dev): bake dioramas on the fly and accept thumbnails in dev server

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Сайт: главная, карточка, вьюер

**Files:**
- Create: `src/lib/types.ts`, `src/lib/format.ts`, `src/lib/server/thumbs.ts`, `src/lib/server/dioramas.ts`, `src/lib/components/DioramaCard.svelte`, `src/lib/components/Viewer.svelte`, `src/app.css`, `src/routes/+page.server.ts`, `src/routes/d/[slug]/+page.server.ts`, `src/routes/d/[slug]/+page.svelte`
- Modify: `src/app.d.ts`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/lib/assets/favicon.svg`
- Test: `src/lib/format.test.ts`, `src/lib/server/thumbs.test.ts`

**Interfaces:**
- Consumes: `#sdk`: `Diorama`, `toSceneConfig`, `slugFromDioramaPath`; `#engine`: `mountDiorama`, `DioramaController`, `SceneConfig`, `TimeOfDay`.
- Produces:
  - `interface CardData { slug; title; createdAt; description; tags: string[]; thumb: string | null }`, `interface ViewerPayload { card: CardData; scene: SceneConfig }`
  - `formatDate(iso: string): string` (`'2026-10-06'` → `'6 октября 2026 г.'`)
  - `thumbUrl(slug, staticDir = 'static'): string | null` → `/thumbs/<slug>.webp?v=<mtime>`
  - `dioramas`, `listCards()`, `getViewerPayload(slug)`
  - Вьюер: `data-status="loading|ready|error|unsupported"` на корневом `.viewer`; режим `?capture` без UI и без автовращения; в dev `window.__diorama = { slug, setTime, saveThumbnail() }`.

- [ ] **Step 1: Падающие тесты**

`src/lib/format.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { formatDate } from './format.ts';

test('formatDate по-русски и без сдвига часового пояса', () => {
	const s = formatDate('2026-10-06');
	expect(s).toContain('6 октября');
	expect(s).toContain('2026');
	expect(formatDate('2027-01-01')).toContain('1 января');
});
```

`src/lib/server/thumbs.test.ts`:

```ts
import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { thumbUrl } from './thumbs.ts';

const dir = mkdtempSync(join(tmpdir(), 'thumbs-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('нет скриншота → null', () => {
	expect(thumbUrl('quiet-valley', dir)).toBeNull();
});

test('есть скриншот → URL с версией для сброса кэша', () => {
	mkdirSync(join(dir, 'thumbs'));
	writeFileSync(join(dir, 'thumbs', 'quiet-valley.webp'), 'x');
	expect(thumbUrl('quiet-valley', dir)).toMatch(/^\/thumbs\/quiet-valley\.webp\?v=\d+$/);
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/lib`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Типы, формат даты, серверные данные**

`src/lib/types.ts`:

```ts
import type { SceneConfig } from '#engine';

export interface CardData {
	slug: string;
	title: string;
	createdAt: string;
	description: string;
	tags: string[];
	/** URL скриншота или null, если его ещё нет. */
	thumb: string | null;
}

export interface ViewerPayload {
	card: CardData;
	scene: SceneConfig;
}
```

`src/lib/format.ts`:

```ts
const formatter = new Intl.DateTimeFormat('ru-RU', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC',
});

/** 'YYYY-MM-DD' → «6 октября 2026 г.» — одинаково на сервере и в браузере. */
export function formatDate(iso: string): string {
	return formatter.format(new Date(`${iso}T00:00:00Z`));
}
```

`src/lib/server/thumbs.ts`:

```ts
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** URL скриншота с версией по mtime (чтобы браузер не держал старую картинку) или null. */
export function thumbUrl(slug: string, staticDir = 'static'): string | null {
	const file = join(staticDir, 'thumbs', `${slug}.webp`);
	if (!existsSync(file)) return null;
	return `/thumbs/${slug}.webp?v=${Math.round(statSync(file).mtimeMs)}`;
}
```

`src/lib/server/dioramas.ts`:

```ts
import { type Diorama, slugFromDioramaPath, toSceneConfig } from '#sdk';
import type { CardData, ViewerPayload } from '../types.ts';
import { thumbUrl } from './thumbs.ts';

const modules = import.meta.glob<{ default: Diorama }>('../../dioramas/*/index.ts', {
	eager: true,
});

/** Все диорамы, новые сверху. */
export const dioramas: Array<{ slug: string; diorama: Diorama }> = Object.entries(modules)
	.flatMap(([path, mod]) => {
		const slug = slugFromDioramaPath(path);
		return slug ? [{ slug, diorama: mod.default }] : [];
	})
	.sort(
		(a, b) =>
			b.diorama.meta.createdAt.localeCompare(a.diorama.meta.createdAt) ||
			a.diorama.meta.title.localeCompare(b.diorama.meta.title, 'ru'),
	);

function toCard(slug: string, d: Diorama): CardData {
	return {
		slug,
		title: d.meta.title,
		createdAt: d.meta.createdAt,
		description: d.meta.description,
		tags: d.meta.tags,
		thumb: thumbUrl(slug),
	};
}

export function listCards(): CardData[] {
	return dioramas.map(({ slug, diorama }) => toCard(slug, diorama));
}

export function getViewerPayload(slug: string): ViewerPayload | null {
	const entry = dioramas.find((e) => e.slug === slug);
	return entry
		? { card: toCard(entry.slug, entry.diorama), scene: toSceneConfig(entry.diorama) }
		: null;
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/lib`
Expected: PASS (3 теста).

- [ ] **Step 5: Глобальные стили, layout, тип `window.__diorama`, favicon**

`src/app.css`:

```css
:root {
	color-scheme: dark;
	--bg: #0e0f13;
	--surface: #171920;
	--surface-2: #1f222b;
	--text: #ece9e4;
	--muted: #8d919c;
	--accent: #f2b84b;
	--radius: 14px;
	font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
	background: var(--bg);
	color: var(--text);
}

* {
	box-sizing: border-box;
}

body {
	margin: 0;
	min-height: 100dvh;
}

a {
	color: inherit;
	text-decoration: none;
}
```

`src/app.d.ts`:

```ts
/// <reference types="vite/client" />
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { TimeOfDay } from '#engine';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		/** Только в dev: хуки агента для скриншотов и проверки сцены. */
		__diorama?: {
			slug: string;
			setTime(time: TimeOfDay): void;
			saveThumbnail(): Promise<{ ok: boolean; path?: string; bytes?: number; error?: string }>;
		};
	}
}

export {};
```

`src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
```

`src/lib/assets/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#f2b84b" d="M16 3 28 9.5 16 16 4 9.5z"/><path fill="#c98a2b" d="M4 9.5 16 16v13L4 22.5z"/><path fill="#8f5f1c" d="M28 9.5 16 16v13l12-6.5z"/></svg>
```

- [ ] **Step 6: Главная и карточка**

`src/routes/+page.server.ts`:

```ts
import { listCards } from '#lib/server/dioramas.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ cards: listCards() });
```

`src/lib/components/DioramaCard.svelte`:

```svelte
<script lang="ts">
	import { formatDate } from '#lib/format.ts';
	import type { CardData } from '#lib/types.ts';

	let { card }: { card: CardData } = $props();
</script>

<a class="card" href="/d/{card.slug}">
	<div class="thumb">
		{#if card.thumb}
			<img src={card.thumb} alt={card.title} loading="lazy" width="1200" height="800" />
		{:else}
			<div class="placeholder" aria-hidden="true"></div>
		{/if}
	</div>
	<div class="body">
		<h2>{card.title}</h2>
		<time datetime={card.createdAt}>{formatDate(card.createdAt)}</time>
		{#if card.tags.length > 0}
			<ul class="tags">
				{#each card.tags as tag (tag)}
					<li>{tag}</li>
				{/each}
			</ul>
		{/if}
	</div>
</a>

<style>
	.card {
		display: block;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}
	.card:hover {
		transform: translateY(-3px);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.35);
	}
	.thumb {
		aspect-ratio: 3 / 2;
		background: var(--surface-2);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.placeholder {
		width: 100%;
		height: 100%;
		background:
			linear-gradient(135deg, transparent 45%, rgb(242 184 75 / 0.25) 45% 55%, transparent 55%),
			var(--surface-2);
	}
	.body {
		padding: 14px 16px 16px;
	}
	h2 {
		font-size: 17px;
		margin: 0 0 4px;
	}
	time {
		color: var(--muted);
		font-size: 13px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		list-style: none;
		padding: 0;
		margin: 10px 0 0;
	}
	.tags li {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
	}
</style>
```

`src/routes/+page.svelte`:

```svelte
<script lang="ts">
	import DioramaCard from '#lib/components/DioramaCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Воксельные диорамы</title>
	<meta name="description" content="Галерея воксельных диорам — открой любую и покрути в 3D" />
</svelte:head>

<main>
	<header>
		<h1>Воксельные диорамы</h1>
		<p>Маленькие миры из кубиков — открой любой и покрути в 3D.</p>
	</header>

	{#if data.cards.length === 0}
		<p class="empty">Пока ни одной диорамы.</p>
	{:else}
		<ul class="grid">
			{#each data.cards as card (card.slug)}
				<li><DioramaCard {card} /></li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 48px 20px 80px;
	}
	h1 {
		font-size: clamp(28px, 5vw, 44px);
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}
	header p {
		color: var(--muted);
		margin: 0 0 36px;
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 20px;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}
	.empty {
		color: var(--muted);
	}
</style>
```

- [ ] **Step 7: Страница и компонент вьюера**

`src/routes/d/[slug]/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { dioramas, getViewerPayload } from '#lib/server/dioramas.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => dioramas.map(({ slug }) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const payload = getViewerPayload(params.slug);
	if (!payload) error(404, 'Диорама не найдена');
	return payload;
};
```

`src/routes/d/[slug]/+page.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/state';
	import Viewer from '#lib/components/Viewer.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const ogImage = $derived(data.card.thumb ? new URL(data.card.thumb, page.url.origin).href : null);
</script>

<svelte:head>
	<title>{data.card.title} — Воксельные диорамы</title>
	<meta name="description" content={data.card.description || data.card.title} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={data.card.title} />
	<meta property="og:description" content={data.card.description} />
	<meta property="og:url" content={page.url.href} />
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
</svelte:head>

{#key data.card.slug}
	<Viewer card={data.card} scene={data.scene} />
{/key}
```

`src/lib/components/Viewer.svelte`:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { dev } from '$app/env';
	import { invalidateAll } from '$app/navigation';
	import type { DioramaController, SceneConfig } from '#engine';
	import type { CardData } from '#lib/types.ts';

	let { card, scene }: { card: CardData; scene: SceneConfig } = $props();

	type Status = 'loading' | 'ready' | 'error' | 'unsupported';

	let canvas: HTMLCanvasElement | undefined = $state();
	let status = $state<Status>('loading');
	let progress = $state(0);
	let errorMessage = $state('');
	let paused = $state(false);
	let capture = $state(false);
	let controller = $state.raw<DioramaController | null>(null);

	const worldUrl = (bust: boolean) => `/baked/${card.slug}.vxb${bust ? `?t=${Date.now()}` : ''}`;

	// После HMR-обновления данных подхватываем новое время суток.
	$effect(() => {
		controller?.setTime(scene.time);
	});

	function exposeDevApi(ctl: DioramaController): void {
		window.__diorama = {
			slug: card.slug,
			setTime: (time) => ctl.setTime(time),
			async saveThumbnail() {
				const blob = await ctl.captureThumbnail({ width: 1200, height: 800 });
				const response = await fetch(`/__dev/thumb/${card.slug}`, {
					method: 'POST',
					body: blob,
					headers: { 'Content-Type': 'image/webp' },
				});
				return await response.json();
			},
		};
	}

	async function reload(): Promise<void> {
		if (!controller) return;
		try {
			await controller.reloadWorld(worldUrl(true));
			await invalidateAll();
		} catch (error) {
			console.error('[diorama] не удалось перезагрузить мир', error);
		}
	}

	onMount(() => {
		let disposed = false;
		capture = new URLSearchParams(location.search).has('capture');
		const config: SceneConfig = capture
			? { ...scene, camera: { ...scene.camera, autoRotate: false } }
			: scene;

		(async () => {
			if (!canvas) return;
			try {
				const engine = await import('#engine');
				const ctl = await engine.mountDiorama(canvas, config, {
					url: worldUrl(dev),
					onProgress: (p) => {
						progress = p;
					},
				});
				if (disposed) {
					ctl.dispose();
					return;
				}
				controller = ctl;
				status = 'ready';
				if (dev) exposeDevApi(ctl);
			} catch (error) {
				if (disposed) return;
				console.error(error);
				errorMessage = error instanceof Error ? error.message : String(error);
				status = error instanceof Error && error.name === 'NoGraphicsError' ? 'unsupported' : 'error';
			}
		})();

		const onUpdate = (data: { slug: string }) => {
			if (data.slug === card.slug || data.slug === '*') void reload();
		};
		import.meta.hot?.on('diorama:update', onUpdate);

		return () => {
			disposed = true;
			import.meta.hot?.off('diorama:update', onUpdate);
			controller?.dispose();
			controller = null;
			window.__diorama = undefined;
		};
	});

	function togglePause(): void {
		if (!controller) return;
		if (paused) controller.resume();
		else controller.pause();
		paused = !paused;
	}

	function toggleFullscreen(): void {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void document.documentElement.requestFullscreen();
	}
</script>

<div class="viewer" class:capture data-status={status}>
	<canvas bind:this={canvas}></canvas>

	{#if status === 'loading'}
		<div class="overlay">
			{#if card.thumb}<img class="backdrop" src={card.thumb} alt="" aria-hidden="true" />{/if}
			<div class="panel">
				<span>Загрузка… {Math.round(progress * 100)}%</span>
				<div class="bar"><div style:width="{progress * 100}%"></div></div>
			</div>
		</div>
	{:else if status === 'unsupported'}
		<div class="overlay">
			{#if card.thumb}<img class="backdrop sharp" src={card.thumb} alt={card.title} />{/if}
			<div class="panel">
				<p>Браузер не поддерживает WebGPU или WebGL2, поэтому вместо 3D — снимок диорамы.</p>
			</div>
		</div>
	{:else if status === 'error'}
		<div class="overlay">
			<div class="panel">
				<p>Не удалось загрузить диораму.</p>
				<p class="detail">{errorMessage}</p>
				<button type="button" onclick={() => location.reload()}>Повторить</button>
			</div>
		</div>
	{/if}

	{#if !capture}
		<header class="hud top">
			<a class="back" href="/">← Все диорамы</a>
			<h1>{card.title}</h1>
		</header>
		{#if status === 'ready'}
			<div class="hud bottom">
				<button type="button" onclick={togglePause} aria-label={paused ? 'Продолжить' : 'Пауза'}>
					{paused ? '▶' : '❚❚'}
				</button>
				<button type="button" onclick={toggleFullscreen} aria-label="Во весь экран">⛶</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.viewer {
		position: fixed;
		inset: 0;
		background: var(--bg);
	}
	canvas {
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
	}
	.overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(18px) brightness(0.6);
		transform: scale(1.1);
	}
	.backdrop.sharp {
		filter: none;
		transform: none;
	}
	.panel {
		position: relative;
		max-width: min(90vw, 420px);
		padding: 18px 22px;
		border-radius: var(--radius);
		background: rgb(14 15 19 / 0.75);
		backdrop-filter: blur(8px);
		text-align: center;
	}
	.panel p {
		margin: 0 0 8px;
	}
	.detail {
		color: var(--muted);
		font-size: 13px;
	}
	.bar {
		margin-top: 10px;
		width: 240px;
		height: 4px;
		border-radius: 2px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar div {
		height: 100%;
		background: var(--accent);
		transition: width 0.15s linear;
	}
	.hud {
		position: absolute;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: var(--radius);
		background: rgb(14 15 19 / 0.55);
		backdrop-filter: blur(8px);
	}
	.top {
		top: 16px;
		left: 16px;
	}
	.top h1 {
		font-size: 16px;
		margin: 0;
	}
	.back {
		color: var(--muted);
		font-size: 14px;
	}
	.back:hover {
		color: var(--text);
	}
	.bottom {
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
	}
	button {
		min-width: 36px;
		height: 36px;
		border: 0;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--text);
		font-size: 15px;
		cursor: pointer;
	}
	button:hover {
		background: #2a2e39;
	}
</style>
```

- [ ] **Step 8: Типы, линт, тесты**

Run: `bun run format && bun run check`
Expected: всё зелёное.

- [ ] **Step 9: Визуальная проверка в браузере T3**

1. Запустить dev-сервер в фоне (Bash `run_in_background`): `bun run dev --port 5173 --strictPort`.
2. `preview_open` → `preview_navigate` на `{ kind: 'environment-port', port: 5173, path: '/' }` → `preview_snapshot`. Ожидается тёмная главная с одной карточкой «Тихая долина» (пока с плейсхолдером), датой «6 октября 2026 г.» и тегами.
3. `preview_click` по карточке → `preview_wait_for` с локатором `[data-status="ready"]` (timeout 60000) → `preview_snapshot`. Ожидается 3D-диорама: холмы, озеро, домик, деревья, закатное небо, мягкие тени, AO в углах. Проверить, что HUD сверху и кнопки снизу на месте.
4. `preview_evaluate`: `({ backend: document.querySelector('.viewer')?.dataset.status })` и проверить консоль в результате snapshot: ошибок нет.
5. Покрутить камеру: `preview_scroll` (zoom) и `preview_snapshot`.
6. Проверить HMR: в `src/dioramas/quiet-valley/index.ts` временно поменять `count: 28` на `count: 5` → через 2–3 с `preview_snapshot` показывает меньше деревьев без перезагрузки страницы → вернуть `28`.
7. `preview_resize` `{ mode: 'preset', preset: 'iphone-12-pro' }` → `preview_snapshot`: вьюер на весь экран, HUD не перекрывает центр. Вернуть `{ mode: 'fill' }`.

Если сцена тёмная или пересвеченная, подкрутить `LIGHTING` в `src/engine/atmosphere/presets.ts`. Если на поверхностях видна «лесенка» теней (shadow acne), увеличить `normalBias` в `stage.ts`. Это допустимые правки в рамках задачи.

- [ ] **Step 10: Commit**

```bash
bun run format
git add -A
git commit -m "feat(site): add gallery home, diorama cards and 3D viewer page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Скриншот демо, CLAUDE.md, skill `new-diorama`, финальная сборка

**Files:**
- Create: `static/thumbs/quiet-valley.webp` (генерируется), `CLAUDE.md`, `.claude/skills/new-diorama/SKILL.md`

**Interfaces:**
- Consumes: всё из Task 1–14.
- Produces: инструкции, по которым агент создаёт диорамы по запросу пользователя.

- [ ] **Step 1: Сделать скриншот демо-диорамы**

Dev-сервер запущен (Task 14). В превью T3:
1. `preview_resize` `{ mode: 'freeform', width: 1200, height: 800 }`.
2. `preview_navigate` на `/d/quiet-valley?capture` → `preview_wait_for` `[data-status="ready"]`.
3. `preview_evaluate`: `await window.__diorama.saveThumbnail()` → ожидается `{ ok: true, path: 'static/thumbs/quiet-valley.webp', bytes: … }`.
4. Проверить файл: `ls -la static/thumbs/quiet-valley.webp` (больше 10 КБ) и открыть его через Read, чтобы увидеть картинку. Ожидается кадр диорамы, а не чёрный или пустой прямоугольник.
5. `preview_resize` `{ mode: 'fill' }`, `preview_navigate` на `/` → карточка теперь со скриншотом.

Если файл чёрный или пустой: `canvas.toBlob` на этом бэкенде отдаёт сброшенный буфер. Исправление в `captureThumbnail` (`src/engine/index.ts`): сразу после `stage.render()` скопировать кадр во временный 2D-canvas (`const copy = document.createElement('canvas'); copy.width = width; copy.height = height; copy.getContext('2d')?.drawImage(canvas, 0, 0);`) и вызвать `toBlob` уже у `copy`. Затем повторить шаги 2–4.

- [ ] **Step 2: `CLAUDE.md`**

```markdown
# Voxel Diorama

Публичная витрина воксельных диорам: главная с карточками → 3D-вьюер. Новые диорамы создаёт агент по запросу пользователя — см. skill `new-diorama` (`.claude/skills/new-diorama/SKILL.md`).

Спек: `docs/superpowers/specs/2026-10-06-voxel-diorama-design.md`.

## Стек

Bun · SvelteKit 3 + Svelte 5 (runes) · Vite 8 · Three.js (`WebGPURenderer` + TSL, fallback WebGL2) · zod 4 · Biome · svelte-check.

## Команды

| Команда | Что делает |
|---|---|
| `bun run dev` | dev-сервер; диорамы запекаются на лету, правки диорам прилетают во вьюер через HMR |
| `bun run diorama:new <slug> "Название"` | создать диораму из шаблона |
| `bun run diorama:check [slug] [--no-types]` | типы + валидация + запекание + статистика и предупреждения |
| `bun run check` | Biome + svelte-check + все тесты |
| `bun run format` | автоформатирование Biome |
| `bun run build` | запекание всех диорам в `static/baked` + статическая сборка в `build/` |

## Структура

- `src/engine/` — 3D-движок (Three.js), **не импортирует Svelte**. Публичное API — `#engine` (`mountDiorama`).
- `src/sdk/` — API диорам (`defineDiorama`, builder, `prefabs`), **не импортирует three**. Публичное API — `#sdk`.
- `src/dioramas/<slug>/index.ts` — контент: одна папка = одна диорама, `export default defineDiorama({…})`.
- `src/lib/`, `src/routes/` — сайт (всё prerender).
- `vite/` — dev-плагины (запекание `/baked/<slug>.vxb`, приём скриншотов `POST /__dev/thumb/<slug>`).
- `scripts/` — CLI для агента. `static/thumbs/<slug>.webp` — скриншоты карточек.

## Правила

- Y вверх, целые координаты, 1 воксель = 1 единица. Чанк 32³, ≤ 255 материалов на диораму.
- В `src/sdk` и `src/dioramas` **нельзя `Math.random`** — только `w.rng` (детерминизм запекания).
- Диорамы импортируют только `#sdk`. Поля `entities` / `particles` / `lights` появятся на этапах 2–3; сейчас схема их отвергает.
- Импорты: внутри `src/engine`, `src/sdk`, `scripts`, `vite` — относительные с `.ts`; в `src/lib`/`src/routes` — `#lib/...ts`, `#sdk`, `#engine`.
- Three.js — только из `three/webgpu`, `three/tsl`, `three/addons/...`.
- SvelteKit 3: конфиг кита в `vite.config.ts`, окружение — `$app/env`.
- Скриншоты и визуальные проверки — через встроенный браузер T3 (`preview_*`), Playwright не используем.
- Тесты — `bun test`, рядом с кодом (`*.test.ts`). Перед коммитом — `bun run format && bun run check`.
```

- [ ] **Step 3: `.claude/skills/new-diorama/SKILL.md`**

````markdown
---
name: new-diorama
description: Use when the user asks to create, add or generate a new voxel diorama for the site (e.g. "сделай диораму …", "добавь диораму с …"). Covers concept, code, validation, visual review in the T3 preview and the card thumbnail.
---

# Новая диорама

Результат: папка `src/dioramas/<slug>/` с диорамой, которая проходит проверки, хорошо выглядит и имеет скриншот `static/thumbs/<slug>.webp`.

## 1. Замысел (коротко, в чате)

Опиши в 3–5 строках: что на сцене и композиция (центр внимания, передний/задний план), палитра (5–10 материалов), время суток (`dawn | day | sunset | night`), размер мира. Если запрос размытый — задай 1–2 вопроса, иначе решай сам и иди дальше.

Ориентиры по размеру: компактная сцена 48–64 по X/Z, деревня 96, ландшафт 160–256. Высота — с запасом над самым высоким объектом.

## 2. Код

```bash
bun run diorama:new <slug> "Название"
```

Пиши `src/dioramas/<slug>/index.ts`. Что есть в SDK (`#sdk`):

- `w.set / box / sphere / cylinder / line / clear` — примитивы; материал `'air'` вырезает.
- `w.terrain({ noise: 'flat' | 'hills' | 'mountains', base, amp, scale, top, fill })`, `w.water({ level })`.
- `w.place(model, [x, y, z], { rotate })` — `[x, y, z]` это **нижний центр** модели.
- `w.scatter(prefabs.tree, { count, on: 'grass', minDistance, area })` — ставит на поверхность; всегда указывай `on`.
- `w.heightAt(x, z)` — верхний твёрдый воксель колонки; `w.get(p)` — имя материала.
- `w.rng` (`int`, `float`, `pick`, `chance`, `fork`), `w.noise` (`value`, `fbm`). **Никакого `Math.random`.**
- `prefabs.tree | pine | house | rock` (опции цвета/размера, `rng`).
- Своя модель: `model({ size: [x, y, z], palette: { … } }, (m) => { … })` — тот же набор примитивов. Если модель универсальна (пригодится в других диорамах) — вынеси её в `src/sdk/prefabs/` с тестом в `prefabs.test.ts`.
- Материалы: `'#rrggbb'` или `{ color, emissive, kind: 'solid' | 'water' | 'glass' }`. Светящееся (окна, фонари, лава) — `emissive` 0.5–2.
- Корневые поля: `meta`, `seed`, `size`, `palette`, `build`, `atmosphere: { time: { fixed }, fog }` (туман 0.002–0.01), `camera`, `base: 'none' | 'wood' | 'stone'`.

## 3. Проверка

```bash
bun run diorama:check <slug>
```

Повторяй, пока не будет `✓ ok`. Предупреждения разбирай: «неиспользуемые материалы» — убери из палитры; «мир пустой» — ошибка в build; много «за границами» — увеличь `size` или сдвинь объекты (немного — норма для scatter у краёв).

## 4. Визуальное ревью в превью T3

1. Dev-сервер: если не запущен — `bun run dev --port 5173 --strictPort` в фоне.
2. `preview_navigate` → `{ kind: 'environment-port', port: 5173, path: '/d/<slug>' }`, затем `preview_wait_for` с `[data-status="ready"]` (timeout 60000), затем `preview_snapshot`.
3. Посмотри 2–3 ракурса (`preview_scroll` для зума, `preview_evaluate` с `window.__diorama.setTime('night')` для другого времени суток).
4. Чеклист:
   - силуэт читается, есть центр внимания, сцена не пустая и не перегруженная;
   - палитра гармоничная, контраст между материалами достаточный;
   - нет висящих в воздухе вокселей и деревьев в воде/на крышах;
   - масштаб объектов согласован (дом выше человека, деревья не гигантские);
   - в консоли нет ошибок (смотри diagnostics в snapshot).
5. Правь код — вьюер обновится сам (HMR). 3–5 итераций максимум; если не выходит — покажи пользователю текущее состояние и спроси.

## 5. Скриншот для карточки

1. `preview_resize` → `{ mode: 'freeform', width: 1200, height: 800 }`.
2. `preview_navigate` → `/d/<slug>?capture`, затем `preview_wait_for` с `[data-status="ready"]`.
3. `preview_evaluate` → `await window.__diorama.saveThumbnail()` → ожидается `{ ok: true }`.
4. Открой `static/thumbs/<slug>.webp` через Read — убедись, что кадр удачный (иначе поправь `camera` в диораме и повтори).
5. `preview_resize` → `{ mode: 'fill' }`.

## 6. Финал

```bash
bun run format && bun run check
```

Покажи пользователю скриншот (`![](абсолютный/путь/к/static/thumbs/<slug>.webp)`) и 2–3 строки о сцене. **Коммит — только по команде пользователя.**
````

- [ ] **Step 4: Финальная проверка**

```bash
bun run format && bun run check
SITE_ORIGIN=https://example.com bun run build
ls build/d/ build/baked/ build/thumbs/
grep -o 'og:image" content="[^"]*"' build/d/quiet-valley.html
```

Expected:
- `check` зелёный.
- Сборка пишет `Wrote site to "build"`.
- Есть `build/d/quiet-valley.html`, `build/baked/quiet-valley.vxb`, `build/thumbs/quiet-valley.webp`.
- `og:image` — абсолютный URL `https://example.com/thumbs/quiet-valley.webp?v=…`.

Затем `bun run preview --port 4173` в фоне, в превью T3 открыть `http://localhost:4173/` → перейти в диораму → `[data-status="ready"]`. Это проверка, что статическая сборка работает без dev-плагинов. Остановить preview-сервер и dev-сервер.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add demo thumbnail, CLAUDE.md and new-diorama skill

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
