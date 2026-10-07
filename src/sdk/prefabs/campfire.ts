import { type Model, model } from '../builder/model.ts';

/** Кострище: кольцо камней и поленья (для w.place). Якорь `fire` — над поленьями. */
export function campfire(): Model {
	return model(
		{
			size: [5, 2, 5],
			palette: { stone: '#7d7d7d', log: '#5a3b22', ember: { color: '#ff7a1a', emissive: 1.2 } },
			anchors: { fire: [2.5, 1, 2.5] },
		},
		(m) => {
			for (const [x, z] of [
				[0, 2],
				[4, 2],
				[2, 0],
				[2, 4],
				[1, 1],
				[3, 1],
				[1, 3],
				[3, 3],
			] as const) {
				m.set([x, 0, z], 'stone');
			}
			m.box([1, 0, 2], [3, 0, 2], 'log');
			m.box([2, 0, 1], [2, 0, 3], 'log');
			m.set([2, 0, 2], 'ember');
		},
	);
}
