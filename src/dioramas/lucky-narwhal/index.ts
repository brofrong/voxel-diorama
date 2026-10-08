import {
	custom,
	defineDiorama,
	fire,
	flock,
	fountain,
	limbs,
	pointLight,
	smoke,
	sparks,
	sway,
	type Vec3,
} from '#sdk';
import {
	captain,
	captainPose,
	cook,
	cookPose,
	helmsman,
	helmsmanPose,
	lookout,
	lookoutPose,
	musician,
	musicianPose,
	navigator,
	navigatorPose,
	otter,
	otterPose,
	swordswoman,
	swordswomanPose,
} from './crew.ts';
import {
	barrel,
	cannon,
	chartTable,
	chest,
	crate,
	feast,
	fishBucket,
	fishingLine,
	gull,
	jollyRoger,
	lantern,
	lifeRing,
	pennant,
	ropeCoil,
	ropeSegments,
	wheel,
	wheelStand,
} from './props.ts';
import {
	buildFigurehead,
	buildHull,
	buildRigging,
	buildSea,
	buildStructures,
	DECK,
	FC,
	FORE_TOP,
	FORE_X,
	MAIN_TOP,
	MAIN_X,
	NEST_Y,
	QD,
	QD_X,
	ROPES,
	SX,
	SY,
	SZ,
	WORLD_PALETTE,
	ZC,
} from './ship.ts';

const TAU = Math.PI * 2;
/** Поворот, при котором длинная ось флага (+x модели) смотрит по ветру. */
const DOWNWIND = -53;

/** Точка на палубе: y — уровень палубы участка. */
const on = (x: number, z: number, y = DECK): Vec3 => [x, y, z];

const CAPTAIN: Vec3 = [118, FC, ZC + 0.5];
const OTTER_CRATE: Vec3 = [98, DECK, ZC + 10.2];
const OTTER: Vec3 = [98, DECK + 2, ZC + 10.2];
// кончик удилища выдры (rig 0.2: точка крепления + длина удилища)
const ROD_TIP: Vec3 = [OTTER[0], OTTER[1] + 6.4, OTTER[2] + 6.9];

const flagWave = (prefix: string, amp: number, period: number) =>
	limbs({
		parts: Object.fromEntries(
			[0, 1, 2, 3].map((i) => [
				`${prefix}${i}`,
				({ t }: { t: number }): [number, number, number] => [
					0,
					(i === 0 ? 0.4 : 1) * amp * Math.sin((TAU * t) / period - i * 1.1),
					(i === 0 ? 0 : 3) * Math.sin((TAU * t) / (period * 0.7) - i),
				],
			]),
		),
		replace: true,
	});

