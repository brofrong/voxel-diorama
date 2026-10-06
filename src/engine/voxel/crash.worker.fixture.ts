import type { WorkerRequest } from './mesh.worker.ts';

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const msg = event.data;
	if (msg.type === 'init') {
		return;
	}
	if (msg.type === 'mesh') {
		throw new Error('Fixture worker crash');
	}
};
