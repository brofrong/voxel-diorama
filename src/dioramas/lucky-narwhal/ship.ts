import type { Vec3, WorldBuilder } from '#sdk';

/*
 * Корабль «Lucky Narwhal» и море под ним — воксели мира (1 воксель = 1 ед.).
 *
 * Нос смотрит в +x, ось корабля — z = ZC. Камера смотрит с угла +x+z, поэтому правый борт (+z)
 * и передние (+x) грани парусов — «витрина». Ветер дует с кормы-левого борта к носу-правому
 * (WIND), паруса выгнуты вперёд. За кораблём, в дальнем углу подставки, ломается большая волна.
 */

export const SX = 184;
export const SY = 120;
export const SZ = 144;
export const SEA = 20;
export const ZC = 72;
/** Транец (корма) и форштевень (нос) на уровне палубы. */
export const XS = 36;
export const XB = 128;
/** Верх палубы (y, на котором стоят ноги): шкафут, ют (корма), бак (нос). */
export const DECK = 28;
export const QD = 38;
export const FC = 33;
export const QD_X = 59; // ют: x < QD_X
export const FC_X = 110; // бак: x ≥ FC_X
export const MAIN_X = 80;
export const FORE_X = 104;
/** Направление ветра в плоскости xz (куда дует). */
export const WIND: [number, number] = [0.6, 0.8];
/** Кончик рога нарвала — бушприт; к нему крепится кливер. */
export const HORN_TIP: Vec3 = [151, 41, ZC];

export const deckAt = (x: number): number => (x < QD_X ? QD : x >= FC_X ? FC : DECK);

/** Полуширина корпуса по длине (на уровне палубы шкафута). */
function beam(x: number): number {
	const u = (x - XS) / (XB - XS);
	if (u < 0) return 0;
	if (u < 0.2) return 10.5 + 2.5 * Math.sin((u / 0.2) * (Math.PI / 2));
	if (u <= 0.52) return 13;
	if (u > 1) return 0;
	const k = (u - 0.52) / 0.48;
	return 13 * (1 - k * k) ** 0.62;
}

/** Низ киля. */
function keel(x: number): number {
	const u = (x - XS) / (XB - XS);
	const end = Math.max(0, Math.abs(u - 0.45) - 0.25) / 0.3;
	return 9 + 12 * end * end;
}

/** Полуширина на высоте y: скулы закруглены к килю, у фальшборта — лёгкий завал внутрь. */
export function halfWidth(x: number, y: number): number {
	const b = beam(x);
	if (b <= 0) return 0;
	const kb = keel(x);
	if (y < kb) return 0;
	const t = Math.min(1, (y - kb) / (DECK + 1 - kb));
	let g = 1 - (1 - t) ** 2.4;
	const top = y - (DECK + 1);
	if (top > 0) g *= 1 - Math.min(0.12, top * 0.012);
	return b * g;
}

/** Палитра мира: море, корпус, палуба, паруса, такелаж. */
export const WORLD_PALETTE = {
	// море — смола коллекционной подставки: глубина → бирюза → пена
	'sea-abyss': { color: '#0d2f57', vary: 0.08 },
	'sea-deep': { color: '#14508a', vary: 0.1 },
	sea: { color: '#1c78b0', vary: 0.1 },
	'sea-light': { color: '#2fa6c8', vary: 0.1 },
	'sea-glow': { color: '#5fd3d6', emissive: 0.12, vary: 0.08 },
	foam: { color: '#f4fbff', vary: 0.04 },
	'foam-blue': { color: '#c8e9f4', vary: 0.06 },
	water: { color: '#2a8fc4', kind: 'water' as const, vary: 0 },
	// корпус
	'hull-low': { color: '#7a2f22', vary: 0.08 },
	'plank-a': { color: '#8a5a33', vary: 0.12 },
	'plank-b': { color: '#a06a3c', vary: 0.12 },
	'plank-dark': { color: '#5e3b22', vary: 0.1 },
	'paint-teal': { color: '#1f8a8a', vary: 0.05 },
	'paint-teal-dark': { color: '#166a6c', vary: 0.05 },
	'paint-cream': { color: '#efe2c4', vary: 0.04 },
	gold: { color: '#d8a530', emissive: 0.08, vary: 0.05 },
	brass: { color: '#b8862b', vary: 0.06 },
	iron: { color: '#2e3036', vary: 0.06 },
	'window-glow': { color: '#ffc867', emissive: 0.9, vary: 0.05 },
	// палуба и надстройки
	deck: { color: '#c08a52', vary: 0.12 },
	'deck-light': { color: '#d6a066', vary: 0.12 },
	'deck-dark': { color: '#9c6a3c', vary: 0.12 },
	'deck-seam': { color: '#6b4527', vary: 0.06 },
	cabin: { color: '#e9dcc0', vary: 0.05 },
	'cabin-beam': { color: '#7a4c2a', vary: 0.08 },
	brick: { color: '#a8553a', vary: 0.14 },
	'brick-dark': { color: '#7d3b28', vary: 0.12 },
	// рангоут и паруса
	mast: { color: '#8f5f36', vary: 0.1 },
	'mast-band': { color: '#3a2a1e', vary: 0.04 },
	sail: { color: '#f1e6cc', vary: 0.05 },
	'sail-shade': { color: '#ddd0b0', vary: 0.05 },
	'sail-patch': { color: '#e7c98f', vary: 0.06 },
	'sail-seam': { color: '#c9b892', vary: 0.03 },
	ink: { color: '#1d1b22', vary: 0.02 },
	'emblem-orange': { color: '#f07a2a', vary: 0.03 },
	'emblem-white': { color: '#fbf6ea', vary: 0.02 },
	rope: { color: '#c9a56a', vary: 0.08 },
	// нарвал
	narwhal: { color: '#8fb4c8', vary: 0.08 },
	'narwhal-dark': { color: '#5f8299', vary: 0.08 },
	'narwhal-belly': { color: '#e8f1f2', vary: 0.04 },
	ivory: { color: '#f3e8cf', vary: 0.04 },
	'ivory-dark': { color: '#c9b791', vary: 0.04 },
	blush: { color: '#f08a94', vary: 0.03 },
};

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

