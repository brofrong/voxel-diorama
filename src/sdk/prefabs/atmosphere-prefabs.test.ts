import { expect, test } from 'bun:test';
import { modelIndex } from '../builder/model.ts';
import { campfire, house, lantern } from './index.ts';

test('lantern: светящийся фонарь, якорь light в центре фонаря', () => {
	const m = lantern();
	expect(m.anchors.light).toEqual([1.5, 4.5, 1.5]);
	expect(m.materials.some(({ material }) => material.emissive > 0)).toBe(true);
	expect(m.data[modelIndex(m.size, 1, 0, 1)]).not.toBe(0);
});

test('campfire: якорь fire над поленьями', () => {
	const m = campfire();
	expect(m.anchors.fire).toEqual([2.5, 1, 2.5]);
	expect(m.data.some((v) => v !== 0)).toBe(true);
});

test('house: якорь chimney над верхом трубы', () => {
	const h = house({ width: 5 });
	// труба: x = width - 1, z = 2, верх — y = wallHeight + roofLayers
	expect(h.anchors.chimney).toEqual([4.5, 4 + 4 + 1, 2.5]);
	const [x, y, z] = h.anchors.chimney;
	expect(h.data[modelIndex(h.size, Math.floor(x), Math.floor(y) - 1, Math.floor(z))]).not.toBe(0);
});

test('lantern: светящиеся воксели видны сбоку (не замурованы в столб)', () => {
	const m = lantern();
	const glow = m.materials.findIndex(({ material }) => material.emissive > 0) + 1;
	for (const [x, z] of [
		[1, 0],
		[0, 1],
		[2, 1],
		[1, 2],
	] as const) {
		expect(m.data[modelIndex(m.size, x, 4, z)]).toBe(glow);
	}
});
