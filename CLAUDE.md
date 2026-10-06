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
- Сущности (`entities`): модели и rig'и с поведениями (`spin`, `bob`, `sway`, `orbit`, `keyframes`, `walkPath`, `wander`, `flock`, `custom`). Поза — функция от `t` и seed (детерминизм). Лицо сущности — +z, углы для авторов — в градусах.
- Якоря: `w.place(model, at, { name })` даёт `<name>.<якорь>`, `w.anchor(name, pos)` — свою точку; сущности ссылаются строкой (`at: 'mill.hub'`). Якоря запекаются в `.vxb` v2.
