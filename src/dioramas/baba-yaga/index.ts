import {
	defineDiorama,
	fire,
	fireflies,
	flock,
	leaves,
	limbs,
	mist,
	orbit,
	pointLight,
	pour,
	prefabs,
	smoke,
	sparks,
	type Vec3,
	type WorldBuilder,
	walkPath,
	wander,
} from '#sdk';
import { flame, flicker, puff, rise } from './fx.ts';
import { CHIMNEY_TOP, HUT_SCALE, hut, hutWalk, STRIDE, yaga, yagaFly } from './hut.ts';

const SIZE = 160;
const HEIGHT = 128;
/** Центр острова и двора. */
const C = 80;
/** y поверхности двора (верхний твёрдый воксель). */
const G = 46;
const YARD = 38;
const FENCE = 36;
const HUT_R = 20;
const HUT_SPEED = 6;
const HUT_PHASE = -0.85;
/** Где сейчас труба шагающей избы (орбита из сущности `hut`). */
const chimneyAt = (t: number): Vec3 => {
	const a = HUT_PHASE + (HUT_SPEED / HUT_R) * t;
	return [C + HUT_R * Math.cos(a), G + 1 + (31 + CHIMNEY_TOP) * HUT_SCALE, C + HUT_R * Math.sin(a)];
};
const BREW: Vec3 = [C + 0.5, G + 12, C + 0.5];
const smokeBands = [
	{ size: 3, band: [0, 0.34] },
	{ size: 2, band: [0.34, 0.7] },
	{ size: 1, band: [0.7, 1] },
] as const;
const GATE = Math.PI / 4;
const TAU = Math.PI * 2;

const polar = (r: number, a: number): [number, number] => [
	Math.round(C + r * Math.cos(a)),
	Math.round(C + r * Math.sin(a)),
];

/** Выравнивает колонку до высоты y: лишнее срезает, недостающее досыпает. */
function level(w: WorldBuilder, x: number, z: number, y: number, top: string): void {
	const h = w.heightAt(x, z);
	if (h < 0) return;
	if (h > y) w.box([x, y + 1, z], [x, h, z], 'air');
	else if (h < y) w.box([x, h, z], [x, y - 1, z], 'soil');
	w.set([x, y, z], top);
}

function buildYard(w: WorldBuilder): void {
	for (let z = C - YARD; z <= C + YARD; z++) {
		for (let x = C - YARD; x <= C + YARD; x++) {
			const d = Math.hypot(x - C, z - C);
			if (d > YARD) continue;
			const n = (w.noise.fbm(x / 7, z / 7, 2) - 0.5) * 6;
			let top = 'grass';
			if (d + n < 7) top = 'ash';
			else if (d + n > 9 && d + n < 31)
				top =
					w.noise.fbm(x / 3 + 9, z / 3, 2) > 0.62
						? 'dirt-d'
						: w.noise.fbm(x / 5 - 31, z / 5 + 17, 2) > 0.58
							? 'dirt-l'
							: 'dirt';
			level(w, x, z, G, top);
		}
	}
	// тропа от ворот к краю острова
	for (let r = 28; r < 54; r++) {
		for (let s = -3; s <= 3; s++) {
			const x = Math.round(C + r * Math.cos(GATE) - s * Math.sin(GATE));
			const z = Math.round(C + r * Math.sin(GATE) + s * Math.cos(GATE));
			const h = w.heightAt(x, z);
			if (h < 0 || Math.abs(s) + w.rng.float(0, 1.4) > 3.2) continue;
			w.set([x, h, z], w.rng.chance(0.25) ? 'dirt-d' : 'dirt');
		}
	}
	// следы куриных лап по кругу, где ходит изба
	const step = STRIDE / 2 / HUT_R;
	for (let i = 0; i * step < TAU; i++) {
		const a = i * step;
		const r = HUT_R + (i % 2 === 0 ? -8 : 8) * HUT_SCALE;
		const px = C + r * Math.cos(a);
		const pz = C + r * Math.sin(a);
		const t = a + Math.PI / 2;
		for (const [da, len] of [
			[0, 6],
			[0.55, 5],
			[-0.55, 5],
			[Math.PI, 3],
		] as const) {
			w.line(
				[Math.round(px), G, Math.round(pz)],
				[Math.round(px + len * Math.cos(t + da)), G, Math.round(pz + len * Math.sin(t + da))],
				'track',
			);
		}
	}
}

