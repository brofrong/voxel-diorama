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
