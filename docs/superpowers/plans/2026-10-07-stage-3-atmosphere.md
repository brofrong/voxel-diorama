# Этап 3 «Атмосфера» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Живое время суток с плавным светом, 4 варианта неба, меню настроек во вьюере, частицы и точечный свет, вода и стекло, bloom/GTAO/CSM, уровни качества; демо «Зимняя ночь».

**Architecture:** Чистая математика времени суток, качества, частиц и мерцания — в небольших модулях без three (тестируются `bun test`). Движок держит «часы суток» и общие uniform'ы атмосферы (`time`, `night`, `emissiveScale`, `horizon`, `waves`), которыми питаются материалы, небо, частицы и свет. SDK описывает частицы и свет фабриками и разворачивает их в `EmitterSpec`/`LightSpec` (как сущности на этапе 2). Вьюер получает меню настроек и передаёт движку фабрику атмосферы.

**Tech Stack:** Bun 1.4, SvelteKit 3 + Svelte 5, Vite 8, Three.js r186 (`three/webgpu`, `three/tsl`, `three/addons/...`: `SkyMesh`, `BloomNode`, `GTAONode`, `FXAANode`, `CSMShadowNode`, `RenderPipeline`), zod 4, Biome 2.5.

**Spec:** `docs/superpowers/specs/2026-10-07-stage-3-atmosphere-design.md` (+ спеки этапов 1 и 2)

## Global Constraints

- Всё из этапов 1–2 в силе: только Bun; SvelteKit 3 (`$app/env`); алиасы `#lib/…ts`, `#sdk`, `#engine`; внутри `src/engine`, `src/sdk`, `scripts`, `vite` — относительные импорты с `.ts`; Three.js только из `three/webgpu`, `three/tsl`, `three/addons/...`; Biome (табы, ширина 100, одинарные кавычки), `bun run format && bun run check` перед коммитом; UI-текст и сообщения об ошибках — по-русски; коммиты — Conventional Commits с трейлером `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- `src/sdk` не импортирует `three`; `src/engine` не импортирует `#sdk`, `zod`, Svelte, `#lib`. Чистые модули движка (`daycycle.ts`, `quality.ts`, `particles/math.ts`, `light-math.ts`, `atmosphere/layout.ts`) не импортируют `three` вовсе.
- **Детерминизм:** всё анимированное (вода, частицы, мерцание, облака) зависит только от часов анимации и seed — не от `performance.now()`, не от TSL-узла `time`. В `?capture` часы анимации = `captureTime`, час суток = `time.start`, качество = `high`.
- Время суток: часы 0–24; скорости ровно `0 | 0.5 | 1 | 1.5 | 2`; `cycle` 30..3600 с; синонимы `dawn` 6.5, `day` 13, `sunset` 18.5, `night` 23; по умолчанию `{ start: 13, speed: 0, cycle: 120 }`; старое `{ fixed: X }` = `{ start: X, speed: 0, cycle: 120 }`.
- Небо: `'gradient' | 'solid' | 'realistic' | 'stylized'` или `{ kind: 'solid', color: '#rrggbb' }`, по умолчанию `gradient`.
- Лимиты: ≤ 32 эмиттеров, ≤ 20 000 частиц (на high), ≤ 8 точечных источников.
- Плотность частиц по качеству: low 0.3, medium 0.6, high 1.
- `localStorage['voxel-diorama:settings']` хранит только `{ quality, particles, autoRotate }`.

## Отклонения от спека этапа 3 (осознанные)

1. **Дуга солнца — от восхода в 5 до заката в 19** (спек: 6 → 18): `a = (hour − 5) / 14 · π`. Иначе в «закат» 18.5 солнце уже под горизонтом, и закатный свет шёл бы со стороны луны. Опорные точки палитры сдвинуты соответственно: `0 ночь · 4 ночь · 6.5 рассвет · 9 день · 17 день · 18.5 закат · 20.5 ночь · 24 ночь`.
2. **`emissiveScale = 0.6 + 0.9 · night`** (спек: 0.3…1.5) — чтобы окна в существующих закатных диорамах не потускнели сильно.
3. **Качество — опция `mountDiorama`, а не поле `SceneConfig`** (это настройка зрителя, не диорамы).
4. **Bloom на medium и high одинаковый** — `BloomNode` r186 и так работает в половинном разрешении; medium отличается от high отсутствием GTAO/CSM и MSAA×2.
5. **Вода:** нормали волн считаются аналитически только для верхних граней; френель смешивает цвет воды с цветом горизонта по часу.
6. **Частицы:** у дождя добавлено вытягивание кубика по высоте (`stretch`), иначе капли выглядят как снег.
7. **GTAO без MRT-нормалей:** нормали восстанавливаются из глубины (`ao(depth, null, camera)`) — проще и совместимо с MSAA-проходом.

## Review Focus

1. **Старая диорама с `time: { fixed: 'sunset' }`** («Тихая долина») → тот же час 18.5, время стоит, небо `gradient`; ничего не ломается. Тесты: Task 2 (нормализация), Task 11 (регрессия на реальной диораме).
2. **Мусор или старый формат в `localStorage`** → значения по умолчанию, без исключения. Тест: Task 10.
3. **Перетаскивание ползунка, пока время идёт, и переход 23:59 → 0:00** → после отпускания время продолжает идти с выставленного часа, без скачков и отрицательных часов. Тесты: Task 1 (`DayClock`).
4. **`attachTo` с id сущности из нескольких экземпляров (`birds`) или с опечаткой** → понятная ошибка с подсказкой `birds[0]…`. Тест: Task 6.
5. **Снег/дождь над водой или без рельефа; огромная `intensity`** → частицы исчезают на уровне земли (0, если колонка пустая); превышение 20 000 — понятная ошибка. Тесты: Task 6 (лимит), Task 8 (`applyGround`).

---

## Карта файлов

```
src/engine/types.ts                         TimeConfig, SkyConfig, QualitySetting/Level, EmitterSpec, LightSpec, Atmosphere*  — T1, T2, T6
src/engine/atmosphere/daycycle.ts           синонимы, солнце/луна, ночной коэффициент, палитра, DayClock            — T1
src/engine/atmosphere/random.ts             mulberry32 (детерминизм звёзд/облаков без SDK)                         — T3
src/engine/atmosphere/layout.ts             расстановка звёзд и облаков (чистые функции)                           — T3
src/engine/atmosphere/skies.ts              4 варианта неба (SkyView)                                              — T3
src/engine/atmosphere/sky.ts                (удаляется: градиент переезжает в skies.ts)                            — T3
src/engine/render/uniforms.ts               общие uniform'ы атмосферы                                              — T2
src/engine/render/materials.ts              emissiveScale; вода и стекло                                           — T2, T5
src/engine/render/stage.ts                  setHour, setSky, setQuality, setAutoRotate                             — T2, T3, T4, T10
src/engine/render/quality.ts                уровни качества, pickQuality, shouldDowngrade (чистые)                 — T4
src/engine/render/pipeline.ts               RenderPipeline: GTAO, bloom, FXAA                                      — T4
src/engine/voxel/heightmap.ts               + columns/width/depth                                                  — T8
src/engine/particles/math.ts                эталонная математика частиц (чистая)                                   — T8
src/engine/particles/layer.ts               ParticleLayer (TSL)                                                    — T8
src/engine/light-math.ts                    flickerFactor (чистая)                                                 — T9
src/engine/lights.ts                        LightLayer                                                             — T9
src/engine/entities/layer.ts                + ids, positionOf                                                      — T8
src/engine/index.ts                         часы суток, качество, атмосфера, новые методы контроллера              — T2–T4, T8–T10
src/sdk/atmosphere/config.ts                нормализация time/sky (схема)                                          — T2
src/sdk/atmosphere/particles.ts             пресеты частиц                                                         — T6
src/sdk/atmosphere/lights.ts                pointLight                                                             — T6
src/sdk/atmosphere/runtime.ts               createAtmosphereRuntime, ATMOSPHERE_LIMITS                             — T6
src/sdk/atmosphere/index.ts, src/sdk/index.ts                                                                      — T6
src/sdk/schema.ts                           time, sky, particles, lights                                           — T2, T6
src/sdk/prefabs/{lantern,campfire}.ts, house.ts                                                                    — T7
src/lib/client/settings.ts                  настройки зрителя (чистые)                                             — T10
src/lib/components/SettingsPanel.svelte     меню                                                                   — T10
src/lib/components/Viewer.svelte            атмосфера, меню, reduced motion                                        — T2, T3, T8, T10
src/sdk/atmosphere/check.ts, scripts/diorama-check.ts, src/dioramas/content.test.ts                              — T11
src/dioramas/winter-night/index.ts, src/dioramas/river-mill/index.ts, static/thumbs/*                            — T12
CLAUDE.md, .claude/skills/new-diorama/SKILL.md                                                                    — T13
```

---
### Task 1: Время суток — чистая математика

**Files:**
- Modify: `src/engine/types.ts` (только новые типы)
- Create: `src/engine/atmosphere/daycycle.ts`
- Test: `src/engine/atmosphere/daycycle.test.ts`

**Interfaces:**
- Consumes: `LIGHTING`, `LightingPreset` (`src/engine/atmosphere/presets.ts`), `hexToRgb8`, `rgb8ToHex` (`src/engine/voxel/palette.ts`).
- Produces (`types.ts`): `interface TimeConfig { start: number; speed: number; cycle: number }`, `type SkyKind = 'gradient' | 'solid' | 'realistic' | 'stylized'`, `interface SkyConfig { kind: SkyKind; color?: string }`.
- Produces (`daycycle.ts`): `TIME_SYNONYMS`, `TIME_SPEEDS`, `DEFAULT_TIME`, `wrapHour(h)`, `hourAt(elapsed, time)`, `sunDirection(hour): Vec3`, `moonDirection(hour): Vec3`, `sunElevation(hour)`, `nightFactor(hour)`, `emissiveScale(night)`, `type Palette`, `paletteAt(hour): Palette`, `directionalLight(hour): { direction: Vec3; intensityFactor: number }`, `class DayClock { constructor(time: TimeConfig); readonly cycle; get hour(); get speed(); advance(dt); setHour(h); setSpeed(x); reset(time) }`.

- [ ] **Step 1: Падающие тесты**

`src/engine/atmosphere/daycycle.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { hexToRgb8 } from '../voxel/palette.ts';
import {
	DayClock,
	directionalLight,
	emissiveScale,
	hourAt,
	nightFactor,
	paletteAt,
	sunDirection,
	sunElevation,
	TIME_SYNONYMS,
	wrapHour,
} from './daycycle.ts';
import { LIGHTING } from './presets.ts';

describe('солнце и ночь', () => {
	test('восход в 5 на +x, полдень высоко, закат в 19 на −x', () => {
		expect(sunDirection(5)[0]).toBeGreaterThan(0.9);
		expect(sunElevation(5)).toBeCloseTo(0, 6);
		expect(sunDirection(12)[1]).toBeGreaterThan(0.9);
		expect(sunDirection(19)[0]).toBeLessThan(-0.9);
		expect(sunElevation(19)).toBeCloseTo(0, 6);
		const d = sunDirection(9);
		expect(Math.hypot(...d)).toBeCloseTo(1, 6);
	});

	test('закат 18.5 — солнце ещё над горизонтом, ночь 23 — под', () => {
		expect(sunElevation(TIME_SYNONYMS.sunset)).toBeGreaterThan(0);
		expect(sunElevation(TIME_SYNONYMS.night)).toBeLessThan(0);
	});

	test('ночной коэффициент: 0 днём, 1 ночью, 0.5 на горизонте', () => {
		expect(nightFactor(12)).toBe(0);
		expect(nightFactor(0)).toBe(1);
		expect(nightFactor(5)).toBeCloseTo(0.5, 6);
	});

	test('emissiveScale от 0.6 до 1.5', () => {
		expect(emissiveScale(0)).toBeCloseTo(0.6, 6);
		expect(emissiveScale(1)).toBeCloseTo(1.5, 6);
	});

	test('направленный свет: днём солнце, ночью луна, у горизонта гаснет', () => {
		expect(directionalLight(12).intensityFactor).toBe(1);
		expect(directionalLight(12).direction[1]).toBeGreaterThan(0.9);
		const night = directionalLight(0);
		expect(night.direction[1]).toBeGreaterThan(0.5);
		expect(night.intensityFactor).toBe(1);
		expect(directionalLight(5).intensityFactor).toBeCloseTo(0, 6);
	});
});

describe('палитра', () => {
	test('опорные точки совпадают с пресетами', () => {
		expect(paletteAt(13).horizon).toBe(LIGHTING.day.horizon);
		expect(paletteAt(18.5).sunColor).toBe(LIGHTING.sunset.sunColor);
		expect(paletteAt(6.5).zenith).toBe(LIGHTING.dawn.zenith);
		expect(paletteAt(2).fog).toBe(LIGHTING.night.fog);
		expect(paletteAt(24)).toEqual(paletteAt(0));
	});

	test('непрерывна: шаг 0.01 ч не даёт скачков', () => {
		let prev = paletteAt(0);
		for (let h = 0.01; h <= 24; h += 0.01) {
			const cur = paletteAt(h);
			expect(Math.abs(cur.sunIntensity - prev.sunIntensity)).toBeLessThan(0.05);
			const a = hexToRgb8(cur.horizon);
			const b = hexToRgb8(prev.horizon);
			for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(3);
			prev = cur;
		}
	});
});

describe('часы суток', () => {
	test('hourAt: стоп, ход и переход через полночь', () => {
		expect(hourAt(100, { start: 13, speed: 0, cycle: 120 })).toBe(13);
		expect(hourAt(60, { start: 13, speed: 1, cycle: 120 })).toBeCloseTo(1, 6);
		expect(hourAt(30, { start: 22, speed: 2, cycle: 120 })).toBeCloseTo(10, 6);
		expect(wrapHour(-1)).toBe(23);
		expect(wrapHour(24)).toBe(0);
	});

	test('DayClock: setHour во время хода — время идёт дальше с нового часа', () => {
		const clock = new DayClock({ start: 10, speed: 1, cycle: 240 });
		clock.advance(10);
		expect(clock.hour).toBeCloseTo(11, 6);
		clock.setHour(23.9);
		expect(clock.hour).toBeCloseTo(23.9, 6);
		clock.advance(2);
		expect(clock.hour).toBeCloseTo(0.1, 6);
	});

	test('DayClock: смена скорости сохраняет текущий час', () => {
		const clock = new DayClock({ start: 8, speed: 1, cycle: 120 });
		clock.advance(5);
		const h = clock.hour;
		clock.setSpeed(0);
		clock.advance(100);
		expect(clock.hour).toBeCloseTo(h, 6);
		clock.setSpeed(2);
		clock.advance(5);
		expect(clock.hour).toBeCloseTo(h + 2, 6);
	});

	test('DayClock.reset возвращает настройки диорамы', () => {
		const clock = new DayClock({ start: 8, speed: 1, cycle: 120 });
		clock.advance(30);
		clock.reset({ start: 18.5, speed: 0, cycle: 60 });
		expect(clock.hour).toBe(18.5);
		expect(clock.speed).toBe(0);
		expect(clock.cycle).toBe(60);
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/atmosphere`
Expected: FAIL — `Cannot find module './daycycle.ts'`.

- [ ] **Step 3: Типы в `src/engine/types.ts`** (добавить, ничего не меняя)

```ts
/** Время суток диорамы: час начала, скорость (×), длина суток в секундах при 1x. */
export interface TimeConfig {
	start: number;
	speed: number;
	cycle: number;
}

export type SkyKind = 'gradient' | 'solid' | 'realistic' | 'stylized';

export interface SkyConfig {
	kind: SkyKind;
	/** Только для `solid`: фиксированный цвет фона. */
	color?: string;
}
```

- [ ] **Step 4: `src/engine/atmosphere/daycycle.ts`**

```ts
import type { TimeConfig, TimeOfDay, Vec3 } from '../types.ts';
import { hexToRgb8, rgb8ToHex } from '../voxel/palette.ts';
import { LIGHTING, type LightingPreset } from './presets.ts';

/** Синонимы часа для авторов диорам. */
export const TIME_SYNONYMS: Readonly<Record<TimeOfDay, number>> = {
	dawn: 6.5,
	day: 13,
	sunset: 18.5,
	night: 23,
};

export const TIME_SPEEDS = [0, 0.5, 1, 1.5, 2] as const;

export const DEFAULT_TIME: TimeConfig = { start: 13, speed: 0, cycle: 120 };

export const wrapHour = (hour: number): number => ((hour % 24) + 24) % 24;

/** Час суток через `elapsed` секунд часов анимации. */
export function hourAt(elapsed: number, time: TimeConfig): number {
	return wrapHour(time.start + (elapsed * time.speed * 24) / time.cycle);
}

const SUNRISE = 5;
const DAY_LENGTH = 14;

const sunAngle = (hour: number): number => ((hour - SUNRISE) / DAY_LENGTH) * Math.PI;

/** Направление «от сцены к солнцу»: восход с +x, полдень сверху с наклоном к +z, закат на −x. */
export function sunDirection(hour: number): Vec3 {
	const a = sunAngle(wrapHour(hour));
	const x = Math.cos(a);
	const y = Math.sin(a);
	const z = 0.35;
	const len = Math.hypot(x, y, z);
	return [x / len, y / len, z / len];
}

/** Луна — напротив солнца по дуге (в полночь высоко). */
export function moonDirection(hour: number): Vec3 {
	const a = sunAngle(wrapHour(hour));
	const x = -Math.cos(a);
	const y = -Math.sin(a);
	const z = 0.35;
	const len = Math.hypot(x, y, z);
	return [x / len, y / len, z / len];
}

export const sunElevation = (hour: number): number => Math.sin(sunAngle(wrapHour(hour)));

const smoothstep = (a: number, b: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** 0 — день, 1 — ночь; плавно около горизонта. */
export const nightFactor = (hour: number): number => 1 - smoothstep(-0.12, 0.12, sunElevation(hour));

/** Множитель свечения материалов (окна ярче ночью). */
export const emissiveScale = (night: number): number => 0.6 + 0.9 * night;

/** Источник тени: солнце над горизонтом, иначе луна; у горизонта яркость гаснет. */
export function directionalLight(hour: number): { direction: Vec3; intensityFactor: number } {
	const e = sunElevation(hour);
	const direction = e >= 0 ? sunDirection(hour) : moonDirection(hour);
	return { direction, intensityFactor: Math.min(1, Math.abs(e) / 0.1) };
}

export type Palette = Omit<LightingPreset, 'sunDirection'>;

const KEYS: ReadonlyArray<readonly [number, TimeOfDay]> = [
	[0, 'night'],
	[4, 'night'],
	[6.5, 'dawn'],
	[9, 'day'],
	[17, 'day'],
	[18.5, 'sunset'],
	[20.5, 'night'],
	[24, 'night'],
];

const COLOR_FIELDS = ['sunColor', 'hemiSky', 'hemiGround', 'zenith', 'horizon', 'fog'] as const;
const NUMBER_FIELDS = ['sunIntensity', 'hemiIntensity', 'exposure'] as const;

function mixHex(a: string, b: string, k: number): string {
	const x = hexToRgb8(a);
	const y = hexToRgb8(b);
	return rgb8ToHex(
		Math.round(x[0] + (y[0] - x[0]) * k),
		Math.round(x[1] + (y[1] - x[1]) * k),
		Math.round(x[2] + (y[2] - x[2]) * k),
	);
}

/** Цвета и яркости освещения в данный час (линейно между опорными точками). */
export function paletteAt(hour: number): Palette {
	const h = wrapHour(hour);
	let i = 0;
	while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
	const [h0, n0] = KEYS[i];
	const [h1, n1] = KEYS[i + 1];
	const k = (h - h0) / (h1 - h0);
	const a = LIGHTING[n0];
	const b = LIGHTING[n1];
	const out = {} as Palette;
	for (const f of COLOR_FIELDS) out[f] = mixHex(a[f], b[f], k);
	for (const f of NUMBER_FIELDS) out[f] = a[f] + (b[f] - a[f]) * k;
	return out;
}

/** Часы суток: старт, скорость, длина суток; переживают смену скорости и ручную установку часа. */
export class DayClock {
	private start: number;
	private elapsed = 0;
	private currentSpeed: number;
	cycle: number;

	constructor(time: TimeConfig) {
		this.start = wrapHour(time.start);
		this.currentSpeed = time.speed;
		this.cycle = time.cycle;
	}

	get hour(): number {
		return hourAt(this.elapsed, { start: this.start, speed: this.currentSpeed, cycle: this.cycle });
	}

	get speed(): number {
		return this.currentSpeed;
	}

	advance(dt: number): void {
		this.elapsed += dt;
	}

	setHour(hour: number): void {
		this.start = wrapHour(hour);
		this.elapsed = 0;
	}

	setSpeed(speed: number): void {
		this.start = this.hour;
		this.elapsed = 0;
		this.currentSpeed = speed;
	}

	reset(time: TimeConfig): void {
		this.start = wrapHour(time.start);
		this.currentSpeed = time.speed;
		this.cycle = time.cycle;
		this.elapsed = 0;
	}
}
```

