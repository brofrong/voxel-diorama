import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { boxBlur } from 'three/addons/tsl/display/boxBlur.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { emissive, int, mrt, output, pass, renderOutput, vec4 } from 'three/tsl';
import {
	type Camera,
	type Node,
	RenderPipeline,
	type Scene,
	type WebGPURenderer,
} from 'three/webgpu';
import type { QualityPreset } from './quality.ts';

const BLOOM_STRENGTH = 0.6;

export interface Pipeline {
	render(): void;
	/** Ночью bloom чуть сильнее. */
	setNight(night: number): void;
	dispose(): void;
}

/** Сцена → GTAO (high) → bloom по эмиссии → тональная компрессия → FXAA (low). */
export function createPipeline(
	renderer: WebGPURenderer,
	scene: Scene,
	camera: Camera,
	preset: QualityPreset,
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
		// Радиус — в единицах мира (воксель = 1); половинное разрешение + box blur гасят шум.
		aoPass.radius.value = 1;
		aoPass.resolutionScale = 0.5;
		const aoValue = boxBlur(aoPass.getTextureNode(), { size: int(2), separation: int(1) }).r;
		color = vec4(sceneColor.rgb.mul(aoValue), sceneColor.a);
		extra.push(aoPass);
	}

	let bloomPass: ReturnType<typeof bloom> | null = null;
	if (preset.bloom) {
		bloomPass = bloom(scenePass.getTextureNode('emissive'), BLOOM_STRENGTH, 0.4, 0);
		color = color.add(bloomPass);
		extra.push(bloomPass);
	}

	const pipeline = new RenderPipeline(renderer);
	if (preset.aa === 'fxaa') {
		pipeline.outputColorTransform = false;
		pipeline.outputNode = fxaa(renderOutput(color));
	} else {
		pipeline.outputNode = color;
	}

	return {
		render: () => pipeline.render(),
		setNight(night) {
			if (bloomPass) bloomPass.strength.value = BLOOM_STRENGTH + 0.3 * night;
		},
		dispose() {
			for (const node of extra) node.dispose();
			pipeline.dispose();
		},
	};
}
