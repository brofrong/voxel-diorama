import { type MaterialInput, type Model, type ModelBuilder, model, type Vec3 } from '#sdk';

/*
 * Набор скульптора для персонажей: голова-заготовка (череп, лицо, причёска) и мелкие кисти.
 * Все модели — в мелких вокселях сущностей (scale 0.25 задаёт rig), лицо смотрит в +z.
 */

export type Palette = Record<string, MaterialInput>;

/** Цвета лица, общие для всех голов. */
export const FACE_COLORS: Palette = {
	white: { color: '#fbfbf6', vary: 0 },
	shine: { color: '#ffffff', emissive: 0.2, vary: 0 },
	pupil: { color: '#141019', vary: 0 },
	lash: { color: '#1f1520', vary: 0 },
	mouth: { color: '#5a1f22', vary: 0 },
	teeth: { color: '#fffaf0', vary: 0 },
	tongue: { color: '#e0606a', vary: 0 },
	blush: { color: '#f2938f', vary: 0 },
};

/** Рамка черепа внутри модели головы. */
export interface Frame {
	ox: number;
	oy: number;
	oz: number;
	W: number;
	H: number;
	D: number;
	/** Левый и правый столбцы центральной пары (W чётная). */
	c0: number;
	c1: number;
}

export interface FaceSpec {
	/** Нижний ряд глаз, от низа черепа. */
	eyeY: number;
	eyes: 'bright' | 'sharp' | 'closed' | 'happy' | 'soft';
	mouth: 'grin' | 'smile' | 'flat' | 'laugh' | 'o' | 'smirk' | 'none';
	mouthY?: number;
	brows?: 'up' | 'angry' | 'flat' | 'worried' | 'none';
	blush?: boolean;
	freckles?: boolean;
	nose?: boolean;
}

export interface HairSpec {
	/** Нижняя граница чёлки над лбом (от низа черепа) по столбцу x (0..W-1). */
	fringe: (x: number) => number;
	/** До какой высоты волосы спускаются на затылке и висках. */
	nape: number;
	/** Объём причёски над черепом, в вокселях. */
	puff?: number;
	mat?: string;
}

export interface HeadSpec {
	W: number;
	H: number;
	D: number;
	/** Поля вокруг черепа: [-x, +x, +y, -z, +z] (снизу поле 0 — шея). */
	pad: [number, number, number, number, number];
	palette: Palette;
	face: FaceSpec;
	hair?: HairSpec;
	ears?: boolean;
	extra?: (m: ModelBuilder, f: Frame) => void;
}

const inSkull = (f: Frame, x: number, y: number, z: number, grow = 0): boolean => {
	const hx = f.W / 2 + grow;
	const hy = f.H / 2 + grow;
	const hz = f.D / 2 + grow;
	const nx = (x + 0.5 - (f.ox + f.W / 2)) / hx;
	const ny = (y + 0.5 - (f.oy + f.H / 2)) / hy;
	const nz = (z + 0.5 - (f.oz + f.D / 2)) / hz;
	// челюсть уже: к подбородку череп сужается
	const taper = ny < -0.15 ? 1 - (-0.15 - ny) * 0.42 : 1;
	const p = 2.7;
	return (
		Math.abs(nx / taper) ** p + Math.abs(ny) ** p + Math.abs(nz / (0.5 + 0.5 * taper)) ** p <= 1
	);
};

/** Самый передний непустой воксель столбца (x, y) — туда рисуем лицо. */
export function frontZ(m: ModelBuilder, f: Frame, x: number, y: number): number | null {
	for (let z = f.oz + f.D + 2; z >= f.oz; z--) {
		if (m.get([x, y, z])) return z;
	}
	return null;
}

export function paintFront(m: ModelBuilder, f: Frame, x: number, y: number, mat: string): void {
	const z = frontZ(m, f, x, y);
	if (z !== null) m.set([x, y, z], mat);
}

