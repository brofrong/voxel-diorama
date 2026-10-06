import { describe, expect, test } from 'bun:test';
import { createRng } from '../rng.ts';
import { flock, wander } from './sim.ts';
import type { Behaviour, BehaviourContext, Pose, PoseFn } from './types.ts';

const ctx = (over: Partial<BehaviourContext> = {}): BehaviourContext => ({
	index: 0,
	count: 1,
	rng: createRng(1),
	groupSeed: 7,
	groundAt: () => 1,
	anchor: () => {
		throw new Error('нет якорей');
	},
	...over,
});
const blank = (): Pose => ({ position: [0, 0, 0], rotation: [0, 0, 0], gait: 'idle', stride: 0 });
const at = (fn: PoseFn, t: number): Pose => {
	const pose = blank();
	fn(pose, t);
	return pose;
};

describe('wander', () => {
	const area = [0, 0, 20, 20] as const;

	test('остаётся в зоне, на земле, то идёт, то стоит', () => {
		const fn = wander({ area }).create(ctx());
		const gaits = new Set<string>();
		for (let t = 0; t <= 60; t += 0.25) {
			const p = at(fn, t);
			expect(p.position[0]).toBeGreaterThanOrEqual(0);
			expect(p.position[0]).toBeLessThanOrEqual(20);
			expect(p.position[2]).toBeGreaterThanOrEqual(0);
			expect(p.position[2]).toBeLessThanOrEqual(20);
			expect(p.position[1]).toBe(1);
			gaits.add(p.gait);
		}
		expect([...gaits].sort()).toEqual(['idle', 'walk']);
	});

	test('детерминирован по seed и не зависит от порядка запросов', () => {
		const a = wander({ area }).create(ctx({ rng: createRng(5) }));
		const b = wander({ area }).create(ctx({ rng: createRng(5) }));
		at(a, 40);
		expect(at(a, 12)).toEqual(at(b, 12));
	});

	test('неверная зона — ошибка', () => {
		expect(() => wander({ area: [5, 5, 5, 10] })).toThrow('area');
	});
});

describe('flock', () => {
	const make = (behaviour: Behaviour, count: number): PoseFn[] =>
		Array.from({ length: count }, (_, index) =>
			behaviour.create(ctx({ index, count, rng: createRng(index + 1) })),
		);

	test('детерминирован и не зависит от порядка запросов', () => {
		const a = make(flock({ center: [0, 20, 0], radius: 14 }), 6);
		const b = make(flock({ center: [0, 20, 0], radius: 14 }), 6);
		at(a[0], 2);
		expect(at(a[3], 5)).toEqual(at(b[3], 5));
		expect(at(a[3], 1)).toEqual(at(b[3], 1));
	});

	test('держится у центра, летит и не падает на землю', () => {
		const birds = make(flock({ center: [0, 20, 0], radius: 14 }), 6);
		for (let t = 2; t <= 30; t += 0.5) {
			for (const fn of birds) {
				const p = at(fn, t);
				const d = Math.hypot(p.position[0], p.position[1] - 20, p.position[2]);
				expect(d).toBeLessThan(14 * 1.5);
				expect(p.position[1]).toBeGreaterThan(1);
				expect(p.gait).toBe('fly');
			}
		}
	});

	test('птицы в разных местах', () => {
		const birds = make(flock({ center: [0, 20, 0], radius: 14 }), 6);
		const xs = birds.map((fn) => at(fn, 3).position[0]);
		expect(new Set(xs).size).toBe(6);
	});

	test('долгая сессия: t = 600 с — конечные числа', () => {
		const birds = make(flock({ center: [0, 20, 0], radius: 14 }), 6);
		const p = at(birds[0], 600);
		expect(p.position.every(Number.isFinite)).toBe(true);
	});

	test('radius ≤ 0 — ошибка', () => {
		expect(() => flock({ center: [0, 0], radius: 0 })).toThrow('radius');
	});
});
