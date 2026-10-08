import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { boxBlur } from 'three/addons/tsl/display/boxBlur.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import {
	abs,
	emissive,
	float,
	int,
	length,
	luminance,
	mix,
	mrt,
	oneMinus,
	output,
	pass,
	pow,
	renderOutput,
	screenUV,
	smoothstep,
	vec3,
	vec4,
	vibrance,
} from 'three/tsl';
import {
	type Camera,
	type Node,
	RenderPipeline,
	type Scene,
	type WebGPURenderer,
} from 'three/webgpu';
import type { QualityPreset } from './quality.ts';

/**
 * Bloom: мягкий ореол только у ярко светящегося. Ночью свечение материалов и так в 1.5 раза
 * ярче (emissiveScale), поэтому силу bloom ночью почти не поднимаем — иначе неон и окна
 * расплываются в сплошное зарево.
 */
export const BLOOM = {
	strength: 0.35,
	/** Прибавка к силе ночью. */
	night: 0.05,
	/** Радиус ореола 0..1: меньше — ореол плотнее к источнику. */
	radius: 0.2,
	/** Порог яркости: тусклые окна и разметка не светятся ореолом. */
	threshold: 0.15,
};

/** Цветокоррекция кадра (после тонмаппинга, в sRGB). */
export const GRADE = {
	/** Насыщенность бледных цветов (vibrance): яркие не «перегорают». */
	vibrance: 0.25,
	/** Подкраска теней: в пастельных миниатюрах тени не серые, а чуть сиреневые. */
	shadowTint: [0.012, 0.004, 0.02] as const,
	/** Затемнение углов кадра. */
	vignette: 0.22,
};

export interface PipelineOptions {
	/** 0..1 — размытие верха и низа кадра (эффект миниатюры); 0 — выключено. */
	tiltShift: number;
}

export interface Pipeline {
	render(): void;
	/** Ночью bloom чуть сильнее. */
	setNight(night: number): void;
	dispose(): void;
}

/** sRGB-кадр → лёгкая насыщенность, тёплые/сиреневые тени, виньетка. */
function grade(color: Node<'vec4'>): Node<'vec4'> {
	const rgb = vibrance(color.rgb, float(GRADE.vibrance));
	const shadows = pow(oneMinus(luminance(rgb)), 3);
	const tinted = rgb.add(vec3(...GRADE.shadowTint).mul(shadows));
	const edge = smoothstep(0.35, 0.85, length(screenUV.sub(0.5)));
	return vec4(tinted.mul(oneMinus(edge.mul(GRADE.vignette))), color.a);
}

/**
 * Сцена → GTAO (high) → bloom по эмиссии → tilt-shift (medium+, если задан) →
 * тонмаппинг → цветокоррекция → FXAA (low/high).
 */
export function createPipeline(
	renderer: WebGPURenderer,
	scene: Scene,
	camera: Camera,
	preset: QualityPreset,
	options: PipelineOptions = { tiltShift: 0 },
): Pipeline {
	const samples = preset.aa === 'msaa2' ? 2 : 0;
	const scenePass = pass(scene, camera, { samples });
	// Bloom светит только излучающее (окна, фонари, огонь, неон). Если подать весь кадр,
	// яркое небо и освещённые стены (выше порога) заливают картинку белой дымкой.
	if (preset.bloom) scenePass.setMRT(mrt({ output, emissive }));
	const sceneColor = scenePass.getTextureNode('output');
	let color: Node<'vec4'> = sceneColor;
	// Проход сцены владеет полноразмерным рендер-таргетом — освобождаем вместе с конвейером.
	const extra: Array<{ dispose(): void }> = [scenePass];

	if (preset.gtao) {
		// Нормали восстанавливаются из глубины: GTAONode принимает normalNode = null,
		// а @types/three требует Node.
		const noNormals = null as unknown as Node;
		const aoPass = ao(scenePass.getTextureNode('depth'), noNormals, camera);
		// Радиус — в единицах мира (воксель = 1): 1.6 даёт мягкую «грязь» в углах и под
		// свесами, как в миниатюрах. Половинное разрешение + box blur гасят шум.
		aoPass.radius.value = 1.6;
		aoPass.scale.value = 1.15;
		aoPass.resolutionScale = 0.5;
		const aoValue = boxBlur(aoPass.getTextureNode(), { size: int(2), separation: int(1) }).r;
		color = vec4(sceneColor.rgb.mul(aoValue), sceneColor.a);
		extra.push(aoPass);
	}

	let bloomPass: ReturnType<typeof bloom> | null = null;
	if (preset.bloom) {
		// Мягкое сжатие входа x / (1 + x): большие яркие площади (стены неона) не «выгорают».
		const glow = scenePass.getTextureNode('emissive');
		const soft = vec4(glow.rgb.div(glow.rgb.add(1)), glow.a);
		bloomPass = bloom(soft, BLOOM.strength, BLOOM.radius, BLOOM.threshold);
		color = color.add(bloomPass);
		extra.push(bloomPass);
	}

	// Tilt-shift: резкая полоса по центру, к верху и низу кадра — размытие. Только medium+.
	if (options.tiltShift > 0 && preset.bloom) {
		const blurred = gaussianBlur(color, null as unknown as Node, 4, { resolutionScale: 0.5 });
		const band = smoothstep(0.12, 0.5, abs(screenUV.y.sub(0.55))).mul(options.tiltShift);
		color = mix(color, blurred, band);
		extra.push(blurred);
	}

	const pipeline = new RenderPipeline(renderer);
	pipeline.outputColorTransform = false;
	const graded = grade(renderOutput(color));
	pipeline.outputNode = preset.aa === 'fxaa' ? fxaa(graded) : graded;

	return {
		render: () => pipeline.render(),
		setNight(night) {
			if (bloomPass) bloomPass.strength.value = BLOOM.strength + BLOOM.night * night;
		},
		dispose() {
			for (const node of extra) node.dispose();
			pipeline.dispose();
		},
	};
}