// --- Море -------------------------------------------------------------------------------------

/** Центр дуги большой волны (дальний угол) и её гребень. */
const CURL_C: [number, number] = [-24, -30];
const CURL_R = 84;

interface CurlInfo {
	/** Расстояние от гребня к кораблю (+) или к краю (−). */
	n: number;
	/** Сила волны 0..1 вдоль дуги. */
	k: number;
}

function curlAt(x: number, z: number): CurlInfo {
	const dx = x - CURL_C[0];
	const dz = z - CURL_C[1];
	const r = Math.hypot(dx, dz);
	const a = Math.atan2(dz, dx); // 0 — вдоль +x, π/2 — вдоль +z
	// Сильнее всего ближе к +x концу дуги (за кормой), к краям сходит на нет.
	const s = clamp((a - 0.05) / 1.45, 0, 1);
	const k = Math.sin(Math.PI * s) ** 1.2 * (0.75 + 0.25 * Math.sin(Math.PI * s * 0.8));
	return { n: r - CURL_R, k };
}

/** Высота обычной зыби (поверх SEA). */
function swell(w: WorldBuilder, x: number, z: number): number {
	const along = x * WIND[0] + z * WIND[1];
	const across = x * WIND[1] - z * WIND[0];
	const crest = Math.sin(along * 0.16 + Math.sin(across * 0.05) * 1.6);
	const chop = Math.sin(along * 0.37 - across * 0.11 + 1.3);
	const n = w.noise.fbm(x / 22, z / 22, 3) - 0.5;
	return 1.6 * crest + 0.7 * chop + n * 4;
}

export function buildSea(w: WorldBuilder): void {
	for (let z = 0; z < SZ; z++) {
		for (let x = 0; x < SX; x++) {
			const { n, k } = curlAt(x, z);
			const sw = swell(w, x, z);
			// Тело волны: пологая спина (n < 0) и вогнутый крутой фронт (0 < n < L).
			const H = 46 * k;
			const L = 26 + 10 * k;
			let wave = 0;
			if (k > 0.02) {
				if (n <= 0) wave = H * Math.max(0, 1 + n / 32) ** 1.4;
				else if (n < L) wave = H * (1 - n / L) ** 2.3;
			}
			// у корабля зыбь мельче, чтобы корпус стоял «в воде», а не тонул
			const nearShip = Math.max(0, 1 - Math.hypot((x - 84) / 62, (z - ZC) / 20) ** 2 * 0.85);
			const top = Math.round(SEA + sw * (1 - 0.7 * nearShip) + wave);
			const foamy = swellFoam(w, x, z, sw);
			for (let y = 0; y <= top; y++) {
				const depth = top - y;
				let m: string;
				if (y < SEA - 8) m = 'sea-abyss';
				else if (y < SEA - 3) m = 'sea-deep';
				else if (y <= SEA + 3) m = depth > 2 ? 'sea' : 'sea-light';
				else {
					// тело большой волны: спина — синие полосы по течению, фронт у гребня светится
					const h = (y - SEA) / Math.max(1, H);
					if (n > 0) m = h > 0.62 ? 'sea-glow' : h > 0.32 ? 'sea-light' : 'sea';
					else {
						const band = Math.sin(n * 0.55 + w.noise.value(x * 0.05, z * 0.05) * 5);
						m = h > 0.85 ? 'sea-light' : band > 0.3 ? 'sea' : 'sea-deep';
					}
					if (depth > 3 && h < 0.5) m = 'sea-deep';
				}
				w.set([x, y, z], m);
			}
			if (wave < 1.5) {
				w.set([x, top, z], foamy ? 'foam' : 'water');
			} else {
				// гребень и спина волны в пене и барашках
				// спина волны: прожилки пены, гуще к гребню
				const streak = w.noise.value(x * 0.09 + z * 0.02, z * 0.3) - (wave / H) * 0.12;
				if (n < 0 && streak > 0.58) w.set([x, top, z], 'foam-blue');
				if (n < 0 && streak > 0.66) w.set([x, top, z], 'foam');
			}
		}
	}
	buildCurlLip(w);
}

