import { limbs, type ModelBuilder, model, type Rig, rig, type Vec3 } from '#sdk';
import { arm, head, jagged, type Palette, paintFront } from './kit.ts';

/*
 * Команда «Lucky Narwhal» — каждый персонаж слеплен отдельно: своё лицо, причёска, костюм,
 * поза. Rig 'custom' (scale 0.25): корень — тело с ногами в позе, к нему голова, руки и
 * развевающиеся на ветру детали (плащ, хвост волос, шарф), которые двигает limbs().
 */

const S = 0.3;
const TAU = Math.PI * 2;
const wave = (t: number, period: number, phase = 0): number => Math.sin((TAU * t) / period + phase);

/** Эллипсоид только из одного материала поверх пустоты (не затирает детали). */
function fillEmpty(m: ModelBuilder, c: Vec3, r: Vec3, mat: string): void {
	for (let z = Math.floor(c[2] - r[2]); z <= Math.ceil(c[2] + r[2]); z++) {
		for (let y = Math.floor(c[1] - r[1]); y <= Math.ceil(c[1] + r[1]); y++) {
			for (let x = Math.floor(c[0] - r[0]); x <= Math.ceil(c[0] + r[0]); x++) {
				const d =
					((x + 0.5 - c[0]) / r[0]) ** 2 +
					((y + 0.5 - c[1]) / r[1]) ** 2 +
					((z + 0.5 - c[2]) / r[2]) ** 2;
				if (d <= 1 && !m.get([x, y, z])) m.set([x, y, z], mat);
			}
		}
	}
}

/** Перекрасить все воксели материала `from` в коробке по правилу. */
function recolor(
	m: ModelBuilder,
	a: Vec3,
	b: Vec3,
	from: string,
	pick: (x: number, y: number, z: number) => string | null,
): void {
	for (let z = a[2]; z <= b[2]; z++) {
		for (let y = a[1]; y <= b[1]; y++) {
			for (let x = a[0]; x <= b[0]; x++) {
				if (m.get([x, y, z]) !== from) continue;
				const to = pick(x, y, z);
				if (to) m.set([x, y, z], to);
			}
		}
	}
}

// =============================================================================================
// Капитан Сора — у носа, нога на бочонке, рука указывает к горизонту. Рыжие вихри, очки-
// авиаторы на лбу, пластырь на щеке, небесно-голубой жилет, красный кушак, плащ на плечах.
// =============================================================================================

export function captain(): Rig {
	const P: Palette = {
		skin: { color: '#f2c29b', vary: 0.03 },
		'skin-shade': { color: '#d99d78', vary: 0.03 },
		iris: { color: '#e0891c', vary: 0 },
		brow: { color: '#c4521a', vary: 0 },
		hair: { color: '#ff7a22', vary: 0.08 },
		'hair-light': { color: '#ffb347', vary: 0.06 },
		freckle: { color: '#c9875f', vary: 0 },
		strap: { color: '#5b3a24', vary: 0.05 },
		brass: { color: '#d4a23c', vary: 0.05 },
		lens: { color: '#5fd0d6', emissive: 0.35, vary: 0 },
		plaster: { color: '#f3dcb8', vary: 0 },
		tee: { color: '#f7f4ec', vary: 0.03 },
		vest: { color: '#4fa6e0', vary: 0.05 },
		'vest-dark': { color: '#2f7cb6', vary: 0.05 },
		button: { color: '#f2c043', vary: 0 },
		sash: { color: '#d8282f', vary: 0.05 },
		'sash-dark': { color: '#a31b24', vary: 0.05 },
		shorts: { color: '#5d6b3a', vary: 0.06 },
		'shorts-dark': { color: '#46512b', vary: 0.06 },
		'sock-red': { color: '#d8282f', vary: 0 },
		'sock-white': { color: '#f5f1e6', vary: 0 },
		boot: { color: '#6b4226', vary: 0.06 },
		sole: { color: '#2a1d16', vary: 0 },
		wrap: { color: '#ece3cf', vary: 0.04 },
		coat: { color: '#1f2d5c', vary: 0.05 },
		'coat-dark': { color: '#15204a', vary: 0.05 },
		lining: { color: '#b0202c', vary: 0.04 },
		trim: { color: '#e3b041', vary: 0.04 },
	};

	const hd = head({
		W: 10,
		H: 10,
		D: 9,
		pad: [3, 3, 6, 4, 2],
		palette: P,
		face: { eyeY: 4, eyes: 'bright', mouth: 'grin', mouthY: 1, brows: 'angry', freckles: true },
		hair: { fringe: jagged(8, 1, 3), nape: 4, puff: 1.6 },
		extra: (m, f) => {
			// вихри: прядь-шипы назад и вверх, ветер сносит их вбок
			const top = f.oy + f.H;
			const spikes: Array<[Vec3, Vec3]> = [
				[
					[f.ox + 2, top, f.oz + 5],
					[f.ox - 1, top + 4, f.oz + 3],
				],
				[
					[f.ox + 4, top, f.oz + 6],
					[f.ox + 3, top + 6, f.oz + 5],
				],
				[
					[f.ox + 6, top, f.oz + 5],
					[f.ox + 8, top + 5, f.oz + 4],
				],
				[
					[f.ox + 8, top - 1, f.oz + 4],
					[f.ox + 12, top + 3, f.oz + 2],
				],
				[
					[f.ox + 5, top - 1, f.oz + 2],
					[f.ox + 5, top + 3, f.oz - 3],
				],
				[
					[f.ox + 2, top - 2, f.oz + 2],
					[f.ox - 2, top + 1, f.oz - 2],
				],
				[
					[f.ox + 8, top - 2, f.oz + 2],
					[f.ox + 11, top, f.oz - 2],
				],
				[
					[f.ox + 9, top - 3, f.oz + 6],
					[f.ox + 12, top - 1, f.oz + 8],
				],
			];
			for (const [a, b] of spikes) {
				m.curve([a, b], 'hair', { radius: 1.3, endRadius: 0.3 });
				m.set(b, 'hair-light');
			}
			// очки-авиаторы на лбу: ремешок по кругу и две линзы в латуни
			const gy = f.oy + 8;
			for (let z = f.oz - 1; z <= f.oz + f.D; z++) {
				for (let x = f.ox - 1; x <= f.ox + f.W; x++) {
					const m0 = m.get([x, gy, z]);
					if (m0 === 'hair') {
						const edge =
							!m.get([x + 1, gy, z]) ||
							!m.get([x - 1, gy, z]) ||
							!m.get([x, gy, z + 1]) ||
							!m.get([x, gy, z - 1]);
						if (edge) m.set([x, gy, z], 'strap');
					}
				}
			}
			for (const cx of [f.c0 - 2, f.c1 + 1]) {
				const z = (f.oz + f.D) as number;
				m.box([cx - 1, gy, z], [cx + 2, gy + 2, z], 'brass');
				m.box([cx, gy + 1, z + 1], [cx + 1, gy + 1, z + 1], 'lens');
				m.box([cx, gy, z], [cx + 1, gy + 2, z], 'lens');
			}
			// пластырь крестом на левой щеке
			paintFront(m, f, f.c1 + 3, f.oy + 3, 'plaster');
			paintFront(m, f, f.c1 + 2, f.oy + 3, 'plaster');
			paintFront(m, f, f.c1 + 3, f.oy + 2, 'plaster');
		},
	});

	// Тело: правая нога стоит, левая на бочонке (подошва на высоте 5).
	const body = model({ size: [16, 26, 17], palette: P, pivot: [8, 0, 7] }, (m) => {
		// правая нога
		m.box([4, 0, 5], [7, 1, 10], 'boot');
		m.box([4, 0, 5], [7, 0, 10], 'sole');
		m.box([4, 2, 5], [7, 3, 8], 'boot');
		for (let y = 4; y <= 6; y++) m.box([4, y, 5], [6, y, 7], y % 2 ? 'sock-red' : 'sock-white');
		m.box([4, 7, 5], [6, 8, 7], 'skin');
		m.box([4, 9, 4], [7, 13, 8], 'shorts');
		m.box([4, 9, 4], [7, 9, 8], 'shorts-dark');
		// левая нога: бедро вперёд, голень вниз
		m.box([9, 11, 5], [12, 14, 11], 'shorts');
		m.box([9, 11, 11], [12, 11, 11], 'shorts-dark');
		m.box([9, 11, 12], [11, 13, 13], 'skin');
		m.box([9, 9, 12], [11, 10, 14], 'skin');
		m.box([9, 7, 12], [11, 8, 14], 'sock-red');
		m.set([10, 8, 15], 'sock-white');
		m.box([9, 8, 12], [11, 8, 14], 'sock-white');
		m.box([9, 5, 12], [12, 6, 16], 'boot');
		m.box([9, 5, 12], [12, 5, 16], 'sole');
		// таз и кушак
		m.box([4, 13, 4], [12, 14, 9], 'shorts');
		m.box([3, 15, 4], [12, 16, 9], 'sash');
		m.box([3, 15, 4], [12, 15, 9], 'sash-dark');
		m.box([12, 14, 9], [13, 16, 10], 'sash');
		// торс: футболка, жилет нараспашку
		fillEmpty(m, [8, 19.5, 6.5], [4.8, 4.2, 2.8], 'tee');
		m.box([4, 17, 4], [11, 22, 9], 'tee');
		recolor(m, [0, 17, 0], [15, 24, 16], 'tee', (x, _y, z) =>
			z <= 7 || x <= 4 || x >= 11 ? 'vest' : null,
		);
		recolor(m, [0, 17, 0], [15, 24, 16], 'vest', (x, y, z) =>
			(x === 5 || x === 10) && z >= 8 && y % 2 === 1 && y < 23
				? 'button'
				: z <= 5 && y < 19
					? 'vest-dark'
					: null,
		);
		m.box([3, 21, 4], [12, 22, 8], 'vest');
		m.box([7, 23, 6], [8, 23, 7], 'skin');
	});

	const coat = model({ size: [20, 18, 6], palette: P, pivot: [10, 17.5, 4] }, (m) => {
		for (let y = 0; y <= 15; y++) {
			const half = 7 + Math.round((15 - y) * 0.18);
			for (let x = 10 - half; x < 10 + half; x++) {
				const edge = x === 10 - half || x === 10 + half - 1 || y === 0;
				m.set([x, y, 2], edge ? 'trim' : 'coat');
				m.set([x, y, 3], 'lining');
			}
		}
		// поднятый воротник и погоны
		m.box([3, 15, 2], [16, 17, 5], 'coat');
		m.box([3, 17, 3], [16, 17, 5], 'trim');
		m.box([2, 15, 2], [4, 16, 4], 'trim');
		m.box([15, 15, 2], [17, 16, 4], 'trim');
		// пустые рукава болтаются по бокам
		m.box([1, 4, 2], [3, 14, 4], 'coat');
		m.box([16, 4, 2], [18, 14, 4], 'coat');
		m.box([1, 4, 2], [3, 5, 4], 'trim');
		m.box([16, 4, 2], [18, 5, 4], 'trim');
		m.shade([0, 0, 0], [19, 17, 5], ['coat-dark', 'coat'], {
			only: 'coat',
			scale: 3,
			speckle: 0.1,
		});
	});

	const armR = arm({
		len: 11,
		sleeve: 'tee',
		sleeveLen: 3,
		cuff: 'wrap',
		palette: P,
		extra: (m) => {
			m.box([1, 4, 1], [3, 5, 3], 'wrap');
			// указательный палец
			m.set([2, 0, 4], 'skin');
		},
	});
	const armL = arm({ len: 10, sleeve: 'tee', sleeveLen: 3, palette: P });
	const sashTail = model({ size: [3, 8, 3], palette: P, pivot: [1.5, 7.5, 1.5] }, (m) => {
		m.box([1, 2, 1], [1, 7, 1], 'sash');
		m.box([0, 0, 1], [1, 2, 1], 'sash-dark');
	});

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [8, 24, 6.5] },
			coat: { model: coat, parent: 'body', at: [8, 23, 4] },
			armR: { model: armR, parent: 'body', at: [2.5, 22.5, 6.5] },
			armL: { model: armL, parent: 'body', at: [13.5, 22.5, 6.5] },
			sash: { model: sashTail, parent: 'body', at: [13, 15, 10] },
		},
	});
}

