# Voxel Diorama — дизайн

Дата: 2026-10-06
Статус: согласован в чате, ожидает ревью спека

## 1. Цель

Публичная витрина воксельных диорам. Главная — сетка карточек (скриншот, название,
дата создания). Клик открывает диораму в 3D: она загружается и рендерится в браузере,
с анимированными объектами, персонажами, частицами и сменой дня/ночи.

Ключевая фишка: владелец пишет запрос в IDE («сделай диораму X»), агент сам собирает
диораму, проверяет её визуально, делает скриншот — и на сайте появляется новая карточка.

**Критерий успеха:** одна фраза в IDE → новый файл диорамы + скриншот → карточка на главной,
которая открывается в 3D, без ручной работы.

### Требования

- Публичный сайт: быстрая загрузка, OG-превью, работа на мобилках.
- Разный масштаб диорам: от компактных блоков (~64³) до ландшафтов (256³+).
- Анимации: движущиеся объекты, персонажи/существа, атмосфера и свет.
- Частицы: дым, огонь, светлячки, снег и т.п.
- Сайт полностью статический, без бэкенда.

### Вне scope

- Автоматические визуальные регрессионные тесты.
- Редактор диорам в браузере.
- Анимация «сборки» диорамы при открытии (можно добавить позже).
- Пакетная перегенерация скриншотов из CLI/CI (при необходимости — опциональный
  Playwright-скрипт позже).

## 2. Стек

| Слой | Выбор |
|---|---|
| Runtime, пакеты, скрипты, тесты | Bun (`bun test`) |
| Фреймворк | SvelteKit + Svelte 5, `adapter-static` (полный prerender) |
| 3D | Three.js, `WebGPURenderer` (авто-fallback на WebGL2), шейдеры на TSL |
| Валидация | zod |
| Lint/format | Biome |
| Типы в `.svelte` | `svelte-check` |
| Скриншоты | встроенный браузер T3 Code (`preview_*`) + dev-only Vite middleware |
| Деплой (этап 4) | Cloudflare Pages (по умолчанию; можно сменить) |

## 3. Структура проекта

```
voxel-diarama/
├─ src/
│  ├─ engine/                  # 3D-движок, НЕ импортирует Svelte
│  │  ├─ voxel/                #   VoxelWorld, чанки 32³, палитра, greedy mesher (+ worker)
│  │  ├─ render/               #   Renderer, камера, свет, пост-обработка
│  │  ├─ entities/             #   сущности, rig'и, behaviours          (этап 2)
│  │  ├─ particles/            #   GPU-частицы, эмиттеры               (этап 3)
│  │  ├─ atmosphere/           #   небо, день/ночь, туман, вода        (этап 1 — базово, 3 — полностью)
│  │  └─ index.ts              #   mountDiorama(canvas, diorama, opts) → controller
│  ├─ sdk/                     # API, которым пишутся диорамы
│  │  ├─ defineDiorama.ts      #   типы + zod-схема
│  │  ├─ builder/              #   примитивы, terrain, water, place, scatter, rng, noise
│  │  └─ prefabs/              #   библиотека моделей/rig'ов (растёт со временем)
│  ├─ dioramas/<slug>/index.ts # контент: одна папка = одна диорама
│  ├─ lib/                     # Svelte-компоненты: Card, Viewer, Loader, Controls
│  └─ routes/
│     ├─ +page.svelte          #   главная
│     └─ d/[slug]/+page.svelte #   вьюер
├─ scripts/                    # bun-скрипты: diorama-new, diorama-check
├─ vite/                       # Vite-плагины: bake, thumbnail-middleware
├─ static/thumbs/<slug>.webp   # скриншоты карточек
├─ .claude/skills/new-diorama/SKILL.md
├─ CLAUDE.md
└─ biome.json, svelte.config.js, vite.config.ts, package.json, tsconfig.json
```

### Границы модулей

- **engine** — чистый TS + Three.js. Svelte только монтирует canvas и вызывает `mountDiorama`.
- **sdk** — единственная зависимость кода диорам. Диорамы не импортируют Three.js напрямую.
- **dioramas** — только контент. Список собирается через `import.meta.glob`, реестра нет.
- **scripts / vite** — инструменты для агента и сборки.

## 4. Формат диорамы (SDK)

Принцип: статика запекается, динамика описывается декларативно, нестандартное — через `custom()`.

```ts
export default defineDiorama({
  meta: { title, createdAt: 'YYYY-MM-DD', description?, tags?: string[] },
  seed: number,
  size: [x, y, z],                       // Y вверх
  palette: Record<string, string | Material>,
  build(w: WorldBuilder): void,          // статичный мир, выполняется при запекании
  entities?: EntityDef[],                // этап 2
  particles?: EmitterDef[],              // этап 3
  lights?: LightDef[],                   // этап 3
  atmosphere?: AtmosphereDef,
  camera?: { position, target, autoRotate?, minDistance?, maxDistance? },
  base?: 'none' | 'wood' | 'stone',          // подставка; по умолчанию 'none'
});
```

