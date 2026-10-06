import { model } from '../builder/model.ts';
import { type Rig, rig } from '../entities/rig.ts';
import { createRng, type Rng } from '../rng.ts';

export interface VillagerOptions {
	rng?: Rng;
	shirt?: string;
	pants?: string;
	skin?: string;
	hair?: string;
}

const SHIRTS = ['#3366cc', '#c0392b', '#27ae60', '#8e44ad', '#d68910'];
const PANTS = ['#3b3b58', '#5d4037', '#2e4053'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
const HAIRS = ['#2c1b0e', '#6d4c41', '#d4a017', '#1b1b1b'];

/** Житель: biped, scale 0.25, рост ~11 вокселей (≈2.75 ед.). Лицо смотрит в +z. */
export function villager(options: VillagerOptions = {}): Rig {
	const rng = options.rng ?? createRng(1);
	const shirt = options.shirt ?? rng.pick(SHIRTS);
	const pants = options.pants ?? rng.pick(PANTS);
	const skin = options.skin ?? rng.pick(SKINS);
	const hair = options.hair ?? rng.pick(HAIRS);
	const leg = model({ size: [2, 3, 2], pivot: [1, 3, 1], palette: { pants } }, (m) =>
		m.box([0, 0, 0], [1, 2, 1], 'pants'),
	);
	const body = model({ size: [5, 4, 3], pivot: [2.5, 0, 1.5], palette: { shirt } }, (m) =>
		m.box([0, 0, 0], [4, 3, 2], 'shirt'),
	);
	const arm = model({ size: [1, 4, 2], pivot: [0.5, 4, 1], palette: { shirt, skin } }, (m) => {
		m.box([0, 1, 0], [0, 3, 1], 'shirt');
		m.box([0, 0, 0], [0, 0, 1], 'skin');
	});
	const head = model(
		{ size: [4, 4, 4], pivot: [2, 0, 2], palette: { skin, hair, eye: '#1b1b1b' } },
		(m) => {
			m.box([0, 0, 0], [3, 2, 3], 'skin');
			m.box([0, 3, 0], [3, 3, 3], 'hair');
			m.box([0, 1, 0], [3, 2, 0], 'hair');
			m.set([1, 1, 3], 'eye');
			m.set([2, 1, 3], 'eye');
		},
	);
	return rig({
		skeleton: 'biped',
		scale: 0.25,
		parts: {
			body: { model: body },
			head: { model: head, parent: 'body', at: [2.5, 4, 1.5] },
			armL: { model: arm, parent: 'body', at: [-0.5, 4, 1.5] },
			armR: { model: arm, parent: 'body', at: [5.5, 4, 1.5] },
			legL: { model: leg, parent: 'body', at: [1.5, 0, 1.5] },
			legR: { model: leg, parent: 'body', at: [3.5, 0, 1.5] },
		},
	});
}