export const captainPose = limbs({
	parts: {
		armR: ({ t }) => [-118 + 3 * wave(t, 3.3), 8, -12],
		armL: () => [8, 0, 32],
		head: ({ t }) => [-6, -10 + 3 * wave(t, 6), 0],
		coat: ({ t }) => [22 + 8 * wave(t, 1.3) + 4 * wave(t, 0.47, 1), 0, 6 * wave(t, 2.1)],
		sash: ({ t }) => [-30 + 12 * wave(t, 0.6), 0, 30 + 10 * wave(t, 0.9)],
	},
	replace: true,
});

// =============================================================================================
// Мечница Исико — прислонилась к грот-мачте, руки скрещены, глаза закрыты. Смоляной хвост на
// красном шнуре, сливовая хакама, длинный нодати за спиной, багровый шарф по ветру.
// =============================================================================================

export function swordswoman(): Rig {
	const P: Palette = {
		skin: { color: '#d9a07a', vary: 0.03 },
		'skin-shade': { color: '#b98260', vary: 0.03 },
		iris: { color: '#7a2e3a', vary: 0 },
		brow: { color: '#141224', vary: 0 },
		hair: { color: '#1e1a2e', vary: 0.06 },
		'hair-light': { color: '#3c3766', vary: 0.06 },
		scar: { color: '#a8665a', vary: 0 },
		cord: { color: '#d8282f', vary: 0 },
		kosode: { color: '#f1ede4', vary: 0.04 },
		'kosode-shade': { color: '#d6d0c2', vary: 0.04 },
		collar: { color: '#2b2440', vary: 0.03 },
		hakama: { color: '#5b2a5e', vary: 0.06 },
		'hakama-dark': { color: '#40193f', vary: 0.06 },
		obi: { color: '#1b1820', vary: 0.04 },
		gold: { color: '#e3b041', vary: 0.04 },
		tabi: { color: '#f5f2ea', vary: 0 },
		geta: { color: '#9b6b3f', vary: 0.06 },
		saya: { color: '#3a1218', vary: 0.04 },
		'saya-band': { color: '#c99a3a', vary: 0.04 },
		tsuka: { color: '#efe3c4', vary: 0.03 },
		'tsuka-dark': { color: '#2a2030', vary: 0 },
		scarf: { color: '#b3122b', vary: 0.05 },
		'scarf-dark': { color: '#7d0c1f', vary: 0.05 },
	};

	const hd = head({
		W: 10,
		H: 10,
		D: 9,
		pad: [2, 2, 4, 3, 2],
		palette: P,
		face: { eyeY: 4, eyes: 'closed', mouth: 'flat', mouthY: 1, brows: 'flat' },
		// длинная чёлка закрывает правый глаз
		hair: { fringe: (x) => (x <= 3 ? 4 : x <= 4 ? 6 : 8), nape: 2, puff: 1.1 },
		extra: (m, f) => {
			m.shade([0, 0, 0], [14, 13, 13], ['hair', 'hair-light'], {
				only: 'hair',
				scale: 2,
				speckle: 0.1,
			});
			// тонкий шрам через переносицу
			paintFront(m, f, f.c0 - 1, f.oy + 4, 'scar');
			paintFront(m, f, f.c0, f.oy + 3, 'scar');
			paintFront(m, f, f.c1, f.oy + 3, 'scar');
			paintFront(m, f, f.c1 + 1, f.oy + 2, 'scar');
			// узел хвоста на макушке-затылке
			m.box([f.c0, f.oy + f.H - 1, f.oz - 1], [f.c1, f.oy + f.H, f.oz], 'cord');
			// серьга-кольцо
			m.set([f.ox + f.W, f.oy + 2, f.oz + 4], 'gold');
		},
	});

	const body = model({ size: [21, 42, 15], palette: P, pivot: [10, 0, 7] }, (m) => {
		// гэта и таби
		for (const x0 of [6, 11]) {
			m.box([x0, 0, 6], [x0 + 3, 0, 6], 'geta');
			m.box([x0, 0, 10], [x0 + 3, 0, 10], 'geta');
			m.box([x0, 1, 5], [x0 + 3, 1, 11], 'geta');
			m.box([x0, 2, 6], [x0 + 3, 3, 10], 'tabi');
		}
		// хакама расширяется книзу, складки
		for (let y = 3; y <= 16; y++) {
			const hw = 4.6 + (16 - y) * 0.2;
			const hz = 2.6 + (16 - y) * 0.09;
			for (let z = Math.round(7.5 - hz); z <= Math.round(7.5 + hz); z++) {
				for (let x = Math.round(10 - hw); x <= Math.round(10 + hw); x++) {
					const pleat = (x + 20) % 3 === 0;
					const split = y < 9 && (x === 10 || x === 9) && z > 9;
					if (split) continue;
					m.set([x, y, z], pleat ? 'hakama-dark' : 'hakama');
				}
			}
		}
		// оби с золотым шнуром
		m.box([5, 16, 4], [15, 18, 11], 'obi');
		m.box([5, 17, 11], [15, 17, 11], 'gold');
		m.box([11, 16, 12], [12, 18, 12], 'gold');
		// торс-косодэ с тёмным запахом
		fillEmpty(m, [10, 23, 7.5], [5, 5.5, 3.2], 'kosode');
		m.box([6, 19, 5], [14, 27, 10], 'kosode');
		for (let y = 19; y <= 27; y++) {
			const off = Math.max(0, Math.round((27 - y) / 3));
			m.set([10 - off, y, 10], 'collar');
			m.set([10 + off, y, 10], 'collar');
			if (off > 0) for (let x = 10 - off + 1; x < 10 + off; x++) m.set([x, y, 10], 'skin');
		}
		// скрещённые руки и широкие рукава
		m.box([4, 20, 6], [6, 27, 10], 'kosode');
		m.box([14, 20, 6], [16, 27, 10], 'kosode');
		m.box([5, 21, 11], [15, 22, 12], 'kosode');
		m.box([6, 22, 12], [14, 23, 13], 'kosode-shade');
		m.box([4, 22, 12], [5, 23, 12], 'skin');
		m.box([15, 20, 12], [16, 21, 12], 'skin');
		m.box([3, 15, 7], [6, 21, 11], 'kosode');
		m.box([14, 15, 7], [17, 21, 11], 'kosode');
		m.box([3, 15, 7], [6, 15, 11], 'kosode-shade');
		m.box([14, 15, 7], [17, 15, 11], 'kosode-shade');
		// шея и шарф
		m.box([9, 28, 7], [11, 28, 8], 'skin');
		m.box([7, 27, 5], [13, 28, 11], 'scarf');
		m.box([7, 27, 5], [13, 27, 11], 'scarf-dark');
		// нодати за спиной: ножны по диагонали, рукоять над правым плечом
		m.curve(
			[
				[16, 5, 3],
				[10, 20, 3],
				[5, 33, 3],
			],
			'saya',
			{ radius: 1 },
		);
		for (const t of [0.15, 0.5, 0.8]) {
			const p: Vec3 = [Math.round(16 - 11 * t), Math.round(5 + 28 * t), 3];
			m.box([p[0] - 1, p[1], 2], [p[0] + 1, p[1], 4], 'saya-band');
		}
		m.box([2, 33, 1], [7, 34, 5], 'gold');
		for (let i = 0; i < 7; i++) {
			const x = 4 - Math.floor(i / 3);
			m.box([x, 35 + i, 2], [x + 1, 35 + i, 4], i % 2 ? 'tsuka' : 'tsuka-dark');
		}
		m.box([2, 41, 2], [3, 41, 4], 'gold');
		// вакидзаси у левого бедра
		m.curve(
			[
				[15, 17, 11],
				[18, 12, 8],
			],
			'saya',
			{ radius: 0.7 },
		);
		m.box([14, 17, 11], [15, 19, 12], 'tsuka');
	});

	const tail = model({ size: [7, 20, 7], palette: P, pivot: [3.5, 19.5, 3.5] }, (m) => {
		m.box([2, 18, 2], [4, 19, 4], 'cord');
		for (let y = 0; y < 18; y++) {
			const r = 1.2 + 1.4 * Math.sin((Math.PI * (y + 2)) / 22);
			fillEmpty(m, [3.5, y + 0.5, 3.5], [r, 0.6, r], y % 4 === 0 ? 'hair-light' : 'hair');
		}
	});
	const scarf = model({ size: [5, 3, 18], palette: P, pivot: [2.5, 2.5, 0.5] }, (m) => {
		for (let z = 0; z < 18; z++) {
			const y = 2 - Math.floor(z / 9);
			const w = z > 14 ? 1 : 2;
			m.box([2 - w + 1, y, z], [2 + w - 1, y, z], z % 5 === 4 ? 'scarf-dark' : 'scarf');
		}
	});

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [10, 29, 7.5] },
			tail: { model: tail, parent: 'head', at: [7, 12, 2.5] },
			scarf: { model: scarf, parent: 'body', at: [12, 27, 4] },
		},
	});
}

