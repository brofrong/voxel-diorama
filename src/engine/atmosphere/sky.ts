import { mix, normalize, positionLocal, smoothstep, uniform } from 'three/tsl';
import { BackSide, Color, Mesh, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu';

export interface Sky {
	mesh: Mesh;
	setColors(zenith: string, horizon: string): void;
	dispose(): void;
}

/** Сфера неба с градиентом горизонт → зенит. Каждый кадр двигается вместе с камерой. */
export function createSky(radius: number): Sky {
	const zenith = uniform(new Color());
	const horizon = uniform(new Color());
	const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
	material.colorNode = mix(horizon, zenith, smoothstep(-0.05, 0.6, normalize(positionLocal).y));
	const geometry = new SphereGeometry(radius, 32, 16);
	const mesh = new Mesh(geometry, material);
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	return {
		mesh,
		setColors(z, h) {
			zenith.value.set(z);
			horizon.value.set(h);
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}
