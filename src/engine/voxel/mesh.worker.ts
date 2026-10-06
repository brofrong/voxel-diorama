import type { Vec3 } from '../types.ts';
import { type ChunkMesh, meshChunk, meshTransferables } from './mesher.ts';
import type { PaletteLUT } from './palette.ts';

export type WorkerRequest =
	| { type: 'init'; lut: PaletteLUT }
	| { type: 'mesh'; id: number; padded: Uint8Array; origin: Vec3 };

export type WorkerResponse = { id: number; mesh: ChunkMesh } | { id: number; error: string };

let lut: PaletteLUT | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const msg = event.data;
	if (msg.type === 'init') {
		lut = msg.lut;
		return;
	}
	try {
		if (!lut) throw new Error('mesh worker: палитра не инициализирована');
		const mesh = meshChunk(msg.padded, lut, msg.origin);
		const response: WorkerResponse = { id: msg.id, mesh };
		postMessage(response, { transfer: meshTransferables(mesh) });
	} catch (error) {
		const response: WorkerResponse = {
			id: msg.id,
			error: error instanceof Error ? error.message : String(error),
		};
		postMessage(response);
	}
};
