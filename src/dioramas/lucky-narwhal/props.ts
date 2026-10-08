import { type Model, type ModelBuilder, model, type Rig, rig, type Vec3 } from '#sdk';
import type { Palette } from './kit.ts';

/*
 * Реквизит палубы в мелких вокселях (scale 0.25): бочки, ящики, сундук с кладом, штурманский
 * стол, фонари, пушки, бухты каната, спасательный круг, ведро с уловом, штурвал, флаги, чайки.
 * Pivot у всех — нижний центр (стоят на палубе), у фонарей — кольцо подвеса.
 */

const S = 0.25;

const WOOD: Palette = {
	wood: { color: '#9a6538', vary: 0.1 },
	'wood-light': { color: '#b97d48', vary: 0.1 },
	'wood-dark': { color: '#6e4524', vary: 0.08 },
	hoop: { color: '#3a3a40', vary: 0.05 },
	nail: { color: '#9aa0a8', vary: 0 },
	rope: { color: '#cfae74', vary: 0.08 },
	'rope-dark': { color: '#a8864f', vary: 0.06 },
};

function disc(
	m: ModelBuilder,
	c: [number, number],
	y: number,
	r: number,
	mat: (x: number, z: number) => string,
): void {
	for (let z = Math.floor(c[1] - r); z <= Math.ceil(c[1] + r); z++) {
		for (let x = Math.floor(c[0] - r); x <= Math.ceil(c[0] + r); x++) {
			if (Math.hypot(x + 0.5 - c[0], z + 0.5 - c[1]) <= r) m.set([x, y, z], mat(x, z));
		}
	}
}

/** Бочка: клёпки двух оттенков, пузо, три обруча, крышка с досками. */
export function barrel(opts: { label?: string } = {}): Model {
	return model(
		{
			size: [12, 14, 12],
			scale: S,
			palette: { ...WOOD, label: opts.label ?? '#d8282f' },
		},
		(m) => {
			for (let y = 0; y < 14; y++) {
				const r = 4.6 + 1.1 * Math.sin((Math.PI * (y + 0.5)) / 14);
				const hoop = y === 1 || y === 12 || y === 5 || y === 8;
				disc(m, [6, 6], y, r, (x, z) => {
					if (hoop) return 'hoop';
					const a = Math.atan2(z + 0.5 - 6, x + 0.5 - 6);
					return Math.floor((a + Math.PI) * 2.6) % 2 ? 'wood' : 'wood-light';
				});
			}
			disc(m, [6, 6], 13, 4.4, (x) => (x % 3 === 0 ? 'wood-dark' : 'wood-light'));
			if (opts.label) {
				m.box([5, 6, 11], [6, 7, 11], 'label');
			}
		},
	);
}

/** Ящик: доски, планки по рёбрам, гвозди, верёвочная ручка, клеймо. */
export function crate(opts: { w?: number; h?: number; d?: number; mark?: string } = {}): Model {
	const w = opts.w ?? 12;
	const h = opts.h ?? 10;
	const d = opts.d ?? 12;
	return model(
		{ size: [w, h, d], scale: S, palette: { ...WOOD, mark: opts.mark ?? '#2b2b33' } },
		(m) => {
			for (let y = 0; y < h; y++)
				m.box([0, y, 0], [w - 1, y, d - 1], (y >> 1) % 2 ? 'wood' : 'wood-light');
			for (const [x, z] of [
				[0, 0],
				[w - 1, 0],
				[0, d - 1],
				[w - 1, d - 1],
			]) {
				m.box([x, 0, z], [x, h - 1, z], 'wood-dark');
			}
			m.box([0, h - 1, 0], [w - 1, h - 1, 0], 'wood-dark');
			m.box([0, h - 1, d - 1], [w - 1, h - 1, d - 1], 'wood-dark');
			m.box([0, 0, d - 1], [w - 1, 0, d - 1], 'wood-dark');
			m.set([1, h - 2, d - 1], 'nail');
			m.set([w - 2, h - 2, d - 1], 'nail');
			// клеймо-якорь на передней стенке
			const cx = Math.floor(w / 2);
			m.box([cx, 2, d - 1], [cx, h - 3, d - 1], 'mark');
			m.box([cx - 2, 2, d - 1], [cx + 2, 2, d - 1], 'mark');
			m.box([cx - 1, h - 4, d - 1], [cx + 1, h - 4, d - 1], 'mark');
			// верёвочная ручка сбоку
			m.box([w - 1, h - 4, 4], [w - 1, h - 4, d - 5], 'rope');
		},
	);
}