function drawFace(m: ModelBuilder, f: Frame, s: FaceSpec): void {
	const P = (x: number, y: number, mat: string): void => paintFront(m, f, f.ox + x, f.oy + y, mat);
	const lc = f.c0 - f.ox; // локальные столбцы центральной пары
	const rc = f.c1 - f.ox;
	const eyes: Array<[number, number]> = [
		[lc - 2, lc - 1],
		[rc + 1, rc + 2],
	];
	const e = s.eyeY;
	eyes.forEach(([a, b], i) => {
		const inner = i === 0 ? b : a;
		const outer = i === 0 ? a : b;
		switch (s.eyes) {
			case 'bright':
				P(a, e + 2, 'lash');
				P(b, e + 2, 'lash');
				P(outer + (i === 0 ? -1 : 1), e + 2, 'lash');
				P(outer, e + 1, 'shine');
				P(inner, e + 1, 'pupil');
				P(a, e, 'iris');
				P(b, e, 'iris');
				break;
			case 'soft':
				P(a, e + 1, 'lash');
				P(b, e + 1, 'lash');
				P(outer, e, 'shine');
				P(inner, e, 'iris');
				break;
			case 'sharp':
				P(a, e + 1, 'lash');
				P(b, e + 1, 'lash');
				P(outer + (i === 0 ? -1 : 1), e + 1, 'lash');
				P(outer, e, 'iris');
				P(inner, e, 'pupil');
				break;
			case 'closed':
				P(a, e, 'lash');
				P(b, e, 'lash');
				P(outer + (i === 0 ? -1 : 1), e + 1, 'lash');
				break;
			case 'happy':
				P(a, e + 1, 'lash');
				P(b, e + 1, 'lash');
				P(outer + (i === 0 ? -1 : 1), e, 'lash');
				P(inner + (i === 0 ? 1 : -1), e, 'lash');
				break;
		}
		const bY = s.eyes === 'bright' ? e + 3 : e + 2;
		const brow = s.brows ?? 'flat';
		if (brow !== 'none') {
			const innerUp = brow === 'up' || brow === 'worried' ? 1 : 0;
			const outerUp = brow === 'angry' ? 1 : 0;
			P(inner, bY + innerUp, 'brow');
			P(outer, bY + outerUp, 'brow');
			if (brow === 'angry') P(inner + (i === 0 ? 1 : -1), bY - 1 + 1, 'brow');
		}
		if (s.blush) P(outer, e - 1, 'blush');
		if (s.freckles) {
			P(inner, e - 1, 'freckle');
			P(outer + (i === 0 ? -1 : 1), e - 1, 'freckle');
		}
	});
	if (s.nose !== false) {
		const z = frontZ(m, f, f.c0, f.oy + e - 1);
		if (z !== null) {
			m.set([f.c0, f.oy + e - 1, z + 1], 'skin');
			m.set([f.c1, f.oy + e - 1, z + 1], 'skin-shade');
		}
	}
	const my = s.mouthY ?? e - 3;
	switch (s.mouth) {
		case 'grin':
			for (let x = lc - 1; x <= rc + 1; x++) P(x, my + 1, 'teeth');
			P(lc - 2, my + 1, 'mouth');
			P(rc + 2, my + 1, 'mouth');
			for (let x = lc - 1; x <= rc + 1; x++) P(x, my, 'mouth');
			P(lc, my, 'tongue');
			break;
		case 'laugh':
			for (let x = lc - 1; x <= rc + 1; x++) P(x, my + 1, 'teeth');
			for (let x = lc - 1; x <= rc + 1; x++) P(x, my, 'mouth');
			P(lc, my - 1, 'mouth');
			P(rc, my - 1, 'mouth');
			P(lc, my, 'tongue');
			P(rc, my, 'tongue');
			break;
		case 'smile':
			P(lc, my, 'mouth');
			P(rc, my, 'mouth');
			P(lc - 1, my + 1, 'mouth');
			P(rc + 1, my + 1, 'mouth');
			break;
		case 'smirk':
			P(lc, my, 'mouth');
			P(rc, my, 'mouth');
			P(rc + 1, my + 1, 'mouth');
			break;
		case 'flat':
			P(lc, my, 'skin-shade');
			P(rc, my, 'skin-shade');
			break;
		case 'o':
			P(lc, my, 'mouth');
			P(rc, my, 'mouth');
			break;
		case 'none':
			break;
	}
}