### Материалы (palette)

- Строка `'#rrggbb'` — обычный непрозрачный материал.
- Объект `{ color, emissive?: number, kind?: 'solid' | 'water' | 'glass' }`.
- До 255 материалов на диораму (индекс 0 — пустота).

### WorldBuilder (`w`)

- Примитивы: `set(p, mat)`, `box(a, b, mat)`, `sphere(c, r, mat)`, `cylinder(...)`, `line(a, b, mat)`, `clear(...)`.
- Рельеф: `terrain({ noise: 'flat' | 'hills' | 'mountains', base, amp, top, fill })`, `water({ level })` (на этапе 1 вода — статичный материал `kind: 'water'` без анимации).
- Композиция: `place(model, p, { rotate? })`, `scatter(prefabFn, { count, on, minDistance })`.
- Детерминизм: `w.rng` и `w.noise`, инициализированные `seed`.
- Запросы: `w.get(p)`, `w.heightAt(x, z)` — чтобы ставить объекты на рельеф.

### Model и Rig

- **Model** — маленькая воксельная сетка, строится тем же builder-API:
  `model([sx, sy, sz], m => { ... })`. Префабы — функции с параметрами, возвращающие Model.
- **Rig** (этап 2) — именованные Model-части с pivot'ами (head, body, armL/R, legL/R, wings)
  и процедурными позами `idle`, `walk`, `fly`. Привязывается к земле по `heightAt`
  (в путях `y = 0` означает «по земле»).

### Entities, behaviours (этап 2)

```ts
{ id?, model | rig, at?, count?, animate: Behaviour | Behaviour[] }
```

Behaviours композируемы: `spin`, `bob`, `sway`, `orbit`, `walkPath`, `wander`, `flock`,
`keyframes`, `custom((entity, t) => ...)`. Реализованы как чистые функции «время → трансформ»
(кроме `custom`), что делает их тестируемыми.

### Particles, lights, atmosphere (этап 3)

- Пресеты эмиттеров: `smoke`, `fire`, `sparks`, `fireflies`, `snow`, `rain`, `leaves`, `mist`, `dust`;
  параметры `at`/`area`, `rate`, `size`, `attachTo`, `onlyAtNight`.
- `pointLight({ at, color, intensity, flicker })` — максимум 8 на сцену.
- `atmosphere: { time: { cycle: seconds } | { fixed: 'dawn'|'day'|'sunset'|'night' }, sky, fog }`.
  На этапе 1 поддерживаются только `time.fixed` и `fog`; `cycle` — этап 3.

### Правила

- Вся диорама проходит zod-валидацию; ошибки — человекочитаемые, с путём к полю.
- `Math.random` в диорамах запрещён — только `w.rng`. Запекание детерминировано.
- slug = имя папки, используется в URL `/d/<slug>`; только `[a-z0-9-]`.

## 5. Движок

### Запекание (`.vxb`)

- Vite-плагин `vite/bake`: при `build` выполняет `build()` каждой диорамы и эмитит
  `baked/<slug>.vxb`.
- Формат: magic + версия, размер мира, палитра, список непустых чанков 32³
  (координата чанка + RLE-кодированные индексы палитры); весь payload сжат deflate.
- Dev: запекание по запросу с кешем по хешу модуля; при изменении диорамы — HMR-событие,
  вьюер перезагружает мир без перезагрузки страницы.
- Модели сущностей строятся на клиенте (они маленькие).

### Загрузка и мешинг

- Потоковая загрузка `.vxb` с прогрессом, распаковка через `DecompressionStream`.
- Пул воркеров (`min(4, hardwareConcurrency - 1)`), greedy meshing по чанку,
  per-vertex AO, вершинные цвета из палитры; раздельные меши opaque / water / glass.
  Буферы передаются transferable.
- Чанки добавляются в сцену от центра к краям.

### Рендер

- `WebGPURenderer` с авто-fallback на WebGL2; материалы на TSL.
- Воксельный материал (цвет + AO + emissive), вода (волны в vertex shader + френель) — этап 3,
  стекло — этап 3.
- Свет: hemisphere + directional sun с тенью, frustum тени подгоняется под bounds диорамы
  (CSM для больших — этап 3). Tone mapping AgX.
- Пост: bloom (этап 3), туман; GTAO на high (этап 3).
- Orbit-камера с поддержкой touch.

### Частицы (этап 3)

Stateless GPU-частицы: позиция = f(возраст, seed) в шейдере, CPU не обновляет частицы.
Рендер — instanced кубики (воксельный стиль).

### Производительность

- Уровни качества `low | medium | high`, авто-выбор по устройству (этап 3; на этапе 1 —
  только cap DPR): DPR, разрешение теней, bloom, плотность частиц.
- Пауза рендера при скрытой вкладке.

