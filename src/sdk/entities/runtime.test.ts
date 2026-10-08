import { describe, expect, test } from 'bun:test';
import type { Vec3 } from '../../engine/types.ts';
import { model } from '../builder/model.ts';
import { type DioramaInput, defineDiorama } from '../schema.ts';
import { bob, limbs, spin } from './behaviours.ts';
import { walkPath } from './path.ts';
import { rig } from './rig.ts';
import { createEntityRuntime } from './runtime.ts';

const block = (size: Vec3, pivot: Vec3) =>
	model({ size, palette: { c: '#ffffff' }, pivot }, (m) =>
		m.box([0, 0, 0], [size[0] - 1, size[1] - 1, size[2] - 1], 'c'),
	);
const limb = () => block([1, 2, 1], [0.5, 2, 0.5]);
const person = () =>
	rig({
		skeleton: 'biped',
		scale: 0.5,
		parts: {
			body: { model: block([2, 2, 1], [1, 0, 0.5]) },
			head: { model: block([1, 1, 1], [0.5, 0, 0.5]), parent: 'body', at: [1, 2, 0.5] },
			armL: { model: limb(), parent: 'body', at: [-0.5, 2, 0.5] },
			armR: { model: limb(), parent: 'body', at: [2.5, 2, 0.5] },
			legL: { model: limb(), parent: 'body', at: [0.5, 0, 0.5] },
			legR: { model: limb(), parent: 'body', at: [1.5, 0, 0.5] },
		},
	});
const box = block([2, 2, 2], [1, 0, 1]);

const entitiesOf = (entities: DioramaInput['entities']) =>
	defineDiorama({
		meta: {
			title: 'Т',
			createdAt: '2026-10-07',
			author: { model: 'Тест' },
			launchedBy: { name: 'Тест', url: 'https://example.com' },
		},
		size: [32, 16, 32],
		palette: { c: '#ffffff' },
		build() {},
		entities,
	}).entities;

const world = { seed: 1, anchors: { well: [4, 6, 4] as Vec3 }, groundAt: () => 3 };

describe('createEntityRuntime', () => {
	test('модель на [x, z] стоит на земле, одна часть', () => {
		const [inst] = createEntityRuntime(
			entitiesOf([{ id: 'crate', model: box, at: [10, 12] }]),
			world,
		);
		expect(inst.id).toBe('crate');
		expect(inst.parts).toHaveLength(1);
		expect(inst.parts[0].model.pivot).toEqual([1, 0, 1]);
		expect(inst.pose(0).position).toEqual([10, 3, 12]);
	});

	test('якорь и rotate', () => {
		const [inst] = createEntityRuntime(entitiesOf([{ model: box, at: 'well', rotate: 90 }]), world);
		const pose = inst.pose(0);
		expect(pose.position).toEqual([4, 6, 4]);
		expect(pose.rotation[1]).toBeCloseTo(Math.PI / 2, 6);
	});

	test('поведения применяются по порядку поверх at', () => {
		const [inst] = createEntityRuntime(
			entitiesOf([
				{ model: box, at: [0, 0], animate: [bob({ amp: 1, period: 4, phase: 0 }), spin()] },
			]),
			world,
		);
		const pose = inst.pose(1);
		expect(pose.position[1]).toBeCloseTo(4, 6);
		expect(pose.rotation[1]).toBeCloseTo(Math.PI / 2, 6);
	});

	test('count разворачивается в экземпляры с id[i]', () => {
		const list = createEntityRuntime(
			entitiesOf([{ id: 'b', model: box, at: [1, 1], count: 3 }]),
			world,
		);
		expect(list.map((i) => i.id)).toEqual(['b[0]', 'b[1]', 'b[2]']);
	});

	test('rig: части, подъём корня', () => {
		const [inst] = createEntityRuntime(entitiesOf([{ rig: person(), at: [5, 5] }]), world);
		expect(inst.parts.map((p) => p.name)[0]).toBe('body');
		expect(inst.parts).toHaveLength(6);
		expect(inst.pose(0).lift).toBeGreaterThanOrEqual(1);
	});

	test('детерминизм по seed', () => {
		const make = () =>
			createEntityRuntime(entitiesOf([{ model: box, at: [0, 0], animate: bob() }]), world)[0];
		expect(make().pose(2.5)).toEqual(make().pose(2.5));
	});

	test('неизвестный якорь — ошибка с именем сущности и списком якорей', () => {
		expect(() =>
			createEntityRuntime(entitiesOf([{ id: 'blades', model: box, at: 'mill.hub' }]), world),
		).toThrow('сущность blades: неизвестный якорь "mill.hub". Есть: well');
	});

	test('лимиты экземпляров и размера модели', () => {
		const many = Array.from({ length: 5 }, () => ({
			model: box,
			at: [1, 1] as [number, number],
			count: 64,
		}));
		expect(() => createEntityRuntime(entitiesOf(many), world)).toThrow('слишком много экземпляров');
		const huge = model({ size: [65, 1, 1], palette: { c: '#ffffff' } }, () => {});
		expect(() => createEntityRuntime(entitiesOf([{ model: huge, at: [1, 1] }]), world)).toThrow(
			'64',
		);
	});
});

