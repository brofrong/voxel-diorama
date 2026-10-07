import { z } from 'zod';
import type { SceneConfig, Vec3 } from '../engine/types.ts';
import { MAX_MATERIALS } from '../engine/voxel/constants.ts';
import { ANCHOR_REF_RE } from './anchors.ts';
import { isModel, type Model } from './builder/model.ts';
import type { WorldBuilder } from './builder/world-builder.ts';
import { isRig, type Rig } from './entities/rig.ts';
import { type Behaviour, isBehaviour, type Point } from './entities/types.ts';
import { AIR, HEX_COLOR, normalizeMaterial } from './materials.ts';

const hexColor = z.string().regex(HEX_COLOR, 'ожидается цвет в формате #rrggbb');
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const dimension = z.number().int().min(1).max(1024);

const materialInput = z.union([
	hexColor,
	z.strictObject({
		color: hexColor,
		emissive: z.number().min(0).max(10).optional(),
		kind: z.enum(['solid', 'water', 'glass']).optional(),
	}),
]);

/** Имя материала: латиница, с маленькой буквы. */
const MATERIAL_NAME_RE = /^[a-z][a-zA-Z0-9_-]*$/;

const isFiniteNumberTuple = (v: unknown): v is readonly number[] =>
	Array.isArray(v) &&
	(v.length === 2 || v.length === 3) &&
	v.every((n) => typeof n === 'number' && Number.isFinite(n));

// R3: zod 4 сообщает об ошибке непройденного члена z.union как общее "Invalid input", поэтому
// at — не union([x,z], [x,y,z], якорь), а один z.custom со своим сообщением.
const point = z.custom<Point>(
	(v) => (typeof v === 'string' ? ANCHOR_REF_RE.test(v) : isFiniteNumberTuple(v)),
	'at: ожидается [x, z], [x, y, z] или имя якоря (`well`, `mill.hub`)',
);

// R1: zod 4 сообщает об ошибке непройденного члена z.union как общее "Invalid input" и теряет
// сообщение refine, поэтому `animate` — не union([behaviour, array(behaviour)]), а один
// z.custom с трансформацией в массив.
const entity = z
	.strictObject({
		id: z
			.string()
			.regex(/^[a-z][a-zA-Z0-9_-]*$/, 'id: латиница с маленькой буквы')
			.optional(),
		model: z.custom<Model>(isModel, 'model: ожидается model({...}) или префаб-модель').optional(),
		rig: z.custom<Rig>(isRig, 'rig: ожидается rig({...}) или префаб-персонаж').optional(),
		at: point.optional(),
		rotate: z.number().default(0),
		count: z.number().int().min(1).max(64).default(1),
		animate: z
			.custom<Behaviour | Behaviour[]>(
				(v) => v === undefined || isBehaviour(v) || (Array.isArray(v) && v.every(isBehaviour)),
				'animate: ожидается поведение (spin(), walkPath(), …) или их массив',
			)
			.optional()
			.transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
	})
	.superRefine((e, ctx) => {
		if ((e.model ? 1 : 0) + (e.rig ? 1 : 0) !== 1) {
			ctx.addIssue({ code: 'custom', message: 'нужно ровно одно из model или rig' });
		}
		if (e.at === undefined && !e.animate.some((b) => b.positional)) {
			ctx.addIssue({
				code: 'custom',
				path: ['at'],
				message:
					'нет позиции: задай at или поведение, двигающее сущность (walkPath, wander, orbit, flock, keyframes)',
			});
		}
	});

