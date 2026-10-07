import { Group, PointLight } from 'three/webgpu';
import { lightIntensity } from './light-math.ts';
import type { LightSpec, Vec3 } from './types.ts';

/** Точечные источники без теней: мерцание, ночной режим, привязка к сущности. */
export class LightLayer {
	readonly group = new Group();
	private readonly live: Array<{ spec: LightSpec; light: PointLight }> = [];

	constructor(specs: LightSpec[]) {
		for (const spec of specs) {
			const light = new PointLight(spec.color, spec.intensity, spec.distance, 2);
			light.castShadow = false;
			light.position.set(...spec.position);
			this.group.add(light);
			this.live.push({ spec, light });
		}
	}

	update(t: number, night: number, positionOf: (index: number) => Vec3 | null): void {
		for (const { spec, light } of this.live) {
			let intensity = lightIntensity(spec, t, night);
			if (spec.attach !== null) {
				const p = positionOf(spec.attach);
				if (p)
					light.position.set(p[0] + spec.offset[0], p[1] + spec.offset[1], p[2] + spec.offset[2]);
				else intensity = 0;
			}
			light.intensity = intensity;
		}
	}

	dispose(): void {
		this.group.removeFromParent();
		for (const { light } of this.live) light.dispose();
	}
}
