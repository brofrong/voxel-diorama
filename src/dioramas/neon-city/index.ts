import {
	type Behaviour,
	bob,
	custom,
	defineDiorama,
	type Model,
	mist,
	model,
	pointLight,
	prefabs,
	type Rng,
	sparks,
	type Vec3,
	type WorldBuilder,
	walkPath,
} from '#sdk';

/*
 * Неоновый город ночью: сетка 3×3 кварталов, между ними две продольные (вдоль z) и две
 * поперечные (вдоль x) улицы. Квартал — четыре угловых участка 2×2, поэтому каждый отрезок
 * улицы между перекрёстками обставлен четырьмя зданиями — по два с каждой стороны. Здания
 * генерируются: шесть стилей корпуса, витрины с козырьками и вывесками на улицу, вертикальные
 * вывески, щиты, кондиционеры и трубы, техника и шпили на крышах. В центре — самые высокие.
 * Машины ездят петлями (полоса туда, разворот у края, полоса обратно), летающие — над улицами.
 */

const N = 122;
const G = 3; // уровень дороги; тротуары и кварталы на воксель выше
const BLOCKS = [2, 46, 90]; // начала кварталов по x и по z, ширина 30
const ROADS = [38.5, 82.5]; // середины улиц
const ROAD_HALF = 5; // проезжая часть — 10 вокселей, по краям тротуары по 2

// ---------- Шрифт ----------

const FONT: Record<string, string[]> = {
	A: ['.#.', '#.#', '###', '#.#', '#.#'],
	B: ['##.', '#.#', '##.', '#.#', '##.'],
	C: ['.##', '#..', '#..', '#..', '.##'],
	D: ['##.', '#.#', '#.#', '#.#', '##.'],
	E: ['###', '#..', '##.', '#..', '###'],
	G: ['.##', '#..', '#.#', '#.#', '.##'],
	H: ['#.#', '#.#', '###', '#.#', '#.#'],
	I: ['###', '.#.', '.#.', '.#.', '###'],
	K: ['#.#', '#.#', '##.', '#.#', '#.#'],
	L: ['#..', '#..', '#..', '#..', '###'],
	M: ['#.#', '###', '#.#', '#.#', '#.#'],
	N: ['##.', '#.#', '#.#', '#.#', '#.#'],
	O: ['###', '#.#', '#.#', '#.#', '###'],
	P: ['##.', '#.#', '##.', '#..', '#..'],
	R: ['##.', '#.#', '##.', '#.#', '#.#'],
	S: ['.##', '#..', '.#.', '..#', '##.'],
	T: ['###', '.#.', '.#.', '.#.', '.#.'],
	U: ['#.#', '#.#', '#.#', '#.#', '###'],
	V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
	X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
	Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
	Z: ['###', '..#', '.#.', '#..', '###'],
	'0': ['###', '#.#', '#.#', '#.#', '###'],
	'1': ['.#.', '##.', '.#.', '.#.', '###'],
	'2': ['##.', '..#', '.#.', '#..', '###'],
	'4': ['#.#', '#.#', '###', '..#', '..#'],
	'8': ['###', '#.#', '###', '#.#', '###'],
};

const WORDS = [
	'BAR',
	'RAMEN',
	'HOTEL',
	'CYBER',
	'NEON',
	'SUSHI',
	'CLUB',
	'TECH',
	'24H',
	'DATA',
	'NOVA',
	'SYNTH',
	'VOID',
	'ZERO',
	'MECHA',
	'PIXEL',
	'DRIVE',
	'GRID',
	'2088',
	'BIO',
	'NOIR',
	'KIDO',
];

const textWidth = (s: string): number => s.length * 4 - 1;

/** Случайное слово не шире maxWidth; null — если не влезает ни одно. */
function pickWord(rng: Rng, maxWidth: number): string | null {
	const fits = WORDS.filter((s) => textWidth(s) <= maxWidth);
	return fits.length > 0 ? rng.pick(fits) : null;
}

/** Строка слева направо: put(колонка, строка снизу). */
function text(s: string, put: (col: number, row: number) => void): void {
	[...s].forEach((ch, i) => {
		FONT[ch]?.forEach((line, r) => {
			[...line].forEach((c, k) => {
				if (c === '#') put(i * 4 + k, 4 - r);
			});
		});
	});
}

/** Строка сверху вниз: put(колонка, строка снизу от нижней буквы). */
function textV(s: string, put: (col: number, row: number) => void): void {
	const n = s.length;
	[...s].forEach((ch, i) => {
		FONT[ch]?.forEach((line, r) => {
			[...line].forEach((c, k) => {
				if (c === '#') put(k, (n - 1 - i) * 6 + 4 - r);
			});
		});
	});
}

// ---------- Машины ----------

interface LoopOptions {
	/** Ось улицы: машина едет вдоль неё. */
	axis: 'x' | 'z';
	/** Середина улицы поперёк оси. */
	c: number;
	/** Половина расстояния между встречными полосами — радиус разворота. */
	half: number;
	a0: number;
	a1: number;
	y: number;
	speed: number;
	/** Сдвиг по петле в долях её длины. */
	offset?: number;
	/** Крен в разворотах (летающие машины), радианы. */
	bank?: number;
}

