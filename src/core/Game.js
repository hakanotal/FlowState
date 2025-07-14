import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { setupScene } from './Scene.js';
import { setupPhysics } from './Physics.js';
import { Terrain } from '../terrain/Terrain.js';
import { Aircraft } from '../aircraft/Aircraft.js';
import { CameraController } from '../camera/Camera.js';
import { HUD } from '../ui/HUD.js';
import { createGUI } from '../ui/GUI.js';
import { PHYSICS_CONFIG, TIMING_CONFIG } from '../utils/constants.js';

export class Game {
    constructor() {
        // Initialize core systems
        const sceneData = setupScene();
        this.scene = sceneData.scene;
        this.renderer = sceneData.renderer;
        
        const physicsData = setupPhysics();
        this.world = physicsData.world;
        this.groundMaterial = physicsData.groundMaterial;
        this.planeMaterial = physicsData.planeMaterial;
        
        // Initialize game components
        this.terrain = new Terrain(this.scene, this.world, this.groundMaterial);
        this.aircraft = new Aircraft(this.scene, this.world, this.planeMaterial, this.terrain);
        this.cameraController = new CameraController();
        this.hud = new HUD(this.aircraft, this.terrain);
        
        // Initialize GUI
        this.gui = createGUI(this.aircraft);
        
        // Initialize terrain around starting position
        this.terrain.update(new CANNON.Vec3(0, 0, 0));
        
        // Timing control
        this.clock = new THREE.Clock();
        this.lastFrameTime = 0;
        this.targetFrameTime = TIMING_CONFIG.targetFrameTime;
        
        // Setup resize handler
        this.setupResizeHandler();
        
        // Start the game loop
        this.animate();
    }
    
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            this.cameraController.getCamera().aspect = window.innerWidth / window.innerHeight;
            this.cameraController.getCamera().updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    animate = (currentTime = performance.now()) => {
        requestAnimationFrame(this.animate);
        
        // Skip frame if not enough time has passed (FPS cap)
        if (currentTime - this.lastFrameTime < this.targetFrameTime) return;
        this.lastFrameTime = currentTime;
        
        const deltaTime = this.clock.getDelta();
        
        // Update physics
        const cappedDeltaTime = Math.min(deltaTime, PHYSICS_CONFIG.timeStep);
        this.world.step(PHYSICS_CONFIG.timeStep, cappedDeltaTime, PHYSICS_CONFIG.maxSubSteps);
        
        // Update game components
        this.terrain.update(this.aircraft.getPosition());
        this.aircraft.update(deltaTime);
        this.cameraController.update(this.aircraft.planeGroup);
        this.hud.update(deltaTime, this.scene);
        
        // Render
        this.renderer.render(this.scene, this.cameraController.getCamera());
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    getScene() {
        return this.scene;
    }
    
    getCamera() {
        return this.cameraController.getCamera();
    }
} 