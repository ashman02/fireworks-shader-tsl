import * as THREE from "three/webgpu"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { SkyMesh } from "three/addons/objects/SkyMesh.js"
import { Inspector } from "three/addons/inspector/Inspector.js"
import {
	color,
	Fn,
	instancedBufferAttribute,
	min,
	mul,
	positionLocal,
	range,
	uniform,
	vec3,
} from "three/tsl"
import gsap from "gsap"

/**
 * Base
 */

// Canvas
const canvas = document.querySelector("canvas.threejs")

// Scene
const scene = new THREE.Scene()

// Loaders
const textureLoader = new THREE.TextureLoader()

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
}

window.addEventListener("resize", () => {
	// update sizes
	sizes.width = window.innerWidth
	sizes.height = window.innerHeight

	// update camera
	camera.aspect = sizes.width / sizes.height
	camera.updateProjectionMatrix()

	// update renderer
	renderer.setSize(sizes.width, sizes.height)
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */

// Base Camera
const camera = new THREE.PerspectiveCamera(
	35,
	sizes.width / sizes.height,
	0.1,
	100,
)
camera.position.set(1.5, 0, 6)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
	canvas: canvas,
	antialias: true,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x111111)
renderer.inspector = new Inspector()

/**
 * Fireworks
 */

// textures
const textures = [
	textureLoader.load("./particles/1.png"),
	textureLoader.load("./particles/2.png"),
	textureLoader.load("./particles/3.png"),
	textureLoader.load("./particles/4.png"),
	textureLoader.load("./particles/5.png"),
	textureLoader.load("./particles/6.png"),
	textureLoader.load("./particles/7.png"),
	textureLoader.load("./particles/8.png"),
]

const createFirework = (count, position, texture, radius, color) => {
	// Material
	const material = new THREE.SpriteNodeMaterial({
		color: color,
		alphaMap: texture,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	})

	// Uniforms
	const progress = uniform(0)

	// Buffers
	const positionsArray = new Float32Array(count * 3)
	const positionsBuffer = new THREE.InstancedBufferAttribute(
		positionsArray,
		3,
	)

	const sizesArray = new Float32Array(count)
	const sizesBuffer = new THREE.InstancedBufferAttribute(sizesArray, 1)

	const timesArray = new Float32Array(count)
	const timesBuffer = new THREE.InstancedBufferAttribute(timesArray, 1)

	for (let i = 0; i < count; i++) {
		const i3 = i * 3

		const spherical = new THREE.Spherical(
			radius * (0.75 + Math.random() * 0.25),
			Math.random() * Math.PI,
			Math.random() * Math.PI * 2,
		)
		const position = new THREE.Vector3()
		position.setFromSpherical(spherical)

		positionsArray[i3 + 0] = position.x
		positionsArray[i3 + 1] = position.y
		positionsArray[i3 + 2] = position.z

		sizesArray[i] = Math.random()
		timesArray[i] = 1 + Math.random()
	}

	// Position
	material.positionNode = Fn(() => {
		// Buffers
		const instancedPosition = instancedBufferAttribute(positionsBuffer)
		const instancedtime = instancedBufferAttribute(timesBuffer)

		const instanceProgress = progress.mul(instancedtime)
		const newPosition = instancedPosition.toVar()

		// Exploding
		const exploadingProgress = instanceProgress
			.remapClamp(0, 0.1, 0, 1)
			.oneMinus()
			.pow(3)
			.oneMinus()
		newPosition.mulAssign(exploadingProgress)

		// Falling
		const fallingProgress = instanceProgress
			.remapClamp(0.1, 1, 0, 1)
			.oneMinus()
			.pow(3)
			.oneMinus()
		newPosition.y.subAssign(fallingProgress.mul(0.2))

		return newPosition
	})()

	// Scaling
	material.scaleNode = Fn(() => {
		// Buffers
		const instancedSize = instancedBufferAttribute(sizesBuffer)
		const instancedtime = instancedBufferAttribute(timesBuffer)

		const instanceProgress = progress.mul(instancedtime)

		// Scaling
		const openingScaleProgress = instanceProgress.remap(0, 0.125, 0, 1)
		const closingScaleProgress = instanceProgress.remap(0.125, 1, 1, 0)
		const sizeProgress = min(
			openingScaleProgress,
			closingScaleProgress,
		).clamp(0, 1)

		// Twinkling
		const twinkingProgress = instanceProgress.remapClamp(0.2, 0.8, 0, 1)
		const sizeTwinkling = instanceProgress
			.mul(30)
			.sin()
			.mul(0.5)
			.add(0.5)
			.mul(twinkingProgress)
			.oneMinus()

		return mul(instancedSize, sizeProgress, sizeTwinkling)
	})()

	// Sprites
	const firework = new THREE.Sprite(material)
	firework.count = count
	firework.position.copy(position)
	scene.add(firework)

	// Destroy
	const destroy = () => {
		scene.remove(firework)
		material.dispose()
	}

	// Animate
	gsap.to(progress, {
		value: 1,
		ease: "none",
		duration: 3,
		onComplete: destroy,
	})
}

const createRandomFirework = () => {
	const count = Math.round(400 + Math.random() * 1000)
	const position = new THREE.Vector3(
		(Math.random() - 0.5) * 2,
		Math.random(),
		(Math.random() - 0.5) * 2,
	)
	const texture = textures[Math.floor(Math.random() * textures.length)]
	const radius = 0.5 + Math.random()
	const color = new THREE.Color()
	color.setHSL(Math.random(), 1, 0.7)
	createFirework(count, position, texture, radius, color)
}

createRandomFirework()

window.addEventListener("click", createRandomFirework)

/**
 * Sky
 */
const sky = new SkyMesh()
sky.scale.setScalar(1000)
scene.add(sky)
const effectController = {
	turbidity: 5.5,
	rayleigh: 1.25,
	mieCoefficient: 0.02,
	mieDirectionalG: 0.35,
	elevation: 0.4,
	azimuth: 52,
	cloudCoverage: 0.4,
	cloudDensity: 0.4,
	cloudElevation: 0.5,
}

const sun = new THREE.Vector3()

const skyChanged = () => {
	sky.turbidity.value = effectController.turbidity
	sky.rayleigh.value = effectController.rayleigh
	sky.mieCoefficient.value = effectController.mieCoefficient
	sky.mieDirectionalG.value = effectController.mieDirectionalG
	sky.cloudCoverage.value = effectController.cloudCoverage
	sky.cloudDensity.value = effectController.cloudDensity
	sky.cloudElevation.value = effectController.cloudElevation

	const phi = THREE.MathUtils.degToRad(90 - effectController.elevation)
	const theta = THREE.MathUtils.degToRad(effectController.azimuth)

	sun.setFromSphericalCoords(1, phi, theta)

	sky.sunPosition.value.copy(sun)
}

skyChanged()

// Debug
const skyGui = renderer.inspector.createParameters("Sky").close()

skyGui.add(effectController, "turbidity", 0.0, 20.0, 0.1).onChange(skyChanged)
skyGui.add(effectController, "rayleigh", 0.0, 4, 0.001).onChange(skyChanged)
skyGui
	.add(effectController, "mieCoefficient", 0.0, 0.1, 0.001)
	.onChange(skyChanged)
skyGui
	.add(effectController, "mieDirectionalG", 0.0, 1, 0.001)
	.onChange(skyChanged)
skyGui.add(effectController, "elevation", -10, 90, 0.1).onChange(skyChanged)
skyGui.add(effectController, "azimuth", -180, 180, 0.1).onChange(skyChanged)

/**
 * Animate
 */
const tick = () => {
	// Update Controls
	controls.update()
	// Render
	renderer.render(scene, camera)
}

renderer.setAnimationLoop(tick)