/** Петля-«стадион»: по одной полосе туда, разворот, по встречной обратно. */
function loop(o: LoopOptions): Behaviour {
	const straight = o.a1 - o.a0;
	const arc = Math.PI * o.half;
	const length = 2 * straight + 2 * arc;
	return custom((pose, t, ctx) => {
		const s =
			(((((o.offset ?? 0) + ctx.index / ctx.count) * length + o.speed * t) % length) + length) %
			length;
		// участки петли: полоса туда, разворот, полоса обратно, разворот
		const s1 = s - straight;
		const s2 = s1 - arc;
		const s3 = s2 - straight;
		let a: number;
		let c: number;
		let da: number;
		let dc: number;
		let roll = 0;
		if (s < straight) {
			[a, c, da, dc] = [o.a0 + s, o.c - o.half, 1, 0];
		} else if (s1 < arc) {
			const th = s1 / o.half;
			[a, c, da, dc] = [
				o.a1 + o.half * Math.sin(th),
				o.c - o.half * Math.cos(th),
				Math.cos(th),
				Math.sin(th),
			];
			roll = o.bank ?? 0;
		} else if (s2 < straight) {
			[a, c, da, dc] = [o.a1 - s2, o.c + o.half, -1, 0];
		} else {
			const th = s3 / o.half;
			[a, c, da, dc] = [
				o.a0 - o.half * Math.sin(th),
				o.c + o.half * Math.cos(th),
				-Math.cos(th),
				-Math.sin(th),
			];
			roll = o.bank ?? 0;
		}
		const [x, z, dx, dz] = o.axis === 'z' ? [c, a, dc, da] : [a, c, da, dc];
		pose.position[0] = x;
		pose.position[1] = o.y;
		pose.position[2] = z;
		pose.rotation[1] = Math.atan2(dx, dz);
		pose.rotation[2] = roll;
		pose.gait = 'fly';
	});
}

function car(body: string, neon: string): Model {
	return model(
		{
			size: [6, 4, 11],
			scale: 0.5,
			palette: {
				body,
				neon: { color: neon, emissive: 1 },
				glass: '#1a2a44',
				wheel: '#0c0d12',
				head: { color: '#f4f8ff', emissive: 1.2 },
				tail: { color: '#ff2a3a', emissive: 1 },
			},
		},
		(m) => {
			m.box([0, 1, 0], [5, 2, 10], 'body');
			m.box([1, 3, 3], [4, 3, 7], 'glass');
			for (const z of [2, 8]) {
				m.set([0, 0, z], 'wheel');
				m.set([5, 0, z], 'wheel');
			}
			m.box([1, 0, 3], [4, 0, 7], 'neon');
			m.set([0, 2, 10], 'head');
			m.set([5, 2, 10], 'head');
			m.box([0, 2, 0], [5, 2, 0], 'tail');
		},
	);
}

function flyer(body: string, glow: string): Model {
	return model(
		{
			size: [8, 5, 12],
			scale: 0.5,
			palette: {
				body,
				glow: { color: glow, emissive: 1.2 },
				canopy: { color: '#7fe8ff', emissive: 0.6 },
				head: { color: '#f4f8ff', emissive: 1.2 },
			},
		},
		(m) => {
			m.box([1, 1, 1], [6, 3, 10], 'body');
			m.box([2, 1, 11], [5, 2, 11], 'body');
			m.box([2, 4, 4], [5, 4, 8], 'canopy');
			m.box([0, 2, 2], [0, 2, 8], 'glow');
			m.box([7, 2, 2], [7, 2, 8], 'glow');
			m.box([2, 0, 3], [5, 0, 8], 'glow');
			for (const x of [1, 5]) m.box([x, 1, 0], [x + 1, 2, 0], 'glow');
			m.set([2, 2, 11], 'head');
			m.set([5, 2, 11], 'head');
		},
	);
}

const CAR_COLORS: Array<[string, string]> = [
	['#f2c230', '#3ef4ff'],
	['#1c1f2b', '#ff3fb4'],
	['#d8dce6', '#2f7bff'],
	['#c0283a', '#ff8a1f'],
	['#2a3a6a', '#2affc0'],
	['#f2c230', '#ff3fb4'],
	['#3a1f4a', '#a855ff'],
	['#e8ecf4', '#ff2a3a'],
];

const STREETS = ROADS.flatMap((c) => [
	{ axis: 'z' as const, c },
	{ axis: 'x' as const, c },
]);

const CARS = STREETS.flatMap((s, si) =>
	[0, 1].map((k) => {
		const [body, neon] = CAR_COLORS[(si * 2 + k) % CAR_COLORS.length] ?? ['#f2c230', '#3ef4ff'];
		return {
			id: `car${si}${k}`,
			model: car(body, neon),
			at: [ROADS[0], G, ROADS[0]] as Vec3,
			count: 2,
			animate: loop({
				...s,
				half: 2.5,
				a0: 3,
				a1: N - 4,
				y: G,
				speed: 7 + k,
				offset: k * 0.23 + si * 0.11,
			}),
		};
	}),
);