- [ ] **Step 5: Тесты проходят**

Run: `bun test src/engine/atmosphere`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "feat(engine): add continuous day-cycle math and DayClock

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Время суток в схеме, движке и вьюере

**Files:**
- Create: `src/sdk/atmosphere/config.ts`, `src/engine/render/uniforms.ts`
- Modify: `src/engine/types.ts` (`SceneConfig`), `src/sdk/schema.ts`, `src/engine/render/materials.ts`, `src/engine/render/stage.ts`, `src/engine/index.ts`, `src/lib/components/Viewer.svelte`
- Test: `src/sdk/atmosphere/config.test.ts`, `src/sdk/schema.test.ts`

**Interfaces:**
- Consumes: всё из Task 1.
- Produces:
  - `SceneConfig.time: TimeConfig` (было `TimeOfDay`), `SceneConfig.sky: SkyConfig`, `SceneConfig.seed: number`.
  - `Diorama['atmosphere']` = `{ time: TimeConfig; sky: SkyConfig; fog: number }`.
  - `isTimeInput`, `normalizeTime`, `isSkyInput`, `normalizeSky`, `TIME_ERROR`, `SKY_ERROR` (`src/sdk/atmosphere/config.ts`).
  - `interface AtmosphereUniforms { time; night; emissiveScale; horizon; waves }`, `createAtmosphereUniforms()` (`src/engine/render/uniforms.ts`).
  - `createWorldMaterials(u: AtmosphereUniforms)`.
  - `Stage` конструктор `(renderer, config, uniforms)`, `stage.setHour(hour)` (вместо `setTime`).
  - Контроллер: `setHour(h)`, `getHour()`, `setTimeSpeed(x)`, `getTimeSpeed()`, `setTime(name)` (синоним).

- [ ] **Step 1: Падающие тесты**

`src/sdk/atmosphere/config.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { isSkyInput, isTimeInput, normalizeSky, normalizeTime } from './config.ts';

describe('time', () => {
	test('по умолчанию — день, время стоит', () => {
		expect(normalizeTime(undefined)).toEqual({ start: 13, speed: 0, cycle: 120 });
	});

	test('старое { fixed } — синоним часа, скорость 0', () => {
		expect(normalizeTime({ fixed: 'sunset' })).toEqual({ start: 18.5, speed: 0, cycle: 120 });
	});

	test('новое { start, speed, cycle } с синонимом и частичными полями', () => {
		expect(normalizeTime({ start: 'night', speed: 0.5 })).toEqual({ start: 23, speed: 0.5, cycle: 120 });
		expect(normalizeTime({ start: 21, speed: 1, cycle: 180 })).toEqual({ start: 21, speed: 1, cycle: 180 });
	});

	test('неверные значения отвергаются', () => {
		for (const bad of [
			{ start: 25 },
			{ start: -1 },
			{ speed: 3 },
			{ speed: 0.7 },
			{ cycle: 10 },
			{ fixed: 'noon' },
			{ fixed: 'day', speed: 1 },
			{ start: 12, extra: 1 },
			'sunset',
			null,
		]) {
			expect(isTimeInput(bad)).toBe(false);
		}
		expect(isTimeInput({ start: 0, speed: 2, cycle: 3600 })).toBe(true);
	});
});

describe('sky', () => {
	test('строки и solid с цветом', () => {
		expect(normalizeSky(undefined)).toEqual({ kind: 'gradient' });
		expect(normalizeSky('stylized')).toEqual({ kind: 'stylized' });
		expect(normalizeSky({ kind: 'solid', color: '#AABBCC' })).toEqual({ kind: 'solid', color: '#aabbcc' });
	});

	test('неверное небо отвергается', () => {
		for (const bad of ['space', { kind: 'solid', color: 'red' }, { kind: 'gradient', color: '#ffffff' }, 5]) {
			expect(isSkyInput(bad)).toBe(false);
		}
	});
});
```

Добавить в `src/sdk/schema.test.ts` (внутрь `describe('defineDiorama')` и `describe('toSceneConfig')` соответственно):

```ts
	test('атмосфера по умолчанию: день, время стоит, небо градиент', () => {
		const d = defineDiorama(minimal());
		expect(d.atmosphere).toEqual({
			time: { start: 13, speed: 0, cycle: 120 },
			sky: { kind: 'gradient' },
			fog: 0,
		});
	});

	test('неверное время — понятная ошибка', () => {
		const input = { ...minimal(), atmosphere: { time: { speed: 3 } } } as unknown as DioramaInput;
		expect(() => defineDiorama(input)).toThrow('time: ожидается');
	});
```

```ts
	test('SceneConfig получает время, небо и seed', () => {
		const scene = toSceneConfig(
			defineDiorama({ ...minimal(), seed: 9, atmosphere: { time: { fixed: 'night' }, sky: 'realistic' } }),
		);
		expect(scene.time).toEqual({ start: 23, speed: 0, cycle: 120 });
		expect(scene.sky).toEqual({ kind: 'realistic' });
		expect(scene.seed).toBe(9);
	});
```

Существующие тесты, которые ожидают `scene.time === 'day'` или `atmosphere: { time: { fixed: 'day' }, fog: 0 }`, обновить под новую форму (это изменение интерфейса из спека).

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk`
Expected: FAIL — модуль `./config.ts` не найден, схемы не совпадают.

- [ ] **Step 3: `src/sdk/atmosphere/config.ts`**

```ts
import { DEFAULT_TIME, TIME_SPEEDS, TIME_SYNONYMS } from '../../engine/atmosphere/daycycle.ts';
import type { SkyConfig, SkyKind, TimeConfig, TimeOfDay } from '../../engine/types.ts';
import { HEX_COLOR } from '../materials.ts';

export type TimeInput =
	| { fixed: TimeOfDay }
	| { start?: number | TimeOfDay; speed?: number; cycle?: number };

export type SkyInput = SkyKind | { kind: SkyKind; color?: string };

export const TIME_ERROR =
	'time: ожидается { start: 0..24 или "dawn" | "day" | "sunset" | "night", speed: 0 | 0.5 | 1 | 1.5 | 2, cycle: 30..3600 } или { fixed: "dawn" | "day" | "sunset" | "night" }';

export const SKY_ERROR =
	'sky: ожидается "gradient" | "solid" | "realistic" | "stylized" или { kind: "solid", color: "#rrggbb" }';

const SKY_KINDS: readonly SkyKind[] = ['gradient', 'solid', 'realistic', 'stylized'];

const isSynonym = (v: unknown): v is TimeOfDay => typeof v === 'string' && v in TIME_SYNONYMS;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

export function isTimeInput(v: unknown): v is TimeInput {
	if (!isRecord(v)) return false;
	const keys = Object.keys(v);
	if ('fixed' in v) return keys.length === 1 && isSynonym(v.fixed);
	if (!keys.every((k) => k === 'start' || k === 'speed' || k === 'cycle')) return false;
	const { start, speed, cycle } = v;
	if (start !== undefined) {
		const ok = isSynonym(start) || (typeof start === 'number' && start >= 0 && start <= 24);
		if (!ok) return false;
	}
	if (speed !== undefined && !(TIME_SPEEDS as readonly unknown[]).includes(speed)) return false;
	if (cycle !== undefined && !(typeof cycle === 'number' && cycle >= 30 && cycle <= 3600)) return false;
	return true;
}

export function normalizeTime(v: TimeInput | undefined): TimeConfig {
	if (v === undefined) return { ...DEFAULT_TIME };
	if ('fixed' in v) return { start: TIME_SYNONYMS[v.fixed], speed: 0, cycle: DEFAULT_TIME.cycle };
	const start = v.start === undefined ? DEFAULT_TIME.start : isSynonym(v.start) ? TIME_SYNONYMS[v.start] : v.start;
	return { start, speed: v.speed ?? DEFAULT_TIME.speed, cycle: v.cycle ?? DEFAULT_TIME.cycle };
}

export function isSkyInput(v: unknown): v is SkyInput {
	if (typeof v === 'string') return (SKY_KINDS as readonly string[]).includes(v);
	if (!isRecord(v)) return false;
	if (!(SKY_KINDS as readonly unknown[]).includes(v.kind)) return false;
	const keys = Object.keys(v);
	if (v.kind !== 'solid') return keys.length === 1;
	if (!keys.every((k) => k === 'kind' || k === 'color')) return false;
	return v.color === undefined || (typeof v.color === 'string' && HEX_COLOR.test(v.color));
}

export function normalizeSky(v: SkyInput | undefined): SkyConfig {
	if (v === undefined) return { kind: 'gradient' };
	if (typeof v === 'string') return { kind: v };
	return v.color === undefined ? { kind: v.kind } : { kind: v.kind, color: v.color.toLowerCase() };
}
```

- [ ] **Step 4: Схема (`src/sdk/schema.ts`)**

Импорт: `import { isSkyInput, isTimeInput, normalizeSky, normalizeTime, SKY_ERROR, type SkyInput, TIME_ERROR, type TimeInput } from './atmosphere/config.ts';`

Заменить блок `atmosphere`:

```ts
	atmosphere: z
		.strictObject({
			time: z
				.custom<TimeInput>((v) => v === undefined || isTimeInput(v), TIME_ERROR)
				.optional()
				.transform((v) => normalizeTime(v)),
			sky: z
				.custom<SkyInput>((v) => v === undefined || isSkyInput(v), SKY_ERROR)
				.optional()
				.transform((v) => normalizeSky(v)),
			fog: z.number().min(0).max(0.05).default(0),
		})
		.prefault({}),
```

В `toSceneConfig` заменить `time: d.atmosphere.time.fixed,` на:

```ts
		time: d.atmosphere.time,
		sky: d.atmosphere.sky,
		seed: d.seed,
```

- [ ] **Step 5: `SceneConfig` в `src/engine/types.ts`**

```ts
export interface SceneConfig {
	size: Vec3;
	time: TimeConfig;
	sky: SkyConfig;
	/** Seed диорамы — для звёзд и облаков неба. */
	seed: number;
	fog: number;
	camera: CameraConfig;
	base: BaseStyle;
	/** Время анимации (с), на котором замирает режим скриншота `?capture`. */
	captureTime: number;
}
```

(`TimeOfDay` остаётся — это синонимы.)

- [ ] **Step 6: Uniform'ы и материалы**

`src/engine/render/uniforms.ts`:

```ts
import { uniform } from 'three/tsl';
import { Color } from 'three/webgpu';

/** Общие для материалов, неба и частиц параметры атмосферы; обновляются раз в кадр. */
export interface AtmosphereUniforms {
	/** Часы анимации, секунды. */
	time: ReturnType<typeof uniform<number>>;
	/** Ночной коэффициент 0..1. */
	night: ReturnType<typeof uniform<number>>;
	/** Множитель свечения материалов. */
	emissiveScale: ReturnType<typeof uniform<number>>;
	/** Цвет горизонта (для френеля воды). */
	horizon: ReturnType<typeof uniform<Color>>;
	/** 1 — волны на воде, 0 — плоская вода (качество low). */
	waves: ReturnType<typeof uniform<number>>;
}

export function createAtmosphereUniforms(): AtmosphereUniforms {
	return {
		time: uniform(0),
		night: uniform(0),
		emissiveScale: uniform(1),
		horizon: uniform(new Color('#bcd8f5')),
		waves: uniform(1),
	};
}
```

В `src/engine/render/materials.ts`: `createVoxelMaterial(layer, u: AtmosphereUniforms)` — `material.emissiveNode = color.mul(attribute('emissive', 'float')).mul(u.emissiveScale);`; `createWorldMaterials(u: AtmosphereUniforms)` передаёт `u` всем трём слоям. (Вода и стекло меняются в Task 5.)

- [ ] **Step 7: `Stage.setHour`**

В `src/engine/render/stage.ts`:
- конструктор `(renderer, config, private readonly uniforms: AtmosphereUniforms)`;
- импорт `directionalLight, emissiveScale, nightFactor, paletteAt` из `../atmosphere/daycycle.ts`; убрать импорт `LIGHTING`;
- заменить метод `setTime` на:

```ts
	setHour(hour: number): void {
		const p = paletteAt(hour);
		const light = directionalLight(hour);
		const night = nightFactor(hour);
		const direction = new Vector3(...light.direction);
		this.sun.position.copy(this.center).addScaledVector(direction, this.radius * 2);
		this.sun.target.position.copy(this.center);
		this.sun.color.set(p.sunColor);
		this.sun.intensity = p.sunIntensity * light.intensityFactor;
		this.hemi.color.set(p.hemiSky);
		this.hemi.groundColor.set(p.hemiGround);
		this.hemi.intensity = p.hemiIntensity;
		this.sky.setColors(p.zenith, p.horizon);
		this.fog.color.set(p.fog);
		this.renderer.toneMappingExposure = p.exposure;
		this.uniforms.night.value = night;
		this.uniforms.emissiveScale.value = emissiveScale(night);
		this.uniforms.horizon.value.set(p.horizon);
	}
```

- в конце конструктора `this.setHour(config.time.start);` вместо `setTime`.

- [ ] **Step 8: Часы суток в `src/engine/index.ts`**

- Импорты: `DayClock, TIME_SYNONYMS` из `./atmosphere/daycycle.ts`, `createAtmosphereUniforms` из `./render/uniforms.ts`; экспорт типов `SkyConfig, SkyKind, TimeConfig` из `./types.ts`.
- После `createRenderer`:

```ts
	const uniforms = createAtmosphereUniforms();
	const stage = new Stage(renderer, config, uniforms);
	const materials = createWorldMaterials(uniforms);
	const capture = options.fixedTime !== undefined;
	const clock = new DayClock(config.time);
	const currentHour = (): number => (capture ? config.time.start : clock.hour);
```

- `frame()`:

```ts
	const frame = (): void => {
		uniforms.time.value = animTime;
		stage.setHour(currentHour());
		layer?.update(animTime);
		stage.render();
	};
```

- В `loop` после вычисления `dt` (вынести `const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));`): `if (!capture) { animTime += dt; clock.advance(dt); }`.
- `rebuildEntities` сбрасывает только `animTime`, часы суток не трогает.
- `DioramaController`: заменить `setTime(time: TimeOfDay): void;` на

```ts
	/** Синоним для `setHour` (dawn 6.5, day 13, sunset 18.5, night 23). */
	setTime(time: TimeOfDay): void;
	setHour(hour: number): void;
	getHour(): number;
	setTimeSpeed(speed: number): void;
	getTimeSpeed(): number;
```

- Реализация:

```ts
		setHour(hour) {
			clock.setHour(hour);
			redrawIfIdle();
		},
		getHour: currentHour,
		setTimeSpeed(speed) {
			clock.setSpeed(speed);
		},
		getTimeSpeed: () => (capture ? 0 : clock.speed),
		setTime(time) {
			clock.setHour(TIME_SYNONYMS[time]);
			redrawIfIdle();
		},
```

- [ ] **Step 9: Вьюер**

В `src/lib/components/Viewer.svelte`:

```ts
	// Старт и скорость времени применяются без перезагрузки страницы; остальное — см. reload().
	const sceneFingerprint = (s: SceneConfig): string =>
		JSON.stringify({ ...s, time: { cycle: s.time.cycle } });

	$effect(() => {
		if (!controller) return;
		controller.setHour(scene.time.start);
		controller.setTimeSpeed(scene.time.speed);
	});
```

(заменяет прежний `$effect` с `setTime(scene.time)`.)

- [ ] **Step 10: Проверки**

```bash
bun run format && bun run check
bun run diorama:check --no-types
SITE_ORIGIN=https://example.com bun run build
```

Expected: зелёное. Визуально (контроллер): «Тихая долина» на закате выглядит как раньше (солнце чуть ниже), `__diorama.setTime('night')` даёт ночь со светящимися окнами.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: continuous time of day in schema, engine and viewer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 3: Небо — четыре варианта

**Files:**
- Create: `src/engine/atmosphere/random.ts`, `src/engine/atmosphere/layout.ts`, `src/engine/atmosphere/skies.ts`
- Delete: `src/engine/atmosphere/sky.ts`
- Modify: `src/engine/atmosphere/daycycle.ts` (экспорт `mixHex`), `src/engine/render/stage.ts`, `src/engine/index.ts`, `src/lib/components/Viewer.svelte`
- Test: `src/engine/atmosphere/layout.test.ts`

**Interfaces:**
- Consumes: `paletteAt`, `sunDirection`, `moonDirection`, `nightFactor`, `Palette` (Task 1); `SkyConfig` (Task 1); `SceneConfig.sky`, `SceneConfig.seed`, `AtmosphereUniforms` (Task 2).
- Produces:
  - `mulberry32(seed): () => number`.
  - `starLayout(seed, count?): Array<{ direction: Vec3; size: number }>`, `cloudLayout(seed, count?): CloudLayout[]`, `interface CloudLayout { angle: number; distance: number; height: number; boxes: Array<{ offset: Vec3; size: Vec3 }> }` (distance/height — доли радиуса неба).
  - `interface SkyState { palette: Palette; sunDirection: Vec3; moonDirection: Vec3; night: number; time: number }`, `interface SkyView { update(state): void; follow(position: Vector3): void; dispose(): void }`, `createSkyView(config, scene, radius, seed): SkyView`.
  - `stage.setSky(sky: SkyConfig)`, `stage.sky` (текущий `SkyConfig`); контроллер `setSky(sky: SkyConfig)`, `getSky(): SkyConfig`.

- [ ] **Step 1: Падающие тесты**

`src/engine/atmosphere/layout.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { cloudLayout, starLayout } from './layout.ts';
import { mulberry32 } from './random.ts';

describe('mulberry32', () => {
	test('детерминирован и в [0, 1)', () => {
		const a = mulberry32(5);
		const b = mulberry32(5);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v >= 0 && v < 1).toBe(true);
		}
	});
});

describe('звёзды', () => {
	test('верхняя полусфера, единичные направления, детерминированы', () => {
		const stars = starLayout(7, 300);
		expect(stars).toHaveLength(300);
		for (const s of stars) {
			expect(s.direction[1]).toBeGreaterThan(0.04);
			expect(Math.hypot(...s.direction)).toBeCloseTo(1, 6);
			expect(s.size >= 0.6 && s.size <= 1.4).toBe(true);
		}
		expect(starLayout(7, 300)).toEqual(stars);
		expect(starLayout(8, 300)).not.toEqual(stars);
	});
});