/** Барашки на зыби: пена только по гребням, кильватерный след и бурун у носа. */
function swellFoam(w: WorldBuilder, x: number, z: number, sw: number): boolean {
	const lace = w.noise.value(x * 0.13 + 40, z * 0.13) - 0.5;
	if (sw > 3.1 + lace * 1.6) return true;
	// кильватер: расходящийся клин за кормой
	if (x < XS + 2) {
		const back = XS + 2 - x;
		const spread = 4 + back * 0.32;
		const d = Math.abs(Math.abs(z - ZC) - spread * 0.85);
		if (Math.abs(z - ZC) < spread && (d < 1.4 || lace > 0.1)) return true;
	}
	// бурун вдоль корпуса
	const hw = halfWidth(x, SEA + 1);
	if (hw > 0 || (x > XB - 4 && x < XB + 8 && Math.abs(z - ZC) < 4)) {
		return Math.abs(z - ZC) > hw - 0.5 && Math.abs(z - ZC) < hw + 2 + (lace > 0 ? 1 : 0);
	}
	// расходящиеся от носа «усы»
	if (x > 96 && x < 150) {
		const t = 150 - x;
		const off = Math.abs(Math.abs(z - ZC) - (2 + t * 0.42));
		if (off < 1 + lace) return true;
	}
	return false;
}

/** Нависающий «язык» волны: тонкая дуга-трубка над вогнутым фронтом, пена — на кромке. */
function buildCurlLip(w: WorldBuilder): void {
	for (let z = 0; z < SZ; z++) {
		for (let x = 0; x < SX; x++) {
			const { n, k } = curlAt(x, z);
			if (k < 0.22) continue;
			const H = 46 * k;
			const cn = 5 + 8 * k;
			const cy = SEA + H * 0.76;
			const rOut = 4 + 8 * k;
			const rIn = rOut - 2.2 - 1.6 * k;
			for (let y = Math.floor(cy - rOut); y <= Math.ceil(cy + rOut); y++) {
				const dn = n - cn;
				const dy = y - cy;
				const r = Math.hypot(dn, dy);
				if (r > rOut || r < rIn) continue;
				// угол: π — назад к гребню, π/2 — верх, 0 — вперёд, < 0 — свисающий край
				const ang = Math.atan2(dy, dn);
				const reach = -0.9 - 0.5 * k; // насколько низко свисает язык
				if (ang < reach && ang > -Math.PI + 0.35) continue;
				if (ang <= -Math.PI + 0.35) continue;
				const inner = r < rIn + 1.2;
				let m = inner ? 'sea-glow' : ang > 1.2 ? 'sea' : 'sea-light';
				if (ang < reach + 0.55) m = 'foam';
				else if (ang < reach + 0.85) m = 'foam-blue';
				else if (!inner && ang > 0.2 && ang < 1.0 && w.noise.value(x * 0.5, z * 0.5) > 0.6)
					m = 'foam-blue';
				w.set([x, y, z], m);
			}
		}
	}
	// «когти» пены на кромке
	for (let i = 0; i < 90; i++) {
		const a = 0.12 + (1.3 * i) / 90;
		const k = curlAt(CURL_C[0] + Math.cos(a) * 100, CURL_C[1] + Math.sin(a) * 100).k;
		if (k < 0.35) continue;
		const H = 46 * k;
		const rOut = 4 + 8 * k;
		const reach = -0.9 - 0.5 * k;
		const cn = 5 + 8 * k;
		const rr = CURL_R + cn + Math.cos(reach) * rOut;
		const y = SEA + H * 0.76 + Math.sin(reach) * rOut;
		const p: Vec3 = [
			Math.round(CURL_C[0] + Math.cos(a) * rr),
			Math.round(y - w.rng.float(0, 2)),
			Math.round(CURL_C[1] + Math.sin(a) * rr),
		];
		w.blob(p, 1 + w.rng.float(0, 1.3), 'foam', { roughness: 0.5 });
	}
}

// --- Корпус -----------------------------------------------------------------------------------

