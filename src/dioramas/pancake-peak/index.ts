import {
	bob,
	defineDiorama,
	dust,
	flock,
	limbs,
	orbit,
	pointLight,
	prefabs,
	smoke,
	sway,
	type Vec3,
	type WorldBuilder,
	walkPath,
	wander,
} from '#sdk';
import { ant, flag, folk, hook } from './folk.ts';
import { flame, flicker, puff, rise } from './fx.ts';

const TAU = Math.PI * 2;
/** Первый свободный слой над скатертью. */
const T = 3;
const PLATE: readonly [number, number] = [58, 66];
const PANCAKES = [24, 23.4, 24, 23, 22.6, 22, 21];
/** Первый слой над верхним блином. */
const TOP = T + 2 + PANCAKES.length * 4;
const FORK_Z = 66;
/** Высота верхней грани вилки-трапа над столом. */
const forkY = (x: number): number => (x >= 80 ? T + ((124 - x) * 31) / 44 : TOP + 1);
const MUG: readonly [number, number] = [102, 25];
const GLASS: readonly [number, number] = [11, 54];
const CREAM: readonly [number, number] = [64, 60];
/** Ход черники на кране. */
const HOIST = 14;

const isCake = (m: string | null): boolean =>
	m !== null && (m.startsWith('crust') || m.startsWith('batter'));

function tablecloth(w: WorldBuilder): void {
	for (let z = 0; z < 128; z++) {
		for (let x = 0; x < 128; x++) {
			const a = (x >> 3) & 1;
			const b = (z >> 3) & 1;
			w.box([x, 0, z], [x, 2, z], a && b ? 'cloth-red' : a || b ? 'cloth-pink' : 'cloth-white');
		}
	}
}

/** Тарелка или блюдце: плоское дно, приподнятый борт с синей каймой. */
function dish(w: WorldBuilder, cx: number, cz: number, flat: number, rim: number, lift: number) {
	const r = flat + rim;
	for (let z = Math.floor(cz - r - 1); z <= cz + r + 1; z++) {
		for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
			const d = Math.hypot(x - cx, z - cz);
			if (d > r + 0.3) continue;
			const up = d <= flat ? 0 : Math.round(((d - flat) / rim) ** 1.6 * lift);
			const top = T + 1 + up;
			for (let y = up === 0 ? T : top - 1; y <= top; y++) {
				const stripe = d >= flat + rim * 0.45 && d < flat + rim * 0.7;
				const shadow = d >= flat - 1.5 && d < flat + 0.5;
				w.set([x, y, z], y < top || shadow ? 'plate-s' : stripe ? 'plate-blue' : 'plate');
			}
		}
	}
}

function pancakes(w: WorldBuilder): void {
	PANCAKES.forEach((R, i) => {
		const last = i === PANCAKES.length - 1;
		const cx = PLATE[0] + (last ? 0 : w.rng.float(-1.6, 1.6));
		const cz = PLATE[1] + (last ? 0 : w.rng.float(-1.6, 1.6));
		const p1 = w.rng.float(0, TAU);
		const p2 = w.rng.float(0, TAU);
		for (let dy = 0; dy < 4; dy++) {
			const y = T + 2 + i * 4 + dy;
			const inset = dy === 0 || dy === 3 ? 1 : 0;
			for (let z = Math.floor(cz - R - 3); z <= cz + R + 3; z++) {
				for (let x = Math.floor(cx - R - 3); x <= cx + R + 3; x++) {
					const d = Math.hypot(x - cx, z - cz);
					const a = Math.atan2(z - cz, x - cx);
					const r = R + 1.2 * Math.sin(3 * a + p1) + 0.7 * Math.sin(5 * a + p2) - inset;
					if (d > r) continue;
					let m = 'batter';
					if (dy === 3) {
						const n = w.noise.fbm(x / 7 + i * 13, z / 7, 3);
						m = d > r - 2.2 ? 'crust-l' : n < 0.4 ? 'crust-d' : n > 0.66 ? 'crust-l' : 'crust';
					} else if (dy === 0) {
						m = 'crust';
					} else if (d > r - 1.3 && w.rng.chance(0.22)) {
						m = 'batter-d';
					}
					w.set([x, y, z], m);
				}
			}
		}
	});
}

