import {
	attribute,
	cos,
	dot,
	float,
	mix,
	normalize,
	normalLocal,
	normalView,
	oneMinus,
	positionLocal,
	positionViewDirection,
	pow,
	saturate,
	sin,
	step,
	transformNormalToView,
	vec3,
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { BaseStyle } from '../types.ts';
import type { AtmosphereUniforms } from './uniforms.ts';

export type VoxelLayer = 'opaque' | 'water' | 'glass';

const WAVE_AMPLITUDE = 0.08;

/** Френель: 0 при взгляде в лоб, 1 по касательной. */
const fresnel = () => pow(oneMinus(saturate(dot(normalView, positionViewDirection))), 3);

export function createVoxelMaterial(
	layer: VoxelLayer,
	u: AtmosphereUniforms,
): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({
		metalness: 0,
		roughness: layer === 'opaque' ? 0.9 : layer === 'water' ? 0.15 : 0.05,
	});
	const color = attribute('color', 'vec3');
	const base = color.mul(attribute('ao', 'float'));
	material.emissiveNode = color.mul(attribute('emissive', 'float')).mul(u.emissiveScale);

	if (layer === 'opaque') {
		material.colorNode = base;
		return material;
	}

	material.transparent = true;
	material.depthWrite = false;

	if (layer === 'water') {
		// Меши чанков стоят в начале координат: локальные координаты = мировые.
		const p = positionLocal;
		const isTop = step(0.5, normalLocal.y);
		const a1 = p.x.mul(0.45).add(u.time.mul(1.3));
		const a2 = p.z.mul(0.6).sub(u.time.mul(1.1)).add(p.x.mul(0.2));
		const a3 = p.x.add(p.z).mul(0.9).add(u.time.mul(2.1));
		const amp = float(WAVE_AMPLITUDE).mul(u.waves).mul(isTop);
		const height = sin(a1).mul(0.5).add(sin(a2).mul(0.35)).add(sin(a3).mul(0.15)).mul(amp);
		material.positionNode = p.add(vec3(0, height, 0));
		const dx = cos(a1)
			.mul(0.45 * 0.5)
			.add(cos(a2).mul(0.2 * 0.35))
			.add(cos(a3).mul(0.9 * 0.15))
			.mul(amp);
		const dz = cos(a2)
			.mul(0.6 * 0.35)
			.add(cos(a3).mul(0.9 * 0.15))
			.mul(amp);
		const waveNormal = normalize(vec3(dx.negate(), 1, dz.negate()));
		material.normalNode = transformNormalToView(mix(normalLocal, waveNormal, isTop));
		material.colorNode = mix(base, u.horizon, fresnel().mul(0.6));
		material.opacityNode = float(0.78);
		return material;
	}

	// glass
	material.colorNode = base;
	material.opacityNode = float(0.35).add(fresnel().mul(0.4));
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
