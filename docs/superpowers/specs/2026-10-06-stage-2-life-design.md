# Этап 2 «Жизнь» — дизайн

Дата: 2026-10-06
Статус: согласован в чате, ожидает ревью спека
Базовый спек: `docs/superpowers/specs/2026-10-06-voxel-diorama-design.md` (этот документ его дополняет и
в части сущностей уточняет; при противоречии в вопросах этапа 2 главный — этот документ).

## 1. Цель

Диорамы оживают: вращающиеся и качающиеся объекты, персонажи, которые ходят по рельефу, животные,
стаи птиц. Всё описывается в том же файле диорамы полем `entities` и проигрывается во вьюере.

**Критерий успеха:** демо-диорама «Мельница у реки» — крутятся лопасти мельницы, житель ходит по
тропинке от двери мельницы к дому и обратно по склону (не сквозь рельеф), кот бродит у дома, над
рекой летает стая птиц, лодка качается на воде; скриншот карточки воспроизводим.

### Решения, принятые в обсуждении

- Персонажи — **простые маршруты**: заданные точки или случайное блуждание в зоне, без поиска пути
  и без обхода препятствий (тропу задаёт автор диорамы).
- Масштаб **настраиваемый**: у модели есть `scale` (размер её вокселя в единицах мира); префабы
  существ по умолчанию мелкие (0.25).
- Код анимаций попадает в браузер так: **вьюер подгружает модуль диорамы** (вариант A). Статичный
  мир по-прежнему из `.vxb`; сущности строятся в браузере из того же описания.

### Вне scope

- Поиск пути, обход препятствий, взаимодействие персонажей, расписания.
- `InstancedMesh`/батчинг (появится, если упрёмся в лимиты).
- Частицы, смена дня и ночи, вода с волнами — этап 3.

## 2. Модели: scale, pivot, anchors

```ts
model({
  size: [9, 12, 9],
  palette: { … },
  scale: 0.25,              // размер вокселя модели в единицах мира; по умолчанию 1
  pivot: [4.5, 0, 4.5],     // точка вращения в координатах модели (вокселях); по умолчанию центр size/2
  anchors: { hub: [4, 14, 0], door: [4, 0, 0] },  // именованные точки в координатах модели
}, (m) => { … })
```

- `Model` получает поля `scale: number`, `pivot: Vec3`, `anchors: Record<string, Vec3>`.
- `scale` ∈ (0, 1]; допустимые значения не ограничены списком, но префабы используют 1, 0.5, 0.25.
- `w.place()` принимает только модели с `scale === 1` (это воксели мира); иначе ошибка
  «модели с scale ≠ 1 ставятся только как сущности».
- Имя якоря: `/^[a-z][a-zA-Z0-9_-]*$/`.

### Якоря мира

- `w.place(model, at, { rotate, name })` возвращает `{ anchors: Record<string, Vec3> }` — якоря
  модели в мировых координатах с учётом поворота и точки установки (нижний центр). Если передан
  `name`, якоря регистрируются в мире как `<name>.<anchor>` (например `mill.hub`).
- `w.anchor(name, pos)` регистрирует произвольную точку (`well`, `bridge`).
- Повторная регистрация имени — ошибка. Полное имя: `/^[a-z][a-zA-Z0-9_-]*(\.[a-z][a-zA-Z0-9_-]*)?$/`.
- Якоря запекаются в `.vxb` (см. §6) и доступны в браузере.

## 3. Сущности (поле `entities`)

