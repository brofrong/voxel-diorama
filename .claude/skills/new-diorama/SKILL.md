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
- Корневые поля: `meta`, `seed`, `size`, `palette`, `build`, `atmosphere: { time: { fixed }, fog }` (туман 0–0.004, fog washes out colors quickly — usually 0), `camera`, `base: 'none' | 'wood' | 'stone'`.

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
