/** Детерминированный генератор случайных чисел. В диорамах — единственный источник случайности. */
export interface Rng {
	/** Равномерное число в [0, 1). */
	next(): number;
	/** Число в [min, max). */
	float(min: number, max: number): number;
	/** Целое в [min, max] включительно. */
	int(min: number, max: number): number;
	pick<T>(items: readonly T[]): T;
	chance(probability: number): boolean;
	/** Независимый поток, детерминированно выведенный из текущего. */
	fork(): Rng;
}

/** mulberry32: быстрый 32-битный генератор, достаточный для процедурной генерации. */
export function createRng(seed: number): Rng {
	let state = seed >>> 0;

	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	function pick<T>(items: readonly T[]): T {
		if (items.length === 0) throw new Error('rng.pick: пустой массив');
		return items[Math.floor(next() * items.length)] as T;
	}

	return {
		next,
		float: (min, max) => min + next() * (max - min),
		int: (min, max) => min + Math.floor(next() * (max - min + 1)),
		pick,
		chance: (probability) => next() < probability,
		fork: () => createRng(Math.floor(next() * 4294967296)),
	};
}
