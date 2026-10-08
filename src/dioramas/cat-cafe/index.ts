import { defineDiorama, type Model, model, pointLight, type Vec3, type WorldBuilder } from '#sdk';

/*
 * Кофейня-кубик, оплетённая плющом. Камера смотрит с угла +x+z: фасад (z = Z1) — слева на экране,
 * боковая стена (x = X1) — справа. Фасад слева направо: кирпичная клумба, витрина с пирожными под
 * зелёной маркизой, ниша со ступенями и дверью. На боковой стене — вентрешётка, подвесные кашпо,
 * кондиционер с кошачьей мордой, счётчик, внешний блок, полка с цветком и газовые баллоны.
 * Мелкие детали (плющ, вывеска COFFEE, надпись маркизы, пирожные, техника) — модели в пол-вокселя.
 */

const G = 2; // верх плиты основания
const X0 = 8;
const X1 = 57;
const Z0 = 6;
const Z1 = 51;
const TOP = 55; // верх парапета
const BAND = 43; // низ кирпичного пояса
const ROOF = 50; // настил крыши
const AW = X0 + 35; // правый край маркизы
const N0 = X0 + 38; // ниша с дверью
const N1 = X0 + 47;

type Face = { id: number; a0: number; a1: number; at: (a: number, y: number, d: number) => Vec3 };

const FRONT: Face = { id: 1, a0: X0, a1: X1, at: (a, y, d) => [a, y, Z1 + d] };
const SIDE: Face = { id: 2, a0: Z0, a1: Z1, at: (a, y, d) => [X1 + d, y, a] };
const BACK: Face = { id: 3, a0: X0, a1: X1, at: (a, y, d) => [a, y, Z0 - d] };
const LEFT: Face = { id: 4, a0: Z0, a1: Z1, at: (a, y, d) => [X0 - d, y, a] };

const BRICKS = [
	'brick-red',
	'brick-orange',
	'brick-orange',
	'brick-tan',
	'brick-yellow',
	'brick-pale',
];
const IVY = ['ivy-dark', 'ivy', 'ivy', 'ivy-light', 'ivy-pale'];
const IVY_PALETTE = {
	'ivy-dark': '#1f5426',
	ivy: '#2b7429',
	'ivy-light': '#3f9933',
	'ivy-pale': '#62b645',
};

