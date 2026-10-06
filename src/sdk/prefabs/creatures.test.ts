import { describe, expect, test } from 'bun:test';
import { createRng } from '../rng.ts';
import { bird, boat, cat, house, villager, windmill, windmillBlades } from './index.ts';

describe.each([
	['villager', villager, 'biped'],
	['cat', cat, 'quadruped'],
	['bird', bird, 'bird'],
] as const)('%s', (_, make, skeleton) => {
	test('валидный rig нужного скелета, scale 0.25', () => {
		const r = make();
		expect(r.kind).toBe('rig');
		expect(r.skeleton).toBe(skeleton);
		expect(r.scale).toBe(0.25);
		for (const part of r.parts) expect(part.model.size.every((s) => s <= 64)).toBe(true);
	});

	test('детерминирован по rng', () => {
		const a = make({ rng: createRng(3) });
		const b = make({ rng: createRng(3) });
		expect(a.parts.map((p) => p.model.materials)).toEqual(b.parts.map((p) => p.model.materials));
	});
});

test('villager: цвета настраиваются', () => {
	const body = villager({ shirt: '#123456' }).parts.find((p) => p.name === 'body');
	expect(body?.model.materials[0].material.color).toBe('#123456');
});

test('windmill: якоря hub и door, масштаб мира', () => {
	const m = windmill();
	expect(m.scale).toBe(1);
	expect(m.anchors.hub).toEqual([4.5, 12.5, -0.5]);
	expect(m.anchors.door).toEqual([4.5, 0, 0.5]);
});

test('windmillBlades: pivot в ступице', () => {
	expect(windmillBlades().pivot).toEqual([7.5, 7.5, 0.5]);
});

test('boat: мелкие воксели, pivot — нижний центр', () => {
	const b = boat();
	expect(b.scale).toBe(0.5);
	expect(b.pivot).toEqual([2.5, 0, 5]);
});

test('house: якорь door перед дверью', () => {
	const h = house({ width: 5 });
	expect(h.anchors.door).toEqual([3.5, 0, 0.5]);
});
