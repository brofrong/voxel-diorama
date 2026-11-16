import {
	defineDiorama,
	dust,
	fireflies,
	limbs,
	model,
	pointLight,
	prefabs,
	spin,
	type Vec3,
	type WorldBuilder,
	walkPath,
	wander,
} from '#sdk';
import { astronomer } from './folk.ts';
import { comet, flame, flicker, hash, puff, rise } from './fx.ts';
import { gear, MECH_SCALE, ORBITS, orrery, orreryMotion } from './mech.ts';

const TAU = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);

/** Центр острова в плане и высота мощёной площади. */
const C = 76;
const P = 56;
const PLAZA = 44;
/** Низ колонны механизма. */
const HUB_Y = P + 7;
const SUN: Vec3 = [C + 0.5, HUB_Y + 20, C + 0.5];
const OBS: readonly [number, number] = [C + 22, C - 50];
const ENG: readonly [number, number] = [C - 50, C + 22];
/** Ось маховика на стене машинного дома. */
const FLY: Vec3 = [ENG[0] - 3.5, P + 11.5, ENG[1] + 7.5];
const PINION: Vec3 = [FLY[0] + 12.2, FLY[1] - 2.4, FLY[2]];
/** Шестерни в скале под площадью: [x, y] большой и малой. */
const CLIFF_A: readonly [number, number] = [C + 4, P - 17];
const CLIFF_B: readonly [number, number] = [C + 21, P - 26];

const polar = (r: number, deg: number): [number, number] => [
	C + 0.5 + r * Math.cos((deg * Math.PI) / 180),
	C + 0.5 + r * Math.sin((deg * Math.PI) / 180),
];

function islands(w: WorldBuilder): void {
	const land = { surface: 'grass', soil: 'soil', rock: 'rock' } as const;
	w.island({ ...land, center: [OBS[0], OBS[1]], radius: 17, top: P, depth: 30, hills: 0 });
	w.island({ ...land, center: [ENG[0], ENG[1]], radius: 16, top: P, depth: 26, hills: 0 });
	const main = w.island({
		...land,
		center: [C, C],
		radius: 57,
		top: P,
		depth: 54,
		roughness: 0.16,
		hills: 0,
		spikes: 36,
		name: 'isle',
	});
	if (main.top !== P) throw new Error(`остров: верх ${main.top}, ожидался ${P}`);
	w.island({
		...land,
		center: [C + 50, C + 52],
		radius: 9,
		top: P - 12,
		depth: 16,
		hills: 1,
		spikes: 6,
	});
	w.island({
		...land,
		center: [C + 66, C - 8],
		radius: 7,
		top: P - 5,
		depth: 13,
		hills: 1,
		spikes: 5,
	});
	w.island({
		...land,
		center: [C - 10, C + 68],
		radius: 6,
		top: P - 9,
		depth: 11,
		hills: 1,
		spikes: 4,
	});
	// обломки скал, парящие вокруг
	const rocks: Vec3[] = [
		[C + 62, P - 22, C + 26],
		[C + 30, P - 30, C + 66],
		[C - 34, P - 20, C + 62],
		[C + 68, P + 6, C - 34],
		[C + 40, P - 14, C + 70],
	];
	rocks.forEach((p, i) => {
		w.blob(p, [3 + (i % 2), 2, 3], 'rock', { roughness: 0.4, seed: 30 + i });
	});
}

