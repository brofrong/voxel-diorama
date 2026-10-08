import { describe, expect, test } from 'bun:test';
import { createRng } from '../rng.ts';
import { walkPath } from './path.ts';
import type { Behaviour, BehaviourContext, Pose } from './types.ts';

const ctx = (over: Partial<BehaviourContext> = {}): BehaviourContext => ({
	index: 0,
	count: 1,
	rng: createRng(1),
	groupSeed: 1,
	groundAt: (x) => x * 0.1,
	anchor: (name) => {
		if (name === 'hub') return [10, 20, 30];
		throw new Error(`неизвестный якорь "${name}"`);
	},
	...over,
});
const run = (b: Behaviour, t: number, c: BehaviourContext = ctx()): Pose => {
	const pose: Pose = {
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		gait: 'idle',
		stride: 0,
		strideLength: 1,
		parts: {},
		replace: new Set(),
	};
	b.create(c)(pose, t);
	return pose;
};

describe('walkPath', () => {
	const line = walkPath([
		[0, 0],
		[10, 0],
	]);

	test('идёт по сегменту по земле, смотрит по направлению', () => {
		const p = run(line, 5);
		expect(p.position[0]).toBeCloseTo(5, 6);
		expect(p.position[1]).toBeCloseTo(0.5, 6);
		expect(p.position[2]).toBeCloseTo(0, 6);
		expect(p.rotation[1]).toBeCloseTo(Math.PI / 2, 6);
		expect(p.gait).toBe('walk');
		expect(p.stride).toBeCloseTo(5, 6);
	});

	test('loop: true замыкает маршрут, stride растёт', () => {
		const p = run(line, 15);
		expect(p.position[0]).toBeCloseTo(5, 6);
		expect(p.rotation[1]).toBeCloseTo(-Math.PI / 2, 6);
		expect(p.stride).toBeCloseTo(15, 6);
		expect(run(line, 25).stride).toBeCloseTo(25, 6);
	});

	test("'pingpong' идёт туда и обратно", () => {
		const b = walkPath(
			[
				[0, 0],
				[10, 0],
				[10, 10],
			],
			{ loop: 'pingpong' },
		);
		const p = run(b, 25);
		expect(p.position[0]).toBeCloseTo(10, 6);
		expect(p.position[2]).toBeCloseTo(5, 6);
	});

	test('pause: стоит в точке, затем идёт дальше', () => {
		const b = walkPath(
			[
				[0, 0],
				[10, 0],
			],
			{ loop: 'pingpong', pause: 2 },
		);
		const waiting = run(b, 11);
		expect(waiting.position[0]).toBeCloseTo(10, 6);
		expect(waiting.gait).toBe('idle');
		const back = run(b, 13);
		expect(back.position[0]).toBeCloseTo(9, 6);
		expect(back.gait).toBe('walk');
	});

	test('экземпляры сдвинуты по фазе', () => {
		const p = run(line, 0, ctx({ index: 1, count: 2 }));
		expect(p.position[0]).toBeCloseTo(10, 6);
	});

	test('якорь — точка на земле', () => {
		const p = run(walkPath(['hub', [0, 30]]), 0);
		expect(p.position[0]).toBeCloseTo(10, 6);
		expect(p.position[1]).toBeCloseTo(1, 6);
		expect(p.position[2]).toBeCloseTo(30, 6);
	});

	test('точки [x, y, z] интерполируют высоту', () => {
		const p = run(
			walkPath([
				[0, 3, 0],
				[10, 7, 0],
			]),
			5,
		);
		expect(p.position[1]).toBeCloseTo(5, 6);
	});

	test('ошибки маршрута', () => {
		expect(() => walkPath([[0, 0]])).toThrow('минимум 2');
		expect(() =>
			walkPath(
				[
					[0, 0],
					[1, 1],
				],
				{ speed: 0 },
			),
		).toThrow('speed');
		const same = walkPath([
			[3, 3],
			[3, 3],
		]);
		expect(() => same.create(ctx())).toThrow('совпадают');
		expect(() => walkPath(['nope', [0, 0]]).create(ctx())).toThrow('неизвестный якорь');
	});
});
