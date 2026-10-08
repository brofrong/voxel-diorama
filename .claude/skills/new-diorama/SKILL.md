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

**Сразу заполни `meta.author` — кто делает диораму.** Поле обязательное: без него `defineDiorama` падает. Оно показывается на карточке главной. Возьми данные о себе из системного промпта:
- `model` — название модели, например `'Claude Opus 5.5'`, а не ID.
- `effort` — уровень reasoning effort, например `'high'`.
- `context` — размер контекстного окна, например `'1M'`.

Если effort или контекст неизвестны, удали эти поля и не выдумывай значения. Если диораму заметно дорабатывает другая модель, укажи ту, что сделала основную работу.

**И `meta.launchedBy` — кто запускал модель:** имя и https-ссылка на соцсеть или GitHub. Значение по умолчанию для этого репозитория указано в `CLAUDE.md`. Если диораму запускает другой человек, спроси у него имя и ссылку.

```ts
meta: {
  title: '…',
  createdAt: '…',
  author: { model: 'Claude Opus 5.5', effort: 'high', context: '1M' },
  launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
  …
}
```

Пиши `src/dioramas/<slug>/index.ts`. Что есть в SDK (`#sdk`):

- `w.set / box / sphere / cylinder / line / clear` — примитивы; материал `'air'` вырезает.
- Кисти (есть и в `model()`): `w.ellipsoid(c, [rx, ry, rz], m)`; `w.blob(c, r | [rx, ry, rz], m, { roughness, scale, seed })` — бугристые кроны, облака, скалы, кусты; `w.cone(base, r, h, m, { top })` — крыши, шпили, горки; `w.curve([p0, p1, …], m, { radius, endRadius })` — ветви, лианы, перила, изгиб крыши, русло; `w.shade(a, b, ['тёмный', 'основной', 'светлый'], { only, scale, speckle })` — перекрасить уже нарисованное в коробке пятнами оттенков.
- Поверхность: `w.grass(m | [m, …], { on, density, height })` — пучки травы; `w.flowers([цвета], { on, density, stem })`; `w.moss(m, { on, amount })` — мох на открытых гранях камня/стен/крыш; `w.vines(m, { from, density, length })` — лианы из-под крон, карнизов, низа острова.
- `w.island({ center: [x, z], radius, top, surface, soil, rock, depth?, hills?, roughness?, spikes?, name })` — парящий остров: неровный контур, слои трава/почва/камень, каменный корень с «сосульками». Якоря `<name>.top`, `<name>.bottom`. Вместо скучного среза мира «до дна» с голыми стенками.
- `w.waterfall({ at, width: [wx, wz], to, name })` — струя воды вниз до твёрдого; якоря `<name>.top`/`<name>.bottom` для частиц `pour` и `mist`. `at` — снаружи края, в воздухе.
- `w.terrain({ noise: 'flat' | 'hills' | 'mountains', base, amp, scale, top, fill })`, `w.water({ level })`.
- `w.place(model, [x, y, z], { rotate })` — `[x, y, z]` это **нижний центр** модели.
- `w.scatter(prefabs.tree, { count, on: 'grass', minDistance, area })` — ставит на поверхность; всегда указывай `on`. `scatter` проверяет только материал приземления, поэтому у домов/дорог сузь `area`, чтобы туда не попало.
- `w.heightAt(x, z)` — верхний твёрдый воксель колонки; `w.get(p)` — имя материала.
- `w.rng` (`int`, `float`, `pick`, `chance`, `fork`), `w.noise` (`value`, `fbm`). **Никакого `Math.random`.**
- `prefabs.tree | pine | house | rock` (опции цвета/размера, `rng`) — простые, «леденцы».
- Деревья с объёмной кроной в 3 оттенках: `prefabs.sakura | willow | maple` (`{ rng, height, colors: [тёмный, основной, светлый], bark }`; клён по умолчанию осенний), `prefabs.bush({ rng, size, colors, flowers })`. Для заметных деревьев бери их, а не `tree`.
- Архитектура: `prefabs.pagoda({ tiers, base, wall, post, roof, trim, stone, glow })` (якоря `door`, `top`), `prefabs.torii({ width, height })`, `prefabs.archBridge({ length, width, rise })` (вдоль x; якоря `start`, `end`, `top`), `prefabs.stoneLantern()` (якорь `light`).
- Своя модель: `model({ size: [x, y, z], palette: { … } }, (m) => { … })` — тот же набор примитивов. Если модель универсальна (пригодится в других диорамах) — вынеси её в `src/sdk/prefabs/` с тестом в `prefabs.test.ts`.
- Материалы: `'#rrggbb'` или `{ color, emissive, kind: 'solid' | 'water' | 'glass', vary }`. Светящееся (окна, фонари, лава) — `emissive` 0.5–2. `vary` 0–0.5 — разброс оттенка между соседними вокселями (по умолчанию 0.06 у solid, 0 у воды/стекла): трава, листва, камень, земля — 0.1–0.15; гладкие стены, вывески, буквы — 0–0.03. Оттенки в шейдере не тратят палитру.
- **Больших одноцветных плоскостей быть не должно**: трава, крыши, камень, стены — `vary` и/или `w.shade` в 2–4 оттенка.
- Ключ палитры с именем, совпадающим с материалом префаба (`leaves`, `trunk`, `needles`, `wall`, `roof`, `door`, `window`, `chimney`, `stone`, `stone-dark`), перекрашивает этот префаб везде в диораме — используй осознанно.
- Корневые поля: `meta`, `seed`, `size`, `palette`, `build`, `entities`, `particles`, `lights`, `atmosphere: { time, sky, fog, haze, backdrop }` (туман 0–0.004 — он быстро «выбеливает» цвета, обычно 0), `camera` (+ `tiltShift`), `base: 'none' | 'wood' | 'stone'`.
- Префабы атмосферы: `lantern({ post, glow })` (якорь `light`), `campfire()` (якорь `fire`); у `house` есть якорь `chimney` (над трубой).