/** Мощёный круг: шахматка по кольцам и секторам, латунные орбиты, пояс зодиака. */
function plaza(w: WorldBuilder): void {
	const orbits = ORBITS.map((v) => v * MECH_SCALE);
	for (let z = C - PLAZA - 1; z <= C + PLAZA + 1; z++) {
		for (let x = C - PLAZA - 1; x <= C + PLAZA + 1; x++) {
			const dx = x - C;
			const dz = z - C;
			const r = Math.hypot(dx, dz);
			if (r > PLAZA + 0.5) continue;
			w.box([x, P + 1, z], [x, P + 3, z], 'air');
			w.box([x, P - 2, z], [x, P - 1, z], 'rock');
			const turn = Math.atan2(dz, dx) / TAU + 1;
			let m: string;
			if (orbits.some((o) => Math.abs(r - o) < 0.6)) {
				m = 'brass';
			} else if (r > 43.6) {
				m = 'slate-d';
			} else if (Math.abs(r - 39) < 0.6 || Math.abs(r - 43) < 0.6) {
				m = 'brass-d';
			} else if (r > 39 && r < 43) {
				const sector = Math.floor(fract(turn) * 12);
				const along = (fract(turn * 12) - 0.5) * (TAU / 12) * r;
				const u = Math.round(r - 41);
				const v = Math.round(along);
				const glyph =
					Math.abs(u) <= 1 &&
					Math.abs(v) <= 1 &&
					((u === 0 && v === 0) || hash(sector, u, v) > 0.45);
				m = glyph ? 'rune' : Math.abs(along) > (TAU / 24) * r - 0.6 ? 'brass-d' : 'ring-tile';
			} else {
				const ring = Math.floor(r / 5.5);
				const sector = Math.floor(fract(turn) * 24);
				m = (ring + sector) % 2 === 0 ? 'tile-a' : 'tile-b';
			}
			w.set([x, P, z], m);
		}
	}
}

/** Ступенчатый постамент под колонну. */
function pedestal(w: WorldBuilder): void {
	w.cylinder([C, P + 1, C], 9.4, 1, 'slate-d');
	w.cylinder([C, P + 2, C], 7.6, 2, 'stone');
	w.cylinder([C, P + 4, C], 6.2, 1, 'brass-d');
	w.cylinder([C, P + 5, C], 5.2, 2, 'stone-d');
	for (let z = C - 8; z <= C + 8; z++) {
		for (let x = C - 8; x <= C + 8; x++) {
			const r = Math.hypot(x - C, z - C);
			if (r > 7.6 || r < 6.6) continue;
			const turn = Math.atan2(z - C, x - C) / TAU + 1;
			if (fract(turn * 16) < 0.4) w.set([x, P + 3, z], 'rune');
		}
	}
	for (let k = 0; k < 8; k++) {
		const a = (k * TAU) / 8 + TAU / 16;
		const p = (r: number, y: number): Vec3 => [
			Math.round(C + r * Math.cos(a)),
			y,
			Math.round(C + r * Math.sin(a)),
		];
		w.line(p(9, P + 2), p(5, P + 6), 'brass');
		w.set(p(9, P + 1), 'brass-l');
	}
}

/** Двенадцать фонарных столбов по кромке площади. */
function pylons(w: WorldBuilder): void {
	for (let k = 0; k < 12; k++) {
		const [fx, fz] = polar(46, k * 30 + 15);
		const x = Math.floor(fx);
		const z = Math.floor(fz);
		w.box([x - 1, P - 1, z - 1], [x + 1, P + 2, z + 1], 'slate-d');
		w.box([x, P + 3, z], [x, P + 6, z], 'brass');
		w.box([x - 1, P + 6, z], [x + 1, P + 6, z], 'brass-d');
		w.box([x, P + 6, z - 1], [x, P + 6, z + 1], 'brass-d');
		w.box([x, P + 7, z], [x, P + 8, z], 'lamp');
	}
}

