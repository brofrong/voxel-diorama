import { describe, expect, test } from 'bun:test';
import { pointLight, snow } from './atmosphere/index.ts';
import { model } from './builder/model.ts';
import { spin, walkPath } from './entities/index.ts';
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
		expect(d.atmosphere).toEqual({
			time: { start: 13, speed: 0, cycle: 120 },
			sky: { kind: 'gradient' },
			fog: 0,
		});
		expect(d.camera.autoRotate).toBe(true);
		expect(d.palette.grass).toEqual({ color: '#6aa84f', emissive: 0, kind: 'solid' });
	});

	test('неверное время — понятная ошибка', () => {
		const input = { ...minimal(), atmosphere: { time: { speed: 3 } } } as unknown as DioramaInput;
		expect(() => defineDiorama(input)).toThrow('time: ожидается');
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

	test('неизвестные поля отвергаются (strict)', () => {
		const input = { ...minimal(), weather: [] } as unknown as DioramaInput;
		expect(() => defineDiorama(input)).toThrow('weather');
	});

	test('particles и lights принимаются, мусор — понятная ошибка', () => {
		const d = defineDiorama({
			...minimal(),
			particles: [snow()],
			lights: [pointLight({ at: [1, 1] })],
		});
		expect(d.particles).toHaveLength(1);
		expect(d.lights).toHaveLength(1);
		const bad = { ...minimal(), particles: [{ smoke: 1 }] } as unknown as DioramaInput;
		expect(() => defineDiorama(bad)).toThrow('particles: ожидается');
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

	test('нет входных данных — DioramaValidationError, а не TypeError', () => {
		expect(() => defineDiorama(undefined as unknown as DioramaInput)).toThrow(
			DioramaValidationError,
		);
		expect(() => defineDiorama(undefined as unknown as DioramaInput)).toThrow('?');
		expect(() => defineDiorama(null as unknown as DioramaInput)).toThrow(DioramaValidationError);
		expect(() => defineDiorama(null as unknown as DioramaInput)).toThrow('?');
	});
});

describe('toSceneConfig', () => {
	test('камера по умолчанию смотрит в центр мира', () => {
		const scene = toSceneConfig(defineDiorama(minimal()));
		expect(scene.camera.target).toEqual([32, 6.4, 24]);
		expect(scene.camera.position[1]).toBeGreaterThan(scene.camera.target[1]);
		expect(scene.camera.maxDistance).toBeGreaterThan(scene.camera.minDistance);
		expect(scene.time).toEqual({ start: 13, speed: 0, cycle: 120 });
		expect(scene.base).toBe('none');
	});

	test('SceneConfig получает время, небо и seed', () => {
		const scene = toSceneConfig(
			defineDiorama({
				...minimal(),
				seed: 9,
				atmosphere: { time: { fixed: 'night' }, sky: 'realistic' },
			}),
		);
		expect(scene.time).toEqual({ start: 23, speed: 0, cycle: 120 });
		expect(scene.sky).toEqual({ kind: 'realistic' });
		expect(scene.seed).toBe(9);
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

describe('entities в схеме', () => {
	const box = model({ size: [1, 1, 1], palette: { c: '#ffffff' } }, (m) => m.set([0, 0, 0], 'c'));

	test('по умолчанию entities пустой, captureTime 2', () => {
		const d = defineDiorama(minimal());
		expect(d.entities).toEqual([]);
		expect(toSceneConfig(d).captureTime).toBe(2);
	});

	test('нормализует animate в массив и заполняет значения по умолчанию', () => {
		const d = defineDiorama({
			...minimal(),
			entities: [{ model: box, at: [1, 1], animate: spin() }],
		});
		expect(d.entities[0].animate).toHaveLength(1);
		expect(d.entities[0].count).toBe(1);
		expect(d.entities[0].rotate).toBe(0);
	});

	test('позицию может задать поведение вместо at', () => {
		expect(() =>
			defineDiorama({
				...minimal(),
				entities: [
					{
						model: box,
						animate: walkPath([
							[0, 0],
							[5, 5],
						]),
					},
				],
			}),
		).not.toThrow();
	});

	test('понятные ошибки сущностей', () => {
		const bad = (entities: unknown) =>
			defineDiorama({ ...minimal(), entities } as unknown as DioramaInput);
		expect(() => bad([{ at: [1, 1] }])).toThrow('ровно одно из model или rig');
		expect(() => bad([{ model: box }])).toThrow('нет позиции');
		expect(() => bad([{ model: box, at: [1, 1], count: 65 }])).toThrow(DioramaValidationError);
		expect(() => bad([{ model: box, at: [1, 1], animate: { spin: 1 } }])).toThrow(
			'ожидается поведение',
		);
		expect(() =>
			bad([
				{ id: 'a', model: box, at: [1, 1] },
				{ id: 'a', model: box, at: [2, 2] },
			]),
		).toThrow('повторяется id "a"');
		expect(() => bad([{ model: box, at: 'Bad name' }])).toThrow(DioramaValidationError);
		expect(() => bad([{ model: box, at: [1, 2, 3, 4] }])).toThrow('ожидается [x, z]');
		expect(() => bad([{ model: box, at: { x: 1 } }])).toThrow('ожидается [x, z]');
	});
});
