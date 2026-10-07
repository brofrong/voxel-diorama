import { Group } from 'three/webgpu';
import { EntityLayer } from './entities/layer.ts';
import { fetchBytes } from './load.ts';
import { createWorldMaterials } from './render/materials.ts';
import { backendName, createRenderer } from './render/renderer.ts';
import { Stage } from './render/stage.ts';
import type { EntityFactory, SceneConfig, TimeOfDay, WorldContext } from './types.ts';
import { buildHeightmap } from './voxel/heightmap.ts';
import { MesherPool } from './voxel/mesher-pool.ts';
import { buildPaletteLUT } from './voxel/palette.ts';
import { decodeVxb } from './voxel/vxb.ts';
import { meshWorld } from './world-mesh.ts';

export { LoadError } from './load.ts';
export { NoGraphicsError } from './render/renderer.ts';
export type {
	BaseStyle,
	CameraConfig,
	EntityFactory,
	EntityInstance,
	SceneConfig,
	TimeOfDay,
	Vec3,
	WorldContext,
} from './types.ts';
export { VxbError } from './voxel/vxb.ts';

export interface MountOptions {
	/** URL запечённого мира (.vxb). */
	url: string;
	/** 0..1: скачивание — первая половина, мешинг — вторая. */
	onProgress?: (progress: number) => void;
	/** Фабрика сущностей; вызывается после загрузки мира (якоря и земля известны). */
	entities?: EntityFactory;
	/** Зафиксировать время анимации (режим скриншота). */
	fixedTime?: number;
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
	/** Перезагрузить мир (и сущности) без перезагрузки страницы; камера сохраняется. */
	reloadWorld(url: string, entities?: EntityFactory): Promise<void>;
	/** Пересоздать сущности на текущем мире. */
	setEntities(factory: EntityFactory | undefined): void;
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

	let entityFactory = options.entities;
	let worldContext: WorldContext | null = null;
	let layer: EntityLayer | null = null;
	let animTime = options.fixedTime ?? 0;
	let lastFrame = performance.now();

	const frame = (): void => {
		layer?.update(animTime);
		stage.render();
	};

	// Когда анимационный цикл не крутится (пауза/скрытая вкладка), setSize и
	// изменение времени суток сами по себе не перерисовывают кадр — дорисовываем вручную.
	const redrawIfIdle = (): void => {
		if (!disposed && (userPaused || document.hidden)) frame();
	};

	const resize = (): void => {
		stage.resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
		redrawIfIdle();
	};
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();

	const loop = (): void => {
		const now = performance.now();
		if (options.fixedTime === undefined) {
			animTime += Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
		}
		lastFrame = now;
		frame();
	};
	const syncLoop = (): void => {
		const running = !userPaused && !document.hidden && !disposed;
		if (running) lastFrame = performance.now();
		void renderer.setAnimationLoop(running ? loop : null);
	};
	document.addEventListener('visibilitychange', syncLoop);
	syncLoop();

	const rebuildEntities = (): void => {
		if (disposed) return;
		layer?.dispose();
		layer = null;
		// Новый слой сущностей — свежий FlockSim; без сброса долгая сессия пересимулировала бы
		// стаю с t=0 до текущего animTime на каждый reload (фриз главного потока).
		animTime = options.fixedTime ?? 0;
		if (entityFactory && worldContext) {
			try {
				layer = new EntityLayer(entityFactory(worldContext), materials);
				stage.scene.add(layer.group);
				layer.update(animTime);
			} catch (error) {
				console.error('[diorama] не удалось создать сущности:', error);
			}
		}
		redrawIfIdle();
	};

	const loadWorld = async (url: string, progressive: boolean): Promise<void> => {
		const report = options.onProgress;
		const bytes = await fetchBytes(url, (p) => report?.(p * 0.5));
		const { world, materials: palette, anchors } = await decodeVxb(bytes);
		const context: WorldContext = { anchors, groundAt: buildHeightmap(world, palette).groundAt };
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
		worldContext = context;
		rebuildEntities();
	};

	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		void renderer.setAnimationLoop(null);
		observer.disconnect();
		document.removeEventListener('visibilitychange', syncLoop);
		pool?.dispose();
		layer?.dispose();
		layer = null;
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
		setTime: (time) => {
			stage.setTime(time);
			redrawIfIdle();
		},
		pause() {
			userPaused = true;
			syncLoop();
		},
		resume() {
			userPaused = false;
			syncLoop();
		},
		reloadWorld: (url, entities) => {
			if (entities !== undefined) entityFactory = entities;
			return loadWorld(url, false);
		},
		setEntities(factory) {
			entityFactory = factory;
			rebuildEntities();
		},
		async captureThumbnail({ width = 1200, height = 800, quality = 0.9 } = {}) {
			const previousRatio = renderer.getPixelRatio();
			renderer.setPixelRatio(1);
			stage.resize(width, height);
			try {
				// render и toBlob в одной задаче — буфер кадра ещё не сброшен.
				return await new Promise<Blob>((resolve, reject) => {
					frame();
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