export function buildHull(w: WorldBuilder): void {
	for (let x = XS; x <= XB + 1; x++) {
		const L = deckAt(x);
		const topRail = L + 3;
		for (let y = 6; y <= topRail; y++) {
			const hw = halfWidth(x, y);
			if (hw <= 0.3) continue;
			const zr = Math.floor(hw);
			for (let dz = -zr; dz <= zr; dz++) {
				const z = ZC + dz;
				const shell =
					Math.abs(dz) > hw - 1.6 ||
					x <= XS ||
					halfWidth(x + 1, y) < Math.abs(dz) + 0.5 ||
					halfWidth(x - 1, y) < Math.abs(dz) + 0.5;
				if (y >= L) {
					// фальшборт: только оболочка, сверху — планширь
					if (!shell) continue;
					w.set([x, y, z], y === topRail ? 'paint-cream' : hullColor(x, y, L));
					continue;
				}
				if (y === L - 1 && !shell) {
					w.set([x, y, z], 'deck');
					continue;
				}
				w.set([x, y, z], shell ? hullColor(x, y, L) : 'deck-dark');
			}
		}
	}
	// палубный настил: доски вдоль x, разбивка швами и пятнами
	w.shade([XS, DECK - 1, ZC - 14], [XB, QD - 1, ZC + 14], ['deck-dark', 'deck', 'deck-light'], {
		only: 'deck',
		scale: 5,
		speckle: 0.25,
	});
	for (let x = XS + 1; x < XB; x++) {
		const L = deckAt(x);
		for (let dz = -13; dz <= 13; dz++) {
			const z = ZC + dz;
			const m = w.get([x, L - 1, z]);
			if (!m?.startsWith('deck')) continue;
			const seam = dz % 3 === 0 || ((x + (dz + 30) * 7) % 23 === 0 && dz % 3 !== 0);
			if (seam) w.set([x, L - 1, z], 'deck-seam');
		}
	}
	buildWales(w);
	buildPortholes(w);
}

function hullColor(x: number, y: number, L: number): string {
	if (y <= SEA - 1) return 'hull-low';
	if (y === L - 6 || y === L + 2) return 'gold';
	if (y > L - 6 && y < L - 1) return y === L - 5 ? 'paint-teal-dark' : 'paint-teal';
	if (y >= L) return 'paint-teal';
	return (y + (x >> 4)) % 2 === 0 ? 'plank-a' : 'plank-b';
}

/** Привальные брусья: выступающая тёмная полоса и золотые накладки. */
function buildWales(w: WorldBuilder): void {
	for (let x = XS + 1; x <= XB - 2; x++) {
		const y = DECK - 8;
		const hw = halfWidth(x, y);
		if (hw < 2) continue;
		for (const s of [-1, 1]) {
			const z = ZC + s * (Math.floor(hw) + 1);
			if (!w.get([x, y, z])) w.set([x, y, z], 'plank-dark');
		}
	}
}

/** Иллюминаторы и пушечные порты по бортам. */
function buildPortholes(w: WorldBuilder): void {
	const side = (x: number, y: number, s: number): number => ZC + s * Math.floor(halfWidth(x, y));
	for (const s of [-1, 1]) {
		for (const x of [66, 74, 88, 96]) {
			const y = DECK - 3;
			const z = side(x, y, s);
			for (const [dx, dy] of [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1],
			]) {
				w.set([x + dx, y + dy, z], 'brass');
			}
			w.set([x, y, z], 'window-glow');
		}
		// пушечные порты с жерлами
		for (const x of [70, 92]) {
			const y = DECK - 3;
			const z = side(x, y, s);
			w.box([x - 1, y - 1, z], [x + 1, y + 1, z], 'iron');
			w.set([x, y, z + s], 'iron');
			w.set([x, y, z + 2 * s], 'iron');
		}
		// кормовая галерея ниже юта
		for (const x of [42, 48, 54]) {
			const y = QD - 4;
			const z = side(x, DECK + 1, s);
			w.box([x - 1, y - 1, z], [x + 1, y + 1, z], 'window-glow');
			w.box([x - 2, y - 2, z], [x + 2, y - 2, z], 'gold');
		}
	}
}

// --- Надстройки -------------------------------------------------------------------------------