/** Сироп: лужа на вершине, потёки по стопке и лужицы на тарелке. */
function syrup(w: WorldBuilder): void {
	const cx = PLATE[0] + 1;
	const cz = PLATE[1] - 1;
	const put = (p: Vec3): void => {
		if (w.get(p) === null) w.set(p, 'syrup');
	};
	for (let z = cz - 17; z <= cz + 17; z++) {
		for (let x = cx - 17; x <= cx + 17; x++) {
			const d = Math.hypot(x - cx, z - cz);
			const a = Math.atan2(z - cz, x - cx);
			const r = 11.5 + 2.5 * Math.sin(2 * a + 1) + 1.6 * Math.sin(5 * a + 0.4) + Math.sin(9 * a);
			if (d >= r || !isCake(w.get([x, TOP - 1, z]))) continue;
			w.set([x, TOP, z], d < r - 2 && Math.sin(a * 3 + d * 0.9) > 0.86 ? 'syrup-l' : 'syrup');
		}
	}
	// [угол, длина потёка вниз, ширина]
	const drips: ReadonlyArray<readonly [number, number, number]> = [
		[0.62, 31, 3],
		[1.12, 13, 2],
		[1.72, 31, 3],
		[2.3, 9, 2],
		[3.1, 20, 2],
		[3.9, 31, 2],
		[4.6, 12, 2],
		[5.25, 24, 3],
		[5.8, 8, 2],
	];
	for (const [a, len, width] of drips) {
		const ux = Math.cos(a);
		const uz = Math.sin(a);
		let reach = 0;
		for (let j = 0; j < width; j++) {
			const k = j - (width - 1) / 2;
			const ox = cx - uz * k;
			const oz = cz + ux * k;
			const at = (r: number, y: number): Vec3 => [
				Math.round(ox + ux * r),
				y,
				Math.round(oz + uz * r),
			];
			for (let r = 8; r < 30; r += 0.5) {
				const p = at(r, TOP);
				if (!isCake(w.get([p[0], TOP - 1, p[2]]))) break;
				put(p);
			}
			let prev = -1;
			const stop = Math.max(T + 2, TOP - len + Math.round(Math.abs(k) * 2));
			for (let y = TOP - 1; y >= stop; y--) {
				let surface = -1;
				for (let r = 30; r >= 0; r -= 0.5) {
					if (isCake(w.get(at(r, y)))) {
						surface = r;
						break;
					}
				}
				if (surface < 0) break;
				const cur = surface + 0.5;
				if (prev >= 0 && cur > prev) {
					for (let r = prev; r <= cur; r += 0.5) put(at(r, y + 1));
				} else if (prev >= 0) {
					for (let r = cur; r <= prev; r += 0.5) put(at(r, y));
				}
				put(at(cur, y));
				prev = cur;
			}
			if (stop === T + 2) reach = Math.max(reach, prev);
		}
		if (reach > 0) {
			const px = Math.round(cx + ux * (reach + 2));
			const pz = Math.round(cz + uz * (reach + 2));
			for (let z = pz - 6; z <= pz + 6; z++) {
				for (let x = px - 6; x <= px + 6; x++) {
					const b = Math.atan2(z - pz, x - px);
					if (Math.hypot(x - px, z - pz) > 3.8 + 1.2 * Math.sin(3 * b + a * 5)) continue;
					const y = w.heightAt(x, z) + 1;
					if (y <= T + 4) put([x, y, z]);
				}
			}
		}
	}
}

function butter(w: WorldBuilder): void {
	const bx = 54.5;
	const bz = 69.5;
	for (let z = 60; z <= 79; z++) {
		for (let x = 45; x <= 64; x++) {
			const a = Math.atan2(z - bz, x - bx);
			if (Math.hypot(x - bx, z - bz) > 6.6 + 1.3 * Math.sin(3 * a + 0.7)) continue;
			if (isCake(w.get([x, TOP - 1, z]))) w.set([x, TOP, z], 'butter-m');
		}
	}
	w.box([51, TOP, 66], [58, TOP + 2, 73], 'butter');
	w.box([51, TOP + 2, 66], [58, TOP + 2, 73], 'butter-l');
	// подтаявший угол
	w.clear([57, TOP + 1, 72], [58, TOP + 2, 73]);
	w.clear([56, TOP + 2, 73], [56, TOP + 2, 73]);
	w.set([58, TOP + 1, 71], 'butter-m');
}