function buildBonfire(w: WorldBuilder): void {
	const y = G + 1;
	for (let i = 0; i < 14; i++) {
		const a = (i / 14) * TAU;
		const x = Math.round(C + 4.4 * Math.cos(a));
		const z = Math.round(C + 4.4 * Math.sin(a));
		w.set([x, y, z], i % 3 === 0 ? 'stone-d' : 'stone');
		if (i % 2 === 0) w.set([x, y + 1, z], 'stone');
	}
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + 0.3;
		w.line(
			[Math.round(C + 3 * Math.cos(a)), y, Math.round(C + 3 * Math.sin(a))],
			[C, y + 3, C],
			'log',
		);
	}
	w.box([C - 1, y, C - 1], [C + 1, y, C + 1], 'ember');
	w.set([C, y + 1, C], 'ember');
	// тренога и котёл
	const apex: Vec3 = [C, y + 15, C];
	for (let i = 0; i < 3; i++) {
		const a = (i / 3) * TAU + 0.5;
		w.line([Math.round(C + 6.5 * Math.cos(a)), y, Math.round(C + 6.5 * Math.sin(a))], apex, 'pole');
	}
	w.line([C, y + 14, C], [C, y + 10, C], 'iron');
	w.sphere([C, y + 7, C], 3.4, 'iron');
	w.box([C - 4, y + 9, C - 4], [C + 4, y + 11, C + 4], 'air');
	w.cylinder([C, y + 8, C], 2.4, 1, 'brew');
	w.cylinder([C, y + 8, C], 3.6, 1, 'iron');
	w.cylinder([C, y + 8, C], 2.6, 1, 'brew');
	w.line([C, y + 10, C], [C, y + 14, C], 'iron');
	w.line([C - 3, y + 9, C], [C, y + 11, C], 'iron');
	w.line([C + 3, y + 9, C], [C, y + 11, C], 'iron');
	w.anchor('bonfire', [C + 0.5, y + 1.5, C + 0.5]);
	w.anchor('glow', [C + 0.5, y + 7.5, C + 0.5]);
	w.anchor('fireA', [C + 4.5, y + 1.5, C + 3.5]);
	w.anchor('fireB', [C - 4.5, y + 1.5, C + 3.5]);
	w.anchor('fireC', [C + 4.5, y + 1.5, C - 3.5]);
	w.anchor('brew', [C + 0.5, y + 9.5, C + 0.5]);
}

function skull(w: WorldBuilder, x: number, y: number, z: number, a: number): void {
	w.box([x - 1, y, z - 1], [x + 1, y + 2, z + 1], 'bone');
	w.set([x, y - 1, z], 'bone');
	const dx = Math.round(Math.cos(a));
	const dz = Math.round(Math.sin(a));
	// глазницы смотрят наружу
	if (dx !== 0 && dz !== 0) {
		w.set([x + dx, y + 1, z], 'eye');
		w.set([x, y + 1, z + dz], 'eye');
	} else if (dx !== 0) {
		w.set([x + dx, y + 1, z - 1], 'eye');
		w.set([x + dx, y + 1, z + 1], 'eye');
	} else {
		w.set([x - 1, y + 1, z + dz], 'eye');
		w.set([x + 1, y + 1, z + dz], 'eye');
	}
}

function buildFence(w: WorldBuilder): void {
	const steps = 200;
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * TAU;
		let off = Math.abs(a - GATE);
		if (off > Math.PI) off = TAU - off;
		if (off < 0.15) continue;
		const [x, z] = polar(FENCE, a);
		const y = G + 1;
		const post = i % 4 === 0;
		const tall = i % 20 === 0;
		const h = tall ? 8 : post ? 6 : 4;
		if (post) {
			w.box([x, y, z], [x, y + h - 1, z], i % 8 === 0 ? 'stake-d' : 'stake');
			if (!tall) w.set([x, y + h, z], 'bone');
		} else {
			w.set([x, y + 2, z], 'stake');
			w.set([x, y + 4, z], 'stake-d');
		}
		if (tall) skull(w, x, y + h + 1, z, a);
	}
	// ворота: два столба с черепами и перекладина с костью
	const posts = [-0.16, 0.16].map((d) => polar(FENCE, GATE + d));
	for (const [i, [x, z]] of posts.entries()) {
		w.box([x - 1, G + 1, z - 1], [x, G + 13, z], 'stake-d');
		skull(w, x, G + 15, z, GATE);
		w.anchor(i === 0 ? 'gateL' : 'gateR', [x + 1.5, G + 9.5, z + 1.5]);
	}
	const [[ax, az], [bx, bz]] = posts as [[number, number], [number, number]];
	w.line([ax, G + 12, az], [bx, G + 12, bz], 'stake');
	w.line([ax, G + 13, az], [bx, G + 13, bz], 'stake-d');
	const mx = Math.round((ax + bx) / 2);
	const mz = Math.round((az + bz) / 2);
	w.box([mx, G + 9, mz], [mx, G + 11, mz], 'bone');
	w.box([mx - 1, G + 8, mz], [mx + 1, G + 8, mz], 'bone');
}

