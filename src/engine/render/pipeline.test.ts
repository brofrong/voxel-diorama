import { afterEach, expect, spyOn, test } from 'bun:test';
import { PassNode, PerspectiveCamera, Scene, type WebGPURenderer } from 'three/webgpu';
import { createPipeline } from './pipeline.ts';
import { QUALITY_PRESETS } from './quality.ts';

const spies: Array<{ mockRestore(): void }> = [];
afterEach(() => {
	for (const spy of spies.splice(0)) spy.mockRestore();
});

// Сборка узлов не трогает GPU — достаточно пустого рендерера.
const fakeRenderer = {} as WebGPURenderer;

for (const level of ['low', 'medium', 'high'] as const) {
	test(`${level}: dispose освобождает проход сцены (иначе каждая смена качества теряет рендер-таргет)`, () => {
		const spy = spyOn(PassNode.prototype, 'dispose');
		spies.push(spy);
		const pipeline = createPipeline(
			fakeRenderer,
			new Scene(),
			new PerspectiveCamera(),
			QUALITY_PRESETS[level],
		);
		pipeline.dispose();
		expect(spy).toHaveBeenCalled();
	});
}

// Bloom светит только то, что излучает (окна, фонари, огонь): небо и освещённые стены
// раньше попадали в bloom целиком и заливали кадр белой дымкой (реалистичное небо днём).
for (const level of ['medium', 'high'] as const) {
	test(`${level}: bloom берёт эмиссию из отдельного выхода MRT, а не весь кадр`, () => {
		const setMRT = spyOn(PassNode.prototype, 'setMRT');
		const texture = spyOn(PassNode.prototype, 'getTextureNode');
		spies.push(setMRT, texture);
		createPipeline(fakeRenderer, new Scene(), new PerspectiveCamera(), QUALITY_PRESETS[level]);
		const mrt = setMRT.mock.calls[0]?.[0] as { outputNodes?: Record<string, unknown> } | undefined;
		expect(Object.keys(mrt?.outputNodes ?? {})).toContain('emissive');
		expect(texture.mock.calls.map((call) => call[0])).toContain('emissive');
	});
}

test('low: без bloom — без лишнего выхода MRT', () => {
	const setMRT = spyOn(PassNode.prototype, 'setMRT');
	spies.push(setMRT);
	createPipeline(fakeRenderer, new Scene(), new PerspectiveCamera(), QUALITY_PRESETS.low);
	expect(setMRT).not.toHaveBeenCalled();
});
