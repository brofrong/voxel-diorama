import { uniform } from 'three/tsl';
import { Color, type Vector3 } from 'three/webgpu';

const floatUniform = (value: number) => uniform(value);
const colorUniform = (value: Color) => uniform(value);
const vec3Uniform = (value: Vector3) => uniform(value);

export type FloatUniform = ReturnType<typeof floatUniform>;
export type ColorUniform = ReturnType<typeof colorUniform>;
export type Vec3Uniform = ReturnType<typeof vec3Uniform>;

/** Общие для материалов, неба и частиц параметры атмосферы; обновляются раз в кадр. */
export interface AtmosphereUniforms {
	/** Часы анимации, секунды. */
	time: FloatUniform;
	/** Ночной коэффициент 0..1. */
	night: FloatUniform;
	/** Множитель свечения материалов. */
	emissiveScale: FloatUniform;
	/** Цвет горизонта (для френеля воды). */
	horizon: ColorUniform;
	/** 1 — волны на воде, 0 — плоская вода (качество low). */
	waves: FloatUniform;
}

export function createAtmosphereUniforms(): AtmosphereUniforms {
	return {
		time: floatUniform(0),
		night: floatUniform(0),
		emissiveScale: floatUniform(1),
		horizon: colorUniform(new Color('#bcd8f5')),
		waves: floatUniform(1),
	};
}
