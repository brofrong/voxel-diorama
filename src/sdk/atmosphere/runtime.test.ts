import { describe, expect, test } from 'bun:test';
import type { AtmosphereContext, Vec3 } from '../../engine/types.ts';
import { pointLight } from './lights.ts';
import { fireflies, fountain, PARTICLE_TEMPLATES, pour, smoke, snow } from './particles.ts';
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

describe('fountain', () => {
	test('водяные брызги: вверх и обратно вниз, без свечения, полупрозрачные', () => {
		const [e] = run([fountain({ at: 'house.chimney' })]).emitters;
		expect(e.velocity[1]).toBeGreaterThan(0);
		expect(e.gravity).toBeLessThan(0);
		expect(e.emissive).toBe(0);
		expect(e.opacity).toBeLessThan(1);
		// К концу жизни брызги падают ниже точки выброса (в чашу).
		const t = e.lifetime;
		expect(e.velocity[1] * t + 0.5 * e.gravity * t * t).toBeLessThan(0);
		const rate = PARTICLE_TEMPLATES.fountain.rate ?? Number.NaN;
		expect(e.count).toBe(Math.round(rate * e.lifetime));
	});
});

describe('pour', () => {
	test('перелив через край: почти без подъёма, быстро вниз, без свечения', () => {
		const [e] = run([pour({ at: 'house.chimney' })]).emitters;
		expect(e.velocity[1]).toBeLessThan(1);
		expect(e.gravity).toBeLessThan(-5);
		expect(e.emissive).toBe(0);
		// За жизнь струя опускается хотя бы на 5 вокселей (с верхней чаши в нижнюю).
		const t = e.lifetime;
		expect(e.velocity[1] * t + 0.5 * e.gravity * t * t).toBeLessThan(-5);
	});
});

describe('струи: velocity и lifetime точечного эмиттера', () => {
	test('velocity добавляется к скорости пресета', () => {
		const [e] = run([fountain({ at: 'house.chimney', velocity: [2, 0.5, -1] })]).emitters;
		const v = PARTICLE_TEMPLATES.fountain.velocity;
		expect(e.velocity).toEqual([v[0] + 2, v[1] + 0.5, v[2] - 1]);
	});

	test('lifetime заменяет время жизни пресета, число частиц — rate × lifetime', () => {
		const [e] = run([pour({ at: 'house.chimney', rate: 40, lifetime: 2.5 })]).emitters;
		expect(e.lifetime).toBe(2.5);
		expect(e.count).toBe(100);
	});
});
