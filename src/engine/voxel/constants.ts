export const CHUNK = 32;
export const CHUNK_SHIFT = 5;
export const CHUNK_MASK = CHUNK - 1;
export const CHUNK_VOLUME = CHUNK ** 3;
/** Чанк с рамкой в 1 воксель от соседей — вход мешера. */
export const PAD = CHUNK + 2;
export const PAD_VOLUME = PAD ** 3;

export const KIND_EMPTY = 0;
export const KIND_SOLID = 1;
export const KIND_WATER = 2;
export const KIND_GLASS = 3;

/** Индекс 0 — пустота, поэтому материалов не больше 255. */
export const MAX_MATERIALS = 255;

/** Локальные координаты внутри чанка (0..31). */
export const chunkIndex = (x: number, y: number, z: number): number => x + CHUNK * (y + CHUNK * z);

/** Координаты в рамке чанка (-1..32). */
export const padIndex = (x: number, y: number, z: number): number =>
	x + 1 + PAD * (y + 1 + PAD * (z + 1));