export const swordswomanPose = limbs({
	parts: {
		body: () => [-6, 0, 0],
		head: ({ t }) => [4, 12, 5 + 1.5 * wave(t, 5)],
		tail: ({ t }) => [20 + 10 * wave(t, 1.1), 50 + 8 * wave(t, 0.8, 1), 6 * wave(t, 0.6)],
		scarf: ({ t }) => [-10 + 14 * wave(t, 0.7), 140 + 14 * wave(t, 1.3), 8 * wave(t, 0.45)],
	},
	replace: true,
});

// =============================================================================================
// Штурман Пелл — склонился над картой. Бирюзовые кудри, круглые латунные очки, карандаш за
// ухом, горчичный дождевик с закатанными рукавами, сумка со свитками, компас на шее.
// =============================================================================================

export function navigator(): Rig {
	const P: Palette = {
		skin: { color: '#f6d3b3', vary: 0.03 },
		'skin-shade': { color: '#e0b18d', vary: 0.03 },
		iris: { color: '#2f6fd0', vary: 0 },
		brow: { color: '#1c6b63', vary: 0 },
		hair: { color: '#2fa59a', vary: 0.08 },
		'hair-light': { color: '#5fd0c0', vary: 0.06 },
		'hair-dark': { color: '#1f7a72', vary: 0.06 },
		freckle: { color: '#d39a74', vary: 0 },
		brass: { color: '#d4a23c', vary: 0.05 },
		pencil: { color: '#f2c94c', vary: 0 },
		eraser: { color: '#f08aa0', vary: 0 },
		coat: { color: '#e2a92b', vary: 0.06 },
		'coat-dark': { color: '#b9821a', vary: 0.06 },
		toggle: { color: '#6b4226', vary: 0 },
		stripe: { color: '#253a73', vary: 0 },
		shirt: { color: '#f5f1e6', vary: 0 },
		pants: { color: '#1f5a5e', vary: 0.06 },
		shoe: { color: '#d8333a', vary: 0.04 },
		sole: { color: '#f3efe6', vary: 0 },
		satchel: { color: '#7b4a2a', vary: 0.06 },
		parchment: { color: '#efdcae', vary: 0.04 },
	};

	const hd = head({
		W: 10,
		H: 10,
		D: 9,
		pad: [3, 3, 4, 3, 3],
		palette: P,
		face: { eyeY: 4, eyes: 'soft', mouth: 'o', mouthY: 1, brows: 'worried', freckles: true },
		hair: { fringe: jagged(8, 1, 2), nape: 3, puff: 1.4 },
		extra: (m, f) => {
			m.shade([0, 0, 0], [16, 13, 14], ['hair-dark', 'hair', 'hair-light'], {
				only: 'hair',
				scale: 1.6,
				speckle: 0.25,
			});
			// круглые очки: оправы перед глазами
			const ez = f.oz + f.D;
			for (const x0 of [f.c0 - 3, f.c1]) {
				for (const [dx, dy] of [
					[1, -1],
					[2, -1],
					[0, 0],
					[3, 0],
					[0, 1],
					[3, 1],
					[1, 2],
					[2, 2],
				]) {
					m.set([x0 + dx, f.oy + 4 + dy, ez], 'brass');
				}
			}
			m.box([f.c0, f.oy + 5, ez], [f.c1, f.oy + 5, ez], 'brass');
			// карандаш за правым ухом
			m.box([f.ox - 2, f.oy + 5, f.oz + 3], [f.ox - 2, f.oy + 5, f.oz + 7], 'pencil');
			m.set([f.ox - 2, f.oy + 5, f.oz + 2], 'eraser');
		},
	});

	const body = model({ size: [16, 22, 15], palette: P, pivot: [8, 0, 7] }, (m) => {
		for (const x0 of [4, 9]) {
			m.box([x0, 0, 5], [x0 + 2, 0, 10], 'sole');
			m.box([x0, 1, 5], [x0 + 2, 2, 10], 'shoe');
			m.box([x0, 3, 6], [x0 + 2, 8, 8], 'pants');
		}
		// дождевик: подол-колокол, тогглы, отложенный капюшон
		for (let y = 6; y <= 19; y++) {
			const hw = y < 10 ? 5.2 + (10 - y) * 0.35 : 4.6;
			const hz = y < 10 ? 3 + (10 - y) * 0.2 : 2.8;
			fillEmpty(m, [8, y + 0.5, 7.5], [hw, 0.6, hz], 'coat');
		}
		m.box([4, 17, 5], [11, 19, 10], 'coat');
		m.box([3, 18, 5], [12, 19, 9], 'coat');
		m.box([5, 19, 2], [10, 21, 5], 'coat-dark');
		for (let y = 7; y <= 16; y += 3) m.set([8, y, 11], 'toggle');
		m.box([8, 6, 11], [8, 16, 11], 'coat-dark');
		// полосатая рубашка в вырезе
		for (let y = 16; y <= 19; y++) m.box([7, y, 10], [9, y, 10], y % 2 ? 'stripe' : 'shirt');
		m.box([7, 20, 7], [8, 20, 8], 'skin');
		// компас на шнурке
		m.box([9, 14, 11], [10, 15, 11], 'brass');
		// ремень сумки по диагонали и сумка на правом бедре со свитком
		for (let i = 0; i <= 9; i++) {
			const x = 11 - i;
			const y = 19 - i;
			const z = m.get([x, y, 11]) ? 12 : m.get([x, y, 10]) ? 11 : 10;
			m.set([x, y, z], 'satchel');
		}
		m.box([1, 8, 6], [3, 12, 10], 'satchel');
		m.box([1, 12, 6], [3, 12, 10], 'toggle');
		m.box([2, 13, 7], [2, 16, 8], 'parchment');
		m.shade([0, 0, 0], [15, 21, 14], ['coat-dark', 'coat', 'coat'], {
			only: 'coat',
			scale: 3,
			speckle: 0.1,
		});
	});

	const sleeve = (P2: Palette) =>
		arm({ len: 10, sleeve: 'coat', sleeveLen: 5, cuff: 'coat-dark', palette: P2 });

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [8, 21, 6.5] },
			armR: { model: sleeve(P), parent: 'body', at: [2.5, 19.5, 7] },
			armL: { model: sleeve(P), parent: 'body', at: [13.5, 19.5, 7] },
		},
	});
}