/** Голова: череп-суперэллипсоид, причёска, лицо, уши. Pivot — шея (низ центра черепа). */
export function head(spec: HeadSpec): Model {
	const [px0, px1, py1, pz0, pz1] = spec.pad;
	const size: Vec3 = [spec.W + px0 + px1, spec.H + py1, spec.D + pz0 + pz1];
	const f: Frame = {
		ox: px0,
		oy: 0,
		oz: pz0,
		W: spec.W,
		H: spec.H,
		D: spec.D,
		c0: px0 + spec.W / 2 - 1,
		c1: px0 + spec.W / 2,
	};
	return model(
		{
			size,
			pivot: [px0 + spec.W / 2, 0, pz0 + spec.D / 2],
			palette: { ...FACE_COLORS, ...spec.palette },
		},
		(m) => {
			const hair = spec.hair;
			const hm = hair?.mat ?? 'hair';
			for (let z = 0; z < size[2]; z++) {
				for (let y = 0; y < size[1]; y++) {
					for (let x = 0; x < size[0]; x++) {
						const lx = x - f.ox;
						const ly = y - f.oy;
						const skull = inSkull(f, x, y, z);
						const front = z >= f.oz + f.D * 0.5;
						if (skull) {
							const covered =
								hair &&
								(ly >= hair.fringe(Math.max(0, Math.min(f.W - 1, lx))) ||
									(!front && ly >= hair.nape));
							m.set([x, y, z], covered ? hm : 'skin');
							continue;
						}
						if (!hair) continue;
						const puff = hair.puff ?? 1.2;
						if (!inSkull(f, x, y - puff * 0.4, z + puff * 0.3, puff)) continue;
						const fr = hair.fringe(Math.max(0, Math.min(f.W - 1, lx)));
						if (ly >= fr || (!front && ly >= hair.nape) || (z < f.oz + 2 && ly >= hair.nape - 1)) {
							m.set([x, y, z], hm);
						}
					}
				}
			}
			if (spec.ears !== false) {
				const ey = f.oy + spec.face.eyeY - 1;
				const ez = f.oz + Math.floor(f.D / 2);
				for (const x of [f.ox - 1, f.ox + f.W]) {
					if (!m.get([x, ey, ez])) {
						m.set([x, ey, ez], 'skin');
						m.set([x, ey + 1, ez], 'skin');
						m.set([x, ey, ez - 1], 'skin-shade');
					}
				}
			}
			drawFace(m, f, spec.face);
			spec.extra?.(m, f);
		},
	);
}

/** Чёлка-зигзаг: пряди через одну ниже. */
export const jagged =
	(base: number, depth = 1, period = 2, phase = 0) =>
	(x: number): number =>
		(x + phase) % period === 0 ? base - depth : base;

/** Простая рука: рукав, предплечье, кисть. Pivot — плечо (верх центра). */
export function arm(opts: {
	len: number;
	w?: number;
	sleeve: string;
	sleeveLen: number;
	skin?: string;
	cuff?: string;
	palette: Palette;
	extra?: (m: ModelBuilder) => void;
	/** Добавочный размер модели вниз/вперёд под предмет в руке. */
	grow?: Vec3;
}): Model {
	const w = opts.w ?? 3;
	const g = opts.grow ?? [0, 0, 0];
	const size: Vec3 = [w + 2 + g[0], opts.len + g[1], w + 2 + g[2]];
	const top = size[1] - 1;
	return model(
		{
			size,
			pivot: [(w + 2) / 2, size[1] - 0.5, (w + 2) / 2],
			palette: opts.palette,
		},
		(m) => {
			const skin = opts.skin ?? 'skin';
			for (let y = top; y > top - opts.len; y--) {
				const fromTop = top - y;
				const mat = fromTop < opts.sleeveLen ? opts.sleeve : skin;
				const shrink = fromTop > opts.len - 3 ? 0 : 0;
				m.box([1 + shrink, y, 1], [w - shrink, y, w], mat);
			}
			// плечо скруглённое, кисть чуть шире
			m.box([1, top, 1], [w, top, w], opts.sleeve);
			if (opts.cuff)
				m.box(
					[0, top - opts.sleeveLen + 1, 0],
					[w + 1, top - opts.sleeveLen + 1, w + 1],
					opts.cuff,
				);
			m.box([1, top - opts.len + 1, 1], [w, top - opts.len + 2, w + 1], skin);
			opts.extra?.(m);
		},
	);
}

/** Стенка из «досок» с чередованием оттенков — для ящиков, бочек, сундуков. */
export function planks(i: number, shades: string[]): string {
	return shades[((i % shades.length) + shades.length) % shades.length];
}
