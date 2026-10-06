import { describe, expect, test } from 'bun:test';
import type { Vec3 } from '../../engine/types.ts';
import { model } from '../builder/model.ts';
import { type DioramaInput, defineDiorama } from '../schema.ts';
import { bob, spin } from './behaviours.ts';
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
		meta: { title: 'Т', createdAt: '2026-10-07' },
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