export const navigatorPose = limbs({
	parts: {
		body: () => [10, 0, 0],
		head: ({ t }) => [18 + 4 * wave(t, 4), 8 * wave(t, 7), 6],
		armR: ({ t }) => [-52 + 4 * wave(t, 3), 0, -6],
		armL: ({ t }) => [-46 + 6 * wave(t, 2.3, 1), 0, 10],
	},
	replace: true,
});

// =============================================================================================
// Кок Гумбо — у плиты подбрасывает вок, второй рукой машет поварёшкой. Колпак набекрень,
// усы-руль, оранжевый шейный платок, полосатый фартук, круглый живот.
// =============================================================================================

export function cook(): Rig {
	const P: Palette = {
		skin: { color: '#c98a5c', vary: 0.03 },
		'skin-shade': { color: '#a86e46', vary: 0.03 },
		iris: { color: '#4a2a14', vary: 0 },
		brow: { color: '#1a1414', vary: 0 },
		stache: { color: '#1a1414', vary: 0.04 },
		chef: { color: '#fbf8f2', vary: 0.03 },
		'chef-shade': { color: '#e3ddd0', vary: 0.03 },
		button: { color: '#d8282f', vary: 0 },
		'apron-blue': { color: '#2f6fb3', vary: 0.03 },
		'apron-white': { color: '#f2f0ea', vary: 0.03 },
		kerchief: { color: '#f08a24', vary: 0.04 },
		pants: { color: '#33333d', vary: 0.05 },
		clog: { color: '#1d1a1a', vary: 0.04 },
		gold: { color: '#e3b041', vary: 0.04 },
		iron: { color: '#2c2d33', vary: 0.05 },
		'iron-light': { color: '#4a4c55', vary: 0.05 },
		handle: { color: '#7b4a2a', vary: 0.05 },
		steel: { color: '#c8ccd2', vary: 0.04 },
	};

	const hd = head({
		W: 12,
		H: 11,
		D: 10,
		pad: [2, 2, 13, 2, 3],
		palette: P,
		face: { eyeY: 5, eyes: 'happy', mouth: 'laugh', mouthY: 1, brows: 'up', blush: true },
		hair: { fringe: () => 9, nape: 6, puff: 0.6, mat: 'stache' },
		extra: (m, f) => {
			// усы-руль: под носом, концы закручены вверх
			const y = f.oy + 3;
			const lc = f.c0;
			const rc = f.c1;
			for (let x = lc - 3; x <= rc + 3; x++) paintFront(m, f, x, y, 'stache');
			for (const s of [-1, 1]) {
				const x = s < 0 ? lc - 4 : rc + 4;
				const z = f.oz + f.D - 2;
				m.set([x, y, z], 'stache');
				m.set([x + s, y + 1, z], 'stache');
				m.set([x + s, y + 2, z - 1], 'stache');
				m.set([x, y + 2, z - 1], 'stache');
			}
			// колпак набекрень: ободок и пышная тулья со складками
			const by = f.oy + 8;
			for (let yy = by; yy <= by + 2; yy++) {
				for (let z = f.oz - 1; z <= f.oz + f.D; z++) {
					for (let x = f.ox - 1; x <= f.ox + f.W; x++) {
						const nx = (x + 0.5 - (f.ox + f.W / 2)) / (f.W / 2 + 0.6);
						const nz = (z + 0.5 - (f.oz + f.D / 2)) / (f.D / 2 + 0.6);
						if (nx * nx + nz * nz <= 1) m.set([x, yy, z], 'chef');
					}
				}
			}
			for (let yy = by + 3; yy <= by + 12; yy++) {
				const k = (yy - by - 3) / 9;
				const r = 6.3 + 1.6 * Math.sin(Math.PI * k * 0.9);
				const cx = f.ox + f.W / 2 + k * 1.6;
				const cz = f.oz + f.D / 2 - k * 0.8;
				for (let z = 0; z < 15; z++) {
					for (let x = 0; x < 16; x++) {
						const d = Math.hypot(x + 0.5 - cx, (z + 0.5 - cz) * 1.1);
						if (d > r || (yy === by + 12 && d > r - 2)) continue;
						const pleat = Math.round(Math.atan2(z + 0.5 - cz, x + 0.5 - cx) * 2.5) % 2 === 0;
						m.set([x, yy, z], pleat ? 'chef-shade' : 'chef');
					}
				}
			}
			m.set([f.ox + f.W, f.oy + 3, f.oz + 5], 'gold');
		},
	});

	const body = model({ size: [22, 26, 19], palette: P, pivot: [11, 0, 8] }, (m) => {
		for (const x0 of [6, 12]) {
			m.box([x0, 0, 6], [x0 + 3, 1, 12], 'clog');
			m.box([x0, 2, 7], [x0 + 3, 8, 10], 'pants');
		}
		// живот, грудь, плечи
		fillEmpty(m, [11, 14, 9], [8, 7.5, 7], 'chef');
		m.box([4, 17, 5], [17, 22, 12], 'chef');
		m.box([3, 20, 6], [18, 22, 11], 'chef');
		// фартук в полоску на животе
		recolor(m, [0, 7, 11], [21, 16, 18], 'chef', (x) =>
			(x >> 1) % 2 ? 'apron-blue' : 'apron-white',
		);
		m.box([4, 16, 12], [17, 16, 16], 'apron-blue');
		recolor(m, [0, 16, 0], [21, 16, 18], 'chef', () => 'apron-blue');
		// двубортные пуговицы
		for (const y of [17, 19, 21]) {
			for (const x of [8, 13]) {
				for (let z = 18; z >= 0; z--) {
					if (m.get([x, y, z])) {
						m.set([x, y, z], 'button');
						break;
					}
				}
			}
		}
		// шейный платок с узлом
		m.box([7, 23, 6], [14, 24, 12], 'kerchief');
		m.box([10, 21, 13], [11, 23, 13], 'kerchief');
		m.box([9, 24, 8], [12, 24, 10], 'skin');
	});

	// Правая рука держит вок, левая — поварёшку (длинная модель вниз за кистью).
	const armR = arm({ len: 11, w: 4, sleeve: 'chef', sleeveLen: 5, cuff: 'chef-shade', palette: P });
	const armL = arm({
		len: 11,
		w: 4,
		sleeve: 'chef',
		sleeveLen: 5,
		cuff: 'chef-shade',
		palette: P,
		grow: [2, 9, 2],
		extra: (m) => {
			// поварёшка торчит из кулака вниз (при поднятой руке — вверх)
			m.box([2, 1, 2], [3, 9, 3], 'steel');
			fillEmpty(m, [3, 1.5, 3], [2.6, 1.5, 2.6], 'steel');
		},
	});

	const wok = model({ size: [11, 4, 15], palette: P, pivot: [5.5, 1.5, 0.5] }, (m) => {
		m.box([5, 2, 0], [5, 2, 4], 'handle');
		for (let z = 4; z < 15; z++) {
			for (let x = 0; x < 11; x++) {
				const d = Math.hypot(x + 0.5 - 5.5, z + 0.5 - 9.5);
				if (d > 5.3) continue;
				const y = d > 4.2 ? 2 : d > 2.6 ? 1 : 0;
				m.set([x, y, z], d > 4.2 ? 'iron-light' : 'iron');
				if (y > 0) m.set([x, y - 1, z], 'iron');
			}
		}
	});

	// Летящая еда: креветки, перец, лапша — дугой над воком (pivot — центр вока).
	const food = model(
		{
			size: [12, 16, 12],
			palette: {
				shrimp: { color: '#ff8a5c', vary: 0.05 },
				'shrimp-tail': { color: '#e8502c', vary: 0 },
				pepper: { color: '#3fb34f', vary: 0.05 },
				'pepper-red': { color: '#e23a2e', vary: 0.05 },
				noodle: { color: '#f6d77a', vary: 0.04 },
			},
			pivot: [6, 0, 6],
		},
		(m) => {
			m.box([3, 12, 5], [5, 12, 5], 'shrimp');
			m.set([5, 13, 5], 'shrimp');
			m.set([2, 12, 5], 'shrimp-tail');
			m.box([8, 10, 7], [9, 10, 8], 'pepper');
			m.box([5, 14, 8], [5, 14, 9], 'pepper-red');
			m.curve(
				[
					[3, 9, 7],
					[6, 11, 6],
					[8, 13, 4],
				],
				'noodle',
			);
			m.curve(
				[
					[4, 8, 4],
					[6, 10, 3],
				],
				'noodle',
			);
			m.set([9, 13, 3], 'shrimp');
			m.set([8, 13, 3], 'shrimp');
		},
	);

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [11, 25, 8.5] },
			armR: { model: armR, parent: 'body', at: [1.5, 22.5, 8.5] },
			armL: { model: armL, parent: 'body', at: [20.5, 22.5, 8.5] },
			wok: { model: wok, parent: 'armR', at: [3, 1, 3] },
			food: { model: food, parent: 'wok', at: [5.5, 1, 9.5] },
		},
	});
}

