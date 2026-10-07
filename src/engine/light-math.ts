import type { LightSpec } from './types.ts';

/** Детерминированное мерцание огня: 1 ± 0.25. */
export function flickerFactor(t: number, seed: number): number {
	const n =
		0.5 * Math.sin(t * 7.3 + seed) +
		0.3 * Math.sin(t * 13.1 + seed * 2.1) +
		0.2 * Math.sin(t * 23.7 + seed * 3.7);
	return 1 + 0.25 * n;
}

export function lightIntensity(
	spec: Pick<LightSpec, 'intensity' | 'flicker' | 'nightOnly' | 'seed'>,
	t: number,
	night: number,
): number {
	return (
		spec.intensity * (spec.flicker ? flickerFactor(t, spec.seed) : 1) * (spec.nightOnly ? night : 1)
	);
}
