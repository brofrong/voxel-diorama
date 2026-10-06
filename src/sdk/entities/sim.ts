import type { Vec3 } from '../../engine/types.ts';
import { createRng } from '../rng.ts';
import { type Behaviour, type Point, resolvePoint, TAU, yawOf } from './types.ts';

export interface WanderOptions {
	/** [x0, z0, x1, z1] — зона блуждания. */
	area: readonly [number, number, number, number];
	/** Единиц мира в секунду. */
	speed?: number;
	/** [min, max] секунд стоянки после каждого перехода. */
	pause?: readonly [number, number];
}

interface WanderLeg {
	ax: number;
	az: number;
	bx: number;
	bz: number;
	start: number;
	move: number;
	len: number;
	dist: number;
}

/** Случайное блуждание в зоне по земле. Ноги генерируются лениво — поза зависит только от t. */
export function wander(options: WanderOptions): Behaviour {
	const [x0, z0, x1, z1] = options.area;
	if (!(x1 > x0 && z1 > z0))
		throw new Error('wander: area должна быть [x0, z0, x1, z1] с x1 > x0, z1 > z0');
	const speed = options.speed ?? 0.8;
	if (!(speed > 0)) throw new Error('wander: speed должен быть > 0');
	const [pauseMin, pauseMax] = options.pause ?? [1, 3];
	return {
		kind: 'wander',
		positional: true,
		create: (ctx) => {
			const rng = ctx.rng;
			const legs: WanderLeg[] = [];
			let cx = rng.float(x0, x1);
			let cz = rng.float(z0, z1);
			let clock = 0;
			let distance = 0;
			const extendTo = (t: number): void => {
				while (clock <= t) {
					const bx = rng.float(x0, x1);
					const bz = rng.float(z0, z1);
					const len = Math.hypot(bx - cx, bz - cz);
					const move = len / speed;
					legs.push({ ax: cx, az: cz, bx, bz, start: clock, move, len, dist: distance });
					clock += move + rng.float(pauseMin, pauseMax);
					distance += len;
					cx = bx;
					cz = bz;
				}
			};
			return (pose, t) => {
				const tt = Math.max(0, t);
				extendTo(tt);
				let lo = 0;
				let hi = legs.length - 1;
				while (lo < hi) {
					const mid = (lo + hi + 1) >> 1;
					if (legs[mid].start <= tt) lo = mid;
					else hi = mid - 1;
				}
				const leg = legs[lo];
				const local = tt - leg.start;
				const k = leg.move === 0 ? 1 : Math.min(1, local / leg.move);
				const x = leg.ax + (leg.bx - leg.ax) * k;
				const z = leg.az + (leg.bz - leg.az) * k;
				pose.position[0] = x;
				pose.position[1] = ctx.groundAt(x, z);
				pose.position[2] = z;
				if (leg.len > 0) pose.rotation[1] = yawOf(leg.bx - leg.ax, leg.bz - leg.az);
				pose.gait = local < leg.move ? 'walk' : 'idle';
				pose.stride = leg.dist + leg.len * k;
			};
		},
	};
}

export interface FlockOptions {
	center: Point;
	radius: number;
	/** Крейсерская скорость, единиц мира в секунду. */
	speed?: number;
}

export const FLOCK_DT = 1 / 60;

interface FlockState {
	pos: Vec3[];
	vel: Vec3[];
}

/** Boids с фиксированным шагом: состояние в момент t зависит только от seed и t. */
class FlockSim {
	private state: FlockState;
	private steps = 0;

	constructor(
		private readonly count: number,
		private readonly center: Vec3,
		private readonly radius: number,
		private readonly speed: number,
		private readonly seed: number,
		private readonly groundAt: (x: number, z: number) => number,
	) {
		this.state = this.initial();
	}

	private initial(): FlockState {
		const rng = createRng(this.seed);
		const pos: Vec3[] = [];
		const vel: Vec3[] = [];
		for (let i = 0; i < this.count; i++) {
			const a = rng.float(0, TAU);
			const r = this.radius * 0.5 * rng.next();
			const h = rng.float(-0.25, 0.25) * this.radius;
			pos.push([
				this.center[0] + r * Math.cos(a),
				this.center[1] + h,
				this.center[2] + r * Math.sin(a),
			]);
			const heading = rng.float(0, TAU);
			vel.push([this.speed * Math.cos(heading), 0, this.speed * Math.sin(heading)]);
		}
		return { pos, vel };
	}

