import { describe, expect, test } from 'bun:test';
import type { AtmosphereContext, Vec3 } from '../../engine/types.ts';
import { pointLight } from './lights.ts';
import { fireflies, PARTICLE_TEMPLATES, smoke, snow } from './particles.ts';
import { createAtmosphereRuntime } from './runtime.ts';

const ctx = (over: Partial<AtmosphereContext> = {}): AtmosphereContext => ({
	anchors: { 'house.chimney': [10, 12, 10] as Vec3 },
	groundAt: () => 4,
	size: [96, 40, 80],
	entityIds: ['boat', 'birds[0]', 'birds[1]'],
	...over,
});

const run = (
	particles = [] as ReturnType<typeof smoke>[],
	lights = [] as ReturnType<typeof pointLight>[],
	c = ctx(),
) => createAtmosphereRuntime({ seed: 3, size: c.size, particles, lights }, c);

describe('createAtmosphereRuntime: частицы', () => {
	test('точечный эмиттер на якоре: число = rate × lifetime', () => {
		const [e] = run([smoke({ at: 'house.chimney', rate: 6 })]).emitters;
		expect(e.origin).toEqual([10, 12, 10]);
		expect(e.count).toBe(Math.round(6 * PARTICLE_TEMPLATES.smoke.lifetime));
		expect(e.attach).toBeNull();
	});

	test('[x, z] — на земле', () => {
		const [e] = run([smoke({ at: [5, 6] })]).emitters;
		expect(e.origin).toEqual([5, 4, 6]);
	});

	test('снег по всей диораме: падает с верха мира до земли', () => {
		const [e] = run([snow({ intensity: 1 })]).emitters;
		expect(e.origin).toEqual([48, 40, 40]);
		expect(e.extent).toEqual([48, 0, 40]);
		// Самые медленные хлопья (fall − jitter.y) должны долететь до земли до конца жизни.
		expect(e.lifetime).toBeCloseTo(40 / (0.9 - 0.2), 6);
		expect(e.count).toBe(Math.round(96 * 80 * 0.05));
		expect(e.groundCull).toBe(true);
	});

	test('светлячки: слой над землёй, только ночью по умолчанию', () => {
		const [e] = run([fireflies({ area: [0, 0, 10, 20] })]).emitters;
		expect(e.groundRelative).toBe(true);
		expect(e.nightOnly).toBe(true);
		expect(e.origin).toEqual([5, 1.75, 10]);
		expect(e.extent).toEqual([5, 1.25, 10]);
		expect(e.count).toBe(30);
	});

	test('attachTo: точный id экземпляра', () => {
		const [e] = run([smoke({ attachTo: 'birds[1]', offset: [0, 1, 0] })]).emitters;
		expect(e.attach).toBe(2);
		expect(e.offset).toEqual([0, 1, 0]);
		expect(e.origin).toEqual([0, 0, 0]);
	});

	test('attachTo: сущность из нескольких экземпляров или опечатка — понятные ошибки', () => {
		expect(() => run([smoke({ attachTo: 'birds' })])).toThrow('укажи birds[0]…birds[1]');
		expect(() => run([smoke({ attachTo: 'bot' })])).toThrow(
			'неизвестная сущность "bot". Есть: boat, birds[0], birds[1]',
		);
	});

	test('неизвестный якорь — ошибка с номером эмиттера', () => {
		expect(() => run([smoke({ at: 'mill.chimney' })])).toThrow(
			'particles[0] smoke: неизвестный якорь "mill.chimney"',
		);
	});

	test('больше 20 000 частиц — ошибка', () => {
		const many = Array.from({ length: 5 }, () => snow({ count: 5000 }));
		expect(() => run(many)).toThrow('слишком много частиц: 25000');
	});

	test('детерминизм seed', () => {
		const a = run([smoke({ at: [1, 1] }), smoke({ at: [2, 2] })]).emitters;
		const b = run([smoke({ at: [1, 1] }), smoke({ at: [2, 2] })]).emitters;
		expect(a.map((e) => e.seed)).toEqual(b.map((e) => e.seed));
		expect(a[0].seed).not.toBe(a[1].seed);
	});
});

describe('createAtmosphereRuntime: свет', () => {
	test('позиция, мерцание, ночь, attach', () => {
		const { lights } = run(
			[],
			[
				pointLight({ at: 'house.chimney', flicker: true }),
				pointLight({ attachTo: 'boat', onlyAtNight: true }),
			],
		);
		expect(lights[0]).toMatchObject({ position: [10, 12, 10], flicker: true, attach: null });
		expect(lights[1]).toMatchObject({ attach: 0, nightOnly: true });
	});

	test('больше 8 источников — ошибка', () => {
		const nine = Array.from({ length: 9 }, () => pointLight({ at: [1, 1] }));
		expect(() => run([], nine)).toThrow('слишком много источников света: 9');
	});
});
