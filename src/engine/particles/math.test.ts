import { describe, expect, test } from 'bun:test';
import { applyGround, instanceCount, particleAge, particlePath, particleScale } from './math.ts';

describe('particleAge', () => {
	test('частицы равномерно распределены по времени жизни и перерождаются', () => {
		expect(particleAge(0, 0, 10, 5)).toEqual({ age: 0, cycle: 0, k: 0 });
		const second = particleAge(0, 1, 10, 5);
		expect(second.age).toBeCloseTo(4.5, 9);
		expect(second.cycle).toBe(-1);
		expect(particleAge(12, 0, 10, 5)).toEqual({ age: 2, cycle: 2, k: 0.4 });
	});

	test('возраст всегда в [0, lifetime)', () => {
		for (let t = 0; t < 30; t += 0.37) {
			for (let i = 0; i < 20; i++) {
				const { age } = particleAge(t, i, 20, 3);
				expect(age >= 0 && age < 3).toBe(true);
			}
		}
	});
});

describe('particleScale', () => {
	test('появляется и исчезает плавно, видимость множит', () => {
		expect(particleScale([1, 1], 0, 1)).toBe(0);
		expect(particleScale([1, 3], 0.5, 1)).toBeCloseTo(2, 6);
		expect(particleScale([1, 1], 0.999, 1)).toBeLessThan(0.01);
		expect(particleScale([1, 1], 0.5, 0)).toBe(0);
	});
});

describe('путь и земля', () => {
	const motion = {
		extent: [1, 0, 1] as [number, number, number],
		velocity: [0, 2, 0] as [number, number, number],
		jitter: [0, 0, 0] as [number, number, number],
		gravity: -4,
		wind: { amp: 0, freq: 1 },
	};

	test('центр области, скорость и гравитация', () => {
		const p = particlePath(motion, [5, 10, 5], 1, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
		expect(p[0]).toBeCloseTo(5, 9);
		expect(p[1]).toBeCloseTo(10 + 2 - 2, 9);
		expect(p[2]).toBeCloseTo(5, 9);
	});

	test('слой над землёй и исчезновение под землёй', () => {
		expect(applyGround({ groundRelative: true, groundCull: false }, [1, 2, 3], 5)).toEqual({
			position: [1, 7, 3],
			visible: true,
		});
		expect(applyGround({ groundRelative: false, groundCull: true }, [1, 4, 3], 5).visible).toBe(
			false,
		);
		// пустая колонка (вода/обрыв): земля 0 — снег долетает до 0
		expect(applyGround({ groundRelative: false, groundCull: true }, [1, 0.5, 3], 0).visible).toBe(
			true,
		);
	});

	test('instanceCount по плотности качества, минимум 1', () => {
		expect(instanceCount(100, 0.3)).toBe(30);
		expect(instanceCount(1, 0.3)).toBe(1);
		expect(instanceCount(100, 1)).toBe(100);
	});
});
