import type { Vec3 } from '../types.ts';
import type { WorkerRequest, WorkerResponse } from './mesh.worker.ts';
import type { ChunkMesh } from './mesher.ts';
import type { PaletteLUT } from './palette.ts';

interface Job {
	id: number;
	padded: Uint8Array;
	origin: Vec3;
	resolve: (mesh: ChunkMesh) => void;
	reject: (error: Error) => void;
}

export function defaultPoolSize(): number {
	const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
	return Math.max(1, Math.min(4, cores - 1));
}

export function createMeshWorker(): Worker {
	return new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' });
}

/** Очередь задач мешинга поверх нескольких воркеров. */
export class MesherPool {
	private readonly workers: Worker[] = [];
	private readonly idle: Worker[] = [];
	private readonly queue: Job[] = [];
	private readonly active = new Map<number, { job: Job; worker: Worker }>();
	private nextId = 1;
	private disposed = false;
	private readonly lut: PaletteLUT;
	private readonly createWorker: () => Worker;

	constructor(lut: PaletteLUT, size = defaultPoolSize(), createWorker = createMeshWorker) {
		this.lut = lut;
		this.createWorker = createWorker;
		for (let i = 0; i < size; i++) {
			this.spawnWorker();
		}
	}

	mesh(padded: Uint8Array, origin: Vec3): Promise<ChunkMesh> {
		if (this.disposed) return Promise.reject(new Error('MesherPool уничтожен'));
		return new Promise((resolve, reject) => {
			this.queue.push({ id: this.nextId++, padded, origin, resolve, reject });
			this.pump();
		});
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const worker of this.workers) worker.terminate();
		const error = new Error('MesherPool уничтожен');
		for (const job of this.queue) job.reject(error);
		for (const { job } of this.active.values()) job.reject(error);
		this.queue.length = 0;
		this.active.clear();
	}

	private spawnWorker(): void {
		const worker = this.createWorker();
		worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.onResult(worker, event.data);
		worker.onerror = (event: ErrorEvent) => this.onCrash(worker, event);
		const init: WorkerRequest = { type: 'init', lut: this.lut };
		worker.postMessage(init);
		this.workers.push(worker);
		this.idle.push(worker);
	}

	private pump(): void {
		while (!this.disposed && this.idle.length > 0 && this.queue.length > 0) {
			const worker = this.idle.pop() as Worker;
			const job = this.queue.shift() as Job;
			this.active.set(job.id, { job, worker });
			const request: WorkerRequest = {
				type: 'mesh',
				id: job.id,
				padded: job.padded,
				origin: job.origin,
			};
			worker.postMessage(request, [job.padded.buffer as ArrayBuffer]);
		}
	}

	private onResult(worker: Worker, response: WorkerResponse): void {
		const entry = this.active.get(response.id);
		if (!entry) return;
		this.active.delete(response.id);
		this.idle.push(worker);
		if ('error' in response) entry.job.reject(new Error(response.error));
		else entry.job.resolve(response.mesh);
		this.pump();
	}

	private onCrash(worker: Worker, event: ErrorEvent): void {
		for (const [id, entry] of this.active) {
			if (entry.worker !== worker) continue;
			this.active.delete(id);
			entry.job.reject(new Error(`mesh worker упал: ${event.message}`));
		}
		worker.terminate();
		const workerIdx = this.workers.indexOf(worker);
		if (workerIdx !== -1) this.workers.splice(workerIdx, 1);
		const idleIdx = this.idle.indexOf(worker);
		if (idleIdx !== -1) this.idle.splice(idleIdx, 1);
		if (!this.disposed) {
			this.spawnWorker();
		}
		this.pump();
	}
}
