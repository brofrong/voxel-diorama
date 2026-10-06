export type { Material, MaterialKind, SceneConfig, TimeOfDay, Vec3 } from '../engine/types.ts';
export {
	type BakeResult,
	type BakeStats,
	bakeDiorama,
	bakeToVxb,
	bakeWarnings,
	SIZE_LIMIT_BYTES,
	SIZE_WARN_BYTES,
} from './bake.ts';
export { type Model, ModelBuilder, type ModelOptions, model } from './builder/model.ts';
export {
	type ModelSource,
	type PlaceOptions,
	type Rotation,
	type ScatterOptions,
	type TerrainNoise,
	type TerrainOptions,
	type WaterOptions,
	WorldBuilder,
} from './builder/world-builder.ts';
export type { MaterialInput } from './materials.ts';
export type { Noise2D } from './noise.ts';
export type { Rng } from './rng.ts';
export {
	type Diorama,
	type DioramaInput,
	DioramaValidationError,
	defineDiorama,
	toSceneConfig,
} from './schema.ts';
export { SLUG_RE, slugFromDioramaPath } from './slug.ts';
