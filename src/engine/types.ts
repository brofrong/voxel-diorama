export type Vec3 = [number, number, number];
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';
export type BaseStyle = 'none' | 'wood' | 'stone';
export type MaterialKind = 'solid' | 'water' | 'glass';
export type QualityLevel = 'low' | 'medium' | 'high';
export type QualitySetting = 'auto' | QualityLevel;

/** Время суток диорамы: час начала, скорость (×), длина суток в секундах при 1x. */
export interface TimeConfig {
	start: number;
	speed: number;
	cycle: number;
}

export type SkyKind = 'gradient' | 'solid' | 'realistic' | 'stylized';

export interface SkyConfig {
	kind: SkyKind;
	/** Только для `solid`: фиксированный цвет фона. */
	color?: string;
}

export interface Material {
	/** sRGB, `#rrggbb` в нижнем регистре. */
	color: string;
	/** Сила свечения (0 — не светится). */
	emissive: number;
	kind: MaterialKind;
	/** Разброс оттенка между соседними вокселями: 0 — ровный цвет, 0.1 — заметно «живой». */
	vary: number;
}

export interface CameraConfig {
	position: Vec3;
	target: Vec3;
	autoRotate: boolean;
	minDistance: number;
	maxDistance: number;
	/** 0..1 — размытие верха и низа кадра (эффект миниатюры). */
	tiltShift: number;
}

/** Задник вокруг диорамы: объёмные облака, горы на горизонте, облачное море внизу. */
export interface BackdropConfig {
	/** 0..1 — сколько воксельных облаков вокруг (0 — нет). */
	clouds: number;
	/** 0..1 — высота и плотность гор на горизонте (0 — нет). */
	mountains: number;
	/** Облачное «море» под диорамой — для парящих островов. */
	cloudSea: boolean;
	/** Цвет гор; по умолчанию холодный серо-синий. */
	mountainColor?: string;
}

/** Всё, что движку нужно знать о диораме помимо вокселей. Сериализуемо (идёт из prerender). */
export interface SceneConfig {
	size: Vec3;
	time: TimeConfig;
	sky: SkyConfig;
	/** Seed диорамы — для звёзд и облаков неба. */
	seed: number;
	fog: number;
	/** 0..1 — воздушная перспектива: дальнее и то, что ниже диорамы, тонет в цвете неба. */
	haze: number;
	backdrop: BackdropConfig;
	camera: CameraConfig;
	base: BaseStyle;
	/** Время анимации (с), на котором замирает режим скриншота `?capture`. */
	captureTime: number;
}

/** Воксели модели сущности (материал i — индекс i + 1). Координаты в вокселях модели. */
export interface VoxelModelData {
	size: Vec3;
	data: Uint8Array;
	materials: readonly Material[];
	/** Размер вокселя модели в единицах мира. */
	scale: number;
	/** Сустав/точка привязки в вокселях модели. */
	pivot: Vec3;
}

export interface EntityPartSpec {
	name: string;
	model: VoxelModelData;
	/** Индекс родителя (−1 — корень); родитель всегда раньше ребёнка. */
	parent: number;
	/** Смещение pivot части от pivot родителя, единицы мира. */
	attach: Vec3;
}

export interface EntityPose {
	/** Мировая точка привязки сущности. */
	position: Vec3;
	/** Радианы, Euler YXZ. */
	rotation: Vec3;
	/** Подъём корня над `position`, единицы мира. */
	lift: number;
	/** Повороты частей (радианы, Euler XYZ), индексы как в `parts`. */
	parts: Vec3[];
}

export interface EntityInstance {
	id: string;
	parts: EntityPartSpec[];
	pose(t: number): EntityPose;
}

/** Что известно о мире после декодирования `.vxb`. */
export interface WorldContext {
	anchors: Readonly<Record<string, Vec3>>;
	groundAt(x: number, z: number): number;
}

export type EntityFactory = (ctx: WorldContext) => EntityInstance[];
export interface EmitterSpec {
	id: string;
	seed: number;
	/** Частиц на качестве high. */
	count: number;
	lifetime: number;
	/** Центр области появления; для attach — смещение от сущности не включено (см. offset). */
	origin: Vec3;
	/** Полуразмеры области появления. */
	extent: Vec3;
	velocity: Vec3;
	jitter: Vec3;
	gravity: number;
	wind: { amp: number; freq: number };
	size: [number, number];
	color: [string, string];
	emissive: number;
	opacity: number;
	stretch: number;
	blink: boolean;
	groundRelative: boolean;
	groundCull: boolean;
	nightOnly: boolean;
	/** Индекс экземпляра сущности (из списка, переданного движком) или null. */
	attach: number | null;
	offset: Vec3;
}

export interface LightSpec {
	id: string;
	seed: number;
	position: Vec3;
	color: string;
	intensity: number;
	distance: number;
	flicker: boolean;
	nightOnly: boolean;
	attach: number | null;
	offset: Vec3;
}

export interface AtmosphereContext extends WorldContext {
	size: Vec3;
	/** id экземпляров сущностей в порядке, в котором их рисует движок. */
	entityIds: readonly string[];
}

export interface AtmosphereSpec {
	emitters: EmitterSpec[];
	lights: LightSpec[];
}

export type AtmosphereFactory = (ctx: AtmosphereContext) => AtmosphereSpec;
