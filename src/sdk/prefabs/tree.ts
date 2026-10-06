import { type Model, model } from '../builder/model.ts';
import { createRng, type Rng } from '../rng.ts';

export interface TreeOptions {
	rng?: Rng;
	height?: number;
	leaves?: string;
	trunk?: string;
}

/** Лиственное дерево: ствол-столб и крона из нескольких сфер. Основание — y = 0. */
export function tree(options: TreeOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(4, 6);
	const radius = rng.int(2, 3);
	const size = radius * 2 + 3;
	const c = radius + 1;
	const crown = height + radius - 1;
	return model(
		{
			size: [size, height + radius * 2 + 1, size],
			palette: { trunk: options.trunk ?? '#6b4a2b', leaves: options.leaves ?? '#4f8f3a' },
		},
		(m) => {
			m.sphere([c, crown, c], radius, 'leaves');
			for (let i = 0; i < 3; i++) {
				m.sphere(
					[c + rng.int(-1, 1), crown + rng.int(-1, 1), c + rng.int(-1, 1)],
					radius - 1,
					'leaves',
				);
			}
			m.box([c, 0, c], [c, height, c], 'trunk');
		},
	);
}