### Сущности (анимация)

```ts
entities: [
  { id: 'blades', model: prefabs.windmillBlades(), at: 'mill.hub', animate: spin({ axis: 'z', speed: 0.2 }) },
  { rig: prefabs.villager(), animate: walkPath(['mill.door', [50, 30], 'house.door'], { loop: 'pingpong', pause: 2 }) },
  { rig: prefabs.bird(), count: 6, animate: flock({ center: [48, 28, 40], radius: 14 }) },
]
```

- `at`: `[x, z]` — на земле, `[x, y, z]` — точно, строка — якорь. `at` — это pivot модели (по умолчанию нижний центр); у `windmillBlades` pivot — ступица.
- Якоря: `w.place(prefabs.windmill(), p, { name: 'mill' })` → `mill.hub`, `mill.door`; `prefabs.house` даёт `door`; `w.anchor('well', p)`.
- Земля для `[x, z]` и якорей в маршрутах — верхний твёрдый воксель колонки: крыши, свесы и кроны тоже «земля», поэтому точки маршрута ставь на открытый грунт (якоря `door` префабов — перед дверью). В `custom()` для движения по земле используй `ctx.groundAt(x, z)`.
- Поведения: `spin`, `bob`, `sway` (добавляются к позе); `walkPath`, `wander`, `orbit`, `flock`, `keyframes` (задают позицию); `custom((pose, t, ctx) => …)` — только от `t`/`ctx`, без `Math.random`.
- Префабы: `villager`, `cat`, `bird` (rig, scale 0.25), `windmill`, `windmillBlades`, `boat` (scale 0.5). Своя модель сущности может быть мелкой: `model({ size, palette, scale: 0.25, pivot }, …)`.
- Лимиты: ≤ 256 экземпляров, ≤ 600 частей, модель ≤ 64³.
- `camera.captureTime` — секунда анимации для кадра карточки (по умолчанию 2).

### Время суток и небо

```ts
atmosphere: { time: { start: 'sunset', speed: 1, cycle: 120 }, sky: 'realistic' }
```

- `start` — час 0–24 или `'dawn'` (6.5) · `'day'` (13) · `'sunset'` (18.5) · `'night'` (23). Это и час кадра карточки.
- `speed` — `0 | 0.5 | 1 | 1.5 | 2` (0 — время стоит); `cycle` — секунд на полные сутки при 1x (30–3600, по умолчанию 120).
- `sky`: `'gradient'` (по умолчанию), `'solid'` или `{ kind: 'solid', color: '#rrggbb' }`, `'realistic'` (атмосферное рассеяние, солнце), `'stylized'` (диски солнца и луны, звёзды, облака).
- Ночью `emissive`-материалы светятся ярче; зритель может менять время, скорость и небо в меню ⚙.
- Старое `time: { fixed: 'sunset' }` работает как `{ start: 'sunset', speed: 0 }`.
- `haze` 0–1 (по умолчанию 0.5) — воздушная перспектива: дальнее и всё ниже y = 0 тонет в цвете неба, передний план чистый.
- `backdrop: { clouds: 0–1, mountains: 0–1, cloudSea: true, mountainColor }` — задник: объёмные воксельные облака вокруг, горы на горизонте, облачное море внизу (для парящих островов). Без задника за диорамой пустое небо.
- `camera.tiltShift` 0–1 — размытие верха и низа кадра, эффект миниатюры; 0.3–0.5 заметно, но не мешает.

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

- Точечные (`smoke`, `fire`, `sparks`, `fountain` — струи фонтана, падают обратно в чашу, `pour` — вода переливается через край и стекает вниз; ставь несколько по кромке чаши): `at` (якорь/точка) или `attachTo` (id экземпляра сущности: `boat`, `birds[2]`) + `offset`; `rate` — частиц в секунду; `velocity: [x, y, z]` — добавка к скорости (наклон струи: дуги фонтана наружу, перелив чуть от края), `lifetime` — время жизни, с (струе нужно долететь до низа).
- Площадные (`fireflies`, `snow`, `rain`, `leaves`, `mist`, `dust`): `area: [x0, z0, x1, z1]` (по умолчанию вся диорама), `intensity` 0–2 или точный `count`.
- Общие: `color`, `onlyAtNight`. Снег, дождь и листья исчезают у земли; светлячки, туман и пыль держатся слоем над землёй.
- Лимиты: ≤ 32 эмиттеров, ≤ 20 000 частиц, ≤ 8 источников света. На телефонах частиц меньше автоматически.
- Свет от фонаря — это два шага: `lantern()` (воксели со свечением) + `pointLight` на его якоре `light`.
- Точечный свет быстро гаснет с расстоянием: фонарь — `intensity` 3–8, `distance` 8–12; костёр — 6–10. Проверяй ночью (`setHour(23)`).