export function buildStructures(w: WorldBuilder): void {
	// Ют: передняя стена каюты-камбуза с дверью, окнами и раздаточным окошком.
	const wx = QD_X - 1;
	for (let z = ZC - 12; z <= ZC + 12; z++) {
		if (halfWidth(wx, DECK) < Math.abs(z - ZC) + 0.5) continue;
		for (let y = DECK; y < QD - 1; y++) w.set([wx, y, z], 'cabin');
	}
	// балки-фахверк
	for (const z of [ZC - 9, ZC - 3, ZC + 3, ZC + 9]) {
		w.box([wx + 1, DECK, z], [wx + 1, QD - 2, z], 'cabin-beam');
	}
	w.box([wx + 1, QD - 2, ZC - 12], [wx + 1, QD - 2, ZC + 12], 'cabin-beam');
	// дверь
	w.box([wx, DECK, ZC - 1], [wx, DECK + 6, ZC + 1], 'plank-dark');
	w.box([wx, DECK + 7, ZC - 1], [wx, DECK + 7, ZC + 1], 'gold');
	w.set([wx + 1, DECK + 3, ZC + 1], 'brass');
	// круглые окна
	for (const z of [ZC - 6, ZC + 6]) {
		w.box([wx, DECK + 4, z - 1], [wx, DECK + 6, z + 1], 'window-glow');
		w.set([wx, DECK + 4, z - 1], 'cabin');
		w.set([wx, DECK + 4, z + 1], 'cabin');
		w.set([wx, DECK + 6, z - 1], 'cabin');
		w.set([wx, DECK + 6, z + 1], 'cabin');
	}
	// раздаточное окно камбуза со стойкой
	w.box([wx, DECK + 4, ZC + 9], [wx, DECK + 7, ZC + 11], 'window-glow');
	w.box([wx + 1, DECK + 3, ZC + 8], [wx + 2, DECK + 3, ZC + 12], 'deck-dark');
	// ограждение юта: балясины и поручень
	for (let z = ZC - 12; z <= ZC + 12; z++) {
		if (halfWidth(wx, QD) < Math.abs(z - ZC) + 0.5) continue;
		if (z % 2 === 0) w.box([wx, QD, z], [wx, QD + 1, z], 'paint-cream');
		w.set([wx, QD + 2, z], 'cabin-beam');
	}
	// трап на ют вдоль левого (дальнего) борта
	for (let i = 0; i < 10; i++) {
		const x = wx + 1 + (9 - i);
		const y = DECK + i;
		w.box([x, DECK, ZC - 10], [x, y, ZC - 7], i % 2 ? 'deck' : 'deck-light');
	}
	w.curve(
		[
			[wx + 11, DECK + 2, ZC - 6],
			[wx + 1, QD + 2, ZC - 6],
		],
		'cabin-beam',
	);

	// Бак: передняя стенка и трап.
	const fx = FC_X;
	for (let z = ZC - 13; z <= ZC + 13; z++) {
		if (halfWidth(fx, DECK) < Math.abs(z - ZC) + 0.5) continue;
		for (let y = DECK; y < FC - 1; y++) w.set([fx, y, z], 'cabin');
		if (z % 2 === 0) w.box([fx, FC, z], [fx, FC + 1, z], 'paint-cream');
		w.set([fx, FC + 2, z], 'cabin-beam');
	}
	w.box([fx, DECK, ZC + 2], [fx, DECK + 3, ZC + 4], 'plank-dark');
	for (let i = 0; i < 5; i++) {
		w.box([fx - 1 - (4 - i), DECK, ZC - 11], [fx - 1 - (4 - i), DECK + i, ZC - 8], 'deck-light');
	}
	// пушечные порты в фальшборте левого (дальнего) борта
	for (const px of [70, 92]) {
		for (let x = px - 1; x <= px + 1; x++) {
			for (let z = ZC - 14; z <= ZC - 8; z++) {
				for (let y = DECK + 1; y <= DECK + 2; y++) {
					if (w.get([x, y, z])?.startsWith('paint')) w.set([x, y, z], 'air');
				}
			}
		}
	}
	// кронштейны фонарей: у двери каюты и на фок-мачте
	for (const z of [ZC - 4, ZC + 4]) w.box([wx + 1, QD - 3, z], [wx + 2, QD - 3, z], 'iron');
	w.box([FORE_X + 2, DECK + 12, ZC], [FORE_X + 3, DECK + 12, ZC], 'iron');
	buildSternLanterns(w);
	buildStove(w);
}

function buildSternLanterns(w: WorldBuilder): void {
	for (const s of [-1, 1]) {
		const z = ZC + s * 9;
		w.box([XS - 1, QD + 3, z], [XS - 1, QD + 4, z], 'iron');
		w.box([XS - 2, QD + 5, z - 1], [XS - 2, QD + 7, z + 1], 'window-glow');
		w.box([XS - 2, QD + 8, z - 1], [XS - 2, QD + 8, z + 1], 'gold');
		w.set([XS - 2, QD + 9, z], 'gold');
	}
	// резной транец: золотая рама и окна капитанской каюты
	for (let z = ZC - 9; z <= ZC + 9; z++) {
		w.set([XS, QD + 2, z], 'gold');
		if (Math.abs(z - ZC) < 8 && (z - ZC + 20) % 4 !== 0) {
			w.box([XS, DECK + 2, z], [XS, DECK + 5, z], 'window-glow');
		}
	}
	w.box([XS, DECK + 1, ZC - 9], [XS, DECK + 1, ZC + 9], 'gold');
	w.box([XS, DECK + 6, ZC - 9], [XS, DECK + 6, ZC + 9], 'gold');
}