function birch(w: WorldBuilder, x: number, z: number, h: number, leaf: 'gold' | 'rust'): void {
	const y0 = w.heightAt(x, z) + 1;
	if (y0 <= 0) return;
	const lx = w.rng.int(-3, 3);
	const lz = w.rng.int(-3, 3);
	const top: Vec3 = [x + lx, y0 + h, z + lz];
	w.curve([[x, y0 - 1, z], [x + lx * 0.2, y0 + h * 0.5, z + lz * 0.2], top], 'birch', {
		radius: 1.5,
		endRadius: 0.8,
	});
	for (let y = y0; y < y0 + h; y++) {
		for (let dz = -3; dz <= 3; dz++) {
			for (let dx = -3; dx <= 3; dx++) {
				if (w.get([x + dx, y, z + dz]) !== 'birch') continue;
				if (w.rng.chance(y % 4 === 0 ? 0.45 : 0.06)) w.set([x + dx, y, z + dz], 'birch-mark');
			}
		}
	}
	const seed = w.rng.int(0, 9999);
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * TAU + w.rng.float(0, 1.2);
		const len = w.rng.float(4, 7);
		const from: Vec3 = [
			x + lx * (0.5 + i * 0.1),
			y0 + h * (0.55 + i * 0.1),
			z + lz * (0.5 + i * 0.1),
		];
		const to: Vec3 = [
			from[0] + len * Math.cos(a),
			from[1] + w.rng.float(2, 4),
			from[2] + len * Math.sin(a),
		];
		w.curve([from, to], 'birch', { radius: 0.7, endRadius: 0.5 });
		w.blob(to, [w.rng.float(4, 5.5), w.rng.float(3, 4), w.rng.float(4, 5.5)], leaf, {
			roughness: 0.4,
			scale: 4,
			seed: seed + i,
		});
	}
	w.blob([top[0], top[1] + 1, top[2]], [6, 4.5, 6], leaf, { roughness: 0.4, scale: 5, seed });
}

function spruce(w: WorldBuilder, x: number, z: number, h: number): void {
	const y0 = w.heightAt(x, z) + 1;
	if (y0 <= 0) return;
	w.cylinder([x, y0 - 1, z], 1.3, Math.round(h * 0.3) + 1, 'bark');
	const tiers = Math.max(4, Math.round(h / 4.5));
	const from = y0 + Math.round(h * 0.2);
	const span = y0 + h - from;
	for (let i = 0; i < tiers; i++) {
		const k = i / tiers;
		const r = 7.5 * (1 - k) + 1.6;
		w.cone([x, from + Math.round(k * span), z], r, Math.round(span / tiers) + 4, 'spruce');
	}
}

function deadTree(w: WorldBuilder, x: number, z: number, h: number): void {
	const y0 = w.heightAt(x, z) + 1;
	if (y0 <= 0) return;
	const top: Vec3 = [x + 2, y0 + h, z - 1];
	w.curve([[x, y0 - 1, z], [x - 1, y0 + h * 0.5, z + 1], top], 'dead', {
		radius: 1.8,
		endRadius: 0.7,
	});
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * TAU + 0.4;
		const k = 0.45 + i * 0.11;
		const from: Vec3 = [x + (i % 2), y0 + h * k, z];
		const mid: Vec3 = [from[0] + 4 * Math.cos(a), from[1] + 2, from[2] + 4 * Math.sin(a)];
		const to: Vec3 = [
			from[0] + 7 * Math.cos(a + 0.4),
			from[1] + 6 + (i % 3),
			from[2] + 7 * Math.sin(a + 0.4),
		];
		w.curve([from, mid, to], 'dead', { radius: 0.8, endRadius: 0.5 });
	}
}

