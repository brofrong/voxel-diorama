import { type Model, model } from '../builder/model.ts';
import { createRng, type Rng } from '../rng.ts';

export interface PineOptions {
	rng?: Rng;
	height?: number;
	needles?: string;
}

/** Ель: ствол и ярусный конус хвои. Основание — y = 0. */
export function pine(options: PineOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(7, 11);
	const radius = Math.max(2, Math.floor(height / 3));
	const size = radius * 2 + 1;
	const c = radius;
	return model(
		{
			size: [size, height + 2, size],
			palette: { trunk: '#5a3b22', needles: options.needles ?? '#2f6b3a' },
		},
		(m) => {
			m.box([c, 0, c], [c, height, c], 'trunk');
			for (let y = 2; y <= height + 1; y++) {
				const t = (y - 2) / (height - 1);
				let r = Math.round(radius * (1 - t));
				// Каждый третий слой уже — получаются «юбки» ярусов.
				if ((y - 2) % 3 === 2) r = Math.max(0, r - 1);
				m.cylinder([c, y, c], r, 1, 'needles');
			}
		},
	);
}