/** Камбуз на палубе: кирпичная плита с топкой и трубой вдоль стены каюты. */
export const STOVE: Vec3 = [64, DECK, ZC + 9];
function buildStove(w: WorldBuilder): void {
	const [x, y, z] = STOVE;
	w.box([x - 1, y, z - 2], [x + 3, y + 3, z + 3], 'brick');
	w.shade([x - 1, y, z - 2], [x + 3, y + 3, z + 3], ['brick-dark', 'brick'], {
		only: 'brick',
		scale: 2,
		speckle: 0.3,
	});
	w.box([x - 1, y + 4, z - 2], [x + 3, y + 4, z + 3], 'iron');
	// топка смотрит на нос
	w.box([x + 3, y, z - 1], [x + 3, y + 1, z + 2], 'window-glow');
	// труба у фальшборта: тонкая, с колпаком-«шляпкой»
	w.box([x + 2, y + 5, z + 3], [x + 2, QD + 5, z + 3], 'iron');
	w.box([x + 1, QD + 6, z + 2], [x + 3, QD + 6, z + 4], 'iron');
	w.set([x + 2, QD + 7, z + 3], 'iron');
	// котелок на плите
	w.box([x, y + 5, z - 1], [x + 1, y + 6, z], 'iron');
	w.anchor('stoveFire', [x + 4, y + 1, z + 0.5]);
	w.anchor('stoveChimney', [x + 2.5, QD + 8, z + 3.5]);
	w.anchor('stoveTop', [x + 1, y + 7, z]);
}

// --- Нарвал-гальюнная фигура ------------------------------------------------------------------

export function buildFigurehead(w: WorldBuilder): void {
	const c: Vec3 = [132, 27, ZC];
	w.ellipsoid(c, [6.5, 5.2, 4.6], 'narwhal');
	w.ellipsoid([128, 26, ZC], [5, 6, 5], 'narwhal'); // шея к форштевню
	// светлое брюхо и пятнистая спина
	w.shade([124, 20, ZC - 6], [140, 33, ZC + 6], ['narwhal-dark', 'narwhal', 'narwhal'], {
		only: 'narwhal',
		scale: 2.5,
		speckle: 0.15,
	});
	for (let x = 124; x <= 139; x++) {
		for (let z = ZC - 6; z <= ZC + 6; z++) {
			for (let y = 20; y <= 24; y++) {
				const m = w.get([x, y, z]);
				if (m?.startsWith('narwhal') && y <= 23 + ((x + z) % 2)) w.set([x, y, z], 'narwhal-belly');
			}
		}
	}
	// улыбка, глаза, румянец по обоим бокам
	for (const s of [-1, 1]) {
		const z = ZC + s * 4;
		w.box([135, 28, z], [136, 29, z], 'ink');
		w.set([136, 29, z], 'emblem-white');
		w.set([134, 26, z + s * 0], 'blush');
		w.set([133, 26, z], 'blush');
		for (let x = 134; x <= 138; x++) {
			const y = 24 + Math.round(((x - 136) / 2) ** 2 * 0.6);
			const zz =
				ZC + s * Math.max(1, Math.floor(4.6 * Math.sqrt(Math.max(0, 1 - ((x - 132) / 6.5) ** 2))));
			w.set([x, y, zz], 'ink');
		}
	}
	// плавник-«ласты» по бокам
	for (const s of [-1, 1]) {
		w.curve(
			[
				[130, 23, ZC + s * 4],
				[127, 21, ZC + s * 7],
				[124, 21, ZC + s * 8],
			],
			'narwhal-dark',
			{ radius: 1.2, endRadius: 0.6 },
		);
	}
	// спиральный рог-бушприт
	const base: Vec3 = [137, 31, ZC];
	const steps = 60;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const p: Vec3 = [
			base[0] + (HORN_TIP[0] - base[0]) * t,
			base[1] + (HORN_TIP[1] - base[1]) * t,
			ZC,
		];
		const r = 1.9 * (1 - t) + 0.4;
		w.sphere(p, r, 'ivory');
		// спиральная бороздка
		const a = t * Math.PI * 14;
		const g: Vec3 = [p[0], p[1] + Math.cos(a) * r, p[2] + Math.sin(a) * r];
		if (r > 0.9) w.set(g, 'ivory-dark');
	}
	w.anchor('hornTip', HORN_TIP);
}

// --- Рангоут, паруса, такелаж -----------------------------------------------------------------

interface SailSpec {
	x: number;
	y0: number;
	y1: number;
	/** Полуразмах снизу и сверху. */
	half0: number;
	half1: number;
	bulge: number;
}

export const SAILS: SailSpec[] = [
	{ x: MAIN_X, y0: 64, y1: 83, half0: 15, half1: 12, bulge: 5 },
	{ x: MAIN_X, y0: 87, y1: 94, half0: 9, half1: 7, bulge: 2 },
	{ x: FORE_X, y0: 52, y1: 70, half0: 13, half1: 11, bulge: 4 },
	{ x: FORE_X, y0: 74, y1: 81, half0: 8, half1: 6, bulge: 2 },
];

/** Нижние паруса взяты на гитовы: свёрнуты скаткой под реем, чтобы не закрывать палубу. */
const FURLED: Array<{ x: number; y: number; half: number }> = [
	{ x: MAIN_X, y: 52, half: 17 },
	{ x: FORE_X, y: 46, half: 15 },
];

