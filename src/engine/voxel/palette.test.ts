import { expect, test } from 'bun:test';
import { KIND_SOLID, KIND_WATER } from './constants.ts';
import { buildPaletteLUT, hexToRgb8, rgb8ToHex, srgbToLinear } from './palette.ts';

test('hexToRgb8 / rgb8ToHex туда-обратно', () => {
	expect(hexToRgb8('#ff8000')).toEqual([255, 128, 0]);
	expect(rgb8ToHex(255, 128, 0)).toBe('#ff8000');
});

test('srgbToLinear на опорных точках', () => {
	expect(srgbToLinear(0)).toBe(0);
	expect(srgbToLinear(1)).toBeCloseTo(1, 6);
	expect(srgbToLinear(128 / 255)).toBeCloseTo(0.2158, 3);
});

test('buildPaletteLUT: индекс i+1, виды, линейные цвета, emissive', () => {
	const lut = buildPaletteLUT([
		{ color: '#ffffff', emissive: 0, kind: 'solid', vary: 0 },
		{ color: '#000000', emissive: 2, kind: 'water', vary: 0 },
	]);
	expect(lut.kinds[0]).toBe(0);
	expect(lut.kinds[1]).toBe(KIND_SOLID);
	expect(lut.kinds[2]).toBe(KIND_WATER);
	expect(lut.colors[3]).toBeCloseTo(1, 6);
	expect(lut.colors[6]).toBe(0);
	expect(lut.emissive[2]).toBe(2);
});

test('buildPaletteLUT отвергает больше 255 материалов', () => {
	const many = Array.from({ length: 256 }, () => ({
		color: '#ffffff',
		emissive: 0,
		kind: 'solid' as const,
		vary: 0,
	}));
	expect(() => buildPaletteLUT(many)).toThrow('255');
});
