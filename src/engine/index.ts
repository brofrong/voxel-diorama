import { Group } from 'three/webgpu';
import { fetchBytes } from './load.ts';
import { createWorldMaterials } from './render/materials.ts';
import { backendName, createRenderer } from './render/renderer.ts';
import { Stage } from './render/stage.ts';
import type { SceneConfig, TimeOfDay } from './types.ts';
import { MesherPool } from './voxel/mesher-pool.ts';
import { buildPaletteLUT } from './voxel/palette.ts';
import { decodeVxb } from './voxel/vxb.ts';
import { meshWorld } from './world-mesh.ts';

export { LoadError } from './load.ts';
export { NoGraphicsError } from './render/renderer.ts';
export type { BaseStyle, CameraConfig, SceneConfig, TimeOfDay, Vec3 } from './types.ts';
export { VxbError } from './voxel/vxb.ts';

export interface MountOptions {
	/** URL запечённого мира (.vxb). */
	url: string;
	/** 0..1: скачивание — первая половина, мешинг — вторая. */
	onProgress?: (progress: number) => void;
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
	/** Перезагрузить мир без перезагрузки страницы (камера сохраняется). */
	reloadWorld(url: string): Promise<void>;
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

	const resize = (): void => stage.resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	resize();

	const loop = (): void => stage.render();
	const syncLoop = (): void => {
		const running = !userPaused && !document.hidden && !disposed;
		void renderer.setAnimationLoop(running ? loop : null);
	};
	document.addEventListener('visibilitychange', syncLoop);
	syncLoop();

	const loadWorld = async (url: string, progressive: boolean): Promise<void> => {
		const report = options.onProgress;
		const bytes = await fetchBytes(url, (p) => report?.(p * 0.5));
		const { world, materials: palette } = await decodeVxb(bytes);
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
	};

	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		void renderer.setAnimationLoop(null);
		observer.disconnect();
		document.removeEventListener('visibilitychange', syncLoop);
		pool?.dispose();
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
		setTime: (time) => stage.setTime(time),
		pause() {
			userPaused = true;
			syncLoop();
		},
		resume() {
			userPaused = false;
			syncLoop();
		},
		reloadWorld: (url) => loadWorld(url, false),
		async captureThumbnail({ width = 1200, height = 800, quality = 0.9 } = {}) {
			const previousRatio = renderer.getPixelRatio();
			renderer.setPixelRatio(1);
			stage.resize(width, height);
			try {
				// render и toBlob в одной задаче — буфер кадра ещё не сброшен.
				return await new Promise<Blob>((resolve, reject) => {
					stage.render();
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
