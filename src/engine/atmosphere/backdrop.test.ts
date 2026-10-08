import { describe, expect, test } from 'bun:test';
import type { BackdropConfig, Vec3 } from '../types.ts';
import { backdropLayout, backdropMetrics } from './backdrop.ts';

const SIZE: Vec3 = [96, 48, 96];
const off: BackdropConfig = { clouds: 0, mountains: 0, cloudSea: false };

describe('backdropLayout', () => {
	test('выключенный задник пуст', () => {
		const layout = backdropLayout(off, SIZE, 1);
		expect(layout.clouds.length + layout.cloudSea.length + layout.mountains.length).toBe(0);
	});

	test('детерминирован по seed', () => {
		const config: BackdropConfig = { clouds: 0.5, mountains: 0.5, cloudSea: true };
		expect(backdropLayout(config, SIZE, 7)).toEqual(backdropLayout(config, SIZE, 7));
		expect(backdropLayout(config, SIZE, 7)).not.toEqual(backdropLayout(config, SIZE, 8));
	});

	test('облаков больше при большем clouds; все — снаружи диорамы', () => {
		const few = backdropLayout({ ...off, clouds: 0.1 }, SIZE, 3).clouds;
		const many = backdropLayout({ ...off, clouds: 1 }, SIZE, 3).clouds;
		expect(many.length).toBeGreaterThan(few.length);
		const { radius } = backdropMetrics(SIZE);
		for (const b of many) expect(Math.hypot(b.center[0], b.center[2])).toBeGreaterThan(radius);
	});

	test('облачное море — под диорамой, горы — далеко за ней, снег — на вершинах', () => {
		const layout = backdropLayout({ clouds: 0, mountains: 1, cloudSea: true }, SIZE, 5);
		expect(layout.cloudSea.length).toBeGreaterThan(0);
		for (const b of layout.cloudSea) expect(b.center[1] + b.size[1] / 2).toBeLessThan(0);
		const { radius } = backdropMetrics(SIZE);
		expect(layout.mountains.length).toBeGreaterThan(0);
		for (const b of layout.mountains) {
			expect(Math.hypot(b.center[0], b.center[2])).toBeGreaterThanOrEqual(radius * 3);
			expect(b.size[1]).toBeGreaterThan(0);
		}
		expect(layout.snow.length).toBeGreaterThan(0);
		const highest = Math.max(...layout.mountains.map((b) => b.center[1] + b.size[1] / 2));
		for (const s of layout.snow) expect(s.center[1]).toBeGreaterThan(highest * 0.3);
	});
});