function observatory(w: WorldBuilder): void {
	const [x, z] = OBS;
	const y = P + 1;
	w.cylinder([x, P - 2, z], 8.5, 3, 'slate-d');
	w.cylinder([x, y, z], 7.5, 2, 'slate-d');
	w.cylinder([x, y + 2, z], 6, 18, 'stone');
	w.shade([x - 7, y + 2, z - 7], [x + 7, y + 19, z + 7], ['stone-d', 'stone', 'stone-l'], {
		only: 'stone',
		scale: 3,
		speckle: 0.25,
	});
	for (const by of [y + 7, y + 13, y + 19]) {
		for (let dz = -7; dz <= 7; dz++) {
			for (let dx = -7; dx <= 7; dx++) {
				const r = Math.hypot(dx, dz);
				if (r <= 6.8 && r > 5.2) w.set([x + dx, by, z + dz], 'brass-d');
			}
		}
	}
	// окна на четыре стороны, дверь к площади
	for (const wy of [y + 9, y + 15]) {
		w.box([x + 6, wy, z - 1], [x + 6, wy + 2, z], 'glow');
		w.box([x - 1, wy, z + 6], [x, wy + 2, z + 6], 'glow');
		w.box([x - 6, wy, z - 1], [x - 6, wy + 2, z], 'glow');
		w.box([x - 1, wy, z - 6], [x, wy + 2, z - 6], 'glow');
	}
	w.box([x - 1, y + 2, z + 6], [x, y + 5, z + 6], 'door');
	w.set([x, y + 4, z + 6], 'glow');
	// балкон с перилами
	w.cylinder([x, y + 20, z], 9.6, 1, 'slate-d');
	for (let dz = -10; dz <= 10; dz++) {
		for (let dx = -10; dx <= 10; dx++) {
			const r = Math.hypot(dx, dz);
			if (r <= 9.6 && r > 8.7 && (dx + dz) % 2 === 0) w.set([x + dx, y + 21, z + dz], 'brass-d');
		}
	}
	// купол с щелью в сторону механизма
	for (let dy = 0; dy <= 7; dy++) {
		for (let dz = -7; dz <= 7; dz++) {
			for (let dx = -7; dx <= 7; dx++) {
				const d = Math.hypot(dx, dy, dz);
				if (d > 6.6) continue;
				const slit = Math.abs(dx + dz) <= 1 && dz - dx > 2;
				const rib = dx === 0 || dz === 0 || dy === 0;
				w.set(
					[x + dx, y + 21 + dy, z + dz],
					slit ? 'glow-c' : rib ? 'copper' : dy > 4 ? 'verdigris-l' : 'verdigris',
				);
			}
		}
	}
	w.curve(
		[
			[x - 2, y + 24, z + 2],
			[x - 9, y + 34, z + 9],
		],
		'brass',
		{ radius: 1.3, endRadius: 1.9 },
	);
	w.sphere([x - 9, y + 34, z + 9], 1.5, 'glow-c');
	w.anchor('balcony', [x + 5.5, y + 21, z + 5.5]);
	w.anchor('obsGlow', [x - 8, y + 30, z + 8]);
}

