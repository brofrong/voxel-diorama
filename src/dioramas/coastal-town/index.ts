import {
	bob,
	defineDiorama,
	flock,
	fountain,
	model,
	pointLight,
	pour,
	prefabs,
	type Rng,
	spin,
	sway,
	walkPath,
	wander,
} from '#sdk';

/*
 * Городок-фавела на скалистом холме у бухты.
 *
 * Камера смотрит с угла +x+z. Оси: u = (x + z) / 2 — «к морю», v = (x − z) / 2 — «влево-вправо»
 * на экране. Холм-пирамида поднимается от набережной к заднему углу; город из одноэтажных домов
 * террасами застраивает его до самого верха, а по граням холма (задние края и боковые склоны)
 * идут скалы с джунглями, спускаясь к воде. Набережная (u 234…250) с лавочками и кафе,
 * полукруглая площадь с фонтаном перед церковью и пирс обрываются в воду тёсаной стенкой.
 */

const SX = 384;
const SY = 256;
const SZ = 384;
const SEA = 10;
const PLAZA = 14;
const FLOOR = 5; // все дома одноэтажные
const STEP = 8; // высота уступа террасы
const ROCK_EDGE = 50; // ширина скалистой грани вдоль задних краёв
const PROMENADE_U: [number, number] = [234, 250];
const CHURCH: XZ = [226, 222];
const FOUNTAIN: XZ = [226, 262];
const BULGE_R = 24; // полукруглая площадь вокруг фонтана
const PIER_V = 60;
const PIER_U: [number, number] = [250, 300];
const POUR_POINTS = 12; // переливы через край верхней чаши
const JETS = 8; // дуги от верхушки фонтана до нижней чаши
const PH: [number, number] = [50, 118]; // площадка пентхауса на вершине (x и z)
const PH_LEVEL = PLAZA + 10 * STEP;
const inPH = (x: number, z: number): boolean =>
	x >= PH[0] && x <= PH[1] && z >= PH[0] && z <= PH[1];

const WALLS = [
	'wall-red',
	'wall-orange',
	'wall-yellow',
	'wall-green',
	'wall-blue',
	'wall-teal',
	'wall-purple',
	'wall-pink',
	'wall-white',
	'wall-mint',
	'brick',
	'brick',
	'concrete',
];
const LEAVES = ['leaves', 'leaves-dark', 'leaves-light', 'jungle', 'jungle-dark'];
const ROCKS = ['rock', 'rock-dark', 'rock-light'];
const AWNINGS: Array<[string, string]> = [
	['awning-red', 'awning-white'],
	['awning-blue', 'awning-white'],
	['awning-green', 'awning-white'],
	['awning-yellow', 'awning-red'],
	['awning-red', 'awning-yellow'],
];
const FRUITS = ['fruit-orange', 'fruit-red', 'fruit-green', 'awning-yellow'];
/** Рекламные щиты: [фон, надпись]; неон светится ночью. */
const ADS: Array<[string, string]> = [
	['ad-yellow', 'ad-red'],
	['ad-white', 'ad-blue'],
	['ad-red', 'ad-white'],
	['ad-blue', 'neon-cyan'],
	['ad-white', 'neon-pink'],
	['ad-yellow', 'neon-green'],
	['ad-dark', 'neon-pink'],
	['ad-dark', 'neon-cyan'],
];

type XZ = [number, number];
type Face = 'x' | 'z';

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number): number => {
	const t = clamp((x - a) / (b - a), 0, 1);
	return t * t * (3 - 2 * t);
};
const uOf = (x: number, z: number): number => (x + z) / 2;
const vOf = (x: number, z: number): number => (x - z) / 2;
const fromUV = (u: number, v: number): XZ => [Math.round(u + v), Math.round(u - v)];

/** Лестница-серпантин от набережной вверх по склону: зигзаг поперёк склона, все лестницы параллельны. */
function serpentine(v0: number, turns: number, rise: number, width: number): XZ[] {
	const pts: XZ[] = [fromUV(232, v0)];
	for (let i = 1; i <= turns; i++) {
		const p = fromUV(232 - i * rise * Math.SQRT1_2, v0 + (i % 2 === 1 ? width : -width));
		if (p[0] < 10 || p[1] < 10 || p[0] > SX - 11 || p[1] > SZ - 11) break;
		if (Math.min(p[0], p[1]) < ROCK_EDGE + 4) break; // дальше — скалистая грань
		if (p[0] < PH[1] + 6 && p[1] < PH[1] + 6) break; // выше — пентхаус
		pts.push(p);
	}
	return pts;
}

const STAIRS: XZ[][] = [
	serpentine(30, 14, 21, 14),
	serpentine(-38, 14, 21, 14),
	serpentine(78, 12, 21, 13),
	serpentine(-82, 12, 21, 13),
];

/** Кольцо прогулки вокруг фонтана: между чашей (радиус 14) и фонарями (21.5). */
const FOUNTAIN_RING: XZ[] = Array.from({ length: 16 }, (_, i): XZ => {
	const a = (i / 16) * Math.PI * 2;
	return [Math.round(FOUNTAIN[0] + Math.cos(a) * 18), Math.round(FOUNTAIN[1] + Math.sin(a) * 18)];
});
const LAMPS: XZ[] = [45, 135, 225, 315].map((deg): XZ => {
	const a = (deg / 180) * Math.PI;
	return [
		Math.round(FOUNTAIN[0] + Math.cos(a) * 21.5),
		Math.round(FOUNTAIN[1] + Math.sin(a) * 21.5),
	];
});
const PROMENADES: XZ[][] = [
	[fromUV(242.5, 40), fromUV(242.5, 64), fromUV(242.5, 90)],
	[fromUV(242.5, -48), fromUV(242.5, -70), fromUV(242.5, -92)],
	[fromUV(253, PIER_V), fromUV(296, PIER_V)],
];

/** Фламинго: стоит на одной ноге, лицо +z. */
const flamingo = model(
	{
		size: [3, 11, 7],
		scale: 0.25,
		palette: {
			pink: '#f48fb1',
			'pink-dark': '#e0628f',
			leg: '#e57399',
			beak: '#f5efe2',
			tip: '#222222',
		},
	},
	(m) => {
		m.box([1, 0, 3], [1, 4, 3], 'leg');
		m.set([1, 3, 4], 'leg'); // поджатая нога
		m.box([0, 5, 1], [2, 7, 4], 'pink');
		m.box([0, 6, 2], [0, 7, 3], 'pink-dark');
		m.box([2, 6, 2], [2, 7, 3], 'pink-dark');
		m.box([1, 6, 0], [1, 7, 0], 'pink-dark');
		m.box([1, 8, 4], [1, 9, 4], 'pink');
		m.box([1, 10, 4], [1, 10, 5], 'pink');
		m.set([1, 10, 6], 'beak');
		m.set([1, 9, 6], 'tip');
	},
);

/** Надувной фламинго-круг для бассейна. */
const floatie = model(
	{ size: [5, 5, 5], scale: 0.5, palette: { pink: '#ff8fbf', beak: '#ffd23f' } },
	(m) => {
		m.box([0, 0, 0], [4, 0, 4], 'pink');
		m.clear([1, 0, 1], [3, 0, 3]);
		m.box([2, 1, 3], [2, 3, 3], 'pink');
		m.box([2, 4, 2], [2, 4, 3], 'pink');
		m.set([2, 4, 1], 'beak');
	},
);