/** Открытый сундук: окованный, крышка откинута, через край — монеты, камни и жемчуг. */
export function chest(): Model {
	return model(
		{
			size: [16, 16, 14],
			scale: S,
			palette: {
				...WOOD,
				lid: { color: '#7d3a2a', vary: 0.08 },
				iron: { color: '#2e3036', vary: 0.05 },
				gold: { color: '#f2c33c', emissive: 0.25, vary: 0.12 },
				'gold-dark': { color: '#c99420', emissive: 0.15, vary: 0.1 },
				ruby: { color: '#e0213a', emissive: 0.6, vary: 0 },
				emerald: { color: '#2bd17a', emissive: 0.6, vary: 0 },
				sapphire: { color: '#3a7bff', emissive: 0.6, vary: 0 },
				pearl: { color: '#fbf6ee', emissive: 0.15, vary: 0 },
				lock: { color: '#e3b041', vary: 0 },
			},
		},
		(m) => {
			// короб
			m.box([1, 0, 4], [14, 7, 12], 'lid');
			m.box([2, 1, 5], [13, 7, 11], 'air');
			for (const x of [1, 5, 10, 14]) m.box([x, 0, 4], [x, 7, 4], 'iron');
			for (const x of [1, 5, 10, 14]) m.box([x, 0, 12], [x, 7, 12], 'iron');
			m.box([1, 0, 12], [14, 0, 12], 'iron');
			m.box([7, 4, 12], [8, 6, 13], 'lock');
			// откинутая крышка (выпуклая) за коробом
			for (let y = 7; y <= 15; y++) {
				const z = 3 - Math.round(Math.sin(((y - 7) / 8) * Math.PI) * 2);
				m.box([1, y, z], [14, y, z + 1], 'lid');
				m.set([1, y, z], 'iron');
				m.set([14, y, z], 'iron');
				m.set([5, y, z], 'iron');
				m.set([10, y, z], 'iron');
			}
			// горка монет
			for (let z = 5; z <= 11; z++) {
				for (let x = 2; x <= 13; x++) {
					const h = 8 + Math.round(2.4 * Math.cos((x - 7.5) / 4) * Math.cos((z - 8) / 3.5));
					for (let y = 1; y <= h; y++)
						m.set([x, y, z], (x * 3 + z * 5 + y) % 4 ? 'gold' : 'gold-dark');
				}
			}
			// рассыпанные монеты у сундука
			for (const [x, z] of [
				[0, 13],
				[3, 13],
				[12, 13],
				[15, 11],
				[14, 13],
				[6, 13],
			]) {
				m.set([x, 0, z], 'gold');
			}
			m.set([9, 0, 13], 'gold-dark');
			m.set([9, 1, 13], 'gold');
			m.set([5, 11, 8], 'ruby');
			m.set([10, 10, 7], 'emerald');
			m.set([8, 11, 10], 'sapphire');
			m.set([3, 10, 6], 'ruby');
			// нитка жемчуга свисает через край
			for (let i = 0; i < 6; i++)
				m.set([11 - i, 7 - Math.round(Math.sin((i / 5) * Math.PI) * 2), 13], 'pearl');
		},
	);
}

