import { type Behaviour, custom, limbs, type ModelBuilder, model, type Rig, rig } from '#sdk';

const TAU = Math.PI * 2;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Детерминированный хеш точки → [0, 1): «случайность» для моделей без rng. */
export const hash = (x: number, y: number, z: number): number => {
	let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0;
	h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
	h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
	return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

// --- избушка: воксель 0.5 ед. ---
const S = 40;
const C = 20;
const W0 = 7;
const W1 = 32;
const WALL_H = 18;
const R0 = 4;
const R1 = 35;
const ROOF_LAYERS = 24;
/** Верх трубы в вокселях модели — отсюда идёт дым. */
export const CHIMNEY_TOP = 50;

function windowZ(m: ModelBuilder, x0: number, z: number): void {
	m.box([x0 - 1, 6, z], [x0 + 5, 12, z], 'trim');
	m.box([x0, 7, z], [x0 + 4, 11, z], 'glow');
	m.box([x0 + 2, 7, z], [x0 + 2, 11, z], 'trim');
	m.box([x0, 9, z], [x0 + 4, 9, z], 'trim');
	m.box([x0, 13, z], [x0 + 4, 13, z], 'trim');
	m.set([x0 + 2, 14, z], 'shutter');
}

function windowX(m: ModelBuilder, x: number, z0: number): void {
	m.box([x, 6, z0 - 1], [x, 12, z0 + 5], 'trim');
	m.box([x, 7, z0], [x, 11, z0 + 4], 'glow');
	m.box([x, 7, z0 + 2], [x, 11, z0 + 2], 'trim');
	m.box([x, 9, z0], [x, 9, z0 + 4], 'trim');
	m.box([x, 6, z0 - 3], [x, 12, z0 - 2], 'shutter');
	m.box([x, 6, z0 + 6], [x, 12, z0 + 7], 'shutter');
	m.set([x, 13, z0 + 2], 'shutter');
}

const body = model(
	{
		size: [S, 52, S],
		pivot: [C, 0, C],
		palette: {
			log: { color: '#80583a', vary: 0.1 },
			'log-d': { color: '#4a3120', vary: 0.08 },
			'log-end': { color: '#c9a068', vary: 0.08 },
			plank: { color: '#8f6c44', vary: 0.1 },
			trim: { color: '#f0e8d8', vary: 0.03 },
			shutter: { color: '#b8322a', vary: 0.05 },
			door: { color: '#5e2e24', vary: 0.06 },
			'door-d': '#3f1d17',
			gold: { color: '#e8b84a', emissive: 0.3 },
			glow: { color: '#ffc45a', emissive: 1.7, vary: 0 },
			'roof-d': { color: '#2e2a36', vary: 0.1 },
			roof: { color: '#50485a', vary: 0.12 },
			'roof-l': { color: '#857783', vary: 0.12 },
			moss: { color: '#6f9c3c', vary: 0.16 },
			stone: { color: '#85838a', vary: 0.12 },
			'stone-d': { color: '#5a5860', vary: 0.1 },
			bone: { color: '#ece5d2', vary: 0.03 },
			eye: { color: '#ff7a1a', emissive: 2.4, vary: 0 },
			flower: '#e8433a',
			leaf: { color: '#4f8f3a', vary: 0.12 },
		},
	},
	(m) => {
		// пол и венцы сруба с выпусками по углам
		m.box([W0 - 1, 0, W0 - 1], [W1 + 1, 0, W1 + 1], 'log-d');
		for (let y = 1; y < WALL_H; y++) {
			const gap = y % 3 === 0;
			m.box([W0, y, W0], [W1, y, W1], gap ? 'log-d' : 'log');
			if (gap) continue;
			const alongX = Math.floor(y / 3) % 2 === 0;
			for (const side of [W0, W1]) {
				for (const end of [W0 - 2, W0 - 1, W1 + 1, W1 + 2]) {
					const tip = end === W0 - 2 || end === W1 + 2;
					if (alongX) m.set([end, y, side], tip ? 'log-end' : 'log');
					else m.set([side, y, end], tip ? 'log-end' : 'log');
				}
			}
		}

		// крутая двускатная крыша: скорлупа из дранки, фронтоны из досок
		for (let j = 0; j < ROOF_LAYERS; j++) {
			const inset = Math.floor((j * 2) / 3);
			const y = WALL_H + j;
			const x0 = R0 + inset;
			const x1 = R1 - inset;
			for (let z = R0; z <= R1; z++) {
				for (let x = x0; x <= x1; x++) {
					const edge = x - x0 < 2 || x1 - x < 2 || j >= ROOF_LAYERS - 2;
					const inside = z >= W0 && z <= W1;
					if (edge) m.set([x, y, z], 'roof');
					else if (inside) m.set([x, y, z], z === W0 || z === W1 ? 'plank' : 'log-d');
				}
			}
		}
		m.shade([0, WALL_H, 0], [S - 1, 45, S - 1], ['roof-d', 'roof', 'roof-l'], {
			only: 'roof',
			scale: 4,
			speckle: 0.3,
			seed: 11,
		});
		for (let z = R0; z <= R1; z++) {
			for (let x = R0; x <= R1; x++) {
				for (let y = 45; y >= WALL_H; y--) {
					const here = m.get([x, y, z]);
					if (here === null) continue;
					const patch = hash(x >> 2, 7, z >> 2) < 0.38 || y < WALL_H + 3;
					if (here.startsWith('roof') && patch && hash(x, y, z) < 0.6) m.set([x, y, z], 'moss');
					break;
				}
			}
		}

		// охлупень: скрещённые доски над фронтонами
		for (const z of [R0, R1]) {
			m.line([16, 38, z], [23, 46, z], 'trim');
			m.line([23, 38, z], [16, 46, z], 'trim');
		}

		// кривая труба по оси избы — дым привязан к центру
		m.box([18, 36, 18], [21, 43, 21], 'stone');
		m.box([19, 44, 18], [22, 48, 21], 'stone');
		m.box([18, 49, 17], [23, CHIMNEY_TOP - 1, 22], 'stone-d');
		for (let y = 36; y < 49; y++) {
			for (let z = 18; z <= 21; z++) {
				for (let x = 18; x <= 22; x++) {
					if (m.get([x, y, z]) === 'stone' && hash(x, y, z) < 0.3) m.set([x, y, z], 'stone-d');
				}
			}
		}

		// фасад (+z): дверь, крыльцо, окна с наличниками, череп над дверью
		const f = W1 + 1;
		m.box([15, 1, f], [24, 13, f], 'trim');
		m.box([16, 1, f], [23, 12, f], 'door');
		m.box([18, 1, f], [18, 12, f], 'door-d');
		m.box([21, 1, f], [21, 12, f], 'door-d');
		m.box([16, 4, f], [23, 4, f], 'door-d');
		m.box([16, 9, f], [23, 9, f], 'door-d');
		m.set([22, 6, f + 1], 'gold');
		m.box([13, 0, f], [26, 0, f + 4], 'plank');
		m.box([14, 0, f + 5], [25, 0, f + 5], 'log-d');
		windowZ(m, 8, f);
		windowZ(m, 27, f);
		for (const x0 of [7, 26]) {
			m.box([x0, 5, f + 1], [x0 + 6, 5, f + 1], 'plank');
			for (let i = 0; i <= 6; i++) m.set([x0 + i, 6, f + 1], i % 2 === 0 ? 'flower' : 'leaf');
		}
		m.box([18, 15, f], [21, 16, f + 1], 'bone');
		m.box([19, 14, f], [20, 14, f + 1], 'bone');
		m.set([18, 15, f + 1], 'eye');
		m.set([21, 15, f + 1], 'eye');
		// слуховое окно во фронтоне и фонарь под свесом
		m.box([18, 24, f - 1], [21, 27, f - 1], 'trim');
		m.box([19, 25, f - 1], [20, 26, f - 1], 'glow');
		m.box([5, 17, f + 2], [5, 17, f + 2], 'log-d');
		m.box([5, 14, f + 2], [6, 16, f + 2], 'glow');
		m.box([5, 13, f + 2], [6, 13, f + 2], 'log-d');

		// бока и зад
		windowX(m, W0 - 1, 18);
		windowX(m, W1 + 1, 18);
		windowZ(m, 17, W0 - 1);
	},
);

const thigh = model(
	{
		size: [10, 13, 10],
		pivot: [5, 13, 5],
		palette: {
			'feather-d': { color: '#b07a26', vary: 0.1 },
			feather: { color: '#d9a744', vary: 0.1 },
			'feather-l': { color: '#f2d184', vary: 0.08 },
		},
	},
	(m) => {
		m.ellipsoid([5, 8, 5], [5, 5.5, 5], 'feather');
		m.box([4, 0, 4], [5, 3, 5], 'feather-d');
		for (let z = 0; z < 10; z++) {
			for (let y = 0; y < 13; y++) {
				for (let x = 0; x < 10; x++) {
					if (m.get([x, y, z]) !== 'feather') continue;
					const r = hash(x, y, z);
					if (y < 5 || r < 0.22) m.set([x, y, z], 'feather-d');
					else if (r > 0.72) m.set([x, y, z], 'feather-l');
				}
			}
		}
	},
);

const shin = model(
	{
		size: [4, 20, 4],
		pivot: [2, 20, 2],
		palette: { leg: { color: '#eaa52e', vary: 0.06 }, 'leg-d': { color: '#c47d1a', vary: 0.06 } },
	},
	(m) => {
		m.box([0, 17, 0], [3, 19, 3], 'leg-d');
		m.box([0, 0, 0], [3, 1, 3], 'leg-d');
		for (let y = 2; y < 17; y++) m.box([0, y, 0], [2, y, 2], y % 3 === 0 ? 'leg-d' : 'leg');
	},
);

const foot = model(
	{
		size: [17, 4, 20],
		pivot: [8.5, 4, 7],
		palette: {
			leg: { color: '#eaa52e', vary: 0.06 },
			'leg-d': { color: '#c47d1a', vary: 0.06 },
			claw: '#3a3436',
		},
	},
	(m) => {
		m.box([7, 0, 5], [9, 3, 8], 'leg-d');
		m.box([7, 0, 9], [9, 1, 16], 'leg');
		m.box([7, 0, 17], [9, 0, 17], 'claw');
		m.box([8, 0, 18], [8, 0, 19], 'claw');
		m.box([7, 0, 1], [9, 0, 4], 'leg');
		m.set([8, 0, 0], 'claw');
		for (const s of [-1, 1]) {
			for (let i = 0; i < 6; i++) {
				m.box([8 + s * (2 + i) - 1, 0, 9 + i], [8 + s * (2 + i) + 1, i < 4 ? 1 : 0, 10 + i], 'leg');
			}
			m.box([8 + s * 8, 0, 15], [8 + s * 8, 0, 16], 'claw');
		}
	},
);

const ladder = model(
	{
		size: [6, 12, 1],
		pivot: [3, 12, 0.5],
		palette: { rope: '#b79b6a', plank: '#8f6c44' },
	},
	(m) => {
		m.box([0, 0, 0], [0, 11, 0], 'rope');
		m.box([5, 0, 0], [5, 11, 0], 'rope');
		for (let y = 1; y < 12; y += 3) m.box([0, y, 0], [5, y, 0], 'plank');
	},
);

/** Длина полного шага (два толчка) в единицах мира — под размах ног, чтобы ступни не скользили. */
export const HUT_SCALE = 0.65;
export const STRIDE = 39.7 * HUT_SCALE;
const LEG_STRAIGHT = 37;

const thighA = (phi: number): number => -32 + 20 * Math.sin(phi);
const swing = (phi: number): number => Math.max(0, -Math.cos(phi));
const kneeA = (phi: number): number => 58 + 32 * swing(phi);
/** На сколько вокселей ступня ниже бедра при фазе phi. */
const drop = (phi: number): number => {
	const t = rad(thighA(phi));
	return 13 * Math.cos(t) + 20 * Math.cos(t + rad(kneeA(phi))) + 4;
};

export function hut(): Rig {
	return rig({
		skeleton: 'custom',
		scale: HUT_SCALE,
		stride: STRIDE,
		parts: {
			body: { model: body },
			thighL: { model: thigh, parent: 'body', at: [12, 0, C] },
			shinL: { model: shin, parent: 'thighL', at: [5, 0, 5] },
			footL: { model: foot, parent: 'shinL', at: [2, 0, 2] },
			thighR: { model: thigh, parent: 'body', at: [28, 0, C] },
			shinR: { model: shin, parent: 'thighR', at: [5, 0, 5] },
			footR: { model: foot, parent: 'shinR', at: [2, 0, 2] },
			ladder: { model: ladder, parent: 'body', at: [19.5, 0, W1 + 5] },
		},
	});
}

const leg = (offset: number) => ({
	thigh: ({ phase }: { phase: number }): [number, number, number] => [
		thighA(TAU * phase + offset),
		0,
		0,
	],
	shin: ({ phase }: { phase: number }): [number, number, number] => [
		kneeA(TAU * phase + offset),
		0,
		0,
	],
	foot: ({ phase }: { phase: number }): [number, number, number] => {
		const phi = TAU * phase + offset;
		return [-(thighA(phi) + kneeA(phi)) + 24 * swing(phi), 0, 0];
	},
});

const L = leg(0);
const R = leg(Math.PI);

/** Походка избы: ставится после поведения движения (orbit / walkPath). */
export const hutWalk: Behaviour[] = [
	custom((pose) => {
		const phi = TAU * (pose.stride / pose.strideLength);
		const low = Math.max(drop(phi), drop(phi + Math.PI));
		pose.position[1] -= (LEG_STRAIGHT - low) * HUT_SCALE;
	}),
	limbs({
		body: ({ phase }) => [1.5 * Math.sin(2 * TAU * phase), 0, 2.5 * Math.sin(TAU * phase)],
		thighL: L.thigh,
		shinL: L.shin,
		footL: L.foot,
		thighR: R.thigh,
		shinR: R.shin,
		footR: R.foot,
		ladder: ({ t }) => [12 * Math.sin(t * 2.1), 0, 6 * Math.sin(t * 1.3)],
	}),
];

// --- Баба-яга в ступе ---
const mortar = model(
	{
		size: [10, 10, 10],
		pivot: [5, 0, 5],
		palette: {
			wood: { color: '#7a5a3c', vary: 0.1 },
			'wood-d': { color: '#523a26', vary: 0.08 },
			iron: '#2f3036',
		},
	},
	(m) => {
		m.cylinder([5, 0, 5], 3.2, 2, 'wood-d');
		m.cylinder([5, 2, 5], 4, 6, 'wood');
		m.cylinder([5, 8, 5], 4.7, 2, 'wood');
		m.cylinder([5, 3, 5], 4.1, 1, 'iron');
		m.cylinder([5, 7, 5], 4.1, 1, 'iron');
		m.cylinder([5, 9, 5], 3.2, 1, 'air');
		for (let y = 2; y < 8; y++) {
			for (let i = 0; i < 10; i++) {
				for (let k = 0; k < 10; k++) {
					if (m.get([i, y, k]) === 'wood' && (i + k) % 3 === 0) m.set([i, y, k], 'wood-d');
				}
			}
		}
	},
);

const witch = model(
	{
		size: [7, 12, 9],
		pivot: [3.5, 0, 3.5],
		palette: {
			dress: { color: '#4b2f52', vary: 0.08 },
			shawl: { color: '#2f6d62', vary: 0.08 },
			skin: '#b9c48a',
			'skin-d': '#8fa064',
			scarf: { color: '#c8322c', vary: 0.05 },
			dot: '#f5e9c8',
			hair: '#d8d8d2',
			eye: { color: '#ffe14a', emissive: 1.5 },
		},
	},
	(m) => {
		m.box([1, 0, 2], [5, 4, 5], 'dress');
		m.box([0, 3, 1], [6, 5, 6], 'shawl');
		m.box([1, 6, 2], [5, 9, 6], 'skin');
		m.box([0, 9, 1], [6, 10, 6], 'scarf');
		m.box([0, 6, 1], [6, 8, 3], 'scarf');
		m.box([2, 11, 3], [4, 11, 4], 'scarf');
		m.set([1, 10, 6], 'dot');
		m.set([4, 10, 6], 'dot');
		m.set([6, 9, 3], 'dot');
		m.set([0, 9, 4], 'dot');
		m.set([1, 8, 6], 'hair');
		m.set([5, 8, 6], 'hair');
		m.set([2, 8, 6], 'eye');
		m.set([4, 8, 6], 'eye');
		m.box([3, 7, 7], [3, 7, 8], 'skin-d');
		m.set([3, 6, 7], 'skin-d');
	},
);

const broom = model(
	{
		size: [3, 5, 24],
		pivot: [1.5, 2.5, 16],
		palette: { stick: '#8a6a40', straw: { color: '#d8b45a', vary: 0.14 }, tie: '#b8322a' },
	},
	(m) => {
		m.box([1, 2, 6], [1, 2, 23], 'stick');
		m.box([0, 1, 0], [2, 3, 4], 'straw');
		m.box([0, 0, 0], [2, 4, 1], 'straw');
		m.box([0, 1, 5], [2, 3, 5], 'tie');
	},
);

export function yaga(): Rig {
	return rig({
		skeleton: 'custom',
		scale: 0.5,
		parts: {
			mortar: { model: mortar },
			witch: { model: witch, parent: 'mortar', at: [5, 6, 5] },
			broom: { model: broom, parent: 'witch', at: [7.5, 4, 4] },
		},
	});
}

export const yagaFly: Behaviour[] = [
	custom((pose, t) => {
		pose.position[1] += 1.4 * Math.sin(t * 0.9);
		pose.rotation[2] += rad(-14);
		pose.rotation[0] += rad(6 * Math.sin(t * 1.7));
	}),
	limbs({
		witch: ({ t }) => [0, 10 * Math.sin(t * 0.8), 0],
		broom: ({ t }) => [-18, 28 * Math.sin(t * 3.2), 0],
	}),
];