function agaric(w: WorldBuilder, x: number, z: number, h: number, r: number): void {
	const y0 = w.heightAt(x, z) + 1;
	if (y0 <= 0) return;
	w.cylinder([x, y0, z], r > 3 ? 1.2 : 0.6, h, 'stem');
	w.cylinder([x, y0 + h - 2, z], r > 3 ? 1.8 : 1, 1, 'stem');
	w.ellipsoid([x, y0 + h, z], [r, r * 0.7, r], 'cap');
	w.box([x - r - 1, y0 + h - r, z - r - 1], [x + r + 1, y0 + h - 1, z + r + 1], 'air');
	w.cylinder([x, y0, z], r > 3 ? 1.2 : 0.6, h, 'stem');
	w.cylinder([x, y0 + h - 1, z], r - 0.6, 1, 'gill');
	for (let i = 0; i < r * 3; i++) {
		const a = w.rng.float(0, TAU);
		const d = w.rng.float(0, r - 0.5);
		const px = Math.round(x + d * Math.cos(a));
		const pz = Math.round(z + d * Math.sin(a));
		for (let y = y0 + h + Math.ceil(r); y >= y0 + h; y--) {
			if (w.get([px, y, pz]) === 'cap') {
				w.set([px, y, pz], 'cap-dot');
				break;
			}
		}
	}
}

function pumpkin(w: WorldBuilder, x: number, z: number, r: number, lit: boolean): void {
	const y0 = w.heightAt(x, z) + 1;
	if (y0 <= 0) return;
	const ry = r * 0.78;
	const n = Math.ceil(r);
	w.ellipsoid([x, y0 + ry, z], [r, ry, r], 'pumpkin');
	// рёбра-дольки по окружности
	for (let dy = 0; dy <= Math.ceil(ry * 2); dy++) {
		for (let d = -n; d <= n; d++) {
			for (let e = -n; e <= n; e++) {
				if (w.get([x + d, y0 + dy, z + e]) !== 'pumpkin') continue;
				const seg = Math.floor(((Math.atan2(e, d) + Math.PI) / (2 * Math.PI)) * 10 + 0.5);
				if (seg % 2 === 0) w.set([x + d, y0 + dy, z + e], 'pumpkin-d');
			}
		}
	}
	const ty = y0 + Math.round(ry * 2);
	w.set([x, ty, z], 'vine');
	w.set([x, ty + 1, z], 'vine');
	if (!lit) return;
	// рожица на двух гранях, обращённых к камере (+x и +z)
	const fy = y0 + Math.round(ry);
	const eye = r >= 4 ? 2 : 1;
	for (const [dx, dz] of [
		[1, 0],
		[0, 1],
	] as const) {
		for (let k = -eye - 1; k <= eye + 1; k++) {
			// луч от центра наружу до поверхности тыквы
			const put = (yy: number): void => {
				for (let t = n + 1; t >= 0; t--) {
					const q: [number, number, number] = [x + dx * t + dz * k, yy, z + dz * t + dx * k];
					const g = w.get(q);
					if (g === 'pumpkin' || g === 'pumpkin-d') {
						w.set(q, 'face');
						return;
					}
				}
			};
			if (Math.abs(k) === eye) put(fy + 1);
			if (Math.abs(k) <= eye) put(fy - 1);
			if (Math.abs(k) === eye + 1 && r >= 4) put(fy);
		}
	}
}

function buildPond(w: WorldBuilder, px: number, pz: number, level0: number): void {
	const rx = 11;
	const rz = 8;
	for (let z = pz - rz - 2; z <= pz + rz + 2; z++) {
		for (let x = px - rx - 2; x <= px + rx + 2; x++) {
			const n = (w.noise.fbm(x / 5, z / 5, 2) - 0.5) * 0.5;
			const d = Math.hypot((x - px) / rx, (z - pz) / rz) + n;
			const h = w.heightAt(x, z);
			if (h < 0) continue;
			if (d < 1) {
				w.box([x, level0 + 1, z], [x, Math.max(h, level0 + 1), z], 'air');
				w.box([x, level0 - 3, z], [x, level0 - 2, z], 'mud');
				w.box([x, level0 - 1, z], [x, level0, z], 'water');
			} else if (d < 1.25) {
				w.set([x, h, z], 'mud');
				if (w.rng.chance(0.35)) {
					const rh = w.rng.int(2, 5);
					w.box([x, h + 1, z], [x, h + rh, z], 'reed');
					if (w.rng.chance(0.5)) w.box([x, h + rh + 1, z], [x, h + rh + 2, z], 'cattail');
				}
			}
		}
	}
	for (let i = 0; i < 9; i++) {
		const a = w.rng.float(0, TAU);
		const d = w.rng.float(0.1, 0.75);
		const x = Math.round(px + d * rx * Math.cos(a));
		const z = Math.round(pz + d * rz * Math.sin(a));
		w.box([x, level0 + 1, z], [x + 1, level0 + 1, z + 1], 'lily');
		if (i % 3 === 0) w.set([x, level0 + 2, z], 'lily-flower');
	}
	// протока к краю и водопад
	let x = px;
	let z = pz + rz - 2;
	for (let i = 0; i < 40; i++) {
		z += 1;
		if (i % 5 === 4) x -= 1;
		if (w.heightAt(x, z) < 0 && w.heightAt(x + 1, z) < 0) break;
		for (let dx = -1; dx <= 2; dx++) {
			const h = w.heightAt(x + dx, z);
			if (h < 0) continue;
			const bank = dx === -1 || dx === 2;
			if (bank) {
				if (h <= level0) w.set([x + dx, h, z], 'mud');
				continue;
			}
			if (h > level0) w.box([x + dx, level0 + 1, z], [x + dx, h, z], 'air');
			w.set([x + dx, level0, z], 'water');
			w.set([x + dx, level0 - 1, z], 'mud');
		}
	}
	w.waterfall({ at: [x, level0, z], width: [2, 2], to: 6, name: 'fall' });
}

