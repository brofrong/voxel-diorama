export {
	bob,
	custom,
	type Keyframe,
	keyframes,
	type LimbFn,
	type LimbState,
	type LimbsOptions,
	limbs,
	type OrbitOptions,
	orbit,
	spin,
	sway,
} from './behaviours.ts';
export { checkEntities, type EntityStats, entityWarnings } from './check.ts';
export { type WalkPathOptions, walkPath } from './path.ts';
export {
	CUSTOM_RIG_MAX_PARTS,
	poseRig,
	type Rig,
	type RigOptions,
	type RigPart,
	type RigPartInput,
	rig,
	type Skeleton,
} from './rig.ts';
export { createEntityRuntime, ENTITY_LIMITS, type EntityDef } from './runtime.ts';
export { type FlockOptions, flock, type WanderOptions, wander } from './sim.ts';
export type { Behaviour, BehaviourContext, Gait, Point, Pose } from './types.ts';
