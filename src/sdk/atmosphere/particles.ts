import type { Vec3 } from '../../engine/types.ts';
import type { Point } from '../entities/types.ts';
import { HEX_COLOR } from '../materials.ts';

export type PointPreset = 'smoke' | 'fire' | 'sparks';
export type AreaPreset = 'fireflies' | 'snow' | 'rain' | 'leaves' | 'mist' | 'dust';
export type ParticlePreset = PointPreset | AreaPreset;
/** [x0, z0, x1, z1] */
export type Area = readonly [number, number, number, number];

export interface PointEmitterOptions {
	at?: Point;
	/** id экземпляра сущности (`boat`, `birds[2]`). */
	attachTo?: string;
	offset?: Vec3;
	/** Частиц в секунду. */
	rate?: number;
	color?: string;
	onlyAtNight?: boolean;
	size?: 'small' | 'medium' | 'large';
}

export interface AreaEmitterOptions {
	area?: Area;
	/** Точное число частиц (вместо intensity). */
	count?: number;
	/** 0..2, множитель плотности. */
	intensity?: number;
	color?: string;
	onlyAtNight?: boolean;
	/** Высота слоя над землёй (mist). */
	height?: number;
}

export interface ParticleDef {
	readonly kind: 'particles';
	readonly preset: ParticlePreset;
	readonly point?: Readonly<PointEmitterOptions>;
	readonly area?: Readonly<AreaEmitterOptions>;
}

export interface ParticleTemplate {
	lifetime: number;
	/** Падающие: скорость падения; время жизни = высота мира / fall, появление у верха мира. */
	fall?: number;
	/** Полуразмеры появления для точечных эмиттеров. */
	extent: Vec3;
	velocity: Vec3;
	jitter: Vec3;
	gravity: number;
	wind: { amp: number; freq: number };
	size: readonly [number, number];
	color: readonly [string, string];
	emissive: number;
	opacity: number;
	stretch: number;
	blink: boolean;
	groundRelative: boolean;
	groundCull: boolean;
	nightOnly: boolean;
	/** Слой [от, до] над землёй для groundRelative. */
	band?: readonly [number, number];
	/** Точечные: частиц/с по умолчанию. */
	rate?: number;
	/** Площадные: частиц на клетку при intensity 1. */
	density?: number;
	/** Площадные: число по умолчанию (вместо density). */
	count?: number;
	/** intensity по умолчанию. */
	intensity?: number;
}

const base = {
	jitter: [0, 0, 0] as Vec3,
	gravity: 0,
	emissive: 0,
	opacity: 1,
	stretch: 1,
	blink: false,
	groundRelative: false,
	groundCull: false,
	nightOnly: false,
};

export const PARTICLE_TEMPLATES: Readonly<Record<ParticlePreset, ParticleTemplate>> = {
	smoke: {
		...base,
		lifetime: 6,
		extent: [0.15, 0, 0.15],
		velocity: [0.15, 0.9, 0.05],
		jitter: [0.2, 0.2, 0.2],
		wind: { amp: 0.35, freq: 0.8 },
		size: [0.25, 0.9],
		color: ['#9a9a9a', '#d8d8d8'],
		rate: 6,
	},
	fire: {
		...base,
		lifetime: 0.8,
		extent: [0.35, 0, 0.35],
		velocity: [0, 1.6, 0],
		jitter: [0.3, 0.5, 0.3],
		wind: { amp: 0.08, freq: 6 },
		size: [0.35, 0.05],
		color: ['#ffd27a', '#ff4a1a'],
		emissive: 3,
		rate: 40,
	},
	sparks: {
		...base,
		lifetime: 1.5,
		extent: [0.2, 0, 0.2],
		velocity: [0, 3, 0],
		jitter: [1.2, 1, 1.2],
		gravity: -3,
		wind: { amp: 0.05, freq: 4 },
		size: [0.08, 0.03],
		color: ['#ffe08a', '#ff7a1a'],
		emissive: 4,
		rate: 12,
	},
	fireflies: {
		...base,
		lifetime: 8,
		extent: [0, 0, 0],
		velocity: [0, 0, 0],
		jitter: [0.15, 0.05, 0.15],
		wind: { amp: 0.6, freq: 0.5 },
		size: [0.08, 0.08],
		color: ['#d4ff6a', '#d4ff6a'],
		emissive: 4,
		blink: true,
		groundRelative: true,
		nightOnly: true,
		band: [0.5, 3],
		count: 30,
	},
	snow: {
		...base,
		lifetime: 0,
		fall: 0.9,
		extent: [0, 0, 0],
		velocity: [0, -0.9, 0],
		jitter: [0.1, 0.2, 0.1],
		wind: { amp: 0.5, freq: 0.7 },
		size: [0.12, 0.12],
		color: ['#ffffff', '#ffffff'],
		groundCull: true,
		density: 0.012,
		intensity: 0.6,
	},
	rain: {
		...base,
		lifetime: 0,
		fall: 9,
		extent: [0, 0, 0],
		velocity: [0, -9, 0],
		jitter: [0.05, 1, 0.05],
		wind: { amp: 0.05, freq: 1 },
		size: [0.05, 0.05],
		color: ['#9fc4ff', '#9fc4ff'],
		stretch: 6,
		groundCull: true,
		density: 0.02,
		intensity: 1,
	},
	leaves: {
		...base,
		lifetime: 0,
		fall: 0.7,
		extent: [0, 0, 0],
		velocity: [0, -0.7, 0],
		jitter: [0.2, 0.2, 0.2],
		wind: { amp: 1.2, freq: 0.9 },
		size: [0.18, 0.18],
		color: ['#d68910', '#a04000'],
		groundCull: true,
		density: 0.004,
		intensity: 1,
	},
	mist: {
		...base,
		lifetime: 14,
		extent: [0, 0, 0],
		velocity: [0.25, 0, 0.1],
		jitter: [0.1, 0.02, 0.1],
		wind: { amp: 0.3, freq: 0.2 },
		size: [1.6, 2.4],
		color: ['#e8eef5', '#e8eef5'],
		opacity: 0.35,
		groundRelative: true,
		band: [0, 2],
		density: 0.006,
		intensity: 1,
	},
	dust: {
		...base,
		lifetime: 10,
		extent: [0, 0, 0],
		velocity: [0.1, 0.05, 0.05],
		jitter: [0.1, 0.1, 0.1],
		wind: { amp: 0.4, freq: 0.3 },
		size: [0.06, 0.06],
		color: ['#e8dcc0', '#e8dcc0'],
		emissive: 0.3,
		groundRelative: true,
		band: [0.3, 2.5],
		density: 0.01,
		intensity: 1,
	},
};