export const MAIN_TOP = 101;
export const FORE_TOP = 87;
export const NEST_Y = 59;

/** Такелаж: пары точек [от, до] для тонких канатов-сущностей. */
export const ROPES: Array<[Vec3, Vec3]> = (() => {
	const out: Array<[Vec3, Vec3]> = [];
	const rail = (x: number, s: number): Vec3 => [
		x,
		DECK + 3.5,
		ZC + s * (halfWidth(x, DECK + 2) - 0.6),
	];
	for (const s of [-1, 1]) {
		for (let i = 0; i < 3; i++) {
			out.push([[MAIN_X - 0.5, NEST_Y - 1, ZC + s * 1.6], rail(MAIN_X - 5 - i * 3, s)]);
			out.push([[FORE_X - 0.5, 50, ZC + s * 1.6], rail(FORE_X - 5 - i * 3, s)]);
		}
		out.push([
			[MAIN_X, MAIN_TOP - 8, ZC + s * 1],
			[MAIN_X - 2, NEST_Y + 3, ZC + s * 4.4],
		]);
		out.push([
			[MAIN_X, MAIN_TOP - 3, ZC + s * 1],
			[XS + 6, QD + 3.5, ZC + s * 9],
		]);
	}
	out.push([
		[MAIN_X + 1, MAIN_TOP - 3, ZC],
		[FORE_X - 1, FORE_TOP - 2, ZC],
	]);
	out.push([
		[FORE_X + 1, FORE_TOP - 2, ZC],
		[HORN_TIP[0] - 1, HORN_TIP[1] + 0.5, ZC],
	]);
	return out;
})();

export function buildRigging(w: WorldBuilder): void {
	// мачты
	for (const [x, top, base] of [
		[MAIN_X, MAIN_TOP, DECK],
		[FORE_X, FORE_TOP, DECK],
	] as const) {
		w.cylinder([x, base, ZC], 1.6, top - base, 'mast');
		for (let y = base + 6; y < top; y += 9) {
			w.cylinder([x, y, ZC], 2, 1, 'mast-band');
		}
	}
	// марс (воронье гнездо) грот-мачты
	w.cylinder([MAIN_X, NEST_Y - 1, ZC], 5, 1, 'plank-dark');
	for (let a = 0; a < 64; a++) {
		const ang = (a / 64) * Math.PI * 2;
		const x = Math.round(MAIN_X + Math.cos(ang) * 4.6);
		const z = Math.round(ZC + Math.sin(ang) * 4.6);
		w.box([x, NEST_Y, z], [x, NEST_Y + 2, z], a % 8 === 0 ? 'mast-band' : 'plank-b');
		w.set([x, NEST_Y + 3, z], 'paint-cream');
	}
	// реи и паруса
	for (const s of SAILS) {
		w.line([s.x, s.y1 + 1, ZC - s.half1 - 2], [s.x, s.y1 + 1, ZC + s.half1 + 2], 'mast');
		w.line([s.x - 1, s.y1 + 1, ZC - s.half1 - 1], [s.x - 1, s.y1 + 1, ZC + s.half1 + 1], 'mast');
		sail(w, s);
	}
	// свёрнутые нижние паруса: скатка с подвязками
	for (const f of FURLED) {
		w.line([f.x, f.y + 1, ZC - f.half - 2], [f.x, f.y + 1, ZC + f.half + 2], 'mast');
		for (let z = ZC - f.half; z <= ZC + f.half; z++) {
			const tie = (z - ZC + 40) % 5 === 0;
			w.box([f.x, f.y - 1, z], [f.x + 1, f.y, z], tie ? 'rope' : 'sail');
			if (!tie) w.set([f.x + 1, f.y - 1, z], 'sail-shade');
			if (!tie && Math.abs(z - ZC) < f.half - 3) w.set([f.x + 1, f.y - 2, z], 'sail-shade');
		}
	}
	// эмблема на грот-марселе
	emblem(w, SAILS[0]);
	// кливер: треугольник между фок-мачтой и рогом
	jib(w);
	// ванты и штаги — тонкими сущностями (ROPES), здесь только юферсы на планшире
	for (const [, b] of ROPES) {
		if (b[1] <= DECK + 4)
			w.set(
				[Math.round(b[0]), DECK + 3, b[2] > ZC ? Math.ceil(b[2]) : Math.floor(b[2])],
				'plank-dark',
			);
	}
	w.anchor('mainTop', [MAIN_X, MAIN_TOP, ZC]);
	w.anchor('foreTop', [FORE_X, FORE_TOP, ZC]);
	w.anchor('nestFloor', [MAIN_X, NEST_Y, ZC]);
}