/** Штурманский стол с развёрнутой картой, циркулем, чернильницей, свитками и свечой. */
export function chartTable(): Model {
	return model(
		{
			size: [26, 18, 18],
			scale: S,
			palette: {
				...WOOD,
				parchment: { color: '#efdcae', vary: 0.04 },
				'parchment-dark': { color: '#d8bf86', vary: 0.04 },
				sea: { color: '#8cc6d8', vary: 0.03 },
				land: { color: '#9cbf6a', vary: 0.03 },
				ink: { color: '#2b2230', vary: 0 },
				red: { color: '#d8282f', vary: 0 },
				brass: { color: '#d4a23c', vary: 0.04 },
				candle: { color: '#f5efe0', vary: 0 },
				flame: { color: '#ffb03a', emissive: 2.2, vary: 0 },
				glass: { color: '#3a8a6a', vary: 0 },
			},
		},
		(m) => {
			// ножки-балясины и столешница
			for (const [x, z] of [
				[1, 1],
				[24, 1],
				[1, 16],
				[24, 16],
			]) {
				m.box([x, 0, z], [x, 10, z], 'wood-dark');
				m.set([x, 5, z], 'wood-light');
			}
			m.box([1, 3, 1], [24, 3, 1], 'wood-dark');
			m.box([0, 11, 0], [25, 11, 17], 'wood');
			m.box([0, 11, 0], [25, 11, 0], 'wood-dark');
			m.box([0, 11, 17], [25, 11, 17], 'wood-dark');
			// карта: море, два острова, пунктир маршрута, крест клада, роза ветров
			m.box([3, 12, 2], [22, 12, 15], 'sea');
			m.box([3, 12, 2], [22, 12, 2], 'parchment-dark');
			m.box([3, 12, 15], [22, 12, 15], 'parchment-dark');
			m.box([3, 12, 2], [3, 12, 15], 'parchment');
			m.box([22, 12, 2], [22, 12, 15], 'parchment');
			for (const [cx, cz, r] of [
				[8, 6, 2.6],
				[17, 11, 2.2],
				[14, 4, 1.2],
			]) {
				for (let z = 3; z <= 14; z++)
					for (let x = 4; x <= 21; x++)
						if (Math.hypot(x - cx, (z - cz) * 1.2) <= r) m.set([x, 12, z], 'land');
			}
			for (let i = 0; i <= 8; i++) {
				if (i % 2) continue;
				m.set([9 + i, 12, 7 + Math.round(i * 0.45)], 'ink');
			}
			m.set([17, 12, 11], 'red');
			m.set([16, 12, 10], 'red');
			m.set([18, 12, 12], 'red');
			m.set([16, 12, 12], 'red');
			m.set([18, 12, 10], 'red');
			m.box([5, 12, 12], [5, 12, 14], 'ink');
			m.box([4, 12, 13], [6, 12, 13], 'ink');
			// свёрнутые края карты
			m.box([3, 13, 2], [22, 13, 2], 'parchment');
			m.box([3, 13, 15], [22, 13, 15], 'parchment-dark');
			// циркуль, чернильница с пером, свитки, свеча в подсвечнике
			m.line([12, 13, 5], [14, 15, 7], 'brass');
			m.line([16, 13, 5], [14, 15, 7], 'brass');
			m.box([23, 12, 3], [24, 13, 4], 'glass');
			m.line([24, 14, 4], [22, 17, 6], 'candle');
			for (const z of [9, 11]) m.box([23, 12, z], [25, 12, z + 1], 'parchment');
			m.box([23, 13, 10], [25, 13, 10], 'parchment-dark');
			m.box([0, 12, 14], [1, 12, 16], 'brass');
			m.box([0, 13, 15], [0, 15, 15], 'candle');
			m.set([0, 16, 15], 'flame');
		},
	);
}

/** Подвесной фонарь: кольцо, колпак, стекло со свечением. Pivot — кольцо подвеса. */
export function lantern(): Model {
	return model(
		{
			size: [7, 12, 7],
			scale: S,
			palette: {
				iron: { color: '#2b2b30', vary: 0.04 },
				brass: { color: '#d4a23c', vary: 0.04 },
				glow: { color: '#ffc45a', emissive: 1.6, vary: 0.04 },
			},
			pivot: [3.5, 11.5, 3.5],
		},
		(m) => {
			m.box([3, 10, 3], [3, 11, 3], 'iron');
			m.box([2, 9, 2], [4, 9, 4], 'brass');
			m.box([1, 8, 1], [5, 8, 5], 'iron');
			m.box([1, 2, 1], [5, 7, 5], 'glow');
			for (const [x, z] of [
				[1, 1],
				[5, 1],
				[1, 5],
				[5, 5],
			])
				m.box([x, 2, z], [x, 7, z], 'iron');
			m.box([1, 1, 1], [5, 1, 5], 'iron');
			m.box([2, 0, 2], [4, 0, 4], 'brass');
		},
	);
}

