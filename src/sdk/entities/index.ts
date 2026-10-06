export {
	bob,
	custom,
	type Keyframe,
	keyframes,
	type OrbitOptions,
	orbit,
	spin,
	sway,
} from './behaviours.ts';
export { type WalkPathOptions, walkPath } from './path.ts';
export {
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
