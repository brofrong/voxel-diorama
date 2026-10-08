export type { Material, MaterialKind, SceneConfig, TimeOfDay, Vec3 } from '../engine/types.ts';
export { buildHeightmap } from '../engine/voxel/heightmap.ts';
export * from './atmosphere/index.ts';
export {
	type BakeResult,
	type BakeStats,
	bakeDiorama,
	bakeToVxb,
	bakeWarnings,
	SIZE_LIMIT_BYTES,
	SIZE_WARN_BYTES,
} from './bake.ts';
export type { BlobOptions, ConeOptions, CurveOptions, ShadeOptions } from './builder/canvas.ts';
export { isModel, type Model, ModelBuilder, type ModelOptions, model } from './builder/model.ts';
export {
	type FlowersOptions,
	type GrassOptions,
	type GrowOptions,
	type IslandInfo,
	type IslandOptions,
	type ModelSource,
	type MossOptions,
	type Placed,
	type PlaceOptions,
	type Rotation,
	type ScatterOptions,
	type TerrainNoise,
	type TerrainOptions,
	type VinesOptions,
	type WaterfallOptions,
	type WaterOptions,
	WorldBuilder,
} from './builder/world-builder.ts';
export * from './entities/index.ts';
export type { MaterialInput } from './materials.ts';
export type { Noise2D, Noise3D } from './noise.ts';
export * as prefabs from './prefabs/index.ts';
export type { Rng } from './rng.ts';
export {
	type Diorama,
	type DioramaInput,
	DioramaValidationError,
	defineDiorama,
	toSceneConfig,
} from './schema.ts';
export { SLUG_RE, slugFromDioramaPath } from './slug.ts';