const FLYER_COLORS: Array<[string, string]> = [
	['#d42a3a', '#3ef4ff'],
	['#f2c230', '#ff8a1f'],
	['#e8ecf4', '#ff3fb4'],
	['#2f7bff', '#ffd23a'],
];
const FLY_HEIGHTS = [48, 66, 57, 80];

const FLYERS = STREETS.map((s, si) => {
	const [body, glow] = FLYER_COLORS[si] ?? ['#d42a3a', '#3ef4ff'];
	return {
		id: `flyer${si}`,
		model: flyer(body, glow),
		glow,
		at: [ROADS[0], FLY_HEIGHTS[si] ?? 50, ROADS[0]] as Vec3,
		count: si % 2 === 0 ? 3 : 2,
		animate: [
			loop({
				...s,
				half: 3,
				a0: -2,
				a1: N + 2,
				y: FLY_HEIGHTS[si] ?? 50,
				speed: 9 + si,
				bank: 0.35,
			}),
			bob({ amp: 0.4, period: 3 }),
		],
	};
});

// ---------- Здания ----------

const NEONS = [
	'neon-cyan',
	'neon-blue',
	'neon-pink',
	'neon-orange',
	'neon-yellow',
	'neon-red',
	'neon-teal',
	'neon-purple',
];
const WALLS = ['wall-dark', 'wall-blue', 'wall-red', 'wall-teal', 'concrete', 'wall-purple'];
const LIT = ['win-cyan', 'win-blue', 'win-warm', 'win-pink'];
const STYLES = ['grid', 'bands', 'cylinder', 'stepped', 'frame', 'pylons'] as const;
type Style = (typeof STYLES)[number];

interface Box {
	x0: number;
	z0: number;
	x1: number;
	z1: number;
}

/** Грань здания: n — наружу, r — «вправо» для смотрящего на грань, o — её нижний левый угол. */
interface Face {
	n: [number, number];
	r: [number, number];
	ox: number;
	oz: number;
	width: number;
	street: boolean;
}

const at = (f: Face, u: number, y: number, d: number): Vec3 => [
	f.ox + f.r[0] * u + f.n[0] * d,
	y,
	f.oz + f.r[1] * u + f.n[1] * d,
];

function facesOf(b: Box, street: (nx: number, nz: number) => boolean): Face[] {
	const wx = b.x1 - b.x0 + 1;
	const wz = b.z1 - b.z0 + 1;
	return [
		{ n: [0, 1], r: [1, 0], ox: b.x0, oz: b.z1, width: wx, street: street(0, 1) },
		{ n: [0, -1], r: [-1, 0], ox: b.x1, oz: b.z0, width: wx, street: street(0, -1) },
		{ n: [1, 0], r: [0, -1], ox: b.x1, oz: b.z1, width: wz, street: street(1, 0) },
		{ n: [-1, 0], r: [0, 1], ox: b.x0, oz: b.z0, width: wz, street: street(-1, 0) },
	];
}

const shrink = (b: Box, k: number): Box => ({
	x0: b.x0 + k,
	z0: b.z0 + k,
	x1: b.x1 - k,
	z1: b.z1 - k,
});

interface Plan {
	box: Box;
	top: number;
	style: Style;
	wall: string;
	neon: string;
	accent: string;
	lit: string[];
	faces: Face[];
	rng: Rng;
}

class City {
	constructor(readonly w: WorldBuilder) {}

	/** Окна на грани: колонки через step, ряды по rows (последний ряд — перекрытие). */
	windows(f: Face, y0: number, y1: number, p: Plan, step: number, rows: number, off = 0.5): void {
		for (let y = y0; y <= y1; y++) {
			if ((y - y0) % rows === rows - 1) continue;
			for (let u = 1; u < f.width - 1; u++) {
				if (u % step === 0) continue;
				const mat = p.rng.chance(off) ? 'win-off' : p.rng.pick(p.lit);
				this.w.set(at(f, u, y, 0), mat);
			}
		}
	}

	band(b: Box, y: number, mat: string): void {
		const { w } = this;
		w.box([b.x0 - 1, y, b.z0 - 1], [b.x1 + 1, y, b.z0 - 1], mat);
		w.box([b.x0 - 1, y, b.z1 + 1], [b.x1 + 1, y, b.z1 + 1], mat);
		w.box([b.x0 - 1, y, b.z0], [b.x0 - 1, y, b.z1], mat);
		w.box([b.x1 + 1, y, b.z0], [b.x1 + 1, y, b.z1], mat);
	}

	edges(b: Box, y0: number, y1: number, mat: string): void {
		for (const [x, z] of [
			[b.x0 - 1, b.z0 - 1],
			[b.x1 + 1, b.z0 - 1],
			[b.x0 - 1, b.z1 + 1],
			[b.x1 + 1, b.z1 + 1],
		] as const) {
			this.w.box([x, y0, z], [x, y1, z], mat);
		}
	}