/** Палубная пушка на лафете, дуло в +z. */
export function cannon(): Model {
	return model(
		{
			size: [12, 9, 20],
			scale: S,
			palette: {
				...WOOD,
				iron: { color: '#25262b', vary: 0.05 },
				'iron-light': { color: '#44464e', vary: 0.05 },
				brass: { color: '#c9962f', vary: 0.05 },
			},
		},
		(m) => {
			m.box([2, 1, 3], [9, 3, 13], 'wood');
			m.box([1, 3, 4], [2, 5, 10], 'wood-dark');
			m.box([9, 3, 4], [10, 5, 10], 'wood-dark');
			for (const z of [4, 12]) {
				for (const x of [1, 10]) {
					m.box([x, 0, z - 1], [x, 2, z + 1], 'hoop');
				}
			}
			for (let z = 2; z <= 19; z++) {
				const r = z < 5 ? 2.6 : 2.4 - (z - 5) * 0.05;
				for (let y = 3; y <= 8; y++) {
					for (let x = 2; x <= 9; x++) {
						if (Math.hypot(x + 0.5 - 6, y + 0.5 - 6) <= r) {
							m.set([x, y, z], z === 18 || z === 6 ? 'iron-light' : 'iron');
						}
					}
				}
			}
			m.box([5, 5, 19], [6, 6, 19], 'hoop');
			m.box([5, 6, 1], [6, 6, 2], 'iron');
			m.set([6, 9 - 1, 5], 'brass');
		},
	);
}

/** Бухта каната. */
export function ropeCoil(): Model {
	return model({ size: [11, 4, 11], scale: S, palette: WOOD }, (m) => {
		for (let y = 0; y < 3; y++) {
			for (let z = 0; z < 11; z++) {
				for (let x = 0; x < 11; x++) {
					const d = Math.hypot(x + 0.5 - 5.5, z + 0.5 - 5.5);
					const r = 5.2 - y * 0.6;
					if (d <= r && d > 1.6 + y * 0.5)
						m.set([x, y, z], Math.round(d * 1.6) % 2 ? 'rope' : 'rope-dark');
				}
			}
		}
		m.line([5, 3, 6], [9, 0, 10], 'rope');
	});
}

/** Спасательный круг (стоит ребром, повешен на фальшборт). */
export function lifeRing(): Model {
	return model(
		{
			size: [11, 11, 3],
			scale: S,
			palette: {
				orange: { color: '#f2672a', vary: 0.03 },
				white: { color: '#f8f5ee', vary: 0.02 },
				rope: { color: '#cfae74', vary: 0.05 },
			},
		},
		(m) => {
			for (let y = 0; y < 11; y++) {
				for (let x = 0; x < 11; x++) {
					const d = Math.hypot(x + 0.5 - 5.5, y + 0.5 - 5.5);
					if (d > 5.4 || d < 2.6) continue;
					const a = Math.atan2(y + 0.5 - 5.5, x + 0.5 - 5.5);
					const mat = Math.floor((a + Math.PI) / (Math.PI / 2)) % 2 ? 'orange' : 'white';
					m.box([x, y, 0], [x, y, 2], mat);
					if (d > 4.9) m.set([x, y, 1], 'rope');
				}
			}
		},
	);
}

/** Ведро с уловом: рыбьи хвосты торчат над краем. */
export function fishBucket(): Model {
	return model(
		{
			size: [9, 10, 9],
			scale: S,
			palette: {
				...WOOD,
				fish: { color: '#8fb8c9', vary: 0.08 },
				'fish-dark': { color: '#5a7f94', vary: 0.05 },
				water: { color: '#4aa8d0', kind: 'water', vary: 0 },
			},
		},
		(m) => {
			for (let y = 0; y < 6; y++) {
				disc(m, [4.5, 4.5], y, 4, () => (y === 1 || y === 4 ? 'hoop' : 'wood'));
			}
			disc(m, [4.5, 4.5], 5, 3, () => 'water');
			for (let y = 1; y < 6; y++) disc(m, [4.5, 4.5], y, 3, () => 'air');
			disc(m, [4.5, 4.5], 4, 3, () => 'water');
			// хвосты двух рыбин
			m.box([3, 5, 4], [3, 7, 4], 'fish');
			m.box([2, 8, 4], [4, 8, 4], 'fish-dark');
			m.box([6, 5, 5], [6, 6, 5], 'fish');
			m.box([5, 7, 5], [7, 7, 5], 'fish-dark');
			// дужка
			m.line([0, 6, 4], [4, 9, 4], 'hoop');
			m.line([8, 6, 4], [4, 9, 4], 'hoop');
		},
	);
}