/** Выгнутый ветром прямой парус: перед (+x) выпуклый, с затенением к краям и швами. */
function sail(w: WorldBuilder, s: SailSpec): void {
	for (let y = s.y0; y <= s.y1; y++) {
		const ty = (y - s.y0) / (s.y1 - s.y0);
		const half = s.half0 + (s.half1 - s.half0) * ty;
		for (let z = Math.ceil(ZC - half); z <= Math.floor(ZC + half); z++) {
			const tz = (z - ZC) / half;
			// пузо паруса: больше всего внизу посередине, верх прижат к рею
			const b = s.bulge * (1 - tz * tz) * Math.sin(Math.PI * (0.15 + 0.85 * (1 - ty)) * 0.62);
			const xx = s.x + 1 + Math.round(b);
			const seam = (z - ZC + 40) % 5 === 0;
			const edge = Math.abs(tz) > 0.92 || y === s.y0;
			const m = edge ? 'sail-seam' : seam ? 'sail-shade' : 'sail';
			w.set([xx, y, z], m);
			// толщина 2: за выпуклой стороной — тень, без дыр на ступеньках
			w.set([xx - 1, y, z], 'sail-shade');
			// заплатки
			if (((z * 7 + y * 13) & 63) === 5 && !edge) {
				w.box([xx, y, z], [xx, y + 1, z + 1], 'sail-patch');
			}
		}
	}
}

/** Эмблема команды на гроте: череп в авиаторских очках поверх скрещённых поварёшки и сабли. */
function emblem(w: WorldBuilder, s: SailSpec): void {
	const front = (y: number, z: number): Vec3 | null => {
		for (let x = s.x + 8; x >= s.x; x--) {
			const m = w.get([x, y, z]);
			if (m?.startsWith('sail')) return [x, y, z];
		}
		return null;
	};
	const paint = (y: number, z: number, m: string): void => {
		const p = front(y, z);
		if (p) w.set(p, m);
	};
	const cy = Math.round((s.y0 + s.y1) / 2) - 1;
	// скрещённые поварёшка и сабля
	for (let i = -6; i <= 6; i++) {
		paint(cy + i, ZC + i, i > 4 ? 'ink' : 'ink');
		paint(cy + i, ZC - i, 'ink');
	}
	paint(cy + 6, ZC - 7, 'ink');
	paint(cy + 7, ZC - 6, 'ink');
	paint(cy + 7, ZC - 7, 'ink');
	paint(cy - 6, ZC + 7, 'ink');
	paint(cy - 7, ZC + 6, 'ink');
	// череп: круглый белый в оранжевом ореоле-солнце
	for (let dy = -6; dy <= 6; dy++) {
		for (let dz = -6; dz <= 6; dz++) {
			const r = Math.hypot(dy * 1.05, dz);
			if (r <= 4.2) paint(cy + 1 + dy, ZC + dz, 'emblem-white');
			else if (r <= 5.4 && (Math.round(Math.atan2(dy, dz) * 4) & 1) === 0)
				paint(cy + 1 + dy, ZC + dz, 'emblem-orange');
		}
	}
	paint(cy - 3, ZC - 1, 'emblem-white');
	paint(cy - 3, ZC + 1, 'emblem-white');
	paint(cy - 4, ZC - 1, 'emblem-white');
	paint(cy - 4, ZC + 1, 'emblem-white');
	// очки
	for (const dz of [-2, 2]) {
		paint(cy + 1, ZC + dz, 'ink');
		paint(cy + 2, ZC + dz, 'ink');
		paint(cy + 1, ZC + dz + Math.sign(dz), 'ink');
		paint(cy + 2, ZC + dz + Math.sign(dz), 'ink');
	}
	for (let dz = -4; dz <= 4; dz++) paint(cy + 3, ZC + dz, 'emblem-orange');
	// нос и ухмылка
	paint(cy - 1, ZC, 'ink');
	for (let dz = -2; dz <= 2; dz++) paint(cy - 2, ZC + dz, dz % 2 === 0 ? 'ink' : 'emblem-white');
}

function jib(w: WorldBuilder): void {
	const a: [number, number] = [FORE_X + 2, FORE_TOP - 4];
	const b: [number, number] = [HORN_TIP[0] - 2, HORN_TIP[1] + 1];
	const c: [number, number] = [FC_X + 12, FC + 5];
	const area = (p: [number, number], q: [number, number], r: [number, number]): number =>
		(q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
	const total = area(a, b, c);
	for (let x = Math.min(a[0], c[0]); x <= b[0]; x++) {
		for (let y = c[1]; y <= a[1]; y++) {
			const p: [number, number] = [x, y];
			const u = area(p, b, c) / total;
			const v = area(a, p, c) / total;
			const t = area(a, b, p) / total;
			if (u < 0 || v < 0 || t < 0) continue;
			// пузо кливера к правому борту (по ветру)
			const belly = Math.round(3 * Math.min(u, v, t) * 3);
			const edge = Math.min(u, v, t) < 0.04;
			w.set([x, y, ZC + belly], edge ? 'sail-seam' : (x + y) % 9 === 0 ? 'sail-shade' : 'sail');
			if (belly > 0) w.set([x, y, ZC + belly - 1], 'sail-shade');
		}
	}
}
