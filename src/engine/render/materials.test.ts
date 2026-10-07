import { expect, test } from 'bun:test';
import { createVoxelMaterial } from './materials.ts';
import { createAtmosphereUniforms } from './uniforms.ts';

test('вода не сдвигает вершины: у жадных квадов Т-стыки, сдвиг по синусу открывает щели', () => {
	const water = createVoxelMaterial('water', createAtmosphereUniforms());
	expect(water.positionNode).toBeNull();
	// Рябь остаётся — в нормалях.
	expect(water.normalNode).not.toBeNull();
});
