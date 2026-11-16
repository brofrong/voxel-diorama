import {
	type Behaviour,
	limbs,
	type MaterialInput,
	type Model,
	type ModelBuilder,
	model,
	type Rig,
	rig,
} from '#sdk';
import { swirl } from './fx.ts';

const TAU = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);

type Palette = Record<string, MaterialInput>;

const BRASS: Palette = {
	brass: { color: '#c89b3c', vary: 0.06 },
	'brass-d': { color: '#8a6424', vary: 0.06 },
	'brass-l': { color: '#f2cf6e', emissive: 0.2, vary: 0.03 },
};

/** Воксель механизма — половина вокселя мира. */
export const MECH_SCALE = 0.5;
/** Высота плоскости орбит над низом колонны, воксели механизма. */
const PLANE = 40;
const HUB_H = 32;
/** Самый длинный цельный отрезок балки, воксели. */
const SEG = 46;

const hub = model({ size: [9, HUB_H, 9], pivot: [4.5, 0, 4.5], palette: BRASS }, (m) => {
	m.cylinder([4, 0, 4], 2.5, HUB_H, 'brass');
	for (const y of [0, 1, 7, 12, 17, 22, 26]) m.cylinder([4, y, 4], 3.5, 1, 'brass-d');
	m.cylinder([4, 27, 4], 4.4, 1, 'brass-l');
	for (let y = 2; y < 26; y++) {
		if (y % 5 === 2) continue;
		m.set([4, y, 6], 'brass-l');
		m.set([4, y, 2], 'brass-l');
	}
});

/** Стрела: муфта на колонне, балка вдоль +x длиной `beam` вокселей и противовес. */
function arm(beam: number): Model {
	return model({ size: [9 + beam, 3, 9], pivot: [8.5, 0, 4.5], palette: BRASS }, (m) => {
		m.box([2, 0, 3], [8 + beam, 1, 5], 'brass');
		m.box([9, 1, 4], [8 + beam, 1, 4], 'brass-l');
		m.box([0, 0, 2], [3, 2, 6], 'brass-d');
		m.box([1, 0, 1], [2, 2, 7], 'brass-d');
		m.cylinder([8, 0, 4], 4.2, 3, 'brass-d');
		m.cylinder([8, 2, 4], 3.2, 1, 'brass-l');
		for (let x = 14; x < 8 + beam - 2; x += 6) m.box([x, 0, 3], [x, 1, 5], 'brass-d');
	});
}

/** Продолжение длинной балки. */
function ext(length: number): Model {
	return model({ size: [length, 2, 3], pivot: [0, 0, 1.5], palette: BRASS }, (m) => {
		m.box([0, 0, 0], [length - 1, 1, 2], 'brass');
		m.box([0, 1, 1], [length - 1, 1, 1], 'brass-l');
		for (let x = 2; x < length - 2; x += 6) m.box([x, 0, 0], [x, 1, 2], 'brass-d');
	});
}

/** Стойка под планету. */
function post(height: number): Model {
	return model({ size: [3, height, 3], pivot: [1.5, 0, 1.5], palette: BRASS }, (m) => {
		m.box([1, 0, 1], [1, height - 1, 1], 'brass');
		m.box([0, 0, 0], [2, 1, 2], 'brass-d');
		for (let y = 6; y < height - 3; y += 6) m.box([0, y, 0], [2, y, 2], 'brass-d');
		m.box([0, height - 3, 0], [2, height - 3, 2], 'brass-l');
	});
}

type Paint = (dx: number, dy: number, dz: number, d: number) => string;

function globe(
	r: number,
	palette: Palette,
	paint: Paint,
	options: { pad?: number; extra?: (m: ModelBuilder, c: number) => void } = {},
): Model {
	const c = Math.ceil(r) + (options.pad ?? 0);
	const n = 2 * c + 1;
	return model({ size: [n, n, n], pivot: [n / 2, n / 2, n / 2], palette }, (m) => {
		for (let z = 0; z < n; z++) {
			for (let y = 0; y < n; y++) {
				for (let x = 0; x < n; x++) {
					const d = Math.hypot(x - c, y - c, z - c);
					if (d <= r) m.set([x, y, z], paint(x - c, y - c, z - c, d));
				}
			}
		}
		options.extra?.(m, c);
	});
}