export default defineDiorama({
	meta: {
		title: 'The Hut on Chicken Legs',
		createdAt: '2026-11-16',
		author: { model: 'Claude Fable 5.2' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			"Baba Yaga's log hut stomps on giant chicken legs around a bubbling cauldron on a floating clod of autumn swamp, while the witch herself circles overhead in her flying mortar, sweeping her trail away with a broom.",
		tags: ['folklore', 'witch', 'autumn', 'swamp', 'floating island', 'walking house'],
	},
	seed: 1313,
	size: [SIZE, HEIGHT, SIZE],
	palette: {
		grass: { color: '#5f7a38', vary: 0.14 },
		'grass-d': { color: '#48622f', vary: 0.14 },
		'grass-l': { color: '#84983f', vary: 0.14 },
		'grass-y': { color: '#b3a23f', vary: 0.14 },
		soil: { color: '#5a4332', vary: 0.12 },
		rock: { color: '#5d6070', vary: 0.12 },
		'rock-d': { color: '#434553', vary: 0.1 },
		'rock-l': { color: '#7d8090', vary: 0.12 },
		dirt: { color: '#76583a', vary: 0.12 },
		'dirt-d': { color: '#5d442d', vary: 0.12 },
		'dirt-l': { color: '#96744a', vary: 0.12 },
		track: { color: '#3f2d1e', vary: 0.05 },
		ash: { color: '#7a7168', vary: 0.18 },
		mud: { color: '#4b4534', vary: 0.1 },
		water: { color: '#3f8f86', kind: 'water' },
		lily: { color: '#6fae4a', vary: 0.08 },
		'lily-flower': '#f6d9e6',
		reed: { color: '#8a8f3c', vary: 0.12 },
		cattail: '#5a3a22',
		birch: { color: '#ece8dc', vary: 0.03 },
		'birch-mark': '#2b2a2c',
		'gold-d': { color: '#c9861f', vary: 0.1 },
		gold: { color: '#e9b030', vary: 0.1 },
		'gold-l': { color: '#f7d75c', vary: 0.1 },
		'rust-d': { color: '#8f3a1c', vary: 0.1 },
		rust: { color: '#c2531f', vary: 0.1 },
		'rust-l': { color: '#e07a2a', vary: 0.1 },
		'spruce-d': { color: '#1c3a31', vary: 0.1 },
		spruce: { color: '#2a5242', vary: 0.1 },
		'spruce-l': { color: '#3f7054', vary: 0.1 },
		bark: { color: '#3d2c22', vary: 0.08 },
		dead: { color: '#5e534b', vary: 0.08 },
		bone: { color: '#ece5d2', vary: 0.03 },
		eye: { color: '#ff7a1a', emissive: 2.4, vary: 0 },
		stake: { color: '#70502f', vary: 0.1 },
		'stake-d': { color: '#4f3722', vary: 0.1 },
		pole: { color: '#4a3a2c', vary: 0.06 },
		stone: { color: '#8a8780', vary: 0.12 },
		'stone-d': { color: '#65625e', vary: 0.12 },
		log: { color: '#5a3b22', vary: 0.1 },
		ember: { color: '#ff7a1a', emissive: 1.8, vary: 0 },
		iron: { color: '#2a2b30', vary: 0.04 },
		brew: { color: '#6dff5a', emissive: 2, vary: 0 },
		cap: { color: '#d02a22', vary: 0.06 },
		'cap-dot': '#f7f0e0',
		gill: { color: '#e6d9bc', vary: 0.05 },
		stem: { color: '#efe6d0', vary: 0.04 },
		shroom: { color: '#7dffc0', emissive: 1.8, vary: 0 },
		pumpkin: { color: '#e8801c', vary: 0.06 },
		'pumpkin-d': { color: '#c4630f', vary: 0.06 },
		face: { color: '#ffc23a', emissive: 1.2, vary: 0 },
		vine: { color: '#4d6b2f', vary: 0.12 },
		moss: { color: '#6f8f3a', vary: 0.14 },
	},
	build(w) {
		// нижняя терраса с прудом, затем главный остров поверх
		const POND: [number, number] = [70, 133];
		w.island({
			center: POND,
			radius: 20,
			top: G - 4,
			depth: 20,
			hills: 0.8,
			roughness: 0.16,
			surface: 'grass',
			soil: 'soil',
			rock: 'rock',
			spikes: 6,
		});
		w.island({
			center: [C, C],
			radius: 58,
			top: G,
			depth: 30,
			hills: 1.8,
			roughness: 0.14,
			surface: 'grass',
			soil: 'soil',
			rock: 'rock',
			spikes: 26,
			name: 'isle',
		});
		// два осколка рядом
		w.island({
			center: [22, 118],
			radius: 9,
			top: 30,
			depth: 13,
			hills: 1,
			surface: 'grass',
			soil: 'soil',
			rock: 'rock',
			spikes: 4,
		});
		w.island({
			center: [138, 30],
			radius: 10,
			top: 62,
			depth: 15,
			hills: 1,
			surface: 'grass',
			soil: 'soil',
			rock: 'rock',
			spikes: 5,
		});

		buildYard(w);
		buildPond(w, POND[0], POND[1] + 1, G - 5);
		buildBonfire(w);
		buildFence(w);

		// лес — на дальней дуге, чтобы не закрывать двор от камеры
		const back = Math.PI * 1.25;
		const forest: Array<[number, number, 'b' | 'r' | 's', number]> = [
			[-1.25, 44, 's', 30],
			[-1.05, 38, 'b', 22],
			[-0.88, 49, 's', 34],
			[-0.72, 41, 'r', 24],
			[-0.55, 47, 'b', 26],
			[-0.4, 39, 's', 28],
			[-0.24, 50, 's', 36],
			[-0.1, 42, 'b', 25],
			[0.06, 48, 'r', 23],
			[0.2, 39, 's', 30],
			[0.36, 46, 'b', 27],
			[0.52, 51, 's', 33],
			[0.66, 41, 'b', 22],
			[0.82, 47, 's', 28],
			[0.98, 40, 'r', 21],
			[1.14, 46, 's', 26],
			[1.32, 41, 'b', 19],
		];
		for (const [da, r, kind, h] of forest) {
			const [x, z] = polar(r + 3, back + da);
			if (kind === 's') spruce(w, x, z, h);
			else birch(w, x, z, h, kind === 'b' ? 'gold' : 'rust');
		}
		birch(w, 22, 118, 13, 'gold');
		spruce(w, 138, 30, 20);
		deadTree(w, ...polar(46, GATE + 1.0), 20);
		deadTree(w, ...polar(47, GATE - 0.92), 15);

		// мухоморы, тыквы, поленница
		const m0 = polar(45, GATE + 0.4);
		agaric(w, m0[0], m0[1], 10, 6);
		agaric(w, m0[0] + 6, m0[1] - 5, 6, 4);
		agaric(w, m0[0] - 6, m0[1] + 2, 4, 3);
		agaric(w, m0[0] + 3, m0[1] + 5, 2, 2);
		const m1 = polar(45, GATE - 0.58);
		agaric(w, m1[0], m1[1], 7, 4.5);
		agaric(w, m1[0] + 4, m1[1] + 4, 3, 2.5);
		const p0 = polar(43, GATE - 0.27);
		pumpkin(w, p0[0], p0[1], 4.5, true);
		pumpkin(w, p0[0] + 6, p0[1] - 6, 2.5, false);
		pumpkin(w, p0[0] - 6, p0[1] + 6, 3, true);
		pumpkin(w, p0[0] + 2, p0[1] + 8, 2, false);
		w.anchor('pumpkin', [p0[0] + 3.5, G + 8, p0[1] + 3.5]);
		const p1 = polar(42, GATE + 0.2);
		pumpkin(w, p1[0], p1[1], 3.5, true);
		pumpkin(w, p1[0] - 5, p1[1] + 4, 2, false);
		// поленница у забора внутри двора
		const [wx, wz] = polar(33, GATE + 1.45);
		for (let i = 0; i < 4; i++) {
			w.box([wx - 3, G + 1 + i, wz], [wx + 3 - i, G + 1 + i, wz + 2], i % 2 ? 'log' : 'stake');
		}
		for (let i = 0; i <= 6; i += 2) w.set([wx - 3 + i, G + 2, wz + 3], 'birch');
		// колода с топором
		const [sx, sz] = polar(33, GATE + 1.15);
		w.cylinder([sx, G + 1, sz], 2, 2, 'log');
		w.cylinder([sx, G + 2, sz], 1.3, 1, 'gill');
		w.line([sx, G + 3, sz], [sx + 2, G + 6, sz], 'stake');
		w.box([sx - 1, G + 3, sz], [sx, G + 4, sz], 'iron');
		// светящиеся грибы у пруда и под корнями
		for (let i = 0; i < 26; i++) {
			const x = w.rng.int(52, 90);
			const z = w.rng.int(118, 152);
			const h = w.heightAt(x, z);
			if (h < 0) continue;
			const top = w.get([x, h, z]);
			if (top !== 'grass' && top !== 'mud') continue;
			w.set([x, h + 1, z], 'stem');
			w.set([x, h + 2, z], 'shroom');
			if (w.rng.chance(0.4)) w.set([x + 1, h + 1, z], 'shroom');
		}
		w.anchor('shrooms', [POND[0] + 8, G + 3, POND[1] - 2]);

		// отделка: оттенки, трава, листопад на земле, мох, корни
		w.shade([0, 0, 0], [SIZE - 1, HEIGHT - 1, SIZE - 1], ['gold-d', 'gold', 'gold-l'], {
			only: 'gold',
			scale: 5,
			speckle: 0.3,
		});
		w.shade([0, 0, 0], [SIZE - 1, HEIGHT - 1, SIZE - 1], ['rust-d', 'rust', 'rust-l'], {
			only: 'rust',
			scale: 5,
			speckle: 0.3,
		});
		w.shade([0, 0, 0], [SIZE - 1, HEIGHT - 1, SIZE - 1], ['spruce-d', 'spruce', 'spruce-l'], {
			only: 'spruce',
			scale: 5,
			speckle: 0.25,
		});
		w.shade([0, 0, 0], [SIZE - 1, HEIGHT - 1, SIZE - 1], ['rock-d', 'rock', 'rock-l'], {
			only: 'rock',
			scale: 7,
			speckle: 0.2,
		});
		w.shade([0, 0, 0], [SIZE - 1, HEIGHT - 1, SIZE - 1], ['grass-d', 'grass', 'grass-l'], {
			only: 'grass',
			scale: 8,
			speckle: 0.2,
		});
		const turf = ['grass', 'grass-d', 'grass-l'];
		w.grass(['grass-d', 'grass-l', 'grass-y'], {
			on: turf,
			density: 0.16,
			height: [1, 2],
		});
		w.flowers(['gold', 'gold-d', 'rust', 'rust-l'], {
			on: [...turf, 'dirt', 'dirt-d', 'dirt-l'],
			density: 0.028,
		});
		w.moss('moss', { on: ['rock', 'rock-d', 'rock-l'], amount: 0.22, scale: 6 });
		w.vines(['vine', 'bark'], {
			from: ['rock', 'rock-d', 'soil'],
			density: 0.05,
			length: [3, 11],
		});

		const [vx, vz] = polar(52, GATE);
		w.anchor('pathFar', [vx, w.heightAt(vx, vz) + 1, vz]);
		const [gx, gz] = polar(39, GATE);
		w.anchor('pathNear', [gx, w.heightAt(gx, gz) + 1, gz]);
	},
	entities: [
		{ id: 'flameMain', model: flame(5), at: 'bonfire', animate: flicker },
		{ id: 'flameA', model: flame(7), at: 'fireA', animate: flicker },
		{ id: 'flameB', model: flame(6), at: 'fireB', animate: flicker },
		{ id: 'flameC', model: flame(7), at: 'fireC', animate: flicker },
		...smokeBands.map(({ size, band }, i) => ({
			id: `brewPuff${i}`,
			model: puff(size, '#3fbf4a', '#9dff7a', 0.9),
			at: BREW,
			count: 5,
			animate: rise({ origin: () => BREW, height: 34, period: 11, band, drift: [-9, 5] }),
		})),
		...smokeBands.map(({ size, band }, i) => ({
			id: `chimneyPuff${i}`,
			model: puff(size, '#8c8792', '#d9d2d6'),
			at: BREW,
			count: 5,
			animate: rise({ origin: chimneyAt, height: 26, period: 9, band, drift: [-8, 4] }),
		})),
		{
			id: 'hut',
			rig: hut(),
			animate: [
				orbit({ center: [C, C], radius: HUT_R, speed: HUT_SPEED, phase: HUT_PHASE }),
				...hutWalk,
			],
		},
		{
			id: 'yaga',
			rig: yaga(),
			animate: [
				orbit({ center: [C, 98, C], radius: 44, speed: 10, clockwise: true, phase: 2.35 }),
				...yagaFly,
			],
		},
		{
			id: 'vasilisa',
			rig: prefabs.villager({ shirt: '#c8322c', pants: '#f0e8d8', hair: '#e8c060' }),
			animate: [
				walkPath(['pathFar', 'pathNear'], { speed: 1.6, loop: 'pingpong', pause: 3 }),
				limbs({ parts: { armR: () => [-70, 0, 0] }, replace: true }),
			],
		},
		{
			id: 'cat',
			rig: prefabs.cat({ color: '#1c1c20' }),
			animate: wander({ area: [105, 103, 116, 114], speed: 1.4, pause: [1, 4] }),
		},
		{
			id: 'ravens',
			rig: prefabs.bird({ color: '#17171c' }),
			count: 7,
			animate: flock({ center: [52, 88, 50], radius: 16, speed: 6 }),
		},
	],
	particles: [
		fire({ at: 'bonfire', size: 'large', rate: 50, lifetime: 1.3 }),
		fire({ at: 'fireA', size: 'large', rate: 40, lifetime: 1.6 }),
		fire({ at: 'fireB', size: 'large', rate: 40, lifetime: 1.6 }),
		fire({ at: 'fireC', size: 'large', rate: 40, lifetime: 1.6 }),
		sparks({ at: 'bonfire', rate: 22, lifetime: 3.5 }),
		smoke({ at: 'glow', rate: 9, size: 'large', color: '#6f6a70', lifetime: 9 }),
		smoke({ at: 'brew', rate: 14, size: 'large', color: '#8dff7a', lifetime: 6 }),
		sparks({ at: 'brew', rate: 14, color: '#8dff6a', lifetime: 3 }),
		smoke({
			attachTo: 'hut',
			offset: [0.3, CHIMNEY_TOP * HUT_SCALE + 0.5, 0],
			rate: 14,
			size: 'large',
			lifetime: 8,
		}),
		sparks({ attachTo: 'yaga', offset: [0, 0.5, 0], rate: 26, color: '#ffb347', lifetime: 2.5 }),
		smoke({ attachTo: 'yaga', offset: [0, 0, 0], rate: 12, size: 'large', color: '#cfc6e8' }),
		pour({ at: 'fall.top', rate: 26, lifetime: 4 }),
		mist({ area: [50, 116, 92, 150], height: 1.5, intensity: 0.8 }),
		mist({ area: [30, 30, 130, 130], height: 1.2, intensity: 0.35 }),
		leaves({ color: '#e9b030', intensity: 0.55 }),
		leaves({ color: '#c2531f', intensity: 0.3 }),
		fireflies({ area: [30, 30, 130, 150], count: 60, color: '#b8ff7a' }),
	],
	lights: [
		pointLight({ at: 'glow', color: '#ff8a3c', intensity: 36, distance: 110, flicker: true }),
		pointLight({ at: 'brew', color: '#7dff6a', intensity: 8, distance: 12 }),
		pointLight({
			attachTo: 'hut',
			offset: [0, 11, 0],
			color: '#ffc45a',
			intensity: 40,
			distance: 70,
		}),
		pointLight({ at: 'gateL', color: '#ff7a1a', intensity: 30, distance: 40 }),
		pointLight({ at: 'gateR', color: '#ff7a1a', intensity: 30, distance: 40 }),
		pointLight({ at: 'pumpkin', color: '#ffb83a', intensity: 30, distance: 24 }),
		pointLight({ at: 'shrooms', color: '#7dffc0', intensity: 30, distance: 26 }),
		pointLight({
			attachTo: 'vasilisa',
			offset: [0, 4, 0],
			color: '#ffb347',
			intensity: 12,
			distance: 14,
		}),
	],
	atmosphere: {
		time: { start: 18.2, speed: 0.5, cycle: 600 },
		sky: 'stylized',
		haze: 0.5,
		backdrop: { clouds: 0.55, cloudSea: true },
	},
	camera: {
		position: [188, 98, 194],
		target: [80, 61, 78],
		autoRotate: false,
		tiltShift: 0.3,
		captureTime: 3,
	},
});
