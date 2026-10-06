import { afterEach, describe, expect, test } from 'bun:test';
import { PAD_VOLUME, padIndex } from './constants.ts';
import { MesherPool } from './mesher-pool.ts';
import { buildPaletteLUT } from './palette.ts';

const lut = buildPaletteLUT([{ color: '#ff0000', emissive: 0, kind: 'solid' }]);

function singleVoxel(): Uint8Array {
	const p = new Uint8Array(PAD_VOLUME);
	p[padIndex(0, 0, 0)] = 1;
	return p;
}

describe('MesherPool', () => {
	let pool: MesherPool | null = null;
	afterEach(() => pool?.dispose());

	test('мешит чанк в воркере', async () => {
		pool = new MesherPool(lut, 2);
		const mesh = await pool.mesh(singleVoxel(), [0, 0, 0]);
		expect(mesh.opaque?.indices.length).toBe(36);
	});

	test('выполняет много задач параллельно', async () => {
		pool = new MesherPool(lut, 2);
		const meshes = await Promise.all(
			Array.from({ length: 10 }, (_, i) => pool?.mesh(singleVoxel(), [i * 32, 0, 0])),
		);
		expect(meshes.every((m) => m?.opaque?.indices.length === 36)).toBe(true);
	});

	test('dispose отклоняет ожидающие задачи', async () => {
		pool = new MesherPool(lut, 1);
		const pending = pool.mesh(singleVoxel(), [0, 0, 0]);
		pool.dispose();
		await expect(pending).rejects.toThrow('уничтожен');
		await expect(pool.mesh(singleVoxel(), [0, 0, 0])).rejects.toThrow('уничтожен');
	});

	test('заменяет упавший воркер', async () => {
		let callCount = 0;
		const { createMeshWorker } = await import('./mesher-pool.ts');
		const factory = () => {
			callCount++;
			if (callCount === 1) {
				return new Worker(new URL('./crash.worker.fixture.ts', import.meta.url), {
					type: 'module',
				});
			}
			return createMeshWorker();
		};
		pool = new MesherPool(lut, 1, factory);
		const firstMesh = pool.mesh(singleVoxel(), [0, 0, 0]);
		await expect(firstMesh).rejects.toThrow('упал');
		const secondMesh = await pool.mesh(singleVoxel(), [0, 0, 0]);
		expect(secondMesh.opaque?.indices.length).toBe(36);
	});
});
