import type { QualityLevel, QualitySetting, SkyKind } from '#engine';

export interface ViewerSettings {
	quality: QualitySetting;
	particles: boolean;
	autoRotate: boolean;
}

export const SETTINGS_KEY = 'voxel-diorama:settings';

const QUALITIES: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high'];

/** Разбор сохранённых настроек; невалидное игнорируется (без исключений). */
export function parseSettings(raw: string | null): Partial<ViewerSettings> {
	if (!raw) return {};
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
	const v = value as Record<string, unknown>;
	const out: Partial<ViewerSettings> = {};
	if ((QUALITIES as readonly unknown[]).includes(v.quality))
		out.quality = v.quality as QualitySetting;
	if (typeof v.particles === 'boolean') out.particles = v.particles;
	if (typeof v.autoRotate === 'boolean') out.autoRotate = v.autoRotate;
	return out;
}

export function serializeSettings(s: Partial<ViewerSettings>): string {
	return JSON.stringify({ quality: s.quality, particles: s.particles, autoRotate: s.autoRotate });
}

export function resolveSettings(
	stored: Partial<ViewerSettings>,
	defaults: { autoRotate: boolean; reducedMotion: boolean },
): ViewerSettings {
	return {
		quality: stored.quality ?? 'auto',
		particles: stored.particles ?? true,
		autoRotate: stored.autoRotate ?? (defaults.autoRotate && !defaults.reducedMotion),
	};
}

/** 18.5 → «18:30». */
export function formatHour(hour: number): string {
	const minutes = Math.round(hour * 60) % (24 * 60);
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const SPEED_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
	{ value: 0, label: 'Стоп' },
	{ value: 0.5, label: '0.5x' },
	{ value: 1, label: '1x' },
	{ value: 1.5, label: '1.5x' },
	{ value: 2, label: '2x' },
];

export const SKY_OPTIONS: ReadonlyArray<{ value: SkyKind; label: string; swatch: string }> = [
	{ value: 'gradient', label: 'Градиент', swatch: 'linear-gradient(#3d7bd9, #bcd8f5)' },
	{ value: 'solid', label: 'Сплошной', swatch: '#bcd8f5' },
	{
		value: 'realistic',
		label: 'Реалистичное',
		swatch: 'radial-gradient(circle at 70% 30%, #fff6d0 8%, #7fb2ec 30%, #2c5fa8)',
	},
	{
		value: 'stylized',
		label: 'Стилизованное',
		swatch: 'radial-gradient(circle at 30% 30%, #ffffff 6%, #1b2747 10%, #05070f)',
	},
];

export const QUALITY_OPTIONS: ReadonlyArray<{ value: QualitySetting; label: string }> = [
	{ value: 'auto', label: 'Авто' },
	{ value: 'low', label: 'Низкое' },
	{ value: 'medium', label: 'Среднее' },
	{ value: 'high', label: 'Высокое' },
];

export const QUALITY_NAMES: Readonly<Record<QualityLevel, string>> = {
	low: 'низкое',
	medium: 'среднее',
	high: 'высокое',
};