describe('свободный скелет и limbs', () => {
	const seg = () => block([2, 2, 3], [1, 1, 0]);
	// Змейка: голова-корень и цепочка сегментов назад по −z.
	const snake = () =>
		rig({
			skeleton: 'custom',
			scale: 0.5,
			parts: {
				head: { model: block([2, 2, 2], [1, 1, 1]) },
				s1: { model: seg(), parent: 'head', at: [1, 1, 0] },
				s2: { model: seg(), parent: 's1', at: [1, 1, -3] },
				tail: { model: seg(), parent: 's2', at: [1, 1, -3] },
			},
		});

	test('части свободного скелета получают повороты из limbs (в градусах → радианы)', () => {
		const wave = limbs({
			s1: ({ t }) => [0, 30 * Math.sin(t), 0],
			s2: () => [0, 90, 0],
		});
		const [inst] = createEntityRuntime(
			entitiesOf([{ rig: snake(), at: [8, 8], animate: wave }]),
			world,
		);
		const names = inst.parts.map((p) => p.name);
		expect(names[0]).toBe('head');
		const pose = inst.pose(Math.PI / 2);
		expect(pose.parts[names.indexOf('s1')][1]).toBeCloseTo(Math.PI / 6, 6);
		expect(pose.parts[names.indexOf('s2')][1]).toBeCloseTo(Math.PI / 2, 6);
		expect(pose.parts[names.indexOf('tail')]).toEqual([0, 0, 0]);
		// Без встроенной походки нет и «дыхания»: lift — только высота корня.
		expect(pose.lift).toBeCloseTo(inst.pose(0).lift, 6);
	});

	test('у biped limbs прибавляется к походке, replace — заменяет её', () => {
		const route = walkPath([
			[2, 2],
			[28, 2],
		]);
		const armR = (inst: ReturnType<typeof createEntityRuntime>[number]) =>
			inst.pose(1.3).parts[inst.parts.findIndex((p) => p.name === 'armR')];
		const [plain] = createEntityRuntime(entitiesOf([{ rig: person(), animate: route }]), world);
		const [added] = createEntityRuntime(
			entitiesOf([{ rig: person(), animate: [route, limbs({ armR: () => [0, 0, 90] })] }]),
			world,
		);
		const [replaced] = createEntityRuntime(
			entitiesOf([
				{
					rig: person(),
					animate: [route, limbs({ parts: { armR: () => [0, 0, 90] }, replace: true })],
				},
			]),
			world,
		);
		expect(armR(plain)[0]).not.toBe(0);
		expect(armR(added)[0]).toBeCloseTo(armR(plain)[0], 6);
		expect(armR(added)[2]).toBeCloseTo(Math.PI / 2, 6);
		expect(armR(replaced)).toEqual([0, 0, Math.PI / 2]);
	});

	test('limbs видит фазу шага при ходьбе', () => {
		const phases: number[] = [];
		const [inst] = createEntityRuntime(
			entitiesOf([
				{
					rig: person(),
					animate: [
						walkPath([
							[2, 2],
							[28, 2],
						]),
						limbs({
							head: (s) => {
								phases.push(s.phase);
								return [0, 0, 0];
							},
						}),
					],
				},
			]),
			world,
		);
		for (const t of [0.5, 1, 1.5, 2]) inst.pose(t);
		expect(new Set(phases).size).toBeGreaterThan(1);
		for (const p of phases) {
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(1);
		}
	});

	test('понятные ошибки: неизвестная часть и limbs у модели', () => {
		const [bad] = createEntityRuntime(
			entitiesOf([{ rig: snake(), at: [8, 8], animate: limbs({ wing: () => [0, 0, 0] }) }]),
			world,
		);
		expect(() => bad.pose(0)).toThrow('нет части "wing"');
		const [boxy] = createEntityRuntime(
			entitiesOf([{ model: box, at: [8, 8], animate: limbs({ lid: () => [0, 0, 0] }) }]),
			world,
		);
		expect(() => boxy.pose(0)).toThrow('нужен rig');
	});
});
