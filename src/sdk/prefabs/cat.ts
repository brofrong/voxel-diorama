import { model } from '../builder/model.ts';
import { type Rig, rig } from '../entities/rig.ts';
import { createRng, type Rng } from '../rng.ts';

export interface CatOptions {
	rng?: Rng;
	color?: string;
}

const COLORS = ['#e67e22', '#7f8c8d', '#2c2c2c', '#f5f5dc'];

/** Кот: quadruped, scale 0.25. Лицо смотрит в +z. */
export function cat(options: CatOptions = {}): Rig {
	const rng = options.rng ?? createRng(1);
	const fur = options.color ?? rng.pick(COLORS);
	const body = model({ size: [3, 3, 6], pivot: [1.5, 0, 3], palette: { fur } }, (m) =>
		m.box([0, 0, 0], [2, 2, 5], 'fur'),
	);
	const head = model(
		{ size: [3, 4, 3], pivot: [1.5, 0, 0], palette: { fur, eye: '#2ecc71', nose: '#e8a0a0' } },
		(m) => {
			m.box([0, 0, 0], [2, 2, 2], 'fur');
			m.set([0, 3, 1], 'fur');
			m.set([2, 3, 1], 'fur');
			m.set([0, 2, 2], 'eye');
			m.set([2, 2, 2], 'eye');
			m.set([1, 1, 2], 'nose');
		},
	);
	const leg = model({ size: [1, 2, 1], pivot: [0.5, 2, 0.5], palette: { fur } }, (m) =>
		m.box([0, 0, 0], [0, 1, 0], 'fur'),
	);
	const tail = model({ size: [1, 1, 4], pivot: [0.5, 0.5, 4], palette: { fur } }, (m) =>
		m.box([0, 0, 0], [0, 0, 3], 'fur'),
	);
	return rig({
		skeleton: 'quadruped',
		scale: 0.25,
		parts: {
			body: { model: body },
			head: { model: head, parent: 'body', at: [1.5, 2, 5] },
			legFL: { model: leg, parent: 'body', at: [0.5, 0, 5] },
			legFR: { model: leg, parent: 'body', at: [2.5, 0, 5] },
			legBL: { model: leg, parent: 'body', at: [0.5, 0, 0.5] },
			legBR: { model: leg, parent: 'body', at: [2.5, 0, 0.5] },
			tail: { model: tail, parent: 'body', at: [1.5, 2.5, 0] },
		},
	});
}
