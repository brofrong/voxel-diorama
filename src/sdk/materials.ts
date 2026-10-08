import type { Material, MaterialKind } from '../engine/types.ts';

export type MaterialInput =
	| string
	| { color: string; emissive?: number; kind?: MaterialKind; vary?: number };

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Зарезервированное имя: запись 'air' стирает воксели. */
export const AIR = 'air';

/** Разброс оттенка по умолчанию у твёрдых материалов: лёгкая «живость» без ряби. */
export const DEFAULT_VARY = 0.06;
export const MAX_VARY = 0.5;

export function normalizeMaterial(input: MaterialInput): Material {
	const m = typeof input === 'string' ? { color: input } : input;
	if (!HEX_COLOR.test(m.color)) {
		throw new Error(`неверный цвет "${m.color}" — ожидается #rrggbb`);
	}
	const kind = m.kind ?? 'solid';
	const vary = 'vary' in m && m.vary !== undefined ? m.vary : kind === 'solid' ? DEFAULT_VARY : 0;
	if (!(vary >= 0 && vary <= MAX_VARY)) {
		throw new Error(`vary должен быть в 0..${MAX_VARY}, получено ${vary}`);
	}
	return { color: m.color.toLowerCase(), emissive: m.emissive ?? 0, kind, vary };
}

/** Ключ для дедупликации материалов префабов: одинаковое имя + одинаковые свойства. */
export function materialSignature(name: string, m: Material): string {
	return `${name}|${m.color}|${m.kind}|${m.emissive}|${m.vary}`;
}
