import type { Material, MaterialKind } from '../types.ts';
import { KIND_GLASS, KIND_SOLID, KIND_WATER, MAX_MATERIALS } from './constants.ts';

export const KIND_CODE: Record<MaterialKind, number> = {
	solid: KIND_SOLID,
	water: KIND_WATER,
	glass: KIND_GLASS,
};

export const KIND_NAME: Record<number, MaterialKind | undefined> = {
	[KIND_SOLID]: 'solid',
	[KIND_WATER]: 'water',
	[KIND_GLASS]: 'glass',
};

/** Таблицы по индексу материала (0..255) — вход мешера. */
export interface PaletteLUT {
	kinds: Uint8Array;
	/** Линейный RGB, по 3 числа на индекс. */
	colors: Float32Array;
	emissive: Float32Array;
}

export function hexToRgb8(hex: string): [number, number, number] {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb8ToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function buildPaletteLUT(materials: readonly Material[]): PaletteLUT {
	if (materials.length > MAX_MATERIALS) {
		throw new Error(`слишком много материалов: ${materials.length} (максимум ${MAX_MATERIALS})`);
	}
	const kinds = new Uint8Array(256);
	const colors = new Float32Array(256 * 3);
	const emissive = new Float32Array(256);
	materials.forEach((material, i) => {
		const id = i + 1;
		const [r, g, b] = hexToRgb8(material.color);
		kinds[id] = KIND_CODE[material.kind];
		colors[id * 3] = srgbToLinear(r / 255);
		colors[id * 3 + 1] = srgbToLinear(g / 255);
		colors[id * 3 + 2] = srgbToLinear(b / 255);
		emissive[id] = material.emissive;
	});
	return { kinds, colors, emissive };
}