/** Лопасти вертолёта, pivot — втулка. */
const rotor = model(
	{ size: [17, 1, 17], pivot: [8.5, 0.5, 8.5], palette: { blade: '#2b2b2b' } },
	(m) => {
		m.box([0, 0, 8], [16, 0, 8], 'blade');
		m.box([8, 0, 0], [8, 0, 16], 'blade');
	},
);

/** Фламинго на террасах пентхауса: [x, y, z, поворот°]. */
const PH_FLAMINGOS: Array<[number, number, number, number]> = [
	[92, PH_LEVEL + 9, 93, 40],
	[75, PH_LEVEL + 9, 92, 160],
	[84, PH_LEVEL + 9, 92, 10],
	[103, PH_LEVEL + 9, 100, 250],
	[103, PH_LEVEL + 9, 97, 300],
	[86, PH_LEVEL + 17, 64, 90],
	[64, PH_LEVEL + 17, 86, 200],
];

export default defineDiorama({
	meta: {
		title: 'Coastal Town',
		createdAt: '2026-10-07',
		author: { model: 'Claude Opus 5.5', effort: 'high', context: '1M' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'Bright little houses terraced up a rocky hill, jungle on the slopes, benches on a stone waterfront, a church with a big fountain, seagulls and passers-by',
		tags: ['town', 'sea', 'hill', 'people'],
	},
	seed: 41,
	size: [SX, SY, SZ],
	base: 'stone',
	palette: {
		rock: '#9b9184',
		'rock-dark': '#6f675d',
		'rock-light': '#bdb3a2',
		grass: '#6f8f3a',
		leaves: '#3f7a2a',
		'leaves-dark': '#2d5e22',
		'leaves-light': '#5f9a35',
		jungle: '#2f8a3a',
		'jungle-dark': '#1f5f2a',
		vine: '#3c7d2d',
		'palm-leaf': '#4c9a3a',
		trunk: '#6b4a2f',
		seabed: '#c9b98a',
		paving: '#d9cdb6',
		'paving-dark': '#b8ab93',
		masonry: '#b9ad98',
		'masonry-dark': '#a39780',
		quay: '#c4b9a5',
		'quay-dark': '#8f8574',
		coping: '#e6dece',
		'wall-red': '#d9604f',
		'wall-orange': '#ec9a4a',
		'wall-yellow': '#f2cf5b',
		'wall-green': '#7cc27a',
		'wall-blue': '#5b9bd5',
		'wall-teal': '#4fb3a9',
		'wall-purple': '#a07cc5',
		'wall-pink': '#f0a3b5',
		'wall-white': '#f2efe8',
		'wall-mint': '#a9d8b8',
		brick: '#b5603f',
		concrete: '#a7a39b',
		slab: '#c9c4ba',
		tank: '#2f74b5',
		window: '#33475b',
		'window-lit': { color: '#ffd98a', emissive: 1.1 },
		door: '#5a3a24',
		rail: '#3a3a3a',
		trim: '#fbf8f1',
		church: '#f3efe6',
		'church-roof': '#a9472c',
		spire: '#5b5148',
		'fountain-stone': '#d6cdbb',
		marble: '#f4f1ea',
		'glass-tint': { color: '#a8dcea', kind: 'glass' },
		gold: { color: '#d4af37', emissive: 0.25 },
		'pool-tile': '#3fb6d8',
		lounger: '#ffffff',
		sofa: '#ece6da',
		carpet: '#8e2c3a',
		piano: '#151515',
		helipad: '#4a4d52',
		'heli-body': '#1d2a44',
		'car-red': '#d0021b',
		tyre: '#1a1a1a',
		'ad-yellow': '#ffd400',
		'ad-red': '#e3262f',
		'ad-white': '#fbfbf7',
		'ad-blue': '#1f5fbf',
		'ad-dark': '#22252b',
		'neon-pink': { color: '#ff4fb8', emissive: 1.6 },
		'neon-cyan': { color: '#3ff2ff', emissive: 1.6 },
		'neon-green': { color: '#7dff4f', emissive: 1.6 },
		'awning-red': '#d64541',
		'awning-white': '#f4f1ea',
		'awning-blue': '#2e86c1',
		'awning-green': '#27ae60',
		'awning-yellow': '#f1c40f',
		wood: '#8a5a35',
		'fruit-orange': '#f39c12',
		'fruit-red': '#c0392b',
		'fruit-green': '#7dbb3a',
		water: { color: '#2fb3c4', kind: 'water' },
		glass: { color: '#cfeff5', kind: 'glass' },
	},
	build(w) {
		const signed = (x: number, z: number, scale: number): number =>
			(w.noise.fbm(x * scale, z * scale) - 0.5) * 2;
		const idx = (x: number, z: number): number => x + z * SX;
		const inside = (x: number, z: number): boolean => x >= 0 && z >= 0 && x < SX && z < SZ;
		const SIDES: XZ[] = [
			[1, 0],
			[0, 1],
			[-1, 0],
			[0, -1],
		];
		const ashlar = (x: number, y: number, z: number): number =>
			((y >> 1) + ((x + z + ((y >> 1) & 1) * 2) >> 2)) & 1;

		// --- Зоны ---------------------------------------------------------------------------------
		// Скалистые грани холма: вдоль задних краёв подставки и на боковых склонах до воды.
		const rockiness = (x: number, z: number): number => {
			const n = signed(x, z, 1 / 18) * 10;
			return Math.max(
				smooth(ROCK_EDGE, ROCK_EDGE - 30, Math.min(x, z) + n),
				smooth(112, 146, Math.abs(vOf(x, z)) + n),
			);
		};
		const inBulge = (x: number, z: number): boolean =>
			Math.hypot(x - FOUNTAIN[0], z - FOUNTAIN[1]) <= BULGE_R;
		const inPier = (x: number, z: number): boolean => {
			const u = uOf(x, z);
			return Math.abs(vOf(x, z) - PIER_V) <= 4 && u >= PROMENADE_U[0] && u <= PIER_U[1];
		};
		const isQuay = (x: number, z: number): boolean => {
			const u = uOf(x, z);
			return (u >= PROMENADE_U[0] - 2 && u <= PROMENADE_U[1]) || inBulge(x, z) || inPier(x, z);
		};

		// --- Высоты -------------------------------------------------------------------------------
		const height = new Float32Array(SX * SZ);
		const rockAmt = new Float32Array(SX * SZ);
		const terraced = new Uint8Array(SX * SZ);
		const sea = new Uint8Array(SX * SZ); // берег и бухта за набережной
		for (let x = 0; x < SX; x++) {
			for (let z = 0; z < SZ; z++) {
				const i = idx(x, z);
				const u = uOf(x, z);
				const v = vOf(x, z);
				const rock = rockiness(x, z);
				rockAmt[i] = rock;
				const crag = rock * (8 + signed(x + 300, z, 1 / 7) * 8);
				if (inPH(x, z)) {
					// Вместо трёх верхних террас — ровная площадка под пентхаус.
					height[i] = PH_LEVEL;
					rockAmt[i] = 0;
					continue;
				}
				if (isQuay(x, z) && rock < 0.5) {
					height[i] = PLAZA;
					continue;
				}
				if (u >= PROMENADE_U[0] - 2) {
					// Бухта; у боковых граней скалы спускаются в воду.
					sea[i] = 1;
					const bed = SEA - 3 - Math.max(0, u - 250) * 0.06 + signed(x, z, 1 / 14) * 1.5;
					height[i] = Math.max(2, bed, SEA - 4 + (crag + rock * 10) * (1 - smooth(240, 300, u)));
					continue;
				}
				// Пирамида: выше к заднему углу, ниже к боковым углам.
				const ramp = 0.55 * Math.max(0, 230 - u) - 0.3 * Math.max(0, Math.abs(v) - 30);
				const rough = signed(x, z, 1 / 24) * 4 + signed(x, z, 1 / 9) * 1.5;
				let h = PLAZA + Math.max(0, ramp + rough) + crag;
				// Каменные выступы между кварталами.
				const outcrop = signed(x + 77, z - 31, 1 / 22) - 0.5;
				if (outcrop > 0 && u < 222) {
					rockAmt[i] = Math.max(rock, 0.6);
					h += 2 + outcrop * 20;
				} else if (rock < 0.25 && u < PROMENADE_U[0] - 4 && h > PLAZA + 4) {
					h = PLAZA + Math.round((h - PLAZA) / STEP) * STEP;
					terraced[i] = 1;
				}
				height[i] = h;
			}
		}

		// Занятость: 1 — дом, 2 — лестница, 3 — набережная/площадь.
		const occ = new Uint8Array(SX * SZ);
		const occupied = (x0: number, z0: number, x1: number, z1: number): boolean => {
			for (let x = x0; x <= x1; x++)
				for (let z = z0; z <= z1; z++) {
					if (x < 3 || z < 3 || x > SX - 4 || z > SZ - 4) return true;
					if (occ[idx(x, z)]) return true;
				}
			return false;
		};
		const mark = (x0: number, z0: number, x1: number, z1: number): void => {
			for (let x = Math.max(0, x0); x <= Math.min(SX - 1, x1); x++)
				for (let z = Math.max(0, z0); z <= Math.min(SZ - 1, z1); z++) occ[idx(x, z)] ||= 1;
		};
		mark(PH[0] - 1, PH[0] - 1, PH[1] + 1, PH[1] + 1);

		// --- Лестницы: сглаженно по рельефу, режут уступы террас пандусами ------------------------
		const pathH = new Float32Array(SX * SZ).fill(-1);
		for (const route of STAIRS) {
			const samples: Array<{ x: number; z: number; h: number }> = [];
			for (let i = 0; i < route.length - 1; i++) {
				const [ax, az] = route[i];
				const [bx, bz] = route[i + 1];
				const len = Math.hypot(bx - ax, bz - az);
				for (let s = 0; s < len; s += 0.5) {
					const x = ax + ((bx - ax) * s) / len;
					const z = az + ((bz - az) * s) / len;
					samples.push({ x, z, h: height[idx(Math.round(x), Math.round(z))] });
				}
			}
			const last = route[route.length - 1];
			samples.push({ x: last[0], z: last[1], h: height[idx(last[0], last[1])] });
			const sm = samples.map((_, i) => {
				let sum = 0;
				let n = 0;
				for (let j = Math.max(0, i - 10); j <= Math.min(samples.length - 1, i + 10); j++) {
					sum += samples[j].h;
					n++;
				}
				return sum / n;
			});
			for (let i = 1; i < sm.length; i++) sm[i] = clamp(sm[i], sm[i - 1] - 0.45, sm[i - 1] + 0.45);
			for (let i = sm.length - 2; i >= 0; i--)
				sm[i] = clamp(sm[i], sm[i + 1] - 0.45, sm[i + 1] + 0.45);
			samples.forEach((p, i) => {
				const h = Math.round(sm[i]);
				for (let dx = -2; dx <= 2; dx++)
					for (let dz = -2; dz <= 2; dz++) {
						const x = Math.round(p.x) + dx;
						const z = Math.round(p.z) + dz;
						if (!inside(x, z)) continue;
						pathH[idx(x, z)] = h;
						occ[idx(x, z)] = 2;
					}
			});
		}

		// --- Заливка ------------------------------------------------------------------------------
		const top = new Int16Array(SX * SZ);
		const water = new Uint8Array(SX * SZ);
		for (let x = 0; x < SX; x++) {
			for (let z = 0; z < SZ; z++) {
				const i = idx(x, z);
				const quay = !sea[i] && isQuay(x, z);
				const p = pathH[i];
				const h = Math.round(p >= 0 && !quay ? p : height[i]);
				top[i] = h;
				if (quay) {
					// Набережная: тёсаная стенка в перевязку, ниже воды — тёмный камень, по краю — бордюр.
					occ[i] = 3;
					for (let y = 0; y < h; y++)
						w.set([x, y, z], y < SEA - 1 ? 'quay-dark' : ashlar(x, y, z) ? 'quay' : 'masonry');
					const edge = SIDES.some(([dx, dz]) => {
						const nx = x + dx;
						const nz = z + dz;
						return inside(nx, nz) && !isQuay(nx, nz) && uOf(nx, nz) > PROMENADE_U[0];
					});
					w.set([x, h, z], edge ? 'coping' : (x * 7 + z * 3) % 11 === 0 ? 'paving-dark' : 'paving');
					continue;
				}
				if (sea[i] && h < SEA) {
					w.box([x, 0, z], [x, h, z], 'seabed');
					water[i] = 1;
					continue;
				}
				if (inPH(x, z)) {
					// Подиум пентхауса: тёсаный камень, сверху мрамор.
					w.box([x, 0, z], [x, Math.max(0, h - 31), z], 'rock-dark');
					for (let y = Math.max(0, h - 30); y < h; y++)
						w.set([x, y, z], ashlar(x, y, z) ? 'masonry' : 'masonry-dark');
					w.set([x, h, z], 'marble');
					continue;
				}
				if (terraced[i] && p < 0) {
					// Терраса: подпорная стенка из тёсаного камня, сверху — мощёная площадка.
					w.box([x, 0, z], [x, Math.max(0, h - STEP - 1), z], 'rock-dark');
					for (let y = Math.max(0, h - STEP); y < h; y++)
						w.set([x, y, z], ashlar(x, y, z) ? 'masonry' : 'masonry-dark');
					const grass = signed(x + 40, z, 1 / 10) > 0.35;
					w.set([x, h, z], grass ? 'grass' : (x + z) % 13 === 0 ? 'paving-dark' : 'paving');
					continue;
				}
				w.box([x, 0, z], [x, h - 1, z], 'rock-dark');
				let surface = 'rock';
				if (p >= 0) surface = 'paving';
				else if (rockAmt[i] > 0.4) surface = signed(x, z, 1 / 7) > 0.2 ? 'rock-light' : 'rock';
				else if (signed(x, z, 1 / 18) > -0.1) surface = 'grass';
				w.set([x, h, z], surface);
			}
		}
		const level = top.slice(); // уровень террас до застройки
		const slope = (x: number, z: number): number => {
			const hx = top[idx(Math.min(SX - 1, x + 1), z)] - top[idx(Math.max(0, x - 1), z)];
			const hz = top[idx(x, Math.min(SZ - 1, z + 1))] - top[idx(x, Math.max(0, z - 1))];
			return Math.hypot(hx, hz) / 2;
		};

		/** Лиана свисает от yTop вниз на len вокселей в воздушной колонке (x, z). */
		const vine = (x: number, z: number, yTop: number, len: number): void => {
			if (!inside(x, z)) return;
			const floor = top[idx(x, z)];
			for (let y = yTop; y > Math.max(floor, yTop - len); y--) w.set([x, y, z], 'vine');
		};

		// --- Одноэтажные домики-фавелы: яркие кубы с плоскими бетонными крышами -----------------
		let ads = 0;
		/** Рекламный щит на крыше вдоль фасада: стойки, фон, «надпись», логотип. */
		const billboard = (
			x0: number,
			z0: number,
			x1: number,
			z1: number,
			roof: number,
			face: Face,
			r: Rng,
		): void => {
			const [bg, fg] = ADS[ads++ % ADS.length];
			const [a0, a1] = face === 'x' ? [z0, z1] : [x0, x1];
			const fixed = (face === 'x' ? x1 : z1) - 1;
			const at = (a: number, y: number): [number, number, number] =>
				face === 'x' ? [fixed, y, a] : [a, y, fixed];
			for (const a of [a0 + 1, a1 - 1]) w.box(at(a, roof + 1), at(a, roof + 2), 'rail');
			w.box(at(a0, roof + 3), at(a1, roof + 5), bg);
			w.box(at(a0 + 1, roof + 3), at(a0 + 2, roof + 5), fg); // логотип
			for (let a = a0 + 4; a <= a1 - 1; a++) if (r.chance(0.65)) w.set(at(a, roof + 4), fg);
		};
		const house = (
			x0: number,
			z0: number,
			x1: number,
			z1: number,
			pad: number,
			r: Rng,
			shop = false,
		): void => {
			const face: Face = r.chance(0.5) ? 'z' : 'x';
			const color = r.pick(WALLS);
			const y0 = pad + 1;
			const yTop = y0 + FLOOR - 1;
			w.clear([x0, y0, z0], [x1, Math.min(SY - 1, y0 + 16), z1]);
			w.box([x0, y0, z0], [x1, yTop, z1], color);
			const facade = (axis: Face, fixed: number, a0: number, a1: number, front: boolean): void => {
				const at = (a: number, y: number): [number, number, number] =>
					axis === 'x' ? [a, y, fixed] : [fixed, y, a];
				const mid = Math.round((a0 + a1) / 2);
				if (front && shop) {
					// Магазинчик: витрина во всю ширину, вывеска над ней, полосатый навес.
					const [s1, s2] = AWNINGS[ads % AWNINGS.length];
					w.box(at(a0 + 1, y0 + 1), at(a1 - 1, y0 + 2), 'window-lit');
					w.box(at(a0 + 1, y0 + 4), at(a1 - 1, y0 + 4), ADS[ads % ADS.length][1]);
					const out = axis === 'x' ? (fixed === z1 ? 1 : -1) : fixed === x1 ? 1 : -1;
					for (let a = a0; a <= a1; a++) {
						const p = at(a, y0 + 3);
						if (axis === 'x') p[2] += out;
						else p[0] += out;
						w.set(p, a % 2 === 0 ? s1 : s2);
					}
					w.box(at(mid, y0), at(mid, y0 + 2), 'door');
					return;
				}
				for (let a = a0 + 1 + r.int(0, 1); a <= a1 - 1; a += r.int(2, 3)) {
					if (front && Math.abs(a - mid) <= 1) continue;
					w.box(at(a, y0 + 1), at(a, y0 + 2), r.chance(0.15) ? 'window-lit' : 'window');
				}
				if (front) w.box(at(mid, y0), at(mid, y0 + 2), 'door');
			};
			facade('x', z0, x0, x1, false);
			facade('x', z1, x0, x1, face === 'z');
			facade('z', x0, z0, z1, false);
			facade('z', x1, z0, z1, face === 'x');
			const roof = yTop + 1;
			w.box([x0, roof, z0], [x1, roof, z1], 'slab');
			if (r.chance(0.35)) {
				w.box([x0, roof + 1, z0], [x1, roof + 1, z1], color);
				w.clear([x0 + 1, roof + 1, z0 + 1], [x1 - 1, roof + 1, z1 - 1]);
			}
			// Бак для воды, антенна, горшки с зеленью на крыше.
			if (shop) billboard(x0, z0, x1, z1, roof, face, r);
			else if (r.chance(0.55)) {
				const tx = r.int(x0 + 1, x1 - 2);
				const tz = r.int(z0 + 1, z1 - 2);
				w.box([tx, roof + 1, tz], [tx + 1, roof + 2, tz + 1], 'tank');
			}
			if (!shop && r.chance(0.25))
				w.box([x1 - 1, roof + 1, z0 + 1], [x1 - 1, roof + 4, z0 + 1], 'rail');
			if (r.chance(0.3)) w.set([x0 + 1, roof + 1, z1 - 1], r.pick(LEAVES));
			for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) top[idx(x, z)] = roof;
			// Лиана с крыши по углу.
			if (r.chance(0.45)) {
				const [cx, cz] = r.pick<XZ>([
					[x0 - 1, z0],
					[x1 + 1, z1],
					[x0, z1 + 1],
					[x1, z0 - 1],
				]);
				vine(cx, cz, roof, r.int(3, 6));
			}
			mark(x0, z0, x1, z1); // между домами — проулок в 1 воксель
		};

		// Место под церковь резервируем до застройки.
		mark(CHURCH[0] - 19, CHURCH[1] - 24, CHURCH[0] + 19, CHURCH[1] + 18);

		// Дом целиком на одной террасе, и перед ним (вниз по склону, +x/+z) — площадка.
		// Сначала дома побольше, потом мелкие заполняют промежутки. У лестниц — чаще магазинчики.
		const houseRng = w.rng.fork();
		const nearStairs = (x0: number, z0: number, x1: number, z1: number): boolean => {
			for (let x = x0 - 4; x <= x1 + 4; x += 2)
				for (let z = z0 - 4; z <= z1 + 4; z += 2)
					if (inside(x, z) && pathH[idx(x, z)] >= 0) return true;
			return false;
		};
		const passes: Array<{ step: number; size: [number, number]; platform: number }> = [
			{ step: 3, size: [6, 11], platform: 2 },
			{ step: 2, size: [4, 7], platform: 1 },
		];
		for (const { step, size, platform } of passes) {
			for (let gz = 10; gz < SZ - 8; gz += step) {
				for (let gx = 10; gx < SX - 8; gx += step) {
					const r = houseRng.fork();
					const wx = r.int(size[0], size[1]);
					const wz = r.int(size[0], size[1]);
					const x0 = gx + r.int(-1, 1) - (wx >> 1);
					const z0 = gz + r.int(-1, 1) - (wz >> 1);
					const x1 = x0 + wx - 1;
					const z1 = z0 + wz - 1;
					if (
						occupied(x0 - 1, z0 - 1, x1 + 1, z1 + 1) ||
						x1 + platform >= SX ||
						z1 + platform >= SZ
					)
						continue;
					const lv = level[idx(x0, z0)];
					let fits = true;
					for (let x = x0; x <= x1 + platform && fits; x++)
						for (let z = z0; z <= z1 + platform && fits; z++) {
							const i = idx(x, z);
							if (!terraced[i] || level[i] !== lv || occ[i] === 2) fits = false;
						}
					if (!fits) continue;
					const shop = wx >= 5 && wz >= 5 && r.chance(nearStairs(x0, z0, x1, z1) ? 0.5 : 0.08);
					house(x0, z0, x1, z1, lv, r, shop);
				}
			}
		}

		// Лианы на подпорных стенках террас.
		const vineRng = w.rng.fork();
		for (let x = 1; x < SX - 1; x++)
			for (let z = 1; z < SZ - 1; z++) {
				const i = idx(x, z);
				if (!terraced[i] || occ[i] || !vineRng.chance(0.05)) continue;
				for (const [dx, dz] of SIDES) {
					const j = idx(x + dx, z + dz);
					if (top[j] < top[i] - 4 && !occ[j]) vine(x + dx, z + dz, top[i], vineRng.int(3, STEP));
				}
			}

		// --- Церковь ------------------------------------------------------------------------------
		{
			const y0 = PLAZA + 1;
			const x0 = CHURCH[0] - 13;
			const x1 = CHURCH[0] + 13;
			const z0 = CHURCH[1] - 22;
			const z1 = CHURCH[1] + 16;
			w.clear([x0 - 6, y0, z0 - 2], [x1 + 6, y0 + 82, z1 + 2]);
			w.box([x0 - 6, 0, z0 - 2], [x1 + 6, y0 - 1, z1 + 2], 'masonry');
			w.box([x0, y0, z0], [x1, y0 + 22, z1], 'church');
			for (let k = 0; k <= 14; k++) {
				w.box([x0 - 1 + k, y0 + 23 + k, z0 - 1], [x1 + 1 - k, y0 + 23 + k, z1 - 1], 'church-roof');
			}
			for (let k = 0; k <= 13; k++)
				w.box([x0 + k, y0 + 23 + k, z1], [x1 - k, y0 + 23 + k, z1], 'church');
			for (let z = z0 + 4; z <= z1 - 4; z += 6) {
				w.box([x0, y0 + 8, z], [x0, y0 + 16, z + 1], 'window');
				w.box([x1, y0 + 8, z], [x1, y0 + 16, z + 1], 'window');
			}
			w.box([CHURCH[0] - 2, y0, z1], [CHURCH[0] + 2, y0 + 8, z1], 'door');
			for (let a = 0; a < Math.PI * 2; a += 0.12) {
				w.set(
					[Math.round(CHURCH[0] + Math.cos(a) * 4), Math.round(y0 + 17 + Math.sin(a) * 4), z1],
					'trim',
				);
			}
			w.box([CHURCH[0] - 2, y0 + 15, z1], [CHURCH[0] + 2, y0 + 19, z1], 'window-lit');
			for (const tx of [x0 - 5, x1 - 5]) {
				const tz = z1 - 6;
				w.box([tx, y0, tz], [tx + 10, y0 + 54, tz + 10], 'church');
				for (const yy of [y0 + 30, y0 + 44]) {
					w.box([tx + 4, yy, tz + 10], [tx + 6, yy + 6, tz + 10], 'window');
					w.box([tx, yy, tz + 4], [tx, yy + 6, tz + 6], 'window');
					w.box([tx + 10, yy, tz + 4], [tx + 10, yy + 6, tz + 6], 'window');
				}
				w.box([tx - 1, y0 + 55, tz - 1], [tx + 11, y0 + 56, tz + 11], 'trim');
				for (let k = 0; k <= 5; k++) {
					w.box(
						[tx + k, y0 + 57 + k * 3, tz + k],
						[tx + 10 - k, y0 + 59 + k * 3, tz + 10 - k],
						'spire',
					);
				}
				w.box([tx + 5, y0 + 75, tz + 5], [tx + 5, y0 + 79, tz + 5], 'rail');
				// Плющ по внешней стене башни.
				const side = tx < CHURCH[0] ? tx - 1 : tx + 11;
				w.box([side, y0 + 4, tz + 2], [side, y0 + 26, tz + 2], 'vine');
				w.box([side, y0 + 10, tz + 3], [side, y0 + 22, tz + 3], 'vine');
				w.box([side, y0 + 14, tz + 7], [side, y0 + 30, tz + 7], 'vine');
			}
		}

		// --- Большой двухъярусный фонтан перед входом в церковь -----------------------------------
		{
			const [fx, fz] = FOUNTAIN;
			const y0 = PLAZA + 1;
			w.cylinder([fx, y0, fz], 14, 3, 'fountain-stone'); // нижняя чаша
			w.cylinder([fx, y0 + 1, fz], 13, 2, 'water');
			w.cylinder([fx, y0, fz], 3, 11, 'fountain-stone'); // ствол
			w.cylinder([fx, y0 + 10, fz], 7, 2, 'fountain-stone'); // верхняя чаша
			w.cylinder([fx, y0 + 11, fz], 6, 1, 'water');
			w.cylinder([fx, y0 + 12, fz], 1.5, 5, 'fountain-stone'); // шпиль
			w.cylinder([fx, y0 + 17, fz], 2.5, 1, 'fountain-stone'); // чашечка
			w.anchor('fountain', [fx + 0.5, y0 + 18.5, fz + 0.5]);
			// Струи переливаются через край верхней чаши в нижнюю.
			for (let k = 0; k < POUR_POINTS; k++) {
				const a = (k / POUR_POINTS) * Math.PI * 2;
				w.anchor(`pour${k + 1}`, [
					fx + 0.5 + Math.cos(a) * 7.6,
					y0 + 11.5,
					fz + 0.5 + Math.sin(a) * 7.6,
				]);
			}
		}
		LAMPS.forEach(([lx, lz], i) => {
			w.place(prefabs.lantern(), [lx, PLAZA + 1, lz], { name: `lamp${i + 1}` });
		});
		// Кнехты по краям пирса.
		for (let u = PIER_U[0] + 6; u <= PIER_U[1] - 2; u += 10) {
			for (const dv of [-4, 4]) {
				const [bx, bz] = fromUV(u, PIER_V + dv);
				if (inside(bx, bz) && inPier(bx, bz))
					w.box([bx, PLAZA + 1, bz], [bx, PLAZA + 2, bz], 'rail');
			}
		}

		// --- Камни в бухте у скал -----------------------------------------------------------------
		const seaRng = w.rng.fork();
		for (let k = 0; k < 30; k++) {
			const u = seaRng.float(252, 320);
			const side = seaRng.chance(0.5) ? 1 : -1;
			const [x, z] = fromUV(u, side * seaRng.float(70, 383 - u));
			if (!inside(x, z) || !water[idx(x, z)]) continue;
			w.sphere([x, seaRng.int(4, 9), z], seaRng.float(2, 5), seaRng.pick(ROCKS));
		}

		// --- Валуны на скалистых гранях и выступах ------------------------------------------------
		const boulderRng = w.rng.fork();
		for (let k = 0; k < 2600; k++) {
			const x = boulderRng.int(2, SX - 3);
			const z = boulderRng.int(2, SZ - 3);
			const i = idx(x, z);
			if (rockAmt[i] < 0.45 || occ[i] || water[i]) continue;
			const r = boulderRng.float(3, 8.5);
			const y = top[i] + boulderRng.int(-2, 1);
			w.sphere([x, y, z], r, boulderRng.pick(ROCKS));
			for (let dx = -1; dx <= 1; dx++)
				for (let dz = -1; dz <= 1; dz++)
					if (inside(x + dx, z + dz))
						top[idx(x + dx, z + dz)] = Math.max(top[idx(x + dx, z + dz)], Math.round(y + r - 1));
		}

		// --- Зелень: деревья, пальмы, джунгли ----------------------------------------------------
		const greenRng = w.rng.fork();
		const palm = (x: number, z: number, h: number): void => {
			const height = greenRng.int(8, 13);
			const [lx, lz] = greenRng.pick(SIDES);
			let px = x;
			let pz = z;
			for (let y = 1; y <= height; y++) {
				if (y > height / 2 && y % 3 === 0) {
					px += lx;
					pz += lz;
				}
				w.set([px, h + y, pz], 'trunk');
			}
			const ty = h + height;
			for (let dx = -1; dx <= 1; dx++)
				for (let dz = -1; dz <= 1; dz++) {
					if (!dx && !dz) continue;
					for (let s = 1; s <= 5; s++)
						w.set([px + dx * s, ty - Math.max(0, s - 2), pz + dz * s], 'palm-leaf');
				}
			w.set([px, ty + 1, pz], 'palm-leaf');
		};
		const tree = (x: number, z: number, h: number, big: boolean): void => {
			const trunkH = big ? greenRng.int(4, 9) : greenRng.int(2, 5);
			w.box([x, h + 1, z], [x, h + trunkH, z], 'trunk');
			const leaves = greenRng.pick(LEAVES);
			if (!big) {
				w.sphere([x, h + trunkH + 2, z], greenRng.float(2.4, 4.2), leaves);
				return;
			}
			for (let b = greenRng.int(3, 5); b > 0; b--) {
				w.sphere(
					[x + greenRng.int(-3, 3), h + trunkH + greenRng.int(0, 3), z + greenRng.int(-3, 3)],
					greenRng.float(3, 6),
					leaves,
				);
			}
		};

		// --- Набережная: лавочки, киоски, рыночные прилавки, кафе; пальмы в кадках у воды ---------
		const shopRng = w.rng.fork();
		const nearChurch = (x: number, z: number): boolean =>
			Math.abs(x - CHURCH[0]) <= 24 && z >= CHURCH[1] - 26 && z <= CHURCH[1] + 22;
		const freeQuay = (x0: number, z0: number, x1: number, z1: number): boolean => {
			for (let x = x0; x <= x1; x++)
				for (let z = z0; z <= z1; z++) {
					if (!inside(x, z)) return false;
					const i = idx(x, z);
					if (occ[i] !== 3 || pathH[i] >= 0 || inPier(x, z) || nearChurch(x, z)) return false;
					if (Math.hypot(x - FOUNTAIN[0], z - FOUNTAIN[1]) <= BULGE_R + 4) return false;
				}
			return true;
		};
		let shops = 0;
		const shop = (x0: number, z0: number, x1: number, z1: number, face: Face, r: Rng): void => {
			const y0 = PLAZA + 1;
			const [a0, a1] = face === 'x' ? [z0, z1] : [x0, x1];
			// a — вдоль фасада, o — от фасада наружу (к морю), y — высота.
			const at = (a: number, o: number, y: number): [number, number, number] =>
				face === 'x' ? [x1 + o, y, a] : [a, y, z1 + o];
			const [s1, s2] = AWNINGS[shops++ % AWNINGS.length]; // все расцветки по очереди
			const stripe = (a: number): string => (a % 2 === 0 ? s1 : s2);
			const kind = r.pick(['shop', 'shop', 'kiosk', 'stall', 'cafe'] as const);
			if (kind === 'shop') {
				w.box([x0, y0, z0], [x1, y0 + 4, z1], r.pick(WALLS));
				w.box([x0, y0 + 5, z0], [x1, y0 + 5, z1], 'slab');
				w.box(at(a0 + 2, 0, y0 + 1), at(a1 - 1, 0, y0 + 2), 'window-lit');
				w.box(at(a0 + 1, 0, y0), at(a0 + 1, 0, y0 + 2), 'door');
				for (let a = a0; a <= a1; a++) {
					w.set(at(a, 1, y0 + 4), stripe(a));
					w.set(at(a, 2, y0 + 3), stripe(a));
				}
				w.box(at(a0 + 1, 0, y0 + 6), at(a1 - 1, 0, y0 + 6), s1); // вывеска
			} else if (kind === 'kiosk') {
				w.box([x0 + 1, y0, z0 + 1], [x1 - 1, y0 + 3, z1 - 1], r.pick(WALLS));
				w.box(at(a0 + 2, -1, y0 + 1), at(a1 - 2, -1, y0 + 2), 'air');
				w.box(at(a0 + 2, -2, y0 + 1), at(a1 - 2, -2, y0 + 2), 'window-lit');
				w.box(at(a0 + 2, -1, y0), at(a1 - 2, -1, y0), 'wood');
				w.box([x0, y0 + 4, z0], [x1, y0 + 4, z1], s1);
				w.box([x0 + 1, y0 + 5, z0 + 1], [x1 - 1, y0 + 5, z1 - 1], s2);
			} else if (kind === 'stall') {
				for (const a of [a0, a1])
					for (const o of [-3, 0]) w.box(at(a, o, y0), at(a, o, y0 + 3), 'wood');
				w.box(at(a0, -2, y0 + 1), at(a1, -1, y0 + 1), 'wood');
				for (let a = a0; a <= a1; a++)
					for (const o of [-2, -1]) if (r.chance(0.8)) w.set(at(a, o, y0 + 2), r.pick(FRUITS));
				for (let a = a0; a <= a1; a++)
					for (let o = -3; o <= 1; o++) w.set(at(a, o, y0 + 4), stripe(a));
			} else {
				// Кафе: столики под зонтиками.
				for (const a of [a0 + 1, a1 - 1]) {
					const [px, , pz] = at(a, -1, y0);
					w.box([px, y0, pz], [px, y0 + 3, pz], 'rail');
					w.set([px, y0 + 1, pz], 'wood');
					for (const [dx, dz] of SIDES) w.set([px + dx, y0 + 1, pz + dz], 'wood');
					w.cylinder([px, y0 + 4, pz], 2.6, 1, s1);
					w.set([px, y0 + 5, pz], s2);
				}
			}
		};
		for (let v = -118; v <= 118; v += 8) {
			const r = shopRng.fork();
			const wx = r.int(5, 8);
			const wz = r.int(5, 8);
			const [cx, cz] = fromUV(236.5, v + r.float(-1.5, 1.5));
			const x0 = cx - (wx >> 1);
			const z0 = cz - (wz >> 1);
			const x1 = x0 + wx - 1;
			const z1 = z0 + wz - 1;
			if (!freeQuay(x0 - 1, z0 - 1, x1 + 3, z1 + 3) || r.chance(0.05)) continue;
			shop(x0, z0, x1, z1, r.chance(0.5) ? 'x' : 'z', r);
			for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) occ[idx(x, z)] = 1;
		}
		// Кадки с пальмами и лавочки вдоль кромки набережной.
		for (let v = -112; v <= 112; v += 16) {
			const [px, pz] = fromUV(249, v);
			if (!freeQuay(px - 1, pz - 1, px + 1, pz + 1)) continue;
			w.box([px - 1, PLAZA + 1, pz - 1], [px + 1, PLAZA + 1, pz + 1], 'masonry-dark');
			w.set([px, PLAZA + 1, pz], 'grass');
			palm(px, pz, PLAZA + 1);
			const [bx, bz] = fromUV(249, v + 8);
			if (freeQuay(bx - 1, bz - 1, bx + 1, bz + 1)) {
				w.box([bx - 1, PLAZA + 1, bz], [bx + 1, PLAZA + 1, bz], 'wood');
			}
		}

		// --- Пентхаус: три стеклянных уступа, бассейн, джакузи, бар, вертолёт, сад с фламинго ----
		{
			const B = PH_LEVEL;
			const glassFloor = (x0: number, z0: number, x1: number, z1: number, y0: number): void => {
				const hgt = 7;
				w.box([x0, y0, z0], [x1, y0 + hgt - 1, z1], 'glass-tint');
				w.clear([x0 + 1, y0, z0 + 1], [x1 - 1, y0 + hgt - 1, z1 - 1]);
				for (let a = x0; a <= x1; a += 6) {
					w.box([a, y0, z0], [a, y0 + hgt - 1, z0], 'trim');
					w.box([a, y0, z1], [a, y0 + hgt - 1, z1], 'trim');
				}
				for (let a = z0; a <= z1; a += 6) {
					w.box([x0, y0, a], [x0, y0 + hgt - 1, a], 'trim');
					w.box([x1, y0, a], [x1, y0 + hgt - 1, a], 'trim');
				}
				// Перекрытие с выносом, золотой кант по фасадам к морю.
				w.box([x0 - 1, y0 + hgt, z0 - 1], [x1 + 1, y0 + hgt, z1 + 1], 'marble');
				w.box([x1 + 1, y0 + hgt - 1, z0 - 1], [x1 + 1, y0 + hgt - 1, z1 + 1], 'gold');
				w.box([x0 - 1, y0 + hgt - 1, z1 + 1], [x1 + 1, y0 + hgt - 1, z1 + 1], 'gold');
				// Люстры под потолком.
				for (let x = x0 + 5; x < x1 - 2; x += 10)
					for (let z = z0 + 5; z < z1 - 2; z += 10)
						w.box([x, y0 + hgt - 1, z], [x + 1, y0 + hgt - 1, z + 1], 'window-lit');
			};
			const railing = (x: number, z0: number, z1: number, y: number, alongZ: boolean): void => {
				if (alongZ) w.box([x, y, z0], [x, y, z1], 'glass');
				else w.box([z0, y, x], [z1, y, x], 'glass');
			};
			// Сад на уровне площадки.
			w.box([107, B, PH[0]], [PH[1], B, PH[1]], 'grass');
			w.box([PH[0], B, 107], [PH[1], B, PH[1]], 'grass');
			// Три этажа уступами к горе, террасы смотрят на море.
			glassFloor(58, 58, 106, 106, B + 1);
			glassFloor(58, 58, 88, 88, B + 9);
			glassFloor(58, 58, 76, 76, B + 17);
			railing(107, 57, 107, B + 9, true);
			railing(107, 57, 107, B + 9, false);
			railing(89, 57, 89, B + 17, true);
			railing(89, 57, 89, B + 17, false);
			// Интерьер первого этажа: ковёр, диваны у стекла, рояль, золотая статуя.
			w.box([86, B, 62], [100, B, 90], 'carpet');
			w.box([96, B + 1, 66], [102, B + 1, 68], 'sofa');
			w.box([96, B + 2, 66], [102, B + 2, 66], 'sofa');
			w.box([66, B + 1, 96], [68, B + 1, 102], 'sofa');
			w.box([66, B + 2, 96], [66, B + 2, 102], 'sofa');
			w.box([80, B + 1, 96], [84, B + 2, 99], 'piano');
			w.box([92, B + 1, 92], [93, B + 1, 93], 'gold');
			w.box([92, B + 2, 92], [92, B + 5, 92], 'gold');
			w.anchor('ph-light1', [94.5, B + 5, 70.5]);
			w.anchor('ph-light2', [70.5, B + 5, 94.5]);
			// Бассейн-инфинити на крыше первого этажа.
			w.box([62, B + 7, 94], [101, B + 7, 105], 'pool-tile');
			w.box([62, B + 8, 94], [101, B + 8, 105], 'water');
			// Шезлонги с зонтиками и бар.
			for (const [k, z] of [60, 65, 70, 75].entries()) {
				w.box([95, B + 9, z], [97, B + 9, z + 1], 'lounger');
				w.box([95, B + 10, z], [95, B + 10, z + 1], 'lounger');
				if (k % 2 === 0) {
					w.box([100, B + 9, z + 2], [100, B + 12, z + 2], 'rail');
					w.cylinder([100, B + 13, z + 2], 2.6, 1, AWNINGS[k][0]);
					w.set([100, B + 14, z + 2], AWNINGS[k][1]);
				}
			}
			w.box([102, B + 9, 80], [102, B + 9, 90], 'wood');
			w.box([102, B + 10, 80], [102, B + 10, 90], 'gold');
			for (let z = 81; z <= 89; z += 2) w.set([105, B + 9, z], FRUITS[z % FRUITS.length]);
			for (let z = 81; z <= 89; z += 3) w.set([100, B + 9, z], 'gold');
			// Джакузи на втором уступе.
			w.cylinder([83, B + 17, 83], 4, 1, 'marble');
			w.cylinder([83, B + 16, 83], 3, 2, 'water');
			// Вертолётная площадка на крыше и вертолёт.
			w.box([59, B + 24, 59], [75, B + 24, 75], 'helipad');
			for (let a = 0; a < Math.PI * 2; a += 0.05)
				w.set(
					[Math.round(67 + Math.cos(a) * 7), B + 24, Math.round(67 + Math.sin(a) * 7)],
					'awning-yellow',
				);
			w.box([63, B + 25, 65], [71, B + 25, 65], 'rail');
			w.box([63, B + 25, 69], [71, B + 25, 69], 'rail');
			w.box([64, B + 26, 66], [70, B + 28, 68], 'heli-body');
			w.box([70, B + 27, 66], [71, B + 28, 68], 'glass-tint');
			w.box([56, B + 27, 67], [63, B + 27, 67], 'heli-body');
			w.box([56, B + 28, 67], [56, B + 30, 67], 'heli-body');
			w.set([67, B + 29, 67], 'rail');
			w.anchor('rotor', [67.5, B + 30.5, 67.5]);
			// Спорткар у входа.
			w.box([90, B + 1, 110], [96, B + 1, 113], 'car-red');
			w.box([90, B + 2, 111], [96, B + 2, 112], 'car-red');
			w.box([92, B + 2, 110], [94, B + 3, 113], 'glass-tint');
			for (const [cx, cz] of [
				[90, 110],
				[96, 110],
				[90, 113],
				[96, 113],
			])
				w.set([cx, B + 1, cz], 'tyre');
			// Пальмы в кадках на террасе и в саду.
			for (const [px, pz, py] of [
				[104, 58, B + 9],
				[59, 104, B + 9],
				[87, 60, B + 17],
				[114, 114, B],
			]) {
				w.set([px, py, pz], 'gold');
				palm(px, pz, py);
			}
		}

		for (let gx = 3; gx < SX - 3; gx += 5) {
			for (let gz = 3; gz < SZ - 3; gz += 5) {
				const x = gx + greenRng.int(-2, 2);
				const z = gz + greenRng.int(-2, 2);
				if (!inside(x, z)) continue;
				const i = idx(x, z);
				if (water[i] || occ[i] || occupied(x - 2, z - 2, x + 2, z + 2)) continue;
				const h = top[i];
				const roll = greenRng.next();
				if (rockAmt[i] > 0.35) {
					// Джунгли на скалах: плотные кроны, пальмы, местами голый камень.
					if (slope(x, z) > 3 && roll < 0.4) continue;
					if (roll < 0.1) palm(x, z, h);
					else if (roll < 0.42) tree(x, z, h, true);
				} else if (!terraced[i]) {
					if (roll < 0.1) palm(x, z, h);
					else if (roll < 0.3) tree(x, z, h, false);
				} else if (roll < 0.04) {
					palm(x, z, h);
				} else if (roll < 0.12) {
					w.sphere([x, h + 1, z], greenRng.float(1.4, 2.4), greenRng.pick(LEAVES));
				}
			}
		}
		// Лианы по уступам скал.
		for (let x = 1; x < SX - 1; x++)
			for (let z = 1; z < SZ - 1; z++) {
				const i = idx(x, z);
				if (rockAmt[i] < 0.45 || !greenRng.chance(0.06)) continue;
				for (const [dx, dz] of SIDES) {
					const j = idx(x + dx, z + dz);
					if (top[j] < top[i] - 5 && !occ[j]) vine(x + dx, z + dz, top[i], greenRng.int(4, 16));
				}
			}
		// Подлесок на скалах.
		for (let k = 0; k < 1600; k++) {
			const x = greenRng.int(4, SX - 5);
			const z = greenRng.int(4, SZ - 5);
			const i = idx(x, z);
			if (water[i] || occ[i] || terraced[i] || rockAmt[i] < 0.3) continue;
			w.sphere([x, top[i] + 1, z], greenRng.float(1.4, 3), greenRng.pick(LEAVES));
		}

		// Кроны не нависают над ступенями — расчищаем коридоры.
		for (let x = 0; x < SX; x++)
			for (let z = 0; z < SZ; z++) {
				const i = idx(x, z);
				if (occ[i] === 2) w.clear([x, top[i] + 1, z], [x, Math.min(SY - 1, top[i] + 40), z]);
			}

		// --- Море и стеклянный бортик по краю подставки -------------------------------------------
		w.water({ level: SEA });
		const rim = (x: number, z: number, post: boolean): void => {
			if (!water[idx(x, z)]) return;
			w.box([x, 1, z], [x, SEA + 3, z], 'glass');
			if (post) w.box([x, 1, z], [x, SEA + 4, z], 'rail');
		};
		for (let i = 0; i < SX; i++) {
			rim(i, SZ - 1, i % 10 === 0);
			rim(SX - 1, i, i % 10 === 0);
		}
	},
	entities: [
		{
			id: 'gulls-bay',
			rig: prefabs.bird({ color: '#f4f6f7' }),
			count: 10,
			animate: flock({ center: [318, 34, 318], radius: 36, speed: 5 }),
		},
		{
			id: 'gulls-town',
			rig: prefabs.bird({ color: '#ecf0f1' }),
			count: 9,
			animate: flock({ center: [170, 90, 170], radius: 50, speed: 5 }),
		},
		{
			id: 'boat',
			model: prefabs.boat({ color: '#c0392b' }),
			at: [356, SEA + 0.8, 222],
			animate: [bob({ amp: 0.15, period: 3.2 }), sway({ angle: 3, period: 4.5 })],
		},
		// Прохожие на лестницах: с обоих концов и с середины.
		...STAIRS.flatMap((route, r) => [
			{
				id: `stairs${r}-up`,
				rig: prefabs.villager(),
				animate: walkPath(route, { speed: 1.1, loop: 'pingpong' as const, pause: 1.5 }),
			},
			{
				id: `stairs${r}-down`,
				rig: prefabs.villager(),
				animate: walkPath([...route].reverse(), {
					speed: 0.9,
					loop: 'pingpong' as const,
					pause: 2,
				}),
			},
			{
				id: `stairs${r}-mid`,
				rig: prefabs.villager(),
				animate: walkPath(route.slice(3), { speed: 1, loop: 'pingpong' as const, pause: 1 }),
			},
		]),
		{
			id: 'plaza',
			rig: prefabs.villager(),
			count: 8,
			animate: walkPath(FOUNTAIN_RING, { speed: 0.7, loop: true }),
		},
		...PROMENADES.map((route, i) => ({
			id: `promenade${i}`,
			rig: prefabs.villager(),
			count: 2,
			animate: walkPath(route, { speed: 0.9, loop: 'pingpong' as const, pause: 3 }),
		})),
		// Пентхаус: фламинго на террасах кланяются, в саду бродят; круг в бассейне; лопасти.
		...PH_FLAMINGOS.map(([x, y, z, rotate], i) => ({
			id: `flamingo${i}`,
			model: flamingo,
			at: [x, y, z] as [number, number, number],
			rotate,
			animate: [sway({ axis: 'x' as const, angle: 8, period: 3.5 }), bob({ amp: 0.04, period: 2 })],
		})),
		{
			id: 'flamingos-garden-a',
			model: flamingo,
			count: 3,
			animate: wander({ area: [108, 54, 117, 104], speed: 0.5, pause: [2, 5] }),
		},
		{
			id: 'flamingos-garden-b',
			model: flamingo,
			count: 3,
			animate: wander({ area: [54, 108, 86, 117], speed: 0.5, pause: [2, 5] }),
		},
		{
			id: 'floatie',
			model: floatie,
			at: [80, PH_LEVEL + 8.8, 100],
			animate: [bob({ amp: 0.08, period: 2.5 }), spin({ speed: 0.03 })],
		},
		{ id: 'rotor', model: rotor, at: 'rotor', animate: spin({ speed: 0.6 }) },
	],
	particles: [
		fountain({ at: 'fountain', rate: 150 }),
		// Дуги от верхушки, через верхнюю чашу — в нижнюю.
		...Array.from({ length: JETS }, (_, k) => {
			const a = ((k + 0.5) / JETS) * Math.PI * 2;
			const out = 3.4;
			return fountain({
				at: 'fountain',
				rate: 180,
				lifetime: 3.2,
				velocity: [Math.cos(a) * out, 1, Math.sin(a) * out] as [number, number, number],
			});
		}),
		// Переливы через край верхней чаши: чуть наружу и вниз до нижней.
		...Array.from({ length: POUR_POINTS }, (_, k) => {
			const a = (k / POUR_POINTS) * Math.PI * 2;
			return pour({
				at: `pour${k + 1}`,
				rate: 100,
				lifetime: 1.5,
				velocity: [Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8] as [number, number, number],
			});
		}),
	],
	lights: [
		...LAMPS.map((_, i) =>
			pointLight({
				at: `lamp${i + 1}.light`,
				color: '#ffd28a',
				intensity: 6,
				distance: 12,
				onlyAtNight: true,
			}),
		),
		...['ph-light1', 'ph-light2'].map((at) =>
			pointLight({ at, color: '#ffe2b0', intensity: 10, distance: 26, onlyAtNight: true }),
		),
	],
	atmosphere: {
		time: { start: 15.5, speed: 0.5, cycle: 240 },
		sky: { kind: 'solid', color: '#3b3f45' },
	},
	camera: { captureTime: 4 },
});
