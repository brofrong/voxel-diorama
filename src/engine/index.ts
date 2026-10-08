import { Group } from 'three/webgpu';
import { DayClock, TIME_SYNONYMS } from './atmosphere/daycycle.ts';
import { EntityLayer } from './entities/layer.ts';
import { LightLayer } from './lights.ts';
import { fetchBytes } from './load.ts';
import { type GroundField, ParticleLayer } from './particles/layer.ts';
import { FlyInput, flyVelocity } from './render/fly.ts';
import { FpsMeter } from './render/fps.ts';
import { createWorldMaterials } from './render/materials.ts';
import {
	type DeviceCaps,
	lowerQuality,
	resolveQuality,
	shouldDowngrade,
} from './render/quality.ts';
import { backendName, createRenderer } from './render/renderer.ts';
import { Stage } from './render/stage.ts';
import { createAtmosphereUniforms } from './render/uniforms.ts';
import type {
	AtmosphereFactory,
	EntityFactory,
	QualityLevel,
	QualitySetting,
	SceneConfig,
	SkyConfig,
	TimeOfDay,
	WorldContext,
} from './types.ts';
import { buildHeightmap } from './voxel/heightmap.ts';
import { MesherPool } from './voxel/mesher-pool.ts';
import { buildPaletteLUT } from './voxel/palette.ts';
import { decodeVxb } from './voxel/vxb.ts';
import { meshWorld } from './world-mesh.ts';

export { LoadError } from './load.ts';
export { NoGraphicsError } from './render/renderer.ts';
export type {
	AtmosphereFactory,
	AtmosphereSpec,
	BaseStyle,
	CameraConfig,
	EmitterSpec,
	EntityFactory,
	EntityInstance,
	LightSpec,
	QualityLevel,
	QualitySetting,
	SceneConfig,
	SkyConfig,
	SkyKind,
	TimeConfig,
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
	/** Качество картинки; по умолчанию 'auto'. В режиме скриншота всегда high. */
	quality?: QualitySetting;
	/** Фабрика частиц и света; вызывается после сущностей (известны их id). */
	atmosphere?: AtmosphereFactory;
	/** Показывать частицы (по умолчанию да). */
	particles?: boolean;
}

export interface CaptureOptions {
	width?: number;
	height?: number;
	quality?: number;
}

export interface DioramaController {
	readonly backend: 'webgpu' | 'webgl2';
	readonly paused: boolean;
	/** Синоним для `setHour` (dawn 6.5, day 13, sunset 18.5, night 23). */
	setTime(time: TimeOfDay): void;
	setHour(hour: number): void;
	getHour(): number;
	setTimeSpeed(speed: number): void;
	getTimeSpeed(): number;
	setSky(sky: SkyConfig): void;
	getSky(): SkyConfig;
	setQuality(setting: QualitySetting): void;
	getQuality(): { setting: QualitySetting; effective: QualityLevel };
	pause(): void;
	resume(): void;
	/** Перезагрузить мир (и сущности) без перезагрузки страницы; камера сохраняется. */
	reloadWorld(url: string, entities?: EntityFactory, atmosphere?: AtmosphereFactory): Promise<void>;
	setParticles(on: boolean): void;
	setAutoRotate(on: boolean): void;
	/** Ракурс: азимут и наклон в градусах, zoom — множитель расстояния (1 — как в диораме). */
	setView(view: { azimuth: number; elevation: number; zoom?: number }): void;
	/** Пересоздать сущности на текущем мире. */
	setEntities(factory: EntityFactory | undefined): void;
	/** Кадров в секунду (0 — на паузе или до первого замера). */
	getFps(): number;
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
	const uniforms = createAtmosphereUniforms();
	const stage = new Stage(renderer, config, uniforms);
	const materials = createWorldMaterials(uniforms);
	const capture = options.fixedTime !== undefined;
	const clock = new DayClock(config.time);
	// В режиме скриншота часы не идут (advance не вызывается) — час стоит на time.start,
	// пока его явно не сменят через setHour (ревью ночного кадра).
	const currentHour = (): number => clock.hour;
	const caps: DeviceCaps = {
		backend: backendName(renderer),
		cores: navigator.hardwareConcurrency || 4,
		coarsePointer: window.matchMedia('(pointer: coarse)').matches,
	};
	let qualitySetting: QualitySetting = options.quality ?? 'auto';
	let frameSamples: number[] | null = null;
	let particles: ParticleLayer | null = null;
	let lights: LightLayer | null = null;
	const setLevel = (level: QualityLevel): void => {
		stage.setQuality(level);
		particles?.setDensity(stage.preset.particles);
	};
	const applyQuality = (): void => {
		setLevel(resolveQuality(qualitySetting, caps, capture));
		// Наблюдаем первые 3 с только в «Авто» и не в режиме скриншота.
		frameSamples = qualitySetting === 'auto' && !capture ? [] : null;
	};
	applyQuality();
	let pool: MesherPool | null = null;
	let userPaused = false;
	let disposed = false;

	let entityFactory = options.entities;
	let worldContext: WorldContext | null = null;
	let layer: EntityLayer | null = null;
	let atmosphereFactory = options.atmosphere;
	let field: GroundField | null = null;
	let particlesEnabled = options.particles ?? true;
	const positionOf = (index: number) => layer?.positionOf(index) ?? null;
	let animTime = options.fixedTime ?? 0;
	let lastFrame = performance.now();
	// Кадр карточки не двигается с клавиатуры.
	const fly = capture ? null : new FlyInput(window);
	const fps = new FpsMeter();
	// В режиме скриншота сцена статична: кадр рисуется, только когда что-то поменялось
	// (камера, настройки, мир). Иначе слабая (программная) графика захлёбывается.
	let dirty = true;
	const invalidate = (): void => {
		dirty = true;
	};
	stage.controls.addEventListener('change', invalidate);

