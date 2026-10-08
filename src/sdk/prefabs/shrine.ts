import { type Model, model } from '../builder/model.ts';

export interface ToriiOptions {
	/** Пролёт между столбами. По умолчанию 9. */
	width?: number;
	/** Высота до верхней балки. По умолчанию 10. */
	height?: number;
	color?: string;
	/** Верхняя балка и основания столбов. */
	dark?: string;
}

/** Ворота-тории: два столба, нижняя балка, верхняя балка с загнутыми концами. Проход вдоль z. */
export function torii(options: ToriiOptions = {}): Model {
	const width = Math.max(5, Math.round(options.width ?? 9));
	const height = Math.max(6, Math.round(options.height ?? 10));
	const sx = width + 6;
	const left = 2;
	const right = left + width + 1;
	return model(
		{
			size: [sx, height + 2, 3],
			palette: {
				'torii-red': options.color ?? '#c8372d',
				'torii-dark': options.dark ?? '#2a2626',
			},
			anchors: { gate: [sx / 2, 0, 1.5] },
		},
		(m) => {
			for (const x of [left, right]) {
				m.box([x, 0, 1], [x + 1, height - 1, 1], 'torii-red');
				m.box([x - 1, 0, 0], [x + 2, 0, 2], 'torii-dark');
			}
			// Нижняя балка (нуки) — чуть шире столбов.
			m.box([left - 1, height - 4, 1], [right + 2, height - 4, 1], 'torii-red');
			// Подпорка по центру и плашка.
			m.box([Math.floor(sx / 2), height - 3, 1], [Math.floor(sx / 2), height - 2, 1], 'torii-dark');
			// Верхние балки: красная (симаги) и тёмная (касаги) с загнутыми концами.
			m.box([left - 2, height - 1, 0], [right + 3, height - 1, 2], 'torii-red');
			m.box([0, height, 0], [sx - 1, height, 2], 'torii-dark');
			m.box([0, height + 1, 0], [0, height + 1, 2], 'torii-dark');
			m.box([sx - 1, height + 1, 0], [sx - 1, height + 1, 2], 'torii-dark');
		},
	);
}

export interface ArchBridgeOptions {
	/** Длина пролёта вдоль x. По умолчанию 15. */
	length?: number;
	/** Ширина настила. По умолчанию 3. */
	width?: number;
	/** Подъём арки. По умолчанию 3. */
	rise?: number;
	deck?: string;
	rail?: string;
}

/**
 * Горбатый мостик вдоль x: настил по дуге, перила со столбиками. Якоря `start`, `end`
 * (у земли на концах — для walkPath) и `top` (на середине настила).
 */
export function archBridge(options: ArchBridgeOptions = {}): Model {
	const length = Math.max(5, Math.round(options.length ?? 15));
	const width = Math.max(1, Math.round(options.width ?? 3));
	const rise = Math.max(1, Math.round(options.rise ?? 3));
	const mid = (width + 2) / 2;
	const deckAt = (x: number): number => Math.round(rise * Math.sin((Math.PI * x) / (length - 1)));
	return model(
		{
			size: [length, rise + 4, width + 2],
			palette: {
				'bridge-deck': { color: options.deck ?? '#9a6b42', vary: 0.1 },
				'bridge-rail': options.rail ?? '#b8402c',
			},
			anchors: {
				start: [0.5, 1, mid],
				end: [length - 0.5, 1, mid],
				top: [length / 2, deckAt((length - 1) / 2) + 1, mid],
			},
		},
		(m) => {
			for (let x = 0; x < length; x++) {
				const y = deckAt(x);
				m.box([x, Math.max(0, y - 1), 1], [x, y, width], 'bridge-deck');
				for (const z of [0, width + 1]) {
					// Перила: брус на высоте 2 над настилом, столбики через 3 вокселя.
					m.set([x, y + 2, z], 'bridge-rail');
					if (x % 3 === 0 || x === length - 1) m.box([x, y, z], [x, y + 1, z], 'bridge-rail');
				}
			}
		},
	);
}

export interface StoneLanternOptions {
	stone?: string;
	glow?: string;
}

/** Каменный фонарь (торо): основание, столб, светящаяся камера, двухъярусная крыша. Якорь `light`. */
export function stoneLantern(options: StoneLanternOptions = {}): Model {
	return model(
		{
			size: [5, 8, 5],
			palette: {
				'lantern-stone': { color: options.stone ?? '#9c978d', vary: 0.12 },
				'lantern-glow': { color: options.glow ?? '#ffd27a', emissive: 1.6 },
			},
			anchors: { light: [2.5, 4.5, 2.5] },
		},
		(m) => {
			m.box([1, 0, 1], [3, 0, 3], 'lantern-stone');
			m.box([2, 1, 2], [2, 2, 2], 'lantern-stone');
			m.box([1, 3, 1], [3, 3, 3], 'lantern-stone');
			// Камера огня: свет виден через проёмы со всех сторон, по углам — каменные стойки.
			m.box([1, 4, 1], [3, 4, 3], 'lantern-glow');
			for (const [x, z] of [
				[1, 1],
				[3, 1],
				[1, 3],
				[3, 3],
			] as const) {
				m.set([x, 4, z], 'lantern-stone');
			}
			m.box([0, 5, 0], [4, 5, 4], 'lantern-stone');
			m.box([1, 6, 1], [3, 6, 3], 'lantern-stone');
			m.set([2, 7, 2], 'lantern-stone');
		},
	);
}