	/** Первый этаж: витрины, дверь, козырёк с неоновой кромкой, вывеска над ним. */
	groundFloor(p: Plan): void {
		const { w } = this;
		for (const f of p.faces) {
			if (!f.street) continue;
			const mid = Math.floor(f.width / 2);
			for (let u = 1; u < f.width - 1; u++) {
				w.box(at(f, u, G + 1, 0), at(f, u, G + 4, 0), u % 4 === 0 ? 'frame' : 'storefront');
			}
			w.box(at(f, mid, G + 1, 0), at(f, mid + 1, G + 4, 0), 'door');
			const awning = p.rng.pick(['awning-red', 'awning-teal', 'awning-dark']);
			w.box(at(f, 1, G + 5, 1), at(f, f.width - 2, G + 5, 1), awning);
			w.box(at(f, 1, G + 5, 2), at(f, f.width - 2, G + 5, 2), p.accent);
			const word = pickWord(p.rng, f.width - 2);
			if (word && p.top > G + 14) {
				const u0 = Math.floor((f.width - textWidth(word)) / 2);
				w.box(at(f, u0 - 1, G + 6, 1), at(f, u0 + textWidth(word), G + 12, 1), 'sign-dark');
				const color = p.rng.pick(NEONS);
				text(word, (col, row) => w.set(at(f, u0 + col, G + 7 + row, 2), color));
			}
		}
	}

	/** Вертикальная вывеска на консоли. */
	verticalSign(p: Plan, f: Face): void {
		const word = pickWord(p.rng, textWidth('12345')) ?? 'BAR';
		const height = word.length * 6 + 2;
		const y0 = G + 15 + p.rng.int(0, 6);
		if (y0 + height > p.top - 4) return;
		const u = p.rng.chance(0.5) ? 2 : f.width - 5;
		const color = p.rng.pick(NEONS);
		const { w } = this;
		w.box(at(f, u, y0, 1), at(f, u + 2, y0 + height, 1), 'sign-dark');
		w.box(at(f, u, y0, 2), at(f, u + 2, y0, 2), color);
		w.box(at(f, u, y0 + height, 2), at(f, u + 2, y0 + height, 2), color);
		textV(word, (col, row) => w.set(at(f, u + col, y0 + 2 + row, 2), color));
	}

	/** Рекламный щит на грани: рамка и «экран» с глифами или словом. */
	billboard(p: Plan, f: Face, y0: number): void {
		const { w } = this;
		const width = f.width - 2;
		const height = 9;
		if (y0 + height > p.top - 2 || width < 7) return;
		w.box(at(f, 1, y0, 1), at(f, width, y0 + height, 1), p.accent);
		w.box(at(f, 2, y0 + 1, 1), at(f, width - 1, y0 + height - 1, 1), 'screen');
		const word = pickWord(p.rng, width - 3);
		const color = p.rng.pick(NEONS);
		if (word && p.rng.chance(0.6)) {
			const u0 = 1 + Math.floor((width - textWidth(word)) / 2) + 1;
			text(word, (col, row) => w.set(at(f, u0 + col - 1, y0 + 2 + row, 2), color));
		} else {
			for (let u = 3; u < width - 1; u++) {
				for (let y = y0 + 2; y < y0 + height - 1; y++) {
					if (p.rng.chance(0.35)) w.set(at(f, u, y, 2), p.rng.chance(0.7) ? color : p.neon);
				}
			}
		}
	}

	/** Кондиционеры, трубы и балкончики на непарадных гранях. */
	clutter(p: Plan, f: Face, y0: number, y1: number): void {
		const { w } = this;
		const ac = f.street ? 2 : 5;
		for (let i = 0; i < ac; i++) {
			const u = p.rng.int(1, f.width - 3);
			const y = p.rng.int(y0, Math.max(y0, y1 - 2));
			w.box(at(f, u, y, 1), at(f, u + 1, y, 1), 'metal-light');
			w.set(at(f, u, y - 1, 1), 'metal');
		}
		if (!f.street && p.rng.chance(0.7)) {
			const u = p.rng.int(1, f.width - 2);
			w.box(at(f, u, G + 1, 1), at(f, u, y1, 1), 'pipe');
		}
		if (p.style === 'grid' && p.rng.chance(0.6)) {
			for (let y = y0 + 4; y < y1 - 4; y += p.rng.int(6, 12)) {
				const u = p.rng.int(1, Math.max(1, f.width - 5));
				w.box(at(f, u, y, 1), at(f, u + 3, y, 2), 'metal');
				w.box(at(f, u, y + 1, 2), at(f, u + 3, y + 1, 2), 'rail');
			}
		}
	}