const sun = globe(
	11.2,
	{
		core: { color: '#fff6c4', emissive: 1.5, vary: 0 },
		sun: { color: '#ffc63a', emissive: 1.2, vary: 0.05 },
		spot: { color: '#ff8a1e', emissive: 0.95, vary: 0.08 },
	},
	(x, y, z) => {
		const s = swirl(x, y, z, 1.7);
		return s > 1.1 ? 'core' : s < -1.2 ? 'spot' : 'sun';
	},
);

const ember = globe(
	3.6,
	{
		ember: { color: '#9c3424', vary: 0.12 },
		ash: { color: '#4f2420', vary: 0.1 },
		lava: { color: '#ff8a2a', emissive: 1.5, vary: 0.05 },
	},
	(x, y, z) => {
		const s = swirl(x * 1.6, y * 1.6, z * 1.6, 4.2);
		return s > 0.9 ? 'lava' : s < -0.9 ? 'ash' : 'ember';
	},
);

const ocean = globe(
	7,
	{
		sea: { color: '#1f7fb0', emissive: 0.18, vary: 0.06 },
		'sea-l': { color: '#3fb3cf', emissive: 0.18, vary: 0.06 },
		land: { color: '#4fb86a', emissive: 0.18, vary: 0.12 },
		sand: { color: '#d9c98a', vary: 0.08 },
		ice: { color: '#f2f8ff', vary: 0.03 },
	},
	(x, y, z) => {
		if (Math.abs(y) > 5.3) return 'ice';
		const s = swirl(x * 1.1, y * 1.1, z * 1.1, 2.6);
		return s > 1.1 ? 'land' : s > 0.75 ? 'sand' : s > 0.1 ? 'sea-l' : 'sea';
	},
);

const moon = model(
	{
		size: [13, 5, 5],
		pivot: [0, 2.5, 2.5],
		palette: {
			rod: '#8a6424',
			moon: { color: '#d9dbe6', vary: 0.08 },
			crater: { color: '#9a9db0', vary: 0.06 },
		},
	},
	(m) => {
		m.box([0, 2, 2], [9, 2, 2], 'rod');
		m.sphere([10, 2, 2], 2.2, 'moon');
		m.set([11, 3, 3], 'crater');
		m.set([9, 1, 3], 'crater');
		m.set([10, 4, 2], 'crater');
	},
);

const ringed = globe(
	5.5,
	{
		cream: { color: '#ecd3a6', emissive: 0.15, vary: 0.05 },
		tan: { color: '#d19c64', emissive: 0.15, vary: 0.06 },
		rust: { color: '#b8703f', emissive: 0.15, vary: 0.06 },
		ring: { color: '#f4e6b8', emissive: 0.15, vary: 0.05 },
		'ring-d': { color: '#b99664', vary: 0.08 },
	},
	(_x, y) => (y === 0 || y === -3 ? 'rust' : y % 2 === 0 ? 'tan' : 'cream'),
	{
		pad: 6,
		extra: (m, c) => {
			for (let dz = -c; dz <= c; dz++) {
				for (let dx = -c; dx <= c; dx++) {
					const rr = Math.hypot(dx, dz);
					if (rr < 7.4 || rr > 11.3 || (rr > 9.2 && rr < 9.9)) continue;
					// внутренний край кольца (к колонне, −x) поднят — не задевает соседнюю луну
					m.set([c + dx, c + Math.round(-0.32 * dx), c + dz], rr < 9.2 ? 'ring' : 'ring-d');
				}
			}
		},
	},
);

