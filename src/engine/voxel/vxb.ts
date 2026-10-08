import type { Material, Vec3 } from '../types.ts';
import { CHUNK, CHUNK_VOLUME, MAX_MATERIALS } from './constants.ts';
import { hexToRgb8, KIND_CODE, KIND_NAME, rgb8ToHex } from './palette.ts';
import { VoxelWorld } from './world.ts';

export const VXB_VERSION = 3;
const MAGIC = [0x56, 0x58, 0x42]; // "VXB"

export class VxbError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'VxbError';
	}
}

export interface VxbData {
	world: VoxelWorld;
	/** Материал `i` хранится в вокселях как индекс `i + 1`. */
	materials: Material[];
	/** Именованные точки мира (якоря). */
	anchors?: Record<string, Vec3>;
}

class ByteWriter {
	private buf = new Uint8Array(4096);
	private view = new DataView(this.buf.buffer);
	length = 0;

	private ensure(extra: number): void {
		if (this.length + extra <= this.buf.length) return;
		let capacity = this.buf.length * 2;
		while (capacity < this.length + extra) capacity *= 2;
		const next = new Uint8Array(capacity);
		next.set(this.buf.subarray(0, this.length));
		this.buf = next;
		this.view = new DataView(next.buffer);
	}

	u8(v: number): void {
		this.ensure(1);
		this.view.setUint8(this.length, v);
		this.length += 1;
	}

	u16(v: number): void {
		this.ensure(2);
		this.view.setUint16(this.length, v, true);
		this.length += 2;
	}

	u32(v: number): void {
		this.ensure(4);
		this.view.setUint32(this.length, v, true);
		this.length += 4;
	}

	f32(v: number): void {
		this.ensure(4);
		this.view.setFloat32(this.length, v, true);
		this.length += 4;
	}

	raw(bytes: Uint8Array): void {
		this.ensure(bytes.length);
		this.buf.set(bytes, this.length);
		this.length += bytes.length;
	}

	bytes(): Uint8Array {
		return this.buf.slice(0, this.length);
	}
}

class ByteReader {
	private readonly view: DataView;
	private offset = 0;

	constructor(bytes: Uint8Array) {
		this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}

	private take(n: number): number {
		if (this.offset + n > this.view.byteLength) throw new VxbError('файл .vxb обрезан');
		const at = this.offset;
		this.offset += n;
		return at;
	}

	u8(): number {
		return this.view.getUint8(this.take(1));
	}

	u16(): number {
		return this.view.getUint16(this.take(2), true);
	}

	u32(): number {
		return this.view.getUint32(this.take(4), true);
	}

	f32(): number {
		return this.view.getFloat32(this.take(4), true);
	}

	raw(n: number): Uint8Array {
		const at = this.take(n);
		return new Uint8Array(this.view.buffer, this.view.byteOffset + at, n).slice();
	}
}

async function transform(
	data: Uint8Array,
	stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
	// Под Bun сжимаем синхронно: CompressionStream там даёт разные байты для одного и того же
	// входа от вызова к вызову (зависит от нарезки потока), а запекание должно быть детерминированным.
	if (stream instanceof CompressionStream && typeof Bun !== 'undefined') {
		return new Uint8Array(Bun.deflateSync(new Uint8Array(data)));
	}
	const response = new Response(new Blob([new Uint8Array(data)]).stream().pipeThrough(stream));
	return new Uint8Array(await response.arrayBuffer());
}

