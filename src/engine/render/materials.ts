import {
	attribute,
	cos,
	dot,
	float,
	floor,
	hash,
	max,
	mix,
	mx_noise_float,
	normalize,
	normalLocal,
	normalView,
	oneMinus,
	positionLocal,
	positionViewDirection,
	pow,
	saturate,
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

/**
 * Разброс оттенка между вокселями (`Material.vary`). Шум считается по номеру вокселя под
 * фрагментом, поэтому жадное слияние граней его не ломает и палитра не тратится на оттенки.
 * Локальные координаты: у мира это мировые воксели, у сущностей — воксели модели (шум
 * «приклеен» к модели и не плывёт при анимации).
 */
function shadeVariation(color: ReturnType<typeof attribute<'vec3'>>) {
	const vary = attribute('vary', 'float');
	// Центр грани сдвигаем на полшага внутрь — попадаем ровно в свой воксель; +4096 — чтобы
	// отрицательные координаты не ломали беззнаковый хеш.
	const cell = floor(positionLocal.sub(normalLocal.mul(0.5))).add(4096);
	const h1 = hash(cell.x.add(hash(cell.y.add(hash(cell.z).mul(65536))).mul(65536)));
	const h2 = hash(h1.mul(65536).add(17));
	// Крупные пятна (~10 вокселей), чтобы большие поля не выглядели ровной «рябью».
	const patch = mx_noise_float(cell.mul(0.09));
	const shade = max(float(0), float(1).add(vary.mul(h1.sub(0.5).mul(1.6).add(patch.mul(0.9)))));
	// Тёплый/холодный сдвиг: оттенок «дышит», а не только яркость.
	const warm = vary.mul(h2.sub(0.5).add(patch.mul(0.4))).mul(0.5);
	return color.mul(shade).mul(vec3(float(1).add(warm), 1, float(1).sub(warm)));
}

export function createVoxelMaterial(
	layer: VoxelLayer,
	u: AtmosphereUniforms,
): MeshStandardNodeMaterial {
	const material = new MeshStandardNodeMaterial({
		metalness: 0,
		roughness: layer === 'opaque' ? 0.9 : layer === 'water' ? 0.15 : 0.05,
	});
	const color = attribute('color', 'vec3');
	const base = shadeVariation(color).mul(attribute('ao', 'float'));
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
		// Волны только в нормалях: вершины не сдвигаем — у жадных квадов Т-стыки,
		// и сдвиг по синусу раскрывает между ними щели.
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