function engineHouse(w: WorldBuilder): void {
	const [cx, cz] = ENG;
	const y = P + 1;
	const [x0, x1, z0, z1] = [cx - 7, cx + 7, cz - 5, cz + 5];
	w.box([x0 - 1, P - 2, z0 - 1], [x1 + 1, y, z1 + 1], 'slate-d');
	w.box([x0, y + 1, z0], [x1, y + 8, z1], 'brick');
	w.shade([x0, y + 1, z0], [x1, y + 8, z1], ['brick-d', 'brick', 'brick-l'], {
		only: 'brick',
		scale: 2,
		speckle: 0.3,
	});
	for (const [px, pz] of [
		[x0, z0],
		[x1, z0],
		[x0, z1],
		[x1, z1],
	]) {
		w.box([px, y + 1, pz], [px, y + 8, pz], 'brass-d');
	}
	// двускатная медная крыша с латунным коньком
	for (let i = 0; i <= 6; i++) {
		w.box([x0 - 1, y + 9 + i, z0 - 1 + i], [x1 + 1, y + 9 + i, z1 + 1 - i], 'copper');
		w.box([x0, y + 9 + i, z0 + i], [x1, y + 9 + i, z1 - i], 'brick-d');
	}
	for (let i = 0; i <= 6; i++) {
		w.box([x0 - 1, y + 9 + i, z0 - 1 + i], [x1 + 1, y + 9 + i, z0 - 1 + i], 'copper');
		w.box([x0 - 1, y + 9 + i, z1 + 1 - i], [x1 + 1, y + 9 + i, z1 + 1 - i], 'copper');
	}
	w.box([x0 - 1, y + 15, cz], [x1 + 1, y + 15, cz], 'brass');
	// труба
	w.box([x0 + 2, y + 9, z0 + 2], [x0 + 4, y + 19, z0 + 4], 'brick-d');
	w.box([x0 + 1, y + 20, z0 + 1], [x0 + 5, y + 20, z0 + 5], 'brass-d');
	w.anchor('chimney', [x0 + 3.5, y + 22, z0 + 3.5]);
	// топка на стене к площади
	w.box([x1 + 1, y + 1, cz - 3], [x1 + 1, y + 6, cz + 3], 'iron');
	w.box([x1 + 1, y + 2, cz - 2], [x1 + 1, y + 4, cz + 2], 'ember');
	w.box([x1 + 2, y + 1, cz - 3], [x1 + 3, y + 1, cz + 3], 'iron');
	w.anchor('furnace', [x1 + 3, y + 2, cz + 0.5]);
	w.anchor('furnaceGlow', [x1 + 6, y + 6, cz + 0.5]);
	// окна и оси шестерён на стене к зрителю
	w.box([x1 - 4, y + 3, z1], [x1 - 3, y + 6, z1], 'glow');
	w.box([x1 - 1, y + 3, z1], [x1 - 1, y + 6, z1], 'glow');
	w.box([Math.floor(FLY[0]), Math.floor(FLY[1]), z1 + 1], [FLY[0], FLY[1], z1 + 3], 'brass-d');
	const px = Math.floor(PINION[0]);
	const py = Math.floor(PINION[1]);
	w.box([px, P + 1, z1 + 1], [px, py, z1 + 1], 'iron');
	w.box([px - 1, P - 1, z1], [px + 1, P + 1, z1 + 2], 'slate-d');
	w.box([px, py, z1 + 1], [px, py, z1 + 3], 'brass-d');
	// латунный вал от дома к постаменту, утопленный в плиты
	w.line([x1 + 2, P, cz], [C - 10, P, C + 4], 'brass-d');
}

function shard(w: WorldBuilder, x: number, y: number, z: number, h: number, lean: number[]): void {
	w.curve(
		[
			[x, y, z],
			[x + lean[0], y + h, z + lean[1]],
		],
		'crystal',
		{ radius: Math.max(1, h / 5.5), endRadius: 0.3 },
	);
}

/** Друза светящихся кристаллов; возвращает false, если под ней нет земли. */
function cluster(w: WorldBuilder, fx: number, fz: number, size: number, name?: string): boolean {
	const x = Math.floor(fx);
	const z = Math.floor(fz);
	const y = w.heightAt(x, z);
	if (y < 0 || w.get([x, y, z]) !== 'grass') return false;
	shard(w, x, y, z, size, [w.rng.int(-1, 1), w.rng.int(-1, 1)]);
	const n = size > 6 ? 4 : 3;
	for (let i = 0; i < n; i++) {
		const a = w.rng.float(0, TAU);
		const d = w.rng.float(1.5, 3);
		const sx = Math.round(x + d * Math.cos(a));
		const sz = Math.round(z + d * Math.sin(a));
		shard(w, sx, y, sz, w.rng.int(2, Math.max(3, size - 3)), [
			Math.round(2 * Math.cos(a)),
			Math.round(2 * Math.sin(a)),
		]);
	}
	w.shade([x - 7, y, z - 7], [x + 7, y + size + 2, z + 7], ['crystal-d', 'crystal', 'crystal-l'], {
		only: 'crystal',
		scale: 2,
		speckle: 0.3,
	});
	if (name !== undefined) w.anchor(name, [x + 0.5, y + size + 5, z + 0.5]);
	return true;
}

