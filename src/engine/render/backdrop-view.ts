import { uniform } from 'three/tsl';
import {
	BoxGeometry,
	Color,
	Group,
	InstancedMesh,
	Matrix4,
	MeshStandardNodeMaterial,
	Quaternion,
	type Scene,
	Vector3,
} from 'three/webgpu';
import { type BackdropBox, backdropLayout } from '../atmosphere/backdrop.ts';
import type { BackdropConfig, Vec3 } from '../types.ts';

const DEFAULT_MOUNTAIN = '#7d8ca6';
/** Облака медленно плывут вокруг диорамы: оборот примерно за полчаса. */
const CLOUD_DRIFT = (Math.PI * 2) / 1800;

export interface BackdropView {
	/** time — часы анимации (с); night — 0..1. */
	update(time: number, night: number): void;
	dispose(): void;
}

function boxes(
	list: BackdropBox[],
	geometry: BoxGeometry,
	material: MeshStandardNodeMaterial,
): InstancedMesh | null {
	if (list.length === 0) return null;
	const mesh = new InstancedMesh(geometry, material, list.length);
	const m = new Matrix4();
	const q = new Quaternion();
	const color = new Color();
	list.forEach((b, i) => {
		m.compose(new Vector3(...b.center), q, new Vector3(...b.size));
		mesh.setMatrixAt(i, m);
		mesh.setColorAt(i, color.setScalar(b.shade));
	});
	mesh.computeBoundingSphere();
	return mesh;
}

/** Задник диорамы (облака, облачное море, горы) — освещённые воксели, тонущие в дымке. */
export function createBackdropView(
	config: BackdropConfig,
	size: Vec3,
	seed: number,
	scene: Scene,
): BackdropView | null {
	if (config.clouds <= 0 && config.mountains <= 0 && !config.cloudSea) return null;
	const layout = backdropLayout(config, size, seed);
	const root = new Group();
	root.position.set(size[0] / 2, 0, size[2] / 2);
	const drifting = new Group();
	root.add(drifting);

	const geometry = new BoxGeometry(1, 1, 1);
	// Облака подсвечены изнутри — иначе теневые бока выходят грязно-серыми.
	const glow = uniform(0.35);
	const cloudMaterial = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1 });
	cloudMaterial.emissiveNode = uniform(new Color('#ffffff')).mul(glow);
	const mountainMaterial = new MeshStandardNodeMaterial({
		color: config.mountainColor ?? DEFAULT_MOUNTAIN,
		roughness: 1,
	});
	const snowMaterial = new MeshStandardNodeMaterial({ color: '#f4f6fb', roughness: 1 });

	const meshes = [
		[boxes(layout.clouds, geometry, cloudMaterial), drifting],
		[boxes(layout.cloudSea, geometry, cloudMaterial), root],
		[boxes(layout.mountains, geometry, mountainMaterial), root],
		[boxes(layout.snow, geometry, snowMaterial), root],
	] as const;
	for (const [mesh, parent] of meshes) if (mesh) parent.add(mesh);
	scene.add(root);

	return {
		update(time, night) {
			drifting.rotation.y = time * CLOUD_DRIFT;
			glow.value = 0.35 * (1 - night) + 0.04;
		},
		dispose() {
			scene.remove(root);
			for (const [mesh] of meshes) mesh?.dispose();
			geometry.dispose();
			cloudMaterial.dispose();
			mountainMaterial.dispose();
			snowMaterial.dispose();
		},
	};
}