/** Детерминированный хеш трёх целых в [0, 1). */
function hash(a: number, b: number, c: number): number {
	let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Гладкий одномерный шум в [0, 1]. */
function vnoise(x: number, seed: number): number {
	const i = Math.floor(x);
	const f = x - i;
	const t = f * f * (3 - 2 * f);
	return hash(i, seed, 9) * (1 - t) + hash(i + 1, seed, 9) * t;
}

/** Кирпич пояса в точке грани: материал и выступает ли он на воксель. */
function brickAt(f: Face, a: number, y: number): { mat: string; out: boolean } {
	// ряд — 2 вокселя кирпича + шов, кирпич — 5 вокселей + шов; швы утоплены
	const course = Math.floor((y - BAND) / 3);
	const shifted = a - f.a0 + (course % 2) * 3;
	const idx = Math.floor(shifted / 6);
	if ((y - BAND) % 3 === 2 || shifted % 6 === 5) return { mat: 'mortar', out: false };
	return {
		mat: BRICKS[Math.floor(hash(idx, course, f.id) * BRICKS.length)] ?? 'brick-orange',
		out: true,
	};
}

// Одиночные выступающие кирпичи 4×2: [вдоль грани, y].
const LOOSE_FRONT: Array<[number, number]> = [
	[X0 + 34, 31],
	[X0 + 34, 22],
	[X0 + 35, 12],
];
const LOOSE_SIDE: Array<[number, number]> = [
	[Z1 - 3, 8],
	[Z1 - 3, 16],
	[Z1 - 3, 24],
	[Z1 - 3, 33],
	[44, 22],
	[41, 30],
	[36, 38],
	[33, 35],
	[29, 39],
	[26, 33],
	[40, 20],
	[29, 20],
	[22, 26],
];
const inLoose = (list: Array<[number, number]>, a: number, y: number): boolean =>
	list.some(([la, ly]) => a >= la && a <= la + 3 && y >= ly && y <= ly + 1);

// Пиксельный шрифт 3×5.
const FONT: Record<string, string[]> = {
	A: ['.#.', '#.#', '###', '#.#', '#.#'],
	C: ['.##', '#..', '#..', '#..', '.##'],
	E: ['###', '#..', '##.', '#..', '###'],
	F: ['###', '#..', '##.', '#..', '#..'],
	H: ['#.#', '#.#', '###', '#.#', '#.#'],
	I: ['###', '.#.', '.#.', '.#.', '###'],
	K: ['#.#', '#.#', '##.', '#.#', '#.#'],
	N: ['##.', '#.#', '#.#', '#.#', '#.#'],
	O: ['###', '#.#', '#.#', '#.#', '###'],
	P: ['##.', '#.#', '##.', '#..', '#..'],
	R: ['##.', '#.#', '##.', '#.#', '#.#'],
	T: ['###', '.#.', '.#.', '.#.', '.#.'],
	U: ['#.#', '#.#', '#.#', '#.#', '###'],
};

/** Рисует строку: put(колонка, строка снизу). Буква 3 в ширину + 1 пробел. */
function text(s: string, put: (x: number, y: number) => void): void {
	[...s].forEach((ch, i) => {
		FONT[ch]?.forEach((row, r) => {
			[...row].forEach((c, k) => {
				if (c === '#') put(i * 4 + k, 4 - r);
			});
		});
	});
}

const CAT_FACE = [
	'.##........##.',
	'.###......###.',
	'.############.',
	'##..........##',
	'#............#',
	'#..##....##..#',
	'#..##....##..#',
	'#............#',
	'#....#..#....#',
	'#.....##.....#',
	'##..........##',
	'.############.',
];

// ---------- Плющ: панели в пол-вокселя вдоль кирпичного пояса ----------

interface IvyRule {
	base: number;
	vary: number;
	tendril: number;
	minY: number;
}

const IVY_YMIN = 26;
const IVY_OFF = 2; // панель начинается на 2 вокселя внутри стены — над толщиной парапета

/**
 * Панель плюща: ковёр по верху парапета и плети вниз. Локальные оси: x — вдоль грани слева
 * направо на экране, y — вверх от IVY_YMIN, z — наружу от плоскости на IVY_OFF вглубь стены.
 * along(lx) — координата грани для полуколонки, surf(a, y) — глубина первого свободного вокселя.
 */
function ivyPanel(o: {
	width: number;
	along: (lx: number) => number;
	surf: (a: number, y: number) => number;
	rule: (a: number) => IvyRule;
	seed: number;
}): Model {
	const W = o.width * 2;
	const H = 2 * (TOP + 3 - IVY_YMIN);
	return model(
		{ size: [W, H, 2 * (IVY_OFF + 10)], scale: 0.5, pivot: [0, 0, 0], palette: IVY_PALETTE },
		(m) => {
			const leaf = (x: number, y: number, z: number, k: number): void => {
				const i = Math.floor(hash(x * 131 + y, z, o.seed + k) * IVY.length);
				m.set([x, y, z], IVY[i] ?? 'ivy');
			};
			const lzOf = (d: number): number => 2 * (d + IVY_OFF - 1);
			const topRow = 2 * (TOP + 1 - IVY_YMIN);
			for (let lx = 0; lx < W; lx++) {
				const a = o.along(lx);
				// ковёр по верху парапета и выступающих кирпичей
				const lip = lzOf(o.surf(a, TOP));
				const mat = vnoise(lx / 5, o.seed + 1);
				for (let lz = 0; lz < lip; lz++) {
					if (hash(lx, lz, o.seed) < 0.75 + mat * 0.25) leaf(lx, topRow, lz, 1);
					if (hash(lx, lz, o.seed + 1) < 0.15 + mat * 0.45) leaf(lx, topRow + 1, lz, 2);
					if (hash(lx, lz, o.seed + 2) < mat * 0.12) leaf(lx, topRow + 2, lz, 3);
				}
				// плеть вниз по фасаду
				const r = o.rule(a);
				let len = 2 * (r.base + vnoise(lx / 7, o.seed + 2) * r.vary) + hash(lx, 1, o.seed) * 4 - 2;
				if (hash(lx, 2, o.seed) < r.tendril) len += 10 + hash(lx, 3, o.seed) * 24;
				let x = lx;
				for (let i = 0; i < len; i++) {
					const ly = topRow - 1 - i;
					const y = IVY_YMIN + Math.floor(ly / 2);
					if (ly < 0 || y < r.minY) break;
					const lz = lzOf(o.surf(o.along(x), y));
					leaf(x, ly, lz, 4);
					const thick = i < 8 ? 0.85 : i < 18 ? 0.45 : 0.15;
					if (hash(x, ly, o.seed + 4) < thick) leaf(x, ly, lz + 1, 5);
					if (i < 10 && hash(x, ly, o.seed + 5) < 0.45) leaf(x, ly, lz + 2, 6);
					if (i < 6 && hash(x, ly, o.seed + 8) < 0.2) leaf(x, ly, lz + 3, 7);
					if (hash(x, ly, o.seed + 6) < 0.14) {
						const nx = x + (hash(x, ly, o.seed + 7) < 0.5 ? 1 : -1);
						if (nx >= 0 && nx < W) x = nx;
					}
				}
			}
		},
	);
}

/** Глубина первого свободного вокселя перед гранью (1 — сразу у стены). */
const bandSurf =
	(f: Face) =>
	(a: number, y: number): number | null =>
		y >= BAND && y <= TOP ? (brickAt(f, a, y).out ? 2 : 1) : null;

function frontSurf(x: number, y: number): number {
	const band = bandSurf(FRONT)(x, y);
	if (band !== null) return band;
	if (x >= X0 && x <= AW) {
		if (y >= 35 && y <= 37) return 8; // фартук маркизы
		if (y >= 38 && y <= 42) return 44 - y; // скат маркизы
	}
	return inLoose(LOOSE_FRONT, x, y) ? 2 : 1;
}

function sideSurf(z: number, y: number): number {
	const band = bandSurf(SIDE)(z, y);
	if (z >= Z0 + 1 && z <= Z0 + 2 && y >= 20 && y <= 44) return 3; // стояк
	if (band !== null) return band;
	if (z >= Z0 + 4 && z <= Z0 + 16 && y >= 31 && y <= 40) return 2; // панель под кондиционер
	return inLoose(LOOSE_SIDE, z, y) ? 2 : 1;
}

const plainSurf =
	(f: Face) =>
	(a: number, y: number): number =>
		bandSurf(f)(a, y) ?? 1;

const near = (a: number, centers: number[], r: number): boolean =>
	centers.some((c) => Math.abs(a - c) <= r);

const POTS = [
	{ z: 39, y: 22, flower: '#f2d43a', seed: 11 },
	{ z: 32, y: 22, flower: '#c25ad8', seed: 23 },
	{ z: 25.5, y: 24, flower: '#f4f4f4', seed: 37 },
];

function frontRule(x: number): IvyRule {
	const u = x - X0;
	if (u <= 16) return { base: 11, vary: 6, tendril: 0.15, minY: 38 };
	if (u <= 31) return { base: 2, vary: 8, tendril: 0.08, minY: 38 };
	if (u <= 37) return { base: 3, vary: 8, tendril: 0.3, minY: 26 };
	return { base: 9, vary: 8, tendril: 0.35, minY: 28 };
}

function sideRule(z: number): IvyRule {
	if (z <= Z0 + 17) return { base: 9, vary: 5, tendril: 0, minY: 41 };
	if (near(z, [43], 3)) return { base: 10, vary: 5, tendril: 0, minY: 40 };
	if (
		near(
			z,
			POTS.map((p) => p.z),
			3,
		)
	)
		return { base: 10, vary: 7, tendril: 0.25, minY: 36 };
	return { base: 11, vary: 9, tendril: 0.4, minY: 26 };
}

const plainRule = (): IvyRule => ({ base: 7, vary: 8, tendril: 0.15, minY: 26 });

/** Две панели на грань (модель ≤ 64 полувокселей в ширину). */
function ivyEntities(): Array<{ id: string; model: Model; at: Vec3; rotate: number }> {
	const out: Array<{ id: string; model: Model; at: Vec3; rotate: number }> = [];
	const halves = (a0: number, a1: number): Array<[number, number]> => {
		const mid = Math.floor((a0 + a1) / 2);
		return [
			[a0, mid],
			[mid + 1, a1],
		];
	};
	halves(X0, X1).forEach(([a0, a1], i) => {
		out.push({
			id: `ivyFront${i}`,
			model: ivyPanel({
				width: a1 - a0 + 1,
				along: (lx) => a0 + Math.floor(lx / 2),
				surf: frontSurf,
				rule: frontRule,
				seed: 100 + i,
			}),
			at: [a0, IVY_YMIN, Z1 + 1 - IVY_OFF],
			rotate: 0,
		});
	});
	halves(Z0, Z1).forEach(([a0, a1], i) => {
		out.push({
			id: `ivySide${i}`,
			model: ivyPanel({
				width: a1 - a0 + 1,
				along: (lx) => a1 - Math.floor(lx / 2),
				surf: sideSurf,
				rule: sideRule,
				seed: 200 + i,
			}),
			at: [X1 + 1 - IVY_OFF, IVY_YMIN, a1 + 1],
			rotate: 90,
		});
	});
	halves(X0, X1).forEach(([a0, a1], i) => {
		out.push({
			id: `ivyBack${i}`,
			model: ivyPanel({
				width: a1 - a0 + 1,
				along: (lx) => a1 - Math.floor(lx / 2),
				surf: plainSurf(BACK),
				rule: plainRule,
				seed: 300 + i,
			}),
			at: [a1 + 1, IVY_YMIN, Z0 + IVY_OFF],
			rotate: 180,
		});
	});
	halves(Z0, Z1).forEach(([a0, a1], i) => {
		out.push({
			id: `ivyLeft${i}`,
			model: ivyPanel({
				width: a1 - a0 + 1,
				along: (lx) => a0 + Math.floor(lx / 2),
				surf: plainSurf(LEFT),
				rule: plainRule,
				seed: 400 + i,
			}),
			at: [X0 + IVY_OFF, IVY_YMIN, a0],
			rotate: 270,
		});
	});
	return out;
}

// ---------- Модели в пол-вокселя (лицо — +z) ----------

function awningText(): Model {
	return model(
		{ size: [64, 7, 1], scale: 0.5, pivot: [0, 0, 0], palette: { letter: '#f3f0e4' } },
		(m) => {
			text('CHIKURT', (x, y) => m.set([6 + x, 1 + y, 0], 'letter'));
			text('CAFE', (x, y) => m.set([47 + x, 1 + y, 0], 'letter'));
		},
	);
}

function coffeeSign(): Model {
	return model(
		{
			size: [28, 38, 6],
			scale: 0.4,
			palette: {
				frame: '#cfd3d8',
				'frame-dark': '#7d838b',
				board: '#f6f5f0',
				red: '#c4282a',
				ink: '#1d1d1f',
				letter: '#fbfbf7',
			},
		},
		(m) => {
			for (const x of [2, 24]) m.box([x, 1, 2], [x + 1, 10, 3], 'frame');
			m.box([0, 0, 0], [5, 0, 5], 'frame-dark');
			m.box([22, 0, 0], [27, 0, 5], 'frame-dark');
			m.box([0, 10, 1], [27, 37, 4], 'frame');
			m.box([2, 12, 1], [25, 35, 4], 'board');
			m.box([2, 12, 4], [25, 20, 4], 'red');
			m.box([2, 12, 1], [25, 20, 1], 'red');
			for (const z of [1, 4]) {
				text('COFFEE', (x, y) => m.set([2 + x, 14 + y, z], 'letter'));
				CAT_FACE.forEach((row, r) => {
					[...row].forEach((c, k) => {
						if (c === '#') m.set([7 + k, 33 - r, z], 'ink');
					});
				});
			}
			// рамка выступает над доской
			for (const z of [0, 5]) {
				m.box([0, 10, z], [1, 37, z], 'frame');
				m.box([26, 10, z], [27, 37, z], 'frame');
				m.box([0, 36, z], [27, 37, z], 'frame');
				m.box([0, 10, z], [27, 11, z], 'frame');
			}
		},
	);
}

function openSign(): Model {
	return model(
		{
			size: [17, 12, 2],
			scale: 0.35,
			palette: { plate: '#f4f2ec', ink: '#2a2420', rope: '#5a3a24' },
		},
		(m) => {
			m.box([0, 0, 0], [16, 6, 1], 'plate');
			text('OPEN', (x, y) => m.set([1 + x, 1 + y, 1], 'ink'));
			m.line([2, 7, 0], [8, 11, 0], 'rope');
			m.line([14, 7, 0], [8, 11, 0], 'rope');
		},
	);
}

const CAKE_COLORS = ['pink', 'mint', 'lemon', 'lavender', 'choco', 'pink', 'lemon', 'mint'];

function cakes(): Model {
	return model(
		{
			size: [54, 11, 6],
			scale: 0.5,
			palette: {
				tray: '#4a2a1c',
				sponge: '#e8c27a',
				cream: '#fff3dc',
				pink: '#f2a2bd',
				mint: '#9fdcb8',
				lemon: '#f3dc6a',
				lavender: '#c6a8e6',
				choco: '#6b3a22',
				berry: '#d8283a',
			},
		},
		(m) => {
			m.box([0, 5, 0], [53, 5, 5], 'tray');
			CAKE_COLORS.forEach((color, i) => {
				const x = 1 + Math.floor(i * 6.6);
				m.box([x, 0, 1], [x + 4, 4, 4], 'sponge');
				m.box([x, 1, 1], [x + 4, 1, 4], color);
				m.box([x, 3, 1], [x + 4, 3, 4], color);
				m.box([x, 4, 1], [x + 4, 4, 4], 'cream');
				m.set([x + 2, 5, 3], 'berry');
			});
			for (let i = 0; i < 9; i++) {
				const x = 1 + Math.floor(i * 5.8);
				const color = CAKE_COLORS[(i + 3) % CAKE_COLORS.length] ?? 'pink';
				m.box([x, 6, 1], [x + 3, 7, 3], color);
				m.box([x, 8, 1], [x + 3, 8, 3], 'cream');
				if (i % 2 === 0) m.set([x + 1, 9, 2], 'berry');
			}
		},
	);
}

/** Зелень в кирпичной клумбе: стебли с листьями. */
function bush(): Model {
	return model(
		{
			size: [26, 16, 10],
			scale: 0.5,
			palette: { ...IVY_PALETTE, stem: '#2a5a24' },
		},
		(m) => {
			for (let x = 0; x < 26; x++) {
				for (let z = 0; z < 10; z++) {
					if (hash(x, z, 77) > 0.4) continue;
					const h = 6 + Math.floor(hash(x, z, 78) * 9);
					m.box([x, 0, z], [x, h, z], 'stem');
					for (let y = 2; y <= h + 1; y++) {
						for (const [dx, dz] of [
							[1, 0],
							[-1, 0],
							[0, 1],
							[0, -1],
							[0, 0],
						] as const) {
							if (hash(x * 31 + dx, y * 17 + z + dz, 79) < 0.35) {
								const i = Math.floor(hash(x + dx, y, z + dz) * IVY.length);
								m.set([x + dx, y, z + dz], IVY[i] ?? 'ivy');
							}
						}
					}
				}
			}
		},
	);
}

function potPlant(pot: string, flower: string, seed: number, scale = 0.5): Model {
	return model(
		{
			size: [10, 18, 8],
			scale,
			palette: { pot, soil: '#4a3222', leaf: '#3f8f35', 'leaf-dark': '#2a6a2a', flower },
		},
		(m) => {
			m.box([1, 0, 1], [8, 5, 6], 'pot');
			m.box([0, 6, 0], [9, 6, 7], 'pot');
			m.box([1, 6, 1], [8, 6, 6], 'soil');
			for (let x = 1; x <= 8; x++) {
				for (let z = 1; z <= 6; z++) {
					const h = 7 + Math.floor(hash(x, z, seed) * 6);
					if (hash(x, z, seed + 1) < 0.35) m.box([x, 7, z], [x, h, z], 'leaf-dark');
					if (hash(x, z, seed + 2) < 0.5) m.set([x, h, z], 'leaf');
					if (hash(x, z, seed + 3) < 0.3) m.set([x, h + 1, z], 'flower');
				}
			}
		},
	);
}

function hangingPot(flower: string, seed: number): Model {
	return model(
		{
			size: [12, 26, 9],
			scale: 0.5,
			palette: {
				pot: '#f1f1ee',
				soil: '#4a3222',
				leaf: '#3f8f35',
				'leaf-dark': '#2a6a2a',
				flower,
				rope: '#6b4428',
			},
		},
		(m) => {
			m.box([1, 5, 1], [10, 10, 7], 'pot');
			m.box([2, 10, 2], [9, 10, 6], 'soil');
			for (let x = 0; x <= 11; x++) {
				for (let z = 0; z <= 8; z++) {
					const r = hash(x, z, seed);
					if (r < 0.55) m.box([x, 11, z], [x, 11 + Math.floor(r * 5), z], 'leaf');
					if (hash(x, z, seed + 1) < 0.25) m.set([x, 12 + Math.floor(r * 3), z], 'flower');
				}
			}
			// плети свисают по передней стенке
			for (let x = 1; x <= 10; x++) {
				if (hash(x, 0, seed + 2) < 0.45) {
					const len = 2 + Math.floor(hash(x, 1, seed + 2) * 8);
					m.box([x, 11 - len, 8], [x, 10, 8], hash(x, 2, seed) < 0.5 ? 'leaf' : 'leaf-dark');
				}
			}
			m.line([1, 11, 1], [5, 25, 0], 'rope');
			m.line([10, 11, 1], [6, 25, 0], 'rope');
		},
	);
}

function condenser(): Model {
	return model(
		{
			size: [22, 26, 10],
			scale: 0.5,
			palette: {
				case: '#e9ecef',
				shade: '#b9bfc5',
				grill: '#5a5f66',
				dark: '#2c2f34',
			},
		},
		(m) => {
			m.box([0, 3, 0], [21, 25, 9], 'case');
			m.box([1, 0, 1], [3, 2, 8], 'dark');
			m.box([18, 0, 1], [20, 2, 8], 'dark');
			for (let x = 1; x <= 15; x++) {
				for (let y = 7; y <= 21; y++) {
					const dx = x - 8;
					const dy = y - 14;
					const r = Math.hypot(dx, dy);
					if (r > 6.6) continue;
					if (r > 5.6) {
						m.set([x, y, 9], 'dark');
						continue;
					}
					m.set([x, y, 9], 'air');
					const blade = Math.floor(((Math.atan2(dy, dx) + Math.PI) / Math.PI) * 3) % 2 === 0;
					m.set([x, y, 8], r < 1.5 ? 'case' : blade ? 'grill' : 'dark');
				}
			}
			for (let y = 6; y <= 22; y += 2) m.box([16, y, 9], [19, y, 9], 'shade');
		},
	);
}

function acUnit(): Model {
	return model(
		{
			size: [20, 11, 7],
			scale: 0.5,
			palette: { case: '#eef0f2', shade: '#b9bfc5', dark: '#2c2f34' },
		},
		(m) => {
			m.box([0, 0, 0], [19, 8, 6], 'case');
			m.box([1, 9, 1], [3, 10, 5], 'case');
			m.box([16, 9, 1], [18, 10, 5], 'case');
			m.box([1, 0, 6], [18, 1, 6], 'shade');
			m.box([2, 1, 6], [17, 1, 6], 'dark');
			for (const x of [5, 13]) m.box([x, 4, 6], [x + 1, 6, 6], 'dark');
			m.box([9, 3, 6], [10, 3, 6], 'dark');
		},
	);
}

function meter(): Model {
	return model(
		{
			size: [8, 12, 3],
			scale: 0.5,
			palette: { case: '#eef0f2', screen: '#1f2226', dark: '#55595f' },
		},
		(m) => {
			m.box([0, 0, 0], [7, 11, 2], 'case');
			m.box([2, 4, 2], [5, 9, 2], 'screen');
			m.box([3, 1, 2], [4, 2, 2], 'dark');
		},
	);
}

function vent(): Model {
	return model(
		{
			size: [10, 10, 3],
			scale: 0.5,
			palette: { metal: '#d2d6da', slat: '#6f747b' },
		},
		(m) => {
			for (let x = 0; x < 10; x++) {
				for (let y = 0; y < 10; y++) {
					const r = Math.hypot(x - 4.5, y - 4.5);
					if (r > 4.9) continue;
					m.box([x, y, 0], [x, y, 1], 'metal');
					m.set([x, y, 2], r > 3.8 || y % 2 === 1 ? 'metal' : 'slat');
				}
			}
		},
	);
}

function gasTank(): Model {
	return model(
		{
			size: [10, 36, 10],
			scale: 0.5,
			palette: {
				tank: '#6b7078',
				ring: '#8a9098',
				valve: '#2a2c31',
				label: '#f0f0ec',
				mark: '#c4282a',
			},
		},
		(m) => {
			m.cylinder([4.5, 0, 4.5], 4.2, 1, 'ring');
			m.cylinder([4.5, 1, 4.5], 4.8, 29, 'tank');
			m.cylinder([4.5, 27, 4.5], 4.8, 1, 'ring');
			m.cylinder([4.5, 30, 4.5], 3.7, 2, 'tank');
			m.cylinder([4.5, 32, 4.5], 2.3, 1, 'tank');
			m.cylinder([4.5, 33, 4.5], 1.2, 2, 'valve');
			m.box([2, 35, 4], [7, 35, 5], 'valve');
			m.cylinder([4.5, 14, 4.5], 4.8, 9, 'label');
			// красный знак на лицевой стороне
			for (let x = 1; x <= 8; x++) {
				const z = Math.floor(4.5 + Math.sqrt(Math.max(0, 4.8 ** 2 - (x - 4.5) ** 2)));
				for (let y = 15; y <= 21; y++) {
					const u = x - 4.5;
					const v = y - 18;
					if (Math.abs(Math.abs(u) - Math.abs(v)) < 1 || y === 15 || y === 21) {
						m.set([x, y, Math.min(z, 9)], 'mark');
					}
				}
			}
		},
	);
}

// ---------- Мир ----------

/*
 * Код описывает здание фасадом на +z, а в мире оно повёрнуто на 90°: фасад смотрит на +x, под
 * утреннее солнце (восход с +x), боковая стена — на −z, в тень, как на референсе.
 */
const CODE_SIZE: Vec3 = [72, 64, 66];
/** Точка (не воксель) из координат кода в мировые. */
const place = (p: Vec3): Vec3 => [p[2], p[1], CODE_SIZE[0] - p[0]];
const rotVoxel = (p: Vec3): Vec3 => [p[2], p[1], CODE_SIZE[0] - 1 - p[0]];

type Canvas = Pick<WorldBuilder, 'set' | 'box' | 'line' | 'clear' | 'get' | 'rng'>;

function rotated(w: WorldBuilder): Canvas {
	return {
		rng: w.rng,
		set: (p, m) => w.set(rotVoxel(p), m),
		box: (a, b, m) => w.box(rotVoxel(a), rotVoxel(b), m),
		line: (a, b, m) => w.line(rotVoxel(a), rotVoxel(b), m),
		clear: (a, b) => w.clear(rotVoxel(a), rotVoxel(b)),
		get: (p) => w.get(rotVoxel(p)),
	};
}

function bricks(w: Canvas, f: Face): void {
	for (let y = BAND; y <= TOP; y++) {
		for (let a = f.a0; a <= f.a1; a++) {
			const b = brickAt(f, a, y);
			w.set(f.at(a, y, 0), b.mat);
			if (b.out) w.set(f.at(a, y, 1), b.mat);
		}
	}
}

/** Одиночный выступающий кирпич 4×2. */
function looseBrick(w: Canvas, f: Face, a: number, y: number): void {
	const mat = BRICKS[Math.floor(hash(a, y, f.id + 7) * BRICKS.length)] ?? 'brick-orange';
	w.box(f.at(a, y, 1), f.at(a + 3, y + 1, 1), mat);
}

type Placement = { id: string; model: Model; at: Vec3; rotate?: number };

const ENTITIES: Placement[] = [
	...ivyEntities(),
	{ id: 'awningText', model: awningText(), at: [X0, 35, Z1 + 8] },
	{ id: 'bush', model: bush(), at: [X0 + 12.5, G + 10, Z1 + 3.5] },
	{ id: 'sign', model: coffeeSign(), at: [X1 + 2, G, Z1 + 5], rotate: 5 },
	{ id: 'cakes', model: cakes(), at: [X0 + 17.5, 17, Z1 + 2.5] },
	{ id: 'openSign', model: openSign(), at: [N0 + 5.5, 19, Z1 - 3.65] },
	{ id: 'frontPot', model: potPlant('#2c4c9c', '#f2d43a', 5, 0.35), at: [X0 + 2, 25, Z1 + 2.5] },
	{
		id: 'sidePot',
		model: potPlant('#2c4c9c', '#e889c0', 9),
		at: [X1 + 3.5, 17, 33.5],
		rotate: 90,
	},
	{ id: 'condenser', model: condenser(), at: [X1 + 4.5, G, 33.5], rotate: 90 },
	{ id: 'ac', model: acUnit(), at: [X1 + 3.75, 33, Z0 + 10], rotate: 90 },
	{ id: 'meter', model: meter(), at: [X1 + 1.75, 22, Z0 + 6], rotate: 90 },
	{ id: 'vent', model: vent(), at: [X1 + 1.75, 34, 43], rotate: 90 },
	...[24.5, 19, 13.5].map((z, i) => ({
		id: `tank${i}`,
		model: gasTank(),
		at: [X1 + 4.5, G + 1, z] as Vec3,
		rotate: 90,
	})),
	...POTS.map((p, i) => ({
		id: `pot${i}`,
		model: hangingPot(p.flower, p.seed),
		at: [X1 + 3.25, p.y, p.z] as Vec3,
		rotate: 90,
	})),
];

export default defineDiorama({
	meta: {
		title: 'Кошачья кофейня',
		createdAt: '2026-10-07',
		author: { model: 'Claude Opus 5.5', effort: 'high', context: '1M' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'Угловая кофейня, оплетённая плющом: маркиза, витрина с пирожными, тёплая ниша у двери и вывеска с котом',
		tags: ['кофейня', 'город', 'плющ', 'уют'],
	},
	seed: 1729,
	size: [CODE_SIZE[2], CODE_SIZE[1], CODE_SIZE[0]],
	palette: {
		slab: '#4a3c36',
		paint: '#ece8e0',
		wall: '#c18f62',
		mortar: '#6e4c38',
		'wall-dark': '#ad8762',
		'wall-panel': '#d4ae84',
		'wall-warm': { color: '#e0a060', emissive: 0.5 },
		'wall-inner': '#c98f5a',
		roof: '#5e4636',
		'brick-red': '#b14d28',
		'brick-orange': '#cc6630',
		'brick-tan': '#d98a48',
		'brick-yellow': '#e2a63e',
		'brick-pale': '#ecc68a',
		awning: '#5f8d48',
		frame: '#4a2216',
		ledge: '#7b2a1a',
		door: '#7a2618',
		'door-glass': { color: '#e8822e', emissive: 0.9 },
		window: { color: '#6a3a22', kind: 'glass' },
		'case-glass': { color: '#eef6f6', kind: 'glass' },
		'case-light': { color: '#fffaf0', emissive: 1.2 },
		white: '#f1efe9',
		interior: { color: '#8a3e20', emissive: 0.45 },
		'floor-in': '#6a3a22',
		blind: '#5a2e1c',
		menu: '#e9c23c',
		'menu-ink': '#7a4a12',
		lamp: { color: '#ffd27a', emissive: 2.5 },
		step: '#d3c7b8',
		soil: '#4a3222',
		planter: '#e6d6b4',
		ivy: '#2b7429',
		'ivy-dark': '#1f5426',
		'flower-yellow': '#f2d43a',
		rope: '#6b4428',
		shelf: '#8a5a34',
		gold: '#d8a428',
		pipe: '#e4e7ea',
		duct: '#4f535a',
		cable: '#26282c',
		'metal-dark': '#3c3f45',
		frame3d: '#a7bccd',
	},
	build(world) {
		const w = rotated(world);
		// Плита основания с разметкой.
		w.box([4, 0, 2], [67, 1, 62], 'slab');
		w.box([30, 1, 60], [67, 1, 60], 'paint');
		w.box([4, 1, 60], [12, 1, 60], 'paint');

		// Коробка здания и крыша за парапетом.
		w.box([X0, G, Z0], [X1, TOP, Z1], 'wall');
		w.box([X0 + 1, ROOF + 1, Z0 + 1], [X1 - 1, TOP, Z1 - 1], 'wall-inner');
		w.clear([X0 + 2, ROOF + 1, Z0 + 2], [X1 - 2, TOP, Z1 - 2]);
		w.box([X0 + 2, ROOF, Z0 + 2], [X1 - 2, ROOF, Z1 - 2], 'roof');
		// металлическая рама на крыше
		const R = ROOF + 4;
		w.line([16, R, 12], [36, R, 12], 'frame3d');
		w.line([36, R, 12], [36, R, 26], 'frame3d');
		w.line([36, R, 26], [16, R, 26], 'frame3d');
		w.line([16, R, 26], [16, R, 12], 'frame3d');
		w.line([16, R, 19], [36, R, 19], 'frame3d');
		for (const [x, z] of [
			[16, 12],
			[36, 12],
			[36, 26],
			[16, 26],
		] as const) {
			w.box([x, ROOF + 1, z], [x, R - 1, z], 'frame3d');
		}
		w.box([24, ROOF + 1, 32], [30, ROOF + 1, 38], 'metal-dark');

		// Кирпичный пояс по всем граням.
		for (const f of [FRONT, SIDE, BACK, LEFT]) bricks(w, f);

		// --- Фасад ---
		// Кирпичная клумба.
		w.box([X0, G, Z1 + 1], [X0 + 18, G + 9, Z1 + 5], 'soil');
		const planterFaces: Face[] = [
			{ id: 5, a0: X0, a1: X0 + 18, at: (a, y, d) => [a, y, Z1 + 5 + d] },
			{ id: 6, a0: Z1 + 1, a1: Z1 + 5, at: (a, y, d) => [X0 - d, y, a] },
			{ id: 7, a0: Z1 + 1, a1: Z1 + 5, at: (a, y, d) => [X0 + 18 + d, y, a] },
		];
		for (const f of planterFaces) {
			for (let y = G; y <= G + 9; y++) {
				for (let a = f.a0; a <= f.a1; a++) {
					const b = brickAt(f, a, y + BAND - G);
					w.set(f.at(a, y, 0), b.mat);
					if (b.out) w.set(f.at(a, y, 1), b.mat);
				}
			}
		}
		// кремовый ящик с жёлтыми цветами
		w.box([X0 - 1, G + 10, Z1 + 2], [X0 + 5, G + 11, Z1 + 5], 'planter');
		for (let x = X0 - 1; x <= X0 + 5; x++) {
			for (let z = Z1 + 2; z <= Z1 + 5; z++) {
				if (w.rng.chance(0.6)) w.set([x, G + 12, z], 'ivy');
				if (w.rng.chance(0.35)) w.set([x, G + 13, z], 'flower-yellow');
			}
		}

		// Комната за витриной.
		w.box([X0 + 3, 5, Z1 - 11], [X0 + 34, 42, Z1 - 2], 'interior');
		w.clear([X0 + 4, 6, Z1 - 10], [X0 + 33, 41, Z1 - 2]);
		w.box([X0 + 4, 5, Z1 - 10], [X0 + 33, 5, Z1 - 2], 'floor-in');
		// окно: рама, стекло, жалюзи, меню-доска
		w.box([X0 + 3, 24, Z1], [X0 + 34, 42, Z1], 'frame');
		w.clear([X0 + 4, 25, Z1 - 1], [X0 + 33, 41, Z1]);
		w.box([X0 + 4, 25, Z1 - 1], [X0 + 33, 41, Z1 - 1], 'window');
		for (const x of [X0 + 12, X0 + 20, X0 + 28]) w.box([x, 25, Z1 - 1], [x, 41, Z1], 'frame');
		// подвесные лампы в зале
		for (const x of [X0 + 8, X0 + 16, X0 + 24]) {
			w.line([x, 32, Z1 - 5], [x, 41, Z1 - 5], 'cable');
			w.box([x - 1, 31, Z1 - 6], [x + 1, 31, Z1 - 4], 'lamp');
		}
		for (let y = 26; y <= 41; y += 2) w.box([X0 + 29, y, Z1 - 2], [X0 + 33, y, Z1 - 2], 'blind');
		for (let y = 30; y <= 41; y += 2) w.box([X0 + 12, y, Z1 - 2], [X0 + 27, y, Z1 - 2], 'blind');
		w.box([X0 + 5, 26, Z1 - 2], [X0 + 10, 39, Z1 - 2], 'menu');
		for (let y = 28; y <= 37; y += 2) w.box([X0 + 6, y, Z1 - 2], [X0 + 9, y, Z1 - 2], 'menu-ink');

		// Полка и стеклянная витрина.
		w.box([X0 + 2, 16, Z1 + 1], [X0 + 34, 16, Z1 + 5], 'ledge');
		w.box([X0 + 3, 17, Z1 + 1], [X0 + 31, 23, Z1 + 4], 'case-glass');
		w.clear([X0 + 4, 17, Z1 + 1], [X0 + 30, 23, Z1 + 3]);
		w.box([X0 + 4, 23, Z1 + 1], [X0 + 30, 23, Z1 + 3], 'case-light');
		w.box([X0 + 3, 24, Z1 + 1], [X0 + 31, 24, Z1 + 4], 'white');
		// полочка под горшок слева от окна
		w.box([X0, 24, Z1 + 1], [X0 + 3, 24, Z1 + 3], 'ledge');

		// Маркиза: скат ступенями, вертикальный фартук и зубцы.
		for (let k = 0; k <= 5; k++) {
			w.box([X0, 41 - k, Z1 + 1 + k], [AW, 42 - k, Z1 + 1 + k], 'awning');
		}
		w.box([X0, 35, Z1 + 7], [AW, 37, Z1 + 7], 'awning');
		for (let x = X0; x <= AW; x++) if ((x - X0) % 4 < 2) w.set([x, 34, Z1 + 7], 'awning');
		for (const x of [X0, AW]) {
			for (let k = 0; k <= 6; k++) w.box([x, 35, Z1 + 1 + k], [x, 42 - k, Z1 + 1 + k], 'awning');
		}
		// подвесной ящик у левого края маркизы
		w.box([X0 - 4, 32, Z1 + 2], [X0 - 1, 33, Z1 + 4], 'planter');
		w.line([X0 - 1, 34, Z1 + 3], [X0 - 1, 37, Z1 + 3], 'rope');
		for (let x = X0 - 4; x <= X0 - 1; x++) {
			for (let z = Z1 + 2; z <= Z1 + 4; z++) {
				if (w.rng.chance(0.6)) w.set([x, 34, z], 'ivy');
				if (w.rng.chance(0.4)) w.set([x, 35, z], 'flower-yellow');
			}
			if (w.rng.chance(0.5)) w.box([x, 29, Z1 + 5], [x, 32, Z1 + 5], 'ivy-dark');
		}

		// Ниша с дверью и ступенями.
		w.clear([N0, 6, Z1 - 4], [N1, 40, Z1]);
		w.box([N0 - 1, 6, Z1 - 4], [N0 - 1, 40, Z1], 'wall-warm');
		w.box([N1 + 1, 6, Z1 - 4], [N1 + 1, 40, Z1], 'wall-warm');
		w.box([N0, 5, Z1 - 4], [N1, 5, Z1], 'step');
		for (let k = 0; k < 3; k++) w.box([N0, G, Z1 + 1 + k], [N1, G + 2 - k, Z1 + 1 + k], 'step');
		w.box([N0 + 2, 41, Z1 - 3], [N1 - 2, 41, Z1 - 1], 'lamp');
		const D0 = N0 + 1;
		const D1 = N0 + 8;
		w.box([N0, 6, Z1 - 5], [N1, 40, Z1 - 5], 'wall-warm');
		w.box([D0, 6, Z1 - 5], [D1, 37, Z1 - 5], 'door');
		w.box([D0 + 1, 11, Z1 - 5], [D1 - 1, 29, Z1 - 5], 'door-glass');
		for (const y of [16, 21, 26]) w.box([D0 + 1, y, Z1 - 5], [D1 - 1, y, Z1 - 5], 'door');
		w.box([D0 + 1, 31, Z1 - 5], [D1 - 1, 36, Z1 - 5], 'door-glass');
		w.box([D0 + 1, 39, Z1 - 4], [D1 - 1, 39, Z1 - 4], 'lamp');
		w.set([D0 + 1, 18, Z1 - 4], 'gold');

		// Кирпичи на простенке и углу.
		for (const [x, y] of LOOSE_FRONT) looseBrick(w, FRONT, x, y);

		// --- Боковая стена ---
		// нижний пояс выступает на воксель
		w.box([X1 + 1, G, Z0 + 2], [X1 + 1, 18, Z1 - 12], 'wall-dark');
		// светлая панель под кондиционер
		w.box([X1 + 1, 31, Z0 + 4], [X1 + 1, 40, Z0 + 16], 'wall-panel');
		// труба-стояк с кронштейном
		w.box([X1 + 1, 20, Z0 + 1], [X1 + 2, 50, Z0 + 2], 'duct');
		w.box([X1 + 3, 34, Z0 + 1], [X1 + 6, 34, Z0 + 2], 'pipe');
		w.box([X1 + 6, 34, Z0 + 1], [X1 + 6, 38, Z0 + 2], 'pipe');
		// трубки и кабели от кондиционера
		w.line([X1 + 2, 35, Z0 + 4], [X1 + 2, 35, Z0 + 3], 'pipe');
		w.box([X1 + 2, 29, Z0 + 8], [X1 + 2, 32, Z0 + 8], 'cable');
		w.box([X1 + 2, 29, Z0 + 5], [X1 + 2, 32, Z0 + 5], 'cable');
		// полка над внешним блоком
		w.box([X1 + 1, 16, 27], [X1 + 6, 16, 40], 'shelf');
		// подставка под баллоны и цепь
		w.box([X1 + 1, G, Z0 + 4], [X1 + 7, G, 27], 'metal-dark');
		w.line([X1 + 2, 13, 27], [X1 + 7, 13, 26], 'metal-dark');
		w.line([X1 + 7, 13, 26], [X1 + 7, 13, Z0 + 5], 'metal-dark');
		w.line([X1 + 7, 13, Z0 + 5], [X1 + 2, 13, Z0 + 4], 'metal-dark');
		for (const [z, y] of LOOSE_SIDE) looseBrick(w, SIDE, z, y);
	},
	entities: ENTITIES.map((e) => ({ ...e, at: place(e.at), rotate: ((e.rotate ?? 0) + 90) % 360 })),
	lights: [
		pointLight({ at: place([N0 + 5, 38, Z1 - 2]), color: '#ffb45a', intensity: 24, distance: 20 }),
		pointLight({ at: place([X0 + 18, 32, Z1 - 6]), color: '#ffb060', intensity: 10, distance: 22 }),
		pointLight({ at: place([X0 + 17, 22, Z1 + 3]), color: '#fff4e0', intensity: 2, distance: 7 }),
	],
	atmosphere: { time: { start: 9, speed: 0 }, sky: { kind: 'solid', color: '#d9d9df' } },
	camera: { position: place([100, 68, 132]), target: place([38, 26, 30]) },
});