/** Взбитые сливки с вишней — вершина горы. */
function cream(w: WorldBuilder): void {
	const [cx, cz] = CREAM;
	const layers = [8, 8, 7, 7, 6, 6, 5, 4.2, 3.4, 2.6, 1.8];
	layers.forEach((R, i) => {
		const ox = cx + 0.7 * Math.cos(i * 1.1);
		const oz = cz + 0.7 * Math.sin(i * 1.1);
		for (let z = cz - 10; z <= cz + 10; z++) {
			for (let x = cx - 10; x <= cx + 10; x++) {
				const d = Math.hypot(x - ox, z - oz);
				const wave = Math.sin(6 * Math.atan2(z - oz, x - ox) + i * 0.9);
				const r = R + 0.8 * wave;
				if (d > r) continue;
				w.set([x, TOP + i, z], wave < -0.55 && d > r - 1.4 ? 'cream-s' : 'cream');
			}
		}
	});
	const y = TOP + layers.length + 2;
	w.sphere([cx, y, cz], 3, 'cherry');
	w.set([cx + 2, y + 1, cz + 2], 'cherry-l');
	w.set([cx + 1, y + 2, cz + 2], 'cherry-l');
	w.curve(
		[
			[cx - 2, y + 2, cz - 2],
			[cx - 3, y + 5, cz - 3],
			[cx - 5, y + 6, cz - 4],
		],
		'stem',
	);
	w.anchor('summit', [cx + 0.5, y + 4, cz + 0.5]);
	w.anchor('flag', [cx + 2.5, y + 3, cz + 0.5]);
}

function berry(w: WorldBuilder, x: number, z: number): void {
	const y = w.heightAt(x, z) + 1;
	w.sphere([x, y + 2, z], 2.4, 'berry');
	w.set([x, y + 4, z], 'berry-d');
	w.set([x + 1, y + 3, z + 1], 'berry-l');
}

function strawberry(w: WorldBuilder, x: number, z: number): void {
	const y = w.heightAt(x, z) + 1;
	w.cone([x, y, z], 4.2, 9, 'strawberry', { top: 1 });
	for (let dy = 0; dy < 9; dy++) {
		for (let dz = -5; dz <= 5; dz++) {
			for (let dx = -5; dx <= 5; dx++) {
				const p: Vec3 = [x + dx, y + dy, z + dz];
				if (w.get(p) !== 'strawberry') continue;
				const open =
					w.get([p[0] + 1, p[1], p[2]]) === null ||
					w.get([p[0] - 1, p[1], p[2]]) === null ||
					w.get([p[0], p[1], p[2] + 1]) === null ||
					w.get([p[0], p[1], p[2] - 1]) === null;
				if (open && (dx * 3 + dy * 5 + dz * 7) % 4 === 0) w.set(p, 'seed');
			}
		}
	}
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * TAU + 0.3;
		w.line(
			[x, y, z],
			[Math.round(x + 5.4 * Math.cos(a)), y, Math.round(z + 5.4 * Math.sin(a))],
			'leaf',
		);
	}
}

/** Вилка, прислонённая к стопке: трап для восходителей. */
function fork(w: WorldBuilder): void {
	for (let x = 124; x >= 72; x--) {
		const top = Math.round(forkY(x));
		const tines = x < 93;
		let half = 2;
		if (x >= 122) half = 124 - x + 1;
		else if (x >= 116) half = 3;
		else if (x >= 106) half = 2;
		else if (x >= 100) half = 1;
		else if (x >= 97) half = 100 - x + 1;
		else half = 5;
		for (let dz = -half; dz <= half; dz++) {
			if (tines && dz % 3 === 0) continue;
			const z = FORK_Z + dz;
			w.set([x, top - 1, z], 'steel-d');
			w.set([x, top, z], dz === 0 && x >= 106 ? 'steel-l' : 'steel');
		}
	}
}

function mug(w: WorldBuilder): void {
	const [cx, cz] = MUG;
	dish(w, cx, cz, 13, 4, 2);
	const y0 = T + 2;
	w.cylinder([cx, y0, cz], 12, 26, 'mug');
	w.cylinder([cx, y0 + 7, cz], 12, 4, 'mug-band');
	w.cylinder([cx, y0 + 2, cz], 11, 24, 'mug-in');
	w.cylinder([cx, y0 + 2, cz], 10, 24, 'air');
	w.cylinder([cx, y0 + 2, cz], 10, 22, 'coffee');
	const top = y0 + 23;
	for (let z = cz - 10; z <= cz + 10; z++) {
		for (let x = cx - 10; x <= cx + 10; x++) {
			if (w.get([x, top, z]) !== 'coffee') continue;
			const d = Math.hypot(x - cx, z - cz);
			const a = Math.atan2(z - cz, x - cx);
			if (Math.sin(a * 2 + d * 0.75) > 0.25 && d < 9) w.set([x, top, z], 'crema');
		}
	}
	w.curve(
		[
			[cx + 12, y0 + 20, cz],
			[cx + 19, y0 + 20, cz],
			[cx + 21, y0 + 13, cz],
			[cx + 19, y0 + 6, cz],
			[cx + 12, y0 + 6, cz],
		],
		'mug',
		{ radius: 1.4 },
	);
	w.anchor('coffee', [cx + 0.5, top + 1, cz + 0.5]);
	w.anchor('steam', [cx + 0.5, top + 4, cz + 0.5]);
}

