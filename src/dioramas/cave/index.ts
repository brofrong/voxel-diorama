import { defineDiorama, fireflies, model, pointLight, pour, walkPath } from '#sdk';

const FLOOR = 5;

// a — вдоль среза x+z=64, b — расстояние от среза (b < 0 — в скале)
const toAB = (x: number, z: number): [number, number] => [
	(x - z) * Math.SQRT1_2,
	(x + z - 64) * Math.SQRT1_2,
];
const toXZ = (a: number, b: number): [number, number] => [
	Math.round(32 + (a + b) * Math.SQRT1_2),
	Math.round(32 + (b - a) * Math.SQRT1_2),
];
const inCave = (x: number, z: number) => {
	const [a, b] = toAB(x, z);
	return b < 0 && (a / 26) ** 2 + ((b + 6) / 10) ** 2 < 1;
};
const riverB = (a: number) => -7 + 1.4 * Math.sin(a * 0.3);
const inRiver = (x: number, z: number) => {
	const [a, b] = toAB(x, z);
	return inCave(x, z) && Math.abs(b - riverB(a)) < 1.5;
};
const roofAt = (x: number, z: number) => 17 + Math.round(2 * (1 - (toAB(x, z)[0] / 26) ** 2));
const bank = (a: number, off: number): [number, number, number] => {
	const [x, z] = toXZ(a, riverB(a) + off);
	return [x, FLOOR, z];
};

const [dropX, dropZ] = toXZ(-2, -7.8);
const dropY = roofAt(dropX, dropZ) - 8;
const [amethystAX, amethystAZ] = toXZ(-10, -1.6);
const [amethystBX, amethystBZ] = toXZ(12, -1.6);
const frontRoute = [-16, -12, -8, -4, 0, 4, 8, 12, 16].map((a) => bank(a, 2.8));
const backRoute = [-12, -6, 0, 6, 12].map((a) => bank(a, -6));

const beetle = (glow: string, color: string) =>
	model(
		{
			size: [5, 3, 7],
			scale: 0.3,
			palette: { shell: '#23304a', legs: '#0c0f14', [glow]: { color, emissive: 2.5 } },
		},
		(m) => {
			m.box([1, 0, 1], [3, 0, 5], 'shell');
			m.box([0, 1, 1], [4, 1, 5], 'shell');
			m.box([0, 2, 1], [4, 2, 5], 'shell');
			m.box([2, 2, 1], [2, 2, 5], glow);
			m.box([1, 0, 6], [3, 1, 6], 'shell');
			m.set([1, 1, 6], glow);
			m.set([3, 1, 6], glow);
			m.set([0, 0, 2], 'legs');
			m.set([4, 0, 2], 'legs');
			m.set([0, 0, 4], 'legs');
			m.set([4, 0, 4], 'legs');
		},
	);

