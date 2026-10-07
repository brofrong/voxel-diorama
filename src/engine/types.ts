export type Vec3 = [number, number, number];
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';
export type BaseStyle = 'none' | 'wood' | 'stone';
export type MaterialKind = 'solid' | 'water' | 'glass';

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
}

export interface CameraConfig {
	position: Vec3;
	target: Vec3;
	autoRotate: boolean;
	minDistance: number;
	maxDistance: number;
}

/** Всё, что движку нужно знать о диораме помимо вокселей. Сериализуемо (идёт из prerender). */
export interface SceneConfig {
	size: Vec3;
	time: TimeOfDay;
	fog: number;
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
