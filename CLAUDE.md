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
| `bun run build` | запекание всех диорам в `static/baked` + статическая сборка в `build/`; требует `SITE_ORIGIN` (и `BASE_PATH` для подпути) |
| `bun run build:local` | сборка для локального `bun run preview` (`SITE_ORIGIN=http://localhost:4173`) |

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
- Диорамы импортируют только `#sdk`.
- В каждой диораме обязательно `meta.author: { model, effort?, context? }` — какая ИИ её сделала (модель, effort и контекст берутся из своего системного промпта, не выдумываются). Также обязательно `meta.launchedBy: { name, url }` — кто запускал модель (https-ссылка на соцсеть/GitHub); у пользователя этого репозитория это `{ name: 'Brofrong', url: 'https://github.com/brofrong' }`, если он не сказал иначе. Оба поля выводятся на карточке главной; без них `defineDiorama` падает. Сайт на английском: `meta.title`/`description`/`tags` и весь текст интерфейса — по-английски.
- Атмосфера: `atmosphere.time` (`start`/`speed`/`cycle`, синонимы `dawn`/`day`/`sunset`/`night`), `atmosphere.sky` (`gradient`/`solid`/`realistic`/`stylized`), `particles` (`smoke`, `fire`, `sparks`, `fountain`, `pour`, `fireflies`, `snow`, `rain`, `leaves`, `mist`, `dust`), `lights` (`pointLight`). Частицы — без состояния на GPU, функция от часов анимации и seed. Качество (`low`/`medium`/`high`/авто) — настройка зрителя, не диорамы; `?capture` всегда `high` и перерисовывает кадр только при изменениях.
- Картинка: у материала `vary` — разброс оттенка между вокселями (шум в шейдере по номеру вокселя, палитру не тратит; хранится в `.vxb` v3). Конвейер: GTAO → bloom по эмиссии → tilt-shift (`camera.tiltShift`) → тонмаппинг → цветокоррекция (`GRADE` в `render/pipeline.ts`). `atmosphere.haze` — воздушная перспектива (fogNode сцены), `atmosphere.backdrop` — задник из освещённых вокселей (облака, горы, облачное море).
- Кисти SDK: `blob`/`ellipsoid`/`cone`/`curve`/`shade` (мир и модели), `grass`/`flowers`/`moss`/`vines`/`island`/`waterfall` (мир). Визуальное ревью новых диорам — в цикле с агентом `diorama-critic` (`.claude/agents/`).
- Импорты: внутри `src/engine`, `src/sdk`, `scripts`, `vite` — относительные с `.ts`; в `src/lib`/`src/routes` — `#lib/...ts`, `#sdk`, `#engine`.
- Three.js — только из `three/webgpu`, `three/tsl`, `three/addons/...`.
- SvelteKit 3: конфиг кита в `vite.config.ts`, окружение — `$app/env`.
- Скриншоты и визуальные проверки — через встроенный браузер T3 (`preview_*`), Playwright не используем.
- Тесты — `bun test`, рядом с кодом (`*.test.ts`). Перед коммитом — `bun run format && bun run check`.
- Сущности (`entities`): модели и rig'и с поведениями (`spin`, `bob`, `sway`, `orbit`, `keyframes`, `walkPath`, `wander`, `flock`, `custom`, `limbs`). Скелеты rig'а: `biped`/`quadruped`/`bird` (встроенная походка) и `custom` (любые части; двигает их `limbs`). Поза — функция от `t` и seed (детерминизм). Лицо сущности — +z, углы для авторов — в градусах.
- Якоря: `w.place(model, at, { name })` даёт `<name>.<якорь>`, `w.anchor(name, pos)` — свою точку; сущности ссылаются строкой (`at: 'mill.hub'`). Якоря запекаются в `.vxb` v2.

## Публикация

- Сайт: https://brofrong.github.io/voxel-diorama/ (GitHub Pages, репозиторий `brofrong/voxel-diorama`).
- Каждый push в `main` → `.github/workflows/deploy.yml`: `check` → `build` (`SITE_ORIGIN=https://brofrong.github.io`, `BASE_PATH=/voxel-diorama`) → проверка `build/` → деплой → smoke живого сайта. Статус: `gh run list --workflow deploy.yml -L 1`, `gh run watch`.
- Ссылки — только через `resolve()` (страницы) и `withBase()` (`#lib/paths.ts`, файлы из `static/`). Тест `src/lib/paths.test.ts` ловит атрибуты от корня, `/thumbs/`·`/baked/` вне `withBase()`/dev-ветки и сырые `src`/`.world`; `scripts/verify-build.ts` проверяет собранный HTML.
- Версии скриншотов и миров в URL — хеш содержимого (`src/lib/server/version.ts`).
