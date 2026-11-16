import { type Behaviour, custom, type Model, model, type Vec3 } from '#sdk';

const TAU = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);

/** Детерминированный «шум» по целым координатам (в моделях нет w.rng). */
export function hash(x: number, y: number, z: number): number {
	const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
	return s - Math.floor(s);
}

/** Огонёк свечи или костра: маленький светящийся язычок. */
export function flame(height: number): Model {
	return model(
		{
			size: [3, height, 3],
			palette: {
				core: { color: '#fff3b0', emissive: 1.6, vary: 0 },
				mid: { color: '#ffb02e', emissive: 1.3, vary: 0.04 },
				tip: { color: '#ff6a1a', emissive: 1.1, vary: 0.06 },
			},
		},
		(m) => {
			for (let y = 0; y < height; y++) {
				const k = y / (height - 1);
				const r = 1.5 * (1 - k) ** 0.9 + 0.3;
				for (let z = 0; z < 3; z++) {
					for (let x = 0; x < 3; x++) {
						if (Math.hypot(x - 1, z - 1) > r) continue;
						m.set([x, y, z], k > 0.6 ? 'tip' : x === 1 && z === 1 ? 'core' : 'mid');
					}
				}
			}
		},
	);
}

/** Дрожание огня: вращение и лёгкий наклон. */
export const flicker: Behaviour = custom((pose, t, ctx) => {
	const s = ctx.index * 2.3;
	pose.rotation[1] = t * 2.8 + s;
	pose.rotation[0] = 0.14 * Math.sin(t * 5.3 + s);
	pose.rotation[2] = 0.14 * Math.sin(t * 4.1 + s * 1.7);
	pose.position[1] += 0.25 * Math.sin(t * 8.7 + s);
});

/** Клуб пара: бугристый шарик в двух тонах. */
export function puff(size: number, dark: string, light: string): Model {
	const n = size * 2 + 1;
	return model(
		{
			size: [n, n, n],
			pivot: [n / 2, n / 2, n / 2],
			palette: {
				dark: { color: dark, vary: 0.05 },
				light: { color: light, vary: 0.05 },
			},
		},
		(m) => {
			m.blob([size, size, size], size, 'dark', { roughness: 0.45, scale: 2.5, seed: size * 7 });
			for (let z = 0; z < n; z++) {
				for (let y = 0; y < n; y++) {
					for (let x = 0; x < n; x++) {
						if (m.get([x, y, z]) === 'dark' && (y > size || hash(x, y, z) < 0.3)) {
							m.set([x, y, z], 'light');
						}
					}
				}
			}
		},
	);
}

export interface RiseOptions {
	origin: Vec3;
	/** Полная высота столба и время подъёма. */
	height: number;
	period: number;
	/** Какую часть высоты занимает этот размер клуба: [от, до] в долях 0..1. */
	band: readonly [number, number];
	/** Снос на вершине столба. */
	drift: readonly [number, number];
}

/**
 * Клубы поднимаются столбом и тают: сущности с клубами разного размера делят высоту
 * на полосы, поэтому клуб «уменьшается» по пути вверх.
 */
export function rise(o: RiseOptions): Behaviour {
	return custom((pose, t, ctx) => {
		const u = fract(t / o.period + ctx.index / ctx.count);
		if (u < o.band[0] || u >= o.band[1]) {
			pose.position[1] = -500;
			return;
		}
		const s = ctx.index * 1.9;
		const spread = 0.6 + 2.4 * u;
		pose.position[0] = o.origin[0] + o.drift[0] * u * u + spread * Math.sin(u * 7 + s);
		pose.position[1] = o.origin[1] + o.height * u;
		pose.position[2] = o.origin[2] + o.drift[1] * u * u + spread * Math.cos(u * 5.5 + s * 1.3);
		pose.rotation[1] = t * 0.6 + s;
		pose.rotation[0] = 0.4 * Math.sin(u * TAU + s);
	});
}
