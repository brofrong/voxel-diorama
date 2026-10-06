import { describe, expect, test } from 'bun:test';
import { createRng } from './rng.ts';

describe('createRng', () => {
	test('одинаковый seed — одинаковая последовательность', () => {
		const a = createRng(42);
		const b = createRng(42);
		const seqA = Array.from({ length: 10 }, () => a.next());
		const seqB = Array.from({ length: 10 }, () => b.next());
		expect(seqA).toEqual(seqB);
	});

	test('разные seed — разные последовательности', () => {
		expect(createRng(1).next()).not.toBe(createRng(2).next());
	});

	test('next() в [0, 1)', () => {
		const rng = createRng(7);
		for (let i = 0; i < 10_000; i++) {
			const v = rng.next();
			expect(v >= 0 && v < 1).toBe(true);
		}
	});

	test('int(min, max) включает обе границы и не выходит за них', () => {
		const rng = createRng(3);
		const seen = new Set<number>();
		for (let i = 0; i < 10_000; i++) {
			const v = rng.int(2, 5);
			expect(v >= 2 && v <= 5 && Number.isInteger(v)).toBe(true);
			seen.add(v);
		}
		expect([...seen].sort()).toEqual([2, 3, 4, 5]);
	});

	test('pick бросает на пустом массиве', () => {
		expect(() => createRng(1).pick([])).toThrow('пустой');
	});

	test('fork детерминирован и не совпадает с родителем', () => {
		const a = createRng(9).fork();
		const b = createRng(9).fork();
		expect(a.next()).toBe(b.next());
		const parent = createRng(9);
		const child = parent.fork();
		expect(child.next()).not.toBe(parent.next());
	});
});
