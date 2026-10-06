import type { Material, MaterialKind } from '../engine/types.ts';

export type MaterialInput = string | { color: string; emissive?: number; kind?: MaterialKind };

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Зарезервированное имя: запись 'air' стирает воксели. */
export const AIR = 'air';

export function normalizeMaterial(input: MaterialInput): Material {
	const m = typeof input === 'string' ? { color: input } : input;
	if (!HEX_COLOR.test(m.color)) {
		throw new Error(`неверный цвет "${m.color}" — ожидается #rrggbb`);
	}
	return { color: m.color.toLowerCase(), emissive: m.emissive ?? 0, kind: m.kind ?? 'solid' };
}

/** Ключ для дедупликации материалов префабов: одинаковое имя + одинаковые свойства. */
export function materialSignature(name: string, m: Material): string {
	return `${name}|${m.color}|${m.kind}|${m.emissive}`;
}
