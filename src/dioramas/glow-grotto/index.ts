import {
	bob,
	custom,
	defineDiorama,
	fireflies,
	mist,
	model,
	orbit,
	pointLight,
	pour,
	prefabs,
	walkPath,
} from '#sdk';

/*
 * Светящийся грот — скальный массив, срезанный по диагонали, как геологический разрез.
 *
 * Оси: u = (x + z − C) / √2 — «к зрителю» (u < 0 — в скале, u > 0 — терраса перед срезом),
 * v = (x − z) / √2 — вдоль среза. Камера смотрит с угла +x+z, то есть прямо в срез.
 * Внутри — грот-купол с подземной речкой: она выходит из тёмного тоннеля в глубине, проходит
 * под провалом в своде (сверху с холма в провал падает ручей) и вытекает на террасу.
 * Со свода — сталактиты и соломинки, снизу — сталагмиты, три колонны; на срезе читаются
 * слои пород с кварцевой и пиритовой жилами.
 */

const SX = 96;
const SY = 60;
const SZ = 96;
const C = 118; // срез: x + z = C
const S2 = Math.SQRT1_2;
const FLOOR = 10; // верхний твёрдый воксель пола грота
const TERRACE = 9; // верхний твёрдый воксель террасы
const HILL = 42; // базовая высота холма над гротом
const STREAM_Y = 40; // дно ручья на холме

type XZ = [number, number];
type XYZ = [number, number, number];

const toUV = (x: number, z: number): [number, number] => [(x + z - C) * S2, (x - z) * S2];
const toXZ = (v: number, u: number): XZ => [C / 2 + (u + v) * S2, C / 2 + (u - v) * S2];
const toXZi = (v: number, u: number): XZ => {
	const [x, z] = toXZ(v, u);
	return [Math.round(x), Math.round(z)];
};
const fract = (n: number): number => n - Math.floor(n);
/** Детерминированный хеш для поз сущностей (внутри custom нельзя трогать rng). */
const hash = (i: number, k: number): number =>
	fract(Math.sin(i * 12.9898 + k * 78.233 + 0.5) * 43758.5453);

/** Русло речки: v как функция глубины u. */
const riverV = (u: number): number => 8 * Math.sin((u + 12) * 0.075) + 3;
/** Купол грота: m < 1 — внутри эллипса в плане. */
const domeM = (v: number, u: number): number => (v / 38) ** 2 + ((u + 8) / 20) ** 2;
const CEIL_BASE = 11;
const CEIL_RISE = 24;
const ceilOf = (m: number): number => CEIL_BASE + CEIL_RISE * Math.sqrt(Math.max(0, 1 - m));

const SKY_U = -14;
const SKY_V = riverV(SKY_U);
const [SKY_X, SKY_Z] = toXZ(SKY_V, SKY_U);
const SKY_R = 4; // радиус провала в своде
const POOL_R = 5.5; // чаша под провалом
const OUT_POOL_U = 40;
const OUT_POOL_V = riverV(OUT_POOL_U);
const OUT_POOL_R = 8;
const TUNNEL_U0 = -28;
const TUNNEL_U1 = -56;

const CENTER = toXZ(0, -9);

/** Берег речки: точка на высоте пола, side — слева/справа от русла. */
const bank = (u: number, side: 1 | -1, y: number, off = 3.6): XYZ => {
	const [x, z] = toXZ(riverV(u) + side * off, u);
	return [x, y, z];
};
const steps = (from: number, to: number, step: number): number[] => {
	const out: number[] = [];
	for (let u = from; step > 0 ? u <= to : u >= to; u += step) out.push(u);
	return out;
};
const BANK_LEFT = steps(-24, -2, 3.5).map((u) => bank(u, -1, FLOOR + 1));
const BANK_RIGHT = steps(-22, -3, 3.5).map((u) => bank(u, 1, FLOOR + 1));
const BANK_OUT = steps(4, 30, 3.5).map((u) => bank(u, -1, TERRACE + 1));

