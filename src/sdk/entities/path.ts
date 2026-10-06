import { type Behaviour, type BehaviourContext, type Point, yawOf } from './types.ts';

export interface WalkPathOptions {
	/** Единиц мира в секунду. */
	speed?: number;
	/** true — замкнутый маршрут; 'pingpong' — туда и обратно. */
	loop?: true | 'pingpong';
	/** Пауза в каждой точке, секунды. */
	pause?: number;
}

interface Waypoint {
	x: number;
	z: number;
	/** null — по земле. */
	y: number | null;
}

interface Leg {
	a: Waypoint;
	b: Waypoint;
	len: number;
	move: number;
	start: number;
	/** Пройденное расстояние к началу ноги. */
	dist: number;
}

function toWaypoint(point: Point, ctx: BehaviourContext): Waypoint {
	// Якоря — точки на земле: ходоки идут по рельефу, а не по высоте якоря.
	if (typeof point === 'string') {
		const a = ctx.anchor(point);
		return { x: a[0], z: a[2], y: null };
	}
	if (point.length === 2) return { x: point[0], z: point[1], y: null };
	return { x: point[0], z: point[2], y: point[1] };
}

/** Ходьба по ломаной с постоянной скоростью; поза — чистая функция от t. */
export function walkPath(points: readonly Point[], options: WalkPathOptions = {}): Behaviour {
	if (points.length < 2) throw new Error('walkPath: нужно минимум 2 точки');
	const speed = options.speed ?? 1;
	if (!(speed > 0)) throw new Error('walkPath: speed должен быть > 0');
	const pause = options.pause ?? 0;
	const mode = options.loop ?? true;
	return {
		kind: 'walkPath',
		positional: true,
		create: (ctx) => {
			const wps = points.map((p) => toWaypoint(p, ctx));
			const route =
				mode === 'pingpong' ? [...wps, ...wps.slice(0, -1).reverse()] : [...wps, wps[0]];
			const legs: Leg[] = [];
			let clock = 0;
			let distance = 0;
			for (let i = 0; i < route.length - 1; i++) {
				const a = route[i];
				const b = route[i + 1];
				const len = Math.hypot(b.x - a.x, b.z - a.z);
				legs.push({ a, b, len, move: len / speed, start: clock, dist: distance });
				clock += len / speed + pause;
				distance += len;
			}
			if (distance === 0) throw new Error('walkPath: все точки маршрута совпадают');
			const cycle = clock;
			const offset = (ctx.index / ctx.count) * cycle;
			return (pose, t) => {
				const total = t + offset;
				const n = Math.floor(total / cycle);
				const tt = total - n * cycle;
				let leg = legs[legs.length - 1];
				for (const l of legs) {
					if (tt < l.start + l.move + pause) {
						leg = l;
						break;
					}
				}
				const local = tt - leg.start;
				const k = leg.move === 0 ? 1 : Math.min(1, local / leg.move);
				const x = leg.a.x + (leg.b.x - leg.a.x) * k;
				const z = leg.a.z + (leg.b.z - leg.a.z) * k;
				pose.position[0] = x;
				pose.position[2] = z;
				pose.position[1] =
					leg.a.y === null || leg.b.y === null
						? ctx.groundAt(x, z)
						: leg.a.y + (leg.b.y - leg.a.y) * k;
				if (leg.len > 0) pose.rotation[1] = yawOf(leg.b.x - leg.a.x, leg.b.z - leg.a.z);
				pose.gait = leg.len > 0 && local < leg.move ? 'walk' : 'idle';
				pose.stride = n * distance + leg.dist + leg.len * k;
			};
		},
	};
}
