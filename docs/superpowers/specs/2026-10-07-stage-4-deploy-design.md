# Этап 4 «Деплой» — спецификация

Дата: 2026-10-07. Опирается на общий спек `2026-10-06-voxel-diorama-design.md` и этапы 1–3.

## 1. Цель

Витрина диорам публично доступна по адресу `https://brofrong.github.io/voxel-diorama/` и обновляется
сама после каждого push в `main`.

**Критерий успеха:**
- Сайт открывается по ссылке: карточки, 3D-вьюер, меню настроек, `og:image` с абсолютным URL.
- Новая диорама (агент сделал → пользователь закоммитил и запушил) появляется на сайте через пару минут.
- Если `bun run check` не прошёл — ничего не выкладывается.
- Закрыты отложенные пункты: сборка без `SITE_ORIGIN` падает; версии скриншотов не зависят от
  mtime; решён кэш `/baked`.

### Решения, принятые в обсуждении

- Хостинг — **GitHub Pages** (меняет «Cloudflare Pages по умолчанию» из общего спека).
- Репозиторий — новый публичный `brofrong/voxel-diorama`.
- Деплой — GitHub Actions: официальные `actions/upload-pages-artifact` + `actions/deploy-pages`.
- Деплой из `main` при push и вручную (`workflow_dispatch`).

### Вне scope

- Свой домен, превью для PR, CDN/заголовки кэша (GitHub Pages их не настраивает).
- Аналитика, sitemap.

## 2. Конвейер публикации

`.github/workflows/deploy.yml`:

- Триггеры: `push` в `main`, `workflow_dispatch`.
- `permissions: { contents: read, pages: write, id-token: write }`;
  `concurrency: { group: pages, cancel-in-progress: false }`.
- Job `build` (ubuntu-latest):
  1. `actions/checkout`;
  2. `oven-sh/setup-bun` (версия из `package.json#packageManager` или `bun-version: 1.4.x`);
  3. `bun install --frozen-lockfile`;
  4. `bun run check`;
  5. `bun run build` с `SITE_ORIGIN=https://brofrong.github.io`, `BASE_PATH=/voxel-diorama`;
  6. `bun run scripts/verify-build.ts` (см. §5);
  7. `touch build/.nojekyll` (иначе Pages не отдаёт `_app/`);
  8. `actions/upload-pages-artifact` с `path: build`.
- Job `deploy` (needs: build, environment `github-pages`): `actions/deploy-pages`.
- Job `smoke` (needs: deploy): `bun run scripts/smoke.ts <page_url>` — см. §5.

Разовая настройка (делает агент, с подтверждением пользователя перед каждым внешним действием):
`gh repo create brofrong/voxel-diorama --public --source . --push`, включение Pages с источником
GitHub Actions (`gh api -X POST repos/brofrong/voxel-diorama/pages -f build_type=workflow`),
первый запуск и проверка.

## 3. Сайт на подпути

- `vite.config.ts`: `paths: { base: process.env.BASE_PATH ?? '', origin: … }`. В dev base пустой.
- Внутренние адреса строятся через `$app/paths` (SvelteKit 3):
  - страницы — `resolve('/')`, `resolve('/d/[slug]', { slug })` (карточка, «← Все диорамы»);
  - статика — `asset('/thumbs/…')`, `asset('/baked/…')`.
- Серверные хелперы (`thumbUrl`, URL мира) возвращают путь **без** base; base добавляет `asset()` в
  компоненте (одно место ответственности).
- `og:image`, `og:url` — абсолютные: `new URL(path, page.url.origin)` после `asset()`; при prerender
  `page.url.origin` = `SITE_ORIGIN`.