/** Жук со светящимся брюшком: голова в +z. */
const beetle = (glow: string) =>
	model(
		{
			size: [5, 3, 7],
			scale: 0.35,
			palette: {
				shell: '#1d2430',
				'shell-light': '#2d3a4c',
				legs: '#0b0d12',
				eye: '#9ad7ff',
				glow: { color: glow, emissive: 2.8 },
			},
		},
		(m) => {
			m.box([1, 0, 1], [3, 0, 5], 'shell');
			m.box([0, 1, 1], [4, 1, 5], 'shell');
			m.box([1, 2, 2], [3, 2, 5], 'shell-light');
			m.box([2, 2, 2], [2, 2, 5], 'shell');
			m.box([1, 1, 0], [3, 1, 0], 'glow'); // фонарик на брюшке
			m.box([1, 0, 0], [3, 0, 0], 'glow');
			m.box([1, 1, 6], [3, 1, 6], 'shell-light'); // голова
			m.set([1, 2, 6], 'eye');
			m.set([3, 2, 6], 'eye');
			for (const z of [1, 3, 5]) {
				m.set([0, 0, z], 'legs');
				m.set([4, 0, z], 'legs');
			}
		},
	);

/** Светящаяся мошка — одна точка. */
const mote = (color: string) =>
	model(
		{
			size: [1, 1, 1],
			scale: 0.3,
			pivot: [0.5, 0.5, 0.5],
			palette: { glow: { color, emissive: 3 } },
		},
		(m) => m.set([0, 0, 0], 'glow'),
	);

/** Рой мошек: ленивые петли Лиссажу внутри купола, параметры — от номера экземпляра. */
const swarm = custom((pose, t, ctx) => {
	const i = ctx.index;
	const v0 = -24 + 48 * hash(i, 0);
	const u0 = -22 + 18 * hash(i, 1);
	const y0 = 12.5 + 4 * hash(i, 2);
	const av = 2 + 4 * hash(i, 3);
	const au = 2 + 3 * hash(i, 4);
	const fv = 0.08 + 0.12 * hash(i, 5);
	const fu = 0.07 + 0.1 * hash(i, 6);
	const fy = 0.15 + 0.2 * hash(i, 7);
	const p = hash(i, 8) * Math.PI * 2;
	const v = v0 + av * Math.sin(2 * Math.PI * fv * t + p);
	const u = u0 + au * Math.sin(2 * Math.PI * fu * t + p * 1.7);
	const [x, z] = toXZ(v, u);
	pose.position[0] = x;
	pose.position[1] = y0 + 1.2 * Math.sin(2 * Math.PI * fy * t + p * 0.6);
	pose.position[2] = z;
	pose.gait = 'fly';
});

