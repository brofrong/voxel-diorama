export { type AtmosphereStats, atmosphereWarnings, checkAtmosphere } from './check.ts';
export { isLightDef, type LightDef, type PointLightOptions, pointLight } from './lights.ts';
export {
	type AreaEmitterOptions,
	dust,
	fire,
	fireflies,
	isParticleDef,
	leaves,
	mist,
	PARTICLE_TEMPLATES,
	type ParticleDef,
	type ParticlePreset,
	type PointEmitterOptions,
	rain,
	smoke,
	snow,
	sparks,
} from './particles.ts';
export { ATMOSPHERE_LIMITS, createAtmosphereRuntime } from './runtime.ts';
