/** Двумерный value noise. Все значения в [0, 1]. */
export interface Noise2D {
	value(x: number, z: number): number;
	/** Фрактальный шум: сумма октав с убывающей амплитудой. */
	fbm(x: number, z: number, octaves?: number): number;
}

export function createNoise2D(seed: number): Noise2D {
	const s = seed | 0;

	const hash = (ix: number, iz: number): number => {
		let h = s ^ Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1);
		h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
		h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
		h ^= h >>> 16;
		return (h >>> 0) / 4294967295;
	};

	const smooth = (t: number): number => t * t * (3 - 2 * t);

	const value = (x: number, z: number): number => {
		const x0 = Math.floor(x);
		const z0 = Math.floor(z);
		const fx = smooth(x - x0);
		const fz = smooth(z - z0);
		const a = hash(x0, z0);
		const b = hash(x0 + 1, z0);
		const c = hash(x0, z0 + 1);
		const d = hash(x0 + 1, z0 + 1);
		const near = a + (b - a) * fx;
		const far = c + (d - c) * fx;
		return near + (far - near) * fz;
	};

	const fbm = (x: number, z: number, octaves = 4): number => {
		let sum = 0;
		let amplitude = 1;
		let frequency = 1;
		let norm = 0;
		for (let i = 0; i < octaves; i++) {
			// Сдвиг на октаву убирает совпадение узлов решётки между октавами.
			sum += amplitude * value(x * frequency + i * 17.3, z * frequency - i * 9.1);
			norm += amplitude;
			amplitude *= 0.5;
			frequency *= 2;
		}
		return sum / norm;
	};

	return { value, fbm };
}
