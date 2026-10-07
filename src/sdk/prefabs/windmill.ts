import { type Model, model } from '../builder/model.ts';

export interface WindmillOptions {
	walls?: string;
	roof?: string;
}

/**
 * Мельница (статичная, ставится через w.place). Фасад смотрит в −z.
 * Якоря: `hub` — ступица для windmillBlades, `door` — перед дверью на уровне земли.
 */
export function windmill(options: WindmillOptions = {}): Model {
	return model(
		{
			size: [9, 16, 9],
			palette: {
				wall: options.walls ?? '#e8dcc0',
				roof: options.roof ?? '#7b3f2a',
				door: '#5a3a22',
				axle: '#4a3020',
				window: { color: '#ffd27a', emissive: 0.8 },
			},
			anchors: { hub: [4.5, 12.5, -0.5], door: [4.5, 0, -0.5] },
		},
		(m) => {
			m.box([1, 0, 1], [7, 11, 7], 'wall');
			m.box([2, 12, 2], [6, 13, 6], 'wall');
			m.box([2, 14, 2], [6, 14, 6], 'roof');
			m.box([3, 15, 3], [5, 15, 5], 'roof');
			m.box([4, 0, 1], [4, 1, 1], 'door');
			m.set([4, 7, 1], 'window');
			m.set([1, 5, 4], 'window');
			m.set([7, 5, 4], 'window');
			m.box([4, 12, 0], [4, 12, 1], 'axle');
		},
	);
}