export function isParticleDef(value: unknown): value is ParticleDef {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { kind?: unknown }).kind === 'particles' &&
		typeof (value as { preset?: unknown }).preset === 'string' &&
		(value as { preset: string }).preset in PARTICLE_TEMPLATES
	);
}

function checkColor(name: string, color: string | undefined): void {
	if (color !== undefined && !HEX_COLOR.test(color))
		throw new Error(`${name}: color — ожидается #rrggbb`);
}

function point(preset: PointPreset, o: PointEmitterOptions): ParticleDef {
	if ((o.at === undefined) === (o.attachTo === undefined)) {
		throw new Error(`${preset}: нужно ровно одно из at или attachTo`);
	}
	if (o.rate !== undefined && !(o.rate > 0 && o.rate <= 500))
		throw new Error(`${preset}: rate — от 0 до 500 частиц/с`);
	checkColor(preset, o.color);
	return { kind: 'particles', preset, point: { ...o } };
}

function area(preset: AreaPreset, o: AreaEmitterOptions): ParticleDef {
	if (o.area !== undefined) {
		const [x0, z0, x1, z1] = o.area;
		if (!(x1 > x0 && z1 > z0))
			throw new Error(`${preset}: area — [x0, z0, x1, z1] с x1 > x0, z1 > z0`);
	}
	if (o.count !== undefined && !(Number.isInteger(o.count) && o.count >= 1 && o.count <= 5000)) {
		throw new Error(`${preset}: count — целое 1..5000`);
	}
	if (o.intensity !== undefined && !(o.intensity > 0 && o.intensity <= 2)) {
		throw new Error(`${preset}: intensity — от 0 до 2`);
	}
	if (o.height !== undefined && !(o.height > 0))
		throw new Error(`${preset}: height должна быть > 0`);
	checkColor(preset, o.color);
	return { kind: 'particles', preset, area: { ...o } };
}

/** Дым (из трубы, костра). */
export const smoke = (o: PointEmitterOptions): ParticleDef => point('smoke', o);
/** Огонь — светится. */
export const fire = (o: PointEmitterOptions): ParticleDef => point('fire', o);
/** Искры — светятся, падают. */
export const sparks = (o: PointEmitterOptions): ParticleDef => point('sparks', o);
/** Светлячки над землёй; по умолчанию только ночью. */
export const fireflies = (o: AreaEmitterOptions = {}): ParticleDef => area('fireflies', o);
export const snow = (o: AreaEmitterOptions = {}): ParticleDef => area('snow', o);
export const rain = (o: AreaEmitterOptions = {}): ParticleDef => area('rain', o);
export const leaves = (o: AreaEmitterOptions = {}): ParticleDef => area('leaves', o);
/** Стелющийся туман (полупрозрачный). */
export const mist = (o: AreaEmitterOptions = {}): ParticleDef => area('mist', o);
export const dust = (o: AreaEmitterOptions = {}): ParticleDef => area('dust', o);
