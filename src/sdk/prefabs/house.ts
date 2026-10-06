import { type Model, model } from '../builder/model.ts';
import { createRng, type Rng } from '../rng.ts';

export interface HouseOptions {
	rng?: Rng;
	width?: number;
	depth?: number;
	walls?: string;
	roof?: string;
}

/** Домик: стены, двускатная крыша со свесом, дверь, светящиеся окна, труба. Фасад смотрит в -z. */
export function house(options: HouseOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const width = options.width ?? rng.pick([5, 7]);
	const depth = options.depth ?? rng.int(5, 7);
	const wallHeight = 4;
	const roofLayers = Math.floor((width + 1) / 2) + 1;
	const mid = Math.floor((width + 1) / 2);
	return model(
		{
			size: [width + 2, wallHeight + roofLayers + 1, depth + 2],
			palette: {
				wall: options.walls ?? '#e8dcc0',
				roof: options.roof ?? '#b5452f',
				door: '#5a3a22',
				window: { color: '#ffd27a', emissive: 0.8 },
				chimney: '#7d7d7d',
			},
		},
		(m) => {
			m.box([1, 0, 1], [width, wallHeight - 1, depth], 'wall');
			// Двускатная крыша вдоль оси z со свесом в 1 воксель.
			for (let k = 0; k < roofLayers && k <= width + 1 - k; k++) {
				m.box([k, wallHeight + k, 0], [width + 1 - k, wallHeight + k, depth + 1], 'roof');
			}
			m.box([mid, 0, 1], [mid, 1, 1], 'door');
			for (const z of [1, depth]) {
				m.set([2, 2, z], 'window');
				m.set([width - 1, 2, z], 'window');
			}
			const side = Math.floor((depth + 1) / 2);
			m.set([1, 2, side], 'window');
			m.set([width, 2, side], 'window');
			m.box([width - 1, wallHeight, 2], [width - 1, wallHeight + roofLayers, 2], 'chimney');
		},
	);
}
