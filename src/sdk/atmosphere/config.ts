import { DEFAULT_TIME, TIME_SPEEDS, TIME_SYNONYMS } from '../../engine/atmosphere/daycycle.ts';
import type { SkyConfig, SkyKind, TimeConfig, TimeOfDay } from '../../engine/types.ts';
import { HEX_COLOR } from '../materials.ts';

export type TimeInput =
	| { fixed: TimeOfDay }
	| { start?: number | TimeOfDay; speed?: number; cycle?: number };

export type SkyInput = SkyKind | { kind: SkyKind; color?: string };

export const TIME_ERROR =
	'time: ожидается { start: 0..24 или "dawn" | "day" | "sunset" | "night", speed: 0 | 0.5 | 1 | 1.5 | 2, cycle: 30..3600 } или { fixed: "dawn" | "day" | "sunset" | "night" }';

export const SKY_ERROR =
	'sky: ожидается "gradient" | "solid" | "realistic" | "stylized" или { kind: "solid", color: "#rrggbb" }';

const SKY_KINDS: readonly SkyKind[] = ['gradient', 'solid', 'realistic', 'stylized'];

const isSynonym = (v: unknown): v is TimeOfDay => typeof v === 'string' && v in TIME_SYNONYMS;

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

export function isTimeInput(v: unknown): v is TimeInput {
	if (!isRecord(v)) return false;
	const keys = Object.keys(v);
	if ('fixed' in v) return keys.length === 1 && isSynonym(v.fixed);
	if (!keys.every((k) => k === 'start' || k === 'speed' || k === 'cycle')) return false;
	const { start, speed, cycle } = v;
	if (start !== undefined) {
		const ok = isSynonym(start) || (typeof start === 'number' && start >= 0 && start <= 24);
		if (!ok) return false;
	}
	if (speed !== undefined && !(TIME_SPEEDS as readonly unknown[]).includes(speed)) return false;
	if (cycle !== undefined && !(typeof cycle === 'number' && cycle >= 30 && cycle <= 3600))
		return false;
	return true;
}

export function normalizeTime(v: TimeInput | undefined): TimeConfig {
	if (v === undefined) return { ...DEFAULT_TIME };
	if ('fixed' in v) return { start: TIME_SYNONYMS[v.fixed], speed: 0, cycle: DEFAULT_TIME.cycle };
	const start =
		v.start === undefined
			? DEFAULT_TIME.start
			: isSynonym(v.start)
				? TIME_SYNONYMS[v.start]
				: v.start;
	return { start, speed: v.speed ?? DEFAULT_TIME.speed, cycle: v.cycle ?? DEFAULT_TIME.cycle };
}

export function isSkyInput(v: unknown): v is SkyInput {
	if (typeof v === 'string') return (SKY_KINDS as readonly string[]).includes(v);
	if (!isRecord(v)) return false;
	if (!(SKY_KINDS as readonly unknown[]).includes(v.kind)) return false;
	const keys = Object.keys(v);
	if (v.kind !== 'solid') return keys.length === 1;
	if (!keys.every((k) => k === 'kind' || k === 'color')) return false;
	return v.color === undefined || (typeof v.color === 'string' && HEX_COLOR.test(v.color));
}

export function normalizeSky(v: SkyInput | undefined): SkyConfig {
	if (v === undefined) return { kind: 'gradient' };
	if (typeof v === 'string') return { kind: v };
	return v.color === undefined ? { kind: v.kind } : { kind: v.kind, color: v.color.toLowerCase() };
}
