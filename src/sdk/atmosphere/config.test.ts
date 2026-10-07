import { describe, expect, test } from 'bun:test';
import { isSkyInput, isTimeInput, normalizeSky, normalizeTime } from './config.ts';

describe('time', () => {
	test('по умолчанию — день, время стоит', () => {
		expect(normalizeTime(undefined)).toEqual({ start: 13, speed: 0, cycle: 120 });
	});

	test('старое { fixed } — синоним часа, скорость 0', () => {
		expect(normalizeTime({ fixed: 'sunset' })).toEqual({ start: 18.5, speed: 0, cycle: 120 });
	});

	test('новое { start, speed, cycle } с синонимом и частичными полями', () => {
		expect(normalizeTime({ start: 'night', speed: 0.5 })).toEqual({
			start: 23,
			speed: 0.5,
			cycle: 120,
		});
		expect(normalizeTime({ start: 21, speed: 1, cycle: 180 })).toEqual({
			start: 21,
			speed: 1,
			cycle: 180,
		});
	});

	test('неверные значения отвергаются', () => {
		for (const bad of [
			{ start: 25 },
			{ start: -1 },
			{ speed: 3 },
			{ speed: 0.7 },
			{ cycle: 10 },
			{ fixed: 'noon' },
			{ fixed: 'day', speed: 1 },
			{ start: 12, extra: 1 },
			'sunset',
			null,
		]) {
			expect(isTimeInput(bad)).toBe(false);
		}
		expect(isTimeInput({ start: 0, speed: 2, cycle: 3600 })).toBe(true);
	});
});

describe('sky', () => {
	test('строки и solid с цветом', () => {
		expect(normalizeSky(undefined)).toEqual({ kind: 'gradient' });
		expect(normalizeSky('stylized')).toEqual({ kind: 'stylized' });
		expect(normalizeSky({ kind: 'solid', color: '#AABBCC' })).toEqual({
			kind: 'solid',
			color: '#aabbcc',
		});
	});

	test('неверное небо отвергается', () => {
		for (const bad of [
			'space',
			{ kind: 'solid', color: 'red' },
			{ kind: 'gradient', color: '#ffffff' },
			5,
		]) {
			expect(isSkyInput(bad)).toBe(false);
		}
	});
});
