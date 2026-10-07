import { type BufferGeometry, Group, Mesh, type MeshStandardNodeMaterial } from 'three/webgpu';
import type { VoxelLayer } from '../render/materials.ts';
import type { EntityInstance, VoxelModelData } from '../types.ts';
import { toGeometry } from '../world-mesh.ts';
import { meshModel } from './model-mesh.ts';

interface LiveInstance {
	instance: EntityInstance;
	root: Group;
	joints: Group[];
	frozen: boolean;
}

/** Сущности сцены: граф объектов и раскладка поз каждый кадр. */
export class EntityLayer {
	readonly group = new Group();
	private readonly live: LiveInstance[] = [];
	private readonly geometries = new Map<
		VoxelModelData,
		Array<{ layer: VoxelLayer; geometry: BufferGeometry }>
	>();

	constructor(
		instances: EntityInstance[],
		private readonly materials: Record<VoxelLayer, MeshStandardNodeMaterial>,
	) {
		for (const instance of instances) {
			const root = new Group();
			root.rotation.order = 'YXZ';
			// Скрыт, пока не придёт первая успешная поза (чтобы не мигнуть T-pose в начале координат).
			root.visible = false;
			const joints: Group[] = [];
			instance.parts.forEach((spec) => {
				const joint = new Group();
				joint.position.set(spec.attach[0], spec.attach[1], spec.attach[2]);
				const { scale, pivot } = spec.model;
				for (const { layer, geometry } of this.geometryFor(spec.model)) {
					const mesh = new Mesh(geometry, this.materials[layer]);
					mesh.scale.setScalar(scale);
					mesh.position.set(-pivot[0] * scale, -pivot[1] * scale, -pivot[2] * scale);
					mesh.castShadow = layer === 'opaque';
					mesh.receiveShadow = layer !== 'glass';
					joint.add(mesh);
				}
				(spec.parent < 0 ? root : joints[spec.parent]).add(joint);
				joints.push(joint);
			});
			this.group.add(root);
			this.live.push({ instance, root, joints, frozen: false });
		}
	}

	private geometryFor(
		model: VoxelModelData,
	): Array<{ layer: VoxelLayer; geometry: BufferGeometry }> {
		const cached = this.geometries.get(model);
		if (cached) return cached;
		const list: Array<{ layer: VoxelLayer; geometry: BufferGeometry }> = [];
		for (const chunk of meshModel(model)) {
			for (const layer of ['opaque', 'water', 'glass'] as const) {
				const data = chunk[layer];
				if (data) list.push({ layer, geometry: toGeometry(data) });
			}
		}
		this.geometries.set(model, list);
		return list;
	}

	update(t: number): void {
		for (const item of this.live) {
			if (item.frozen) continue;
			try {
				const pose = item.instance.pose(t);
				item.root.position.set(pose.position[0], pose.position[1] + pose.lift, pose.position[2]);
				item.root.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2]);
				pose.parts.forEach((r, i) => {
					item.joints[i]?.rotation.set(r[0], r[1], r[2]);
				});
				item.root.visible = true;
			} catch (error) {
				item.frozen = true;
				console.error(`[diorama] сущность ${item.instance.id} остановлена:`, error);
			}
		}
	}

	dispose(): void {
		this.group.removeFromParent();
		for (const list of this.geometries.values()) {
			for (const { geometry } of list) geometry.dispose();
		}
		this.geometries.clear();
	}
}
