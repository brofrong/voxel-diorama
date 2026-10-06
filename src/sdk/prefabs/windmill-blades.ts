import { type Model, model } from '../builder/model.ts';

/** Крылья мельницы (сущность): плоскость XY, вращать spin({ axis: 'z' }), pivot — ступица. */
export function windmillBlades(options: { color?: string } = {}): Model {
	return model(
		{
			size: [15, 15, 1],
			pivot: [7.5, 7.5, 0.5],
			palette: { spar: '#5a3b22', sail: options.color ?? '#f4ecd8' },
		},
		(m) => {
			m.set([7, 7, 0], 'spar');
			m.box([7, 8, 0], [7, 14, 0], 'spar');
			m.box([8, 9, 0], [9, 14, 0], 'sail');
			m.box([8, 7, 0], [14, 7, 0], 'spar');
			m.box([9, 5, 0], [14, 6, 0], 'sail');
			m.box([7, 0, 0], [7, 6, 0], 'spar');
			m.box([5, 0, 0], [6, 5, 0], 'sail');
			m.box([0, 7, 0], [6, 7, 0], 'spar');
			m.box([0, 8, 0], [5, 9, 0], 'sail');
		},
	);
}
