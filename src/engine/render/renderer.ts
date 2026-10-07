import { ACESFilmicToneMapping, PCFShadowMap, WebGPURenderer } from 'three/webgpu';

export class NoGraphicsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NoGraphicsError';
	}
}

/** WebGPU, а где его нет — автоматически WebGL2. Если нет ничего — NoGraphicsError. */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<WebGPURenderer> {
	let renderer: WebGPURenderer | null = null;
	try {
		renderer = new WebGPURenderer({ canvas, antialias: true });
		await renderer.init();
	} catch (error) {
		renderer?.dispose();
		const reason = error instanceof Error ? error.message : String(error);
		throw new NoGraphicsError(`браузер не поддерживает ни WebGPU, ни WebGL2 (${reason})`);
	}
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFShadowMap;
	return renderer;
}

export function backendName(renderer: WebGPURenderer): 'webgpu' | 'webgl2' {
	return (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
}
