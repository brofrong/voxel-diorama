import { expect, spyOn, test } from 'bun:test';
import { InstancedMesh } from 'three/webgpu';
import { createAtmosphereUniforms } from '../render/uniforms.ts';
import type { EmitterSpec } from '../types.ts';
import { ParticleLayer } from './layer.ts';

const spec: EmitterSpec = {
	id: 'smoke#1',
	seed: 1,
	count: 10,
	lifetime: 6,
	origin: [1, 1, 1],
	extent: [0.1, 0, 0.1],
	velocity: [0, 1, 0],
	jitter: [0, 0, 0],
	gravity: 0,
	wind: { amp: 0, freq: 1 },
	size: [0.2, 0.5],
	color: ['#999999', '#dddddd'],
	emissive: 0,
	opacity: 1,
	stretch: 1,
	blink: false,
	groundRelative: false,
	groundCull: false,
	nightOnly: false,
	attach: null,
	offset: [0, 0, 0],
};

test('dispose освобождает инстанс-меши (буферы матриц)', () => {
	const spy = spyOn(InstancedMesh.prototype, 'dispose');
	const field = { surface: new Int16Array(4), width: 2, depth: 2 };
	const layer = new ParticleLayer(
		[spec, { ...spec, id: 'smoke#2' }],
		field,
		createAtmosphereUniforms(),
	);
	layer.dispose();
	expect(spy).toHaveBeenCalledTimes(2);
	spy.mockRestore();
});
