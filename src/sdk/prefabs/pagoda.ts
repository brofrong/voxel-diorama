import { type Model, type ModelBuilder, model } from '../builder/model.ts';

export interface PagodaOptions {
	/** Число ярусов 2..6. По умолчанию 4. */
	tiers?: number;
	/** Ширина нижнего яруса (нечётная, 7..17). По умолчанию 11. */
	base?: number;
	wall?: string;
	post?: string;
	roof?: string;
	/** Кромка карниза, загнутые углы и шпиль. */
	trim?: string;
	stone?: string;
	/** Окна и фонарики под карнизами (светятся ночью). */
	glow?: string;
}

/** Цвет темнее в k раз (полосы черепицы). */
function darken(hex: string, k: number): string {
	const n = Number.parseInt(hex.slice(1), 16);
	const ch = (shift: number) =>
		Math.round(((n >> shift) & 255) * k)
			.toString(16)
			.padStart(2, '0');
	return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/** Вынос карниза за стену. */
const OVERHANG = 3;

/** Квадратное кольцо (контур) с полушириной half вокруг (c, c) на высоте y. */
function ring(m: ModelBuilder, c: number, half: number, y: number, material: string): void {
	m.box([c - half, y, c - half], [c + half, y, c - half], material);
	m.box([c - half, y, c + half], [c + half, y, c + half], material);
	m.box([c - half, y, c - half], [c - half, y, c + half], material);
	m.box([c + half, y, c - half], [c + half, y, c + half], material);
}

/**
 * Многоярусная пагода на каменном подиуме: стены со столбами и светящимися окнами,
 * широкие карнизы с загнутыми вверх углами, фонарики под карнизами, шпиль с кольцами.
 * Фасад с дверью и лестницей смотрит в +z. Якоря: `door` (перед лестницей), `top` (шпиль).
 */
export function pagoda(options: PagodaOptions = {}): Model {
	const tiers = Math.max(2, Math.min(6, Math.round(options.tiers ?? 4)));
	let base = Math.max(7, Math.min(17, Math.round(options.base ?? 11)));
	if (base % 2 === 0) base++;
	const podium = (base - 1) / 2 + 2;
	const half = podium + OVERHANG + 1;
	const side = half * 2 + 1;
	const c = half;
	// Высота: подиум 2 + ярусы (стена + 3 слоя крыши) + пирамида верха + шпиль.
	let height = 2;
	for (let i = 0; i < tiers; i++) height += (i === 0 ? 5 : 4) + 3;
	height += (base - 1) / 2 - (tiers - 1) + OVERHANG + 9;
	const roof = options.roof ?? '#2e6b6f';

	return model(
		{
			size: [side, height, side],
			palette: {
				'pagoda-wall': { color: options.wall ?? '#efe2c4', vary: 0.05 },
				'pagoda-post': options.post ?? '#8f2b22',
				'pagoda-roof': { color: roof, vary: 0.08 },
				'pagoda-roof-dark': { color: darken(roof, 0.8), vary: 0.08 },
				'pagoda-trim': options.trim ?? '#d6a13e',
				'pagoda-stone': { color: options.stone ?? '#9a958c', vary: 0.1 },
				'pagoda-door': '#3a2622',
				'pagoda-glow': { color: options.glow ?? '#ffcf7a', emissive: 1.4 },
			},
			anchors: { door: [c + 0.5, 0, c + podium + 3], top: [c + 0.5, height, c + 0.5] },
		},
		(m) => {
			// Подиум и лестница к двери.
			m.box([c - podium, 0, c - podium], [c + podium, 1, c + podium], 'pagoda-stone');
			m.box([c - 1, 0, c + podium + 1], [c + 1, 0, c + podium + 2], 'pagoda-stone');
			m.box([c - 1, 1, c + podium + 1], [c + 1, 1, c + podium + 1], 'pagoda-stone');

			let y = 2;
			for (let i = 0; i < tiers; i++) {
				const h = Math.max(2, (base - 1) / 2 - i);
				const wallH = i === 0 ? 5 : 4;
				// Стены: столбы по углам и через 3 вокселя, между ними — светлые панели.
				for (let k = 0; k < wallH; k++) {
					ring(m, c, h, y + k, 'pagoda-wall');
					for (let d = -h; d <= h; d += 1) {
						if ((d + h) % 3 !== 0 && Math.abs(d) !== h) continue;
						for (const [x, z] of [
							[c + d, c - h],
							[c + d, c + h],
							[c - h, c + d],
							[c + h, c + d],
						]) {
							m.set([x, y + k, z], 'pagoda-post');
						}
					}
				}
				// Окна по центру каждой стороны.
				for (const [x, z] of [
					[c, c - h],
					[c - h, c],
					[c + h, c],
					[c, c + h],
				]) {
					m.box([x, y + 1, z], [x, y + wallH - 2, z], 'pagoda-glow');
				}
				if (i === 0) m.box([c - 1, y, c + h], [c + 1, y + 2, c + h], 'pagoda-door');
				// Перила балкона у верхних ярусов.
				if (i > 0) ring(m, c, h + 1, y, 'pagoda-post');

				// Крыша: три слоя, каждый уже предыдущего; полосы «черепицы»; кромка — золото.
				const top = y + wallH;
				ring(m, c, h + 1, top - 1, 'pagoda-post');
				const layers = i === tiers - 1 ? h + OVERHANG + 1 : 3;
				for (let k = 0; k < layers; k++) {
					const r = h + OVERHANG - k;
					if (r < 0) break;
					m.box(
						[c - r, top + k, c - r],
						[c + r, top + k, c + r],
						k % 2 ? 'pagoda-roof-dark' : 'pagoda-roof',
					);
				}
				const eave = h + OVERHANG;
				ring(m, c, eave, top, 'pagoda-trim');
				// Загнутые вверх углы карниза.
				for (const sx of [-1, 1]) {
					for (const sz of [-1, 1]) {
						m.set([c + sx * eave, top + 1, c + sz * eave], 'pagoda-trim');
						m.set([c + sx * (eave + 1), top + 1, c + sz * (eave + 1)], 'pagoda-trim');
						m.set([c + sx * (eave + 1), top + 2, c + sz * (eave + 1)], 'pagoda-trim');
						// Фонарик под углом карниза у нижних ярусов.
						if (i < 2) {
							m.set([c + sx * (eave - 1), top - 1, c + sz * (eave - 1)], 'pagoda-post');
							m.set([c + sx * (eave - 1), top - 2, c + sz * (eave - 1)], 'pagoda-glow');
						}
					}
				}
				y = top + (i === tiers - 1 ? layers : 3);
			}
			// Шпиль с кольцами и навершием.
			m.box([c, y, c], [c, y + 7, c], 'pagoda-trim');
			for (const k of [1, 3, 5]) m.box([c - 1, y + k, c - 1], [c + 1, y + k, c + 1], 'pagoda-trim');
			m.set([c, y + 8, c], 'pagoda-glow');
		},
	);
}
