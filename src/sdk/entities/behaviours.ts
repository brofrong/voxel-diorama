import type { Vec3 } from '../../engine/types.ts';
import {
	AXIS_INDEX,
	type Behaviour,
	type BehaviourContext,
	type Point,
	type Pose,
	resolvePoint,
	TAU,
	toRadians,
	yawOf,
} from './types.ts';

/** Вращение: `speed` оборотов в секунду вокруг оси. */
export function spin(options: { axis?: 'x' | 'y' | 'z'; speed?: number } = {}): Behaviour {
	const axis = AXIS_INDEX[options.axis ?? 'y'];
	const speed = options.speed ?? 0.25;
	return {
		kind: 'spin',
		positional: false,
		create: () => (pose, t) => {
			pose.rotation[axis] += TAU * speed * t;
		},
	};
}

/** Покачивание вверх-вниз. Фаза по умолчанию случайна (из rng экземпляра). */
export function bob(options: { amp?: number; period?: number; phase?: number } = {}): Behaviour {
	const amp = options.amp ?? 0.25;
	const period = options.period ?? 3;
	return {
		kind: 'bob',
		positional: false,
		create: (ctx) => {
			const phase = options.phase ?? ctx.rng.float(0, TAU);
			return (pose, t) => {
				pose.position[1] += amp * Math.sin((TAU * t) / period + phase);
			};
		},
	};
}

/** Раскачивание вокруг оси на `angle` градусов. */
export function sway(
	options: { axis?: 'x' | 'z'; angle?: number; period?: number; phase?: number } = {},
): Behaviour {
	const axis = AXIS_INDEX[options.axis ?? 'z'];
	const amplitude = toRadians(options.angle ?? 5);
	const period = options.period ?? 4;
	return {
		kind: 'sway',
		positional: false,
		create: (ctx) => {
			const phase = options.phase ?? ctx.rng.float(0, TAU);
			return (pose, t) => {
				pose.rotation[axis] += amplitude * Math.sin((TAU * t) / period + phase);
			};
		},
	};
}

export interface OrbitOptions {
	center: Point;
	radius: number;
	/** Линейная скорость, единиц мира в секунду. */
	speed?: number;
	clockwise?: boolean;
	/** Стартовый угол, радианы. По умолчанию экземпляры равномерно по окружности. */
	phase?: number;
}

/** Движение по окружности; `[x, z]`-центр — по земле (gait walk), иначе в воздухе (gait fly). */
export function orbit(options: OrbitOptions): Behaviour {
	if (!(options.radius > 0)) throw new Error('orbit: radius должен быть > 0');
	const speed = options.speed ?? 2;
	const dir = options.clockwise ? -1 : 1;
	const { radius } = options;
	return {
		kind: 'orbit',
		positional: true,
		create: (ctx) => {
			const center = resolvePoint(options.center, ctx);
			const start = options.phase ?? (ctx.index / ctx.count) * TAU;
			const omega = speed / radius;
			return (pose, t) => {
				const a = start + dir * omega * t;
				const x = center.position[0] + radius * Math.cos(a);
				const z = center.position[2] + radius * Math.sin(a);
				pose.position[0] = x;
				pose.position[1] = center.grounded ? ctx.groundAt(x, z) : center.position[1];
				pose.position[2] = z;
				pose.rotation[1] = yawOf(-Math.sin(a) * dir, Math.cos(a) * dir);
				pose.gait = center.grounded ? 'walk' : 'fly';
				pose.stride = speed * t;
			};
		},
	};
}

export interface Keyframe {
	t: number;
	/** Абсолютная позиция. */
	position?: Vec3;
	/** Градусы, добавляются к позе. */
	rotation?: Vec3;
}

