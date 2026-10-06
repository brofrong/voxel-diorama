export type Vec3 = [number, number, number];
export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';
export type BaseStyle = 'none' | 'wood' | 'stone';
export type MaterialKind = 'solid' | 'water' | 'glass';

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
}
