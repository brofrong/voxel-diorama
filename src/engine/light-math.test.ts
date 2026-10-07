import { expect, test } from 'bun:test';
import { flickerFactor, lightIntensity } from './light-math.ts';

const spec = { intensity: 2, flicker: false, nightOnly: false, seed: 3 };

test('мерцание: детерминировано, в пределах ±25%, меняется во времени', () => {
	const values = new Set<number>();
	for (let t = 0; t < 20; t += 0.05) {
		const f = flickerFactor(t, 3);
		expect(f).toBeGreaterThanOrEqual(0.75);
		expect(f).toBeLessThanOrEqual(1.25);
		expect(f).toBe(flickerFactor(t, 3));
		values.add(Math.round(f * 100));
	}
	expect(values.size).toBeGreaterThan(10);
	expect(flickerFactor(1, 3)).not.toBe(flickerFactor(1, 4));
});

test('яркость: мерцание и ночной режим', () => {
	expect(lightIntensity(spec, 5, 0)).toBe(2);
	expect(lightIntensity({ ...spec, nightOnly: true }, 5, 0)).toBe(0);
	expect(lightIntensity({ ...spec, nightOnly: true }, 5, 1)).toBe(2);
	expect(lightIntensity({ ...spec, flicker: true }, 5, 0)).toBeCloseTo(2 * flickerFactor(5, 3), 9);
});