describe('облака', () => {
	test('число облаков, 3–6 кубов в каждом, детерминированы', () => {
		const clouds = cloudLayout(3, 10);
		expect(clouds).toHaveLength(10);
		for (const c of clouds) {
			expect(c.boxes.length >= 3 && c.boxes.length <= 6).toBe(true);
			expect(c.distance >= 0.45 && c.distance <= 0.8).toBe(true);
			expect(c.height >= 0.18 && c.height <= 0.32).toBe(true);
		}
		expect(cloudLayout(3, 10)).toEqual(clouds);
	});
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/atmosphere/layout.test.ts`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: `random.ts` и `layout.ts`**

`src/engine/atmosphere/random.ts`:

```ts
/** mulberry32: детерминированный генератор для неба (движок не импортирует SDK). */
export function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
```

`src/engine/atmosphere/layout.ts`:

```ts
import type { Vec3 } from '../types.ts';
import { mulberry32 } from './random.ts';

export interface StarPlacement {
	direction: Vec3;
	size: number;
}

/** Звёзды на верхней полусфере (y > 0.05). */
export function starLayout(seed: number, count = 400): StarPlacement[] {
	const rnd = mulberry32(seed ^ 0x51ed270b);
	const stars: StarPlacement[] = [];
	while (stars.length < count) {
		const y = 0.05 + 0.95 * rnd();
		const a = rnd() * Math.PI * 2;
		const r = Math.sqrt(1 - y * y);
		stars.push({ direction: [r * Math.cos(a), y, r * Math.sin(a)], size: 0.6 + 0.8 * rnd() });
	}
	return stars;
}

export interface CloudLayout {
	angle: number;
	/** Доля радиуса неба по горизонтали. */
	distance: number;
	/** Доля радиуса неба по высоте. */
	height: number;
	/** Кубы облака в единицах «размера облака» (0..1). */
	boxes: Array<{ offset: Vec3; size: Vec3 }>;
}

/** Воксельные облака: 3–6 плоских кубов на кольце вокруг диорамы. */
export function cloudLayout(seed: number, count = 10): CloudLayout[] {
	const rnd = mulberry32(seed ^ 0x2c1b3c6d);
	return Array.from({ length: count }, (_, i) => {
		const n = 3 + Math.floor(rnd() * 4);
		const boxes = Array.from({ length: n }, () => ({
			offset: [rnd() - 0.5, rnd() * 0.15, (rnd() - 0.5) * 0.6] as Vec3,
			size: [0.25 + 0.25 * rnd(), 0.08 + 0.06 * rnd(), 0.18 + 0.2 * rnd()] as Vec3,
		}));
		return {
			angle: (i / count) * Math.PI * 2 + rnd() * 0.4,
			distance: 0.45 + 0.35 * rnd(),
			height: 0.18 + 0.14 * rnd(),
			boxes,
		};
	});
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/engine/atmosphere`
Expected: PASS.

- [ ] **Step 5: `mixHex` и `skies.ts`**

В `daycycle.ts` сделать `mixHex` экспортируемой (`export function mixHex`).

`src/engine/atmosphere/skies.ts`:

```ts
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { length, mix, normalize, positionLocal, smoothstep, uniform, uv } from 'three/tsl';
import {
	BackSide,
	BoxGeometry,
	Color,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicNodeMaterial,
	PlaneGeometry,
	Quaternion,
	type Scene,
	SphereGeometry,
	Vector3,
} from 'three/webgpu';
import type { SkyConfig, Vec3 } from '../types.ts';
import { mixHex, type Palette } from './daycycle.ts';
import { cloudLayout, starLayout } from './layout.ts';

export interface SkyState {
	palette: Palette;
	sunDirection: Vec3;
	moonDirection: Vec3;
	night: number;
	/** Часы анимации, секунды. */
	time: number;
}

export interface SkyView {
	update(state: SkyState): void;
	/** Небо следует за камерой (бесконечно далёкое). */
	follow(position: Vector3): void;
	dispose(): void;
}

interface Part {
	update(state: SkyState): void;
	dispose(): void;
}

function gradientDome(root: Group, radius: number): Part {
	const zenith = uniform(new Color());
	const horizon = uniform(new Color());
	const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
	material.colorNode = mix(horizon, zenith, smoothstep(-0.05, 0.6, normalize(positionLocal).y));
	const geometry = new SphereGeometry(radius, 32, 16);
	const mesh = new Mesh(geometry, material);
	mesh.frustumCulled = false;
	mesh.renderOrder = -2;
	root.add(mesh);
	return {
		update({ palette }) {
			zenith.value.set(palette.zenith);
			horizon.value.set(palette.horizon);
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

function stars(root: Group, radius: number, seed: number): Part {
	const layout = starLayout(seed);
	const visibility = uniform(0);
	const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
	material.colorNode = uniform(new Color('#ffffff'));
	material.opacityNode = visibility;
	const geometry = new BoxGeometry(1, 1, 1);
	const mesh = new InstancedMesh(geometry, material, layout.length);
	const m = new Matrix4();
	const q = new Quaternion();
	layout.forEach((s, i) => {
		const r = radius * 0.92;
		const size = radius * 0.0025 * s.size;
		m.compose(
			new Vector3(s.direction[0] * r, s.direction[1] * r, s.direction[2] * r),
			q,
			new Vector3(size, size, size),
		);
		mesh.setMatrixAt(i, m);
	});
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	root.add(mesh);
	return {
		update({ night }) {
			visibility.value = night;
			mesh.visible = night > 0.01;
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

interface Disc extends Part {
	mesh: Mesh;
	tint: ReturnType<typeof uniform<Color>>;
	visibility: ReturnType<typeof uniform<number>>;
}

/** Круглый диск (солнце/луна): квадрат с мягким краем, повёрнутый к камере. */
function disc(root: Group, radius: number, size: number, color: string): Disc {
	const tint = uniform(new Color(color));
	const visibility = uniform(1);
	const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
	material.colorNode = tint;
	material.opacityNode = smoothstep(0.5, 0.42, length(uv().sub(0.5))).mul(visibility);
	const geometry = new PlaneGeometry(1, 1);
	const mesh = new Mesh(geometry, material);
	mesh.scale.setScalar(radius * size);
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	root.add(mesh);
	return {
		mesh,
		tint,
		visibility,
		update() {},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

function clouds(root: Group, radius: number, seed: number): Part {
	const layout = cloudLayout(seed);
	const group = new Group();
	const tint = uniform(new Color('#ffffff'));
	const material = new MeshBasicNodeMaterial({ fog: false });
	material.colorNode = tint;
	const geometry = new BoxGeometry(1, 1, 1);
	const total = layout.reduce((n, c) => n + c.boxes.length, 0);
	const mesh = new InstancedMesh(geometry, material, total);
	const m = new Matrix4();
	const q = new Quaternion();
	const cloudSize = radius * 0.18;
	let i = 0;
	for (const c of layout) {
		const cx = Math.cos(c.angle) * c.distance * radius;
		const cz = Math.sin(c.angle) * c.distance * radius;
		const cy = c.height * radius;
		for (const b of c.boxes) {
			m.compose(
				new Vector3(cx + b.offset[0] * cloudSize, cy + b.offset[1] * cloudSize, cz + b.offset[2] * cloudSize),
				q,
				new Vector3(b.size[0] * cloudSize, b.size[1] * cloudSize, b.size[2] * cloudSize),
			);
			mesh.setMatrixAt(i++, m);
		}
	}
	mesh.frustumCulled = false;
	group.add(mesh);
	root.add(group);
	return {
		update({ palette, night, time }) {
			group.rotation.y = time * 0.01;
			const day = mixHex(palette.horizon, '#ffffff', 0.6);
			tint.value.set(mixHex(day, palette.zenith, night * 0.7));
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

/** Создаёт выбранный вариант неба и добавляет его в сцену. */
export function createSkyView(config: SkyConfig, scene: Scene, radius: number, seed: number): SkyView {
	const root = new Group();
	scene.add(root);
	const parts: Part[] = [];
	let follow = (position: Vector3): void => {
		root.position.copy(position);
	};

	if (config.kind === 'gradient') parts.push(gradientDome(root, radius));

	if (config.kind === 'solid') {
		const background = new Color();
		scene.background = background;
		parts.push({
			update({ palette }) {
				background.set(config.color ?? palette.horizon);
			},
			dispose() {
				scene.background = null;
			},
		});
	}

	if (config.kind === 'realistic') {
		const sky = new SkyMesh();
		sky.scale.setScalar(radius * 0.9);
		sky.turbidity.value = 2.5;
		sky.rayleigh.value = 1.2;
		sky.mieCoefficient.value = 0.005;
		sky.mieDirectionalG.value = 0.8;
		sky.frustumCulled = false;
		sky.renderOrder = -2;
		root.add(sky);
		parts.push(
			{
				update({ sunDirection }) {
					sky.sunPosition.value.set(sunDirection[0], sunDirection[1], sunDirection[2]);
				},
				dispose() {
					sky.geometry.dispose();
					(sky.material as { dispose(): void }).dispose();
				},
			},
			stars(root, radius, seed),
		);
	}

	if (config.kind === 'stylized') {
		parts.push(gradientDome(root, radius), stars(root, radius, seed), clouds(root, radius, seed));
		const sun = disc(root, radius, 0.06, '#fff2c0');
		const moon = disc(root, radius, 0.04, '#e8ecff');
		const place = (mesh: Mesh, d: Vec3): void => {
			mesh.position.set(d[0] * radius * 0.85, d[1] * radius * 0.85, d[2] * radius * 0.85);
		};
		parts.push(sun, moon, {
			update({ palette, sunDirection, moonDirection, night }) {
				place(sun.mesh, sunDirection);
				place(moon.mesh, moonDirection);
				sun.tint.value.set(mixHex(palette.sunColor, '#ffffff', 0.3));
				sun.visibility.value = sunDirection[1] > -0.05 ? 1 - night * 0.8 : 0;
				moon.visibility.value = moonDirection[1] > -0.05 ? night : 0;
			},
			dispose() {},
		});
		const base = follow;
		follow = (position) => {
			base(position);
			sun.mesh.lookAt(position);
			moon.mesh.lookAt(position);
		};
	}

	return {
		update(state) {
			for (const part of parts) part.update(state);
		},
		follow: (position) => follow(position),
		dispose() {
			for (const part of parts) part.dispose();
			scene.remove(root);
		},
	};
}
```

- [ ] **Step 6: Stage и контроллер**

`src/engine/render/stage.ts`:
- убрать импорт и поле `sky` из `../atmosphere/sky.ts`; добавить `import { createSkyView, type SkyView } from '../atmosphere/skies.ts';` и `moonDirection, sunDirection` из daycycle;
- поля: `private skyView: SkyView; sky: SkyConfig; private skyRadius: number; private seed: number; private lastHour = 13;`
- в конструкторе вместо `createSky(...)`: `this.skyRadius = far * 0.9; this.seed = config.seed; this.sky = config.sky; this.skyView = createSkyView(config.sky, this.scene, this.skyRadius, config.seed);` и убрать `this.sky.mesh` из `scene.add(...)`;
- в `setHour` вместо `this.sky.setColors(...)`:

```ts
		this.lastHour = hour;
		this.skyView.update({
			palette: p,
			sunDirection: sunDirection(hour),
			moonDirection: moonDirection(hour),
			night,
			time: this.uniforms.time.value,
		});
```

- новый метод:

```ts
	setSky(sky: SkyConfig): void {
		if (sky.kind === this.sky.kind && sky.color === this.sky.color) return;
		this.skyView.dispose();
		this.sky = sky;
		this.skyView = createSkyView(sky, this.scene, this.skyRadius, this.seed);
		this.setHour(this.lastHour);
	}
```

- в `render()` вместо `this.sky.mesh.position.copy(...)`: `this.skyView.follow(this.camera.position);`
- в `dispose()`: `this.skyView.dispose();`
- удалить файл `src/engine/atmosphere/sky.ts`.

`src/engine/index.ts` — в `DioramaController` и реализации:

```ts
	setSky(sky: SkyConfig): void;
	getSky(): SkyConfig;
```

```ts
		setSky(sky) {
			stage.setSky(sky);
			redrawIfIdle();
		},
		getSky: () => stage.sky,
```

`Viewer.svelte`: отпечаток сцены исключает и небо — `JSON.stringify({ ...s, time: { cycle: s.time.cycle }, sky: undefined })`; в `$effect` добавить `controller.setSky(scene.sky);`.

- [ ] **Step 7: Проверки**

```bash
bun run format && bun run check
```

Визуально (контроллер): `__diorama` пока не умеет `setSky`; контроллер проверяет через временную правку `sky` в диораме и HMR — все 4 варианта отображаются, переключаются без перезагрузки, ночью видны звёзды (realistic, stylized), облака плывут (stylized).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(engine): add gradient, solid, realistic and stylized skies

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Качество, конвейер пост-обработки, тени

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/render/stage.ts`, `src/engine/index.ts`
- Create: `src/engine/render/quality.ts`, `src/engine/render/pipeline.ts`
- Test: `src/engine/render/quality.test.ts`

**Interfaces:**
- Consumes: `Stage`, `AtmosphereUniforms` (Task 2), `nightFactor` (Task 1).
- Produces:
  - `type QualityLevel = 'low' | 'medium' | 'high'`, `type QualitySetting = 'auto' | QualityLevel` (`types.ts`).
  - `QUALITY_PRESETS: Record<QualityLevel, QualityPreset>`, `interface QualityPreset { dpr; shadowMapSize; bloom; gtao; particles; waves; aa: 'fxaa' | 'msaa2' | 'msaa4'; csm }`, `interface DeviceCaps { backend: 'webgpu' | 'webgl2'; cores: number; coarsePointer: boolean }`, `pickQuality(caps)`, `resolveQuality(setting, caps, capture)`, `lowerQuality(level)`, `shouldDowngrade(frameMs): boolean | null`, `CSM_MIN_SPAN = 128`.
  - `createPipeline(renderer, scene, camera, preset): Pipeline`, `interface Pipeline { render(): void; setNight(night: number): void; dispose(): void }`.
  - `stage.setQuality(level)`, `stage.quality: QualityLevel`, `stage.preset: QualityPreset`.
  - `MountOptions.quality?: QualitySetting` (по умолчанию `'auto'`); контроллер `setQuality(setting)`, `getQuality(): { setting: QualitySetting; effective: QualityLevel }`.

- [ ] **Step 1: Падающие тесты**

`src/engine/render/quality.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import {
	lowerQuality,
	pickQuality,
	QUALITY_PRESETS,
	resolveQuality,
	shouldDowngrade,
} from './quality.ts';

const desktop = { backend: 'webgpu' as const, cores: 8, coarsePointer: false };

describe('pickQuality', () => {
	test('WebGL2 или ≤ 4 ядер — low; телефон на WebGPU — medium; иначе high', () => {
		expect(pickQuality({ ...desktop, backend: 'webgl2' })).toBe('low');
		expect(pickQuality({ ...desktop, cores: 4 })).toBe('low');
		expect(pickQuality({ ...desktop, coarsePointer: true })).toBe('medium');
		expect(pickQuality(desktop)).toBe('high');
	});

	test('resolveQuality: в режиме скриншота всегда high, ручной выбор уважается', () => {
		expect(resolveQuality('low', desktop, true)).toBe('high');
		expect(resolveQuality('auto', { ...desktop, backend: 'webgl2' }, true)).toBe('high');
		expect(resolveQuality('medium', desktop, false)).toBe('medium');
		expect(resolveQuality('auto', desktop, false)).toBe('high');
	});
});

describe('понижение', () => {
	test('lowerQuality', () => {
		expect(lowerQuality('high')).toBe('medium');
		expect(lowerQuality('medium')).toBe('low');
		expect(lowerQuality('low')).toBe('low');
	});

	test('shouldDowngrade: мало данных — null; медленно — true; нормально — false', () => {
		expect(shouldDowngrade([16, 16, 16])).toBeNull();
		expect(shouldDowngrade(Array(100).fill(40))).toBe(true);
		expect(shouldDowngrade(Array(200).fill(16))).toBe(false);
	});
});

test('пресеты соответствуют таблице спека', () => {
	expect(QUALITY_PRESETS.low).toMatchObject({ dpr: 1, shadowMapSize: 1024, bloom: false, gtao: false, particles: 0.3, waves: false, aa: 'fxaa', csm: false });
	expect(QUALITY_PRESETS.medium).toMatchObject({ dpr: 1.5, shadowMapSize: 2048, bloom: true, gtao: false, particles: 0.6, waves: true, aa: 'msaa2', csm: false });
	expect(QUALITY_PRESETS.high).toMatchObject({ dpr: 2, shadowMapSize: 2048, bloom: true, gtao: true, particles: 1, waves: true, aa: 'msaa4', csm: true });
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/render/quality.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Типы и `quality.ts`**

В `src/engine/types.ts`:

```ts
export type QualityLevel = 'low' | 'medium' | 'high';
export type QualitySetting = 'auto' | QualityLevel;
```

`src/engine/render/quality.ts`:

```ts
import type { QualityLevel, QualitySetting } from '../types.ts';

export interface QualityPreset {
	/** Максимальная плотность пикселей. */
	dpr: number;
	shadowMapSize: number;
	bloom: boolean;
	gtao: boolean;
	/** Множитель плотности частиц. */
	particles: number;
	waves: boolean;
	aa: 'fxaa' | 'msaa2' | 'msaa4';
	/** Каскадные тени для больших диорам. */
	csm: boolean;
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualityPreset>> = {
	low: { dpr: 1, shadowMapSize: 1024, bloom: false, gtao: false, particles: 0.3, waves: false, aa: 'fxaa', csm: false },
	medium: { dpr: 1.5, shadowMapSize: 2048, bloom: true, gtao: false, particles: 0.6, waves: true, aa: 'msaa2', csm: false },
	high: { dpr: 2, shadowMapSize: 2048, bloom: true, gtao: true, particles: 1, waves: true, aa: 'msaa4', csm: true },
};

/** Каскадные тени включаются, если сторона диорамы больше этого. */
export const CSM_MIN_SPAN = 128;

export interface DeviceCaps {
	backend: 'webgpu' | 'webgl2';
	cores: number;
	/** Сенсорный экран (телефон/планшет). */
	coarsePointer: boolean;
}

export function pickQuality(caps: DeviceCaps): QualityLevel {
	if (caps.backend === 'webgl2' || caps.cores <= 4) return 'low';
	if (caps.coarsePointer) return 'medium';
	return 'high';
}

export function resolveQuality(setting: QualitySetting, caps: DeviceCaps, capture: boolean): QualityLevel {
	if (capture) return 'high';
	return setting === 'auto' ? pickQuality(caps) : setting;
}

export function lowerQuality(level: QualityLevel): QualityLevel {
	return level === 'high' ? 'medium' : 'low';
}

export const DOWNGRADE_WINDOW_MS = 3000;
export const DOWNGRADE_FRAME_MS = 33;

/** null — данных ещё мало (< 3 с); true — средний кадр дольше 33 мс. */
export function shouldDowngrade(frameMs: readonly number[]): boolean | null {
	const total = frameMs.reduce((a, b) => a + b, 0);
	if (total < DOWNGRADE_WINDOW_MS) return null;
	return total / frameMs.length > DOWNGRADE_FRAME_MS;
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/engine/render`
Expected: PASS.

- [ ] **Step 5: `src/engine/render/pipeline.ts`**

```ts
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { pass, renderOutput, vec4 } from 'three/tsl';
import { type Camera, RenderPipeline, type Scene, type WebGPURenderer } from 'three/webgpu';
import type { QualityPreset } from './quality.ts';

export interface Pipeline {
	render(): void;
	/** Ночью bloom чуть сильнее. */
	setNight(night: number): void;
	dispose(): void;
}

/** Сцена → GTAO (high) → bloom → тональная компрессия → FXAA (low). */
export function createPipeline(
	renderer: WebGPURenderer,
	scene: Scene,
	camera: Camera,
	preset: QualityPreset,
): Pipeline {
	const samples = preset.aa === 'msaa4' ? 4 : preset.aa === 'msaa2' ? 2 : 0;
	const scenePass = pass(scene, camera, { samples });
	const sceneColor = scenePass.getTextureNode('output');
	let color = sceneColor;
	const extra: Array<{ dispose(): void }> = [];

	if (preset.gtao) {
		// Нормали восстанавливаются из глубины (normalNode = null).
		const aoPass = ao(scenePass.getTextureNode('depth'), null, camera);
		color = vec4(sceneColor.rgb.mul(aoPass.getTextureNode().r), sceneColor.a);
		extra.push(aoPass);
	}

	let bloomPass: ReturnType<typeof bloom> | null = null;
	if (preset.bloom) {
		bloomPass = bloom(color, 0.6, 0.4, 0.85);
		color = color.add(bloomPass);
		extra.push(bloomPass);
	}

	const pipeline = new RenderPipeline(renderer);
	if (preset.aa === 'fxaa') {
		pipeline.outputColorTransform = false;
		pipeline.outputNode = fxaa(renderOutput(color));
	} else {
		pipeline.outputNode = color;
	}

	return {
		render: () => pipeline.render(),
		setNight(night) {
			if (bloomPass) bloomPass.strength.value = 0.6 + 0.3 * night;
		},
		dispose() {
			for (const node of extra) node.dispose();
			pipeline.dispose();
		},
	};
}
```

Если `@types/three` не знает какой-то сигнатуры (например, `ao(..., null, ...)` или тип `color` после `.add`), исправьте точечно (корректный тип или каст значения), без `any` и без смены поведения; перечислите правки в отчёте.

- [ ] **Step 6: Качество в Stage**

`src/engine/render/stage.ts`:
- импорты: `CSMShadowNode` из `three/addons/csm/CSMShadowNode.js`; `createPipeline, type Pipeline` из `./pipeline.ts`; `CSM_MIN_SPAN, QUALITY_PRESETS, type QualityPreset` из `./quality.ts`; `QualityLevel` из `../types.ts`;
- поля: `quality: QualityLevel = 'high'; preset: QualityPreset = QUALITY_PRESETS.high; private pipeline: Pipeline; private readonly span: number;`
- в конструкторе: `this.span = Math.max(sx, sz);` и в конце: `this.pipeline = createPipeline(renderer, this.scene, this.camera, this.preset); this.setQuality('high');` (до `setHour`);
- методы:

```ts
	setQuality(level: QualityLevel): void {
		this.quality = level;
		this.preset = QUALITY_PRESETS[level];
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preset.dpr));
		this.sun.shadow.mapSize.set(this.preset.shadowMapSize, this.preset.shadowMapSize);
		this.sun.shadow.map?.dispose();
		this.sun.shadow.map = null;
		const wantCsm = this.preset.csm && this.span > CSM_MIN_SPAN;
		const hasCsm = this.sun.shadow.shadowNode instanceof CSMShadowNode;
		if (wantCsm && !hasCsm) {
			this.sun.shadow.shadowNode = new CSMShadowNode(this.sun, {
				cascades: 3,
				maxFar: this.camera.far,
				mode: 'practical',
				lightMargin: this.radius,
			});
		} else if (!wantCsm && hasCsm) {
			this.sun.shadow.shadowNode?.dispose();
			this.sun.shadow.shadowNode = null;
		}
		this.uniforms.waves.value = this.preset.waves ? 1 : 0;
		this.pipeline.dispose();
		this.pipeline = createPipeline(this.renderer, this.scene, this.camera, this.preset);
	}
```

- в `setHour` добавить `this.pipeline.setNight(night);`;
- `render()`: заменить `this.renderer.render(this.scene, this.camera)` на `this.pipeline.render();`;
- `dispose()`: `this.pipeline.dispose();`.

(Если типы `LightShadow.shadowNode` в `@types/three` отсутствуют — узкий каст `(this.sun.shadow as { shadowNode: … | null })`.)

- [ ] **Step 7: Качество в контроллере**

`src/engine/index.ts`:
- импорт `type DeviceCaps, lowerQuality, resolveQuality, shouldDowngrade` из `./render/quality.ts`; экспорт типов `QualityLevel, QualitySetting`;
- `MountOptions` + `quality?: QualitySetting;`
- после создания `stage`:

```ts
	const caps: DeviceCaps = {
		backend: backendName(renderer),
		cores: navigator.hardwareConcurrency || 4,
		coarsePointer: window.matchMedia('(pointer: coarse)').matches,
	};
	let qualitySetting: QualitySetting = options.quality ?? 'auto';
	let frameSamples: number[] | null = null;
	const applyQuality = (): void => {
		stage.setQuality(resolveQuality(qualitySetting, caps, capture));
		// Наблюдаем первые 3 с только в «Авто» и не в режиме скриншота.
		frameSamples = qualitySetting === 'auto' && !capture ? [] : null;
	};
	applyQuality();
```

- в `loop` после вычисления `dt`:

```ts
		if (frameSamples) {
			frameSamples.push(dt * 1000);
			const verdict = shouldDowngrade(frameSamples);
			if (verdict !== null) {
				frameSamples = null;
				if (verdict) stage.setQuality(lowerQuality(stage.quality));
			}
		}
```

- контроллер:

```ts
	setQuality(setting: QualitySetting): void;
	getQuality(): { setting: QualitySetting; effective: QualityLevel };
```

```ts
		setQuality(setting) {
			qualitySetting = setting;
			applyQuality();
			redrawIfIdle();
		},
		getQuality: () => ({ setting: qualitySetting, effective: stage.quality }),
```

- `captureThumbnail`: `stage.render()` уже идёт через конвейер; `frame()` не меняется.
- `createRenderer` больше не выставляет `setPixelRatio` (это делает `setQuality`) — удалить строку в `renderer.ts`.

- [ ] **Step 8: Проверки**

```bash
bun run format && bun run check
SITE_ORIGIN=https://example.com bun run build
```

Визуально (контроллер): окна и огни дают bloom; переключение качества (через временный вызов в консоли `controller`/`__diorama` в Task 10) не перезагружает мир; на «Низком» нет bloom; скриншот `?capture` проходит через конвейер и не чёрный.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(engine): add quality levels and post-processing pipeline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Вода и стекло

**Files:**
- Modify: `src/engine/render/materials.ts`

**Interfaces:**
- Consumes: `AtmosphereUniforms` (`time`, `horizon`, `waves`, `emissiveScale`) (Task 2).
- Produces: материалы слоёв `water` и `glass` с волнами и френелем (сигнатуры не меняются).

- [ ] **Step 1: Материалы**

`src/engine/render/materials.ts` — заменить `createVoxelMaterial`:

```ts
import {
	attribute,
	cos,
	dot,
	float,
	mix,
	normalize,
	normalLocal,
	normalView,
	oneMinus,
	positionLocal,
	positionViewDirection,
	pow,
	saturate,
	sin,
	step,
	transformNormalToView,
	vec3,
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { BaseStyle } from '../types.ts';
import type { AtmosphereUniforms } from './uniforms.ts';

export type VoxelLayer = 'opaque' | 'water' | 'glass';

const WAVE_AMPLITUDE = 0.08;

/** Френель: 0 при взгляде в лоб, 1 по касательной. */
const fresnel = () => pow(oneMinus(saturate(dot(normalView, positionViewDirection))), 3);

export function createVoxelMaterial(layer: VoxelLayer, u: AtmosphereUniforms): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({
		metalness: 0,
		roughness: layer === 'opaque' ? 0.9 : layer === 'water' ? 0.15 : 0.05,
	});
	const color = attribute('color', 'vec3');
	const base = color.mul(attribute('ao', 'float'));
	material.emissiveNode = color.mul(attribute('emissive', 'float')).mul(u.emissiveScale);

	if (layer === 'opaque') {
		material.colorNode = base;
		return material;
	}

	material.transparent = true;
	material.depthWrite = false;

	if (layer === 'water') {
		// Меши чанков стоят в начале координат: локальные координаты = мировые.
		const p = positionLocal;
		const isTop = step(0.5, normalLocal.y);
		const a1 = p.x.mul(0.45).add(u.time.mul(1.3));
		const a2 = p.z.mul(0.6).sub(u.time.mul(1.1)).add(p.x.mul(0.2));
		const a3 = p.x.add(p.z).mul(0.9).add(u.time.mul(2.1));
		const amp = float(WAVE_AMPLITUDE).mul(u.waves).mul(isTop);
		const height = sin(a1).mul(0.5).add(sin(a2).mul(0.35)).add(sin(a3).mul(0.15)).mul(amp);
		material.positionNode = p.add(vec3(0, height, 0));
		const dx = cos(a1).mul(0.45 * 0.5).add(cos(a2).mul(0.2 * 0.35)).add(cos(a3).mul(0.9 * 0.15)).mul(amp);
		const dz = cos(a2).mul(0.6 * 0.35).add(cos(a3).mul(0.9 * 0.15)).mul(amp);
		const waveNormal = normalize(vec3(dx.negate(), 1, dz.negate()));
		material.normalNode = transformNormalToView(mix(normalLocal, waveNormal, isTop));
		material.colorNode = mix(base, u.horizon, fresnel().mul(0.6));
		material.opacityNode = float(0.78);
		return material;
	}

	// glass
	material.colorNode = base;
	material.opacityNode = float(0.35).add(fresnel().mul(0.4));
	return material;
}

export function createWorldMaterials(u: AtmosphereUniforms): Record<VoxelLayer, MeshStandardNodeMaterial> {
	return {
		opaque: createVoxelMaterial('opaque', u),
		water: createVoxelMaterial('water', u),
		glass: createVoxelMaterial('glass', u),
	};
}
```

(`createBaseMaterial` без изменений.) Типовые несоответствия TSL правьте точечно, без `any`.

- [ ] **Step 2: Проверки**

```bash
bun run format && bun run check
```

Визуально (контроллер): в «Мельнице у реки» и «Тихой долине» вода колышется, у берегов не видно щелей (боковые грани не двигаются), на закате вода отражает оранжевый горизонт; на качестве low вода плоская.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(engine): animate water waves with fresnel and add glass material

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 6: SDK частиц и света

**Files:**
- Modify: `src/engine/types.ts` (типы), `src/sdk/schema.ts`, `src/sdk/index.ts`, `src/sdk/schema.test.ts`
- Create: `src/sdk/atmosphere/particles.ts`, `src/sdk/atmosphere/lights.ts`, `src/sdk/atmosphere/runtime.ts`, `src/sdk/atmosphere/index.ts`
- Test: `src/sdk/atmosphere/particles.test.ts`, `src/sdk/atmosphere/runtime.test.ts`

**Interfaces:**
- Consumes: `Point`, `resolvePoint` (`src/sdk/entities/types.ts`), `HEX_COLOR` (`src/sdk/materials.ts`), `WorldContext` (`src/engine/types.ts`).
- Produces (`src/engine/types.ts`):

```ts
export interface EmitterSpec {
	id: string;
	seed: number;
	/** Частиц на качестве high. */
	count: number;
	lifetime: number;
	/** Центр области появления; для attach — смещение от сущности не включено (см. offset). */
	origin: Vec3;
	/** Полуразмеры области появления. */
	extent: Vec3;
	velocity: Vec3;
	jitter: Vec3;
	gravity: number;
	wind: { amp: number; freq: number };
	size: [number, number];
	color: [string, string];
	emissive: number;
	opacity: number;
	stretch: number;
	blink: boolean;
	groundRelative: boolean;
	groundCull: boolean;
	nightOnly: boolean;
	/** Индекс экземпляра сущности (из списка, переданного движком) или null. */
	attach: number | null;
	offset: Vec3;
}

export interface LightSpec {
	id: string;
	seed: number;
	position: Vec3;
	color: string;
	intensity: number;
	distance: number;
	flicker: boolean;
	nightOnly: boolean;
	attach: number | null;
	offset: Vec3;
}

export interface AtmosphereContext extends WorldContext {
	size: Vec3;
	/** id экземпляров сущностей в порядке, в котором их рисует движок. */
	entityIds: readonly string[];
}

export interface AtmosphereSpec {
	emitters: EmitterSpec[];
	lights: LightSpec[];
}

export type AtmosphereFactory = (ctx: AtmosphereContext) => AtmosphereSpec;
```

- Produces (SDK): фабрики `smoke`, `fire`, `sparks`, `fireflies`, `snow`, `rain`, `leaves`, `mist`, `dust`, `pointLight`; `isParticleDef`, `isLightDef`; `type ParticleDef`, `type LightDef`; `PARTICLE_TEMPLATES`; `ATMOSPHERE_LIMITS = { emitters: 32, lights: 8, particles: 20000 }`; `createAtmosphereRuntime(d: Pick<Diorama, 'seed' | 'size' | 'particles' | 'lights'>, ctx: AtmosphereContext): AtmosphereSpec`. Схема: `particles` (≤ 32), `lights` (≤ 8) разрешены.

- [ ] **Step 1: Падающие тесты**

`src/sdk/atmosphere/particles.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { pointLight } from './lights.ts';
import { dust, fire, fireflies, isParticleDef, leaves, mist, rain, smoke, snow, sparks } from './particles.ts';

describe('фабрики частиц', () => {
	test('возвращают описания', () => {
		for (const def of [
			smoke({ at: [1, 1] }),
			fire({ at: 'campfire.fire' }),
			sparks({ attachTo: 'boat' }),
			fireflies(),
			snow({ intensity: 0.5 }),
			rain({ area: [0, 0, 10, 10] }),
			leaves(),
			mist({ height: 3 }),
			dust(),
		]) {
			expect(isParticleDef(def)).toBe(true);
		}
		expect(isParticleDef({ preset: 'smoke' })).toBe(false);
	});

	test('точечному эмиттеру нужно ровно одно из at / attachTo', () => {
		expect(() => smoke({})).toThrow('ровно одно из at или attachTo');
		expect(() => smoke({ at: [1, 1], attachTo: 'boat' })).toThrow('ровно одно из at или attachTo');
	});

	test('проверка параметров', () => {
		expect(() => smoke({ at: [1, 1], rate: 0 })).toThrow('rate');
		expect(() => fire({ at: [1, 1], color: 'red' })).toThrow('#rrggbb');
		expect(() => snow({ area: [10, 0, 5, 5] })).toThrow('area');
		expect(() => snow({ intensity: 3 })).toThrow('intensity');
		expect(() => fireflies({ count: 0 })).toThrow('count');
		expect(() => mist({ height: 0 })).toThrow('height');
	});
});

describe('pointLight', () => {
	test('значения по умолчанию и проверки', () => {
		expect(pointLight({ at: [1, 1] }).options).toMatchObject({ intensity: 2, distance: 10, color: '#ffd27a' });
		expect(() => pointLight({})).toThrow('ровно одно из at или attachTo');
		expect(() => pointLight({ at: [1, 1], intensity: -1 })).toThrow('intensity');
		expect(() => pointLight({ at: [1, 1], distance: 0 })).toThrow('distance');
	});
});
```

`src/sdk/atmosphere/runtime.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import type { AtmosphereContext, Vec3 } from '../../engine/types.ts';
import { pointLight } from './lights.ts';
import { fireflies, PARTICLE_TEMPLATES, smoke, snow } from './particles.ts';
import { createAtmosphereRuntime } from './runtime.ts';

const ctx = (over: Partial<AtmosphereContext> = {}): AtmosphereContext => ({
	anchors: { 'house.chimney': [10, 12, 10] as Vec3 },
	groundAt: () => 4,
	size: [96, 40, 80],
	entityIds: ['boat', 'birds[0]', 'birds[1]'],
	...over,
});

const run = (particles = [] as ReturnType<typeof smoke>[], lights = [] as ReturnType<typeof pointLight>[], c = ctx()) =>
	createAtmosphereRuntime({ seed: 3, size: c.size, particles, lights }, c);

describe('createAtmosphereRuntime: частицы', () => {
	test('точечный эмиттер на якоре: число = rate × lifetime', () => {
		const [e] = run([smoke({ at: 'house.chimney', rate: 6 })]).emitters;
		expect(e.origin).toEqual([10, 12, 10]);
		expect(e.count).toBe(Math.round(6 * PARTICLE_TEMPLATES.smoke.lifetime));
		expect(e.attach).toBeNull();
	});

	test('[x, z] — на земле', () => {
		const [e] = run([smoke({ at: [5, 6] })]).emitters;
		expect(e.origin).toEqual([5, 4, 6]);
	});

	test('снег по всей диораме: падает с верха мира до земли', () => {
		const [e] = run([snow({ intensity: 1 })]).emitters;
		expect(e.origin).toEqual([48, 40, 40]);
		expect(e.extent).toEqual([48, 0, 40]);
		expect(e.lifetime).toBeCloseTo(40 / 0.9, 6);
		expect(e.count).toBe(Math.round(96 * 80 * 0.012));
		expect(e.groundCull).toBe(true);
	});

	test('светлячки: слой над землёй, только ночью по умолчанию', () => {
		const [e] = run([fireflies({ area: [0, 0, 10, 20] })]).emitters;
		expect(e.groundRelative).toBe(true);
		expect(e.nightOnly).toBe(true);
		expect(e.origin).toEqual([5, 1.75, 10]);
		expect(e.extent).toEqual([5, 1.25, 10]);
		expect(e.count).toBe(30);
	});

	test('attachTo: точный id экземпляра', () => {
		const [e] = run([smoke({ attachTo: 'birds[1]', offset: [0, 1, 0] })]).emitters;
		expect(e.attach).toBe(2);
		expect(e.offset).toEqual([0, 1, 0]);
		expect(e.origin).toEqual([0, 0, 0]);
	});

	test('attachTo: сущность из нескольких экземпляров или опечатка — понятные ошибки', () => {
		expect(() => run([smoke({ attachTo: 'birds' })])).toThrow('укажи birds[0]…birds[1]');
		expect(() => run([smoke({ attachTo: 'bot' })])).toThrow('неизвестная сущность "bot". Есть: boat, birds[0], birds[1]');
	});

	test('неизвестный якорь — ошибка с номером эмиттера', () => {
		expect(() => run([smoke({ at: 'mill.chimney' })])).toThrow('particles[0] smoke: неизвестный якорь "mill.chimney"');
	});

	test('больше 20 000 частиц — ошибка', () => {
		const many = Array.from({ length: 5 }, () => snow({ count: 5000 }));
		expect(() => run(many)).toThrow('слишком много частиц: 25000');
	});

	test('детерминизм seed', () => {
		const a = run([smoke({ at: [1, 1] }), smoke({ at: [2, 2] })]).emitters;
		const b = run([smoke({ at: [1, 1] }), smoke({ at: [2, 2] })]).emitters;
		expect(a.map((e) => e.seed)).toEqual(b.map((e) => e.seed));
		expect(a[0].seed).not.toBe(a[1].seed);
	});
});

describe('createAtmosphereRuntime: свет', () => {
	test('позиция, мерцание, ночь, attach', () => {
		const { lights } = run([], [
			pointLight({ at: 'house.chimney', flicker: true }),
			pointLight({ attachTo: 'boat', onlyAtNight: true }),
		]);
		expect(lights[0]).toMatchObject({ position: [10, 12, 10], flicker: true, attach: null });
		expect(lights[1]).toMatchObject({ attach: 0, nightOnly: true });
	});

	test('больше 8 источников — ошибка', () => {
		const nine = Array.from({ length: 9 }, () => pointLight({ at: [1, 1] }));
		expect(() => run([], nine)).toThrow('слишком много источников света: 9');
	});
});
```

В `src/sdk/schema.test.ts`: тест «поля этапа 3 по-прежнему отвергаются» (и дубль с `particles` из этапа 2) заменить на один тест с неизвестным полем `weather: []`; добавить:

```ts
	test('particles и lights принимаются, мусор — понятная ошибка', () => {
		const d = defineDiorama({ ...minimal(), particles: [snow()], lights: [pointLight({ at: [1, 1] })] });
		expect(d.particles).toHaveLength(1);
		expect(d.lights).toHaveLength(1);
		const bad = { ...minimal(), particles: [{ smoke: 1 }] } as unknown as DioramaInput;
		expect(() => defineDiorama(bad)).toThrow('particles: ожидается');
	});
```

(импорт `snow`, `pointLight` из `./atmosphere/index.ts`.)

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk`
Expected: FAIL — модули не найдены.

- [ ] **Step 3: Типы в `src/engine/types.ts`** — добавить блок из Interfaces выше.

- [ ] **Step 4: `src/sdk/atmosphere/particles.ts`**

```ts
import type { Vec3 } from '../../engine/types.ts';
import type { Point } from '../entities/types.ts';
import { HEX_COLOR } from '../materials.ts';

export type PointPreset = 'smoke' | 'fire' | 'sparks';
export type AreaPreset = 'fireflies' | 'snow' | 'rain' | 'leaves' | 'mist' | 'dust';
export type ParticlePreset = PointPreset | AreaPreset;
/** [x0, z0, x1, z1] */
export type Area = readonly [number, number, number, number];

export interface PointEmitterOptions {
	at?: Point;
	/** id экземпляра сущности (`boat`, `birds[2]`). */
	attachTo?: string;
	offset?: Vec3;
	/** Частиц в секунду. */
	rate?: number;
	color?: string;
	onlyAtNight?: boolean;
	size?: 'small' | 'medium' | 'large';
}

export interface AreaEmitterOptions {
	area?: Area;
	/** Точное число частиц (вместо intensity). */
	count?: number;
	/** 0..2, множитель плотности. */
	intensity?: number;
	color?: string;
	onlyAtNight?: boolean;
	/** Высота слоя над землёй (mist). */
	height?: number;
}

export interface ParticleDef {
	readonly kind: 'particles';
	readonly preset: ParticlePreset;
	readonly point?: Readonly<PointEmitterOptions>;
	readonly area?: Readonly<AreaEmitterOptions>;
}

export interface ParticleTemplate {
	lifetime: number;
	/** Падающие: скорость падения; время жизни = высота мира / fall, появление у верха мира. */
	fall?: number;
	/** Полуразмеры появления для точечных эмиттеров. */
	extent: Vec3;
	velocity: Vec3;
	jitter: Vec3;
	gravity: number;
	wind: { amp: number; freq: number };
	size: readonly [number, number];
	color: readonly [string, string];
	emissive: number;
	opacity: number;
	stretch: number;
	blink: boolean;
	groundRelative: boolean;
	groundCull: boolean;
	nightOnly: boolean;
	/** Слой [от, до] над землёй для groundRelative. */
	band?: readonly [number, number];
	/** Точечные: частиц/с по умолчанию. */
	rate?: number;
	/** Площадные: частиц на клетку при intensity 1. */
	density?: number;
	/** Площадные: число по умолчанию (вместо density). */
	count?: number;
	/** intensity по умолчанию. */
	intensity?: number;
}

const base = {
	jitter: [0, 0, 0] as Vec3,
	gravity: 0,
	emissive: 0,
	opacity: 1,
	stretch: 1,
	blink: false,
	groundRelative: false,
	groundCull: false,
	nightOnly: false,
};

export const PARTICLE_TEMPLATES: Readonly<Record<ParticlePreset, ParticleTemplate>> = {
	smoke: { ...base, lifetime: 6, extent: [0.15, 0, 0.15], velocity: [0.15, 0.9, 0.05], jitter: [0.2, 0.2, 0.2], wind: { amp: 0.35, freq: 0.8 }, size: [0.25, 0.9], color: ['#9a9a9a', '#d8d8d8'], rate: 6 },
	fire: { ...base, lifetime: 0.8, extent: [0.35, 0, 0.35], velocity: [0, 1.6, 0], jitter: [0.3, 0.5, 0.3], wind: { amp: 0.08, freq: 6 }, size: [0.35, 0.05], color: ['#ffd27a', '#ff4a1a'], emissive: 3, rate: 40 },
	sparks: { ...base, lifetime: 1.5, extent: [0.2, 0, 0.2], velocity: [0, 3, 0], jitter: [1.2, 1, 1.2], gravity: -3, wind: { amp: 0.05, freq: 4 }, size: [0.08, 0.03], color: ['#ffe08a', '#ff7a1a'], emissive: 4, rate: 12 },
	fireflies: { ...base, lifetime: 8, extent: [0, 0, 0], velocity: [0, 0, 0], jitter: [0.15, 0.05, 0.15], wind: { amp: 0.6, freq: 0.5 }, size: [0.08, 0.08], color: ['#d4ff6a', '#d4ff6a'], emissive: 4, blink: true, groundRelative: true, nightOnly: true, band: [0.5, 3], count: 30 },
	snow: { ...base, lifetime: 0, fall: 0.9, extent: [0, 0, 0], velocity: [0, -0.9, 0], jitter: [0.1, 0.2, 0.1], wind: { amp: 0.5, freq: 0.7 }, size: [0.12, 0.12], color: ['#ffffff', '#ffffff'], groundCull: true, density: 0.012, intensity: 0.6 },
	rain: { ...base, lifetime: 0, fall: 9, extent: [0, 0, 0], velocity: [0, -9, 0], jitter: [0.05, 1, 0.05], wind: { amp: 0.05, freq: 1 }, size: [0.05, 0.05], color: ['#9fc4ff', '#9fc4ff'], stretch: 6, groundCull: true, density: 0.02, intensity: 1 },
	leaves: { ...base, lifetime: 0, fall: 0.7, extent: [0, 0, 0], velocity: [0, -0.7, 0], jitter: [0.2, 0.2, 0.2], wind: { amp: 1.2, freq: 0.9 }, size: [0.18, 0.18], color: ['#d68910', '#a04000'], groundCull: true, density: 0.004, intensity: 1 },
	mist: { ...base, lifetime: 14, extent: [0, 0, 0], velocity: [0.25, 0, 0.1], jitter: [0.1, 0.02, 0.1], wind: { amp: 0.3, freq: 0.2 }, size: [1.6, 2.4], color: ['#e8eef5', '#e8eef5'], opacity: 0.35, groundRelative: true, band: [0, 2], density: 0.006, intensity: 1 },
	dust: { ...base, lifetime: 10, extent: [0, 0, 0], velocity: [0.1, 0.05, 0.05], jitter: [0.1, 0.1, 0.1], wind: { amp: 0.4, freq: 0.3 }, size: [0.06, 0.06], color: ['#e8dcc0', '#e8dcc0'], emissive: 0.3, groundRelative: true, band: [0.3, 2.5], density: 0.01, intensity: 1 },
};

export function isParticleDef(value: unknown): value is ParticleDef {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { kind?: unknown }).kind === 'particles' &&
		typeof (value as { preset?: unknown }).preset === 'string' &&
		(value as { preset: string }).preset in PARTICLE_TEMPLATES
	);
}

function checkColor(name: string, color: string | undefined): void {
	if (color !== undefined && !HEX_COLOR.test(color)) throw new Error(`${name}: color — ожидается #rrggbb`);
}

function point(preset: PointPreset, o: PointEmitterOptions): ParticleDef {
	if ((o.at === undefined) === (o.attachTo === undefined)) {
		throw new Error(`${preset}: нужно ровно одно из at или attachTo`);
	}
	if (o.rate !== undefined && !(o.rate > 0 && o.rate <= 500)) throw new Error(`${preset}: rate — от 0 до 500 частиц/с`);
	checkColor(preset, o.color);
	return { kind: 'particles', preset, point: { ...o } };
}

function area(preset: AreaPreset, o: AreaEmitterOptions): ParticleDef {
	if (o.area !== undefined) {
		const [x0, z0, x1, z1] = o.area;
		if (!(x1 > x0 && z1 > z0)) throw new Error(`${preset}: area — [x0, z0, x1, z1] с x1 > x0, z1 > z0`);
	}
	if (o.count !== undefined && !(Number.isInteger(o.count) && o.count >= 1 && o.count <= 5000)) {
		throw new Error(`${preset}: count — целое 1..5000`);
	}
	if (o.intensity !== undefined && !(o.intensity > 0 && o.intensity <= 2)) {
		throw new Error(`${preset}: intensity — от 0 до 2`);
	}
	if (o.height !== undefined && !(o.height > 0)) throw new Error(`${preset}: height должна быть > 0`);
	checkColor(preset, o.color);
	return { kind: 'particles', preset, area: { ...o } };
}

/** Дым (из трубы, костра). */
export const smoke = (o: PointEmitterOptions): ParticleDef => point('smoke', o);
/** Огонь — светится. */
export const fire = (o: PointEmitterOptions): ParticleDef => point('fire', o);
/** Искры — светятся, падают. */
export const sparks = (o: PointEmitterOptions): ParticleDef => point('sparks', o);
/** Светлячки над землёй; по умолчанию только ночью. */
export const fireflies = (o: AreaEmitterOptions = {}): ParticleDef => area('fireflies', o);
export const snow = (o: AreaEmitterOptions = {}): ParticleDef => area('snow', o);
export const rain = (o: AreaEmitterOptions = {}): ParticleDef => area('rain', o);
export const leaves = (o: AreaEmitterOptions = {}): ParticleDef => area('leaves', o);
/** Стелющийся туман (полупрозрачный). */
export const mist = (o: AreaEmitterOptions = {}): ParticleDef => area('mist', o);
export const dust = (o: AreaEmitterOptions = {}): ParticleDef => area('dust', o);
```

- [ ] **Step 5: `src/sdk/atmosphere/lights.ts`**

```ts
import type { Vec3 } from '../../engine/types.ts';
import type { Point } from '../entities/types.ts';
import { HEX_COLOR } from '../materials.ts';

export interface PointLightOptions {
	at?: Point;
	attachTo?: string;
	offset?: Vec3;
	color?: string;
	intensity?: number;
	distance?: number;
	flicker?: boolean;
	onlyAtNight?: boolean;
}

export interface LightDef {
	readonly kind: 'light';
	readonly options: Readonly<Required<Omit<PointLightOptions, 'at' | 'attachTo'>> & Pick<PointLightOptions, 'at' | 'attachTo'>>;
}

export function isLightDef(value: unknown): value is LightDef {
	return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'light';
}

/** Точечный источник света без теней. */
export function pointLight(o: PointLightOptions): LightDef {
	if ((o.at === undefined) === (o.attachTo === undefined)) {
		throw new Error('pointLight: нужно ровно одно из at или attachTo');
	}
	const intensity = o.intensity ?? 2;
	const distance = o.distance ?? 10;
	const color = o.color ?? '#ffd27a';
	if (!(intensity >= 0 && intensity <= 50)) throw new Error('pointLight: intensity — от 0 до 50');
	if (!(distance > 0 && distance <= 200)) throw new Error('pointLight: distance — от 0 до 200');
	if (!HEX_COLOR.test(color)) throw new Error('pointLight: color — ожидается #rrggbb');
	return {
		kind: 'light',
		options: {
			at: o.at,
			attachTo: o.attachTo,
			offset: o.offset ?? [0, 0, 0],
			color: color.toLowerCase(),
			intensity,
			distance,
			flicker: o.flicker ?? false,
			onlyAtNight: o.onlyAtNight ?? false,
		},
	};
}
```

- [ ] **Step 6: `src/sdk/atmosphere/runtime.ts`**

```ts
import type { AtmosphereContext, AtmosphereSpec, EmitterSpec, LightSpec, Vec3 } from '../../engine/types.ts';
import { type Point, resolvePoint } from '../entities/types.ts';
import type { LightDef } from './lights.ts';
import { type Area, type ParticleDef, PARTICLE_TEMPLATES } from './particles.ts';

export const ATMOSPHERE_LIMITS = { emitters: 32, lights: 8, particles: 20000 } as const;

const SIZE_SCALE = { small: 0.6, medium: 1, large: 1.6 } as const;

interface Source {
	seed: number;
	size: Vec3;
	particles: readonly ParticleDef[];
	lights: readonly LightDef[];
}

function anchorLookup(ctx: AtmosphereContext): (name: string) => Vec3 {
	const names = Object.keys(ctx.anchors);
	return (name) => {
		const p = ctx.anchors[name];
		if (!p) throw new Error(`неизвестный якорь "${name}". Есть: ${names.join(', ') || '(нет)'}`);
		return [p[0], p[1], p[2]];
	};
}

function attachIndex(id: string, ids: readonly string[]): number {
	const exact = ids.indexOf(id);
	if (exact >= 0) return exact;
	const many = ids.filter((e) => e.startsWith(`${id}[`));
	if (many.length > 0) {
		throw new Error(`attachTo "${id}": у сущности несколько экземпляров — укажи ${id}[0]…${id}[${many.length - 1}]`);
	}
	throw new Error(`attachTo: неизвестная сущность "${id}". Есть: ${ids.join(', ') || '(нет)'}`);
}

function place(
	at: Point | undefined,
	attachTo: string | undefined,
	ctx: AtmosphereContext,
): { origin: Vec3; attach: number | null } {
	if (attachTo !== undefined) return { origin: [0, 0, 0], attach: attachIndex(attachTo, ctx.entityIds) };
	const resolved = resolvePoint(at as Point, { groundAt: ctx.groundAt, anchor: anchorLookup(ctx) });
	return { origin: resolved.position, attach: null };
}

const emitterSeed = (seed: number, index: number): number => ((seed * 31 + index * 7919) >>> 0) % 100_000;

function emitter(def: ParticleDef, index: number, src: Source, ctx: AtmosphereContext): EmitterSpec {
	const t = PARTICLE_TEMPLATES[def.preset];
	const color: [string, string] = [t.color[0], t.color[1]];
	const common = {
		id: `${def.preset}#${index + 1}`,
		seed: emitterSeed(src.seed, index),
		velocity: [...t.velocity] as Vec3,
		jitter: [...t.jitter] as Vec3,
		gravity: t.gravity,
		wind: { ...t.wind },
		emissive: t.emissive,
		opacity: t.opacity,
		stretch: t.stretch,
		blink: t.blink,
		groundRelative: t.groundRelative,
		groundCull: t.groundCull,
	};

	if (def.point) {
		const o = def.point;
		const k = SIZE_SCALE[o.size ?? 'medium'];
		const { origin, attach } = place(o.at, o.attachTo, ctx);
		const c = o.color ?? null;
		return {
			...common,
			count: Math.max(1, Math.round((o.rate ?? t.rate ?? 1) * t.lifetime)),
			lifetime: t.lifetime,
			origin,
			extent: [t.extent[0] * k, t.extent[1], t.extent[2] * k],
			size: [t.size[0] * k, t.size[1] * k],
			color: c ? [c, c] : color,
			nightOnly: o.onlyAtNight ?? t.nightOnly,
			attach,
			offset: o.offset ? [...o.offset] : [0, 0, 0],
		};
	}

	const o = def.area ?? {};
	const [x0, z0, x1, z1]: Area = o.area ?? [0, 0, src.size[0], src.size[2]];
	const cells = (x1 - x0) * (z1 - z0);
	const count =
		o.count ?? t.count ?? Math.max(1, Math.round(cells * (t.density ?? 0) * (o.intensity ?? t.intensity ?? 1)));
	const top = src.size[1];
	let lifetime = t.lifetime;
	let y = 0;
	let ey = 0;
	if (t.fall) {
		lifetime = top / t.fall;
		y = top;
	} else if (t.band) {
		const hi = o.height ?? t.band[1];
		y = (t.band[0] + hi) / 2;
		ey = (hi - t.band[0]) / 2;
	}
	const c = o.color ?? null;
	return {
		...common,
		count,
		lifetime,
		origin: [(x0 + x1) / 2, y, (z0 + z1) / 2],
		extent: [(x1 - x0) / 2, ey, (z1 - z0) / 2],
		size: [t.size[0], t.size[1]],
		color: c ? [c, c] : color,
		nightOnly: o.onlyAtNight ?? t.nightOnly,
		attach: null,
		offset: [0, 0, 0],
	};
}

/** Разворачивает частицы и свет диорамы в данные для движка. Ошибки называют эмиттер/источник. */
export function createAtmosphereRuntime(src: Source, ctx: AtmosphereContext): AtmosphereSpec {
	if (src.particles.length > ATMOSPHERE_LIMITS.emitters) {
		throw new Error(`слишком много эмиттеров частиц: ${src.particles.length} (максимум ${ATMOSPHERE_LIMITS.emitters})`);
	}
	if (src.lights.length > ATMOSPHERE_LIMITS.lights) {
		throw new Error(`слишком много источников света: ${src.lights.length} (максимум ${ATMOSPHERE_LIMITS.lights})`);
	}
	const emitters = src.particles.map((def, i) => {
		try {
			return emitter(def, i, src, ctx);
		} catch (error) {
			const text = error instanceof Error ? error.message : String(error);
			throw new Error(`particles[${i}] ${def.preset}: ${text}`, { cause: error });
		}
	});
	const total = emitters.reduce((n, e) => n + e.count, 0);
	if (total > ATMOSPHERE_LIMITS.particles) {
		throw new Error(
			`слишком много частиц: ${total} (максимум ${ATMOSPHERE_LIMITS.particles}) — уменьши intensity, count или rate`,
		);
	}
	const lights: LightSpec[] = src.lights.map((def, i) => {
		const o = def.options;
		try {
			const { origin, attach } = place(o.at, o.attachTo, ctx);
			return {
				id: `light#${i + 1}`,
				seed: i * 17 + 3,
				position: origin,
				color: o.color,
				intensity: o.intensity,
				distance: o.distance,
				flicker: o.flicker,
				nightOnly: o.onlyAtNight,
				attach,
				offset: [...o.offset] as Vec3,
			};
		} catch (error) {
			const text = error instanceof Error ? error.message : String(error);
			throw new Error(`lights[${i}]: ${text}`, { cause: error });
		}
	});
	return { emitters, lights };
}
```

- [ ] **Step 7: Экспорты и схема**

`src/sdk/atmosphere/index.ts`:

```ts
export { isLightDef, type LightDef, type PointLightOptions, pointLight } from './lights.ts';
export {
	type AreaEmitterOptions,
	dust,
	fire,
	fireflies,
	isParticleDef,
	leaves,
	mist,
	PARTICLE_TEMPLATES,
	type ParticleDef,
	type ParticlePreset,
	type PointEmitterOptions,
	rain,
	smoke,
	snow,
	sparks,
} from './particles.ts';
export { ATMOSPHERE_LIMITS, createAtmosphereRuntime } from './runtime.ts';
```

`src/sdk/index.ts`: `export * from './atmosphere/index.ts';`

`src/sdk/schema.ts`: импорт `isLightDef, type LightDef` и `isParticleDef, type ParticleDef`; после `entities`:

```ts
	particles: z
		.array(
			z.custom<ParticleDef>(
				isParticleDef,
				'particles: ожидается smoke(…), fire(…), sparks(…), fireflies(…), snow(…), rain(…), leaves(…), mist(…) или dust(…)',
			),
		)
		.max(32)
		.default([]),
	lights: z
		.array(z.custom<LightDef>(isLightDef, 'lights: ожидается pointLight(…)'))
		.max(8)
		.default([]),
```

- [ ] **Step 8: Тесты проходят**

Run: `bun test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "feat(sdk): add particle presets, point lights and atmosphere runtime

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Префабы `lantern`, `campfire`, якорь `chimney`

**Files:**
- Create: `src/sdk/prefabs/lantern.ts`, `src/sdk/prefabs/campfire.ts`
- Modify: `src/sdk/prefabs/house.ts`, `src/sdk/prefabs/index.ts`
- Test: `src/sdk/prefabs/atmosphere-prefabs.test.ts`

**Interfaces:**
- Consumes: `model()` (этап 2).
- Produces: `lantern(o?: { post?: string; glow?: string }): Model` (якорь `light`), `campfire(): Model` (якорь `fire`), у `house` — якорь `chimney` над трубой.

- [ ] **Step 1: Падающие тесты**

`src/sdk/prefabs/atmosphere-prefabs.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { modelIndex } from '../builder/model.ts';
import { campfire, house, lantern } from './index.ts';

test('lantern: светящийся фонарь, якорь light в центре фонаря', () => {
	const m = lantern();
	expect(m.anchors.light).toEqual([1.5, 4.5, 1.5]);
	expect(m.materials.some(({ material }) => material.emissive > 0)).toBe(true);
	expect(m.data[modelIndex(m.size, 1, 0, 1)]).not.toBe(0);
});

test('campfire: якорь fire над поленьями', () => {
	const m = campfire();
	expect(m.anchors.fire).toEqual([2.5, 1, 2.5]);
	expect(m.data.some((v) => v !== 0)).toBe(true);
});

test('house: якорь chimney над верхом трубы', () => {
	const h = house({ width: 5 });
	// труба: x = width - 1, z = 2, верх — y = wallHeight + roofLayers
	expect(h.anchors.chimney).toEqual([4.5, 4 + 4 + 1, 2.5]);
	const [x, y, z] = h.anchors.chimney;
	expect(h.data[modelIndex(h.size, Math.floor(x), Math.floor(y) - 1, Math.floor(z))]).not.toBe(0);
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk/prefabs`
Expected: FAIL.

- [ ] **Step 3: Префабы**

`src/sdk/prefabs/lantern.ts`:

```ts
import { type Model, model } from '../builder/model.ts';

/** Фонарь на столбе (для w.place). Якорь `light` — центр фонаря, туда ставят pointLight. */
export function lantern(options: { post?: string; glow?: string } = {}): Model {
	return model(
		{
			size: [3, 6, 3],
			palette: {
				post: options.post ?? '#3b3b3b',
				glow: { color: options.glow ?? '#ffd27a', emissive: 1.5 },
			},
			anchors: { light: [1.5, 4.5, 1.5] },
		},
		(m) => {
			m.box([1, 0, 1], [1, 3, 1], 'post');
			m.box([0, 4, 0], [2, 4, 2], 'post');
			m.set([1, 4, 1], 'glow');
			m.box([0, 5, 0], [2, 5, 2], 'post');
		},
	);
}
```

`src/sdk/prefabs/campfire.ts`:

```ts
import { type Model, model } from '../builder/model.ts';

/** Кострище: кольцо камней и поленья (для w.place). Якорь `fire` — над поленьями. */
export function campfire(): Model {
	return model(
		{
			size: [5, 2, 5],
			palette: { stone: '#7d7d7d', log: '#5a3b22', ember: { color: '#ff7a1a', emissive: 1.2 } },
			anchors: { fire: [2.5, 1, 2.5] },
		},
		(m) => {
			for (const [x, z] of [[0, 2], [4, 2], [2, 0], [2, 4], [1, 1], [3, 1], [1, 3], [3, 3]] as const) {
				m.set([x, 0, z], 'stone');
			}
			m.box([1, 0, 2], [3, 0, 2], 'log');
			m.box([2, 0, 1], [2, 0, 3], 'log');
			m.set([2, 0, 2], 'ember');
		},
	);
}
```

`src/sdk/prefabs/house.ts`: в `anchors` добавить
`chimney: [width - 0.5, wallHeight + roofLayers + 1, 2.5],`
(труба — `box([width - 1, wallHeight, 2], [width - 1, wallHeight + roofLayers, 2])`, якорь — над её верхним вокселем).

`src/sdk/prefabs/index.ts`: добавить

```ts
export { campfire } from './campfire.ts';
export { lantern } from './lantern.ts';
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test`
Expected: PASS (контентный тест «Тихой долины» не меняется — якорь не влияет на воксели).

- [ ] **Step 5: Commit**

```bash
bun run format && bun run check
git add -A
git commit -m "feat(sdk): add lantern and campfire prefabs, house chimney anchor

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 8: Движок частиц

**Files:**
- Create: `src/engine/particles/math.ts`, `src/engine/particles/layer.ts`
- Modify: `src/engine/voxel/heightmap.ts`, `src/engine/entities/layer.ts`, `src/engine/index.ts`, `src/lib/components/Viewer.svelte`
- Test: `src/engine/particles/math.test.ts`, `src/engine/voxel/heightmap.test.ts`

**Interfaces:**
- Consumes: `EmitterSpec`, `AtmosphereFactory`, `AtmosphereContext` (Task 6), `AtmosphereUniforms` (Task 2), `stage.preset.particles` (Task 4), `createAtmosphereRuntime` из `#sdk` (Task 6).
- Produces:
  - `Heightmap` + `columns: Int16Array; width: number; depth: number`.
  - `particleAge(t, index, count, lifetime): { age; cycle; k }`, `particleScale(size, k, visibility): number`, `particlePath(motion, origin, age, r1, r2): Vec3`, `applyGround(e, p, ground): { position: Vec3; visible: boolean }`, `instanceCount(count, density): number`.
  - `class ParticleLayer { group; constructor(specs, field: { columns; width; depth }, u: AtmosphereUniforms); setDensity(scale); setEnabled(on); update(positionOf, night); dispose() }`.
  - `EntityLayer.ids: string[]`, `EntityLayer.positionOf(index): Vec3 | null`.
  - `MountOptions` + `atmosphere?: AtmosphereFactory; particles?: boolean`; контроллер `setParticles(on)`, `reloadWorld(url, entities?, atmosphere?)`.

- [ ] **Step 1: Падающие тесты**

`src/engine/particles/math.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { applyGround, instanceCount, particleAge, particlePath, particleScale } from './math.ts';

describe('particleAge', () => {
	test('частицы равномерно распределены по времени жизни и перерождаются', () => {
		expect(particleAge(0, 0, 10, 5)).toEqual({ age: 0, cycle: 0, k: 0 });
		const second = particleAge(0, 1, 10, 5);
		expect(second.age).toBeCloseTo(4.5, 9);
		expect(second.cycle).toBe(-1);
		expect(particleAge(12, 0, 10, 5)).toEqual({ age: 2, cycle: 2, k: 0.4 });
	});

	test('возраст всегда в [0, lifetime)', () => {
		for (let t = 0; t < 30; t += 0.37) {
			for (let i = 0; i < 20; i++) {
				const { age } = particleAge(t, i, 20, 3);
				expect(age >= 0 && age < 3).toBe(true);
			}
		}
	});
});

describe('particleScale', () => {
	test('появляется и исчезает плавно, видимость множит', () => {
		expect(particleScale([1, 1], 0, 1)).toBe(0);
		expect(particleScale([1, 3], 0.5, 1)).toBeCloseTo(2, 6);
		expect(particleScale([1, 1], 0.999, 1)).toBeLessThan(0.01);
		expect(particleScale([1, 1], 0.5, 0)).toBe(0);
	});
});

describe('путь и земля', () => {
	const motion = {
		extent: [1, 0, 1] as [number, number, number],
		velocity: [0, 2, 0] as [number, number, number],
		jitter: [0, 0, 0] as [number, number, number],
		gravity: -4,
		wind: { amp: 0, freq: 1 },
	};

	test('центр области, скорость и гравитация', () => {
		const p = particlePath(motion, [5, 10, 5], 1, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
		expect(p[0]).toBeCloseTo(5, 9);
		expect(p[1]).toBeCloseTo(10 + 2 - 2, 9);
		expect(p[2]).toBeCloseTo(5, 9);
	});

	test('слой над землёй и исчезновение под землёй', () => {
		expect(applyGround({ groundRelative: true, groundCull: false }, [1, 2, 3], 5)).toEqual({
			position: [1, 7, 3],
			visible: true,
		});
		expect(applyGround({ groundRelative: false, groundCull: true }, [1, 4, 3], 5).visible).toBe(false);
		// пустая колонка (вода/обрыв): земля 0 — снег долетает до 0
		expect(applyGround({ groundRelative: false, groundCull: true }, [1, 0.5, 3], 0).visible).toBe(true);
	});

	test('instanceCount по плотности качества, минимум 1', () => {
		expect(instanceCount(100, 0.3)).toBe(30);
		expect(instanceCount(1, 0.3)).toBe(1);
		expect(instanceCount(100, 1)).toBe(100);
	});
});
```

Добавить в `src/engine/voxel/heightmap.test.ts`:

```ts
test('колонки доступны для текстуры высот', () => {
	const world = new VoxelWorld([3, 8, 2]);
	world.set(2, 4, 1, 1);
	const hm = buildHeightmap(world, materials);
	expect(hm.width).toBe(3);
	expect(hm.depth).toBe(2);
	expect(hm.columns[2 + 1 * 3]).toBe(5);
	expect(hm.columns[0]).toBe(0);
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/particles src/engine/voxel/heightmap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Heightmap**

В `src/engine/voxel/heightmap.ts`: интерфейс `Heightmap` + поля

```ts
	/** Высота земли по колонкам (x + z·width). */
	columns: Int16Array;
	width: number;
	depth: number;
```

и в возвращаемом объекте `columns: tops, width: sx, depth: sz,`.

- [ ] **Step 4: `src/engine/particles/math.ts`** (эталон шейдера, без three)

```ts
import type { EmitterSpec, Vec3 } from '../types.ts';

const TAU = Math.PI * 2;

const smoothstep = (a: number, b: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

export interface ParticleAge {
	age: number;
	/** Номер перерождения (для случайности новой жизни). */
	cycle: number;
	/** Доля жизни 0..1. */
	k: number;
}

/** Частица i из count появляется со сдвигом lifetime / count и перерождается каждые lifetime секунд. */
export function particleAge(t: number, index: number, count: number, lifetime: number): ParticleAge {
	const local = t - (index * lifetime) / count;
	const cycle = Math.floor(local / lifetime);
	const age = local - cycle * lifetime;
	return { age, cycle, k: age / lifetime };
}

/** Размер по кривой жизни: плавное появление и исчезновение (без прозрачности). */
export function particleScale(size: readonly [number, number], k: number, visibility: number): number {
	const s = size[0] + (size[1] - size[0]) * k;
	return s * smoothstep(0, 0.05, k) * (1 - smoothstep(0.85, 1, k)) * visibility;
}

export type EmitterMotion = Pick<EmitterSpec, 'extent' | 'velocity' | 'jitter' | 'gravity' | 'wind'>;

/** Положение без учёта земли; r1, r2 — случайные векторы частицы в [0, 1). */
export function particlePath(e: EmitterMotion, origin: Vec3, age: number, r1: Vec3, r2: Vec3): Vec3 {
	const p: Vec3 = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		p[i] = origin[i] + (r1[i] * 2 - 1) * e.extent[i] + (e.velocity[i] + (r2[i] * 2 - 1) * e.jitter[i]) * age;
	}
	p[1] += 0.5 * e.gravity * age * age;
	p[0] += Math.sin(age * e.wind.freq + r1[0] * TAU) * e.wind.amp;
	p[2] += Math.cos(age * e.wind.freq * 0.9 + r1[2] * TAU) * e.wind.amp;
	return p;
}

export function applyGround(
	e: Pick<EmitterSpec, 'groundRelative' | 'groundCull'>,
	p: Vec3,
	ground: number,
): { position: Vec3; visible: boolean } {
	const position: Vec3 = e.groundRelative ? [p[0], p[1] + ground, p[2]] : [p[0], p[1], p[2]];
	return { position, visible: !e.groundCull || position[1] >= ground };
}

/** Сколько частиц рисовать при плотности качества (минимум 1). */
export function instanceCount(count: number, density: number): number {
	return Math.max(1, Math.round(count * density));
}
```

- [ ] **Step 5: Тесты проходят**

Run: `bun test src/engine`
Expected: PASS.

- [ ] **Step 6: `src/engine/particles/layer.ts`** (TSL повторяет `math.ts`)

```ts
import {
	clamp,
	cos,
	color,
	float,
	floor,
	hash,
	instanceIndex,
	ivec2,
	mix,
	oneMinus,
	positionLocal,
	sin,
	smoothstep,
	step,
	textureLoad,
	uniform,
	vec3,
} from 'three/tsl';
import {
	BoxGeometry,
	DataTexture,
	FloatType,
	Group,
	InstancedMesh,
	MeshStandardNodeMaterial,
	RedFormat,
	Vector3,
} from 'three/webgpu';
import type { AtmosphereUniforms } from '../render/uniforms.ts';
import type { EmitterSpec, Vec3 } from '../types.ts';
import { instanceCount } from './math.ts';

const TAU = Math.PI * 2;

export interface GroundField {
	columns: Int16Array;
	width: number;
	depth: number;
}

interface LiveEmitter {
	spec: EmitterSpec;
	mesh: InstancedMesh;
	origin: ReturnType<typeof uniform<Vector3>>;
	count: ReturnType<typeof uniform<number>>;
	visibility: ReturnType<typeof uniform<number>>;
}

/** Частицы без состояния: позиция каждой — функция часов анимации и номера (см. math.ts). */
export class ParticleLayer {
	readonly group = new Group();
	private readonly live: LiveEmitter[] = [];
	private readonly geometry = new BoxGeometry(1, 1, 1);
	private readonly ground: DataTexture;

	constructor(specs: EmitterSpec[], field: GroundField, private readonly u: AtmosphereUniforms) {
		const data = Float32Array.from(field.columns);
		this.ground = new DataTexture(data, field.width, field.depth, RedFormat, FloatType);
		this.ground.needsUpdate = true;
		for (const spec of specs) this.live.push(this.createEmitter(spec, field));
	}

	private createEmitter(e: EmitterSpec, field: GroundField): LiveEmitter {
		const origin = uniform(new Vector3(...e.origin));
		const count = uniform(e.count);
		const visibility = uniform(1);
		const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });

		const life = float(e.lifetime);
		const idx = float(instanceIndex);
		const local = this.u.time.sub(idx.mul(life.div(count)));
		const cycle = floor(local.div(life));
		const age = local.sub(cycle.mul(life));
		const k = age.div(life);
		const s = idx.mul(7.13).add(cycle.mul(13.7)).add(e.seed);
		const r1 = vec3(hash(s), hash(s.add(1.1)), hash(s.add(2.3)));
		const r2 = vec3(hash(s.add(3.7)), hash(s.add(4.9)), hash(s.add(6.1)));
		const path = origin
			.add(r1.mul(2).sub(1).mul(vec3(...e.extent)))
			.add(vec3(...e.velocity).add(r2.mul(2).sub(1).mul(vec3(...e.jitter))).mul(age))
			.add(
				vec3(
					sin(age.mul(e.wind.freq).add(r1.x.mul(TAU))).mul(e.wind.amp),
					age.mul(age).mul(0.5 * e.gravity),
					cos(age.mul(e.wind.freq * 0.9).add(r1.z.mul(TAU))).mul(e.wind.amp),
				),
			);
		const groundY = textureLoad(
			this.ground,
			ivec2(clamp(floor(path.x), 0, field.width - 1), clamp(floor(path.z), 0, field.depth - 1)),
		).r;
		const position = e.groundRelative ? vec3(path.x, path.y.add(groundY), path.z) : path;
		let scale = mix(float(e.size[0]), float(e.size[1]), k)
			.mul(smoothstep(0, 0.05, k))
			.mul(oneMinus(smoothstep(0.85, 1, k)))
			.mul(visibility);
		if (e.groundCull) scale = scale.mul(step(groundY, position.y));
		material.positionNode = positionLocal.mul(vec3(scale, scale.mul(e.stretch), scale)).add(position);

		const tint = mix(color(e.color[0]), color(e.color[1]), k);
		material.colorNode = tint;
		if (e.emissive > 0) {
			const blink = e.blink ? sin(this.u.time.mul(3).add(r1.y.mul(TAU))).mul(0.5).add(0.5) : float(1);
			material.emissiveNode = tint.mul(e.emissive).mul(blink);
		}
		if (e.opacity < 1) {
			material.transparent = true;
			material.depthWrite = false;
			material.opacityNode = float(e.opacity);
		}

		const mesh = new InstancedMesh(this.geometry, material, e.count);
		mesh.frustumCulled = false;
		mesh.castShadow = false;
		this.group.add(mesh);
		return { spec: e, mesh, origin, count, visibility };
	}

	setDensity(density: number): void {
		for (const item of this.live) {
			const n = instanceCount(item.spec.count, density);
			item.mesh.count = n;
			item.count.value = n;
		}
	}

	setEnabled(on: boolean): void {
		this.group.visible = on;
	}

	update(positionOf: (index: number) => Vec3 | null, night: number): void {
		for (const item of this.live) {
			const { spec } = item;
			let visible = spec.nightOnly ? night : 1;
			if (spec.attach !== null) {
				const p = positionOf(spec.attach);
				if (p) item.origin.value.set(p[0] + spec.offset[0], p[1] + spec.offset[1], p[2] + spec.offset[2]);
				else visible = 0;
			}
			item.visibility.value = visible;
		}
	}

	dispose(): void {
		this.group.removeFromParent();
		for (const item of this.live) (item.mesh.material as MeshStandardNodeMaterial).dispose();
		this.geometry.dispose();
		this.ground.dispose();
	}
}
```

Точечные несоответствия типов TSL правьте узко (без `any`).

- [ ] **Step 7: EntityLayer — id и позиции**

В `src/engine/entities/layer.ts`:
- `LiveInstance` + `position: Vec3 | null` (инициализировать `null`);
- в `update` после успешной раскладки позы: `item.position = [pose.position[0], pose.position[1], pose.position[2]];`
- методы:

```ts
	get ids(): string[] {
		return this.live.map((item) => item.instance.id);
	}

	/** Мировая точка привязки экземпляра на последней успешной позе. */
	positionOf(index: number): Vec3 | null {
		return this.live[index]?.position ?? null;
	}
```

- [ ] **Step 8: Движок**

`src/engine/index.ts`:
- импорты: `ParticleLayer, type GroundField` из `./particles/layer.ts`; тип `AtmosphereFactory` из `./types.ts`; экспорт типов `AtmosphereFactory, AtmosphereSpec, EmitterSpec, LightSpec`;
- `MountOptions` + `atmosphere?: AtmosphereFactory; particles?: boolean;`
- состояние:

```ts
	let atmosphereFactory = options.atmosphere;
	let field: GroundField | null = null;
	let particles: ParticleLayer | null = null;
	let particlesEnabled = options.particles ?? true;
	const positionOf = (index: number) => layer?.positionOf(index) ?? null;
```

- в `loadWorld`: `const heightmap = buildHeightmap(world, palette); const context: WorldContext = { anchors, groundAt: heightmap.groundAt };` и рядом с `worldContext = context;` — `field = heightmap;` (до `rebuildEntities()`)
- новая функция и вызов в конце `rebuildEntities` (перед `redrawIfIdle()`):

```ts
	const rebuildAtmosphere = (): void => {
		particles?.dispose();
		particles = null;
		if (disposed || !atmosphereFactory || !worldContext || !field) return;
		try {
			const spec = atmosphereFactory({
				...worldContext,
				size: config.size,
				entityIds: layer?.ids ?? [],
			});
			particles = new ParticleLayer(spec.emitters, field, uniforms);
			particles.setDensity(stage.preset.particles);
			particles.setEnabled(particlesEnabled);
			stage.scene.add(particles.group);
		} catch (error) {
			console.error('[diorama] не удалось создать атмосферу:', error);
		}
	};
```

- `frame()`: после `layer?.update(animTime);` — `particles?.update(positionOf, uniforms.night.value);`
- везде, где меняется уровень качества (`applyQuality` и авто-понижение), после `stage.setQuality(...)` — `particles?.setDensity(stage.preset.particles);`
- `dispose`: `particles?.dispose();` до `stage.dispose()`.
- контроллер:

```ts
	setParticles(on: boolean): void;
	reloadWorld(url: string, entities?: EntityFactory, atmosphere?: AtmosphereFactory): Promise<void>;
```

```ts
		setParticles(on) {
			particlesEnabled = on;
			particles?.setEnabled(on);
			redrawIfIdle();
		},
		reloadWorld: (url, entities, atmosphere) => {
			if (entities !== undefined) entityFactory = entities;
			if (atmosphere !== undefined) atmosphereFactory = atmosphere;
			return loadWorld(url, false);
		},
```

- [ ] **Step 9: Вьюер**

`src/lib/components/Viewer.svelte`:

```ts
	async function atmosphereFor(diorama: Diorama): Promise<AtmosphereFactory> {
		const { createAtmosphereRuntime } = await import('#sdk');
		return (ctx) => createAtmosphereRuntime(diorama, ctx);
	}
```

(импорт типа `AtmosphereFactory` из `#engine`); в `mountDiorama(...)` добавить `atmosphere: await atmosphereFor(diorama),`; в `reload()` — `controller.reloadWorld(worldUrl(true), await entitiesFor(diorama), await atmosphereFor(diorama))`.

- [ ] **Step 10: Проверки**

```bash
bun run format && bun run check
```

Визуально (контроллер): временно добавить в `river-mill` `particles: [smoke({ at: 'house.door' }), snow()]` — дым поднимается, снег падает и исчезает у земли; переключение `setParticles(false)` в консоли скрывает частицы; на «Низком» частиц меньше. Временную правку откатить.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(engine): render stateless GPU particles with ground culling

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Точечный свет в движке

**Files:**
- Create: `src/engine/light-math.ts`, `src/engine/lights.ts`
- Modify: `src/engine/index.ts`
- Test: `src/engine/light-math.test.ts`

**Interfaces:**
- Consumes: `LightSpec`, `AtmosphereFactory` (Task 6), фабрика атмосферы и `positionOf` (Task 8).
- Produces: `flickerFactor(t, seed): number` (в [0.75, 1.25]), `lightIntensity(spec, t, night): number`, `class LightLayer { group; constructor(specs); update(t, night, positionOf); dispose() }`.

- [ ] **Step 1: Падающие тесты**

`src/engine/light-math.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { flickerFactor, lightIntensity } from './light-math.ts';

const spec = { intensity: 2, flicker: false, nightOnly: false, seed: 3 };

test('мерцание: детерминировано, в пределах ±25%, меняется во времени', () => {
	const values = new Set<number>();
	for (let t = 0; t < 20; t += 0.05) {
		const f = flickerFactor(t, 3);
		expect(f).toBeGreaterThanOrEqual(0.75);
		expect(f).toBeLessThanOrEqual(1.25);
		expect(f).toBe(flickerFactor(t, 3));
		values.add(Math.round(f * 100));
	}
	expect(values.size).toBeGreaterThan(10);
	expect(flickerFactor(1, 3)).not.toBe(flickerFactor(1, 4));
});

test('яркость: мерцание и ночной режим', () => {
	expect(lightIntensity(spec, 5, 0)).toBe(2);
	expect(lightIntensity({ ...spec, nightOnly: true }, 5, 0)).toBe(0);
	expect(lightIntensity({ ...spec, nightOnly: true }, 5, 1)).toBe(2);
	expect(lightIntensity({ ...spec, flicker: true }, 5, 0)).toBeCloseTo(2 * flickerFactor(5, 3), 9);
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/engine/light-math.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/engine/light-math.ts`**

```ts
import type { LightSpec } from './types.ts';

/** Детерминированное мерцание огня: 1 ± 0.25. */
export function flickerFactor(t: number, seed: number): number {
	const n =
		0.5 * Math.sin(t * 7.3 + seed) + 0.3 * Math.sin(t * 13.1 + seed * 2.1) + 0.2 * Math.sin(t * 23.7 + seed * 3.7);
	return 1 + 0.25 * n;
}

export function lightIntensity(
	spec: Pick<LightSpec, 'intensity' | 'flicker' | 'nightOnly' | 'seed'>,
	t: number,
	night: number,
): number {
	return spec.intensity * (spec.flicker ? flickerFactor(t, spec.seed) : 1) * (spec.nightOnly ? night : 1);
}
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/engine/light-math.test.ts`
Expected: PASS.

- [ ] **Step 5: `src/engine/lights.ts`**

```ts
import { Group, PointLight } from 'three/webgpu';
import { lightIntensity } from './light-math.ts';
import type { LightSpec, Vec3 } from './types.ts';

/** Точечные источники без теней: мерцание, ночной режим, привязка к сущности. */
export class LightLayer {
	readonly group = new Group();
	private readonly live: Array<{ spec: LightSpec; light: PointLight }> = [];

	constructor(specs: LightSpec[]) {
		for (const spec of specs) {
			const light = new PointLight(spec.color, spec.intensity, spec.distance, 2);
			light.castShadow = false;
			light.position.set(...spec.position);
			this.group.add(light);
			this.live.push({ spec, light });
		}
	}

	update(t: number, night: number, positionOf: (index: number) => Vec3 | null): void {
		for (const { spec, light } of this.live) {
			let intensity = lightIntensity(spec, t, night);
			if (spec.attach !== null) {
				const p = positionOf(spec.attach);
				if (p) light.position.set(p[0] + spec.offset[0], p[1] + spec.offset[1], p[2] + spec.offset[2]);
				else intensity = 0;
			}
			light.intensity = intensity;
		}
	}

	dispose(): void {
		this.group.removeFromParent();
		for (const { light } of this.live) light.dispose();
	}
}
```

- [ ] **Step 6: Подключение в `src/engine/index.ts`**

- `let lights: LightLayer | null = null;`
- в `rebuildAtmosphere`: `lights?.dispose(); lights = null;` в начале; после создания частиц — `lights = new LightLayer(spec.lights); stage.scene.add(lights.group);` (внутри того же `try`);
- `frame()`: `lights?.update(animTime, uniforms.night.value, positionOf);`
- `dispose`: `lights?.dispose();`.

- [ ] **Step 7: Проверки**

```bash
bun run format && bun run check
```

Визуально (контроллер): временный `lights: [pointLight({ at: 'house.door', flicker: true, intensity: 4 })]` в `river-mill` — у двери дома тёплое пятно света, мерцает; с `onlyAtNight` днём гаснет. Временную правку откатить.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(engine): add flickering point lights with night mode

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Меню настроек, телефоны, reduced motion

**Files:**
- Create: `src/lib/client/settings.ts`, `src/lib/components/SettingsPanel.svelte`
- Modify: `src/engine/render/stage.ts`, `src/engine/index.ts`, `src/lib/components/Viewer.svelte`, `src/app.d.ts`
- Test: `src/lib/client/settings.test.ts`

**Interfaces:**
- Consumes: контроллер `setHour/getHour/setTimeSpeed/getTimeSpeed/setSky/getSky/setQuality/getQuality/setParticles` (Tasks 2–4, 8); `SceneConfig.time/sky/camera.autoRotate`.
- Produces:
  - `stage.setAutoRotate(on)`; контроллер `setAutoRotate(on)`.
  - `ViewerSettings`, `SETTINGS_KEY`, `parseSettings(raw): Partial<ViewerSettings>`, `serializeSettings(s)`, `resolveSettings(stored, defaults): ViewerSettings`, `formatHour(h)`, `SPEED_OPTIONS`, `SKY_OPTIONS`, `QUALITY_OPTIONS`, `QUALITY_NAMES`.
  - `SettingsPanel.svelte` (пропсы — в коде ниже).
  - `window.__diorama` + `setHour(h)`, `setSky(kind)`, `setQuality(q)`.

- [ ] **Step 1: Падающие тесты**

`src/lib/client/settings.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { formatHour, parseSettings, resolveSettings, serializeSettings } from './settings.ts';

describe('parseSettings', () => {
	test('мусор и старые форматы — пустые настройки без исключения', () => {
		for (const raw of [null, '', 'not json', '42', '[]', '{"quality":"ultra"}', '{"particles":"yes"}']) {
			expect(parseSettings(raw)).toEqual({});
		}
	});

	test('валидные поля читаются, лишние игнорируются', () => {
		expect(parseSettings('{"quality":"low","particles":false,"autoRotate":true,"speed":2}')).toEqual({
			quality: 'low',
			particles: false,
			autoRotate: true,
		});
		expect(parseSettings('{"quality":"medium","particles":3}')).toEqual({ quality: 'medium' });
	});

	test('serialize ↔ parse', () => {
		const s = { quality: 'high' as const, particles: true, autoRotate: false };
		expect(parseSettings(serializeSettings(s))).toEqual(s);
	});
});

describe('resolveSettings', () => {
	test('по умолчанию: авто, частицы вкл, автоповорот из диорамы', () => {
		expect(resolveSettings({}, { autoRotate: true, reducedMotion: false })).toEqual({
			quality: 'auto',
			particles: true,
			autoRotate: true,
		});
	});

	test('reduced motion выключает автоповорот, если зритель не включал', () => {
		expect(resolveSettings({}, { autoRotate: true, reducedMotion: true }).autoRotate).toBe(false);
		expect(resolveSettings({ autoRotate: true }, { autoRotate: true, reducedMotion: true }).autoRotate).toBe(true);
	});
});

test('formatHour', () => {
	expect(formatHour(18.5)).toBe('18:30');
	expect(formatHour(9.25)).toBe('09:15');
	expect(formatHour(0)).toBe('00:00');
	expect(formatHour(23.999)).toBe('00:00');
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/lib/client/settings.test.ts`
Expected: FAIL.

- [ ] **Step 3: `src/lib/client/settings.ts`**

```ts
import type { QualityLevel, QualitySetting, SkyKind } from '#engine';

export interface ViewerSettings {
	quality: QualitySetting;
	particles: boolean;
	autoRotate: boolean;
}

export const SETTINGS_KEY = 'voxel-diorama:settings';

const QUALITIES: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high'];

/** Разбор сохранённых настроек; невалидное игнорируется (без исключений). */
export function parseSettings(raw: string | null): Partial<ViewerSettings> {
	if (!raw) return {};
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
	const v = value as Record<string, unknown>;
	const out: Partial<ViewerSettings> = {};
	if ((QUALITIES as readonly unknown[]).includes(v.quality)) out.quality = v.quality as QualitySetting;
	if (typeof v.particles === 'boolean') out.particles = v.particles;
	if (typeof v.autoRotate === 'boolean') out.autoRotate = v.autoRotate;
	return out;
}

export function serializeSettings(s: Partial<ViewerSettings>): string {
	return JSON.stringify({ quality: s.quality, particles: s.particles, autoRotate: s.autoRotate });
}

export function resolveSettings(
	stored: Partial<ViewerSettings>,
	defaults: { autoRotate: boolean; reducedMotion: boolean },
): ViewerSettings {
	return {
		quality: stored.quality ?? 'auto',
		particles: stored.particles ?? true,
		autoRotate: stored.autoRotate ?? (defaults.autoRotate && !defaults.reducedMotion),
	};
}

/** 18.5 → «18:30». */
export function formatHour(hour: number): string {
	const minutes = Math.round(hour * 60) % (24 * 60);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const SPEED_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
	{ value: 0, label: 'Стоп' },
	{ value: 0.5, label: '0.5x' },
	{ value: 1, label: '1x' },
	{ value: 1.5, label: '1.5x' },
	{ value: 2, label: '2x' },
];

export const SKY_OPTIONS: ReadonlyArray<{ value: SkyKind; label: string; swatch: string }> = [
	{ value: 'gradient', label: 'Градиент', swatch: 'linear-gradient(#3d7bd9, #bcd8f5)' },
	{ value: 'solid', label: 'Сплошной', swatch: '#bcd8f5' },
	{ value: 'realistic', label: 'Реалистичное', swatch: 'radial-gradient(circle at 70% 30%, #fff6d0 8%, #7fb2ec 30%, #2c5fa8)' },
	{ value: 'stylized', label: 'Стилизованное', swatch: 'radial-gradient(circle at 30% 30%, #ffffff 6%, #1b2747 10%, #05070f)' },
];

export const QUALITY_OPTIONS: ReadonlyArray<{ value: QualitySetting; label: string }> = [
	{ value: 'auto', label: 'Авто' },
	{ value: 'low', label: 'Низкое' },
	{ value: 'medium', label: 'Среднее' },
	{ value: 'high', label: 'Высокое' },
];

export const QUALITY_NAMES: Readonly<Record<QualityLevel, string>> = {
	low: 'низкое',
	medium: 'среднее',
	high: 'высокое',
};
```

- [ ] **Step 4: Тесты проходят**

Run: `bun test src/lib/client`
Expected: PASS.

- [ ] **Step 5: Автоповорот в движке**

`stage.ts`: `setAutoRotate(on: boolean): void { this.controls.autoRotate = on; }`.
`index.ts`: в контроллере `setAutoRotate(on: boolean): void;` → `setAutoRotate(on) { stage.setAutoRotate(on); }`.

- [ ] **Step 6: `src/lib/components/SettingsPanel.svelte`**

```svelte
<script lang="ts">
	import type { QualityLevel, QualitySetting, SkyKind } from '#engine';
	import {
		formatHour,
		QUALITY_NAMES,
		QUALITY_OPTIONS,
		SKY_OPTIONS,
		SPEED_OPTIONS,
	} from '#lib/client/settings.ts';

	interface Props {
		hour: number;
		speed: number;
		sky: SkyKind;
		quality: QualitySetting;
		effectiveQuality: QualityLevel;
		particles: boolean;
		autoRotate: boolean;
		onHourInput: (hour: number) => void;
		onDrag: (dragging: boolean) => void;
		onSpeed: (speed: number) => void;
		onSky: (sky: SkyKind) => void;
		onQuality: (quality: QualitySetting) => void;
		onParticles: (on: boolean) => void;
		onAutoRotate: (on: boolean) => void;
		onReset: () => void;
	}

	let p: Props = $props();
</script>

<div class="panel" role="dialog" aria-label="Настройки диорамы">
	<section>
		<label class="title" for="hour">Время суток <span class="value">{formatHour(p.hour)}</span></label>
		<input
			id="hour"
			type="range"
			min="0"
			max="24"
			step="0.05"
			value={p.hour}
			aria-label="Время суток"
			oninput={(e) => p.onHourInput(Number(e.currentTarget.value))}
			onpointerdown={() => p.onDrag(true)}
			onpointerup={() => p.onDrag(false)}
			onchange={() => p.onDrag(false)}
		/>
	</section>

	<section>
		<span class="title" id="speed-label">Скорость смены дня и ночи</span>
		<div class="segmented" role="radiogroup" aria-labelledby="speed-label">
			{#each SPEED_OPTIONS as option (option.value)}
				<button
					type="button"
					role="radio"
					aria-checked={p.speed === option.value}
					class:active={p.speed === option.value}
					onclick={() => p.onSpeed(option.value)}>{option.label}</button
				>
			{/each}
		</div>
	</section>

	<section>
		<span class="title" id="sky-label">Небо</span>
		<div class="skies" role="radiogroup" aria-labelledby="sky-label">
			{#each SKY_OPTIONS as option (option.value)}
				<button
					type="button"
					role="radio"
					aria-checked={p.sky === option.value}
					class:active={p.sky === option.value}
					onclick={() => p.onSky(option.value)}
				>
					<span class="swatch" style:background={option.swatch}></span>
					{option.label}
				</button>
			{/each}
		</div>
	</section>

	<section>
		<span class="title" id="quality-label">
			Качество
			{#if p.quality === 'auto'}<span class="value">Авто · {QUALITY_NAMES[p.effectiveQuality]}</span>{/if}
		</span>
		<div class="segmented" role="radiogroup" aria-labelledby="quality-label">
			{#each QUALITY_OPTIONS as option (option.value)}
				<button
					type="button"
					role="radio"
					aria-checked={p.quality === option.value}
					class:active={p.quality === option.value}
					onclick={() => p.onQuality(option.value)}>{option.label}</button
				>
			{/each}
		</div>
	</section>

	<section class="toggles">
		<label><input type="checkbox" checked={p.particles} onchange={(e) => p.onParticles(e.currentTarget.checked)} /> Частицы</label>
		<label><input type="checkbox" checked={p.autoRotate} onchange={(e) => p.onAutoRotate(e.currentTarget.checked)} /> Вращение камеры</label>
	</section>

	<button type="button" class="reset" onclick={p.onReset}>Сбросить к настройкам диорамы</button>
</div>

<style>
	.panel {
		position: absolute;
		top: 64px;
		right: 16px;
		width: 320px;
		padding: 16px;
		border-radius: var(--radius);
		background: rgb(14 15 19 / 0.82);
		backdrop-filter: blur(10px);
		display: grid;
		gap: 14px;
		z-index: 10;
	}
	section {
		display: grid;
		gap: 8px;
	}
	.title {
		font-size: 13px;
		color: var(--muted);
		display: flex;
		justify-content: space-between;
	}
	.value {
		color: var(--text);
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}
	.segmented {
		display: grid;
		grid-auto-flow: column;
		gap: 4px;
	}
	.skies {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	button {
		min-height: 40px;
		border: 0;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
	}
	button.active {
		background: var(--accent);
		color: #1a1206;
	}
	.skies button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px;
	}
	.swatch {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		flex: none;
	}
	.toggles {
		display: flex;
		gap: 16px;
		font-size: 14px;
	}
	.reset {
		background: transparent;
		color: var(--muted);
		text-decoration: underline;
	}
	@media (max-width: 600px) {
		.panel {
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			width: auto;
			border-radius: var(--radius) var(--radius) 0 0;
			max-height: 70dvh;
			overflow-y: auto;
		}
	}
</style>
```

- [ ] **Step 7: Вьюер**

`src/lib/components/Viewer.svelte`:
- импорты: `untrack` из `svelte`; `SettingsPanel`, `parseSettings`, `resolveSettings`, `serializeSettings`, `SETTINGS_KEY`, `type ViewerSettings` из `#lib/client/settings.ts`; типы `QualityLevel, QualitySetting, SkyKind` из `#engine`;
- состояние:

```ts
	let menuOpen = $state(false);
	// Начальные значения из диорамы выставляются в onMount (пропсы здесь не захватываем).
	let hour = $state(13);
	let speed = $state(0);
	let skyKind = $state<SkyKind>('gradient');
	let settings = $state<ViewerSettings>({ quality: 'auto', particles: true, autoRotate: false });
	let effectiveQuality = $state<QualityLevel>('high');
	let dragging = false;
```

- в `onMount` до монтирования:

```ts
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		hour = scene.time.start;
		speed = scene.time.speed;
		skyKind = scene.sky.kind;
		settings = resolveSettings(parseSettings(localStorage.getItem(SETTINGS_KEY)), {
			autoRotate: scene.camera.autoRotate,
			reducedMotion,
		});
		if (reducedMotion) speed = 0;
		const config: SceneConfig = capture
			? { ...scene, camera: { ...scene.camera, autoRotate: false } }
			: {
					...scene,
					time: { ...scene.time, speed },
					camera: { ...scene.camera, autoRotate: settings.autoRotate },
				};
```

- в `mountDiorama(...)` опции `quality: settings.quality, particles: settings.particles`;
- после `controller = ctl;`:

```ts
				effectiveQuality = ctl.getQuality().effective;
				const poll = setInterval(() => {
					if (!dragging) hour = ctl.getHour();
					effectiveQuality = ctl.getQuality().effective;
				}, 200);
				cleanups.push(() => clearInterval(poll));
```

(завести `const cleanups: Array<() => void> = [];` в `onMount` и вызвать их в возвращаемой функции очистки);
- `$effect` из Task 2/3 заменить на:

```ts
	$effect(() => {
		if (!controller) return;
		controller.setHour(scene.time.start);
		controller.setTimeSpeed(untrack(() => speed));
		controller.setSky(scene.sky);
		skyKind = scene.sky.kind;
	});
```

(`untrack` из `svelte`: эффект срабатывает от правок диорамы при HMR, а не от выбора скорости в меню — скорость зрителя сохраняется);
- обработчики:

```ts
	function persist(next: Partial<ViewerSettings>): void {
		settings = { ...settings, ...next };
		localStorage.setItem(SETTINGS_KEY, serializeSettings(settings));
	}

	const handlers = {
		onHourInput(h: number) {
			hour = h;
			controller?.setHour(h);
		},
		onDrag(d: boolean) {
			dragging = d;
		},
		onSpeed(s: number) {
			speed = s;
			controller?.setTimeSpeed(s);
		},
		onSky(kind: SkyKind) {
			skyKind = kind;
			controller?.setSky({ kind, color: kind === 'solid' ? scene.sky.color : undefined });
		},
		onQuality(q: QualitySetting) {
			persist({ quality: q });
			controller?.setQuality(q);
		},
		onParticles(on: boolean) {
			persist({ particles: on });
			controller?.setParticles(on);
		},
		onAutoRotate(on: boolean) {
			persist({ autoRotate: on });
			controller?.setAutoRotate(on);
		},
		onReset() {
			hour = scene.time.start;
			speed = scene.time.speed;
			skyKind = scene.sky.kind;
			controller?.setHour(hour);
			controller?.setTimeSpeed(speed);
			controller?.setSky(scene.sky);
		},
	};

	function onWindowKey(e: KeyboardEvent): void {
		if (e.key === 'Escape') menuOpen = false;
	}

	function onWindowPointer(e: PointerEvent): void {
		const target = e.target as HTMLElement | null;
		if (menuOpen && !target?.closest('.panel, .settings-button')) menuOpen = false;
	}
```

- разметка (внутри `{#if !capture}` рядом с верхним HUD):

```svelte
<svelte:window onkeydown={onWindowKey} onpointerdown={onWindowPointer} />
```

```svelte
		{#if status === 'ready'}
			<button
				type="button"
				class="hud settings-button"
				aria-expanded={menuOpen}
				aria-label="Настройки"
				onclick={() => (menuOpen = !menuOpen)}>⚙ <span class="label">Настройки</span></button
			>
			{#if menuOpen}
				<SettingsPanel
					{hour}
					{speed}
					sky={skyKind}
					quality={settings.quality}
					{effectiveQuality}
					particles={settings.particles}
					autoRotate={settings.autoRotate}
					{...handlers}
				/>
			{/if}
		{/if}
```

- стили: `.settings-button { top: 16px; right: 16px; height: 40px; padding: 0 14px; }`, `@media (max-width: 600px) { .settings-button .label { display: none; } }`; кнопки нижнего HUD — `min-width: 40px; height: 40px;`; `.viewer { overscroll-behavior: none; }`.
- dev API (`exposeDevApi`): добавить

```ts
			setHour: (h) => ctl.setHour(h),
			setSky: (kind) => ctl.setSky({ kind }),
			setQuality: (q) => ctl.setQuality(q),
```

`src/app.d.ts` — в тип `__diorama` добавить `setHour(hour: number): void; setSky(kind: SkyKind): void; setQuality(quality: QualitySetting): void;` (импорт типов из `#engine`).

- [ ] **Step 8: Проверки**

```bash
bun run format && bun run check
SITE_ORIGIN=https://example.com bun run build
```

Визуально (контроллер, браузер T3):
- кнопка ⚙ справа сверху; панель открывается/закрывается кнопкой, кликом мимо и Esc;
- ползунок меняет солнце, небо, окна; при скорости 1x бегунок движется сам; после перетаскивания время идёт с нового часа;
- 4 неба переключаются; «Качество» меняет картинку и подпись «Авто · …»; «Частицы» и «Вращение камеры» работают и переживают перезагрузку страницы;
- «Сбросить» возвращает время, скорость и небо диорамы;
- пресет iPhone: панель снизу на всю ширину, подпись «Настройки» скрыта, всё нажимается;
- `?capture`: кнопки нет.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(viewer): add settings menu for time, sky, quality and particles

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 11: `diorama:check`, контентный и регрессионный тесты

**Files:**
- Create: `src/sdk/atmosphere/check.ts`
- Modify: `src/sdk/atmosphere/index.ts`, `scripts/diorama-check.ts`, `src/dioramas/content.test.ts`
- Test: `src/sdk/atmosphere/check.test.ts`

**Interfaces:**
- Consumes: `createAtmosphereRuntime`, `ATMOSPHERE_LIMITS`, фабрики `smoke`, `snow`, `pointLight` (Task 6); `createEntityRuntime` (этап 2); `buildHeightmap`; `BakeResult`; `toSceneConfig` (Task 2).
- Produces: `interface AtmosphereStats { emitters: number; particles: number; lights: number }`, `checkAtmosphere(d, baked): AtmosphereStats` (бросает ошибки `createAtmosphereRuntime`), `atmosphereWarnings(stats): string[]`.

- [ ] **Step 1: Падающие тесты**

`src/sdk/atmosphere/check.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { bakeDiorama } from '../bake.ts';
import { type DioramaInput, defineDiorama } from '../schema.ts';
import { atmosphereWarnings, checkAtmosphere } from './check.ts';
import { pointLight } from './lights.ts';
import { smoke, snow } from './particles.ts';

const diorama = (extra: Pick<DioramaInput, 'particles' | 'lights'>) =>
	defineDiorama({
		meta: { title: 'Проверка', createdAt: '2026-10-07' },
		size: [16, 8, 16],
		palette: { grass: '#6aa84f' },
		build(w) {
			w.box([0, 0, 0], [15, 0, 15], 'grass');
			w.anchor('well', [4, 1, 4]);
		},
		...extra,
	});

describe('checkAtmosphere', () => {
	test('считает эмиттеры, частицы и свет', () => {
		const d = diorama({ particles: [smoke({ at: 'well' }), snow()], lights: [pointLight({ at: 'well' })] });
		const stats = checkAtmosphere(d, bakeDiorama(d));
		expect(stats.emitters).toBe(2);
		expect(stats.lights).toBe(1);
		expect(stats.particles).toBeGreaterThan(0);
	});

	test('без атмосферы — нули', () => {
		const d = diorama({});
		expect(checkAtmosphere(d, bakeDiorama(d))).toEqual({ emitters: 0, particles: 0, lights: 0 });
	});

	test('неизвестный якорь — ошибка с номером эмиттера', () => {
		const d = diorama({ particles: [smoke({ at: 'house.chimney' })] });
		expect(() => checkAtmosphere(d, bakeDiorama(d))).toThrow('particles[0] smoke');
	});

	test('attachTo ссылается на сущности диорамы', () => {
		const d = diorama({ particles: [smoke({ attachTo: 'boat' })] });
		expect(() => checkAtmosphere(d, bakeDiorama(d))).toThrow('boat');
	});
});

describe('atmosphereWarnings', () => {
	test('предупреждение при > 80% каждого лимита', () => {
		expect(atmosphereWarnings({ emitters: 1, particles: 10, lights: 0 })).toEqual([]);
		const warnings = atmosphereWarnings({ emitters: 30, particles: 17_000, lights: 7 });
		expect(warnings).toHaveLength(3);
		expect(warnings.join(' ')).toContain('17000');
	});
});
```

В `src/dioramas/content.test.ts`: импорт `checkAtmosphere, toSceneConfig` из `#sdk`; в тест каждой диорамы добавить

```ts
		expect(() => checkAtmosphere(diorama, a.result)).not.toThrow();
```

и новый тест (регрессия «старого» формата времени — Review Focus 1):

```ts
test('quiet-valley: старое time.fixed = закат, время стоит, небо градиент', async () => {
	const scene = toSceneConfig(await loadDiorama('quiet-valley'));
	expect(scene.time).toEqual({ start: 18.5, speed: 0, cycle: 120 });
	expect(scene.sky).toEqual({ kind: 'gradient' });
});
```

- [ ] **Step 2: Тесты падают**

Run: `bun test src/sdk/atmosphere/check.test.ts src/dioramas`
Expected: FAIL — `./check.ts` не найден / `checkAtmosphere` не экспортирован.

- [ ] **Step 3: `src/sdk/atmosphere/check.ts`**

```ts
import { buildHeightmap } from '../../engine/voxel/heightmap.ts';
import type { BakeResult } from '../bake.ts';
import { createEntityRuntime } from '../entities/runtime.ts';
import type { Diorama } from '../schema.ts';
import { ATMOSPHERE_LIMITS, createAtmosphereRuntime } from './runtime.ts';

export interface AtmosphereStats {
	emitters: number;
	/** Частиц на качестве high. */
	particles: number;
	lights: number;
}

/** Разворачивает частицы и свет на запечённом мире, как это сделает вьюер. Бросает понятную ошибку. */
export function checkAtmosphere(
	d: Diorama,
	baked: Pick<BakeResult, 'world' | 'materials' | 'anchors'>,
): AtmosphereStats {
	const { groundAt } = buildHeightmap(baked.world, baked.materials);
	const context = { anchors: baked.anchors, groundAt };
	const entityIds = createEntityRuntime(d.entities, { seed: d.seed, ...context }).map((i) => i.id);
	const spec = createAtmosphereRuntime(d, { ...context, size: d.size, entityIds });
	return {
		emitters: spec.emitters.length,
		particles: spec.emitters.reduce((n, e) => n + e.count, 0),
		lights: spec.lights.length,
	};
}

export function atmosphereWarnings(stats: AtmosphereStats): string[] {
	const warnings: string[] = [];
	if (stats.emitters > ATMOSPHERE_LIMITS.emitters * 0.8) {
		warnings.push(`эмиттеров частиц ${stats.emitters} из ${ATMOSPHERE_LIMITS.emitters}`);
	}
	if (stats.particles > ATMOSPHERE_LIMITS.particles * 0.8) {
		warnings.push(`частиц ${stats.particles} из ${ATMOSPHERE_LIMITS.particles} — на телефонах будет тяжело`);
	}
	if (stats.lights > ATMOSPHERE_LIMITS.lights * 0.8) {
		warnings.push(`источников света ${stats.lights} из ${ATMOSPHERE_LIMITS.lights}`);
	}
	return warnings;
}
```

В `src/sdk/atmosphere/index.ts`: `export { type AtmosphereStats, atmosphereWarnings, checkAtmosphere } from './check.ts';`

- [ ] **Step 4: `scripts/diorama-check.ts`**

Импорт `atmosphereWarnings, checkAtmosphere` из `#sdk`; после блока `entityStats`:

```ts
		const atmosphereStats = checkAtmosphere(diorama, result);
		if (atmosphereStats.emitters + atmosphereStats.lights > 0) {
			console.log(
				`  эмиттеров ${atmosphereStats.emitters} · частиц ${atmosphereStats.particles.toLocaleString('ru-RU')} · света ${atmosphereStats.lights}`,
			);
		}
```

и в цикл предупреждений: `[...bakeWarnings(stats), ...entityWarnings(entityStats), ...atmosphereWarnings(atmosphereStats)]`.

- [ ] **Step 5: Тесты проходят**

Run: `bun test src/sdk src/dioramas`
Expected: PASS.

- [ ] **Step 6: Проверки**

```bash
bun run format && bun run check
bun run diorama:check --no-types
```

Expected: зелёное; для диорам без частиц строки «эмиттеров» нет.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(sdk): check particles and lights in diorama:check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Демо «Зимняя ночь», обновление «Мельницы у реки», скриншоты

**Files:**
- Create: `src/dioramas/winter-night/index.ts`, `static/thumbs/winter-night.webp` (контроллер)
- Modify: `src/dioramas/river-mill/index.ts`, `static/thumbs/river-mill.webp` (контроллер)

**Interfaces:**
- Consumes: всё SDK этапа 3: `time`/`sky` (Task 2–3), `smoke`, `fire`, `sparks`, `snow`, `mist`, `fireflies`, `pointLight` (Task 6), `prefabs.lantern`, `prefabs.campfire`, якорь `house.chimney` (Task 7); `orbit` (этап 2).
- Produces: две диорамы, проходящие `diorama:check` и контентный тест.

- [ ] **Step 1: Создать диораму**

```bash
bun run diorama:new winter-night "Зимняя ночь"
```

- [ ] **Step 2: `src/dioramas/winter-night/index.ts`**

```ts
import { defineDiorama, fire, orbit, pointLight, prefabs, smoke, snow, sparks } from '#sdk';

const HOUSES = [
	{ name: 'house1', x: 24, z: 22, rotate: 180 },
	{ name: 'house2', x: 46, z: 20, rotate: 180 },
	{ name: 'house3', x: 60, z: 60, rotate: 0 },
	{ name: 'house4', x: 40, z: 64, rotate: 0 },
] as const;

const LAMPS = [
	{ name: 'lamp1', x: 34, z: 34 },
	{ name: 'lamp2', x: 54, z: 34 },
	{ name: 'lamp3', x: 50, z: 52 },
] as const;

const FIRE = { x: 44, z: 42 };
const POND = { x: 18, z: 56, r: 8 };

export default defineDiorama({
	meta: {
		title: 'Зимняя ночь',
		createdAt: '2026-10-07',
		description: 'Заснеженная деревня: дым из труб, фонари, костёр с жителями и замёрзший пруд',
		tags: ['зима', 'ночь', 'деревня', 'костёр'],
	},
	seed: 23,
	size: [80, 32, 80],
	palette: {
		snow: '#eef3f8',
		dirt: '#6b5040',
		'pond-bed': '#4a5d6e',
		ice: { color: '#bfe3f5', kind: 'glass' },
	},
	build(w) {
		w.terrain({ noise: 'hills', base: 8, amp: 3, top: 'snow', fill: 'dirt' });

		/** Ровная заснеженная площадка; возвращает y, на который ставить модель. */
		const pad = (x: number, z: number, r: number): number => {
			const y = Math.max(w.heightAt(x, z), 8);
			w.box([x - r, 0, z - r], [x + r, y - 1, z + r], 'dirt');
			w.box([x - r, y, z - r], [x + r, y, z + r], 'snow');
			w.clear([x - r, y + 1, z - r], [x + r, w.size[1] - 1, z + r]);
			return y + 1;
		};

		// Замёрзший пруд: чаша с тёмным дном и стеклянным льдом.
		for (let x = POND.x - POND.r; x <= POND.x + POND.r; x++) {
			for (let z = POND.z - POND.r; z <= POND.z + POND.r; z++) {
				if (Math.hypot(x - POND.x, z - POND.z) > POND.r) continue;
				const top = w.heightAt(x, z);
				if (top >= 6) w.clear([x, 6, z], [x, top, z]);
				w.set([x, 5, z], 'pond-bed');
				w.set([x, 6, z], 'ice');
			}
		}

		for (const h of HOUSES) {
			const y = pad(h.x, h.z, 6);
			w.place(prefabs.house({ roof: '#e3e9f0', rng: w.rng.fork() }), [h.x, y, h.z], {
				rotate: h.rotate,
				name: h.name,
			});
		}
		for (const l of LAMPS) {
			const y = pad(l.x, l.z, 1);
			w.place(prefabs.lantern(), [l.x, y, l.z], { name: l.name });
		}
		const fy = pad(FIRE.x, FIRE.z, 5);
		w.place(prefabs.campfire(), [FIRE.x, fy, FIRE.z], { name: 'campfire' });

		// Ели — по краям, не на площадках и не на пруду.
		w.scatter(prefabs.pine, { count: 10, on: 'snow', minDistance: 6, area: [0, 0, 79, 10] });
		w.scatter(prefabs.pine, { count: 8, on: 'snow', minDistance: 6, area: [70, 0, 79, 79] });
		w.scatter(prefabs.pine, { count: 8, on: 'snow', minDistance: 6, area: [0, 72, 79, 79] });
		w.scatter(prefabs.pine, { count: 4, on: 'snow', minDistance: 6, area: [0, 12, 12, 44] });
	},
	entities: [
		{
			id: 'villagers',
			rig: prefabs.villager(),
			count: 3,
			animate: orbit({ center: 'campfire.fire', radius: 3.5, speed: 0.25 }),
		},
	],
	particles: [
		...HOUSES.map((h) => smoke({ at: `${h.name}.chimney`, rate: 5 })),
		fire({ at: 'campfire.fire', size: 'small' }),
		sparks({ at: 'campfire.fire' }),
		snow({ intensity: 0.6 }),
	],
	lights: [
		pointLight({ at: 'campfire.fire', color: '#ff9a3c', intensity: 6, distance: 14, flicker: true }),
		...LAMPS.map((l) =>
			pointLight({ at: `${l.name}.light`, color: '#ffd28a', intensity: 3, distance: 10, onlyAtNight: true }),
		),
	],
	atmosphere: { time: { start: 21, speed: 0.5 }, sky: 'stylized' },
	camera: { captureTime: 4 },
});
```

Если `diorama:check` ругается (скачок высоты у жителей, пустые колонки, ели на площадках) — двигать координаты/радиусы, не меняя состав сцены.

- [ ] **Step 3: `src/dioramas/river-mill/index.ts`**

Импорт: добавить `fireflies, mist, smoke`. Добавить поля (перед `atmosphere`):

```ts
	particles: [
		smoke({ at: 'house.chimney', rate: 5 }),
		mist({ area: [0, 30, 95, 46], height: 1.5 }),
		fireflies({ area: [40, 50, 75, 75], count: 40, onlyAtNight: true }),
	],
```

и заменить `atmosphere: { time: { fixed: 'sunset' } },` на

```ts
	atmosphere: { time: { start: 18.5, speed: 1 }, sky: 'realistic' },
```

Обновить `meta.description`: `'Мельница, житель на тропинке через мост, кот у дома, птицы над рекой; дым, туман и светлячки'`.

- [ ] **Step 4: Проверки**

```bash
bun run diorama:check winter-night river-mill --no-types
bun run format && bun run check
```

Expected: `✓ ok` у обеих (предупреждение «нет скриншота» для `winter-night` — до Step 5).

- [ ] **Step 5: Визуальное ревью и скриншоты (контроллер, браузер T3)**

По skill `new-diorama`, шаги 4–5, для `/d/winter-night` и `/d/river-mill`:
- «Зимняя ночь»: дым из всех четырёх труб, снег падает и исчезает у земли, костёр с искрами и мерцающим светом, фонари горят; жители ходят вокруг костра, не сквозь него; лёд пруда прозрачный; `setHour(13)` — фонари гаснут, небо дневное.
- «Мельница у реки»: время идёт (1x), закат → ночь — светлячки над берегом появляются, туман над рекой; небо `realistic` с солнцем у горизонта; ходок и кот как раньше.
- Скриншоты `?capture` → `static/thumbs/winter-night.webp`, `static/thumbs/river-mill.webp`; проверить через Read. Сделать `?capture` дважды и сравнить кадры (детерминизм частиц и времени).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(dioramas): add winter night, bring smoke and fireflies to river mill

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Skill, CLAUDE.md, финальная проверка

**Files:**
- Modify: `.claude/skills/new-diorama/SKILL.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: всё публичное API этапа 3.
- Produces: документация для агента-автора диорам.

- [ ] **Step 1: Skill — корневые поля**

В `.claude/skills/new-diorama/SKILL.md`, раздел 2, строку «Корневые поля» заменить на:

```markdown
- Корневые поля: `meta`, `seed`, `size`, `palette`, `build`, `entities`, `particles`, `lights`, `atmosphere: { time, sky, fog }` (туман 0–0.004 — он быстро «выбеливает» цвета, обычно 0), `camera`, `base: 'none' | 'wood' | 'stone'`.
- Префабы атмосферы: `lantern({ post, glow })` (якорь `light`), `campfire()` (якорь `fire`); у `house` есть якорь `chimney` (над трубой).
```

- [ ] **Step 2: Skill — новые подразделы** (после «Сущности (анимация)», перед «## 3. Проверка»)

````markdown
### Время суток и небо

```ts
atmosphere: { time: { start: 'sunset', speed: 1, cycle: 120 }, sky: 'realistic' }
```

- `start` — час 0–24 или `'dawn'` (6.5) · `'day'` (13) · `'sunset'` (18.5) · `'night'` (23). Это и час кадра карточки.
- `speed` — `0 | 0.5 | 1 | 1.5 | 2` (0 — время стоит); `cycle` — секунд на полные сутки при 1x (30–3600, по умолчанию 120).
- `sky`: `'gradient'` (по умолчанию), `'solid'` или `{ kind: 'solid', color: '#rrggbb' }`, `'realistic'` (атмосферное рассеяние, солнце), `'stylized'` (диски солнца и луны, звёзды, облака).
- Ночью `emissive`-материалы светятся ярче; зритель может менять время, скорость и небо в меню ⚙.
- Старое `time: { fixed: 'sunset' }` работает как `{ start: 'sunset', speed: 0 }`.

### Частицы и свет

```ts
particles: [
  smoke({ at: 'house.chimney', rate: 5 }),
  fire({ at: 'campfire.fire', size: 'small' }), sparks({ at: 'campfire.fire' }),
  fireflies({ area: [40, 50, 70, 75], count: 40, onlyAtNight: true }),
  snow({ intensity: 0.6 }), rain({ area: [0, 0, 48, 96] }), leaves({ color: '#d68910' }),
  mist({ area: [0, 30, 95, 46], height: 1.5 }), dust({ area: [40, 40, 60, 60] }),
  smoke({ attachTo: 'boat', offset: [0, 1.2, 0] }),
],
lights: [
  pointLight({ at: 'campfire.fire', color: '#ff9a3c', intensity: 6, distance: 14, flicker: true }),
  pointLight({ at: 'lamp1.light', color: '#ffd28a', onlyAtNight: true }),
],
```

- Точечные (`smoke`, `fire`, `sparks`): `at` (якорь/точка) или `attachTo` (id экземпляра сущности: `boat`, `birds[2]`) + `offset`; `rate` — частиц в секунду.
- Площадные (`fireflies`, `snow`, `rain`, `leaves`, `mist`, `dust`): `area: [x0, z0, x1, z1]` (по умолчанию вся диорама), `intensity` 0–2 или точный `count`.
- Общие: `color`, `onlyAtNight`. Снег, дождь и листья исчезают у земли; светлячки, туман и пыль держатся слоем над землёй.
- Лимиты: ≤ 32 эмиттеров, ≤ 20 000 частиц, ≤ 8 источников света. На телефонах частиц меньше автоматически.
- Свет от фонаря — это два шага: `lantern()` (воксели со свечением) + `pointLight` на его якоре `light`.
````

- [ ] **Step 3: Skill — проверка и ревью**

Раздел 3, к разбору предупреждений добавить: «`эмиттеров/частиц/света N из M` — близко к лимиту, уменьши `intensity`/`count`/`rate`; ошибка `particles[i] <пресет>: …` называет эмиттер — неизвестный якорь или `attachTo`».

Раздел 4, пункт 3 заменить на:

```markdown
3. Посмотри 2–3 ракурса (`preview_scroll` для зума) и 2–3 часа суток: `preview_evaluate` с `window.__diorama.setHour(13)`, `setHour(18.5)`, `setHour(23)`. Небо — `window.__diorama.setSky('stylized')`.
```

В чеклист пункта 4 добавить:

```markdown
   - атмосфера: дым идёт из труб (не из крыши), снег/дождь исчезают у земли, а не под ней; фонари и костёр светят ночью; частиц не так много, что они закрывают сцену;
```

Раздел 5, перед пунктом 1:

```markdown
0. Кадр карточки снимается в час `time.start` и секунду анимации `camera.captureTime` — подбери оба для удачного кадра.
```

- [ ] **Step 4: CLAUDE.md**

Заменить строку «Диорамы импортируют только `#sdk`. Поля `particles` / `lights` появятся на этапе 3; сейчас схема их отвергает.» на:

```markdown
- Диорамы импортируют только `#sdk`.
- Атмосфера: `atmosphere.time` (`start`/`speed`/`cycle`, синонимы `dawn`/`day`/`sunset`/`night`), `atmosphere.sky` (`gradient`/`solid`/`realistic`/`stylized`), `particles` (`smoke`, `fire`, `sparks`, `fireflies`, `snow`, `rain`, `leaves`, `mist`, `dust`), `lights` (`pointLight`). Частицы — без состояния на GPU, функция от часов анимации и seed. Качество (`low`/`medium`/`high`/авто) — настройка зрителя, не диорамы; `?capture` всегда `high`.
```

- [ ] **Step 5: Финальная проверка**

```bash
bun run format && bun run check
bun run diorama:check
SITE_ORIGIN=https://example.com bun run build
```

Expected: всё зелёное; три диорамы `✓ ok`; сборка кладёт `static/baked/*.vxb` и `build/`.

Визуально (контроллер, браузер T3) — сквозной прогон по §13 спека: меню и ползунок; 4 неба; частицы; bloom; вода (волны, френель); уровни качества; пресет iPhone; два одинаковых `?capture`; в консоли нет ошибок; главная со всеми тремя карточками.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: describe time of day, skies, particles and lights for diorama authors

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
