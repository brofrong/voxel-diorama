import { model, type Rig, rig } from '#sdk';

export interface AstronomerOptions {
	robe: string;
	trim: string;
	hat: string;
	skin?: string;
}

/** Астроном в мантии и остроконечной шляпе: biped, 14 вокселей × 0.42 ≈ 5.9 ед. Лицо в +z. */
export function astronomer(o: AstronomerOptions): Rig {
	const skin = o.skin ?? '#e9bd8a';
	const leg = model(
		{ size: [2, 3, 2], pivot: [1, 3, 1], palette: { robe: o.robe, boot: '#231a1c' } },
		(m) => {
			m.box([0, 1, 0], [1, 2, 1], 'robe');
			m.box([0, 0, 0], [1, 0, 1], 'boot');
		},
	);
	const body = model(
		{
			size: [5, 5, 4],
			pivot: [2.5, 0, 2.5],
			palette: { robe: o.robe, trim: { color: o.trim, emissive: 0.25 } },
		},
		(m) => {
			m.box([0, 0, 1], [4, 4, 3], 'robe');
			m.box([0, 0, 1], [4, 0, 3], 'trim');
			m.box([2, 1, 3], [2, 4, 3], 'trim');
		},
	);
	const arm = model(
		{ size: [1, 4, 2], pivot: [0.5, 4, 1], palette: { robe: o.robe, skin } },
		(m) => {
			m.box([0, 1, 0], [0, 3, 1], 'robe');
			m.box([0, 0, 0], [0, 0, 1], 'skin');
		},
	);
	const head = model(
		{
			size: [6, 8, 6],
			pivot: [3, 0, 3],
			palette: {
				skin,
				hat: o.hat,
				star: { color: '#ffe27a', emissive: 1.2 },
				eye: '#1b1b1b',
				beard: '#e8e4dc',
			},
		},
		(m) => {
			m.box([1, 0, 1], [4, 2, 4], 'skin');
			m.box([1, 0, 4], [4, 0, 4], 'beard');
			m.set([2, 1, 4], 'eye');
			m.set([3, 1, 4], 'eye');
			m.box([0, 3, 0], [5, 3, 5], 'hat');
			m.box([1, 4, 1], [4, 4, 4], 'hat');
			m.box([2, 5, 2], [3, 6, 3], 'hat');
			m.set([2, 7, 2], 'hat');
			m.set([3, 4, 4], 'star');
		},
	);
	return rig({
		skeleton: 'biped',
		scale: 0.42,
		parts: {
			body: { model: body },
			head: { model: head, parent: 'body', at: [2.5, 5, 2.5] },
			armL: { model: arm, parent: 'body', at: [-0.5, 5, 2.5] },
			armR: { model: arm, parent: 'body', at: [5.5, 5, 2.5] },
			legL: { model: leg, parent: 'body', at: [1.5, 0, 2.5] },
			legR: { model: leg, parent: 'body', at: [3.5, 0, 2.5] },
		},
	});
}