export default defineDiorama({
	meta: {
		title: 'The Lucky Narwhal',
		createdAt: '2026-10-08',
		author: { model: 'Claude Opus 5.5' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'A small pirate ship with a narwhal figurehead races ahead of a breaking wave while its eccentric crew go about their day: captain at the bow, swordswoman at the mast, navigator, cook, helmsman, lookout, accordion player and an otter with a fishing rod.',
		tags: ['pirates', 'ship', 'ocean', 'crew', 'anime'],
	},
	seed: 7027,
	size: [SX, SY, SZ],
	base: 'wood',
	palette: WORLD_PALETTE,
	build(w) {
		buildSea(w);
		buildHull(w);
		buildStructures(w);
		buildFigurehead(w);
		buildRigging(w);
		w.anchor('bowSprayL', [127, 21, ZC - 6]);
		w.anchor('bowSprayR', [127, 21, ZC + 6]);
		w.anchor('cabinLampL', [QD_X + 1.5, QD - 3, ZC - 4]);
		w.anchor('cabinLampR', [QD_X + 1.5, QD - 3, ZC + 4]);
		w.anchor('foreLamp', [FORE_X + 3.5, DECK + 12, ZC]);
	},
	entities: [
		// --- экипаж ---
		{ id: 'captain', rig: captain(), at: CAPTAIN, rotate: 90, animate: captainPose },
		{
			id: 'swordswoman',
			rig: swordswoman(),
			at: on(MAIN_X, ZC + 4.2),
			rotate: 15,
			animate: swordswomanPose,
		},
		{ id: 'navigator', rig: navigator(), at: on(93, ZC + 3), rotate: 0, animate: navigatorPose },
		{ id: 'cook', rig: cook(), at: on(62.5, ZC + 4.5), rotate: 40, animate: cookPose },
		{ id: 'otter', rig: otter(), at: OTTER, rotate: 0, animate: otterPose },
		{
			id: 'lookout',
			rig: lookout(),
			at: [MAIN_X + 1.4, NEST_Y, ZC + 2.2],
			rotate: 70,
			animate: lookoutPose,
		},
		{ id: 'helmsman', rig: helmsman(), at: on(44, ZC, QD), rotate: 90, animate: helmsmanPose },
		{ id: 'musician', rig: musician(), at: on(70, ZC - 6), rotate: 50, animate: musicianPose },

		// --- реквизит ---
		{
			id: 'captainKeg',
			model: crate({ w: 9, h: 6, d: 9, mark: '#d8282f' }),
			at: [120.25, FC, ZC - 0.4],
		},
		{ id: 'chartTable', model: chartTable(), at: on(93, ZC + 8) },
		{ id: 'otterCrate', model: crate({ w: 10, h: 8, d: 10 }), at: OTTER_CRATE },
		{ id: 'bucket', model: fishBucket(), at: on(95.2, ZC + 10.5) },
		{
			id: 'line',
			model: fishingLine(ROD_TIP[1] - 20.6, 2.4),
			at: ROD_TIP,
		},
		{
			id: 'musicianSeat',
			model: crate({ w: 10, h: 7, d: 10 }),
			at: on(70.4, ZC - 5.6),
			rotate: 50,
		},
		{ id: 'dinnerBarrel', model: barrel(), at: on(74.5, ZC - 3) },
		{ id: 'feast', model: feast(), at: [74.5, DECK + 3.5, ZC - 3], rotate: 30 },
		{ id: 'chest', model: chest(), at: on(87, ZC - 7), rotate: 20 },
		{ id: 'cannonA', model: cannon(), at: on(70, ZC - 9.4), rotate: 180 },
		{ id: 'cannonB', model: cannon(), at: on(92, ZC - 9.4), rotate: 180 },
		{ id: 'barrelA', model: barrel({ label: '#2f7a4a' }), at: on(101.5, ZC - 8) },
		{ id: 'barrelB', model: barrel(), at: on(104.6, ZC - 9) },
		{ id: 'barrelC', model: barrel({ label: '#e3b041' }), at: on(102.9, ZC - 5.4) },
		{ id: 'barrelTop', model: barrel(), at: [103, DECK + 3.5, ZC - 7.8] },
		{ id: 'crateA', model: crate(), at: on(63, ZC - 8) },
		{
			id: 'crateB',
			model: crate({ w: 10, h: 8, d: 10, mark: '#d8282f' }),
			at: [63.2, DECK + 2.5, ZC - 8],
		},
		{ id: 'coilA', model: ropeCoil(), at: on(84, ZC - 3) },
		{ id: 'coilB', model: ropeCoil(), at: on(114, ZC - 4, FC) },
		{ id: 'ring', model: lifeRing(), at: [86, DECK + 0.6, ZC + 13.6] },
		{ id: 'wheelStand', model: wheelStand(), at: on(47.6, ZC, QD), rotate: 90 },
		{
			id: 'wheel',
			model: wheel(),
			at: [47.9, QD + 4.5, ZC],
			rotate: 90,
			animate: custom((pose, t) => {
				pose.rotation[2] += 0.35 * Math.sin((TAU * t) / 6);
			}),
		},
		{
			id: 'lampL',
			model: lantern(),
			at: 'cabinLampL',
			animate: sway({ axis: 'z', angle: 8, period: 2.6 }),
		},
		{
			id: 'lampR',
			model: lantern(),
			at: 'cabinLampR',
			animate: sway({ axis: 'z', angle: 8, period: 2.9 }),
		},
		{
			id: 'lampFore',
			model: lantern(),
			at: 'foreLamp',
			animate: sway({ axis: 'z', angle: 10, period: 2.3 }),
		},

		// --- такелаж ---
		...ROPES.flatMap(([a, b]) => ropeSegments(a, b)),

		// --- флаги и чайки ---
		{
			id: 'flag',
			rig: jollyRoger(),
			at: [MAIN_X, MAIN_TOP - 3.5, ZC],
			rotate: DOWNWIND,
			animate: flagWave('s', 14, 1.6),
		},
		{
			id: 'pennant',
			rig: pennant(),
			at: [FORE_X, FORE_TOP - 1, ZC],
			rotate: DOWNWIND,
			animate: flagWave('p', 22, 0.9),
		},
		{
			id: 'gulls',
			rig: gull(),
			count: 7,
			animate: flock({ center: [104, 84, 78], radius: 24, speed: 5 }),
		},
	],
	particles: [
		smoke({ at: 'stoveChimney', rate: 5, size: 'small' }),
		fire({ at: 'stoveFire', size: 'small', rate: 18 }),
		sparks({ at: 'stoveTop', rate: 3 }),
		smoke({ at: 'stoveTop', rate: 3, size: 'small', color: '#f4f4f0', lifetime: 2.5 }),
		fountain({
			at: 'bowSprayR',
			rate: 26,
			color: '#f4fbff',
			velocity: [1.5, 1.5, 2.4],
			lifetime: 1.6,
		}),
		fountain({
			at: 'bowSprayL',
			rate: 26,
			color: '#f4fbff',
			velocity: [1.5, 1.5, -2.4],
			lifetime: 1.6,
		}),
	],
	lights: [
		pointLight({ at: 'stoveFire', color: '#ff8a3c', intensity: 6, distance: 10, flicker: true }),
		pointLight({ at: 'cabinLampL', color: '#ffc45a', intensity: 4, distance: 9 }),
		pointLight({ at: 'cabinLampR', color: '#ffc45a', intensity: 4, distance: 9 }),
		pointLight({ at: 'foreLamp', color: '#ffc45a', intensity: 4, distance: 10 }),
	],
	atmosphere: {
		time: { start: 17.7, speed: 0.5, cycle: 600 },
		sky: 'stylized',
		haze: 0.35,
		backdrop: { clouds: 0.7 },
	},
	camera: {
		position: [178, 92, 172],
		target: [86, 46, 66],
		autoRotate: false,
		tiltShift: 0.3,
		captureTime: 3,
	},
});