	/** Крыша: парапет, баки, антенны, шпили, щит или вертолётная площадка. */
	roof(p: Plan, b: Box, top: number): void {
		const { w } = this;
		const cx = Math.floor((b.x0 + b.x1) / 2);
		const cz = Math.floor((b.z0 + b.z1) / 2);
		this.band(shrink(b, 1), top + 1, 'metal');
		const wide = b.x1 - b.x0 >= 7 && b.z1 - b.z0 >= 7;
		if (top > 90 && wide) {
			w.box([b.x0 + 1, top + 1, b.z0 + 1], [b.x1 - 1, top + 1, b.z1 - 1], 'helipad');
			text('H', (col, row) => w.set([cx - 1 + col, top + 1, cz - 2 + row], 'neon-yellow'));
			this.band(b, top + 1, 'neon-red');
			return;
		}
		const items = p.rng.int(1, 3);
		for (let i = 0; i < items; i++) {
			const x = p.rng.int(b.x0 + 2, b.x1 - 2);
			const z = p.rng.int(b.z0 + 2, b.z1 - 2);
			const kind = p.rng.pick(['tank', 'antenna', 'ac', 'spires', 'dish']);
			if (kind === 'tank') {
				for (const [dx, dz] of [
					[-1, -1],
					[1, 1],
				] as const) {
					w.box([x + dx, top + 1, z + dz], [x + dx, top + 2, z + dz], 'metal');
				}
				w.cylinder([x, top + 3, z], 1.6, 4, 'tank');
				w.cylinder([x, top + 7, z], 1, 1, 'metal');
			} else if (kind === 'antenna') {
				const h = p.rng.int(6, 14);
				w.box([x, top + 1, z], [x, top + h, z], 'metal');
				w.box([x - 1, top + h - 3, z], [x + 1, top + h - 3, z], 'metal');
				w.set([x, top + h + 1, z], 'neon-red');
			} else if (kind === 'ac') {
				w.box([x - 1, top + 1, z - 1], [x + 1, top + 2, z], 'metal-light');
				w.set([x, top + 3, z], 'metal');
			} else if (kind === 'spires') {
				const h = p.rng.int(6, 12);
				w.box([b.x0, top + 1, b.z0], [b.x0, top + h, b.z0], p.accent);
				w.box([b.x1, top + 1, b.z1], [b.x1, top + h, b.z1], p.accent);
			} else {
				w.box([x, top + 1, z], [x, top + 2, z], 'metal');
				w.box([x - 1, top + 3, z - 1], [x + 1, top + 3, z + 1], 'metal-light');
				w.set([x, top + 4, z], p.neon);
			}
		}
		// щит на крыше, лицом на улицу
		const f = p.faces.find((face) => face.street);
		if (f && p.rng.chance(0.35) && f.width >= 9) {
			const word = pickWord(p.rng, f.width - 2);
			if (!word) return;
			const u0 = Math.floor((f.width - textWidth(word)) / 2);
			for (const u of [u0, u0 + textWidth(word) - 1]) {
				w.box(at(f, u, top + 1, -3), at(f, u, top + 3, -3), 'metal');
			}
			w.box(at(f, u0 - 1, top + 4, -3), at(f, u0 + textWidth(word), top + 10, -3), 'sign-dark');
			const color = p.rng.pick(NEONS);
			text(word, (col, row) => w.set(at(f, u0 + col, top + 5 + row, -2), color));
		}
	}

