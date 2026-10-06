import { type Model, model } from '../builder/model.ts';
import { createRng, type Rng } from '../rng.ts';

export interface RockOptions {
	rng?: Rng;
	/** Радиус 1..3. */
	size?: number;
}

/** Валун: купол из двух пересекающихся полусфер двух оттенков. */
export function rock(options: RockOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const r = options.size ?? rng.int(1, 3);
	const size = r * 2 + 3;
	const c = r + 1;
	return model(
		{
			size: [size, r + 1, size],
			palette: { stone: '#8a8a8a', 'stone-dark': '#6f6f6f' },
		},
		(m) => {
			m.sphere([c, 0, c], r, 'stone');
			m.sphere([c + rng.int(-1, 1), 0, c + rng.int(-1, 1)], Math.max(1, r - 1), 'stone-dark');
		},
	);
}
