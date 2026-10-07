import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { length, mix, normalize, positionLocal, smoothstep, uniform, uv } from 'three/tsl';
import {
	BackSide,
	BoxGeometry,
	Color,
	Group,
	InstancedMesh,
	Matrix4,
	Mesh,
	MeshBasicNodeMaterial,
	PlaneGeometry,
	Quaternion,
	type Scene,
	SphereGeometry,
	Vector3,
} from 'three/webgpu';
import type { ColorUniform, FloatUniform } from '../render/uniforms.ts';
import type { SkyConfig, Vec3 } from '../types.ts';
import { mixHex, type Palette } from './daycycle.ts';
import { cloudLayout, starLayout } from './layout.ts';

export interface SkyState {
	palette: Palette;
	sunDirection: Vec3;
	moonDirection: Vec3;
	night: number;
	/** Часы анимации, секунды. */
	time: number;
}

export interface SkyView {
	update(state: SkyState): void;
	/** Небо следует за камерой (бесконечно далёкое). */
	follow(position: Vector3): void;
	dispose(): void;
}

interface Part {
	update(state: SkyState): void;
	dispose(): void;
}

function gradientDome(root: Group, radius: number): Part {
	const zenith = uniform(new Color());
	const horizon = uniform(new Color());
	const material = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
	material.colorNode = mix(horizon, zenith, smoothstep(-0.05, 0.6, normalize(positionLocal).y));
	const geometry = new SphereGeometry(radius, 32, 16);
	const mesh = new Mesh(geometry, material);
	mesh.frustumCulled = false;
	mesh.renderOrder = -2;
	root.add(mesh);
	return {
		update({ palette }) {
			zenith.value.set(palette.zenith);
			horizon.value.set(palette.horizon);
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

function stars(root: Group, radius: number, seed: number): Part {
	const layout = starLayout(seed);
	const visibility = uniform(0);
	const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
	material.colorNode = uniform(new Color('#ffffff'));
	material.opacityNode = visibility;
	const geometry = new BoxGeometry(1, 1, 1);
	const mesh = new InstancedMesh(geometry, material, layout.length);
	const m = new Matrix4();
	const q = new Quaternion();
	layout.forEach((s, i) => {
		const r = radius * 0.92;
		const size = radius * 0.0025 * s.size;
		m.compose(
			new Vector3(s.direction[0] * r, s.direction[1] * r, s.direction[2] * r),
			q,
			new Vector3(size, size, size),
		);
		mesh.setMatrixAt(i, m);
	});
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	root.add(mesh);
	return {
		update({ night }) {
			visibility.value = night;
			mesh.visible = night > 0.01;
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

interface Disc extends Part {
	mesh: Mesh;
	tint: ColorUniform;
	visibility: FloatUniform;
}

/** Круглый диск (солнце/луна): квадрат с мягким краем, повёрнутый к камере. */
function disc(root: Group, radius: number, size: number, color: string): Disc {
	const tint = uniform(new Color(color));
	const visibility = uniform(1);
	const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
	material.colorNode = tint;
	material.opacityNode = smoothstep(0.5, 0.42, length(uv().sub(0.5))).mul(visibility);
	const geometry = new PlaneGeometry(1, 1);
	const mesh = new Mesh(geometry, material);
	mesh.scale.setScalar(radius * size);
	mesh.frustumCulled = false;
	mesh.renderOrder = -1;
	root.add(mesh);
	return {
		mesh,
		tint,
		visibility,
		update() {},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

function clouds(root: Group, radius: number, seed: number): Part {
	const layout = cloudLayout(seed);
	const group = new Group();
	const tint = uniform(new Color('#ffffff'));
	const material = new MeshBasicNodeMaterial({ fog: false });
	material.colorNode = tint;
	const geometry = new BoxGeometry(1, 1, 1);
	const total = layout.reduce((n, c) => n + c.boxes.length, 0);
	const mesh = new InstancedMesh(geometry, material, total);
	const m = new Matrix4();
	const q = new Quaternion();
	const cloudSize = radius * 0.18;
	let i = 0;
	for (const c of layout) {
		const cx = Math.cos(c.angle) * c.distance * radius;
		const cz = Math.sin(c.angle) * c.distance * radius;
		const cy = c.height * radius;
		for (const b of c.boxes) {
			m.compose(
				new Vector3(
					cx + b.offset[0] * cloudSize,
					cy + b.offset[1] * cloudSize,
					cz + b.offset[2] * cloudSize,
				),
				q,
				new Vector3(b.size[0] * cloudSize, b.size[1] * cloudSize, b.size[2] * cloudSize),
			);
			mesh.setMatrixAt(i++, m);
		}
	}
	mesh.frustumCulled = false;
	group.add(mesh);
	root.add(group);
	return {
		update({ palette, night, time }) {
			group.rotation.y = time * 0.01;
			const day = mixHex(palette.horizon, '#ffffff', 0.85);
			tint.value.set(mixHex(day, palette.zenith, night * 0.7));
		},
		dispose() {
			geometry.dispose();
			material.dispose();
		},
	};
}

/** Создаёт выбранный вариант неба и добавляет его в сцену. */
export function createSkyView(
	config: SkyConfig,
	scene: Scene,
	radius: number,
	seed: number,
): SkyView {
	const root = new Group();
	scene.add(root);
	const parts: Part[] = [];
	let follow = (position: Vector3): void => {
		root.position.copy(position);
	};

	if (config.kind === 'gradient') parts.push(gradientDome(root, radius));

	if (config.kind === 'solid') {
		const background = new Color();
		scene.background = background;
		parts.push({
			update({ palette }) {
				background.set(config.color ?? palette.horizon);
			},
			dispose() {
				scene.background = null;
			},
		});
	}

	if (config.kind === 'realistic') {
		const sky = new SkyMesh();
		sky.scale.setScalar(radius * 0.9);
		sky.turbidity.value = 2.5;
		sky.rayleigh.value = 1.2;
		sky.mieCoefficient.value = 0.005;
		sky.mieDirectionalG.value = 0.8;
		sky.frustumCulled = false;
		sky.renderOrder = -2;
		root.add(sky);
		parts.push(
			{
				update({ sunDirection }) {
					sky.sunPosition.value.set(sunDirection[0], sunDirection[1], sunDirection[2]);
				},
				dispose() {
					sky.geometry.dispose();
					(sky.material as { dispose(): void }).dispose();
				},
			},
			stars(root, radius, seed),
		);
	}

	if (config.kind === 'stylized') {
		parts.push(gradientDome(root, radius), stars(root, radius, seed), clouds(root, radius, seed));
		const sun = disc(root, radius, 0.06, '#fff2c0');
		const moon = disc(root, radius, 0.04, '#e8ecff');
		const place = (mesh: Mesh, d: Vec3): void => {
			mesh.position.set(d[0] * radius * 0.85, d[1] * radius * 0.85, d[2] * radius * 0.85);
		};
		parts.push(sun, moon, {
			update({ palette, sunDirection, moonDirection, night }) {
				place(sun.mesh, sunDirection);
				place(moon.mesh, moonDirection);
				sun.tint.value.set(mixHex(palette.sunColor, '#ffffff', 0.3));
				sun.visibility.value = sunDirection[1] > -0.05 ? 1 - night * 0.8 : 0;
				moon.visibility.value = moonDirection[1] > -0.05 ? night : 0;
			},
			dispose() {},
		});
		const base = follow;
		follow = (position) => {
			base(position);
			sun.mesh.lookAt(position);
			moon.mesh.lookAt(position);
		};
	}

	return {
		update(state) {
			for (const part of parts) part.update(state);
		},
		follow: (position) => follow(position),
		dispose() {
			for (const part of parts) part.dispose();
			scene.remove(root);
		},
	};
}
