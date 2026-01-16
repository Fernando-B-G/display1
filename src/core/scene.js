// src/core/scene.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStars } from '../starfield.js';
import { refs } from './state.js';
import { detectPerformanceTier, getOptimizedSettings, capPixelRatio } from '../performance.js';

export function initScene() {
  const { container } = refs;

  // Detect performance tier and get optimized settings
  const perfTier = detectPerformanceTier();
  const settings = getOptimizedSettings(perfTier);

  // Store performance settings in refs for later use
  refs.performanceTier = perfTier;
  refs.performanceSettings = settings;

  refs.clock = new THREE.Clock();
  refs.scene = new THREE.Scene();
  refs.scene.background = new THREE.Color(0x030417);

  refs.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
  refs.camera.position.set(10, 40, 60);
  refs.camera.lookAt(40, 0, 0);

  // Performance optimization: adaptive quality settings
  refs.renderer = new THREE.WebGLRenderer({
    antialias: settings.antialias,
    powerPreference: settings.powerPreference
  });
  refs.renderer.setSize(innerWidth, innerHeight);
  // Cap pixel ratio to prevent excessive rendering on high-DPI displays (Phase 1 optimization)
  refs.renderer.setPixelRatio(capPixelRatio(devicePixelRatio, settings.pixelRatio));
  container.appendChild(refs.renderer.domElement);

  refs.controls = new OrbitControls(refs.camera, refs.renderer.domElement);
  refs.controls.enableDamping = true;
  refs.controls.dampingFactor = 0.08;
  refs.controls.maxDistance = 300;
  refs.controls.target.set(40, 0, 0);

  const amb = new THREE.AmbientLight(0xffffff, 0.7);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(50, 80, 30);
  refs.scene.add(amb, dir);

  // Performance optimization: adaptive starfield particle count
  refs.starField = createStars(settings.starfieldCount);
  refs.scene.add(refs.starField);

  refs.mindmapGroup = new THREE.Group();
  refs.scene.add(refs.mindmapGroup);

  refs.centerSimGroup = new THREE.Group();
  refs.centerSimGroup.visible = false;
  refs.scene.add(refs.centerSimGroup);
}