/** Бросок вока: рука вперёд, вок держится горизонтально и подкидывает еду. */
export const cookPose = limbs({
	parts: {
		armR: ({ t }) => {
			const toss = Math.max(0, Math.sin((TAU * t) / 1.4)) ** 3;
			return [-62 - 14 * toss, -20, -12];
		},
		wok: ({ t }) => {
			const toss = Math.max(0, Math.sin((TAU * t) / 1.4)) ** 3;
			return [62 + 14 * toss - 16 * toss, 20, 12];
		},
		food: ({ t }) => {
			const k = (((t / 1.4) % 1) + 1) % 1;
			return [-40 + 80 * k, 0, 15 * Math.sin(TAU * k)];
		},
		armL: ({ t }) => [-10 + 10 * wave(t, 1.4), 0, 150 + 12 * wave(t, 0.7)],
		head: ({ t }) => [-8 + 4 * wave(t, 1.4), -14, 4 * wave(t, 0.7)],
		body: ({ t }) => [0, 0, 2 * wave(t, 1.4)],
	},
	replace: true,
});

// =============================================================================================
// Выдра Пип — юнга экипажа: сидит на ящике у борта с удочкой. Красная вязаная шапочка,
// голубой шейный платок, плоский хвост-весло.
// =============================================================================================

export function otter(): Rig {
	const P: Palette = {
		fur: { color: '#7a4f2e', vary: 0.1 },
		'fur-dark': { color: '#55361f', vary: 0.08 },
		'fur-light': { color: '#e8d2ad', vary: 0.06 },
		nose: { color: '#1a1214', vary: 0 },
		eye: { color: '#120c10', vary: 0 },
		shine: { color: '#ffffff', emissive: 0.2, vary: 0 },
		whisker: { color: '#f2ece0', vary: 0 },
		beanie: { color: '#d8282f', vary: 0.05 },
		'beanie-rib': { color: '#a31b24', vary: 0.04 },
		pom: { color: '#f5f1e6', vary: 0.05 },
		kerchief: { color: '#4fa6e0', vary: 0.04 },
		blush: { color: '#f08a94', vary: 0 },
	};
	const body = model({ size: [13, 12, 13], palette: P, pivot: [6.5, 0, 6.5] }, (m) => {
		fillEmpty(m, [6.5, 3.5, 6], [5.4, 3.6, 5.4], 'fur');
		fillEmpty(m, [6.5, 7.5, 6.5], [4.4, 4.2, 4], 'fur');
		// светлое брюшко
		recolor(m, [3, 2, 8], [10, 11, 12], 'fur', (x, y, z) =>
			Math.hypot(x - 6, (y - 6) * 0.6) < 3.6 && z >= 8 ? 'fur-light' : null,
		);
		// задние лапки впереди
		m.box([2, 0, 10], [4, 1, 12], 'fur-dark');
		m.box([9, 0, 10], [11, 1, 12], 'fur-dark');
		// шейный платок
		for (let z = 2; z <= 11; z++) {
			for (let x = 2; x <= 11; x++) {
				if (m.get([x, 10, z]) && Math.hypot(x - 6.5, z - 6.5) > 2.6) m.set([x, 10, z], 'kerchief');
			}
		}
		m.box([6, 8, 11], [7, 9, 11], 'kerchief');
		// передние лапки держат удилище у груди
		m.box([4, 7, 10], [5, 8, 11], 'fur-dark');
		m.box([8, 7, 10], [9, 8, 11], 'fur-dark');
	});
	const hd = model({ size: [11, 12, 10], palette: P, pivot: [5.5, 0, 4.5] }, (m) => {
		fillEmpty(m, [5.5, 3.8, 4.8], [4.4, 3.8, 4], 'fur');
		// морда: светлая, нос-пуговка, глаза-бусины, усы
		fillEmpty(m, [5.5, 2.4, 8], [2.8, 2, 1.6], 'fur-light');
		m.box([5, 3, 9], [6, 3, 9], 'nose');
		m.set([3, 5, 8], 'eye');
		m.set([8, 5, 8], 'eye');
		m.set([3, 6, 8], 'shine');
		m.set([8, 6, 8], 'shine');
		m.set([2, 3, 7], 'blush');
		m.set([9, 3, 7], 'blush');
		m.box([0, 2, 7], [2, 2, 7], 'whisker');
		m.box([9, 2, 7], [10, 2, 7], 'whisker');
		// ушки
		m.set([1, 7, 4], 'fur-dark');
		m.set([10, 7, 4], 'fur-dark');
		// вязаная шапочка с помпоном
		for (let y = 6; y <= 9; y++) {
			for (let z = 0; z < 10; z++) {
				for (let x = 0; x < 11; x++) {
					const r = 4.2 - (y - 6) * 0.7;
					if (Math.hypot(x + 0.5 - 5.5, z + 0.5 - 4.6) <= r) {
						m.set([x, y, z], y === 6 ? 'beanie-rib' : x % 2 ? 'beanie' : 'beanie-rib');
					}
				}
			}
		}
		m.box([5, 10, 4], [6, 11, 5], 'pom');
	});
	const tail = model({ size: [5, 3, 10], palette: P, pivot: [2.5, 1.5, 9.5] }, (m) => {
		for (let z = 0; z < 10; z++) {
			const w = z < 3 ? 1 : 2;
			m.box([2 - w, 1, z], [2 + w, 1, z], z % 3 === 0 ? 'fur-dark' : 'fur');
		}
		m.box([1, 2, 7], [3, 2, 9], 'fur');
	});
	const rod = model(
		{
			size: [5, 26, 30],
			palette: {
				rod: { color: '#c79a52', vary: 0.04 },
				knot: { color: '#8a6332', vary: 0 },
				reel: { color: '#9aa0a8', vary: 0.04 },
				grip: { color: '#3a2a20', vary: 0 },
			},
			pivot: [2.5, 0.5, 0.5],
		},
		(m) => {
			m.line([2, 0, 0], [2, 25, 29], 'rod');
			for (let i = 4; i < 30; i += 6) {
				const y = Math.round((i * 25) / 29);
				m.set([2, y, i], 'knot');
			}
			m.box([2, 0, 0], [2, 2, 2], 'grip');
			m.box([3, 2, 2], [4, 3, 3], 'reel');
		},
	);

	return rig({
		skeleton: 'custom',
		scale: 0.2,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [6.5, 11, 6.5] },
			tail: { model: tail, parent: 'body', at: [6.5, 1, 1] },
			rod: { model: rod, parent: 'body', at: [6.5, 8, 11] },
		},
	});
}

