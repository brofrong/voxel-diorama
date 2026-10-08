import { type Model, model } from '../builder/model.ts';
import { createRng, type Rng } from '../rng.ts';
import { canopy, drip, type Shades, trunk } from './flora.ts';

export interface FloraOptions {
	rng?: Rng;
	/** Высота ствола до кроны. */
	height?: number;
	/** Оттенки кроны [тёмный, основной, светлый]. */
	colors?: Shades;
	/** Цвет коры. */
	bark?: string;
}

const SAKURA: Shades = ['#d9789f', '#f0a6c2', '#fcd4e2'];
const WILLOW: Shades = ['#4c7a36', '#6e9d45', '#9cc463'];
const MAPLE: Shades = ['#b23a26', '#dd6a2c', '#f2a93d'];
const BUSH: Shades = ['#3f7a35', '#5b9a42', '#86bd5a'];

/** Квадратная модель-«коробка» для дерева: ширина под крону, высота с запасом. */
const treeBox = (spread: number, radius: number, height: number) => {
	const half = Math.ceil(spread + radius * 1.3) + 2;
	return { side: half * 2 + 1, center: half + 0.5, tall: Math.ceil(height + radius * 2.2) + 3 };
};

/**
 * Сакура: тёмный изогнутый ствол, ветви веером, пышные розовые «облака» с лепестками,
 * свисающими с нижней кромки. ~13 вокселей в высоту.
 */
export function sakura(options: FloraOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(6, 8);
	const spread = height * 0.7;
	const radius = height * 0.55;
	const box = treeBox(spread, radius, height);
	const [dark, mid, light] = ['blossom-dark', 'blossom', 'blossom-light'];
	const colors = options.colors ?? SAKURA;
	return model(
		{
			size: [box.side, box.tall, box.side],
			palette: {
				'sakura-bark': options.bark ?? '#6a4a40',
				[dark]: { color: colors[0], vary: 0.1 },
				[mid]: { color: colors[1], vary: 0.1 },
				[light]: { color: colors[2], vary: 0.1 },
			},
		},
		(m) => {
			const tips = trunk(m, rng, {
				base: [box.center, 0, box.center],
				height,
				radius: 0.9,
				branches: rng.int(4, 5),
				spread,
				rise: 1.5,
				material: 'sakura-bark',
			});
			canopy(m, rng, tips, { radius, flatten: 0.6, shades: [dark, mid, light] });
			drip(m, rng, [dark, mid, light], [mid, light], 0.18, 2);
		},
	);
}

/** Плакучая ива: короткий толстый ствол, купол кроны и длинные пряди почти до земли. */
export function willow(options: FloraOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(6, 8);
	const spread = height * 0.6;
	const radius = height * 0.45;
	const box = treeBox(spread, radius, height);
	const [dark, mid, light] = ['willow-dark', 'willow', 'willow-light'];
	const colors = options.colors ?? WILLOW;
	return model(
		{
			size: [box.side, box.tall, box.side],
			palette: {
				'willow-bark': options.bark ?? '#5b4636',
				[dark]: { color: colors[0], vary: 0.1 },
				[mid]: { color: colors[1], vary: 0.1 },
				[light]: { color: colors[2], vary: 0.1 },
			},
		},
		(m) => {
			const tips = trunk(m, rng, {
				base: [box.center, 0, box.center],
				height,
				radius: 1.5,
				branches: rng.int(4, 6),
				spread,
				rise: 0.5,
				material: 'willow-bark',
			});
			canopy(m, rng, tips, { radius, flatten: 0.55, shades: [dark, mid, light] });
			// Пряди: редкие и длинные — сквозь них видно ствол, силуэт «шатра».
			drip(m, rng, [dark, mid, light], [mid, light], 0.14, Math.round(height * 1.1));
		},
	);
}

/** Клён: раскидистая округлая крона; по умолчанию осенний (красно-оранжевый). */
export function maple(options: FloraOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const height = options.height ?? rng.int(6, 9);
	const spread = height * 0.55;
	const radius = height * 0.6;
	const box = treeBox(spread, radius, height);
	const [dark, mid, light] = ['maple-dark', 'maple', 'maple-light'];
	const colors = options.colors ?? MAPLE;
	return model(
		{
			size: [box.side, box.tall, box.side],
			palette: {
				'maple-bark': options.bark ?? '#5a4032',
				[dark]: { color: colors[0], vary: 0.1 },
				[mid]: { color: colors[1], vary: 0.1 },
				[light]: { color: colors[2], vary: 0.1 },
			},
		},
		(m) => {
			const tips = trunk(m, rng, {
				base: [box.center, 0, box.center],
				height,
				radius: 1.2,
				branches: rng.int(3, 5),
				spread,
				rise: 2.5,
				material: 'maple-bark',
			});
			canopy(m, rng, tips, { radius, flatten: 0.85, shades: [dark, mid, light] });
			drip(m, rng, [dark, mid, light], [mid], 0.06, 1);
		},
	);
}

export interface BushOptions {
	rng?: Rng;
	/** Радиус 2..5. */
	size?: number;
	colors?: Shades;
	/** Цвет цветков/ягод вкраплениями; по умолчанию без них. */
	flowers?: string;
}

/** Куст: низкий бугристый холмик листвы трёх оттенков, по желанию с цветками. */
export function bush(options: BushOptions = {}): Model {
	const rng = options.rng ?? createRng(1);
	const r = options.size ?? rng.int(2, 4);
	const side = r * 2 + 5;
	const c = side / 2;
	const [dark, mid, light] = ['bush-dark', 'bush', 'bush-light'];
	const colors = options.colors ?? BUSH;
	const palette: Record<string, { color: string; vary: number }> = {
		[dark]: { color: colors[0], vary: 0.1 },
		[mid]: { color: colors[1], vary: 0.1 },
		[light]: { color: colors[2], vary: 0.1 },
	};
	if (options.flowers) palette['bush-flower'] = { color: options.flowers, vary: 0.08 };
	return model({ size: [side, r + 2, side], palette }, (m) => {
		const centers = [
			[c, 0.5, c],
			[c + rng.float(-1.5, 1.5), 0.5, c + rng.float(-1.5, 1.5)],
		] as const;
		canopy(
			m,
			rng,
			centers.map((p) => [p[0], p[1], p[2]]),
			{ radius: r + 0.5, flatten: 0.8, shades: [dark, mid, light], scale: 2 },
		);
		if (!options.flowers) return;
		for (let z = 0; z < side; z++) {
			for (let y = 1; y < r + 2; y++) {
				for (let x = 0; x < side; x++) {
					const here = m.get([x, y, z]);
					if (here !== null && m.get([x, y + 1, z]) === null && rng.chance(0.18)) {
						m.set([x, y, z], 'bush-flower');
					}
				}
			}
		}
	});
}