/** Бутылки и кружки на бочке-столе, блюдо с рыбой, онигири и фрукты. */
export function feast(): Model {
	return model(
		{
			size: [14, 8, 14],
			scale: S,
			palette: {
				bottle: { color: '#2f7a4a', kind: 'glass', vary: 0 },
				'bottle-b': { color: '#8a4a1c', kind: 'glass', vary: 0 },
				cork: { color: '#c9a56a', vary: 0 },
				plate: { color: '#eef0f2', vary: 0.02 },
				fish: { color: '#d98a3a', vary: 0.08 },
				'fish-skin': { color: '#b0602a', vary: 0.06 },
				rice: { color: '#fbfaf5', vary: 0.02 },
				nori: { color: '#1f2a24', vary: 0 },
				orange: { color: '#f39a1c', vary: 0.05 },
				grape: { color: '#7a3fa0', vary: 0.05 },
				mug: { color: '#8a5a33', vary: 0.06 },
				foam: { color: '#fbf6e6', vary: 0 },
				lemon: { color: '#f2dc3c', vary: 0 },
			},
		},
		(m) => {
			// блюдо с жареной рыбой и лимоном
			disc(m, [5, 7], 0, 4.4, () => 'plate');
			m.box([2, 1, 6], [7, 1, 8], 'fish');
			m.box([2, 2, 7], [7, 2, 7], 'fish-skin');
			m.box([8, 1, 6], [8, 2, 8], 'fish-skin');
			m.set([1, 1, 7], 'fish-skin');
			m.set([3, 1, 4], 'lemon');
			// онигири
			for (const [x, z] of [
				[3, 10],
				[6, 10],
			]) {
				m.box([x - 1, 1, z], [x + 1, 1, z + 1], 'rice');
				m.box([x, 2, z], [x, 2, z + 1], 'rice');
				m.box([x - 1, 1, z + 1], [x + 1, 1, z + 1], 'nori');
			}
			// бутылки
			for (const [x, z, mat] of [
				[11, 3, 'bottle'],
				[12, 6, 'bottle-b'],
			] as Array<[number, number, string]>) {
				m.box([x, 0, z], [x + 1, 4, z + 1], mat);
				m.box([x, 5, z], [x, 6, z], mat);
				m.set([x, 7, z], 'cork');
			}
			// кружки с пеной
			for (const [x, z] of [
				[10, 10],
				[12, 12],
			]) {
				m.box([x, 0, z], [x + 1, 2, z + 1], 'mug');
				m.box([x, 3, z], [x + 1, 3, z + 1], 'foam');
			}
			// апельсины и виноград
			m.set([9, 0, 1], 'orange');
			m.set([10, 0, 0], 'orange');
			m.set([9, 1, 0], 'orange');
			m.box([1, 0, 1], [2, 0, 2], 'grape');
			m.set([1, 1, 2], 'grape');
		},
	);
}

/** Штурвал на тумбе. Колесо — отдельная модель (крутится вокруг своей оси z). */
export function wheelStand(): Model {
	return model({ size: [6, 18, 4], scale: S, palette: WOOD }, (m) => {
		m.box([1, 0, 0], [4, 1, 3], 'wood-dark');
		m.box([2, 2, 1], [3, 17, 2], 'wood');
		m.box([2, 6, 1], [3, 6, 2], 'hoop');
		m.box([2, 12, 1], [3, 12, 2], 'hoop');
	});
}

