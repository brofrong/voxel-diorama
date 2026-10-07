<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		AtmosphereFactory,
		DioramaController,
		EntityFactory,
		SceneConfig,
	} from '#engine';
	import { loadDioramaModule } from '#lib/client/diorama-loader.ts';
	import type { CardData } from '#lib/types.ts';
	import type { Diorama } from '#sdk';
	import { dev } from '$app/env';
	import { invalidateAll } from '$app/navigation';

	let { card, scene }: { card: CardData; scene: SceneConfig } = $props();

	type Status = 'loading' | 'ready' | 'error' | 'unsupported';

	let canvas: HTMLCanvasElement | undefined = $state();
	let status = $state<Status>('loading');
	let progress = $state(0);
	let errorMessage = $state('');
	let paused = $state(false);
	let capture = $state(false);
	let canFullscreen = $state(false);
	let controller = $state.raw<DioramaController | null>(null);
	let mountedSceneFingerprint = '';

	const worldUrl = (bust: boolean) => `/baked/${card.slug}.vxb${bust ? `?t=${Date.now()}` : ''}`;

	// Время суток — единственное, что применяется без перезагрузки страницы (см. reload()).
	// Старт и скорость времени и небо применяются без перезагрузки страницы; остальное — см. reload().
	const sceneFingerprint = (s: SceneConfig): string =>
		JSON.stringify({ ...s, time: { cycle: s.time.cycle }, sky: undefined });

	$effect(() => {
		if (!controller) return;
		controller.setHour(scene.time.start);
		controller.setTimeSpeed(scene.time.speed);
		controller.setSky(scene.sky);
	});

	async function atmosphereFor(diorama: Diorama): Promise<AtmosphereFactory> {
		const { createAtmosphereRuntime } = await import('#sdk');
		return (ctx) => createAtmosphereRuntime(diorama, ctx);
	}

	async function entitiesFor(diorama: Diorama): Promise<EntityFactory> {
		const { createEntityRuntime } = await import('#sdk');
		return (ctx) => createEntityRuntime(diorama.entities, { seed: diorama.seed, ...ctx });
	}

	function exposeDevApi(ctl: DioramaController): void {
		window.__diorama = {
			slug: card.slug,
			setTime: (time) => ctl.setTime(time),
			async saveThumbnail() {
				const blob = await ctl.captureThumbnail({ width: 1200, height: 800 });
				const response = await fetch(`/__dev/thumb/${card.slug}`, {
					method: 'POST',
					body: blob,
					headers: { 'Content-Type': 'image/webp', 'X-Diorama-Thumb': '1' },
				});
				return await response.json();
			},
		};
	}

	async function reload(): Promise<void> {
		if (!controller) return;
		try {
			const diorama = await loadDioramaModule(card.slug, true);
			await controller.reloadWorld(
				worldUrl(true),
				await entitiesFor(diorama),
				await atmosphereFor(diorama),
			);
			await invalidateAll();
			// Камера/туман/размер/подставка не применяются вживую — проще перезагрузить страницу.
			if (mountedSceneFingerprint && sceneFingerprint(scene) !== mountedSceneFingerprint) {
				location.reload();
			}
		} catch (error) {
			console.error('[diorama] не удалось перезагрузить мир', error);
		}
	}

	onMount(() => {
		let disposed = false;
		capture = new URLSearchParams(location.search).has('capture');
		canFullscreen = document.fullscreenEnabled === true;
		const config: SceneConfig = capture
			? { ...scene, camera: { ...scene.camera, autoRotate: false } }
			: scene;
		mountedSceneFingerprint = sceneFingerprint(scene);

		(async () => {
			if (!canvas) return;
			try {
				const [engine, diorama] = await Promise.all([
					import('#engine'),
					loadDioramaModule(card.slug, dev),
				]);
				const ctl = await engine.mountDiorama(canvas, config, {
					url: worldUrl(dev),
					onProgress: (p) => {
						progress = p;
					},
					entities: await entitiesFor(diorama),
					atmosphere: await atmosphereFor(diorama),
					fixedTime: capture ? scene.captureTime : undefined,
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
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else void document.documentElement.requestFullscreen().catch(() => {});
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
				{#if canFullscreen}
					<button type="button" onclick={toggleFullscreen} aria-label="Во весь экран">⛶</button>
				{/if}
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