## 3. Проверка

```bash
bun run diorama:check <slug>
```

Повторяй, пока не будет `✓ ok`. Предупреждения разбирай: «неиспользуемые материалы» — убери из палитры; «мир пустой» — ошибка в build; много «за границами» — увеличь `size` или сдвинь объекты (немного — норма для scatter у краёв); «скачок высоты» у сущности — маршрут идёт по крыше/кроне/оси, подвинь точки или якорь; «эмиттеров/частиц/света N из M» — близко к лимиту, уменьши `intensity`/`count`/`rate`. Ошибка `particles[i] <пресет>: …` называет эмиттер — неизвестный якорь или `attachTo`.

## 4. Визуальное ревью в превью T3

1. Dev-сервер: если не запущен — `bun run dev --port 5173 --strictPort` в фоне.
2. `preview_navigate` → `{ kind: 'environment-port', port: 5173, path: '/d/<slug>' }`, затем `preview_wait_for` с `[data-status="ready"]` (timeout 60000), затем `preview_snapshot`.
3. Сними 3 ракурса и 1–2 часа суток. Ракурс — `preview_evaluate` с `window.__diorama.setView(azimuth, elevation, zoom)` (градусы; zoom — множитель расстояния камеры диорамы), например `setView(45, 30)`, `setView(200, 15, 0.8)`, `setView(315, 55, 1.2)`. Час — `setHour(13)`, `setHour(18.5)`, `setHour(23)`; небо — `setSky('stylized')`. На слабой графике превью удобнее `/d/<slug>?capture`: там высокое качество и кадр перерисовывается только при изменениях. Каждый кадр — `preview_snapshot` с `save: true` (путь — в `screenshotPath`). Для анимации — 2 кадра обычной страницы с разницей 2–3 с.
4. **Критик.** Запусти агента `diorama-critic` (инструмент Agent, `subagent_type: 'diorama-critic'`). Передай ему замысел (2–5 строк), пути к скриншотам, номер итерации и его прошлый отзыв. Он видит только картинки и отвечает оценками по рубрике и списком исправлений.
5. Сам пройди чеклист:
   - силуэт читается, есть центр внимания, сцена не пустая и не перегруженная;
   - палитра гармоничная, контраст между материалами достаточный;
   - нет висящих в воздухе вокселей и деревьев в воде/на крышах;
   - масштаб объектов согласован (дом выше человека, деревья не гигантские);
   - анимации: 2 снимка с разницей 2–3 с — объекты сдвинулись; ходоки идут по земле/мосту, а не сквозь рельеф; лопасти на ступице; стая не улетает за кадр;
   - атмосфера: дым идёт из труб (не из крыши), снег/дождь исчезают у земли, а не под ней; фонари и костёр светят ночью; частиц не так много, что они закрывают сцену;
   - в консоли нет ошибок (смотри diagnostics в snapshot).
6. Правь код по отзыву критика (сначала верхние пункты «ГЛАВНОЕ») — вьюер обновится сам (HMR). Изменения воксельного содержимого применяются на лету; изменения `camera`/`fog`/`size`/`base` перезагружают страницу автоматически.
7. Повторяй съёмку → критик → правки, пока критик не скажет **ПРИНЯТО** (итог ≥ 8.0 и ни одной оценки ниже 6). Не больше 8 кругов; если не выходит — покажи пользователю текущее состояние и последний отзыв критика.

## 5. Скриншот для карточки

Кадр снимается в час `time.start` и секунду анимации `camera.captureTime` — подбери оба для удачного кадра.

1. `preview_resize` → `{ mode: 'freeform', width: 1200, height: 800 }`.
2. `preview_navigate` → `/d/<slug>?capture`, затем `preview_wait_for` с `[data-status="ready"]`.
3. `preview_evaluate` → `await window.__diorama.saveThumbnail()` → ожидается `{ ok: true }`.
4. Открой `static/thumbs/<slug>.webp` через Read — убедись, что кадр удачный (иначе поправь `camera` в диораме и повтори).
5. `preview_resize` → `{ mode: 'fill' }`.

## 6. Финал

```bash
bun run format && bun run check
```

Покажи пользователю скриншот (`![](абсолютный/путь/к/static/thumbs/<slug>.webp)`) и 2–3 строки о сцене. **Коммит и push — только по команде пользователя.** После push в `main` сайт обновится сам: проверь `gh run watch` (или `gh run list --workflow deploy.yml -L 1`) и дай ссылку `https://brofrong.github.io/voxel-diorama/d/<slug>`.