function garden(w: WorldBuilder): void {
	// кристаллы по кромке и на островках
	const rim: Array<[number, number, number, string?]> = [
		[51.5, 28, 6, 'rimGlow'],
		[52, 64, 4],
		[52, 96, 7],
		[51.5, 128, 5],
		[52, 190, 8],
		[52, 226, 9, 'backGlow'],
		[51.5, 254, 6],
		[52, 342, 5],
	];
	for (const [r, deg, size, name] of rim) cluster(w, ...polar(r, deg), size, name);
	cluster(w, C + 50, C + 52, 9);
	cluster(w, C + 47, C + 56, 5);
	cluster(w, C - 10, C + 68, 5);

	// ивы с бирюзовой листвой — сзади и по бокам, чтобы не закрывать механизм
	const teal: [string, string, string] = ['#1d6a6c', '#2f9c8f', '#7fe6cc'];
	const violet: [string, string, string] = ['#4a3a8c', '#7a5fc4', '#c0a4f2'];
	const trees: Array<[number, number, number, boolean]> = [
		[52, 112, 7, false],
		[53, 180, 8, true],
		[52, 210, 6, false],
		[53, 240, 8, true],
		[52, 266, 7, false],
		[53, 324, 7, false],
	];
	for (const [r, deg, height, isViolet] of trees) {
		const [fx, fz] = polar(r, deg);
		const x = Math.floor(fx);
		const z = Math.floor(fz);
		const y = w.heightAt(x, z);
		if (y < 0 || w.get([x, y, z]) !== 'grass') continue;
		w.place(
			prefabs.willow({
				rng: w.rng.fork(),
				height,
				colors: isViolet ? violet : teal,
				bark: '#3a2f45',
			}),
			[x, y + 1, z],
		);
	}
	const islet = w.heightAt(C + 66, C - 8);
	w.place(prefabs.willow({ rng: w.rng.fork(), height: 6, colors: violet, bark: '#3a2f45' }), [
		C + 66,
		islet + 1,
		C - 8,
	]);
	for (const [r, deg] of [
		[50, 10],
		[50.5, 48],
		[50, 80],
		[51, 134],
		[51, 228],
		[50, 290],
		[50.5, 355],
	]) {
		const [fx, fz] = polar(r, deg);
		const x = Math.floor(fx);
		const z = Math.floor(fz);
		const y = w.heightAt(x, z);
		if (y < 0 || w.get([x, y, z]) !== 'grass') continue;
		w.place(
			prefabs.bush({ rng: w.rng.fork(), size: w.rng.int(2, 3), colors: teal, flowers: '#7df9ff' }),
			[x, y + 1, z],
		);
	}

	w.grass(['blade', 'blade-l'], { on: 'grass', density: 0.32, height: [1, 2] });
	w.flowers(['bloom', 'bloom-p'], { on: 'grass', density: 0.022, stem: 'blade' });
	w.moss('moss', { on: 'rock', amount: 0.3 });
	w.vines(['vine', 'vine-l'], { from: ['rock', 'soil'], density: 0.07, length: [3, 11] });
}

/** Телескоп на треноге и стол со звёздной картой у постамента. */
function instruments(w: WorldBuilder): void {
	const [x, z] = [C + 15, C + 19];
	w.line([x - 1, P + 1, z - 1], [x, P + 3, z], 'brass-d');
	w.line([x + 1, P + 1, z - 1], [x, P + 3, z], 'brass-d');
	w.line([x, P + 1, z + 1], [x, P + 3, z], 'brass-d');
	w.curve(
		[
			[x - 1, P + 4, z - 1],
			[x + 2, P + 7, z + 2],
		],
		'brass',
		{ radius: 0.8, endRadius: 1.1 },
	);
	w.set([x + 3, P + 8, z + 3], 'glow-c');
	const [tx, tz] = [C + 22, C + 12];
	w.box([tx, P + 1, tz], [tx, P + 2, tz], 'brass-d');
	w.box([tx + 3, P + 1, tz + 2], [tx + 3, P + 2, tz + 2], 'brass-d');
	w.box([tx, P + 1, tz + 2], [tx, P + 2, tz + 2], 'brass-d');
	w.box([tx + 3, P + 1, tz], [tx + 3, P + 2, tz], 'brass-d');
	w.box([tx, P + 3, tz], [tx + 3, P + 3, tz + 2], 'chart');
	w.set([tx + 1, P + 3, tz + 1], 'rune');
	w.set([tx + 2, P + 3, tz], 'rune');
	w.set([tx + 3, P + 3, tz + 2], 'rune');
}