const giant = globe(
	9.6,
	{
		v1: { color: '#4f3d9c', emissive: 0.2, vary: 0.05 },
		v2: { color: '#7458c9', emissive: 0.2, vary: 0.05 },
		v3: { color: '#a98be8', emissive: 0.2, vary: 0.05 },
		v4: { color: '#e0c4f7', emissive: 0.2, vary: 0.04 },
		storm: { color: '#ffb0d8', emissive: 0.5, vary: 0.05 },
	},
	(x, y, z) => {
		if (x > 5.5 && Math.abs(y + 2) < 2.5 && Math.abs(z) < 3.5) return 'storm';
		const band = Math.floor((y + 10 + 0.8 * Math.sin(Math.atan2(z, x) * 3 + y)) / 2);
		return ['v1', 'v2', 'v3', 'v2', 'v4', 'v3', 'v1', 'v2', 'v3'][((band % 9) + 9) % 9];
	},
);

/** Обруч армиллярной сферы в плоскости XY. */
function hoop(r: number): Model {
	const c = Math.ceil(r);
	const n = 2 * c + 1;
	return model({ size: [n, n, 1], pivot: [n / 2, n / 2, 0.5], palette: BRASS }, (m) => {
		for (let y = 0; y < n; y++) {
			for (let x = 0; x < n; x++) {
				const d = Math.hypot(x - c, y - c);
				if (d > r || d < r - 1.3) continue;
				const tick = fract((Math.atan2(y - c, x - c) / TAU) * 12 + 0.5) < 0.18;
				m.set([x, y, 0], tick ? 'brass-l' : 'brass');
			}
		}
	});
}

/** Горизонтальная шестерня на колонне (ось вращения y), pivot в центре. */
function cog(radius: number, teeth: number): Model {
	const n = 2 * radius + 1;
	return model({ size: [n, 2, n], pivot: [n / 2, 0, n / 2], palette: BRASS }, (m) => {
		for (let z = 0; z < n; z++) {
			for (let x = 0; x < n; x++) {
				const d = Math.hypot(x - radius, z - radius);
				if (d > radius + 0.3) continue;
				const turn = Math.atan2(z - radius, x - radius) / TAU + 1;
				if (d > radius - 1.7 && fract(turn * teeth) >= 0.5) continue;
				if (d > radius - 3.4) {
					m.box([x, 0, z], [x, 1, z], d > radius - 1.7 ? 'brass' : 'brass-d');
				} else if (fract(turn * 6) < 0.3 || d < 4.6) {
					m.set([x, 0, z], d < 4.6 ? 'brass-l' : 'brass');
				}
			}
		}
	});
}

/** Радиусы орбит в вокселях механизма (× MECH_SCALE = единицы мира). */
export const ORBITS = [19, 34, 53, 75] as const;

interface PlanetSpec {
	name: string;
	globe: Model;
	radius: number;
	orbit: number;
	/** Высота муфты на колонне. */
	collar: number;
	/** Смещение центра планеты от плоскости орбит. */
	lift: number;
}

const PLANETS: PlanetSpec[] = [
	{ name: 'ember', globe: ember, radius: 3, orbit: ORBITS[0], collar: 19, lift: 0 },
	{ name: 'ocean', globe: ocean, radius: 7, orbit: ORBITS[1], collar: 14, lift: 4 },
	{ name: 'ringed', globe: ringed, radius: 5, orbit: ORBITS[2], collar: 9, lift: 6 },
	{ name: 'giant', globe: giant, radius: 9, orbit: ORBITS[3], collar: 4, lift: -4 },
];