export default defineDiorama({
	meta: {
		title: 'Cave',
		createdAt: '2026-10-08',
		author: { model: 'Claude Haiku 5.5' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'An underground stream in a limestone cave: stalactites, stalagmites, calcite, amethyst and layers of basalt and hematite in the cross-section. At night fireflies drift by the entrance and glowing beetles roam the bank.',
		tags: ['cave', 'stream', 'fireflies', 'beetles', 'stalactites', 'minerals'],
	},
	seed: 2129275373,
	size: [64, 40, 64],
	palette: {
		basalt: '#3a3e48',
		limestone: '#cfc3a6',
		hematite: '#7d3b2c',
		pyrite: '#d8b44a',
		calcite: '#efeadb',
		amethyst: { color: '#9b6bff', emissive: 1.6 },
		river: { color: '#2f78b8', kind: 'water' },
	},
	build(w) {
		const { rng } = w;
		const stone = (x: number, y: number, top: number) => {
			if (y < FLOOR - 1 || y >= top - 2) return 'basalt';
			if (y === 9 || y === 10) return 'hematite';
			if (w.noise.value(x * 0.15, y * 0.15) > 0.8) return 'calcite';
			return rng.chance(0.012) ? 'pyrite' : 'limestone';
		};
		const stalactite = (x: number, z: number, len: number, r0: number) => {
			const roof = roofAt(x, z);
			for (let h = 0; h < len; h++) {
				w.cylinder([x, roof - 1 - h, z], Math.max(0.5, r0 * (1 - h / len) ** 0.8), 1, 'calcite');
			}
		};
		const stalagmite = (x: number, z: number, len: number, r0: number) => {
			for (let h = 0; h < len; h++) {
				w.cylinder([x, FLOOR + h, z], Math.max(0.5, r0 * (1 - h / len) ** 0.7), 1, 'calcite');
			}
		};
		const crystals = (x: number, z: number, n: number) => {
			for (let i = 0; i < n; i++) {
				const cx = x + rng.int(-1, 1);
				const cz = z + rng.int(-1, 1);
				const h = rng.int(2, 4);
				for (let y = FLOOR; y < FLOOR + h; y++) w.set([cx, y, cz], 'amethyst');
			}
		};

		for (let x = 0; x < 64; x++) {
			for (let z = 0; z < 64; z++) {
				if (x + z >= 64) {
					w.box([x, 0, z], [x, 1, z], 'basalt');
					continue;
				}
				const top = 22 + Math.round(w.noise.fbm(x * 0.08, z * 0.08, 3) * 3);
				const cave = inCave(x, z);
				const river = inRiver(x, z);
				const lo = cave ? (river ? FLOOR - 1 : FLOOR) : top;
				const hi = cave ? roofAt(x, z) : top;
				for (let y = 0; y < top; y++) {
					if (y >= lo && y < hi) continue;
					w.set([x, y, z], river && y === FLOOR - 2 ? 'river' : stone(x, y, top));
				}
			}
		}

		stalactite(dropX, dropZ, 8, 1.4);
		for (let i = 0; i < 16; i++) {
			const [x, z] = toXZ(rng.float(-19, 19), rng.float(-9, -1.5));
			if (!inCave(x, z)) continue;
			const [, b] = toAB(x, z);
			stalactite(x, z, rng.int(4, 6) + Math.round(-b / 3), rng.float(1.1, 1.9));
		}
		for (const a of [-12, -4, 4, 12]) {
			const [x, z] = toXZ(a, riverB(a) - 3.4);
			stalagmite(x, z, rng.int(4, 6), rng.float(1.1, 1.4));
		}
		for (const a of [-19, 18]) {
			const [x, z] = toXZ(a, -2.2);
			stalagmite(x, z, rng.int(3, 5), rng.float(1.4, 1.8));
		}
		crystals(amethystAX, amethystAZ, 4);
		crystals(amethystBX, amethystBZ, 3);
		const boulder = (a: number, b: number, r: number) => {
			const [x, z] = toXZ(a, b);
			w.sphere([x, 2, z], r, 'limestone');
		};
		boulder(-9, 3, 2.5);
		boulder(-3, 5, 2.5);
		boulder(5, 2.5, 1.8);
		boulder(12, 4.5, 2.2);
		boulder(-14, 7, 2.6);
	},
	entities: [
		{
			model: beetle('glowTeal', '#5cffd6'),
			animate: walkPath(frontRoute, { loop: 'pingpong', speed: 0.6, pause: 2 }),
		},
		{
			model: beetle('glowAmber', '#ffb84d'),
			animate: walkPath(backRoute, { loop: 'pingpong', speed: 0.5, pause: 3 }),
		},
	],
	particles: [
		fireflies({ area: [30, 34, 36, 40], count: 18 }),
		pour({ at: [dropX + 0.5, dropY, dropZ + 0.5], rate: 3, lifetime: 1.3 }),
	],
	lights: [
		pointLight({ at: [28, 9, 28], color: '#a9d8ff', intensity: 4, distance: 16 }),
		pointLight({ at: [amethystAX, 7, amethystAZ], color: '#b58cff', intensity: 3, distance: 8 }),
		pointLight({ at: [30, 6, 30], color: '#5cffd6', intensity: 1.5, distance: 6 }),
	],
	atmosphere: { time: { start: 'night', speed: 0 }, sky: 'stylized' },
	camera: { target: [28, 12, 28], position: [58, 38, 58], autoRotate: false },
	base: 'stone',
});
