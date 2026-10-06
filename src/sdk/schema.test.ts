import { describe, expect, test } from 'bun:test';
import {
	type DioramaInput,
	DioramaValidationError,
	defineDiorama,
	toSceneConfig,
} from './schema.ts';

const minimal = (): DioramaInput => ({
	meta: { title: 'Тест', createdAt: '2026-10-06' },
	size: [64, 32, 48],
	palette: { grass: '#6aa84f' },
	build() {},
});

describe('defineDiorama', () => {
	test('заполняет значения по умолчанию', () => {
		const d = defineDiorama(minimal());
		expect(d.seed).toBe(1);
		expect(d.base).toBe('none');
		expect(d.meta.tags).toEqual([]);
		expect(d.meta.description).toBe('');
		expect(d.atmosphere).toEqual({ time: { fixed: 'day' }, fog: 0 });
		expect(d.camera.autoRotate).toBe(true);
		expect(d.palette.grass).toEqual({ color: '#6aa84f', emissive: 0, kind: 'solid' });
	});

	test('неверный цвет — DioramaValidationError с путём и названием', () => {
		const input = { ...minimal(), palette: { grass: 'green' } };
		expect(() => defineDiorama(input)).toThrow(DioramaValidationError);
		expect(() => defineDiorama(input)).toThrow('Тест');
		expect(() => defineDiorama(input)).toThrow('palette');
	});

	test("'air' нельзя объявить в палитре", () => {
		expect(() => defineDiorama({ ...minimal(), palette: { air: '#ffffff' } })).toThrow(
			'зарезервирован',
		);
	});

	test('поля будущих этапов отвергаются (strict)', () => {
		const input = { ...minimal(), entities: [] } as unknown as DioramaInput;
		expect(() => defineDiorama(input)).toThrow('entities');
	});

	test('несуществующая дата отвергается', () => {
		expect(() =>
			defineDiorama({ ...minimal(), meta: { title: 'X', createdAt: '2026-13-45' } }),
		).toThrow(DioramaValidationError);
	});

	test('размер мира — целые 1..1024', () => {
		expect(() => defineDiorama({ ...minimal(), size: [0, 10, 10] })).toThrow(
			DioramaValidationError,
		);
		expect(() => defineDiorama({ ...minimal(), size: [10.5, 10, 10] })).toThrow(
			DioramaValidationError,
		);
	});
});

describe('toSceneConfig', () => {
	test('камера по умолчанию смотрит в центр мира', () => {
		const scene = toSceneConfig(defineDiorama(minimal()));
		expect(scene.camera.target).toEqual([32, 6.4, 24]);
		expect(scene.camera.position[1]).toBeGreaterThan(scene.camera.target[1]);
		expect(scene.camera.maxDistance).toBeGreaterThan(scene.camera.minDistance);
		expect(scene.time).toBe('day');
		expect(scene.base).toBe('none');
	});

	test('явные параметры камеры сохраняются', () => {
		const scene = toSceneConfig(
			defineDiorama({
				...minimal(),
				camera: { position: [1, 2, 3], target: [4, 5, 6], autoRotate: false },
			}),
		);
		expect(scene.camera.position).toEqual([1, 2, 3]);
		expect(scene.camera.target).toEqual([4, 5, 6]);
		expect(scene.camera.autoRotate).toBe(false);
	});
});
