import { type Model, model } from '../builder/model.ts';

/** Фонарь на столбе (для w.place). Якорь `light` — центр фонаря, туда ставят pointLight. */
export function lantern(options: { post?: string; glow?: string } = {}): Model {
	return model(
		{
			size: [3, 6, 3],
			palette: {
				post: options.post ?? '#3b3b3b',
				glow: { color: options.glow ?? '#ffd27a', emissive: 1.5 },
			},
			anchors: { light: [1.5, 4.5, 1.5] },
		},
		(m) => {
			m.box([1, 0, 1], [1, 3, 1], 'post');
			m.box([0, 4, 0], [2, 4, 2], 'post');
			m.set([1, 4, 1], 'glow');
			m.box([0, 5, 0], [2, 5, 2], 'post');
		},
	);
}