function juice(w: WorldBuilder): void {
	const [cx, cz] = GLASS;
	w.cylinder([cx, T, cz], 9, 34, 'glass');
	w.cylinder([cx, T + 2, cz], 8, 32, 'air');
	// сок до самой стенки: за стеклом его грани не рисуются
	w.cylinder([cx, T + 2, cz], 9, 24, 'juice');
	w.cylinder([cx, T + 26, cz], 9, 1, 'juice-l');
	for (let i = 0; i < 40; i++) {
		const a = w.rng.float(0, TAU);
		const y = T + 3 + w.rng.int(0, 21);
		w.set([Math.round(cx + 9 * Math.cos(a)), y, Math.round(cz + 9 * Math.sin(a))], 'juice-l');
	}
	w.box([cx - 5, T + 25, cz + 1], [cx - 2, T + 28, cz + 4], 'ice');
	w.box([cx + 1, T + 26, cz - 5], [cx + 4, T + 29, cz - 2], 'ice');
	// трубочка в красную полоску
	for (let i = 0; i <= 120; i++) {
		const k = i / 120;
		const x = Math.round(cx - 2 + 10 * k);
		const y = Math.round(T + 3 + 43 * k);
		const z = Math.round(cz - 6 * k);
		const m = Math.floor(y / 3) % 2 === 0 ? 'straw-r' : 'straw-w';
		w.box([x, y, z], [x + 1, y, z + 1], m);
	}
	// долька апельсина на краю
	for (let dy = -5; dy <= 5; dy++) {
		for (let dx = -5; dx <= 5; dx++) {
			const d = Math.hypot(dx, dy);
			if (d > 5.3) continue;
			const seg = dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy);
			const m = d > 4.2 ? 'rind' : seg || d < 1 ? 'orange-l' : 'orange';
			w.box([cx + dx, T + 34 + dy, cz + 9], [cx + dx, T + 34 + dy, cz + 10], m);
		}
	}
}

function toast(w: WorldBuilder): void {
	const x0 = 4;
	const x1 = 32;
	const z0 = 96;
	const z1 = 124;
	for (let z = z0; z <= z1; z++) {
		for (let x = x0; x <= x1; x++) {
			const ex = Math.min(x - x0, x1 - x);
			const ez = Math.min(z - z0, z1 - z);
			if (ex + ez < 2) continue;
			const edge = Math.min(ex, ez) < 2 || ex + ez < 5;
			w.box([x, T, z], [x, T + 1, z], edge ? 'toast-crust' : 'toast');
			w.set([x, T + 2, z], edge ? 'toast-crust' : 'toast');
		}
	}
	w.shade([x0, T + 2, z0], [x1, T + 2, z1], ['toast-d', 'toast', 'toast-l'], {
		only: 'toast',
		scale: 4,
		speckle: 0.3,
	});
	const ex = 18;
	const ez = 110;
	for (let z = z0; z <= z1; z++) {
		for (let x = x0; x <= x1; x++) {
			const d = Math.hypot(x - ex, z - ez);
			const a = Math.atan2(z - ez, x - ex);
			const r = 9 + 1.8 * Math.sin(3 * a + 0.5) + 1.1 * Math.sin(5 * a + 2);
			if (d > r) continue;
			w.set([x, T + 3, z], d > r - 1.2 && w.rng.chance(0.55) ? 'egg-crisp' : 'egg');
		}
	}
	w.ellipsoid([ex - 1, T + 3, ez - 1], [4.5, 3.2, 4.5], 'yolk');
	w.set([ex, T + 6, ez], 'yolk-l');
	w.set([ex + 1, T + 5, ez + 1], 'yolk-l');
}

