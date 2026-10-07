import type {
	AtmosphereContext,
	AtmosphereSpec,
	EmitterSpec,
	LightSpec,
	Vec3,
} from '../../engine/types.ts';
import { type Point, resolvePoint } from '../entities/types.ts';
import type { LightDef } from './lights.ts';
import { type Area, PARTICLE_TEMPLATES, type ParticleDef } from './particles.ts';

export const ATMOSPHERE_LIMITS = { emitters: 32, lights: 8, particles: 20000 } as const;

const SIZE_SCALE = { small: 0.6, medium: 1, large: 1.6 } as const;

interface Source {
	seed: number;
	size: Vec3;
	particles: readonly ParticleDef[];
	lights: readonly LightDef[];
}

function anchorLookup(ctx: AtmosphereContext): (name: string) => Vec3 {
	const names = Object.keys(ctx.anchors);
	return (name) => {
		const p = ctx.anchors[name];
		if (!p) throw new Error(`неизвестный якорь "${name}". Есть: ${names.join(', ') || '(нет)'}`);
		return [p[0], p[1], p[2]];
	};
}

function attachIndex(id: string, ids: readonly string[]): number {
	const exact = ids.indexOf(id);
	if (exact >= 0) return exact;
	const many = ids.filter((e) => e.startsWith(`${id}[`));
	if (many.length > 0) {
		throw new Error(
			`attachTo "${id}": у сущности несколько экземпляров — укажи ${id}[0]…${id}[${many.length - 1}]`,
		);
	}
	throw new Error(`attachTo: неизвестная сущность "${id}". Есть: ${ids.join(', ') || '(нет)'}`);
}

function place(
	at: Point | undefined,
	attachTo: string | undefined,
	ctx: AtmosphereContext,
): { origin: Vec3; attach: number | null } {
	if (attachTo !== undefined)
		return { origin: [0, 0, 0], attach: attachIndex(attachTo, ctx.entityIds) };
	const resolved = resolvePoint(at as Point, { groundAt: ctx.groundAt, anchor: anchorLookup(ctx) });
	return { origin: resolved.position, attach: null };
}

const emitterSeed = (seed: number, index: number): number =>
	((seed * 31 + index * 7919) >>> 0) % 100_000;

function emitter(
	def: ParticleDef,
	index: number,
	src: Source,
	ctx: AtmosphereContext,
): EmitterSpec {
	const t = PARTICLE_TEMPLATES[def.preset];
	const color: [string, string] = [t.color[0], t.color[1]];
	const common = {
		id: `${def.preset}#${index + 1}`,
		seed: emitterSeed(src.seed, index),
		velocity: [...t.velocity] as Vec3,
		jitter: [...t.jitter] as Vec3,
		gravity: t.gravity,
		wind: { ...t.wind },
		emissive: t.emissive,
		opacity: t.opacity,
		stretch: t.stretch,
		blink: t.blink,
		groundRelative: t.groundRelative,
		groundCull: t.groundCull,
	};

	if (def.point) {
		const o = def.point;
		const k = SIZE_SCALE[o.size ?? 'medium'];
		const { origin, attach } = place(o.at, o.attachTo, ctx);
		const c = o.color ?? null;
		return {
			...common,
			count: Math.max(1, Math.round((o.rate ?? t.rate ?? 1) * t.lifetime)),
			lifetime: t.lifetime,
			origin,
			extent: [t.extent[0] * k, t.extent[1], t.extent[2] * k],
			size: [t.size[0] * k, t.size[1] * k],
			color: c ? [c, c] : color,
			nightOnly: o.onlyAtNight ?? t.nightOnly,
			attach,
			offset: o.offset ? [...o.offset] : [0, 0, 0],
		};
	}

	const o = def.area ?? {};
	const [x0, z0, x1, z1]: Area = o.area ?? [0, 0, src.size[0], src.size[2]];
	const cells = (x1 - x0) * (z1 - z0);
	const count =
		o.count ??
		t.count ??
		Math.max(1, Math.round(cells * (t.density ?? 0) * (o.intensity ?? t.intensity ?? 1)));
	const top = src.size[1];
	let lifetime = t.lifetime;
	let y = 0;
	let ey = 0;
	if (t.fall) {
		// Жизнь — по самым медленным частицам: заканчивает падение земля, а не кривая жизни.
		lifetime = top / Math.max(0.1, t.fall - t.jitter[1]);
		y = top;
	} else if (t.band) {
		const hi = o.height ?? t.band[1];
		y = (t.band[0] + hi) / 2;
		ey = (hi - t.band[0]) / 2;
	}
	const c = o.color ?? null;
	return {
		...common,
		count,
		lifetime,
		origin: [(x0 + x1) / 2, y, (z0 + z1) / 2],
		extent: [(x1 - x0) / 2, ey, (z1 - z0) / 2],
		size: [t.size[0], t.size[1]],
		color: c ? [c, c] : color,
		nightOnly: o.onlyAtNight ?? t.nightOnly,
		attach: null,
		offset: [0, 0, 0],
	};
}

/** Разворачивает частицы и свет диорамы в данные для движка. Ошибки называют эмиттер/источник. */
export function createAtmosphereRuntime(src: Source, ctx: AtmosphereContext): AtmosphereSpec {
	if (src.particles.length > ATMOSPHERE_LIMITS.emitters) {
		throw new Error(
			`слишком много эмиттеров частиц: ${src.particles.length} (максимум ${ATMOSPHERE_LIMITS.emitters})`,
		);
	}
	if (src.lights.length > ATMOSPHERE_LIMITS.lights) {
		throw new Error(
			`слишком много источников света: ${src.lights.length} (максимум ${ATMOSPHERE_LIMITS.lights})`,
		);
	}
	const emitters = src.particles.map((def, i) => {
		try {
			return emitter(def, i, src, ctx);
		} catch (error) {
			const text = error instanceof Error ? error.message : String(error);
			throw new Error(`particles[${i}] ${def.preset}: ${text}`, { cause: error });
		}
	});
	const total = emitters.reduce((n, e) => n + e.count, 0);
	if (total > ATMOSPHERE_LIMITS.particles) {
		throw new Error(
			`слишком много частиц: ${total} (максимум ${ATMOSPHERE_LIMITS.particles}) — уменьши intensity, count или rate`,
		);
	}
	const lights: LightSpec[] = src.lights.map((def, i) => {
		const o = def.options;
		try {
			const { origin, attach } = place(o.at, o.attachTo, ctx);
			return {
				id: `light#${i + 1}`,
				seed: i * 17 + 3,
				position: origin,
				color: o.color,
				intensity: o.intensity,
				distance: o.distance,
				flicker: o.flicker,
				nightOnly: o.onlyAtNight,
				attach,
				offset: [...o.offset] as Vec3,
			};
		} catch (error) {
			const text = error instanceof Error ? error.message : String(error);
			throw new Error(`lights[${i}]: ${text}`, { cause: error });
		}
	});
	return { emitters, lights };
}