export default defineDiorama({
	meta: {
		title: 'Светящийся грот',
		createdAt: '2026-10-08',
		author: { model: 'Claude Fable 5.1', effort: 'low', context: '1M' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'Разрез скального массива: грот с подземной речкой, сталактиты и сталагмиты, слои пород на срезе. Светят флюорит, аметист, грибы, светлячки и жуки, под сводом кружат летучие мыши.',
		tags: ['пещера', 'речка', 'сталактиты', 'кристаллы', 'светлячки', 'ночь'],
	},
	seed: 177033388,
	size: [SX, SY, SZ],
	palette: {
		// породы (снизу вверх)
		basalt: '#2c3038',
		granite: '#7f6f73',
		'granite-light': '#968689',
		quartz: '#ebe5f0',
		pyrite: '#dcb64e',
		limestone: '#c3b28c',
		'limestone-dark': '#aa9a76',
		sandstone: '#c48b5a',
		'sandstone-dark': '#a66f48',
		shale: '#4b535f',
		slate: '#3b434e',
		soil: '#55412f',
		moss: '#4b7a38',
		'moss-dark': '#3d6630',
		'moss-wet': '#4f7f50',
		gravel: '#737068',
		riverbed: '#232a33',
		water: { color: '#2a8aa6', emissive: 0.15, kind: 'water' },
		// натёки
		calcite: '#e6ddc4',
		'calcite-wet': '#cbbd9e',
		'calcite-orange': '#d8a872',
		// свет
		'crystal-blue': { color: '#6ad8ff', emissive: 1.8 },
		'crystal-blue-dark': { color: '#2f9fd8', emissive: 0.8 },
		amethyst: { color: '#b58cff', emissive: 1.4 },
		'amethyst-dark': { color: '#7b4fd1', emissive: 0.5 },
		geode: '#5a5560',
		sunstone: { color: '#ffb45e', emissive: 1.6 },
		'sunstone-dark': { color: '#c97a32', emissive: 0.6 },
		'mushroom-cap': { color: '#8af0b0', emissive: 0.9 },
		'mushroom-stem': '#d4e8d6',
		glowworm: { color: '#b9ffe3', emissive: 2.2 },
		// префабы
		stone: '#5e5b57',
		'stone-dark': '#46433f',
		needles: '#2a5a36',
		trunk: '#4a3220',
	},
	build(w) {
		const { rng, noise } = w;
		const ceilMap = new Float32Array(SX * SZ).fill(-1);
		const ceilAt = (x: number, z: number): number => ceilMap[x + z * SX];

		const strata = (x: number, y: number, z: number, v: number, u: number): string => {
			// наклон слоёв вдоль среза и в глубину + мягкая складка
			const yy = y + 0.1 * v + 0.06 * u + 3 * (noise.fbm(v * 0.05 + 5, y * 0.05, 3) - 0.5);
			if (Math.abs(yy - (20 + 3 * Math.sin(v * 0.15))) < 0.6) return 'quartz';
			if (Math.abs(yy - 0.55 * v - 31) < 0.55) return 'pyrite';
			if (yy < 7) return 'basalt';
			if (yy < 14) {
				const f = noise.value(x * 0.9, z * 0.9 + y * 0.37);
				if (f > 0.9) return 'quartz';
				if (f > 0.78) return 'granite-light';
				return 'granite';
			}
			if (yy < 22)
				return noise.value(x * 0.3, z * 0.3 + y * 0.5) > 0.62 ? 'limestone-dark' : 'limestone';
			if (yy < 29) return Math.floor(yy / 2) % 2 === 0 ? 'sandstone' : 'sandstone-dark';
			if (yy < 36) return noise.value(x * 1.1, z * 1.1 + y) > 0.94 ? 'pyrite' : 'shale';
			return 'slate';
		};

		for (let x = 0; x < SX; x++) {
			for (let z = 0; z < SZ; z++) {
				const [u, v] = toUV(x, z);
				const dv = v - riverV(u);
				const adv = Math.abs(dv);
				const m = domeM(v, u) + 0.3 * (noise.fbm(v * 0.06 + 11, u * 0.06, 3) - 0.5);
				const inDome = m < 1;
				const ceil = inDome ? ceilOf(m) + Math.round(2 * noise.value(v * 0.2, u * 0.2) - 1) : -1;
				ceilMap[x + z * SX] = ceil;
				const dSky = Math.hypot(v - SKY_V, u - SKY_U);
				const dOutPool = Math.hypot(v - OUT_POOL_V, u - OUT_POOL_U);
				const hill = HILL + Math.round(noise.fbm(x * 0.05, z * 0.05) * 4);
				const bn = noise.fbm(x * 0.2 + 3, z * 0.2);
				const bump = bn > 0.74 ? 2 : bn > 0.58 ? 1 : 0;
				const topStream = u > -78 && u < SKY_U && Math.abs(v - SKY_V - 2 * Math.sin(u * 0.2)) < 1.4;
				for (let y = 0; y < SY; y++) {
					const wobble = 1.3 * (noise.value(v * 0.09 + 3, y * 0.09) - 0.5) * 2;
					const massif = u < wobble;
					let top: number;
					if (massif) top = topStream ? STREAM_Y : hill;
					else top = TERRACE + (adv > 6 ? bump : 0);
					if (y > top) {
						if (massif && topStream && y === STREAM_Y + 1) w.set([x, y, z], 'water');
						continue;
					}
					// провал в своде и чаша под ним
					if (dSky < SKY_R + 0.8 * noise.value(v * 0.3, u * 0.3)) {
						if (y >= 7) w.set([x, y, z], y <= 9 ? 'water' : 'air');
						else w.set([x, y, z], y === 6 ? 'riverbed' : strata(x, y, z, v, u));
						continue;
					}
					if (massif && dSky < POOL_R) {
						if (y === 6) w.set([x, y, z], 'riverbed');
						else if (y >= 7 && y <= 9) w.set([x, y, z], 'water');
						else if (y > 9) continue;
						else w.set([x, y, z], strata(x, y, z, v, u));
						continue;
					}
					// русло
					if (massif && adv < 2.2 && u > TUNNEL_U1 + 2) {
						if (y === 7) w.set([x, y, z], 'riverbed');
						else if (y === 8 || y === 9) w.set([x, y, z], 'water');
						else if (y > 9) continue;
						else w.set([x, y, z], strata(x, y, z, v, u));
						continue;
					}
					if (!massif) {
						const inOutPool = dOutPool < OUT_POOL_R + noise.value(v * 0.3, u * 0.3);
						if (inOutPool) {
							if (y === 5) w.set([x, y, z], 'riverbed');
							else if (y >= 6 && y <= 8) w.set([x, y, z], 'water');
							else if (y > 8) continue;
							else w.set([x, y, z], strata(x, y, z, v, u));
							continue;
						}
						if (adv < 2.5) {
							if (y === 6) w.set([x, y, z], 'riverbed');
							else if (y === 7 || y === 8) w.set([x, y, z], 'water');
							else if (y > 8) continue;
							else w.set([x, y, z], strata(x, y, z, v, u));
							continue;
						}
						if (y === top) {
							w.set(
								[x, y, z],
								adv < 4.5 ? 'gravel' : noise.value(x * 0.4, z * 0.4) > 0.55 ? 'moss-wet' : 'gravel',
							);
						} else w.set([x, y, z], strata(x, y, z, v, u));
						continue;
					}
					// купол грота
					if (inDome && y > FLOOR && y <= ceil) {
						if (adv > 5.5 && y === FLOOR + 1 && noise.fbm(x * 0.25, z * 0.25) > 0.62) {
							w.set([x, y, z], 'limestone-dark');
						}
						continue;
					}
					// тоннель в глубину
					if (u < TUNNEL_U0 && u > TUNNEL_U1) {
						const taper = 1 - 0.35 * ((TUNNEL_U0 - u) / (TUNNEL_U0 - TUNNEL_U1));
						if (y > FLOOR && (dv / (5 * taper)) ** 2 + ((y - 13) / (6.5 * taper)) ** 2 < 1)
							continue;
					}
					// поверхность холма
					if (y === top) {
						w.set(
							[x, y, z],
							topStream ? 'gravel' : noise.value(x * 0.3, z * 0.3) > 0.5 ? 'moss' : 'moss-dark',
						);
						continue;
					}
					if (y >= top - 2 && !topStream) {
						w.set([x, y, z], 'soil');
						continue;
					}
					// натёки по своду и стенам грота
					if (inDome && y > ceil && y <= ceil + 3 && noise.value(v * 0.15 + 7, u * 0.15) > 0.55) {
						w.set([x, y, z], y === ceil + 1 ? 'calcite' : 'calcite-wet');
						continue;
					}
					if (m >= 1 && m < 1.12 && y > FLOOR && noise.value(v * 0.2, u * 0.2 + 9) > 0.6) {
						w.set([x, y, z], 'calcite-wet');
						continue;
					}
					w.set([x, y, z], strata(x, y, z, v, u));
				}
			}
		}

		// --- сталактиты, соломинки, сталагмиты, колонны ---
		const tipMat = (h: number, len: number): string =>
			h > len * 0.7 ? 'calcite-wet' : h % 5 === 2 ? 'calcite-orange' : 'calcite';
		const stalactite = (x: number, z: number, len: number, r0: number): void => {
			const ceil = ceilAt(x, z);
			for (let h = 0; h < len; h++) {
				const r = Math.max(0.5, r0 * (1 - h / len) ** 0.75);
				w.cylinder([x, ceil - h, z], r, 1, tipMat(h, len));
			}
		};
		const stalagmite = (x: number, z: number, len: number, r0: number): void => {
			w.cylinder([x, FLOOR, z], r0 + 0.8, 1, 'calcite-wet');
			for (let h = 0; h < len; h++) {
				const r = Math.max(0.5, r0 * (1 - h / len) ** 0.65);
				w.cylinder([x, FLOOR + 1 + h, z], r, 1, tipMat(h, len));
			}
		};
		const domePoint = (uMin: number, uMax: number): [number, number, number] | null => {
			for (let tries = 0; tries < 40; tries++) {
				const v = rng.float(-36, 36);
				const u = rng.float(uMin, uMax);
				const [x, z] = toXZi(v, u);
				if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
				const ceil = ceilAt(x, z);
				if (ceil < 0) continue;
				if (Math.hypot(v - SKY_V, u - SKY_U) < SKY_R + 3) continue;
				return [x, z, ceil];
			}
			return null;
		};
		const drips: XYZ[] = [];
		for (let i = 0; i < 50; i++) {
			const p = domePoint(-28, 1);
			if (!p) continue;
			const [x, z, ceil] = p;
			if (ceil - FLOOR < 9) continue;
			const len = rng.int(3, Math.min(12, Math.floor((ceil - FLOOR) * 0.55)));
			const r0 = rng.float(1, 2.4);
			stalactite(x, z, len, r0);
			if (drips.length < 4 && len >= 6 && rng.chance(0.4))
				drips.push([x + 0.5, ceil - len, z + 0.5]);
		}
		for (let i = 0; i < 44; i++) {
			const p = domePoint(-27, 1);
			if (!p) continue;
			const [x, z, ceil] = p;
			if (ceil - FLOOR < 6) continue;
			const len = rng.int(2, 5);
			w.box([x, ceil - len + 1, z], [x, ceil, z], rng.chance(0.3) ? 'calcite-orange' : 'calcite');
		}
		let placedMites = 0;
		for (let tries = 0; tries < 200 && placedMites < 22; tries++) {
			const v = rng.float(-36, 36);
			const u = rng.float(-27, 2);
			if (Math.abs(v - riverV(u)) < 6) continue;
			if (Math.hypot(v - SKY_V, u - SKY_U) < POOL_R + 2) continue;
			const [x, z] = toXZi(v, u);
			if (x < 0 || z < 0 || x >= SX || z >= SZ) continue;
			const ceil = ceilAt(x, z);
			if (ceil - FLOOR < 7) continue;
			stalagmite(
				x,
				z,
				rng.int(3, Math.min(9, Math.floor((ceil - FLOOR) * 0.5))),
				rng.float(1.2, 2.2),
			);
			placedMites++;
		}
		for (const [v, u] of [
			[-19, -8],
			[17, -16],
			[-9, -22],
		] as const) {
			const [x, z] = toXZi(v, u);
			const ceil = ceilAt(x, z);
			if (ceil < 0) continue;
			const span = ceil - FLOOR;
			stalactite(x, z, Math.ceil(span * 0.55), 2.8);
			stalagmite(x, z, Math.ceil(span * 0.5) + 1, 2.6);
		}

		// --- кристаллы ---
		const cluster = (
			x: number,
			y: number,
			z: number,
			n: number,
			bright: string,
			dark: string,
			up = 1,
		): void => {
			for (let i = 0; i < n; i++) {
				const dx = rng.float(-1, 1);
				const dz = rng.float(-1, 1);
				const len = rng.int(2, 5);
				const ox = x + rng.int(-1, 1);
				const oz = z + rng.int(-1, 1);
				w.line(
					[ox, y, oz],
					[ox + dx * len, y + up * len * 0.9, oz + dz * len],
					i % 3 === 0 ? dark : bright,
				);
			}
		};
		const CRYSTAL_A = toXZi(-23, -8);
		const CRYSTAL_B = toXZi(26, -4);
		const CRYSTAL_OUT = toXZi(OUT_POOL_V - 10, OUT_POOL_U - 2);
		cluster(CRYSTAL_A[0], FLOOR + 1, CRYSTAL_A[1], 9, 'crystal-blue', 'crystal-blue-dark');
		cluster(CRYSTAL_B[0], FLOOR + 1, CRYSTAL_B[1], 6, 'crystal-blue', 'crystal-blue-dark');
		cluster(CRYSTAL_OUT[0], TERRACE + 1, CRYSTAL_OUT[1], 6, 'crystal-blue', 'crystal-blue-dark');
		// жеода в стене: шар в скале, срезанный к гроту
		const GEODE_V = -27;
		const GEODE_U = -16;
		const [gx, gz] = toXZi(GEODE_V - 2, GEODE_U);
		const geode: XYZ = [gx, 16, gz];
		w.sphere(geode, 4.2, 'geode');
		w.sphere(geode, 3.2, 'amethyst-dark');
		w.sphere(geode, 2, 'amethyst');
		const [cx, cz] = toXZ(GEODE_V + 1, GEODE_U);
		w.sphere([cx, 16, cz], 2.3, 'air');
		// тёплый «солнечный камень» в глубине тоннеля
		const SUN = toXZi(riverV(-50) + 3, -50);
		cluster(SUN[0], FLOOR + 1, SUN[1], 7, 'sunstone', 'sunstone-dark');
		const SUN2 = toXZi(riverV(-46) - 4, -46);
		cluster(SUN2[0], FLOOR + 1, SUN2[1], 4, 'sunstone', 'sunstone-dark');

		// --- грибы по берегам ---
		const mushroom = (x: number, y: number, z: number): void => {
			const h = rng.int(1, 2);
			w.box([x, y, z], [x, y + h - 1, z], 'mushroom-stem');
			w.set([x, y + h, z], 'mushroom-cap');
			if (rng.chance(0.5)) w.set([x + rng.int(-1, 1), y, z + rng.int(-1, 1)], 'mushroom-cap');
		};
		for (let i = 0; i < 16; i++) {
			const u = rng.float(-24, -1);
			const side = rng.chance(0.5) ? 1 : -1;
			const v = riverV(u) + side * rng.float(6, 9);
			const [x, z] = toXZi(v, u);
			if (ceilAt(x, z) < FLOOR + 6 || w.get([x, FLOOR + 1, z]) !== null) continue;
			if (w.get([x, FLOOR, z]) === null) continue;
			mushroom(x, FLOOR + 1, z);
			for (let k = 0; k < rng.int(1, 3); k++)
				mushroom(x + rng.int(-2, 2), FLOOR + 1, z + rng.int(-2, 2));
		}
		for (let i = 0; i < 6; i++) {
			const u = rng.float(4, 30);
			const v = riverV(u) + rng.float(6, 10);
			const [x, z] = toXZi(v, u);
			const y = w.heightAt(x, z);
			if (y < TERRACE || y > TERRACE + 1) continue;
			mushroom(x, y + 1, z);
		}

		// --- светлячки-черви на своде ---
		for (let x = 0; x < SX; x++) {
			for (let z = 0; z < SZ; z++) {
				const ceil = ceilAt(x, z);
				if (ceil < FLOOR + 8) continue;
				if (w.get([x, ceil, z]) !== null || w.get([x, ceil + 1, z]) === null) continue;
				if (rng.chance(0.045)) w.set([x, ceil, z], 'glowworm');
			}
		}

		// --- валуны и ели ---
		const rockAt = (v: number, u: number, y: number): void => {
			const [x, z] = toXZi(v, u);
			w.place(prefabs.rock({ rng: rng.fork(), size: rng.int(1, 2) }), [x, y, z]);
		};
		for (const [v, u] of [
			[-14, -4],
			[22, -12],
			[8, -24],
			[-26, -1],
		] as const) {
			if (Math.abs(v - riverV(u)) > 5) rockAt(v, u, FLOOR + 1);
		}
		for (const [v, u] of [
			[-12, 14],
			[14, 8],
			[12, 26],
			[-16, 32],
		] as const) {
			if (Math.abs(v - riverV(u)) > 5) rockAt(v, u, TERRACE + 1);
		}
		w.scatter((o) => prefabs.pine({ rng: o.rng, height: o.rng.int(7, 10) }), {
			count: 9,
			on: ['moss', 'moss-dark'],
			minDistance: 8,
			area: [3, 3, 56, 56],
		});
		w.scatter(prefabs.rock, {
			count: 6,
			on: ['moss', 'moss-dark'],
			minDistance: 6,
			area: [3, 3, 56, 56],
		});

		w.anchor('sky', [SKY_X, STREAM_Y + 1, SKY_Z]);
		w.anchor('geode', [cx, 16, cz]);
		w.anchor('sun', [SUN[0] + 0.5, FLOOR + 3, SUN[1] + 0.5]);
		w.anchor('crystalA', [CRYSTAL_A[0] + 0.5, FLOOR + 3, CRYSTAL_A[1] + 0.5]);
		w.anchor('crystalOut', [CRYSTAL_OUT[0] + 0.5, TERRACE + 3, CRYSTAL_OUT[1] + 0.5]);
		for (const [i, p] of drips.entries()) w.anchor(`drip${i}`, p);
		for (let i = drips.length; i < 4; i++) w.anchor(`drip${i}`, [SKY_X, FLOOR + 2, SKY_Z]);
	},
	entities: [
		{
			id: 'beetle-left',
			model: beetle('#9affc8'),
			animate: walkPath(BANK_LEFT, { loop: 'pingpong', speed: 0.7, pause: 2.5 }),
		},
		{
			id: 'beetle-right',
			model: beetle('#ffd36a'),
			animate: walkPath([...BANK_RIGHT].reverse(), { loop: 'pingpong', speed: 0.55, pause: 3 }),
		},
		{
			id: 'beetle-out',
			model: beetle('#9affc8'),
			animate: walkPath(BANK_OUT, { loop: 'pingpong', speed: 0.6, pause: 2 }),
		},
		{
			id: 'motes',
			model: mote('#c6ff8a'),
			count: 26,
			at: [CENTER[0], 15, CENTER[1]],
			animate: swarm,
		},
		{
			id: 'motes-blue',
			model: mote('#8ae8ff'),
			count: 10,
			at: [CENTER[0], 15, CENTER[1]],
			animate: swarm,
		},
		{
			id: 'bats',
			rig: prefabs.bird({ color: '#2a2230' }),
			count: 6,
			animate: [
				orbit({ center: [CENTER[0], 23, CENTER[1]], radius: 10, speed: 7 }),
				bob({ amp: 1.2, period: 2.4 }),
			],
		},
	],
	particles: [
		// ручей с холма падает в провал
		...[-1.2, 0, 1.2].map((dv) => {
			const [x, z] = toXZ(SKY_V + dv, SKY_U - SKY_R + 0.5);
			return pour({
				at: [x, STREAM_Y + 1.5, z],
				rate: 45,
				lifetime: 3.6,
				velocity: [S2 * 1.5, 0, S2 * 1.5],
			});
		}),
		mist({ area: [SKY_X - 6, SKY_Z - 6, SKY_X + 6, SKY_Z + 6], height: 1.5, intensity: 1.2 }),
		fireflies({ area: [SKY_X - 4, SKY_Z - 4, SKY_X + 4, SKY_Z + 4], count: 8, color: '#c6ff8a' }),
		fireflies({ area: [50, 50, 94, 94], count: 55, color: '#c6ff8a' }),
		mist({ area: [66, 66, 94, 94], height: 1, intensity: 0.5 }),
		...[0, 1, 2, 3].map((i) => pour({ at: `drip${i}`, rate: 1.5, lifetime: 1.5, size: 'small' })),
	],
	lights: [
		pointLight({ at: [SKY_X, 24, SKY_Z], color: '#a8c8ff', intensity: 7, distance: 26 }),
		pointLight({ at: 'crystalA', color: '#5fd0ff', intensity: 6, distance: 16 }),
		pointLight({ at: 'crystalOut', color: '#5fd0ff', intensity: 4, distance: 12 }),
		pointLight({ at: 'geode', color: '#b48cff', intensity: 4, distance: 12 }),
		pointLight({ at: 'sun', color: '#ffb45e', intensity: 5, distance: 18, flicker: true }),
		pointLight({
			attachTo: 'beetle-left',
			offset: [0, 0.5, 0],
			color: '#9affc8',
			intensity: 1.5,
			distance: 5,
		}),
		pointLight({ at: [CENTER[0], 22, CENTER[1]], color: '#4e6f9a', intensity: 3, distance: 46 }),
	],
	atmosphere: { time: { start: 'night', speed: 0 }, sky: 'stylized' },
	camera: {
		position: [CENTER[0] + 86, 68, CENTER[1] + 86],
		target: [CENTER[0], 14, CENTER[1]],
		captureTime: 3,
	},
	base: 'stone',
});