	const frame = (): void => {
		uniforms.time.value = animTime;
		stage.setHour(currentHour());
		layer?.update(animTime);
		particles?.update(positionOf, uniforms.night.value);
		lights?.update(animTime, uniforms.night.value, positionOf);
		stage.render();
	};

	// Когда анимационный цикл не крутится (пауза/скрытая вкладка), setSize и
	// изменение времени суток сами по себе не перерисовывают кадр — дорисовываем вручную.
	const redrawIfIdle = (): void => {
		invalidate();
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
		if (capture) {
			if (!dirty) return;
			dirty = false;
			frame();
			return;
		}
		const now = performance.now();
		const raw = Math.max(0, (now - lastFrame) / 1000);
		const dt = Math.min(0.1, raw);
		fps.sample(raw);
		if (fly && fly.keys.size > 0) {
			const v = flyVelocity(fly.keys, stage.yaw, stage.flySpeed);
			stage.pan([v[0] * dt, v[1] * dt, v[2] * dt]);
		}
		if (!capture) {
			animTime += dt;
			clock.advance(dt);
		}
		if (frameSamples) {
			frameSamples.push(dt * 1000);
			const verdict = shouldDowngrade(frameSamples);
			if (verdict !== null) {
				frameSamples = null;
				if (verdict) setLevel(lowerQuality(stage.quality));
			}
		}
		lastFrame = now;
		frame();
	};
	const syncLoop = (): void => {
		const running = !userPaused && !document.hidden && !disposed;
		if (running) lastFrame = performance.now();
		else fps.reset();
		void renderer.setAnimationLoop(running ? loop : null);
	};
	document.addEventListener('visibilitychange', syncLoop);
	syncLoop();

	const rebuildAtmosphere = (): void => {
		particles?.dispose();
		particles = null;
		lights?.dispose();
		lights = null;
		if (disposed || !atmosphereFactory || !worldContext || !field) return;
		try {
			const spec = atmosphereFactory({
				...worldContext,
				size: config.size,
				entityIds: layer?.ids ?? [],
			});
			particles = new ParticleLayer(spec.emitters, field, uniforms);
			particles.setDensity(stage.preset.particles);
			particles.setEnabled(particlesEnabled);
			stage.scene.add(particles.group);
			lights = new LightLayer(spec.lights);
			stage.scene.add(lights.group);
		} catch (error) {
			console.error('[diorama] не удалось создать атмосферу:', error);
		}
	};

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
		rebuildAtmosphere();
		redrawIfIdle();
	};

	const loadWorld = async (url: string, progressive: boolean): Promise<void> => {
		const report = options.onProgress;
		const bytes = await fetchBytes(url, (p) => report?.(p * 0.5));
		const { world, materials: palette, anchors } = await decodeVxb(bytes);
		const heightmap = buildHeightmap(world, palette);
		const context: WorldContext = { anchors, groundAt: heightmap.groundAt };
		pool?.dispose();
		const meshPool = new MesherPool(buildPaletteLUT(palette));
		pool = meshPool;
		const target = progressive ? stage.world : new Group();
		try {
			await meshWorld(world, meshPool, target, materials, (f) => {
				invalidate();
				report?.(0.5 + 0.5 * f);
			});
		} finally {
			// Воркеры нужны только на время мешинга.
			meshPool.dispose();
			if (pool === meshPool) pool = null;
		}
		if (!progressive) stage.replaceWorld(target);
		worldContext = context;
		field = heightmap;
		rebuildEntities();
	};

	const dispose = (): void => {
		if (disposed) return;
		disposed = true;
		void renderer.setAnimationLoop(null);
		stage.controls.removeEventListener('change', invalidate);
		fly?.dispose();
		observer.disconnect();
		document.removeEventListener('visibilitychange', syncLoop);
		pool?.dispose();
		layer?.dispose();
		layer = null;
		particles?.dispose();
		particles = null;
		lights?.dispose();
		lights = null;
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
		setTime(time) {
			clock.setHour(TIME_SYNONYMS[time]);
			redrawIfIdle();
		},
		setHour(hour) {
			clock.setHour(hour);
			redrawIfIdle();
		},
		getHour: currentHour,
		setTimeSpeed(speed) {
			clock.setSpeed(speed);
		},
		getTimeSpeed: () => (capture ? 0 : clock.speed),
		setSky(sky) {
			stage.setSky(sky);
			redrawIfIdle();
		},
		getSky: () => stage.sky,
		setQuality(setting) {
			qualitySetting = setting;
			applyQuality();
			redrawIfIdle();
		},
		getQuality: () => ({ setting: qualitySetting, effective: stage.quality }),
		setAutoRotate(on) {
			stage.setAutoRotate(on);
		},
		setView({ azimuth, elevation, zoom }) {
			stage.setView(azimuth, elevation, zoom);
			redrawIfIdle();
		},
		setParticles(on) {
			particlesEnabled = on;
			particles?.setEnabled(on);
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
		reloadWorld: (url, entities, atmosphere) => {
			if (entities !== undefined) entityFactory = entities;
			if (atmosphere !== undefined) atmosphereFactory = atmosphere;
			return loadWorld(url, false);
		},
		getFps: () => fps.value,
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
