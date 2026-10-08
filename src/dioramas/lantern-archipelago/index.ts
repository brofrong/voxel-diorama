import {
	defineDiorama,
	fireflies,
	flock,
	leaves,
	mist,
	pointLight,
	pour,
	prefabs,
	type Vec3,
	type WorldBuilder,
	walkPath,
} from '#sdk';

const ISLE = { surface: 'isle-grass', soil: 'isle-soil', rock: 'isle-rock' } as const;
const GRASS = ['isle-grass-d', 'isle-grass', 'isle-grass-l'];
const ROCK = ['isle-rock-d', 'isle-rock', 'isle-rock-l'];
const SAKURA: ReadonlyArray<readonly [number, number]> = [
	[30, 58],
	[34, 54],
	[60, 48],
	[64, 54],
	[68, 50],
	[116, 76],
];
const BUSHES: ReadonlyArray<readonly [number, number]> = [
	[34, 66],
	[66, 62],
	[104, 58],
	[114, 62],
	[108, 80],
	[6, 12],
];

const ROOF = '#3f9c97';
const GOLD = '#d9a93a';
const BLOSSOM: [string, string, string] = ['#e58fb0', '#f7b9d0', '#ffe0ec'];

const onTop = (w: WorldBuilder, x: number, z: number): Vec3 => [x, w.heightAt(x, z) + 1, z];

function groundMin(w: WorldBuilder, x0: number, x1: number, z0: number, z1: number): number {
	let low = Number.POSITIVE_INFINITY;
	for (let z = z0; z <= z1; z++) {
		for (let x = x0; x <= x1; x++) {
			const h = w.heightAt(x, z);
			if (h >= 0) low = Math.min(low, h);
		}
	}
	if (low === Number.POSITIVE_INFINITY) throw new Error(`нет земли под (${x0}, ${z0})`);
	return low;
}

function pad(w: WorldBuilder, x0: number, x1: number, z0: number, z1: number): number {
	const level = groundMin(w, x0, x1, z0, z1);
	for (let z = z0; z <= z1; z++) {
		for (let x = x0; x <= x1; x++) {
			const h = w.heightAt(x, z);
			if (h > level) w.box([x, level + 1, z], [x, h, z], 'air');
		}
	}
	return level;
}

function piers(w: WorldBuilder, xs: number[], z0: number, z1: number, deckY: number): void {
	for (const x of xs) {
		for (let z = z0; z <= z1; z++) {
			const h = w.heightAt(x, z);
			if (h >= 0 && h < deckY - 1) w.box([x, h + 1, z], [x, deckY - 1, z], 'isle-rock');
		}
	}
}

function post(w: WorldBuilder, x: number, z: number, top: number): void {
	const h = w.heightAt(x, z);
	if (h >= 0 && h < top) w.box([x, h + 1, z], [x, top, z], 'planks');
}

