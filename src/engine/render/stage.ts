import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import {
	BoxGeometry,
	DirectionalLight,
	FogExp2,
	Group,
	HemisphereLight,
	Mesh,
	PerspectiveCamera,
	Scene,
	Vector3,
	type WebGPURenderer,
} from 'three/webgpu';
import {
	directionalLight,
	emissiveScale,
	moonDirection,
	nightFactor,
	paletteAt,
	sunDirection,
} from '../atmosphere/daycycle.ts';
import { createSkyView, type SkyView } from '../atmosphere/skies.ts';
import type { QualityLevel, SceneConfig, SkyConfig, Vec3 } from '../types.ts';
import { type Box, clampPan } from './fly.ts';
import { createBaseMaterial } from './materials.ts';
import { createPipeline, type Pipeline } from './pipeline.ts';
import { CSM_MIN_SPAN, QUALITY_PRESETS, type QualityPreset } from './quality.ts';
import type { AtmosphereUniforms } from './uniforms.ts';

function disposeGroup(group: Group): void {
	group.traverse((object) => {
		if (object instanceof Mesh) object.geometry.dispose();
	});
}

/** Сцена диорамы: камера с orbit-управлением, небо, солнце с тенью, подставка, группа мира. */
export class Stage {
	readonly scene = new Scene();
	readonly camera: PerspectiveCamera;
	readonly controls: OrbitControls;
	world = new Group();

	private readonly sun = new DirectionalLight();
	private readonly hemi = new HemisphereLight();
	private skyView: SkyView;
	sky: SkyConfig;
	private readonly skyRadius: number;
	private readonly seed: number;
	private lastHour = 13;
	private readonly fog: FogExp2;
	private readonly center: Vector3;
	private readonly radius: number;
	private base: Mesh | null = null;
	quality: QualityLevel = 'high';
	preset: QualityPreset = QUALITY_PRESETS.high;
	private pipeline: Pipeline | null = null;
	private readonly span: number;
	/** Куда может улететь цель камеры при полёте с клавиатуры. */
	private readonly flyBox: Box;
	/** CSM подключается при сборке шейдера света — решается один раз, до первого кадра. */
	private shadowsFrozen = false;

	constructor(
		private readonly renderer: WebGPURenderer,
		config: SceneConfig,
		private readonly uniforms: AtmosphereUniforms,
	) {
		const [sx, sy, sz] = config.size;
		this.center = new Vector3(sx / 2, sy / 2, sz / 2);
		this.radius = Math.hypot(sx, sy, sz) / 2;
		this.span = Math.max(sx, sz);
		const margin = this.span * 0.1;
		this.flyBox = { min: [-margin, 0, -margin], max: [sx + margin, sy + margin, sz + margin] };

		const far = config.camera.maxDistance * 2 + this.radius * 4;
		this.camera = new PerspectiveCamera(40, 1, 0.5, far);
		this.camera.position.set(...config.camera.position);

		this.controls = new OrbitControls(this.camera, renderer.domElement);
		this.controls.target.set(...config.camera.target);
		this.controls.enableDamping = true;
		this.controls.autoRotate = config.camera.autoRotate;
		this.controls.autoRotateSpeed = 0.5;
		this.controls.minDistance = config.camera.minDistance;
		this.controls.maxDistance = config.camera.maxDistance;
		this.controls.maxPolarAngle = Math.PI * 0.49;
		this.controls.update();

		this.skyRadius = far * 0.9;
		this.seed = config.seed;
		this.sky = config.sky;
		this.skyView = createSkyView(config.sky, this.scene, this.skyRadius, config.seed);
		this.fog = new FogExp2('#ffffff', config.fog);
		if (config.fog > 0) this.scene.fog = this.fog;

		this.sun.castShadow = true;
		this.sun.shadow.mapSize.set(2048, 2048);
		this.sun.shadow.bias = -0.0005;
		this.sun.shadow.normalBias = 0.05;
		const shadowCamera = this.sun.shadow.camera;
		shadowCamera.left = -this.radius;
		shadowCamera.right = this.radius;
		shadowCamera.top = this.radius;
		shadowCamera.bottom = -this.radius;
		shadowCamera.near = 0.5;
		shadowCamera.far = this.radius * 4;
		shadowCamera.updateProjectionMatrix();

		this.scene.add(this.sun, this.sun.target, this.hemi, this.world);

		if (config.base !== 'none') {
			this.base = new Mesh(new BoxGeometry(sx + 4, 3, sz + 4), createBaseMaterial(config.base));
			this.base.position.set(sx / 2, -1.5, sz / 2);
			this.base.receiveShadow = true;
			this.scene.add(this.base);
		}

		this.setQuality('high');
		this.setHour(config.time.start);
	}