```ts
import { defineDiorama, prefabs, spin, bob, sway, orbit, keyframes, walkPath, wander, flock, custom } from '#sdk';

entities: [
  { id: 'blades', model: prefabs.windmillBlades(), at: 'mill.hub', animate: spin({ axis: 'z', speed: 0.3 }) },
  { model: prefabs.boat(), at: [20, 11, 60], animate: [bob({ amp: 0.2 }), sway({ angle: 4 })] },
  { rig: prefabs.villager({ shirt: '#3366cc' }), animate: walkPath(['mill.door', [40, 52], 'house.door'], { loop: 'pingpong' }) },
  { rig: prefabs.cat(), at: [50, 60], animate: wander({ area: [44, 54, 62, 70] }) },
  { rig: prefabs.bird(), count: 6, animate: flock({ center: [48, 30, 40], radius: 16 }) },
  { model: myCart, at: [20, 50], animate: custom((pose, t) => { pose.position[0] = 20 + Math.sin(t) * 10; }) },
]
```

### EntityDef

| Поле | Тип | Смысл |
|---|---|---|
| `id` | `string?` | для сообщений об ошибках; уникален в диораме |
| `model` \| `rig` | `Model` \| `Rig` | ровно одно из двух |
| `at` | `Point?` | базовая позиция (нижний центр модели / точка между ступнями rig'а) |
| `rotate` | `number?` | базовый поворот вокруг Y, градусы, по умолчанию 0 |
| `count` | `1..64`, по умолчанию 1 | число экземпляров |
| `animate` | `Behaviour \| Behaviour[]`? | поведения, применяются по порядку |

`Point = [x, z] | [x, y, z] | string`:
- `[x, z]` — на земле: y = верхний твёрдый воксель колонки + 1, пересчитывается при движении;
- `[x, y, z]` — точная позиция;
- `string` — имя якоря (y якоря используется как есть).

Если у сущности нет `at` и ни одно поведение не задаёт позицию (`walkPath`, `wander`, `orbit`,
`flock`, `keyframes` с позициями) — ошибка схемы.

### Поза и поведения

```ts
interface Pose {
  position: Vec3;            // мировые координаты нижнего центра
  rotation: Vec3;            // радианы, Euler порядка YXZ: [pitch(x), yaw(y), roll(z)]
  gait: 'idle' | 'walk' | 'fly';
  stride: number;            // пройденное расстояние (для фазы шага)
}

interface BehaviourContext {
  index: number;             // номер экземпляра 0..count-1
  count: number;
  rng: Rng;                  // форк от seed диорамы, свой у каждого экземпляра
  groundAt(x: number, z: number): number;   // y поверхности (верхний твёрдый + 1)
  anchor(name: string): Vec3;
}
```

Каждое поведение — фабрика, возвращающая объект `{ kind, create(ctx) => (pose, t) => void }`.
Экземпляр поведения может держать внутреннее состояние, но **поза в момент `t` обязана быть
функцией только от `t`, seed и индекса** (не от FPS и истории вызовов). Поведения с симуляцией
(`wander`, `flock`) внутри шагают фиксированным шагом 1/60 с от `t = 0`, кэшируя прогресс, и при
запросе более раннего `t` пересчитывают с нуля.

| Поведение | Параметры (по умолчанию) | Эффект |
|---|---|---|
| `spin` | `axis: 'x'\|'y'\|'z' = 'y'`, `speed` об/с `= 0.25` | `rotation[axis] += 2π·speed·t` |
| `bob` | `amp = 0.25`, `period = 3` с | `position.y += amp·sin(2πt/period + φ)`, φ из rng |
| `sway` | `axis: 'x'\|'z' = 'z'`, `angle = 5`°, `period = 4` | `rotation[axis] += angle·sin(2πt/period + φ)` |
| `orbit` | `center: Point`, `radius`, `speed = 2` ед/с, `clockwise = false` | позиция на окружности, yaw по касательной; `[x,z]`-центр — по земле |
| `keyframes` | `frames: {t, position?, rotation?}[]`, `loop = true` | линейная интерполяция; позиции абсолютные |
| `walkPath` | `points: Point[]` (≥ 2), `speed = 1` ед/с, `loop: true \| 'pingpong' = true`, `pause = 0` с в каждой точке | движение по ломаной, yaw по сегменту, y по земле для `[x,z]`-точек, `gait` walk/idle, `stride` растёт |
| `wander` | `area: [x0,z0,x1,z1]`, `speed = 0.8`, `pause: [min,max] = [1,3]` | случайные точки в зоне (по rng), идёт и стоит; по земле |
| `flock` | `center: Point`, `radius`, `speed = 4` | boids на всех `count` экземплярах сущности сразу; держатся в сфере радиуса `radius` вокруг центра, `gait: 'fly'`, yaw/pitch по скорости |
| `custom` | `(pose, t, ctx) => void` | произвольная правка позы |

Порядок применения: базовая поза из `at`/`rotate` → поведения по порядку. Позиционные поведения
(`walkPath`, `wander`, `orbit`, `flock`, `keyframes` с позициями) **задают** позицию и yaw;
`spin`, `bob`, `sway` **добавляют** к текущей позе. Разные экземпляры (`count`) получают разный
`rng` и, для `walkPath`/`orbit`, сдвиг стартовой фазы `index / count` по длине маршрута/окружности.

## 4. Rig'и

```ts
rig({
  skeleton: 'biped',          // 'biped' | 'quadruped' | 'bird'
  scale: 0.25,                // переопределяет scale моделей частей
  parts: {
    body:  { model: torso },                               // корень: без parent
    head:  { model: head, parent: 'body', at: [2, 6, 1] }, // точка крепления в вокселях родителя
    armL:  { model: arm,  parent: 'body', at: [0, 5, 1] },
    …
  },
})
```

- Части — обычные модели; их `pivot` — сустав (бедро, плечо, основание шеи).
- Обязательные части: biped — `body, head, armL, armR, legL, legR`; quadruped — `body, head,
  legFL, legFR, legBL, legBR` (+ `tail`); bird — `body, wingL, wingR` (+ `head`, `tail`). Ровно один
  корень `body`. Нехватка или лишняя/циклическая связь — ошибка с именем части.
- Высота корня вычисляется автоматически: в позе покоя самый нижний воксель частей стоит на `y` позы.
- `poseRig(skeleton, gait, phase, t): { parts: Record<string, Vec3>, lift: number }` — чистая функция:
  - biped walk: ноги ±35° по X в противофазе, руки ∓25°, `lift` = |sin| × 0.5 вокселя;
  - quadruped walk: диагональные пары ног ±30°;
  - idle: «дыхание» (lift 0.25 вокселя, период 3 с), поворот головы ±10° по Y, хвост ±20°;
  - bird fly: крылья ±60° по Z, частота 4 Гц; bird idle/walk: крылья сложены, голова «клюёт».
  - `phase = stride / strideLength`, `strideLength` = 2 × длина ноги в единицах мира (без «скольжения»).

## 5. Префабы этапа 2

| Префаб | Тип | Scale | Размер | Параметры | Якоря |
|---|---|---|---|---|---|
| `villager` | rig biped | 0.25 | ~9 вокселей (≈2.25 ед.) | `shirt, pants, skin, hair, rng` | — |
| `cat` | rig quadruped | 0.25 | ~6 в длину | `color, rng` | — |
| `bird` | rig bird | 0.25 | ~4 в размахе | `color, rng` | — |
| `windmill` | модель (статичная, для `w.place`) | 1 | ~9×16×9 | `walls, roof, rng` | `hub`, `door` |
| `windmillBlades` | модель (сущность) | 1 | ~15×15×1 | `color` | pivot в центре |
| `boat` | модель (сущность) | 0.5 | ~10×4×5 | `color` | — |

Существующий префаб `house` получает якорь `door` (перед дверью, на уровне земли), чтобы маршруты
могли ссылаться на `<name>.door`.

## 6. `.vxb` версии 2

- Заголовок `VXB` + версия `2`. После секции чанков: `u16 anchorCount`, на якорь —
  `u8 nameLength`, UTF-8 имя, `f32 x, y, z`.
- `decodeVxb` возвращает `{ world, materials, anchors: Record<string, Vec3> }`.
- Файлы версии 1 отвергаются `VxbError` «…перезапеките диораму» (все `.vxb` генерируются из кода).
- `BakeResult` и `BakeStats` получают `anchors` / `anchors: number`.

## 7. Граница SDK ↔ движок

В `src/engine/types.ts` появляются интерфейсы, которые движок потребляет, а SDK реализует:

```ts
interface VoxelModelData { size: Vec3; data: Uint8Array; materials: Material[]; scale: number; pivot: Vec3; }
interface EntityPartSpec { name: string; model: VoxelModelData; parent: number; attach: Vec3; } // attach — в единицах мира относительно pivot родителя
interface EntityPose { position: Vec3; rotation: Vec3; lift: number; parts: Vec3[]; }       // parts[i] — поворот части i
interface EntityInstance { id: string; parts: EntityPartSpec[]; pose(t: number): EntityPose; }
```

- SDK: `createEntityRuntime(entities, { seed, anchors, groundAt }): EntityInstance[]` — разворачивает
  `count`, создаёт поведения, считает позы (поведения + `poseRig`). Простая модель — один экземпляр
  с одной частью.
- Карта высот: `buildHeightmap(world, materials): { groundAt(x, z): number }` в `src/engine/voxel/`
  (чистая функция, используется и движком, и `diorama:check`). `groundAt` билинейно сглаживает
  между колонками; вне мира — 0.
- Движок не импортирует SDK; SDK по-прежнему не импортирует three.

## 8. Движок

- `mountDiorama(canvas, config, { url, onProgress, entities? })`, где
  `entities?: (ctx: { anchors, groundAt }) => EntityInstance[]` — фабрика, вызываемая после
  декодирования `.vxb` (якоря и земля известны только тогда).
- `src/engine/entities/`:
  - мешинг модели: модель кладётся во временный `VoxelWorld`, мешится существующим `meshChunk` по
    чанкам на главном потоке; геометрия кэшируется по `VoxelModelData` (одна на все экземпляры);
  - граф сцены: на каждую часть — `Group` в точке крепления, внутри меш со сдвигом `-pivot·scale`
    и масштабом `scale`; материалы общие с миром; `castShadow = true`;
  - каждый кадр перед рендером: `pose(t)` → позиция/поворот корня, `lift`, повороты частей.
- Часы анимации идут только во время рендера; `dt` ограничивается 0.1 с.
- `SceneConfig.captureTime` (из `camera.captureTime`, по умолчанию 2 с): в режиме `?capture` часы
  зафиксированы на этом значении → скриншот детерминирован.
- `DioramaController.setEntities(factory)` — пересоздаёт сущности без перезагрузки мира (для HMR);
  `reloadWorld(url)` после перезапекания тоже пересоздаёт сущности (новые якоря/земля).
- Ошибка в `pose()` экземпляра: экземпляр замораживается в последней позе, ошибка один раз в консоль.
- Лимиты (проверяются в SDK при создании рантайма): ≤ 256 экземпляров, ≤ 600 частей, модель ≤ 64³.

## 9. Вьюер

- Модуль диорамы грузится лениво: `import.meta.glob('../../dioramas/*/index.ts')` (без `eager`) в
  клиентском модуле `src/lib/client/diorama-loader.ts`; каждая диорама — свой чанк.
- Viewer передаёт `entities: (ctx) => createEntityRuntime(diorama.entities, { seed, ...ctx })`.
  `createEntityRuntime` импортируется из `#sdk` в том же ленивом чанке.
- HMR: на `diorama:update` для своей диорамы в dev модуль переимпортируется с `?t=`; затем
  `reloadWorld` + `setEntities`; камера сохраняется. Изменения fog/camera/size/base по-прежнему
  перезагружают страницу.

## 10. Схема

- `entities` становится разрешённым полем (`particles`, `lights` по-прежнему отвергаются).
- `camera.captureTime?: number` (0..60).
- Валидация `EntityDef` в zod: ровно одно из `model`/`rig`, `count` 1..64, уникальность `id`,
  наличие позиции (см. §3). Проверка якорей и лимитов — в `createEntityRuntime` (нужны запечённые
  якоря), с понятными сообщениями: `неизвестный якорь "mill.hub". Есть: mill.door, well`.

## 11. Инструменты агента

- `diorama:check`: после запекания строит карту высот, вызывает `createEntityRuntime` и `pose(t)`
  для `t = 0..10` с шагом 0.5; печатает `сущностей N · экземпляров M · частей K`; ошибка — на
  неизвестный якорь, исключение в позе, превышение лимитов; предупреждение — при > 80% лимита.
- Контентный тест делает то же для каждой диорамы.
- Skill `new-diorama`: раздел про сущности (поведения, якоря, `scale`, `count`), визуальное ревью
  анимации (2 снимка с разницей в несколько секунд), `camera.captureTime` для удачного кадра.
- CLAUDE.md: краткое упоминание сущностей и якорей.

## 12. Демо

`src/dioramas/river-mill/index.ts` — «Мельница у реки»: река через диораму, мельница
(`w.place(prefabs.windmill(), …, { name: 'mill' })`) с лопастями на `mill.hub`, домик с якорем
`house.door`, житель `walkPath` между `mill.door` и `house.door` (`pingpong`), кот `wander` у дома,
6 птиц `flock` над рекой, лодка `bob`+`sway`, закат; скриншот карточки через `?capture`.
«Тихая долина» остаётся статичной.

## 13. Тестирование

`bun test`:
- поведения: позы в заданные `t` (spin/bob/sway/orbit/keyframes/walkPath), loop/pingpong/pause,
  yaw по сегменту, y по `groundAt`-заглушке, точки-якоря;
- `wander`/`flock`: детерминизм по seed, независимость позы от последовательности запросов `t`,
  границы зоны/радиуса;
- `count`: разные фазы экземпляров;
- `rig`/`poseRig`: обязательные части, противофаза ног, рост фазы с `stride`, крылья;
- якоря: `place` с поворотом, `w.anchor`, дубль имени, `.vxb` v2 roundtrip, отказ v1;
- схема `entities`: понятные ошибки;
- `createEntityRuntime`: экземпляры, иерархия частей, постановка на землю, лимиты, неизвестный якорь;
- `buildHeightmap`: колонки, вода не считается землёй, сглаживание;
- префабы: детерминизм, стоят на земле, обязательные части rig'ов;
- контентный тест всех диорам с прогоном поз.

Визуально (контроллер в браузере T3): анимации двигаются, житель идёт по склону, стая летает,
два снимка `?capture` дают одинаковый файл.

## 14. Задачи (ориентир для плана)

1. Модели: `scale`, `pivot`, `anchors`; якоря в `place` и `w.anchor`.
2. `.vxb` v2 с якорями, запекание.
3. Простые поведения: `spin`, `bob`, `sway`, `orbit`, `keyframes`, `custom`.
4. `walkPath` (земля, якоря, loop/pingpong/pause).
5. `wander`, `flock` с фиксированным шагом.
6. `rig()` и `poseRig`.
7. Схема `entities` и `createEntityRuntime`, `buildHeightmap`.
8. Префабы `villager`, `cat`, `bird`, `windmill`, `windmillBlades`, `boat`.
9. Движок: сцена сущностей, часы, `captureTime`, `setEntities`, опция `mountDiorama`.
10. Вьюер: ленивая загрузка модуля диорамы, HMR сущностей.
11. `diorama:check` и контентный тест.
12. Демо `river-mill`, скриншот, skill и CLAUDE.md, финальная проверка.