/** Ключевые кадры с линейной интерполяцией. */
export function keyframes(options: { frames: Keyframe[]; loop?: boolean }): Behaviour {
	const frames = options.frames;
	const loop = options.loop ?? true;
	if (frames.length < 2) throw new Error('keyframes: нужно минимум 2 кадра');
	for (let i = 1; i < frames.length; i++) {
		if (!(frames[i].t > frames[i - 1].t)) {
			throw new Error('keyframes: время кадров должно строго возрастать');
		}
	}
	const withPosition = frames.filter((f) => f.position).length;
	const withRotation = frames.filter((f) => f.rotation).length;
	if (withPosition !== 0 && withPosition !== frames.length) {
		throw new Error('keyframes: position должен быть у всех кадров или ни у одного');
	}
	if (withRotation !== 0 && withRotation !== frames.length) {
		throw new Error('keyframes: rotation должен быть у всех кадров или ни у одного');
	}
	const t0 = frames[0].t;
	const t1 = frames[frames.length - 1].t;
	const span = t1 - t0;
	return {
		kind: 'keyframes',
		positional: withPosition > 0,
		create: () => (pose: Pose, t: number) => {
			const tt = loop ? t0 + ((((t - t0) % span) + span) % span) : Math.min(Math.max(t, t0), t1);
			let i = 0;
			while (i < frames.length - 2 && tt >= frames[i + 1].t) i++;
			const a = frames[i];
			const b = frames[i + 1];
			const k = (tt - a.t) / (b.t - a.t);
			if (a.position && b.position) {
				for (let j = 0; j < 3; j++) {
					pose.position[j] = a.position[j] + (b.position[j] - a.position[j]) * k;
				}
			}
			if (a.rotation && b.rotation) {
				for (let j = 0; j < 3; j++) {
					pose.rotation[j] += toRadians(a.rotation[j] + (b.rotation[j] - a.rotation[j]) * k);
				}
			}
		},
	};
}

/** Лазейка: произвольная правка позы. Должна зависеть только от t и ctx (детерминизм). */
export function custom(fn: (pose: Pose, t: number, ctx: BehaviourContext) => void): Behaviour {
	return {
		kind: 'custom',
		positional: false,
		create: (ctx) => (pose, t) => fn(pose, t, ctx),
	};
}

/** Что знает функция части: время, походка и фаза шага (для синхронной ходьбы). */
export interface LimbState {
	/** Время анимации, с. */
	t: number;
	gait: Pose['gait'];
	/** Пройденное расстояние (ед. мира) — растёт только при ходьбе. */
	stride: number;
	/** Фаза шага 0..1 (stride / длина шага rig'а), удобно для `Math.sin(TAU * phase)`. */
	phase: number;
	/** Номер экземпляра — чтобы стадо двигалось не в ногу. */
	index: number;
}

export type LimbFn = (s: LimbState) => readonly [number, number, number];

export interface LimbsOptions {
	/** Части и их повороты в градусах [x, y, z] как функция состояния. */
	parts: Record<string, LimbFn>;
	/** true — эти части не получают встроенную походку (только своё движение). */
	replace?: boolean;
	/** Длина шага для `phase`; по умолчанию — из rig'а (подставляет рантайм). */
	stride?: number;
}

/**
 * Анимация отдельных частей rig'а: помахать рукой, вилять хвостом, извивать змею, бить
 * крыльями дракона. Работает с любым скелетом; у `custom` — единственный источник движения
 * частей. Ставь после поведений движения (walkPath, wander…), чтобы видеть их походку.
 * Функции — только от состояния (детерминизм), без Math.random.
 */
export function limbs(options: LimbsOptions | Record<string, LimbFn>): Behaviour {
	const opts: LimbsOptions =
		'parts' in options && typeof options.parts === 'object'
			? (options as LimbsOptions)
			: { parts: options as Record<string, LimbFn> };
	for (const [name, fn] of Object.entries(opts.parts)) {
		if (typeof fn !== 'function') throw new Error(`limbs: у части "${name}" не функция`);
	}
	return {
		kind: 'limbs',
		positional: false,
		create: (ctx) => (pose, t) => {
			const strideLength = opts.stride ?? pose.strideLength;
			const state: LimbState = {
				t,
				gait: pose.gait,
				stride: pose.stride,
				phase: (((pose.stride / strideLength) % 1) + 1) % 1,
				index: ctx.index,
			};
			for (const [name, fn] of Object.entries(opts.parts)) {
				const [x, y, z] = fn(state);
				const prev = pose.parts[name] ?? [0, 0, 0];
				pose.parts[name] = [prev[0] + toRadians(x), prev[1] + toRadians(y), prev[2] + toRadians(z)];
				if (opts.replace) pose.replace.add(name);
			}
		},
	};
}
