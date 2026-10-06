import { describe, expect, test } from 'bun:test';
import { createNoise2D } from './noise.ts';

describe('createNoise2D', () => {
	test('детерминирован по seed', () => {
		expect(createNoise2D(5).fbm(3.3, 7.1)).toBe(createNoise2D(5).fbm(3.3, 7.1));
	});

	test('разные seed дают разный шум', () => {
		expect(createNoise2D(1).value(10.5, 10.5)).not.toBe(createNoise2D(2).value(10.5, 10.5));
	});

	test('value и fbm в [0, 1]', () => {
		const n = createNoise2D(11);
		for (let x = -20; x < 20; x += 0.37) {
			for (let z = -20; z < 20; z += 0.41) {
				const v = n.value(x, z);
				const f = n.fbm(x, z, 5);
				expect(v >= 0 && v <= 1).toBe(true);
				expect(f >= 0 && f <= 1).toBe(true);
			}
		}
	});

	test('непрерывен: маленький шаг — маленькое изменение', () => {
		const n = createNoise2D(3);
		for (let x = 0; x < 10; x += 0.5) {
			expect(Math.abs(n.value(x, 2) - n.value(x + 0.01, 2))).toBeLessThan(0.05);
		}
	});
});