export const otterPose = limbs({
	parts: {
		head: ({ t }) => [8 + 4 * wave(t, 3), 10 * wave(t, 5), 8 * wave(t, 2.5)],
		tail: ({ t }) => [0, 18 * wave(t, 1.6), 0],
		rod: ({ t }) => [-6 + 1.2 * wave(t, 1.9), 0, 0],
	},
	replace: true,
});

// =============================================================================================
// Впередсмотрящая Тилли — в «вороньем гнезде» с подзорной трубой, машет рукой. Розовые
// хвостики, белая матросская шапочка, тельняшка, синий комбинезон.
// =============================================================================================

export function lookout(): Rig {
	const P: Palette = {
		skin: { color: '#f8d6b8', vary: 0.03 },
		'skin-shade': { color: '#e6b593', vary: 0.03 },
		iris: { color: '#2bb07a', vary: 0 },
		brow: { color: '#d4508f', vary: 0 },
		hair: { color: '#ff7eb6', vary: 0.07 },
		'hair-light': { color: '#ffb0d3', vary: 0.05 },
		freckle: { color: '#e09a80', vary: 0 },
		cap: { color: '#fbfaf5', vary: 0.03 },
		'cap-band': { color: '#2f5fb3', vary: 0 },
		stripe: { color: '#d8282f', vary: 0 },
		shirt: { color: '#fbf8ee', vary: 0 },
		denim: { color: '#2d4f8f', vary: 0.06 },
		brass: { color: '#d4a23c', vary: 0.05 },
		'brass-dark': { color: '#9a7124', vary: 0.05 },
		lens: { color: '#7fd8f0', emissive: 0.4, vary: 0 },
		tie: { color: '#ffd23f', vary: 0 },
	};
	const hd = head({
		W: 10,
		H: 10,
		D: 9,
		pad: [3, 3, 5, 3, 10],
		palette: P,
		face: {
			eyeY: 4,
			eyes: 'bright',
			mouth: 'grin',
			mouthY: 1,
			brows: 'up',
			blush: true,
			freckles: true,
		},
		hair: { fringe: jagged(8, 1, 3, 1), nape: 4, puff: 1.2 },
		extra: (m, f) => {
			// матросская шапочка набекрень
			for (let y = f.oy + 9; y <= f.oy + 12; y++) {
				const r = y === f.oy + 9 ? 4.8 : y === f.oy + 10 ? 4.3 : 3.8;
				for (let z = 0; z < f.oz + f.D + 2; z++) {
					for (let x = 0; x < f.ox + f.W + 3; x++) {
						const d = Math.hypot(x + 0.5 - (f.ox + 6), z + 0.5 - (f.oz + 4.5));
						if (d <= r) m.set([x, y, z], y === f.oy + 9 ? 'cap-band' : 'cap');
					}
				}
			}
			// подзорная труба у правого глаза — смотрит вперёд
			const ex = f.c0 - 1.5;
			const ey = f.oy + 5;
			const ez = f.oz + f.D;
			for (let z = ez; z < ez + 10; z++) {
				const r = z < ez + 3 ? 1.4 : z < ez + 7 ? 1.8 : 2.2;
				for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++) {
					for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++) {
						if (Math.hypot(x + 0.5 - ex - 0.5, y + 0.5 - ey - 0.5) <= r) {
							m.set([x, y, z], z === ez + 3 || z === ez + 7 ? 'brass-dark' : 'brass');
						}
					}
				}
			}
			m.box([Math.floor(ex) - 1, ey - 1, ez + 9], [Math.floor(ex) + 1, ey + 1, ez + 9], 'lens');
		},
	});
	const body = model({ size: [14, 18, 12], palette: P, pivot: [7, 0, 6] }, (m) => {
		for (const x0 of [3, 8]) m.box([x0, 0, 4], [x0 + 2, 6, 7], 'denim');
		m.box([3, 6, 3], [10, 15, 8], 'shirt');
		for (let y = 6; y <= 15; y++) {
			if (y % 2) recolor(m, [0, y, 0], [13, y, 11], 'shirt', () => 'stripe');
		}
		// комбинезон: нагрудник и лямки
		m.box([3, 6, 3], [10, 10, 8], 'denim');
		m.box([4, 11, 8], [9, 13, 8], 'denim');
		m.set([4, 13, 8], 'brass');
		m.set([9, 13, 8], 'brass');
		m.box([4, 14, 8], [4, 15, 8], 'denim');
		m.box([9, 14, 8], [9, 15, 8], 'denim');
		m.box([6, 16, 5], [7, 16, 6], 'skin');
		// шейный бант
		m.box([6, 15, 9], [7, 15, 9], 'tie');
	});
	const pigtail = model({ size: [5, 11, 5], palette: P, pivot: [2.5, 10.5, 2.5] }, (m) => {
		m.box([2, 9, 2], [2, 10, 2], 'tie');
		for (let y = 0; y < 9; y++) {
			const r = 1.1 + 1.3 * Math.sin((Math.PI * (y + 1.5)) / 11);
			fillEmpty(m, [2.5, y + 0.5, 2.5], [r, 0.6, r], y % 3 === 0 ? 'hair-light' : 'hair');
		}
	});
	const sleeve = arm({
		len: 9,
		sleeve: 'shirt',
		sleeveLen: 7,
		palette: P,
		extra: (m) => {
			for (let y = 2; y <= 8; y += 2) m.box([1, y, 1], [3, y, 3], 'stripe');
		},
	});

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [7, 17, 6] },
			pigL: { model: pigtail, parent: 'head', at: [15, 8, 5] },
			pigR: { model: pigtail, parent: 'head', at: [1, 8, 5] },
			armR: { model: sleeve, parent: 'body', at: [1.5, 15.5, 6] },
			armL: { model: sleeve, parent: 'body', at: [12.5, 15.5, 6] },
		},
	});
}

export const lookoutPose = limbs({
	parts: {
		armR: () => [-150, 18, 18],
		armL: ({ t }) => [-10, 0, 150 + 22 * wave(t, 0.55)],
		head: ({ t }) => [-4, 2 * wave(t, 4), 0],
		pigL: ({ t }) => [10 * wave(t, 0.8), 0, 24 + 12 * wave(t, 0.5)],
		pigR: ({ t }) => [10 * wave(t, 0.8, 1), 0, -24 + 12 * wave(t, 0.5, 0.7)],
	},
	replace: true,
});

// =============================================================================================
// Рулевой Бранок — великан за штурвалом. Лысина, рыжая борода в две косы, латунная
// механическая левая рука на заклёпках, татуировка-якорь, кожаный жилет нараспашку.
// =============================================================================================