export function wheel(): Model {
	return model(
		{
			size: [21, 21, 3],
			scale: S,
			palette: { ...WOOD, brass: { color: '#d4a23c', vary: 0.04 } },
			pivot: [10.5, 10.5, 1.5],
		},
		(m) => {
			for (let y = 0; y < 21; y++) {
				for (let x = 0; x < 21; x++) {
					const dx = x + 0.5 - 10.5;
					const dy = y + 0.5 - 10.5;
					const d = Math.hypot(dx, dy);
					if (d <= 7.4 && d > 6) m.set([x, y, 1], 'wood');
					if (d <= 1.8) m.box([x, y, 0], [x, y, 2], 'brass');
					// 8 спиц с рукоятями за ободом
					const a = Math.atan2(dy, dx);
					const k = Math.round(a / (Math.PI / 4));
					const off = Math.abs(a - k * (Math.PI / 4)) * d;
					if (off < 0.55 && d < 10.5) m.set([x, y, 1], d > 7.4 ? 'wood-light' : 'wood-dark');
				}
			}
		},
	);
}

/** Флаг экипажа: 4 полосы-сегмента волной по ветру. Pivot — у древка. */
export function jollyRoger(): Rig {
	const P: Palette = {
		cloth: { color: '#1b1a22', vary: 0.04 },
		bone: { color: '#f6f0de', vary: 0.02 },
		orange: { color: '#f07a2a', vary: 0.02 },
		lens: { color: '#5fd0d6', emissive: 0.4, vary: 0 },
	};
	const W = 9;
	const H = 22;
	// Рисунок флага на всю ширину 36: череп в очках и скрещённые поварёшка и сабля.
	const art = (x: number, y: number): string | null => {
		const cx = 17.5;
		const cy = 12;
		const dx = x + 0.5 - cx;
		const dy = y + 0.5 - cy;
		const r = Math.hypot(dx, dy * 1.05);
		if (Math.abs(dx - dy) < 1 && Math.abs(dx) < 9.5) return 'bone';
		if (Math.abs(dx + dy) < 1 && Math.abs(dx) < 9.5) return 'bone';
		if (r <= 5.6) {
			if (Math.abs(dy - 1.3) < 1.1 && Math.abs(Math.abs(dx) - 2.2) < 1.2) return 'lens';
			if (Math.abs(dy - 2.9) < 0.5) return 'orange';
			if (Math.abs(dy + 2.3) < 0.5 && Math.abs(dx) < 2.6 && Math.round(dx) % 2 === 0)
				return 'cloth';
			if (Math.abs(dx) < 0.6 && Math.abs(dy + 0.6) < 0.6) return 'cloth';
			return 'bone';
		}
		if (r <= 7.2 && Math.round(Math.atan2(dy, dx) * 4) % 2 === 0) return 'orange';
		return null;
	};
	const seg = (i: number): Model =>
		model({ size: [W, H, 1], palette: P, pivot: [0, H / 2, 0.5] }, (m) => {
			for (let y = 0; y < H; y++) {
				for (let x = 0; x < W; x++) {
					const gx = i * W + x;
					if (i === 3 && x > W - 3 && (y < 3 || y > H - 4)) continue;
					m.set([x, y, 0], art(gx, y) ?? 'cloth');
				}
			}
		});
	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			s0: { model: seg(0) },
			s1: { model: seg(1), parent: 's0', at: [W, H / 2, 0.5] },
			s2: { model: seg(2), parent: 's1', at: [W, H / 2, 0.5] },
			s3: { model: seg(3), parent: 's2', at: [W, H / 2, 0.5] },
		},
	});
}

/** Длинный вымпел: оранжевая лента-«ласточкин хвост». */
export function pennant(): Rig {
	const P: Palette = {
		tape: { color: '#f07a2a', vary: 0.03 },
		edge: { color: '#f2c94c', vary: 0.02 },
	};
	const seg = (i: number): Model =>
		model({ size: [8, 5, 1], palette: P, pivot: [0, 2.5, 0.5] }, (m) => {
			const h0 = 2.5 - i * 0.45;
			for (let x = 0; x < 8; x++) {
				const h = h0 - x * 0.06;
				for (let y = 0; y < 5; y++) {
					const d = Math.abs(y + 0.5 - 2.5);
					if (d > h) continue;
					if (i === 3 && x > 4 && d < 0.6) continue;
					m.set([x, y, 0], d > h - 0.8 ? 'edge' : 'tape');
				}
			}
		});
	return rig({
		skeleton: 'custom',
		scale: S,
		parts: {
			p0: { model: seg(0) },
			p1: { model: seg(1), parent: 'p0', at: [8, 2.5, 0.5] },
			p2: { model: seg(2), parent: 'p1', at: [8, 2.5, 0.5] },
			p3: { model: seg(3), parent: 'p2', at: [8, 2.5, 0.5] },
		},
	});
}