function knife(w: WorldBuilder): void {
	for (let x = 28; x <= 54; x++) {
		const from = 6 + Math.max(0, 32 - x);
		for (let z = from; z <= 10; z++) {
			w.set([x, T, z], z === from ? 'steel-l' : z === 10 ? 'steel-d' : 'steel');
		}
	}
	w.box([55, T, 7], [74, T + 1, 10], 'handle');
	for (const x of [59, 66, 72]) w.box([x, T + 1, 8], [x, T + 1, 9], 'steel-l');
	w.box([36, T + 1, 7], [41, T + 1, 9], 'butter');
	w.set([42, T + 1, 8], 'butter');
}

/** Ложка с клубничным джемом. */
function spoon(w: WorldBuilder): void {
	const c: Vec3 = [50, T + 3, 116];
	w.ellipsoid(c, [8.5, 3.6, 6.5], 'steel');
	w.clear([40, T + 4, 108], [60, T + 8, 124]);
	w.ellipsoid(c, [7.3, 2.6, 5.3], 'jam');
	w.clear([40, T + 4, 108], [60, T + 8, 124]);
	w.ellipsoid([50, T + 4, 116], [5.6, 1.8, 3.8], 'jam');
	for (let z = 109; z <= 123; z++) {
		for (let x = 41; x <= 59; x++) {
			for (let y = T + 3; y <= T + 6; y++) {
				if (w.get([x, y, z]) === 'jam' && w.get([x, y + 1, z]) === null && w.rng.chance(0.14)) {
					w.set([x, y, z], 'jam-l');
				}
			}
		}
	}
	for (let x = 58; x <= 104; x++) {
		const y = T + (x < 70 ? Math.round((70 - x) / 6) : 0);
		const half = x >= 98 ? 2 : 1;
		for (let dz = -half; dz <= half; dz++) {
			w.set([x, y, 116 + dz], 'steel-d');
			w.set([x, y + 1, 116 + dz], dz === 0 ? 'steel-l' : 'steel');
		}
	}
	for (const [x, z, r] of [
		[65, 122, 1.6],
		[39, 109, 1.2],
		[68, 111, 1],
	] as const) {
		w.ellipsoid([x, T, z], [r + 0.6, 0.6, r], 'jam');
	}
}

function sugarCube(w: WorldBuilder, x: number, y: number, z: number, s: number): void {
	w.box([x, y, z], [x + s - 1, y + s - 1, z + s - 1], 'sugar');
	w.shade([x, y, z], [x + s - 1, y + s - 1, z + s - 1], ['sugar-s', 'sugar', 'sugar'], {
		only: 'sugar',
		scale: 3,
		speckle: 0.25,
	});
}

/** Домик из кубика рафинада под вафельной крышей. */
function sugarHouse(
	w: WorldBuilder,
	x: number,
	z: number,
	door: '+x' | '+z',
	floors = 1,
	name?: string,
): void {
	for (let f = 0; f < floors; f++) {
		const y = T + f * 8;
		sugarCube(w, x, y, z, 7);
		for (let dz = -1; dz <= 7; dz++) {
			for (let dx = -1; dx <= 7; dx++) {
				w.set([x + dx, y + 7, z + dz], (dx + dz) % 2 === 0 ? 'wafer' : 'wafer-d');
			}
		}
		w.box([x + 6, y + 3, z + 2], [x + 6, y + 4, z + 3], 'window');
		w.box([x + 2, y + 3, z + 6], [x + 3, y + 4, z + 6], 'window');
	}
	if (door === '+z') {
		w.box([x + 2, T, z + 6], [x + 3, T + 2, z + 6], 'door');
		w.box([x + 2, T + 3, z + 6], [x + 3, T + 4, z + 6], 'sugar');
		w.box([x + 5, T + 3, z + 6], [x + 5, T + 4, z + 6], 'window');
	} else {
		w.box([x + 6, T, z + 2], [x + 6, T + 2, z + 3], 'door');
		w.box([x + 6, T + 3, z + 2], [x + 6, T + 4, z + 3], 'sugar');
		w.box([x + 6, T + 3, z + 5], [x + 6, T + 4, z + 5], 'window');
	}
	if (name) w.anchor(name, [x + 3.5, T + floors * 8 + 5, z + 3.5]);
}

