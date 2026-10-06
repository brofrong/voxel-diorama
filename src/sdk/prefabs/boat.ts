import { type Model, model } from '../builder/model.ts';

/** Лодка (сущность): scale 0.5, длина вдоль z, pivot — нижний центр. */
export function boat(options: { color?: string } = {}): Model {
	return model(
		{
			size: [5, 3, 10],
			scale: 0.5,
			palette: { hull: options.color ?? '#8b5a2b', plank: '#c49a6c' },
		},
		(m) => {
			m.box([1, 0, 1], [3, 0, 8], 'hull');
			m.box([0, 1, 0], [4, 2, 9], 'hull');
			m.clear([1, 1, 1], [3, 2, 8]);
			m.box([1, 1, 1], [3, 1, 8], 'plank');
			m.clear([0, 1, 0], [0, 2, 0]);
			m.clear([4, 1, 0], [4, 2, 0]);
			m.clear([0, 1, 9], [0, 2, 9]);
			m.clear([4, 1, 9], [4, 2, 9]);
			m.box([1, 2, 5], [3, 2, 5], 'plank');
		},
	);
}