- Dev-пути (`/__dev/thumb/…`, `/src/dioramas/…`, `/baked` в dev) не меняются.
- Регрессионный тест (`src/lib/paths.test.ts`): в `src/lib/**/*.svelte`, `src/routes/**/*.svelte`
  нет `href="/`, `href={\`/`, а строки `'/thumbs/`, `` `/baked/ `` встречаются только внутри
  `asset(…)` или dev-веток (список исключений явный).

## 4. Версии и кэш

GitHub Pages отдаёт всё с `Cache-Control: max-age=600`; свежесть — через версию в URL.

- `_app/immutable/*` — уже с хешем в имени.
- **Скриншоты:** `thumbUrl(slug)` → `/thumbs/<slug>.webp?v=<10 hex sha256 содержимого>`
  (вместо mtime). Одинаковый файл — одинаковая версия на любой машине.
- **Миры:** загрузчик страницы диорамы при prerender читает `static/baked/<slug>.vxb` (его кладёт
  `bake-all` до `vite build`) и отдаёт `worldPath: /baked/<slug>.vxb?v=<10 hex sha256>`; если файла
  нет (dev) — `/baked/<slug>.vxb` без версии. Вьюер в dev по-прежнему добавляет `?t=` при перезагрузке.
- Хеш — общий хелпер `contentVersion(file): string | null` в `src/lib/server/version.ts` (с тестом).

## 5. Защита и проверки

- **Сборка:** `scripts/bake-all.ts` (первый шаг `build`) проверяет окружение до запекания:
  `SITE_ORIGIN` обязателен и должен быть `http(s)://host` без завершающего `/`; `BASE_PATH` пустой
  или `/…` без завершающего `/`. Иначе — понятная ошибка и код 1. Проверка — чистая функция
  `checkBuildEnv(env)` в `scripts/lib/build-env.ts` с тестами.
- `package.json`: `build:local` = `SITE_ORIGIN=http://localhost:4173 bun run build`
  (локальный просмотр через `bun run preview`).
- **`scripts/verify-build.ts`** (после сборки, до выгрузки): в `build/` есть `index.html`,
  `d/<slug>.html` для каждой диорамы, `baked/<slug>.vxb`; во всех HTML атрибуты `href`/`src`,
  начинающиеся с `/`, начинаются с `BASE_PATH/`; `og:image` начинается с `SITE_ORIGIN + BASE_PATH`.
  Логика разбора — чистая функция с тестами.
- **`scripts/smoke.ts <url>`** (после деплоя): GET главной, `d/<slug>` каждой диорамы, их `.vxb` и
  скриншотов → 200 (с повторами до ~60 с — Pages раскатывается не мгновенно).

## 6. Документация

- CLAUDE.md: раздел «Публикация» — адрес сайта, деплой на push в `main`, `gh run watch`, переменные
  `SITE_ORIGIN`/`BASE_PATH`, `build:local`.
- Skill `new-diorama`, шаг «Финал»: после коммита по команде пользователя — push запускает деплой;
  проверить статус `gh run list --workflow deploy.yml -L 1` и открыть страницу диорамы на сайте.

## 7. Тестирование

`bun test`: `checkBuildEnv`, `contentVersion`, `thumbUrl` (хеш), разбор HTML в `verify-build`,
регрессия путей. Вручную/контроллер: `BASE_PATH=/voxel-diorama bun run build:local`-подобная сборка
локально + `verify-build`; после первого деплоя — сайт в браузере T3 (главная, 3 диорамы, меню,
телефон, `og:image`).

## 8. Задачи (ориентир для плана)

1. `checkBuildEnv` + проверка в `bake-all`, `build:local`.
2. `contentVersion`, `thumbUrl` по хешу, `worldPath` с версией.
3. base path: конфиг, `resolve`/`asset` в компонентах, абсолютный `og:*`, тест путей.
4. `verify-build.ts` и `smoke.ts`.
5. Workflow `deploy.yml`.
6. Документация (CLAUDE.md, skill).
7. Публикация: репозиторий, Pages, первый деплой, проверка (агент, с подтверждениями).