function village(w: WorldBuilder): void {
	sugarHouse(w, 100, 78, '+z');
	sugarHouse(w, 113, 80, '+z', 1, 'houseB');
	sugarHouse(w, 118, 92, '+z', 2);
	sugarHouse(w, 97, 98, '+x', 1, 'houseD');
	sugarCube(w, 110, T, 103, 5);
	sugarCube(w, 112, T + 5, 104, 3);
	w.place(prefabs.campfire(), [110, T, 92], { name: 'camp' });
	w.anchor('campGlow', [110.5, T + 7, 92.5]);
	for (let i = 0; i < 46; i++) {
		const x = w.rng.int(94, 126);
		const z = w.rng.int(72, 112);
		if (w.heightAt(x, z) === T - 1) w.set([x, T, z], 'sugar');
	}
}

/** Кран на краю вершины поднимает чернику с тарелки. */
function crane(w: WorldBuilder): void {
	const y1 = TOP + 12;
	for (let y = TOP; y <= y1 + 4; y++) {
		w.box([53, y, 82], [54, y, 83], (y - TOP) % 3 === 2 ? 'crane-d' : 'crane');
	}
	w.box([53, y1, 76], [53, y1, 98], 'crane');
	w.box([54, y1, 80], [54, y1, 85], 'crane');
	w.box([53, y1 - 2, 75], [54, y1, 78], 'steel-d');
	w.line([53, y1 + 4, 82], [53, y1 + 1, 95], 'crane-d');
	w.line([53, y1 + 4, 83], [53, y1 + 1, 77], 'crane-d');
	w.box([53, y1 - 1 - HOIST, 97], [53, y1 - 1, 97], 'rope');
	w.anchor('hoist', [53.5, y1 - 1 - HOIST - 5 - HOIST / 2, 97.5]);
}

function candle(w: WorldBuilder): void {
	for (let y = TOP; y <= TOP + 12; y++) {
		for (let z = 59; z <= 61; z++) {
			for (let x = 46; x <= 48; x++) {
				w.set([x, y, z], (x + y + z) % 4 < 2 ? 'candle-p' : 'candle-w');
			}
		}
	}
	w.set([49, TOP + 10, 60], 'candle-w');
	w.box([49, TOP + 8, 60], [49, TOP + 9, 60], 'candle-w');
	w.set([47, TOP + 13, 60], 'wick');
	w.anchor('candle', [47.5, TOP + 14, 60.5]);
	w.anchor('candleGlow', [47.5, TOP + 19, 60.5]);
}

const wave = limbs({
	parts: {
		armR: ({ t }) => [0, 0, 150 + 22 * Math.sin(t * 6)],
		armL: ({ t }) => [0, 0, -150 - 22 * Math.sin(t * 6 + 1.3)],
	},
	replace: true,
});

const steamBands = [
	{ size: 3, band: [0, 0.36] },
	{ size: 2, band: [0.36, 0.72] },
	{ size: 1, band: [0.72, 1] },
] as const;

