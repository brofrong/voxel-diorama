import { type Model, model, type Rig, rig } from '#sdk';

export interface FolkOptions {
	shirt: string;
	pants?: string;
	skin?: string;
	/** Каска. */
	hat: string;
	/** Рюкзак. */
	pack?: string;
}

/** Крошечный восходитель: biped, рост 11 вокселей × 0.4 = 4.4 ед. Лицо смотрит в +z. */
export function folk(o: FolkOptions): Rig {
	const pants = o.pants ?? '#3b3b58';
	const skin = o.skin ?? '#f1c27d';
	const pack = o.pack ?? '#7a4a24';
	const leg = model(
		{ size: [2, 3, 2], pivot: [1, 3, 1], palette: { pants, boot: '#2b1d14' } },
		(m) => {
			m.box([0, 1, 0], [1, 2, 1], 'pants');
			m.box([0, 0, 0], [1, 0, 1], 'boot');
		},
	);
	const body = model(
		{ size: [5, 4, 4], pivot: [2.5, 0, 2.5], palette: { shirt: o.shirt, pack } },
		(m) => {
			m.box([0, 0, 1], [4, 3, 3], 'shirt');
			m.box([1, 1, 0], [3, 3, 0], 'pack');
		},
	);
	const arm = model(
		{ size: [1, 4, 2], pivot: [0.5, 4, 1], palette: { shirt: o.shirt, skin } },
		(m) => {
			m.box([0, 1, 0], [0, 3, 1], 'shirt');
			m.box([0, 0, 0], [0, 0, 1], 'skin');
		},
	);
	const head = model(
		{ size: [4, 4, 4], pivot: [2, 0, 2], palette: { skin, hat: o.hat, eye: '#1b1b1b' } },
		(m) => {
			m.box([0, 0, 0], [3, 2, 3], 'skin');
			m.box([0, 3, 0], [3, 3, 3], 'hat');
			m.box([0, 2, 0], [3, 2, 1], 'hat');
			m.set([1, 1, 3], 'eye');
			m.set([2, 1, 3], 'eye');
		},
	);
	return rig({
		skeleton: 'biped',
		scale: 0.4,
		parts: {
			body: { model: body },
			head: { model: head, parent: 'body', at: [2.5, 4, 2.5] },
			armL: { model: arm, parent: 'body', at: [-0.5, 4, 2.5] },
			armR: { model: arm, parent: 'body', at: [5.5, 4, 2.5] },
			legL: { model: leg, parent: 'body', at: [1.5, 0, 2.5] },
			legR: { model: leg, parent: 'body', at: [3.5, 0, 2.5] },
		},
	});
}

/** Муравей с крошкой сахара на спине. Длина вдоль z, голова в +z. */
export function ant(): Model {
	return model(
		{
			size: [3, 4, 7],
			scale: 0.4,
			palette: { ant: '#2a1a12', leg: '#170d08', crumb: { color: '#ffffff', vary: 0.03 } },
		},
		(m) => {
			m.box([1, 1, 0], [1, 2, 1], 'ant');
			m.set([1, 1, 2], 'ant');
			m.box([1, 1, 3], [1, 1, 4], 'ant');
			m.box([1, 1, 5], [1, 2, 6], 'ant');
			for (const z of [2, 3, 4]) {
				m.set([0, 0, z], 'leg');
				m.set([2, 0, z], 'leg');
			}
			m.box([0, 2, 2], [2, 3, 4], 'crumb');
		},
	);
}

/** Флаг на древке: полотнище из двух тонов, качается целиком. */
export function flag(color: string, shade: string): Model {
	return model(
		{
			size: [1, 12, 7],
			pivot: [0.5, 0, 0.5],
			palette: {
				pole: '#f3ede2',
				flag: { color, vary: 0.03 },
				shade: { color: shade, vary: 0.03 },
			},
		},
		(m) => {
			m.box([0, 0, 0], [0, 11, 0], 'pole');
			for (let z = 1; z <= 6; z++) {
				const drop = z > 4 ? 1 : 0;
				m.box([0, 7 - drop, z], [0, 10 - drop, z], z % 3 === 0 ? 'shade' : 'flag');
			}
		},
	);
}

/** Черника на тросе крана: трос длиной в ход подъёма уходит вверх. */
export function hook(travel: number): Model {
	return model(
		{
			size: [5, 5 + travel, 5],
			palette: {
				berry: { color: '#3a4a9c', vary: 0.08 },
				'berry-l': '#7f8fdc',
				rope: '#3a3026',
			},
		},
		(m) => {
			m.sphere([2, 2, 2], 2.4, 'berry');
			m.set([3, 3, 3], 'berry-l');
			m.box([2, 5, 2], [2, 4 + travel, 2], 'rope');
		},
	);
}
