import { describe, expect, test } from 'bun:test';
import { createRng } from '../rng.ts';
import { bob, custom, keyframes, orbit, spin, sway } from './behaviours.ts';
import {
	type Behaviour,
	type BehaviourContext,
	type Pose,
	resolvePoint,
	toRadians,
} from './types.ts';

const ctx = (over: Partial<BehaviourContext> = {}): BehaviourContext => ({
	index: 0,
	count: 1,
	rng: createRng(1),
	groupSeed: 1,
	groundAt: () => 5,
	anchor: (name) => {
		if (name === 'hub') return [10, 20, 30];
		throw new Error(`неизвестный якорь "${name}"`);
	},
	...over,
});
const blank = (): Pose => ({
	position: [0, 0, 0],
	rotation: [0, 0, 0],
	gait: 'idle',
	stride: 0,
	strideLength: 1,
	parts: {},
	replace: new Set(),
});
const run = (b: Behaviour, t: number, c: BehaviourContext = ctx()): Pose => {
	const pose = blank();
	b.create(c)(pose, t);
	return pose;
};

describe('resolvePoint', () => {
	test('[x, z] — на земле, [x, y, z] — точно, строка — якорь', () => {
		expect(resolvePoint([1, 2], ctx())).toEqual({ position: [1, 5, 2], grounded: true });
		expect(resolvePoint([1, 7, 2], ctx())).toEqual({ position: [1, 7, 2], grounded: false });
		expect(resolvePoint('hub', ctx())).toEqual({ position: [10, 20, 30], grounded: false });
		expect(() => resolvePoint('nope', ctx())).toThrow('неизвестный якорь');
	});
});

describe('spin / bob / sway', () => {
	test('spin: speed об/с вокруг оси', () => {
		expect(run(spin({ speed: 0.25 }), 1).rotation[1]).toBeCloseTo(Math.PI / 2, 6);
		expect(run(spin({ axis: 'z', speed: 0.5 }), 1).rotation[2]).toBeCloseTo(Math.PI, 6);
	});

	test('bob: синус с амплитудой и периодом', () => {
		expect(run(bob({ amp: 2, period: 4, phase: 0 }), 1).position[1]).toBeCloseTo(2, 6);
		expect(run(bob({ amp: 2, period: 4, phase: 0 }), 2).position[1]).toBeCloseTo(0, 6);
	});

	test('bob без phase: фаза из rng, детерминирована по seed', () => {
		const a = run(bob(), 1, ctx({ rng: createRng(3) })).position[1];
		const b = run(bob(), 1, ctx({ rng: createRng(3) })).position[1];
		const c = run(bob(), 1, ctx({ rng: createRng(4) })).position[1];
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});

	test('sway: угол в градусах', () => {
		const pose = run(sway({ angle: 10, period: 4, phase: 0 }), 1);
		expect(pose.rotation[2]).toBeCloseTo(toRadians(10), 6);
	});
});

describe('orbit', () => {
	const quarterPerSecond = { radius: 10, speed: 5 * Math.PI, phase: 0 };

	test('по земле: позиция на окружности, yaw по касательной, gait walk', () => {
		const b = orbit({ center: [0, 0], ...quarterPerSecond });
		const p0 = run(b, 0);
		expect(p0.position[0]).toBeCloseTo(10, 6);
		expect(p0.position[1]).toBe(5);
		expect(p0.position[2]).toBeCloseTo(0, 6);
		expect(p0.rotation[1]).toBeCloseTo(0, 6);
		expect(p0.gait).toBe('walk');
		const p1 = run(b, 1);
		expect(p1.position[0]).toBeCloseTo(0, 6);
		expect(p1.position[2]).toBeCloseTo(10, 6);
	});

	test('3D-центр: высота центра, gait fly', () => {
		const pose = run(orbit({ center: [0, 20, 0], radius: 5 }), 0.3);
		expect(pose.position[1]).toBe(20);
		expect(pose.gait).toBe('fly');
	});

	test('экземпляры стартуют с разных фаз', () => {
		const b = orbit({ center: [0, 0], radius: 10, speed: 1 });
		const p = run(b, 0, ctx({ index: 1, count: 4 }));
		expect(p.position[0]).toBeCloseTo(0, 6);
		expect(p.position[2]).toBeCloseTo(10, 6);
	});

	test('radius ≤ 0 — ошибка', () => {
		expect(() => orbit({ center: [0, 0], radius: 0 })).toThrow('radius');
	});
});

describe('keyframes', () => {
	const move = keyframes({
		frames: [
			{ t: 0, position: [0, 0, 0] },
			{ t: 2, position: [10, 0, 0] },
		],
	});

	test('линейная интерполяция и зацикливание', () => {
		expect(run(move, 1).position[0]).toBeCloseTo(5, 6);
		expect(run(move, 3).position[0]).toBeCloseTo(5, 6);
		expect(move.positional).toBe(true);
	});

	test('без цикла — держит последний кадр', () => {
		const once = keyframes({
			frames: [
				{ t: 0, position: [0, 0, 0] },
				{ t: 2, position: [10, 0, 0] },
			],
			loop: false,
		});
		expect(run(once, 5).position[0]).toBe(10);
	});

	test('rotation в градусах добавляется к позе', () => {
		const turn = keyframes({
			frames: [
				{ t: 0, rotation: [0, 0, 0] },
				{ t: 1, rotation: [0, 90, 0] },
			],
		});
		expect(run(turn, 0.5).rotation[1]).toBeCloseTo(toRadians(45), 6);
		expect(turn.positional).toBe(false);
	});

	test('ошибки описания кадров', () => {
		expect(() => keyframes({ frames: [{ t: 0 }] })).toThrow('минимум 2');
		expect(() => keyframes({ frames: [{ t: 1 }, { t: 1 }] })).toThrow('возрастать');
		expect(() => keyframes({ frames: [{ t: 0, position: [0, 0, 0] }, { t: 1 }] })).toThrow(
			'position',
		);
	});
});

describe('custom', () => {
	test('получает позу, время и контекст', () => {
		const b = custom((pose, t, c) => {
			pose.position[0] = t + c.index;
		});
		expect(run(b, 2, ctx({ index: 3 })).position[0]).toBe(5);
		expect(b.positional).toBe(false);
	});
});