export function helmsman(): Rig {
	const P: Palette = {
		skin: { color: '#d39370', vary: 0.03 },
		'skin-shade': { color: '#b27554', vary: 0.03 },
		iris: { color: '#3a6b4a', vary: 0 },
		brow: { color: '#c0441c', vary: 0 },
		beard: { color: '#c9471c', vary: 0.07 },
		'beard-light': { color: '#e8702e', vary: 0.06 },
		band: { color: '#d4a23c', vary: 0.04 },
		scar: { color: '#a85f48', vary: 0 },
		vest: { color: '#6b4226', vary: 0.07 },
		'vest-dark': { color: '#4e2f1b', vary: 0.06 },
		sash: { color: '#2f7a4a', vary: 0.05 },
		buckle: { color: '#e0b040', emissive: 0.05, vary: 0 },
		'pants-a': { color: '#7d7f86', vary: 0.04 },
		'pants-b': { color: '#5b5d66', vary: 0.04 },
		boot: { color: '#211c1c', vary: 0.04 },
		cuff: { color: '#7b4a2a', vary: 0.04 },
		tattoo: { color: '#2a6f86', vary: 0 },
		brass: { color: '#c9962f', vary: 0.07 },
		'brass-dark': { color: '#8a6420', vary: 0.06 },
		iron: { color: '#3a3c44', vary: 0.05 },
		rivet: { color: '#f2d27a', vary: 0 },
	};
	const hd = head({
		W: 12,
		H: 11,
		D: 10,
		pad: [2, 2, 1, 2, 3],
		palette: P,
		face: { eyeY: 5, eyes: 'sharp', mouth: 'none', brows: 'angry' },
		extra: (m, f) => {
			// густые брови в два ряда
			for (const x of [f.c0 - 3, f.c0 - 2, f.c0 - 1, f.c1 + 1, f.c1 + 2, f.c1 + 3]) {
				paintFront(m, f, x, f.oy + 7, 'brow');
			}
			// борода закрывает челюсть, щёки и подбородок
			for (let y = f.oy; y <= f.oy + 3; y++) {
				for (let x = f.ox; x < f.ox + f.W; x++) {
					const z = (() => {
						for (let zz = f.oz + f.D + 2; zz >= f.oz; zz--) if (m.get([x, y, zz])) return zz;
						return null;
					})();
					if (z === null) continue;
					const nearMouth = y === f.oy + 3 && x >= f.c0 - 1 && x <= f.c1 + 1;
					if (y === f.oy + 3 && !nearMouth && (x === f.ox + 2 || x === f.ox + f.W - 3)) continue;
					m.set([x, y, z], 'beard');
					m.set([x, y, z + 1], y % 2 ? 'beard-light' : 'beard');
				}
			}
			for (let x = f.ox; x < f.ox + f.W; x++) {
				for (let z = f.oz; z < f.oz + f.D; z++) {
					for (let y = f.oy; y <= f.oy + 4; y++) {
						if (
							m.get([x, y, z]) === 'skin' &&
							(x <= f.ox || x >= f.ox + f.W - 1) &&
							z < f.oz + f.D - 2
						) {
							m.set([x, y, z], 'beard');
						}
					}
				}
			}
			// шрам через левый глаз
			paintFront(m, f, f.c1 + 2, f.oy + 7, 'scar');
			paintFront(m, f, f.c1 + 2, f.oy + 4, 'scar');
			paintFront(m, f, f.c1 + 3, f.oy + 3, 'scar');
			// серьга
			m.set([f.ox - 1, f.oy + 3, f.oz + 5], 'band');
		},
	});
	const body = model({ size: [26, 34, 18], palette: P, pivot: [13, 0, 8] }, (m) => {
		for (const x0 of [6, 15]) {
			m.box([x0, 0, 5], [x0 + 4, 3, 12], 'boot');
			m.box([x0, 4, 5], [x0 + 4, 4, 11], 'cuff');
			for (let y = 5; y <= 14; y++) {
				const bag = y > 9 ? 1 : 0;
				for (let x = x0 - bag; x <= x0 + 4 + bag; x++) {
					m.box([x, y, 5 - bag], [x, y, 11 + bag], x % 2 ? 'pants-a' : 'pants-b');
				}
			}
		}
		m.box([5, 13, 4], [20, 16, 12], 'pants-a');
		// кушак и пряжка
		m.box([4, 16, 3], [21, 18, 13], 'sash');
		m.box([11, 16, 14], [14, 18, 14], 'buckle');
		m.box([12, 17, 14], [13, 17, 14], 'sash');
		// торс: могучая грудь, жилет по бокам и спине
		fillEmpty(m, [12.5, 24, 8], [9.2, 7.5, 5.2], 'skin');
		m.box([4, 19, 4], [21, 29, 12], 'skin');
		m.box([3, 26, 4], [22, 30, 11], 'skin');
		recolor(m, [0, 18, 0], [25, 31, 17], 'skin', (x, _y, z) =>
			z <= 8 || x <= 6 || x >= 19 ? 'vest' : null,
		);
		recolor(m, [0, 18, 0], [25, 31, 17], 'vest', (x, y, z) =>
			z >= 11 && (x === 7 || x === 18) ? 'vest-dark' : (y + x) % 7 === 0 ? 'vest-dark' : null,
		);
		m.box([10, 31, 6], [15, 32, 10], 'skin');
		// борода двумя косами на груди
		for (const x0 of [10, 14]) {
			for (let y = 21; y <= 31; y++) {
				const z = 13 + (y > 28 ? 0 : 0);
				m.box([x0, y, z - 1], [x0 + 1, y, z], y % 3 === 0 ? 'beard-light' : 'beard');
			}
			m.box([x0, 23, 12], [x0 + 1, 23, 14], 'band');
			m.box([x0, 20, 12], [x0 + 1, 20, 13], 'beard-light');
		}
		m.box([9, 29, 11], [16, 32, 14], 'beard');
	});
	const armR = arm({
		len: 14,
		w: 5,
		sleeve: 'skin',
		sleeveLen: 0,
		palette: P,
		extra: (m) => {
			// татуировка-якорь на плече
			m.box([3, 10, 6], [3, 12, 6], 'tattoo');
			m.box([2, 11, 6], [4, 11, 6], 'tattoo');
			m.set([2, 9, 6], 'tattoo');
			m.set([4, 9, 6], 'tattoo');
		},
	});
	const armL = model({ size: [7, 14, 7], palette: P, pivot: [3.5, 13.5, 3.5] }, (m) => {
		// механическая рука: латунные пластины, железные суставы, заклёпки, три пальца
		m.box([1, 9, 1], [5, 13, 5], 'brass');
		m.box([1, 8, 1], [5, 8, 5], 'iron');
		m.box([2, 3, 2], [4, 7, 4], 'brass');
		m.box([1, 4, 1], [5, 6, 5], 'brass-dark');
		m.box([2, 2, 2], [4, 2, 4], 'iron');
		m.box([2, 0, 2], [2, 1, 4], 'brass');
		m.box([4, 0, 2], [4, 1, 4], 'brass');
		m.box([3, 0, 5], [3, 1, 5], 'brass');
		for (const [x, y, z] of [
			[1, 12, 5],
			[5, 12, 5],
			[1, 10, 5],
			[5, 10, 5],
			[3, 11, 6],
			[1, 5, 5],
			[5, 5, 5],
		] as Vec3[]) {
			m.set([x, y, z], 'rivet');
		}
		m.box([0, 11, 2], [0, 12, 4], 'iron');
		m.box([6, 11, 2], [6, 12, 4], 'iron');
	});

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [12.5, 33, 8.5] },
			armR: { model: armR, parent: 'body', at: [1, 30, 8] },
			armL: { model: armL, parent: 'body', at: [24, 30, 8] },
		},
	});
}

export const helmsmanPose = limbs({
	parts: {
		armR: ({ t }) => [-62 + 6 * wave(t, 6), 0, -8 + 4 * wave(t, 6)],
		armL: ({ t }) => [-62 - 6 * wave(t, 6), 0, 8 + 4 * wave(t, 6)],
		head: ({ t }) => [-4, 6 * wave(t, 9), 0],
	},
	replace: true,
});

// =============================================================================================
// Музыкант Старый Фен — сидит на ящике и играет на аккордеоне. Белая борода до пояса,
// круглые фиолетовые очки, вязаная зелёная шапка с помпоном, бордовый латаный сюртук.
// =============================================================================================