export const dioramaSchema = z.strictObject({
	meta: z.strictObject({
		title: z.string().trim().min(1).max(80),
		createdAt: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, 'дата в формате YYYY-MM-DD')
			.refine((s) => {
				const d = new Date(`${s}T00:00:00Z`);
				return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
			}, 'несуществующая дата'),
		description: z.string().max(280).default(''),
		tags: z.array(z.string().min(1).max(24)).max(8).default([]),
	}),
	seed: z.number().int().default(1),
	size: z.tuple([dimension, dimension, dimension]),
	// R2: zod 4 сообщает об ошибках ключа z.record как общее "Invalid key in record" и теряет
	// сообщение refine, поэтому имена и зарезервированное 'air' проверяются здесь, superRefine'ом
	// по всей палитре, а не схемой ключа.
	palette: z
		.record(z.string(), materialInput)
		.superRefine((palette, ctx) => {
			const names = Object.keys(palette);
			if (names.length > MAX_MATERIALS) {
				ctx.addIssue({ code: 'custom', message: `максимум ${MAX_MATERIALS} материалов` });
			}
			for (const name of names) {
				if (!MATERIAL_NAME_RE.test(name)) {
					ctx.addIssue({
						code: 'custom',
						path: [name],
						message: 'имя материала: латиница, с маленькой буквы',
					});
				}
				if (name === AIR) {
					ctx.addIssue({
						code: 'custom',
						path: [name],
						message: '"air" зарезервирован под пустоту',
					});
				}
			}
		})
		.transform((palette) =>
			Object.fromEntries(
				Object.entries(palette).map(([name, input]) => [name, normalizeMaterial(input)]),
			),
		),
	build: z.custom<(w: WorldBuilder) => void>(
		(v) => typeof v === 'function',
		'build должен быть функцией (w) => { … }',
	),
	entities: z
		.array(entity)
		.max(256)
		.default([])
		.superRefine((list, ctx) => {
			const seen = new Set<string>();
			list.forEach((e, i) => {
				if (e.id === undefined) return;
				if (seen.has(e.id)) {
					ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `повторяется id "${e.id}"` });
				}
				seen.add(e.id);
			});
		}),
	atmosphere: z
		.strictObject({
			time: z
				.strictObject({ fixed: z.enum(['dawn', 'day', 'sunset', 'night']) })
				.prefault({ fixed: 'day' }),
			fog: z.number().min(0).max(0.05).default(0),
		})
		.prefault({}),
	camera: z
		.strictObject({
			position: vec3.optional(),
			target: vec3.optional(),
			autoRotate: z.boolean().default(true),
			minDistance: z.number().positive().optional(),
			maxDistance: z.number().positive().optional(),
			captureTime: z.number().min(0).max(60).default(2),
		})
		.prefault({}),
	base: z.enum(['none', 'wood', 'stone']).default('none'),
});

export type DioramaInput = z.input<typeof dioramaSchema>;
export type Diorama = z.output<typeof dioramaSchema>;

export class DioramaValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DioramaValidationError';
	}
}

/** Проверяет и нормализует диораму. Всегда `export default defineDiorama({...})`. */
export function defineDiorama(input: DioramaInput): Diorama {
	const result = dioramaSchema.safeParse(input);
	if (!result.success) {
		const title = (input as { meta?: { title?: unknown } } | null | undefined)?.meta?.title;
		const name = typeof title === 'string' ? title : '?';
		throw new DioramaValidationError(
			`Диорама «${name}» невалидна:\n${z.prettifyError(result.error)}`,
		);
	}
	return result.data;
}

/** Сериализуемая часть диорамы для движка. Камера по умолчанию — изометрия на центр. */
export function toSceneConfig(d: Diorama): SceneConfig {
	const [sx, sy, sz] = d.size;
	const span = Math.max(sx, sz);
	const target: Vec3 = d.camera.target ?? [sx / 2, sy * 0.2, sz / 2];
	const distance = span * 1.25;
	const position: Vec3 = d.camera.position ?? [
		target[0] + distance * 0.8,
		target[1] + distance * 0.7,
		target[2] + distance * 0.8,
	];
	return {
		size: [sx, sy, sz],
		time: d.atmosphere.time.fixed,
		fog: d.atmosphere.fog,
		base: d.base,
		camera: {
			position,
			target,
			autoRotate: d.camera.autoRotate,
			minDistance: d.camera.minDistance ?? span * 0.3,
			maxDistance: d.camera.maxDistance ?? span * 3,
		},
		captureTime: d.camera.captureTime,
	};
}