	setHour(hour: number): void {
		const p = paletteAt(hour);
		const light = directionalLight(hour);
		const night = nightFactor(hour);
		const direction = new Vector3(...light.direction);
		this.sun.position.copy(this.center).addScaledVector(direction, this.radius * 2);
		this.sun.target.position.copy(this.center);
		this.sun.color.set(p.sunColor);
		this.sun.intensity = p.sunIntensity * light.intensityFactor;
		this.hemi.color.set(p.hemiSky);
		this.hemi.groundColor.set(p.hemiGround);
		this.hemi.intensity = p.hemiIntensity;
		this.lastHour = hour;
		this.skyView.update({
			palette: p,
			sunDirection: sunDirection(hour),
			moonDirection: moonDirection(hour),
			night,
			time: this.uniforms.time.value,
		});
		this.fog.color.set(p.fog);
		this.renderer.toneMappingExposure = p.exposure;
		this.pipeline?.setNight(night);
		this.uniforms.night.value = night;
		this.uniforms.emissiveScale.value = emissiveScale(night);
		this.uniforms.horizon.value.set(p.horizon);
	}

	/** Скорость полёта (ед./с): диорама из края в край — примерно за 8 с. */
	get flySpeed(): number {
		return this.span / 8;
	}

	/** Азимут камеры вокруг цели (для направления WASD). */
	get yaw(): number {
		return this.controls.getAzimuthalAngle();
	}

	/** Сдвиг камеры вместе с целью: вращение мышью продолжается вокруг новой точки. */
	pan(delta: Vec3): void {
		const t = this.controls.target;
		const [dx, dy, dz] = clampPan([t.x, t.y, t.z], delta, this.flyBox);
		t.set(t.x + dx, t.y + dy, t.z + dz);
		this.camera.position.set(
			this.camera.position.x + dx,
			this.camera.position.y + dy,
			this.camera.position.z + dz,
		);
	}

	setAutoRotate(on: boolean): void {
		this.controls.autoRotate = on;
	}

	setSky(sky: SkyConfig): void {
		if (sky.kind === this.sky.kind && sky.color === this.sky.color) return;
		this.skyView.dispose();
		this.sky = sky;
		this.skyView = createSkyView(sky, this.scene, this.skyRadius, this.seed);
		this.setHour(this.lastHour);
	}

	setQuality(level: QualityLevel): void {
		this.quality = level;
		this.preset = QUALITY_PRESETS[level];
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.preset.dpr));
		this.sun.shadow.mapSize.set(this.preset.shadowMapSize, this.preset.shadowMapSize);
		if (!this.shadowsFrozen) {
			const shadow = this.sun.shadow as typeof this.sun.shadow & { shadowNode?: CSMShadowNode };
			const wantCsm = this.preset.csm && this.span > CSM_MIN_SPAN;
			if (wantCsm && !shadow.shadowNode) {
				shadow.shadowNode = new CSMShadowNode(this.sun, {
					cascades: 3,
					maxFar: this.camera.far,
					mode: 'practical',
					lightMargin: this.radius,
				});
			} else if (!wantCsm && shadow.shadowNode) {
				shadow.shadowNode.dispose();
				// undefined, не null: AnalyticLightNode проверяет именно `!== undefined`.
				shadow.shadowNode = undefined;
			}
		}
		this.uniforms.waves.value = this.preset.waves ? 1 : 0;
		this.pipeline?.dispose();
		this.pipeline = createPipeline(this.renderer, this.scene, this.camera, this.preset);
	}

	resize(width: number, height: number): void {
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}

	render(): void {
		this.controls.update();
		this.skyView.follow(this.camera.position);
		this.shadowsFrozen = true;
		this.pipeline?.render();
	}

	/** Подменяет мир целиком (HMR): новая группа уже полностью смеширована. */
	replaceWorld(next: Group): void {
		this.scene.remove(this.world);
		disposeGroup(this.world);
		this.world = next;
		this.scene.add(next);
	}

	dispose(): void {
		disposeGroup(this.world);
		this.controls.dispose();
		this.skyView.dispose();
		this.pipeline?.dispose();
		if (this.base) {
			this.base.geometry.dispose();
			(this.base.material as { dispose(): void }).dispose();
		}
	}
}
