import { describe, expect, test } from 'bun:test';
import { cloudLayout, starLayout } from './layout.ts';
import { mulberry32 } from './random.ts';

describe('mulberry32', () => {
	test('детерминирован и в [0, 1)', () => {
		const a = mulberry32(5);
		const b = mulberry32(5);
		for (let i = 0; i < 100; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v >= 0 && v < 1).toBe(true);
		}
	});
});

describe('звёзды', () => {
	test('верхняя полусфера, единичные направления, детерминированы', () => {
		const stars = starLayout(7, 300);
		expect(stars).toHaveLength(300);
		for (const s of stars) {
			expect(s.direction[1]).toBeGreaterThan(0.04);
			expect(Math.hypot(...s.direction)).toBeCloseTo(1, 6);
			expect(s.size >= 0.6 && s.size <= 1.4).toBe(true);
		}
		expect(starLayout(7, 300)).toEqual(stars);
		expect(starLayout(8, 300)).not.toEqual(stars);
	});
});

describe('облака', () => {
	test('число облаков, 3–6 кубов в каждом, детерминированы', () => {
		const clouds = cloudLayout(3, 10);
		expect(clouds).toHaveLength(10);
		for (const c of clouds) {
			expect(c.boxes.length >= 3 && c.boxes.length <= 6).toBe(true);
			expect(c.distance >= 0.45 && c.distance <= 0.8).toBe(true);
			expect(c.height >= 0.06 && c.height <= 0.16).toBe(true);
		}
		expect(cloudLayout(3, 10)).toEqual(clouds);
	});
});
