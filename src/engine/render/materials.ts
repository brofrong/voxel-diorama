import { attribute, float } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { BaseStyle } from '../types.ts';
import type { AtmosphereUniforms } from './uniforms.ts';

export type VoxelLayer = 'opaque' | 'water' | 'glass';

const OPACITY: Record<Exclude<VoxelLayer, 'opaque'>, number> = { water: 0.78, glass: 0.35 };

/** Материал вокселей: цвет и AO из вершинных атрибутов, свечение = цвет × emissive × множитель ночи. */
export function createVoxelMaterial(
	layer: VoxelLayer,
	u: AtmosphereUniforms,
): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({
		metalness: 0,
		roughness: layer === 'opaque' ? 0.9 : 0.15,
	});
	const color = attribute('color', 'vec3');
	material.colorNode = color.mul(attribute('ao', 'float'));
	material.emissiveNode = color.mul(attribute('emissive', 'float')).mul(u.emissiveScale);
	if (layer !== 'opaque') {
		material.transparent = true;
		material.depthWrite = false;
		material.opacityNode = float(OPACITY[layer]);
	}
	return material;
}

export function createWorldMaterials(
	u: AtmosphereUniforms,
): Record<VoxelLayer, MeshStandardNodeMaterial> {
	return {
		opaque: createVoxelMaterial('opaque', u),
		water: createVoxelMaterial('water', u),
		glass: createVoxelMaterial('glass', u),
	};
}

export function createBaseMaterial(style: Exclude<BaseStyle, 'none'>): MeshStandardNodeMaterial {
	return new MeshStandardNodeMaterial({
		color: style === 'wood' ? '#6b4a2f' : '#5d5f66',
		roughness: 0.85,
		metalness: 0,
	});
}
