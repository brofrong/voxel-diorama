import {
	clamp,
	color,
	cos,
	float,
	floor,
	hash,
	instanceIndex,
	int,
	ivec2,
	mix,
	oneMinus,
	positionLocal,
	sin,
	smoothstep,
	step,
	textureLoad,
	uniform,
	vec3,
} from 'three/tsl';
import {
	BoxGeometry,
	DataTexture,
	FloatType,
	Group,
	InstancedMesh,
	MeshStandardNodeMaterial,
	RedFormat,
	Vector3,
} from 'three/webgpu';
import type { AtmosphereUniforms, FloatUniform, Vec3Uniform } from '../render/uniforms.ts';
import type { EmitterSpec, Vec3 } from '../types.ts';
import { instanceCount } from './math.ts';

const TAU = Math.PI * 2;

export interface GroundField {
	surface: Int16Array;
	width: number;
	depth: number;
}

interface LiveEmitter {
	spec: EmitterSpec;
	mesh: InstancedMesh;
	origin: Vec3Uniform;
	count: FloatUniform;
	visibility: FloatUniform;
}

/** Частицы без состояния: позиция каждой — функция часов анимации и номера (см. math.ts). */
export class ParticleLayer {
	readonly group = new Group();
	private readonly live: LiveEmitter[] = [];
	private readonly geometry = new BoxGeometry(1, 1, 1);
	private readonly ground: DataTexture;

	constructor(
		specs: EmitterSpec[],
		field: GroundField,
		private readonly u: AtmosphereUniforms,
	) {
		// Частицы садятся на воду и лёд, а не проваливаются до дна.
		const data = Float32Array.from(field.surface);
		this.ground = new DataTexture(data, field.width, field.depth, RedFormat, FloatType);
		this.ground.needsUpdate = true;
		for (const spec of specs) this.live.push(this.createEmitter(spec, field));
	}

	private createEmitter(e: EmitterSpec, field: GroundField): LiveEmitter {
		const origin = uniform(new Vector3(...e.origin));
		const count = uniform(e.count);
		const visibility = uniform(1);
		const material = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });

		const life = float(e.lifetime);
		const idx = float(instanceIndex);
		const local = this.u.time.sub(idx.mul(life.div(count)));
		const cycle = floor(local.div(life));
		const age = local.sub(cycle.mul(life));
		const k = age.div(life);
		const s = idx.mul(7.13).add(cycle.mul(13.7)).add(e.seed);
		const r1 = vec3(hash(s), hash(s.add(1.1)), hash(s.add(2.3)));
		const r2 = vec3(hash(s.add(3.7)), hash(s.add(4.9)), hash(s.add(6.1)));
		const path = origin
			.add(
				r1
					.mul(2)
					.sub(1)
					.mul(vec3(...e.extent)),
			)
			.add(
				vec3(...e.velocity)
					.add(
						r2
							.mul(2)
							.sub(1)
							.mul(vec3(...e.jitter)),
					)
					.mul(age),
			)
			.add(
				vec3(
					sin(age.mul(e.wind.freq).add(r1.x.mul(TAU))).mul(e.wind.amp),
					age.mul(age).mul(0.5 * e.gravity),
					cos(age.mul(e.wind.freq * 0.9).add(r1.z.mul(TAU))).mul(e.wind.amp),
				),
			);
		const groundY = textureLoad(
			this.ground,
			ivec2(
				int(clamp(floor(path.x), 0, field.width - 1)),
				int(clamp(floor(path.z), 0, field.depth - 1)),
			),
		).r;
		const position = e.groundRelative ? vec3(path.x, path.y.add(groundY), path.z) : path;
		let scale = mix(float(e.size[0]), float(e.size[1]), k)
			.mul(smoothstep(0, 0.05, k))
			.mul(oneMinus(smoothstep(0.85, 1, k)))
			.mul(visibility);
		if (e.groundCull) scale = scale.mul(step(groundY, position.y));
		material.positionNode = positionLocal
			.mul(vec3(scale, scale.mul(e.stretch), scale))
			.add(position);

		const tint = mix(color(e.color[0]), color(e.color[1]), k);
		material.colorNode = tint;
		if (e.emissive > 0) {
			const blink = e.blink
				? sin(this.u.time.mul(3).add(r1.y.mul(TAU)))
						.mul(0.5)
						.add(0.5)
				: float(1);
			material.emissiveNode = tint.mul(e.emissive).mul(blink);
		}
		if (e.opacity < 1) {
			material.transparent = true;
			material.depthWrite = false;
			material.opacityNode = float(e.opacity);
		}

		const mesh = new InstancedMesh(this.geometry, material, e.count);
		mesh.frustumCulled = false;
		mesh.castShadow = false;
		this.group.add(mesh);
		return { spec: e, mesh, origin, count, visibility };
	}

	setDensity(density: number): void {
		for (const item of this.live) {
			const n = instanceCount(item.spec.count, density);
			item.mesh.count = n;
			item.count.value = n;
		}
	}

	setEnabled(on: boolean): void {
		this.group.visible = on;
	}

	update(positionOf: (index: number) => Vec3 | null, night: number): void {
		for (const item of this.live) {
			const { spec } = item;
			let visible = spec.nightOnly ? night : 1;
			if (spec.attach !== null) {
				const p = positionOf(spec.attach);
				if (p)
					item.origin.value.set(
						p[0] + spec.offset[0],
						p[1] + spec.offset[1],
						p[2] + spec.offset[2],
					);
				else visible = 0;
			}
			item.visibility.value = visible;
		}
	}

	dispose(): void {
		this.group.removeFromParent();
		for (const item of this.live) {
			(item.mesh.material as MeshStandardNodeMaterial).dispose();
			item.mesh.dispose();
		}
		this.geometry.dispose();
		this.ground.dispose();
	}
}