/** Оси шестерён в скале под площадью: плоскость — по самой выступающей точке склона. */
function cliffGears(w: WorldBuilder): void {
	const face = (x: number, y: number): number => {
		for (let z = 151; z > C; z--) if (w.get([x, y, z]) !== null) return z;
		return C + 30;
	};
	const z = Math.max(face(CLIFF_A[0], CLIFF_A[1]), face(CLIFF_B[0], CLIFF_B[1])) + 1;
	for (const [x, y] of [CLIFF_A, CLIFF_B]) {
		w.box([x - 1, y - 1, z - 14], [x, y, z + 1], 'brass-d');
		w.box([x - 2, y - 2, z - 3], [x + 1, y + 1, z - 2], 'iron');
	}
	w.anchor('cliffA', [CLIFF_A[0], CLIFF_A[1], z + 1]);
	w.anchor('cliffB', [CLIFF_B[0], CLIFF_B[1], z + 1]);
}

const cometHead = model(
	{
		size: [5, 5, 5],
		pivot: [2.5, 2.5, 2.5],
		scale: 0.6,
		palette: {
			head: { color: '#f2ffff', emissive: 1.5, vary: 0 },
			halo: { color: '#8feaff', emissive: 0.9, vary: 0.04 },
		},
	},
	(m) => {
		m.sphere([2, 2, 2], 2.3, 'halo');
		m.sphere([2, 2, 2], 1.3, 'head');
	},
);

const cometSpark = (scale: number) =>
	model(
		{
			size: [2, 2, 2],
			pivot: [1, 1, 1],
			scale,
			palette: { spark: { color: '#7fdcff', emissive: 1.0, vary: 0.1 } },
		},
		(m) => {
			m.box([0, 0, 0], [1, 1, 1], 'spark');
		},
	);

const COMET = {
	center: [C + 0.5, P + 45, C + 0.5] as Vec3,
	radius: [50, 44] as const,
	tilt: 6,
	phase: -1.92,
	start: 2.416,
	speed: 0.3,
	lag: 0.04,
};

const pointUp = limbs({
	parts: {
		armR: ({ t }) => [0, 0, 150 + 12 * Math.sin(t * 2.4)],
		head: ({ t }) => [-16 + 4 * Math.sin(t * 1.3), 0, 0],
	},
	replace: true,
});

const smokeBands = [
	{ size: 2, band: [0, 0.34] },
	{ size: 3, band: [0.34, 0.72] },
	{ size: 2, band: [0.72, 1] },
] as const;

const promenade = Array.from({ length: 12 }, (_, i): [number, number] => polar(22, i * 30 + 8));