	body(p: Plan): void {
		const { w } = this;
		const b = p.box;
		const top = p.top;
		const all = (fn: (f: Face) => void) => p.faces.forEach(fn);
		switch (p.style) {
			case 'grid': {
				w.box([b.x0, G + 1, b.z0], [b.x1, top, b.z1], p.wall);
				all((f) => this.windows(f, G + 7, top - 2, p, p.rng.pick([2, 3]), p.rng.pick([3, 4])));
				this.edges(b, G + 6, top, p.neon);
				this.band(b, top, p.neon);
				break;
			}
			case 'bands': {
				w.box([b.x0, G + 1, b.z0], [b.x1, top, b.z1], p.wall);
				all((f) => this.windows(f, G + 7, top - 1, p, 3, 5, 0.55));
				const every = p.rng.pick([4, 5]);
				for (let y = G + 10; y <= top; y += every) {
					this.band(b, y, (y - G) % (every * 2) < every ? p.neon : p.accent);
				}
				break;
			}
			case 'stepped': {
				let tier = b;
				let y0 = G + 1;
				const tops = [Math.floor(G + (top - G) * 0.55), Math.floor(G + (top - G) * 0.8), top];
				for (const t of tops) {
					w.box([tier.x0, y0, tier.z0], [tier.x1, t, tier.z1], p.wall);
					for (const f of facesOf(tier, () => false)) {
						this.windows(f, Math.max(y0, G + 7), t - 1, p, 2, 4);
					}
					this.band(tier, t, p.neon);
					this.edges(tier, y0, t, p.accent);
					y0 = t + 1;
					if (tier.x1 - tier.x0 < 6) break;
					tier = shrink(tier, 2);
				}
				this.roof(p, tier, y0 - 1);
				return;
			}
			case 'frame': {
				w.box([b.x0, G + 1, b.z0], [b.x1, top, b.z1], 'wall-dark');
				all((f) => this.windows(f, G + 7, top - 1, p, 2, 4, 0.55));
				this.edges(b, G + 1, top, p.neon);
				for (let y = G + 20; y <= top; y += 16) this.band(b, y, p.neon);
				// большой экран на уличной грани
				const f = p.faces.find((face) => face.street);
				if (f && top > G + 40) {
					const y0 = top - 22;
					w.box(at(f, 0, y0, 0), at(f, f.width - 1, y0 + 16, 0), 'screen');
					w.box(at(f, 0, y0, 1), at(f, f.width - 1, y0, 1), p.accent);
					w.box(at(f, 0, y0 + 16, 1), at(f, f.width - 1, y0 + 16, 1), p.accent);
					const word = pickWord(p.rng, f.width - 1);
					if (word) {
						const u0 = Math.floor((f.width - textWidth(word)) / 2);
						for (const dy of [0, 1]) {
							text(word, (col, row) => w.set(at(f, u0 + col, y0 + 3 + row * 2 + dy, 1), p.accent));
						}
					}
				}
				break;
			}
			case 'pylons': {
				w.box([b.x0, G + 1, b.z0], [b.x1, top, b.z1], p.wall);
				all((f) => {
					this.windows(f, G + 7, top - 1, p, 4, 3);
					for (let u = 0; u < f.width; u += 4) {
						w.box(at(f, u, G + 6, 1), at(f, u, top, 1), u % 8 === 0 ? p.neon : p.accent);
					}
				});
				this.band(b, top, p.accent);
				break;
			}
			case 'cylinder': {
				// цоколь-коробка с витринами, над ним — цилиндр с кольцами
				w.box([b.x0, G + 1, b.z0], [b.x1, G + 6, b.z1], 'concrete');
				this.band(b, G + 6, p.neon);
				const cx = (b.x0 + b.x1) / 2;
				const cz = (b.z0 + b.z1) / 2;
				const r = Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2 + 0.4;
				w.cylinder([cx, G + 7, cz], r, top - G - 6, p.wall);
				for (let y = G + 8; y <= top; y++) {
					for (let x = b.x0; x <= b.x1; x++) {
						for (let z = b.z0; z <= b.z1; z++) {
							const d = Math.hypot(x - cx, z - cz);
							if (d > r || d < r - 1) continue;
							const ang = (Math.atan2(z - cz, x - cx) + Math.PI) / (Math.PI / 4);
							if (Math.abs((ang % 1) - 0.5) > 0.42) w.set([x, y, z], p.neon);
							else if ((y - G) % 4 !== 0) {
								w.set([x, y, z], p.rng.chance(0.5) ? 'win-off' : p.rng.pick(p.lit));
							}
						}
					}
				}
				for (let y = G + 20; y < top - 4; y += 14) {
					w.cylinder([cx, y - 1, cz], r + 2, 1, 'metal');
					w.cylinder([cx, y, cz], r + 1.1, 1, p.accent);
					w.cylinder([cx, y, cz], r, 1, p.wall);
				}
				w.cylinder([cx, top + 1, cz], r - 2, 3, 'wall-dark');
				w.cylinder([cx, top + 2, cz], r - 1.4, 1, p.accent);
				w.box(
					[Math.floor(cx), top + 4, Math.floor(cz)],
					[Math.floor(cx), top + 12, Math.floor(cz)],
					'metal',
				);
				w.set([Math.floor(cx), top + 13, Math.floor(cz)], 'neon-red');
				return;
			}
		}
		this.roof(p, b, top);
	}

	build(p: Plan): void {
		this.body(p);
		this.groundFloor(p);
		if (p.style === 'cylinder') return;
		const streets = p.faces.filter((f) => f.street);
		const sign = streets[0];
		if (sign && p.rng.chance(0.7)) this.verticalSign(p, sign);
		const board = streets[1];
		if (board && p.rng.chance(0.5)) {
			this.billboard(p, board, p.rng.int(G + 16, Math.max(G + 16, p.top - 14)));
		}
		for (const f of p.faces) this.clutter(p, f, G + 9, Math.min(p.top - 3, G + 40));
	}
}

/**
 * Высота по кварталу: камера смотрит с угла +x+z, поэтому чем ближе квартал к ней (bi + bj),
 * тем он ниже — улицы и витрины спереди не закрыты. В центре и сзади — небоскрёбы.
 */
function heightFor(bi: number, bj: number, rng: Rng): number {
	const depth = bi + bj; // 0 — дальний угол, 4 — ближний
	if (bi === 1 && bj === 1) return rng.int(72, 106);
	if (depth <= 1) return rng.int(55, 96);
	if (depth === 2) return rng.int(40, 80);
	if (depth === 3) return rng.int(24, 52);
	return rng.int(14, 30);
}

function lamp(w: WorldBuilder, base: Vec3, dir: [number, number]): void {
	const [x, , z] = base;
	w.box([x, G + 1, z], [x, G + 9, z], 'metal');
	const tx = x + dir[0] * 3;
	const tz = z + dir[1] * 3;
	w.line([x, G + 9, z], [tx, G + 10, tz], 'metal');
	w.box([tx, G + 9, tz], [tx, G + 9, tz], 'lamp');
}

