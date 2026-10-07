import type { QualityLevel, QualitySetting } from '../types.ts';

export interface QualityPreset {
	/** Максимальная плотность пикселей. */
	dpr: number;
	shadowMapSize: number;
	bloom: boolean;
	gtao: boolean;
	/** Множитель плотности частиц. */
	particles: number;
	waves: boolean;
	aa: 'fxaa' | 'msaa2';
	/** Каскадные тени для больших диорам. */
	csm: boolean;
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualityPreset>> = {
	low: {
		dpr: 1,
		shadowMapSize: 1024,
		bloom: false,
		gtao: false,
		particles: 0.3,
		waves: false,
		aa: 'fxaa',
		csm: false,
	},
	medium: {
		dpr: 1.5,
		shadowMapSize: 2048,
		bloom: true,
		gtao: false,
		particles: 0.6,
		waves: true,
		aa: 'msaa2',
		csm: false,
	},
	high: {
		dpr: 2,
		shadowMapSize: 2048,
		bloom: true,
		gtao: true,
		particles: 1,
		waves: true,
		// GTAO (r186) читает глубину через textureGather — с MSAA-глубиной несовместим.
		aa: 'fxaa',
		csm: true,
	},
};

/** Каскадные тени включаются, если сторона диорамы больше этого. */
export const CSM_MIN_SPAN = 128;

export interface DeviceCaps {
	backend: 'webgpu' | 'webgl2';
	cores: number;
	/** Сенсорный экран (телефон/планшет). */
	coarsePointer: boolean;
}

export function pickQuality(caps: DeviceCaps): QualityLevel {
	if (caps.backend === 'webgl2' || caps.cores <= 4) return 'low';
	if (caps.coarsePointer) return 'medium';
	return 'high';
}

export function resolveQuality(
	setting: QualitySetting,
	caps: DeviceCaps,
	capture: boolean,
): QualityLevel {
	if (capture) return 'high';
	return setting === 'auto' ? pickQuality(caps) : setting;
}

export function lowerQuality(level: QualityLevel): QualityLevel {
	return level === 'high' ? 'medium' : 'low';
}

export const DOWNGRADE_WINDOW_MS = 3000;
export const DOWNGRADE_FRAME_MS = 33;

/** null — данных ещё мало (< 3 с); true — средний кадр дольше 33 мс. */
export function shouldDowngrade(frameMs: readonly number[]): boolean | null {
	const total = frameMs.reduce((a, b) => a + b, 0);
	if (total < DOWNGRADE_WINDOW_MS) return null;
	return total / frameMs.length > DOWNGRADE_FRAME_MS;
}