export default defineDiorama({
	meta: {
		title: 'Pancake Peak',
		createdAt: '2026-11-16',
		author: { model: 'Claude Fable 5.2' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'A breakfast table seen as a mountain range: tiny climbers scale a fork to the top of a syrup-drenched pancake stack, plant a flag on the cherry, sail a mug of coffee and live in sugar-cube houses.',
		tags: ['food', 'breakfast', 'miniature', 'expedition', 'cozy', 'whimsical'],
	},
	seed: 1975127019,
	size: [128, 80, 128],
	base: 'wood',
	palette: {
		'cloth-white': { color: '#f7efe2', vary: 0.03 },
		'cloth-pink': { color: '#f0a49c', vary: 0.03 },
		'cloth-red': { color: '#d4443c', vary: 0.04 },
		plate: { color: '#f8f6f0', vary: 0.02 },
		'plate-s': { color: '#d9d6d0', vary: 0.02 },
		'plate-blue': { color: '#3f6fb5', vary: 0.03 },
		crust: { color: '#c6803a', vary: 0.1 },
		'crust-d': { color: '#9c5a22', vary: 0.1 },
		'crust-l': { color: '#e3a856', vary: 0.08 },
		batter: { color: '#f3d48a', vary: 0.06 },
		'batter-d': { color: '#e2b660', vary: 0.06 },
		syrup: { color: '#a8560c', emissive: 0.15, vary: 0.06 },
		'syrup-l': { color: '#f0a030', emissive: 0.35, vary: 0 },
		butter: { color: '#ffe37a', vary: 0.02 },
		'butter-l': { color: '#fff4b8', vary: 0.02 },
		'butter-m': { color: '#ffd24a', emissive: 0.1, vary: 0.03 },
		cream: { color: '#fffaf2', emissive: 0.1, vary: 0.02 },
		'cream-s': { color: '#eadfce', emissive: 0.05, vary: 0.02 },
		cherry: { color: '#c2142d', vary: 0.05 },
		'cherry-l': '#ff8a98',
		stem: '#4c7a2a',
		berry: { color: '#3a4a9c', vary: 0.08 },
		'berry-d': '#232c66',
		'berry-l': '#7f8fdc',
		strawberry: { color: '#d92b3a', vary: 0.06 },
		seed: '#ffe08a',
		leaf: { color: '#3f8f3a', vary: 0.1 },
		steel: { color: '#c5ced6', vary: 0.03 },
		'steel-d': { color: '#8893a0', vary: 0.03 },
		'steel-l': { color: '#f2f6f9', vary: 0 },
		mug: { color: '#1f9c94', vary: 0.03 },
		'mug-in': { color: '#f4efe4', vary: 0.02 },
		'mug-band': { color: '#f7e7b6', vary: 0.02 },
		coffee: { color: '#3a2212', vary: 0.03 },
		crema: { color: '#c4935c', vary: 0.05 },
		glass: { color: '#dff3f5', kind: 'glass' },
		ice: { color: '#ffffff', kind: 'glass' },
		juice: { color: '#ff9a1f', emissive: 0.08, vary: 0.03 },
		'juice-l': { color: '#ffc15a', vary: 0.04 },
		'straw-r': { color: '#e63946', vary: 0 },
		'straw-w': { color: '#ffffff', vary: 0 },
		orange: { color: '#ffa62b', vary: 0.04 },
		'orange-l': '#ffd08a',
		rind: '#f07c12',
		toast: { color: '#e6b566', vary: 0.1 },
		'toast-d': { color: '#cf9a48', vary: 0.1 },
		'toast-l': { color: '#f2cf8c', vary: 0.08 },
		'toast-crust': { color: '#9a5c26', vary: 0.08 },
		egg: { color: '#fdfaf2', vary: 0.02 },
		'egg-crisp': { color: '#e0b070', vary: 0.08 },
		yolk: { color: '#ffb31a', emissive: 0.1, vary: 0.03 },
		'yolk-l': '#ffe58a',
		sugar: { color: '#ffffff', vary: 0.04 },
		'sugar-s': { color: '#dfe7f1', vary: 0.04 },
		door: '#8a5a34',
		window: { color: '#ffd27a', emissive: 1.1, vary: 0 },
		wafer: { color: '#dba85e', vary: 0.05 },
		'wafer-d': { color: '#b98440', vary: 0.05 },
		jam: { color: '#b5173a', emissive: 0.06, vary: 0.05 },
		'jam-l': '#e85a6e',
		handle: { color: '#6b3f22', vary: 0.08 },
		crane: { color: '#f2b705', vary: 0.03 },
		'crane-d': { color: '#c98f00', vary: 0.03 },
		rope: '#3a3026',
		'candle-p': { color: '#ff8fb3', vary: 0 },
		'candle-w': { color: '#fff8f0', vary: 0 },
		wick: '#2b2b2b',
	},
	build(w) {
		tablecloth(w);
		dish(w, PLATE[0], PLATE[1], 29, 11, 5);
		pancakes(w);
		syrup(w);
		butter(w);
		cream(w);
		candle(w);
		crane(w);
		fork(w);
		for (const [x, z] of [
			[70, 75],
			[62, 80],
			[45, 78],
			[44, 71],
			[87, 87],
			[91, 77],
			[73, 97],
			[29, 84],
			[27, 68],
			[36, 40],
			[18, 30],
			[62, 30],
			[82, 45],
		] as const) {
			berry(w, x, z);
		}
		for (const [x, z] of [
			[82, 91],
			[27, 24],
			[80, 20],
		] as const) {
			strawberry(w, x, z);
		}
		berry(w, 76, 114);
		berry(w, 70, 18);
		mug(w);
		juice(w);
		toast(w);
		knife(w);
		spoon(w);
		village(w);
	},
	entities: [
		{
			id: 'ropeTeam',
			rig: folk({ shirt: '#e63946', hat: '#ffd23f' }),
			count: 2,
			animate: walkPath(
				[
					[121, forkY(121) + 1, FORK_Z],
					[95, forkY(95) + 1, FORK_Z],
					[91, forkY(91) + 1, FORK_Z + 1.5],
					[82, forkY(82) + 1, FORK_Z + 1.5],
					[76, TOP + 2, FORK_Z + 1.5],
					[69, TOP + 1, 71],
				],
				{ speed: 2.2, loop: 'pingpong', pause: 1.5 },
			),
		},
		{
			id: 'porter',
			rig: folk({ shirt: '#2a6fdb', hat: '#ff7f11', pack: '#2f7a4a' }),
			animate: walkPath(
				[
					[119, forkY(119) + 1, FORK_Z],
					[96, forkY(96) + 1, FORK_Z],
					[92, forkY(92) + 1, FORK_Z - 1.5],
					[84, forkY(84) + 1, FORK_Z - 1.5],
				],
				{ speed: 1.7, loop: 'pingpong', pause: 2.5 },
			),
		},
		{
			id: 'summiteer',
			rig: folk({ shirt: '#8e44ad', hat: '#f4f4f4', pack: '#e63946' }),
			at: 'summit',
			animate: wave,
		},
		{
			id: 'flag',
			model: flag('#e63946', '#b3202c'),
			at: 'flag',
			animate: sway({ axis: 'x', angle: 5, period: 2.6 }),
		},
		{
			id: 'signaller',
			rig: folk({ shirt: '#f2b705', hat: '#f2b705', pants: '#2e4053' }),
			at: [58, TOP, 84],
			animate: wave,
		},
		{
			id: 'hoist',
			model: hook(HOIST),
			at: 'hoist',
			animate: bob({ amp: HOIST / 2, period: 9 }),
		},
		{
			id: 'boat',
			model: prefabs.boat({ color: '#c0392b' }),
			animate: orbit({ center: [MUG[0] + 0.5, T + 26, MUG[1] + 0.5], radius: 5.5, speed: 1.6 }),
		},
		...steamBands.map(({ size, band }, i) => ({
			id: `steam${i}`,
			model: puff(size, '#e9e4dc', '#ffffff'),
			count: 4,
			at: 'steam',
			animate: rise({
				origin: [MUG[0] + 0.5, T + 29, MUG[1] + 0.5],
				height: 24,
				period: 10,
				band,
				drift: [-7, 5],
			}),
		})),
		{ id: 'candleFlame', model: flame(5), at: 'candle', animate: flicker },
		{ id: 'campFlame', model: flame(4), at: 'camp.fire', animate: flicker },
		{
			id: 'villagers',
			rig: folk({ shirt: '#27ae60', hat: '#c0392b' }),
			count: 3,
			animate: walkPath(
				[
					[104, 88],
					[115, 89],
					[115, 97],
					[105, 97],
				],
				{ speed: 1.4, pause: 1.5 },
			),
		},
		{
			id: 'toastFolk',
			rig: folk({ shirt: '#ff7f11', hat: '#2a6fdb' }),
			count: 2,
			animate: wander({ area: [7, 99, 29, 121], speed: 1.3, pause: [1, 3] }),
		},
		{
			id: 'ants',
			model: ant(),
			count: 10,
			animate: walkPath(
				[
					[122, 110],
					[113, 124],
					[62, 125],
					[38, 125],
				],
				{ speed: 2.6, loop: 'pingpong' },
			),
		},
		{
			id: 'sparrows',
			rig: prefabs.bird({ color: '#8a6a4a' }),
			count: 5,
			animate: flock({ center: [44, 58, 96], radius: 20, speed: 6 }),
		},
	],
	particles: [
		dust({ count: 260 }),
		smoke({ at: 'steam', rate: 5, color: '#ffffff' }),
		smoke({ at: 'camp.fire', rate: 3, color: '#cfc8c0', size: 'small' }),
	],
	lights: [
		pointLight({ at: 'candleGlow', color: '#ffb45a', intensity: 22, distance: 60, flicker: true }),
		pointLight({ at: 'campGlow', color: '#ff9a3c', intensity: 18, distance: 34, flicker: true }),
		pointLight({ at: 'houseB', color: '#ffd28a', intensity: 14, distance: 26, onlyAtNight: true }),
		pointLight({ at: 'houseD', color: '#ffd28a', intensity: 14, distance: 26, onlyAtNight: true }),
	],
	atmosphere: {
		time: { start: 9.5, speed: 0 },
		sky: { kind: 'solid', color: '#f3e3cc' },
		haze: 0.3,
	},
	camera: {
		position: [160, 88, 174],
		target: [64, 14, 70],
		autoRotate: false,
		tiltShift: 0.4,
		captureTime: 3,
	},
});