	at(t: number): FlockState {
		const target = Math.max(0, Math.floor(t / FLOCK_DT + 1e-9));
		if (target < this.steps) {
			this.state = this.initial();
			this.steps = 0;
		}
		while (this.steps < target) {
			this.step();
			this.steps++;
		}
		return this.state;
	}

	private step(): void {
		const { pos, vel } = this.state;
		const n = this.count;
		const acc: Vec3[] = [];
		for (let i = 0; i < n; i++) {
			const sep: Vec3 = [0, 0, 0];
			const ali: Vec3 = [0, 0, 0];
			const coh: Vec3 = [0, 0, 0];
			let neighbours = 0;
			for (let j = 0; j < n; j++) {
				if (j === i) continue;
				const dx = pos[j][0] - pos[i][0];
				const dy = pos[j][1] - pos[i][1];
				const dz = pos[j][2] - pos[i][2];
				const d = Math.hypot(dx, dy, dz);
				if (d < 6) {
					neighbours++;
					for (let k = 0; k < 3; k++) {
						ali[k] += vel[j][k];
						coh[k] += pos[j][k];
					}
					if (d > 0 && d < 2) {
						sep[0] -= dx / (d * d);
						sep[1] -= dy / (d * d);
						sep[2] -= dz / (d * d);
					}
				}
			}
			const a: Vec3 = [0, 0, 0];
			for (let k = 0; k < 3; k++) {
				if (neighbours > 0) {
					a[k] += (ali[k] / neighbours - vel[i][k]) * 0.5;
					a[k] += (coh[k] / neighbours - pos[i][k]) * 0.3;
				}
				a[k] += sep[k] * 2;
			}
			const toCenter: Vec3 = [
				this.center[0] - pos[i][0],
				this.center[1] - pos[i][1],
				this.center[2] - pos[i][2],
			];
			const dc = Math.hypot(toCenter[0], toCenter[1], toCenter[2]);
			const soft = this.radius * 0.6;
			if (dc > soft) {
				for (let k = 0; k < 3; k++) a[k] += (toCenter[k] / dc) * (dc - soft) * 0.8;
			}
			const floor = this.groundAt(pos[i][0], pos[i][2]) + 2;
			if (pos[i][1] < floor) a[1] += (floor - pos[i][1]) * 3;
			acc.push(a);
		}
		const minSpeed = this.speed * 0.6;
		for (let i = 0; i < n; i++) {
			for (let k = 0; k < 3; k++) vel[i][k] += acc[i][k] * FLOCK_DT;
			const s = Math.hypot(vel[i][0], vel[i][1], vel[i][2]);
			const clamped = s > this.speed ? this.speed : s < minSpeed && s > 0 ? minSpeed : s;
			if (s > 0 && clamped !== s) for (let k = 0; k < 3; k++) vel[i][k] *= clamped / s;
			for (let k = 0; k < 3; k++) pos[i][k] += vel[i][k] * FLOCK_DT;
		}
	}
}

/** Стая: все `count` экземпляров сущности летают вместе вокруг центра. */
export function flock(options: FlockOptions): Behaviour {
	if (!(options.radius > 0)) throw new Error('flock: radius должен быть > 0');
	const speed = options.speed ?? 4;
	const sims = new Map<number, FlockSim>();
	return {
		kind: 'flock',
		positional: true,
		create: (ctx) => {
			let sim = sims.get(ctx.groupSeed);
			if (!sim) {
				const c = resolvePoint(options.center, ctx);
				const center: Vec3 = c.grounded
					? [c.position[0], c.position[1] + options.radius / 2, c.position[2]]
					: c.position;
				sim = new FlockSim(ctx.count, center, options.radius, speed, ctx.groupSeed, ctx.groundAt);
				sims.set(ctx.groupSeed, sim);
			}
			const s = sim;
			const i = ctx.index;
			return (pose, t) => {
				const state = s.at(t);
				const p = state.pos[i];
				const v = state.vel[i];
				pose.position[0] = p[0];
				pose.position[1] = p[1];
				pose.position[2] = p[2];
				pose.rotation[1] = yawOf(v[0], v[2]);
				pose.rotation[0] = -Math.atan2(v[1], Math.hypot(v[0], v[2])) * 0.5;
				pose.gait = 'fly';
				pose.stride = speed * t;
			};
		},
	};
}