export function musician(): Rig {
	const P: Palette = {
		skin: { color: '#e8c3a3', vary: 0.03 },
		'skin-shade': { color: '#c9a080', vary: 0.03 },
		iris: { color: '#5a4a3a', vary: 0 },
		brow: { color: '#f2efe8', vary: 0 },
		beard: { color: '#eeebe4', vary: 0.05 },
		'beard-shade': { color: '#cfcac0', vary: 0.04 },
		lens: { color: '#6a3fa0', emissive: 0.15, vary: 0 },
		frame: { color: '#c9962f', vary: 0 },
		beanie: { color: '#3f8f4a', vary: 0.06 },
		'beanie-rib': { color: '#2e6b37', vary: 0.05 },
		pom: { color: '#f2d24a', vary: 0.05 },
		coat: { color: '#7d2433', vary: 0.06 },
		'coat-dark': { color: '#5a1824', vary: 0.06 },
		patch: { color: '#b88a4a', vary: 0.05 },
		stitch: { color: '#f0e4c8', vary: 0 },
		scarf: { color: '#f2c94c', vary: 0.04 },
		'scarf-b': { color: '#3f8f4a', vary: 0.04 },
		pants: { color: '#4a3f36', vary: 0.05 },
		boot: { color: '#5a3820', vary: 0.05 },
	};
	const hd = head({
		W: 10,
		H: 10,
		D: 9,
		pad: [2, 2, 7, 2, 3],
		palette: P,
		face: { eyeY: 4, eyes: 'happy', mouth: 'none', brows: 'flat', blush: true },
		hair: { fringe: () => 8, nape: 3, puff: 0.8, mat: 'beard' },
		extra: (m, f) => {
			// большой нос, кустистые брови, вислые усы
			const nz = f.oz + f.D;
			m.box([f.c0, f.oy + 3, nz], [f.c1, f.oy + 4, nz + 1], 'skin');
			m.set([f.c0, f.oy + 3, nz + 1], 'skin-shade');
			for (const x of [f.c0 - 3, f.c0 - 2, f.c0 - 1, f.c1 + 1, f.c1 + 2, f.c1 + 3]) {
				paintFront(m, f, x, f.oy + 7, 'beard');
			}
			for (let x = f.c0 - 3; x <= f.c1 + 3; x++) {
				paintFront(m, f, x, f.oy + 2, 'beard');
				paintFront(m, f, x, f.oy + 1, 'beard');
				paintFront(m, f, x, f.oy, 'beard');
			}
			m.set([f.c0 - 3, f.oy + 1, nz - 1], 'beard');
			m.set([f.c1 + 3, f.oy + 1, nz - 1], 'beard');
			// круглые очки на носу
			for (const x0 of [f.c0 - 3, f.c1 + 1]) {
				m.box([x0, f.oy + 4, nz], [x0 + 2, f.oy + 5, nz], 'lens');
				m.set([x0 - (x0 < f.c0 ? 1 : -3), f.oy + 5, nz - 1], 'frame');
			}
			m.box([f.c0, f.oy + 5, nz], [f.c1, f.oy + 5, nz], 'frame');
			// вязаная шапка и помпон
			for (let y = f.oy + 7; y <= f.oy + 13; y++) {
				const r = y <= f.oy + 9 ? 6.2 : 6.2 - (y - f.oy - 9) * 1.1;
				for (let z = 0; z < f.oz + f.D + 3; z++) {
					for (let x = 0; x < f.ox + f.W + 2; x++) {
						const d = Math.hypot(x + 0.5 - (f.ox + 5), (z + 0.5 - (f.oz + 4.5)) * 1.05);
						if (d > r) continue;
						if (y === f.oy + 7 && z > f.oz + f.D - 2) continue;
						m.set([x, y, z], y <= f.oy + 8 ? 'beanie-rib' : x % 2 ? 'beanie' : 'beanie-rib');
					}
				}
			}
			fillEmpty(m, [f.ox + 5, f.oy + 15.5, f.oz + 4.5], [1.8, 1.6, 1.8], 'pom');
		},
	});
	const body = model({ size: [18, 24, 20], palette: P, pivot: [9, 0, 7] }, (m) => {
		// сидит: голени вниз, бёдра вперёд
		for (const x0 of [4, 10]) {
			m.box([x0, 0, 13], [x0 + 3, 2, 18], 'boot');
			m.box([x0, 3, 13], [x0 + 3, 6, 16], 'pants');
			m.box([x0, 6, 6], [x0 + 3, 9, 16], 'pants');
		}
		// сюртук: торс чуть сутулый, полы свисают с ящика сзади
		fillEmpty(m, [9, 14, 8], [6, 6, 4], 'coat');
		m.box([3, 9, 4], [14, 19, 11], 'coat');
		m.box([3, 3, 2], [14, 9, 3], 'coat');
		m.box([3, 3, 2], [14, 3, 3], 'coat-dark');
		m.box([2, 17, 4], [15, 20, 10], 'coat');
		m.shade([0, 0, 0], [17, 23, 19], ['coat-dark', 'coat'], {
			only: 'coat',
			scale: 3,
			speckle: 0.15,
		});
		// заплатка с крупными стежками
		m.box([12, 12, 4], [14, 14, 4], 'patch');
		m.set([13, 15, 4], 'stitch');
		m.set([11, 13, 4], 'stitch');
		// борода до пояса
		for (let y = 12; y <= 21; y++) {
			const hw = 1.5 + (y - 12) * 0.32;
			for (let x = Math.round(9 - hw); x <= Math.round(9 + hw - 1); x++) {
				m.box([x, y, 12], [x, y, 13], (x + y) % 3 ? 'beard' : 'beard-shade');
			}
		}
		// полосатый шарф
		for (let x = 3; x <= 14; x++) m.box([x, 20, 4], [x, 21, 11], x % 2 ? 'scarf' : 'scarf-b');
		m.box([13, 13, 12], [14, 20, 12], 'scarf');
		for (let y = 13; y <= 20; y += 2) m.box([13, y, 12], [14, y, 12], 'scarf-b');
		m.box([7, 22, 6], [10, 22, 9], 'skin');
	});
	const armM = (palette: Palette) =>
		arm({ len: 10, sleeve: 'coat', sleeveLen: 7, cuff: 'coat-dark', palette });

	const accordion = model(
		{
			size: [16, 10, 7],
			palette: {
				bellows: { color: '#c0283a', vary: 0.04 },
				'bellows-dark': { color: '#7a1424', vary: 0.04 },
				gold: { color: '#e3b041', vary: 0.03 },
				keys: { color: '#fbf8ee', vary: 0 },
				'keys-black': { color: '#1a1416', vary: 0 },
				body: { color: '#1f2a44', vary: 0.04 },
				pearl: { color: '#f2ece4', emissive: 0.1, vary: 0 },
			},
			pivot: [8, 0, 3.5],
		},
		(m) => {
			// мехи гармошкой, по бокам корпуса с клавишами и кнопками
			for (let x = 4; x <= 11; x++) m.box([x, 1, 1], [x, 8, 5], x % 2 ? 'bellows' : 'bellows-dark');
			for (let x = 4; x <= 11; x++) m.box([x, 0, 3], [x, 0, 3], 'gold');
			m.box([0, 0, 0], [3, 9, 6], 'body');
			m.box([12, 0, 0], [15, 9, 6], 'body');
			for (let y = 1; y <= 8; y++) m.box([0, y, 6], [1, y, 6], y % 3 === 0 ? 'keys-black' : 'keys');
			for (let y = 2; y <= 8; y += 2) m.set([14, y, 6], 'pearl');
			m.box([0, 9, 0], [3, 9, 6], 'gold');
			m.box([12, 9, 0], [15, 9, 6], 'gold');
		},
	);

	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			body: { model: body },
			head: { model: hd, parent: 'body', at: [9, 23, 7.5] },
			armR: { model: armM(P), parent: 'body', at: [1.5, 19.5, 8] },
			armL: { model: armM(P), parent: 'body', at: [16.5, 19.5, 8] },
			accordion: { model: accordion, parent: 'body', at: [9, 10, 15] },
		},
	});
}

export const musicianPose = limbs({
	parts: {
		armR: ({ t }) => [-40, 0, -22 - 10 * wave(t, 1.6)],
		armL: ({ t }) => [-40, 0, 22 + 10 * wave(t, 1.6)],
		accordion: ({ t }) => [0, 8 * wave(t, 1.6), 4 * wave(t, 3.2)],
		head: ({ t }) => [-6, 10 * wave(t, 3.2), 8 * wave(t, 1.6)],
		body: ({ t }) => [0, 0, 2 * wave(t, 1.6)],
	},
	replace: true,
});