const inRoad = (v: number): boolean => ROADS.some((c) => Math.abs(v - c) < ROAD_HALF);
const inStreet = (v: number): boolean => ROADS.some((c) => Math.abs(v - c) < ROAD_HALF + 2);

const WALKERS: Array<[[number, number], [number, number]]> = [
	[
		[32.5, 4],
		[32.5, 29],
	],
	[
		[45.5, 48],
		[45.5, 73],
	],
	[
		[76.5, 92],
		[76.5, 117],
	],
	[
		[48, 32.5],
		[73, 32.5],
	],
	[
		[92, 89.5],
		[117, 89.5],
	],
	[
		[4, 76.5],
		[29, 76.5],
	],
];

export default defineDiorama({
	meta: {
		title: 'Neon City',
		createdAt: '2026-10-07',
		author: { model: 'Claude Opus 5.5', effort: 'high', context: '1M' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'A nine-block cyberpunk city at night: neon skyscrapers, glowing signs, cars in the streets and flying cars between the towers',
		tags: ['cyberpunk', 'city', 'night', 'neon'],
	},
	seed: 2088,
	size: [N, 128, N],
	palette: {
		slab: '#1c2030',
		road: '#272b38',
		'lane-line': { color: '#ffd23a', emissive: 0.25 },
		zebra: { color: '#cfd6e6', emissive: 0.1 },
		pavement: '#3e4559',
		curb: '#4a5168',
		concrete: '#3a4158',
		'wall-dark': '#232a3e',
		'wall-blue': '#2c3f7a',
		'wall-red': '#6e2232',
		'wall-teal': '#1f4d58',
		'wall-purple': '#3e2464',
		frame: '#0e1018',
		door: '#2a2f40',
		metal: '#5c6378',
		'metal-light': '#8a93a8',
		rail: '#9aa3b8',
		pipe: '#3e4456',
		tank: '#6a7388',
		helipad: '#2a2e3a',
		screen: '#0a1428',
		'sign-dark': '#0b0d16',
		'awning-red': '#8a1f2e',
		'awning-teal': '#1f6a6a',
		'awning-dark': '#22263a',
		'win-off': '#0d1220',
		'win-cyan': { color: '#7fe8ff', emissive: 0.2 },
		'win-blue': { color: '#4a8cff', emissive: 0.2 },
		'win-warm': { color: '#ffd08a', emissive: 0.2 },
		'win-pink': { color: '#ff8ad0', emissive: 0.2 },
		'neon-cyan': { color: '#3ef4ff', emissive: 0.45 },
		'neon-blue': { color: '#2f7bff', emissive: 0.45 },
		'neon-pink': { color: '#ff3fb4', emissive: 0.45 },
		'neon-orange': { color: '#ff8a1f', emissive: 0.45 },
		'neon-yellow': { color: '#ffd23a', emissive: 0.45 },
		'neon-red': { color: '#ff2a3a', emissive: 0.45 },
		'neon-teal': { color: '#2affc0', emissive: 0.45 },
		'neon-purple': { color: '#a855ff', emissive: 0.45 },
		lamp: { color: '#f0f4ff', emissive: 1 },
		storefront: { color: '#6fd8ff', emissive: 0.25 },
		vending: { color: '#ff3fb4', emissive: 0.5 },
	},
	build(w) {
		// Плита, улицы, тротуары, разметка.
		w.box([0, 0, 0], [N - 1, G - 1, N - 1], 'slab');
		w.box([0, G, 0], [N - 1, G, N - 1], 'pavement');
		for (const c of ROADS) {
			const r0 = Math.ceil(c - ROAD_HALF);
			const r1 = Math.floor(c + ROAD_HALF);
			w.clear([r0, G, 0], [r1, G, N - 1]);
			w.clear([0, G, r0], [N - 1, G, r1]);
			w.box([r0, G - 1, 0], [r1, G - 1, N - 1], 'road');
			w.box([0, G - 1, r0], [N - 1, G - 1, r1], 'road');
		}
		for (let i = 0; i < N; i++) {
			for (const c of ROADS) {
				const r0 = Math.ceil(c - ROAD_HALF);
				const r1 = Math.floor(c + ROAD_HALF);
				// бордюры по краям тротуаров
				for (const e of [r0 - 1, r1 + 1]) {
					if (!inRoad(i)) {
						w.set([e, G, i], 'curb');
						w.set([i, G, e], 'curb');
					}
				}
				// пунктир по середине
				if (i % 4 < 2 && !inStreet(i)) {
					w.box([r0 + 4, G - 1, i], [r0 + 5, G - 1, i], 'lane-line');
					w.box([i, G - 1, r0 + 4], [i, G - 1, r0 + 5], 'lane-line');
				}
			}
		}
		for (const cx of ROADS) {
			for (const cz of ROADS) {
				for (let k = -4; k <= 4; k += 2) {
					for (const side of [-1, 1]) {
						const e = side * (ROAD_HALF + 3);
						w.box([cx + k, G - 1, cz + e - 1], [cx + k, G - 1, cz + e + 1], 'zebra');
						w.box([cx + e - 1, G - 1, cz + k], [cx + e + 1, G - 1, cz + k], 'zebra');
					}
				}
			}
		}

		// Здания: 9 кварталов × 4 угловых участка.
		const city = new City(w);
		const styles: Style[] = [];
		for (let i = 0; i < 36; i++) styles.push(STYLES[i % STYLES.length] ?? 'grid');
		for (let i = styles.length - 1; i > 0; i--) {
			const j = w.rng.int(0, i);
			[styles[i], styles[j]] = [styles[j] ?? 'grid', styles[i] ?? 'grid'];
		}
		let n = 0;
		BLOCKS.forEach((bx, bi) => {
			BLOCKS.forEach((bz, bj) => {
				for (const [lx, lz] of [
					[0, 0],
					[16, 0],
					[0, 16],
					[16, 16],
				] as const) {
					const rng = w.rng.fork();
					const lot: Box = { x0: bx + lx + 2, z0: bz + lz + 2, x1: bx + lx + 11, z1: bz + lz + 11 };
					const box: Box = {
						x0: lot.x0 + (lx === 0 ? 0 : rng.int(0, 1)),
						z0: lot.z0 + (lz === 0 ? 0 : rng.int(0, 1)),
						x1: lot.x1 - (lx === 16 ? 0 : rng.int(0, 1)),
						z1: lot.z1 - (lz === 16 ? 0 : rng.int(0, 1)),
					};
					// грань смотрит на улицу, если за ней не край плиты
					const street = (nx: number, nz: number): boolean => {
						if (nx === -1) return lx === 0 && bi > 0;
						if (nx === 1) return lx === 16 && bi < 2;
						if (nz === -1) return lz === 0 && bj > 0;
						return lz === 16 && bj < 2;
					};
					const neon = rng.pick(NEONS);
					const plan: Plan = {
						box,
						top: G + heightFor(bi, bj, rng),
						style: styles[n++] ?? 'grid',
						wall: rng.pick(WALLS),
						neon,
						accent: rng.pick(NEONS.filter((c) => c !== neon)),
						lit: [rng.pick(LIT), rng.pick(LIT)],
						faces: facesOf(box, street),
						rng,
					};
					city.build(plan);
				}
			});
		});

		// Фонари и автоматы вдоль тротуаров, кроме перекрёстков.
		for (const c of ROADS) {
			const r0 = Math.ceil(c - ROAD_HALF) - 2;
			const r1 = Math.floor(c + ROAD_HALF) + 2;
			for (let i = 8; i < N - 4; i += 14) {
				if (inStreet(i)) continue;
				lamp(w, [r0 + 1, G, i], [1, 0]);
				lamp(w, [r1 - 1, G, i + 7], [-1, 0]);
				lamp(w, [i + 7, G, r0 + 1], [0, 1]);
				lamp(w, [i, G, r1 - 1], [0, -1]);
			}
			for (let i = 12; i < N - 4; i += 28) {
				if (inStreet(i)) continue;
				w.box([r0 + 1, G + 1, i], [r0 + 1, G + 3, i + 1], 'vending');
				w.box([i, G + 1, r1 - 1], [i + 1, G + 3, r1 - 1], 'vending');
			}
		}
	},
	entities: [
		...CARS,
		...FLYERS.map(({ glow: _glow, ...f }) => f),
		...WALKERS.map((path, i) => ({
			id: `walker${i}`,
			rig: prefabs.villager(),
			animate: walkPath(path, { loop: 'pingpong', speed: 1 + (i % 3) * 0.15 }),
		})),
	],
	particles: [
		...FLYERS.flatMap((f) =>
			Array.from({ length: f.count }, (_, i) =>
				sparks({
					attachTo: `${f.id}[${i}]`,
					offset: [0, 0.6, 0],
					rate: 24,
					lifetime: 0.5,
					velocity: [0, -2.6, 0],
					color: f.glow,
				}),
			),
		),
		...ROADS.flatMap((c) => [
			mist({ area: [c - 7, 0, c + 7, N - 1], height: 1.2, intensity: 0.4, color: '#6a4cff' }),
			mist({ area: [0, c - 7, N - 1, c + 7], height: 1.2, intensity: 0.4, color: '#ff3fb4' }),
		]),
	],
	lights: ROADS.flatMap((cx, i) =>
		ROADS.flatMap((cz, j) => [
			pointLight({
				at: [cx, G + 8, cz],
				color: ['#a855ff', '#3ef4ff', '#ff3fb4', '#ff8a1f'][i * 2 + j] ?? '#a855ff',
				intensity: 8,
				distance: 20,
			}),
			pointLight({
				at: [cx + (j ? 22 : -22), G + 5, cz],
				color: ['#2affc0', '#ffd23a', '#2f7bff', '#ff2a3a'][i * 2 + j] ?? '#2affc0',
				intensity: 6,
				distance: 16,
			}),
		]),
	),
	atmosphere: { time: { start: 'night', speed: 0 }, sky: { kind: 'solid', color: '#0d1530' } },
	camera: { position: [196, 132, 214], target: [58, 32, 58], captureTime: 3 },
});