### API

```ts
const ctl = await mountDiorama(canvas, diorama, { quality: 'auto', onProgress });
ctl.setTime('night'); ctl.pause(); ctl.resume();
await ctl.captureThumbnail({ width: 1200, height: 800 }); // Blob webp
ctl.dispose();
```

### Ошибки

- Нет WebGPU и WebGL2 → показываем скриншот диорамы и сообщение.
- Ошибка загрузки/распаковки `.vxb` → сообщение с кнопкой «повторить».
- Ошибка в `custom()` behaviour → сущность отключается, ошибка в консоль, сцена продолжает работать.

## 6. Сайт

- **Главная `/`**: тёмная минималистичная тема; сетка карточек (thumb, title, createdAt, tags),
  сортировка по дате (новые сверху). Prerender.
- **Вьюер `/d/[slug]`**: canvas на весь экран; сверху-слева «назад» + название;
  при загрузке — размытый thumb фоном и прогресс; внизу панель: пауза, ползунок времени суток
  (этап 3), качество (этап 3), fullscreen. OG-мета: title, description, `og:image` = thumb.
  Prerender по списку диорам (`entries`).
- **Режим `?capture`**: без UI, `autoRotate` выключен, камера из `camera` диорамы;
  выставляет `window.__diorama` с `saveThumbnail()` (только в dev).

## 7. Пайплайн скриншотов

1. Агент запускает `bun run dev` (в фоне), открывает `/d/<slug>?capture` в превью T3.
2. `preview_evaluate('await __diorama.saveThumbnail()')` — вьюер рендерит кадр 1200×800,
   кодирует webp и делает `POST /__dev/thumb/<slug>`.
3. Dev-only middleware (`vite/thumbnail`, только `configureServer`) пишет файл в
   `static/thumbs/<slug>.webp`. В прод-сборке middleware отсутствует.
4. Если превью нет — тот же вызов можно сделать из любого браузера в dev.

## 8. Агентный пайплайн

### Команды

| Команда | Назначение |
|---|---|
| `bun run dev` | dev-сервер, bake на лету, HMR диорам |
| `bun run diorama:new <slug> "<Title>"` | scaffold папки из шаблона, `createdAt` = сегодня |
| `bun run diorama:check <slug>` | типы + zod + bake в Bun + статистика и предупреждения |
| `bun run check` | Biome + `svelte-check` + `bun test` |
| `bun run build` | статическая сборка |

`diorama:check` выводит: число вокселей, чанков, используемых материалов, размер `.vxb`,
предупреждения (пустой мир, неиспользуемые материалы, выход за `size`, размер > 2 МБ).

### Skill `new-diorama`

1. Замысел: композиция, палитра, что движется, частицы, время суток. При размытом запросе — 1–2 вопроса.
2. `diorama:new`, код сцены, максимум префабов; универсальные модели — в `sdk/prefabs`.
3. `diorama:check` до зелёного.
4. Визуальное ревью в превью T3: 2–3 ракурса, разное время суток; чеклист — читаемый силуэт,
   гармоничная палитра, нет висящих вокселей, адекватный масштаб, анимации двигаются,
   консоль чистая. 3–5 итераций максимум.
5. Скриншот через `?capture` + `saveThumbnail()`.
6. `bun run check`, показать результат пользователю. Коммит — только по команде пользователя.

### CLAUDE.md

Обзор проекта, команды, правила (Y-up, без `Math.random`, `engine` без Svelte,
диорамы только через `sdk`), ссылка на skill.

## 9. Тестирование

`bun test`:

- greedy mesher: число граней на известных фигурах, значения AO;
- `.vxb` encode/decode roundtrip;
- примитивы builder, `heightAt`;
- валидация: ожидаемые ошибки на невалидных диорамах;
- детерминизм: два запекания одной диорамы дают одинаковый хеш;
- behaviours: позиция в момент `t` (этап 2);
- контентный тест: каждая диорама из `src/dioramas` валидируется, запекается и укладывается в бюджет размера.

## 10. Этапы

1. **Каркас** — SvelteKit + Bun + Biome; SDK (builder, палитра, валидация, базовые префабы);
   bake + `.vxb`; мешер в воркерах; базовый рендер (небо, солнце с тенью, AO, orbit-камера);
   главная и вьюер; пайплайн скриншотов; skill + CLAUDE.md; одна статичная демо-диорама.
2. **Жизнь** — entities, behaviours, rig-персонажи, птицы (flock).
3. **Атмосфера** — частицы, день/ночь, вода, стекло, bloom, point lights, CSM, GTAO,
   уровни качества, полировка мобилок.
4. **Деплой** — Cloudflare Pages + CI (`check` + `build`).

Первый план реализации покрывает только этап 1. Поля этапов 2–3 (`entities`, `particles`,
`lights`) на этапе 1 в схеме отсутствуют и добавляются вместе с реализацией.