function buildOrrery(): Rig {
	const parts: Record<string, { model: Model; parent?: string; at?: [number, number, number] }> = {
		hub: { model: hub },
		sun: { model: sun, parent: 'hub', at: [4.5, PLANE, 4.5] },
		hoopA: { model: hoop(14.4), parent: 'hub', at: [4.5, PLANE, 4.5] },
		hoopB: { model: hoop(13), parent: 'hub', at: [4.5, PLANE, 4.5] },
		cogA: { model: cog(11, 14), parent: 'hub', at: [4.5, 1, 4.5] },
		cogB: { model: cog(7, 9), parent: 'hub', at: [4.5, 23, 4.5] },
	};
	PLANETS.forEach((p, i) => {
		const k = i + 1;
		const center = PLANE + p.lift - p.collar - 2;
		const height = center - p.radius + 1;
		const long = p.orbit + 1 > SEG;
		parts[`arm${k}`] = {
			model: arm(long ? SEG : p.orbit + 1),
			parent: 'hub',
			at: [4.5, p.collar, 4.5],
		};
		if (long) {
			parts[`ext${k}`] = {
				model: ext(p.orbit - SEG + 1),
				parent: `arm${k}`,
				at: [9 + SEG, 0, 4.5],
			};
			parts[`post${k}`] = {
				model: post(height),
				parent: `ext${k}`,
				at: [p.orbit - SEG - 0.5, 2, 1.5],
			};
		} else {
			parts[`post${k}`] = {
				model: post(height),
				parent: `arm${k}`,
				at: [8.5 + p.orbit, 2, 4.5],
			};
		}
		parts[p.name] = { model: p.globe, parent: `post${k}`, at: [1.5, center, 1.5] };
	});
	parts.moon = { model: moon, parent: 'ocean', at: [7.5, 7.5, 7.5] };
	return rig({ skeleton: 'custom', scale: MECH_SCALE, parts });
}

export const orrery: Rig = buildOrrery();

/** Ход механизма: [стартовый угол, град/с] для каждой стрелы. */
const DRIVE: readonly (readonly [number, number])[] = [
	[282, 36],
	[197.5, 22.5],
	[171.3, 12.9],
	[311, 8],
];

export const orreryMotion: Behaviour = limbs({
	parts: {
		arm1: ({ t }) => [0, DRIVE[0][0] + DRIVE[0][1] * t, 0],
		arm2: ({ t }) => [0, DRIVE[1][0] + DRIVE[1][1] * t, 0],
		arm3: ({ t }) => [0, DRIVE[2][0] + DRIVE[2][1] * t, 0],
		arm4: ({ t }) => [0, DRIVE[3][0] + DRIVE[3][1] * t, 0],
		sun: ({ t }) => [0, 9 * t, 0],
		ember: ({ t }) => [0, 70 * t, 0],
		ocean: ({ t }) => [0, 45 * t, 0],
		giant: ({ t }) => [0, 24 * t, 0],
		hoopA: ({ t }) => [0, 28 * t, 0],
		cogA: ({ t }) => [0, 18 * t, 0],
		cogB: ({ t }) => [0, -28 * t, 0],
		hoopB: ({ t }) => [62, -21 * t, 0],
	},
	replace: true,
});

/** Шестерня в плоскости XY (ось вращения z), pivot в центре. */
export function gear(radius: number, teeth: number, spokes = 4): Model {
	const n = 2 * radius + 1;
	return model({ size: [n, n, 2], pivot: [n / 2, n / 2, 1], palette: BRASS }, (m) => {
		for (let y = 0; y < n; y++) {
			for (let x = 0; x < n; x++) {
				const dx = x - radius;
				const dy = y - radius;
				const d = Math.hypot(dx, dy);
				if (d > radius + 0.3) continue;
				const turn = Math.atan2(dy, dx) / TAU + 1;
				if (d > radius - 1.7 && fract(turn * teeth) >= 0.5) continue;
				if (d < 2.2) {
					m.box([x, y, 0], [x, y, 1], 'brass-l');
				} else if (d > radius - 3.6) {
					m.box([x, y, 0], [x, y, 1], d > radius - 1.7 ? 'brass' : 'brass-d');
				} else {
					const off = Math.abs(fract(turn * spokes + 0.5) - 0.5) * (TAU / spokes) * d;
					if (off < 1.1) m.set([x, y, 0], 'brass');
				}
			}
		}
	});
}
