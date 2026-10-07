import type { Vec3 } from '../../engine/types.ts';
import type { Point } from '../entities/types.ts';
import { HEX_COLOR } from '../materials.ts';

export interface PointLightOptions {
	at?: Point;
	attachTo?: string;
	offset?: Vec3;
	color?: string;
	intensity?: number;
	distance?: number;
	flicker?: boolean;
	onlyAtNight?: boolean;
}

export interface LightDef {
	readonly kind: 'light';
	readonly options: Readonly<
		Required<Omit<PointLightOptions, 'at' | 'attachTo'>> &
			Pick<PointLightOptions, 'at' | 'attachTo'>
	>;
}

export function isLightDef(value: unknown): value is LightDef {
	return (
		typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'light'
	);
}

/** Точечный источник света без теней. */
export function pointLight(o: PointLightOptions): LightDef {
	if ((o.at === undefined) === (o.attachTo === undefined)) {
		throw new Error('pointLight: нужно ровно одно из at или attachTo');
	}
	const intensity = o.intensity ?? 2;
	const distance = o.distance ?? 10;
	const color = o.color ?? '#ffd27a';
	if (!(intensity >= 0 && intensity <= 50)) throw new Error('pointLight: intensity — от 0 до 50');
	if (!(distance > 0 && distance <= 200)) throw new Error('pointLight: distance — от 0 до 200');
	if (!HEX_COLOR.test(color)) throw new Error('pointLight: color — ожидается #rrggbb');
	return {
		kind: 'light',
		options: {
			at: o.at,
			attachTo: o.attachTo,
			offset: o.offset ?? [0, 0, 0],
			color: color.toLowerCase(),
			intensity,
			distance,
			flicker: o.flicker ?? false,
			onlyAtNight: o.onlyAtNight ?? false,
		},
	};
}
