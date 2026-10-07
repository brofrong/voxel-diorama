import { describe, expect, test } from 'bun:test';
import type { Vec3 } from '../../engine/types.ts';
import { model } from '../builder/model.ts';
import { poseRig, type RigPartInput, rig } from './rig.ts';
import { toRadians } from './types.ts';

const block = (size: Vec3, pivot: Vec3) =>
	model({ size, palette: { c: '#ffffff' }, pivot }, (m) =>
		m.box([0, 0, 0], [size[0] - 1, size[1] - 1, size[2] - 1], 'c'),
	);

const limb = (): ReturnType<typeof block> => block([1, 3, 1], [0.5, 3, 0.5]);

const bipedParts = (): Record<string, RigPartInput> => ({
	body: { model: block([4, 4, 2], [2, 0, 1]) },
	head: { model: block([2, 2, 2], [1, 0, 1]), parent: 'body', at: [2, 4, 1] },
	armL: { model: limb(), parent: 'body', at: [-0.5, 4, 1] },
	armR: { model: limb(), parent: 'body', at: [4.5, 4, 1] },
	legL: { model: limb(), parent: 'body', at: [1, 0, 1] },
	legR: { model: limb(), parent: 'body', at: [3, 0, 1] },
});

const biped = () => rig({ skeleton: 'biped', scale: 0.5, parts: bipedParts() });

describe('rig', () => {
	test('части в порядке от корня, scale применён, attach в единицах мира', () => {
		const r = biped();
		expect(r.parts[0].name).toBe('body');
		expect(r.parts[0].parent).toBe(-1);
		r.parts.forEach((p, i) => {
			expect(p.parent).toBeLessThan(i);
			expect(p.model.scale).toBe(0.5);
		});
		const legL = r.parts.find((p) => p.name === 'legL');
		expect(legL?.attach).toEqual([-0.5, 0, 0]);
	});

	test('rootLift ставит нижний воксель на землю, strideLength = 2 длины ноги', () => {
		const r = biped();
		expect(r.rootLift).toBeCloseTo(1.5, 6);
		expect(r.strideLength).toBeCloseTo(3, 6);
	});

	test('понятные ошибки строения', () => {
		const missing = bipedParts();
		delete missing.legR;
		expect(() => rig({ skeleton: 'biped', parts: missing })).toThrow('нет части "legR"');
		expect(() =>
			rig({
				skeleton: 'biped',
				parts: { ...bipedParts(), wing: { model: limb(), parent: 'body', at: [0, 0, 0] } },
			}),
		).toThrow('неизвестная часть "wing"');
		expect(() =>
			rig({
				skeleton: 'biped',
				parts: { ...bipedParts(), head: { model: limb(), parent: 'body' } },
			}),
		).toThrow('нет at');
		expect(() =>
			rig({
				skeleton: 'biped',
				parts: { ...bipedParts(), head: { model: limb(), at: [0, 0, 0] } },
			}),
		).toThrow('нет parent');
		expect(() =>
			rig({
				skeleton: 'biped',
				parts: { ...bipedParts(), head: { model: limb(), parent: 'alien', at: [0, 0, 0] } },
			}),
		).toThrow('неизвестный parent');
		const cyclic = bipedParts();
		cyclic.head = { model: limb(), parent: 'armL', at: [0, 0, 0] };
		cyclic.armL = { model: limb(), parent: 'head', at: [0, 0, 0] };
		expect(() => rig({ skeleton: 'biped', parts: cyclic })).toThrow('цикл');
	});
});

describe('poseRig', () => {
	const index = (r: ReturnType<typeof biped>, name: string) =>
		r.parts.findIndex((p) => p.name === name);

	test('biped walk: ноги в противофазе, руки против ног, фаза от stride', () => {
		const r = biped();
		const pose = poseRig(r, 'walk', r.strideLength / 4, 0);
		expect(pose.parts[index(r, 'legL')][0]).toBeCloseTo(toRadians(35), 6);
		expect(pose.parts[index(r, 'legR')][0]).toBeCloseTo(-toRadians(35), 6);
		expect(pose.parts[index(r, 'armL')][0]).toBeCloseTo(-toRadians(25), 6);
		expect(pose.lift).toBeCloseTo(0.25, 6);
		const still = poseRig(r, 'walk', 0, 0);
		expect(still.parts[index(r, 'legL')][0]).toBeCloseTo(0, 6);
	});

	test('idle: ноги стоят, «дыхание» неотрицательно', () => {
		const r = biped();
		for (let t = 0; t < 6; t += 0.37) {
			const pose = poseRig(r, 'idle', 0, t);
			expect(pose.parts[index(r, 'legL')][0]).toBe(0);
			expect(pose.lift).toBeGreaterThanOrEqual(0);
		}
	});

	test('bird fly: крылья машут', () => {
		const wing = block([3, 1, 3], [0, 0.5, 1.5]);
		const b = rig({
			skeleton: 'bird',
			parts: {
				body: { model: block([2, 2, 4], [1, 1, 2]) },
				wingL: { model: wing, parent: 'body', at: [0, 1.5, 2] },
				wingR: { model: wing, parent: 'body', at: [2, 1.5, 2] },
			},
		});
		const pose = poseRig(b, 'fly', 0, 1 / 16);
		expect(pose.parts[index(b, 'wingL')][2]).toBeCloseTo(toRadians(60), 6);
		expect(pose.parts[index(b, 'wingR')][2]).toBeCloseTo(-toRadians(60), 6);
	});
});
