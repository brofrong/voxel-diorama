import type { Rotation } from './builder/world-builder.ts';

/** Имя якоря модели или мира (без точки). */
export const ANCHOR_NAME_RE = /^[a-z][a-zA-Z0-9_-]*$/;

/** Ссылка на якорь: `well` или `mill.hub`. */
export const ANCHOR_REF_RE = /^[a-z][a-zA-Z0-9_-]*(\.[a-z][a-zA-Z0-9_-]*)?$/;

/**
 * Поворот точки модели вокруг Y — так же, как `place` поворачивает воксели.
 * Координаты непрерывные: воксель (x, y, z) занимает [x, x+1) × [y, y+1) × [z, z+1).
 */
export function rotateFootprint(
	x: number,
	z: number,
	sx: number,
	sz: number,
	rotate: Rotation,
): [number, number] {
	switch (rotate) {
		case 0:
			return [x, z];
		case 90:
			return [sz - z, x];
		case 180:
			return [sx - x, sz - z];
		case 270:
			return [z, sx - x];
		default:
			throw new Error(`rotate должен быть 0, 90, 180 или 270, получено ${rotate}`);
	}
}