export async function encodeVxb({ world, materials, anchors }: VxbData): Promise<Uint8Array> {
	if (materials.length > MAX_MATERIALS) {
		throw new VxbError(`слишком много материалов: ${materials.length} (максимум ${MAX_MATERIALS})`);
	}
	const w = new ByteWriter();
	w.u16(world.size[0]);
	w.u16(world.size[1]);
	w.u16(world.size[2]);
	w.u8(materials.length);
	for (const m of materials) {
		const [r, g, b] = hexToRgb8(m.color);
		w.u8(r);
		w.u8(g);
		w.u8(b);
		w.u8(KIND_CODE[m.kind]);
		w.f32(m.emissive);
		w.f32(m.vary);
	}

	const chunks = [...world.chunks.values()]
		.filter(({ data }) => data.some((v) => v !== 0))
		.sort((a, b) => a.coord[2] - b.coord[2] || a.coord[1] - b.coord[1] || a.coord[0] - b.coord[0]);
	w.u32(chunks.length);
	for (const { coord, data } of chunks) {
		w.u16(coord[0]);
		w.u16(coord[1]);
		w.u16(coord[2]);
		const runs: number[] = [];
		let value = data[0];
		let length = 1;
		for (let i = 1; i < data.length; i++) {
			if (data[i] === value) {
				length++;
			} else {
				runs.push(length, value);
				value = data[i];
				length = 1;
			}
		}
		runs.push(length, value);
		w.u32(runs.length / 2);
		for (let i = 0; i < runs.length; i += 2) {
			w.u16(runs[i]);
			w.u8(runs[i + 1]);
		}
	}

	const anchorEntries = Object.entries(anchors ?? {}).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	);
	if (anchorEntries.length > 65535) throw new VxbError('слишком много якорей');
	w.u16(anchorEntries.length);
	const encoder = new TextEncoder();
	for (const [name, p] of anchorEntries) {
		const nameBytes = encoder.encode(name);
		if (nameBytes.length > 255) throw new VxbError(`слишком длинное имя якоря "${name}"`);
		w.u8(nameBytes.length);
		w.raw(nameBytes);
		w.f32(p[0]);
		w.f32(p[1]);
		w.f32(p[2]);
	}

	const payload = await transform(w.bytes(), new CompressionStream('deflate-raw'));
	const out = new Uint8Array(4 + payload.length);
	out.set(MAGIC);
	out[3] = VXB_VERSION;
	out.set(payload, 4);
	return out;
}

export async function decodeVxb(input: ArrayBuffer | Uint8Array): Promise<Required<VxbData>> {
	const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
	if (bytes.length < 4 || bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1] || bytes[2] !== MAGIC[2]) {
		throw new VxbError('это не файл .vxb');
	}
	if (bytes[3] !== VXB_VERSION) {
		throw new VxbError(
			`неподдерживаемая версия .vxb: ${bytes[3]} (ожидается ${VXB_VERSION}) — перезапеките диораму`,
		);
	}

	let payload: Uint8Array;
	try {
		payload = await transform(bytes.subarray(4), new DecompressionStream('deflate-raw'));
	} catch {
		throw new VxbError('не удалось распаковать .vxb — файл повреждён');
	}

	const r = new ByteReader(payload);
	const size: Vec3 = [r.u16(), r.u16(), r.u16()];
	const materialCount = r.u8();
	const materials: Material[] = [];
	for (let i = 0; i < materialCount; i++) {
		const color = rgb8ToHex(r.u8(), r.u8(), r.u8());
		const kind = KIND_NAME[r.u8()];
		if (!kind) throw new VxbError(`неизвестный вид материала #${i + 1}`);
		const emissive = Math.round(r.f32() * 1000) / 1000;
		const vary = Math.round(r.f32() * 1000) / 1000;
		materials.push({ color, emissive, kind, vary });
	}

	const world = new VoxelWorld(size);
	const maxChunk: Vec3 = [
		Math.ceil(size[0] / CHUNK),
		Math.ceil(size[1] / CHUNK),
		Math.ceil(size[2] / CHUNK),
	];
	const chunkCount = r.u32();
	for (let c = 0; c < chunkCount; c++) {
		const coord: Vec3 = [r.u16(), r.u16(), r.u16()];
		if (coord[0] >= maxChunk[0] || coord[1] >= maxChunk[1] || coord[2] >= maxChunk[2]) {
			throw new VxbError('повреждённый чанк в .vxb');
		}
		const runCount = r.u32();
		const data = new Uint8Array(CHUNK_VOLUME);
		let offset = 0;
		for (let i = 0; i < runCount; i++) {
			const length = r.u16();
			const value = r.u8();
			if (value > materialCount) throw new VxbError('повреждённый чанк в .vxb');
			if (offset + length > CHUNK_VOLUME) throw new VxbError('повреждённый чанк в .vxb');
			data.fill(value, offset, offset + length);
			offset += length;
		}
		if (offset !== CHUNK_VOLUME) throw new VxbError('повреждённый чанк в .vxb');
		world.setChunk(coord, data);
	}
	const anchors: Record<string, Vec3> = {};
	const anchorCount = r.u16();
	const decoder = new TextDecoder();
	for (let i = 0; i < anchorCount; i++) {
		const name = decoder.decode(r.raw(r.u8()));
		anchors[name] = [r.f32(), r.f32(), r.f32()];
	}
	return { world, materials, anchors };
}
