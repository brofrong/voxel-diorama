import { describe, expect, test } from 'bun:test';
import {
	lowerQuality,
	pickQuality,
	QUALITY_PRESETS,
	resolveQuality,
	shouldDowngrade,
} from './quality.ts';

const desktop = { backend: 'webgpu' as const, cores: 8, coarsePointer: false };

describe('pickQuality', () => {
	test('WebGL2 или ≤ 4 ядер — low; телефон на WebGPU — medium; иначе high', () => {
		expect(pickQuality({ ...desktop, backend: 'webgl2' })).toBe('low');
		expect(pickQuality({ ...desktop, cores: 4 })).toBe('low');
		expect(pickQuality({ ...desktop, coarsePointer: true })).toBe('medium');
		expect(pickQuality(desktop)).toBe('high');
	});

	test('resolveQuality: в режиме скриншота всегда high, ручной выбор уважается', () => {
		expect(resolveQuality('low', desktop, true)).toBe('high');
		expect(resolveQuality('auto', { ...desktop, backend: 'webgl2' }, true)).toBe('high');
		expect(resolveQuality('medium', desktop, false)).toBe('medium');
		expect(resolveQuality('auto', desktop, false)).toBe('high');
	});
});

describe('понижение', () => {
	test('lowerQuality', () => {
		expect(lowerQuality('high')).toBe('medium');
		expect(lowerQuality('medium')).toBe('low');
		expect(lowerQuality('low')).toBe('low');
	});

	test('shouldDowngrade: мало данных — null; медленно — true; нормально — false', () => {
		expect(shouldDowngrade([16, 16, 16])).toBeNull();
		expect(shouldDowngrade(Array(100).fill(40))).toBe(true);
		expect(shouldDowngrade(Array(200).fill(16))).toBe(false);
	});
});

test('пресеты соответствуют таблице спека', () => {
	expect(QUALITY_PRESETS.low).toMatchObject({
		dpr: 1,
		shadowMapSize: 1024,
		bloom: false,
		gtao: false,
		particles: 0.3,
		waves: false,
		aa: 'fxaa',
		csm: false,
	});
	expect(QUALITY_PRESETS.medium).toMatchObject({
		dpr: 1.5,
		shadowMapSize: 2048,
		bloom: true,
		gtao: false,
		particles: 0.6,
		waves: true,
		aa: 'msaa2',
		csm: false,
	});
	expect(QUALITY_PRESETS.high).toMatchObject({
		dpr: 2,
		shadowMapSize: 2048,
		bloom: true,
		gtao: true,
		particles: 1,
		waves: true,
		aa: 'fxaa',
		csm: true,
	});
});