export default defineDiorama({
	meta: {
		title: 'The Clockwork Orrery',
		createdAt: '2026-11-16',
		author: { model: 'Claude Fable 5.2' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'A brass solar system turning on a floating island at night: four planets and a moon ride clockwork arms around a glowing sun while astronomers pace the zodiac plaza and a comet circles overhead.',
		tags: ['steampunk', 'space', 'floating island', 'machine', 'night', 'fantasy'],
	},
	seed: 861464352,
	size: [152, 128, 152],
	palette: {
		grass: { color: '#3d8a72', vary: 0.14 },
		soil: { color: '#4b3a3e', vary: 0.1 },
		rock: { color: '#3d4060', vary: 0.12 },
		moss: { color: '#2f7f74', vary: 0.14 },
		blade: { color: '#4fa888', vary: 0.14 },
		'blade-l': { color: '#74cfa6', vary: 0.12 },
		bloom: { color: '#7df9ff', emissive: 0.45 },
		'bloom-p': { color: '#ff9ae0', emissive: 0.4 },
		vine: { color: '#2c6f66', vary: 0.12 },
		'vine-l': { color: '#57b59a', vary: 0.12 },
		'tile-a': { color: '#2e3560', vary: 0.05 },
		'tile-b': { color: '#737cb2', vary: 0.05 },
		'ring-tile': { color: '#1c2036', vary: 0.04 },
		'slate-d': { color: '#252a45', vary: 0.06 },
		stone: { color: '#8a8fa8', vary: 0.06 },
		'stone-d': { color: '#5e6382', vary: 0.06 },
		'stone-l': { color: '#b0b5ca', vary: 0.05 },
		brass: { color: '#c89b3c', vary: 0.06 },
		'brass-d': { color: '#8a6424', vary: 0.06 },
		'brass-l': { color: '#f2cf6e', emissive: 0.2, vary: 0.03 },
		copper: { color: '#b5653a', vary: 0.08 },
		verdigris: { color: '#4fa38a', vary: 0.1 },
		'verdigris-l': { color: '#84d4b8', vary: 0.08 },
		brick: { color: '#6f5764', vary: 0.06 },
		'brick-d': { color: '#514150', vary: 0.06 },
		'brick-l': { color: '#8d707a', vary: 0.06 },
		iron: { color: '#2a2a36', vary: 0.05 },
		door: { color: '#4a2f2a', vary: 0.05 },
		chart: { color: '#1f2a52', vary: 0.03 },
		rune: { color: '#5fe3f7', emissive: 0.85, vary: 0 },
		lamp: { color: '#57d8ee', emissive: 0.7, vary: 0 },
		glow: { color: '#ffc45a', emissive: 1.7, vary: 0 },
		'glow-c': { color: '#9ff2ff', emissive: 1.0, vary: 0 },
		ember: { color: '#ff7a2a', emissive: 1.8, vary: 0.05 },
		crystal: { color: '#48d6f0', emissive: 0.65, vary: 0.05 },
		'crystal-d': { color: '#2a8fc4', emissive: 0.4, vary: 0.05 },
		'crystal-l': { color: '#b6f6ff', emissive: 0.9, vary: 0.03 },
	},
	build(w) {
		islands(w);
		plaza(w);
		pedestal(w);
		pylons(w);
		observatory(w);
		engineHouse(w);
		instruments(w);
		garden(w);
		cliffGears(w);
		w.anchor('sunGlow', SUN);
		w.anchor('lampA', [C + 14, P + 6, C + 14]);
		w.anchor('lampB', [C - 14, P + 6, C + 14]);
		w.anchor('lampC', [C + 14, P + 6, C - 14]);
		w.anchor('lampD', [C - 14, P + 6, C - 14]);
	},
	entities: [
		{ id: 'orrery', rig: orrery, at: [C + 0.5, HUB_Y, C + 0.5], animate: orreryMotion },
		{
			id: 'flywheel',
			model: gear(9, 12, 6),
			at: FLY,
			animate: spin({ axis: 'z', speed: 0.09 }),
		},
		{
			id: 'pinion',
			model: gear(5, 6, 3),
			at: PINION,
			animate: spin({ axis: 'z', speed: -0.18 }),
		},
		{
			id: 'cliffGearA',
			model: gear(13, 16, 6),
			at: 'cliffA',
			animate: spin({ axis: 'z', speed: 0.035 }),
		},
		{
			id: 'cliffGearB',
			model: gear(8, 10, 4),
			at: 'cliffB',
			animate: spin({ axis: 'z', speed: -0.056 }),
		},
		{
			id: 'astronomers',
			rig: astronomer({ robe: '#e2d3ac', trim: '#f2cf6e', hat: '#8c3350' }),
			count: 3,
			animate: walkPath(promenade, { speed: 1.5, loop: true, pause: 1.2 }),
		},
		{
			id: 'scholar',
			rig: astronomer({ robe: '#cf4f48', trim: '#f2cf6e', hat: '#8a2a30' }),
			at: [C + 17.5, C + 22.5],
			animate: pointUp,
		},
		{
			id: 'watcher',
			rig: astronomer({ robe: '#ece6f5', trim: '#f2cf6e', hat: '#6a4fc0' }),
			at: 'balcony',
			animate: pointUp,
		},
		{
			id: 'stoker',
			rig: astronomer({ robe: '#d1924e', trim: '#ff9a4a', hat: '#6a4630' }),
			animate: walkPath(
				[
					[ENG[0] + 12, ENG[1] + 1],
					[ENG[0] + 22, ENG[1] - 6],
					[ENG[0] + 13, ENG[1] + 10],
				],
				{ speed: 1.3, loop: 'pingpong', pause: 2.5 },
			),
		},
		{
			id: 'cat',
			rig: prefabs.cat({ color: '#e8e4dc' }),
			animate: wander({ area: [C + 10, C + 24, C + 32, C + 34], speed: 1.2, pause: [1, 4] }),
		},
		{ id: 'furnaceFlame', model: flame(4), at: 'furnace', animate: flicker },
		...smokeBands.map((s, i) => ({
			id: `smoke${i}`,
			model: puff(s.size, '#4f4d68', '#8a88a8'),
			at: 'chimney',
			count: 4,
			animate: rise({
				origin: [ENG[0] - 3.5, P + 23, ENG[1] - 1.5],
				height: 24,
				period: 10,
				band: s.band,
				drift: [-5, -7],
			}),
		})),
		{
			id: 'comet',
			model: cometHead,
			at: COMET.center,
			animate: comet({ ...COMET, first: 0 }),
		},
		{
			id: 'cometTail',
			model: cometSpark(0.6),
			at: COMET.center,
			count: 6,
			animate: comet({ ...COMET, first: 1 }),
		},
		{
			id: 'cometDust',
			model: cometSpark(0.35),
			at: COMET.center,
			count: 9,
			animate: comet({ ...COMET, first: 7 }),
		},
	],
	particles: [
		fireflies({ count: 90, color: '#7df9ff', onlyAtNight: false }),
		dust({ count: 200, color: '#ffe6a8' }),
	],
	lights: [
		pointLight({ at: 'sunGlow', color: '#ffd27a', intensity: 50, distance: 140 }),
		pointLight({ at: 'lampA', color: '#ffe6c0', intensity: 45, distance: 60 }),
		pointLight({ at: 'lampB', color: '#ffe6c0', intensity: 45, distance: 60 }),
		pointLight({ at: 'lampC', color: '#ffe6c0', intensity: 45, distance: 60 }),
		pointLight({ at: 'lampD', color: '#ffe6c0', intensity: 45, distance: 60 }),
		pointLight({
			at: 'furnaceGlow',
			color: '#ff8a3c',
			intensity: 22,
			distance: 34,
			flicker: true,
		}),
		pointLight({ at: 'obsGlow', color: '#7df9ff', intensity: 18, distance: 34 }),
		pointLight({ at: 'backGlow', color: '#5ee6ff', intensity: 20, distance: 36 }),
	],
	atmosphere: {
		time: { start: 22.5, speed: 0.5, cycle: 600 },
		sky: 'stylized',
		haze: 0.45,
		backdrop: { clouds: 0.5, cloudSea: true },
	},
	base: 'none',
	camera: {
		position: [C + 84, P + 40, C + 88],
		target: [C, P + 12, C],
		autoRotate: false,
		tiltShift: 0.3,
		captureTime: 3,
	},
});
