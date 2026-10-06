import { model } from '../builder/model.ts';
import { type Rig, rig } from '../entities/rig.ts';
import { createRng, type Rng } from '../rng.ts';

export interface BirdOptions {
	rng?: Rng;
	color?: string;
}

const COLORS = ['#34495e', '#ecf0f1', '#5d6d7e', '#a04000'];

/** Птица: bird, scale 0.25, размах ~8 вокселей. Клюв смотрит в +z. */
export function bird(options: BirdOptions = {}): Rig {
	const rng = options.rng ?? createRng(1);
	const feather = options.color ?? rng.pick(COLORS);
	const body = model(
		{ size: [2, 2, 5], pivot: [1, 1, 2.5], palette: { feather, beak: '#f39c12' } },
		(m) => {
			m.box([0, 0, 0], [1, 1, 3], 'feather');
			m.box([0, 1, 4], [1, 1, 4], 'beak');
		},
	);
	const wingL = model({ size: [3, 1, 3], pivot: [3, 0.5, 1.5], palette: { feather } }, (m) =>
		m.box([0, 0, 0], [2, 0, 2], 'feather'),
	);
	const wingR = model({ size: [3, 1, 3], pivot: [0, 0.5, 1.5], palette: { feather } }, (m) =>
		m.box([0, 0, 0], [2, 0, 2], 'feather'),
	);
	const tail = model({ size: [2, 1, 2], pivot: [1, 0.5, 2], palette: { feather } }, (m) =>
		m.box([0, 0, 0], [1, 0, 1], 'feather'),
	);
	return rig({
		skeleton: 'bird',
		scale: 0.25,
		parts: {
			body: { model: body },
			wingL: { model: wingL, parent: 'body', at: [0, 1.5, 2] },
			wingR: { model: wingR, parent: 'body', at: [2, 1.5, 2] },
			tail: { model: tail, parent: 'body', at: [1, 1.5, 0] },
		},
	});
}
