import type { QualityLevel, QualitySetting, SkyKind } from '#engine';

export interface ViewerSettings {
	quality: QualitySetting;
	particles: boolean;
	autoRotate: boolean;
	/** Счётчик кадров в секунду поверх сцены. */
	showFps: boolean;
	/** Множитель скорости полёта WASD; общий для всех диорам. */
	flySpeed: number;
}

export const FLY_SPEED = { min: 0.25, max: 3, step: 0.05, default: 1 } as const;

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
	if (typeof v.showFps === 'boolean') out.showFps = v.showFps;
	if (typeof v.flySpeed === 'number' && v.flySpeed >= FLY_SPEED.min && v.flySpeed <= FLY_SPEED.max)
		out.flySpeed = v.flySpeed;
	return out;
}

/** Чтение настроек; заблокированное хранилище (SecurityError и т. п.) — пустые настройки. */
export function loadSettings(storage: () => Pick<Storage, 'getItem'>): Partial<ViewerSettings> {
	try {
		return parseSettings(storage().getItem(SETTINGS_KEY));
	} catch {
		return {};
	}
}

/** Запись настроек; ошибки хранилища (нет доступа, переполнение) игнорируются. */
export function saveSettings(
	storage: () => Pick<Storage, 'setItem'>,
	s: Partial<ViewerSettings>,
): void {
	try {
		storage().setItem(SETTINGS_KEY, serializeSettings(s));
	} catch {
		// Настройки просто не сохранятся.
	}
}

export function serializeSettings(s: Partial<ViewerSettings>): string {
	return JSON.stringify({
		quality: s.quality,
		particles: s.particles,
		autoRotate: s.autoRotate,
		showFps: s.showFps,
		flySpeed: s.flySpeed,
	});
}

export function resolveSettings(
	stored: Partial<ViewerSettings>,
	defaults: { autoRotate: boolean; reducedMotion: boolean; capture?: boolean },
): ViewerSettings {
	// Скриншот карточки не зависит от настроек зрителя (детерминизм кадра).
	if (defaults.capture)
		return {
			quality: 'auto',
			particles: true,
			autoRotate: false,
			showFps: false,
			flySpeed: FLY_SPEED.default,
		};
	return {
		quality: stored.quality ?? 'auto',
		particles: stored.particles ?? true,
		autoRotate: stored.autoRotate ?? (defaults.autoRotate && !defaults.reducedMotion),
		showFps: stored.showFps ?? false,
		flySpeed: stored.flySpeed ?? FLY_SPEED.default,
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
	{ value: 0, label: 'Stop' },
	{ value: 0.5, label: '0.5x' },
	{ value: 1, label: '1x' },
	{ value: 1.5, label: '1.5x' },
	{ value: 2, label: '2x' },
];

export const SKY_OPTIONS: ReadonlyArray<{ value: SkyKind; label: string; swatch: string }> = [
	{ value: 'gradient', label: 'Gradient', swatch: 'linear-gradient(#3d7bd9, #bcd8f5)' },
	{ value: 'solid', label: 'Solid', swatch: '#bcd8f5' },
	{
		value: 'realistic',
		label: 'Realistic',
		swatch: 'radial-gradient(circle at 70% 30%, #fff6d0 8%, #7fb2ec 30%, #2c5fa8)',
	},
	{
		value: 'stylized',
		label: 'Stylized',
		swatch: 'radial-gradient(circle at 30% 30%, #ffffff 6%, #1b2747 10%, #05070f)',
	},
];

export const QUALITY_OPTIONS: ReadonlyArray<{ value: QualitySetting; label: string }> = [
	{ value: 'auto', label: 'Auto' },
	{ value: 'low', label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high', label: 'High' },
];

export const QUALITY_NAMES: Readonly<Record<QualityLevel, string>> = {
	low: 'low',
	medium: 'medium',
	high: 'high',
};