/** Чайка: белое тело, серые крылья с чёрными кончиками, жёлтый клюв. */
export function gull(): Rig {
	const P: Palette = {
		white: { color: '#fbfbf8', vary: 0.03 },
		grey: { color: '#a9b3bd', vary: 0.04 },
		tip: { color: '#22252b', vary: 0 },
		beak: { color: '#f2c13a', vary: 0 },
		eye: { color: '#141414', vary: 0 },
	};
	const body = model({ size: [3, 3, 8], palette: P, pivot: [1.5, 1.5, 4] }, (m) => {
		m.box([0, 0, 1], [2, 1, 5], 'white');
		m.box([1, 2, 4], [1, 2, 6], 'white');
		m.box([0, 1, 6], [2, 2, 6], 'white');
		m.set([1, 1, 7], 'beak');
		m.set([0, 2, 6], 'eye');
		m.set([2, 2, 6], 'eye');
		m.box([1, 1, 0], [1, 1, 0], 'grey');
	});
	const wing = (s: number) =>
		model({ size: [8, 1, 4], palette: P, pivot: [s > 0 ? 0 : 8, 0.5, 2] }, (m) => {
			for (let i = 0; i < 8; i++) {
				const x = s > 0 ? i : 7 - i;
				const w = i < 5 ? 3 : 2;
				m.box([x, 0, 0], [x, 0, w - 1], i > 5 ? 'tip' : 'grey');
			}
		});
	return rig({
		skeleton: 'bird',
		scale: 0.38,
		parts: {
			body: { model: body },
			wingL: { model: wing(1), parent: 'body', at: [3, 2, 4] },
			wingR: { model: wing(-1), parent: 'body', at: [0, 2, 4] },
		},
	});
}

/** Леска: тонкая линия от кончика удилища до поплавка на воде. */
export function fishingLine(drop: number, reach: number): Model {
	const h = Math.max(2, Math.round(drop / S));
	const d = Math.max(1, Math.round(reach / S));
	return model(
		{
			size: [1, h + 1, d + 1],
			scale: S,
			palette: {
				line: { color: '#f2f0ea', vary: 0 },
				bob: { color: '#e0213a', vary: 0 },
				'bob-white': { color: '#ffffff', vary: 0 },
			},
			pivot: [0.5, h + 0.5, 0.5],
		},
		(m) => {
			m.line([0, h, 0], [0, 2, d], 'line');
			m.set([0, 1, d], 'bob');
			m.set([0, 0, d], 'bob-white');
		},
	);
}

/** Канат от a до b тонкой линией: режем на куски, чтобы каждая модель влезала в 64³. */
export function ropeSegments(a: Vec3, b: Vec3, scale = 0.4): Array<{ model: Model; at: Vec3 }> {
	const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
	const longest = Math.max(...d.map(Math.abs)) / scale;
	const n = Math.max(1, Math.ceil(longest / 56));
	const out: Array<{ model: Model; at: Vec3 }> = [];
	for (let i = 0; i < n; i++) {
		const p0: Vec3 = [0, 1, 2].map((k) => a[k] + (d[k] * i) / n) as Vec3;
		const p1: Vec3 = [0, 1, 2].map((k) => a[k] + (d[k] * (i + 1)) / n) as Vec3;
		const lo: Vec3 = [0, 1, 2].map((k) => Math.min(p0[k], p1[k])) as Vec3;
		const v0: Vec3 = [0, 1, 2].map((k) => Math.round((p0[k] - lo[k]) / scale)) as Vec3;
		const v1: Vec3 = [0, 1, 2].map((k) => Math.round((p1[k] - lo[k]) / scale)) as Vec3;
		const size: Vec3 = [0, 1, 2].map((k) => Math.max(v0[k], v1[k]) + 1) as Vec3;
		out.push({
			model: model(
				{
					size,
					scale,
					pivot: [v0[0] + 0.5, v0[1] + 0.5, v0[2] + 0.5],
					palette: { rope: { color: '#c9a56a', vary: 0.06 } },
				},
				(m) => m.line(v0, v1, 'rope'),
			),
			at: p0,
		});
	}
	return out;
}
