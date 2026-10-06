import type { TimeOfDay, Vec3 } from '../types.ts';

export interface LightingPreset {
	/** Направление «от сцены к солнцу» (нормализуется при применении). */
	sunDirection: Vec3;
	sunColor: string;
	sunIntensity: number;
	hemiSky: string;
	hemiGround: string;
	hemiIntensity: number;
	zenith: string;
	horizon: string;
	fog: string;
	exposure: number;
}

export const LIGHTING: Record<TimeOfDay, LightingPreset> = {
	dawn: {
		sunDirection: [1, 0.3, -0.4],
		sunColor: '#ffd2b0',
		sunIntensity: 2,
		hemiSky: '#d8c8ff',
		hemiGround: '#3a3540',
		hemiIntensity: 0.9,
		zenith: '#5a6fb0',
		horizon: '#f7c6b0',
		fog: '#e9c8c0',
		exposure: 1,
	},
	day: {
		sunDirection: [0.5, 1, 0.3],
		sunColor: '#fff4e0',
		sunIntensity: 3,
		hemiSky: '#bfd9ff',
		hemiGround: '#5b4a3a',
		hemiIntensity: 1.2,
		zenith: '#3d7bd9',
		horizon: '#bcd8f5',
		fog: '#bcd8f5',
		exposure: 1,
	},
	sunset: {
		sunDirection: [-1, 0.35, 0.4],
		sunColor: '#ffb070',
		sunIntensity: 2.6,
		hemiSky: '#ffcfa8',
		hemiGround: '#3a2c3a',
		hemiIntensity: 0.9,
		zenith: '#2b3a6b',
		horizon: '#ff9a5c',
		fog: '#e8a07a',
		exposure: 1,
	},
	night: {
		sunDirection: [-0.3, 1, -0.5],
		sunColor: '#9bb4ff',
		sunIntensity: 0.6,
		hemiSky: '#2a3a66',
		hemiGround: '#0b0d14',
		hemiIntensity: 0.5,
		zenith: '#05070f',
		horizon: '#1b2747',
		fog: '#141c33',
		exposure: 1.2,
	},
};
