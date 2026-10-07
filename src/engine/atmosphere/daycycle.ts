import type { TimeConfig, TimeOfDay, Vec3 } from '../types.ts';
import { hexToRgb8, rgb8ToHex } from '../voxel/palette.ts';
import { LIGHTING, type LightingPreset } from './presets.ts';

/** Синонимы часа для авторов диорам. */
export const TIME_SYNONYMS: Readonly<Record<TimeOfDay, number>> = {
	dawn: 6.5,
	day: 13,
	sunset: 18.5,
	night: 23,
};

export const TIME_SPEEDS = [0, 0.5, 1, 1.5, 2] as const;

export const DEFAULT_TIME: TimeConfig = { start: 13, speed: 0, cycle: 120 };

export const wrapHour = (hour: number): number => ((hour % 24) + 24) % 24;

/** Час суток через `elapsed` секунд часов анимации. */
export function hourAt(elapsed: number, time: TimeConfig): number {
	return wrapHour(time.start + (elapsed * time.speed * 24) / time.cycle);
}

const SUNRISE = 5;
const DAY_LENGTH = 14;

const sunAngle = (hour: number): number => ((hour - SUNRISE) / DAY_LENGTH) * Math.PI;

/** Направление «от сцены к солнцу»: восход с +x, полдень сверху с наклоном к +z, закат на −x. */
export function sunDirection(hour: number): Vec3 {
	const a = sunAngle(wrapHour(hour));
	const x = Math.cos(a);
	const y = Math.sin(a);
	const z = 0.35;
	const len = Math.hypot(x, y, z);
	return [x / len, y / len, z / len];
}

/** Луна — напротив солнца по дуге (в полночь высоко). */
export function moonDirection(hour: number): Vec3 {
	const a = sunAngle(wrapHour(hour));
	const x = -Math.cos(a);
	const y = -Math.sin(a);
	const z = 0.35;
	const len = Math.hypot(x, y, z);
	return [x / len, y / len, z / len];
}

export const sunElevation = (hour: number): number => Math.sin(sunAngle(wrapHour(hour)));

const smoothstep = (a: number, b: number, x: number): number => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/** 0 — день, 1 — ночь; плавно около горизонта. */
export const nightFactor = (hour: number): number =>
	1 - smoothstep(-0.12, 0.12, sunElevation(hour));

/** Множитель свечения материалов (окна ярче ночью). */
export const emissiveScale = (night: number): number => 0.6 + 0.9 * night;

/** Источник тени: солнце над горизонтом, иначе луна; у горизонта яркость гаснет. */
export function directionalLight(hour: number): { direction: Vec3; intensityFactor: number } {
	const e = sunElevation(hour);
	const direction = e >= 0 ? sunDirection(hour) : moonDirection(hour);
	return { direction, intensityFactor: Math.min(1, Math.abs(e) / 0.1) };
}

export type Palette = Omit<LightingPreset, 'sunDirection'>;

const KEYS: ReadonlyArray<readonly [number, TimeOfDay]> = [
	[0, 'night'],
	[4, 'night'],
	[6.5, 'dawn'],
	[9, 'day'],
	[17, 'day'],
	[18.5, 'sunset'],
	[20.5, 'night'],
	[24, 'night'],
];

const COLOR_FIELDS = ['sunColor', 'hemiSky', 'hemiGround', 'zenith', 'horizon', 'fog'] as const;
const NUMBER_FIELDS = ['sunIntensity', 'hemiIntensity', 'exposure'] as const;

export function mixHex(a: string, b: string, k: number): string {
	const x = hexToRgb8(a);
	const y = hexToRgb8(b);
	return rgb8ToHex(
		Math.round(x[0] + (y[0] - x[0]) * k),
		Math.round(x[1] + (y[1] - x[1]) * k),
		Math.round(x[2] + (y[2] - x[2]) * k),
	);
}

/** Цвета и яркости освещения в данный час (линейно между опорными точками). */
export function paletteAt(hour: number): Palette {
	const h = wrapHour(hour);
	let i = 0;
	while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
	const [h0, n0] = KEYS[i];
	const [h1, n1] = KEYS[i + 1];
	const k = (h - h0) / (h1 - h0);
	const a = LIGHTING[n0];
	const b = LIGHTING[n1];
	const out = {} as Palette;
	for (const f of COLOR_FIELDS) out[f] = mixHex(a[f], b[f], k);
	for (const f of NUMBER_FIELDS) out[f] = a[f] + (b[f] - a[f]) * k;
	return out;
}

/** Часы суток: старт, скорость, длина суток; переживают смену скорости и ручную установку часа. */
export class DayClock {
	private start: number;
	private elapsed = 0;
	private currentSpeed: number;
	cycle: number;

	constructor(time: TimeConfig) {
		this.start = wrapHour(time.start);
		this.currentSpeed = time.speed;
		this.cycle = time.cycle;
	}

	get hour(): number {
		return hourAt(this.elapsed, { start: this.start, speed: this.currentSpeed, cycle: this.cycle });
	}

	get speed(): number {
		return this.currentSpeed;
	}

	advance(dt: number): void {
		this.elapsed += dt;
	}

	setHour(hour: number): void {
		this.start = wrapHour(hour);
		this.elapsed = 0;
	}

	setSpeed(speed: number): void {
		this.start = this.hour;
		this.elapsed = 0;
		this.currentSpeed = speed;
	}

	reset(time: TimeConfig): void {
		this.start = wrapHour(time.start);
		this.currentSpeed = time.speed;
		this.cycle = time.cycle;
		this.elapsed = 0;
	}
}