export default defineDiorama({
	meta: {
		title: 'Lantern Archipelago',
		createdAt: '2026-10-08',
		author: { model: 'Claude Haiku 5.5' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'Three floating islands above a sea of clouds: a pagoda, a garden with an arched bridge and a pond, a shrine with a torii gate and a waterfall.',
		tags: ['pagoda', 'sakura', 'torii', 'waterfall', 'islands'],
	},
	seed: 1099315780,
	size: [128, 110, 128],
	palette: {
		'isle-grass-d': { color: '#4f8a3a', vary: 0.12 },
		'isle-grass': { color: '#7cb342', vary: 0.12 },
		'isle-grass-l': { color: '#a3d05c', vary: 0.12 },
		'isle-soil': { color: '#7a5a3a', vary: 0.12 },
		'isle-rock-d': { color: '#5b5e66', vary: 0.12 },
		'isle-rock': { color: '#7d7f86', vary: 0.12 },
		'isle-rock-l': { color: '#9ea2aa', vary: 0.12 },
		'isle-moss': { color: '#5b8f3a', vary: 0.12 },
		'path-stone': { color: '#cfc8b8', vary: 0.05 },
		water: { color: '#3a9fd6', emissive: 0, kind: 'water', vary: 0 },
		planks: { color: '#a07245', vary: 0.1 },
		rope: '#c9a66b',
		vine: { color: '#3f7a35', vary: 0.1 },
		'flower-pink': '#ff8fb1',
		'flower-white': '#fff4f8',
		'flower-gold': '#ffd54f',
	},
	build(w) {
		w.island({
			...ISLE,
			center: [48, 64],
			radius: 28,
			top: 50,
			depth: 24,
			roughness: 0.12,
			hills: 2,
			spikes: 6,
		});
		w.island({
			...ISLE,
			center: [18, 18],
			radius: 16,
			top: 60,
			depth: 18,
			roughness: 0.15,
			hills: 2,
			spikes: 4,
		});
		w.island({
			...ISLE,
			center: [106, 66],
			radius: 16,
			top: 40,
			depth: 16,
			roughness: 0.15,
			hills: 2,
			spikes: 3,
		});

		const pondX = 106;
		const pondZ = 67;
		const pondLevel = groundMin(w, pondX - 5, pondX + 5, pondZ - 4, pondZ + 4);
		for (let z = pondZ - 5; z <= pondZ + 5; z++) {
			for (let x = pondX - 6; x <= pondX + 6; x++) {
				const h = w.heightAt(x, z);
				if (h < 0) continue;
				const d = ((x - pondX) / 4.5) ** 2 + ((z - pondZ) / 3.5) ** 2;
				if (d <= 1) {
					for (let y = pondLevel + 1; y <= h; y++) w.set([x, y, z], 'air');
					w.set([x, pondLevel, z], 'water');
				} else if (d <= 1.9) {
					w.set([x, h, z], 'isle-rock-l');
				}
			}
		}

		let mainEdge = 60;
		while (mainEdge < 126 && w.heightAt(mainEdge + 1, 64) >= 0) mainEdge++;
		let gardenEdge = mainEdge + 1;
		while (gardenEdge < 127 && w.heightAt(gardenEdge, 64) < 0) gardenEdge++;
		const bridgeStart = mainEdge - 2;
		const bridgeEnd = gardenEdge + 1;
		const bridgeLength = bridgeEnd - bridgeStart + 1;
		const deckY = w.heightAt(bridgeStart, 64) + 1;
		w.place(prefabs.archBridge({ length: bridgeLength, width: 3, rise: 4 }), [
			bridgeStart + Math.floor(bridgeLength / 2),
			deckY,
			64,
		]);
		piers(w, [bridgeStart, bridgeEnd - 1, bridgeEnd], 63, 65, deckY);

		const pondDeckY = Math.min(w.heightAt(pondX - 6, pondZ), w.heightAt(pondX + 6, pondZ)) + 1;
		w.place(prefabs.archBridge({ length: 13, width: 3, rise: 3 }), [pondX, pondDeckY, pondZ]);
		piers(w, [pondX - 6, pondX + 6], pondZ - 1, pondZ + 1, pondDeckY);

		const pagodaY = pad(w, 41, 55, 47, 65) + 1;
		w.place(prefabs.pagoda({ tiers: 5, base: 11, roof: ROOF, trim: GOLD }), [48, pagodaY, 54], {
			name: 'pagoda',
		});
		for (let z = 66; z <= 80; z++) {
			for (let x = 47; x <= 49; x++) w.set([x, w.heightAt(x, z), z], 'path-stone');
		}
		w.place(prefabs.stoneLantern(), onTop(w, 44, 68), { name: 'lantA' });
		w.place(prefabs.stoneLantern(), onTop(w, 52, 68), { name: 'lantB' });
		w.place(prefabs.stoneLantern(), onTop(w, 44, 78), { name: 'lantC' });
		w.place(prefabs.stoneLantern(), onTop(w, 52, 78), { name: 'lantD' });

		w.place(prefabs.stoneLantern(), onTop(w, 7, 26), { name: 'shA' });
		w.place(prefabs.stoneLantern(), onTop(w, 29, 12), { name: 'shB' });
		const hall = w.place(
			prefabs.pagoda({ tiers: 2, base: 7, roof: ROOF, trim: GOLD }),
			[18, pad(w, 13, 23, 9, 21) + 1, 14],
			{
				name: 'hall',
			},
		);
		const door = hall.anchors.door;
		if (!door) throw new Error('у святилища нет якоря door');
		for (const offset of [2, 5, 8]) {
			const x = Math.floor(door[0]);
			const z = Math.floor(door[2]) + offset;
			w.place(prefabs.torii({ width: 9, height: 10 }), [
				x,
				pad(w, x - 7, x + 7, z - 1, z + 1) + 1,
				z,
			]);
		}

		const ropeA: Vec3 = [28, w.heightAt(28, 24) + 1, 24];
		const ropeB: Vec3 = [35, w.heightAt(35, 44) + 1, 44];
		const ropeMid: Vec3 = [32, (ropeA[1] + ropeB[1]) / 2 - 2, 34];
		const span = [ropeA, ropeMid, ropeB];
		w.curve(span, 'planks', { radius: 1 });
		const cables: ReadonlyArray<readonly [number, number]> = [
			[2, -1],
			[-2, 1],
		];
		for (const [dx, dz] of cables) {
			w.curve(
				span.map((p): Vec3 => [p[0] + dx, p[1] + 3, p[2] + dz]),
				'rope',
			);
			for (const p of [ropeA, ropeB]) post(w, p[0] + dx, p[2] + dz, p[1] + 3);
		}

		let rimZ = 63;
		while ([48, 49, 50, 51].some((x) => w.heightAt(x, rimZ + 1) >= 0)) rimZ++;
		const lip = Math.max(...[48, 49, 50, 51].map((x) => w.heightAt(x, rimZ)));
		w.island({
			surface: 'isle-rock-l',
			soil: 'isle-rock',
			rock: 'isle-rock-d',
			center: [50, 93],
			radius: 7,
			top: 33,
			depth: 10,
			roughness: 0.1,
			hills: 0,
			spikes: 3,
		});
		for (let z = 90; z <= 94; z++) {
			for (let x = 47; x <= 52; x++) {
				w.set([x, 33, z], 'air');
				w.set([x, 32, z], 'water');
			}
		}
		w.waterfall({ at: [48, lip, rimZ + 1], width: [4, 2], name: 'fall' });

		for (const [x, z] of SAKURA)
			w.place(prefabs.sakura({ rng: w.rng.fork(), colors: BLOSSOM }), onTop(w, x, z));
		for (const [x, z] of BUSHES) w.place(prefabs.bush({ rng: w.rng.fork() }), onTop(w, x, z));
		w.place(prefabs.maple({ rng: w.rng.fork() }), onTop(w, 111, 56));
		w.place(prefabs.willow({ rng: w.rng.fork() }), onTop(w, 98, 58));

		w.shade([0, 0, 0], [127, 109, 127], GRASS, { only: 'isle-grass', scale: 6, speckle: 0.2 });
		w.shade([0, 0, 0], [127, 109, 127], ROCK, { only: 'isle-rock', scale: 5, speckle: 0.15 });
		w.flowers(['flower-pink', 'flower-white', 'flower-gold'], {
			on: GRASS,
			density: 0.05,
			stem: 'isle-grass-d',
		});
		w.grass(['isle-grass-l', 'isle-grass'], { on: GRASS, density: 0.35, height: [1, 2] });
		w.moss('isle-moss', { on: ROCK, amount: 0.35, scale: 5 });
		w.vines('vine', { from: ROCK, density: 0.1, length: [2, 5] });
	},
	entities: [
		{
			id: 'birds',
			rig: prefabs.bird(),
			count: 6,
			animate: flock({ center: [48, 98, 70], radius: 8, speed: 4 }),
		},
		{
			id: 'pondWalker',
			rig: prefabs.villager(),
			animate: walkPath(
				[
					[102, 67],
					[110, 67],
				],
				{ loop: 'pingpong', pause: 1.5 },
			),
		},
		{
			id: 'crosser',
			rig: prefabs.villager(),
			animate: walkPath(
				[
					[76, 64],
					[84, 64],
					[90, 64],
				],
				{ loop: 'pingpong', pause: 2 },
			),
		},
	],
	particles: [
		pour({ at: 'fall.top', lifetime: 4 }),
		mist({ area: [45, 91, 55, 96], height: 2, count: 16 }),
		leaves({ area: [96, 54, 118, 78], color: '#f4a6c0', intensity: 0.6 }),
		fireflies({ area: [100, 62, 112, 72], count: 30, onlyAtNight: true }),
	],
	lights: [
		pointLight({
			at: 'lantA.light',
			color: '#ffd27a',
			intensity: 5,
			distance: 9,
			onlyAtNight: true,
		}),
		pointLight({
			at: 'lantB.light',
			color: '#ffd27a',
			intensity: 5,
			distance: 9,
			onlyAtNight: true,
		}),
		pointLight({
			at: 'lantC.light',
			color: '#ffd27a',
			intensity: 5,
			distance: 9,
			onlyAtNight: true,
		}),
		pointLight({
			at: 'lantD.light',
			color: '#ffd27a',
			intensity: 5,
			distance: 9,
			onlyAtNight: true,
		}),
		pointLight({ at: 'shA.light', color: '#ffd27a', intensity: 5, distance: 9, onlyAtNight: true }),
		pointLight({ at: 'shB.light', color: '#ffd27a', intensity: 5, distance: 9, onlyAtNight: true }),
	],
	atmosphere: {
		time: { start: 18.5, speed: 0.5, cycle: 600 },
		sky: 'gradient',
		haze: 0.6,
		backdrop: { clouds: 0.7, mountains: 0.5, cloudSea: true, mountainColor: '#4b3f6e' },
	},
	camera: {
		position: [-12, 120, 177],
		target: [58, 52, 50],
		autoRotate: false,
		tiltShift: 0.3,
	},
});
