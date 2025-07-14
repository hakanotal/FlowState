import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { RENDER_CONFIG } from '../utils/constants.js';

export function setupScene() {
    // Scene
    const scene = new THREE.Scene();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: RENDER_CONFIG.antialias });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(RENDER_CONFIG.clearColor);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    // Load skybox and setup environment lighting
    const loader = new EXRLoader();
    let directionalLight;
    
    loader.load('/puresky_1k.exr', function(texture) {
        // Setup skybox
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;
        
        // Update lighting with environment-based setup
        setupLightingWithSkybox(scene);
        
        console.log('Skybox loaded successfully');
    }, undefined, function(error) {
        console.error('Error loading skybox:', error);
        // Fallback to original lighting setup
        setupBasicLighting(scene);
    });

    // Setup basic lighting as fallback
    function setupBasicLighting(scene) {
        // Ambient light (reduced since we'll have environment lighting)
        scene.add(new THREE.AmbientLight(RENDER_CONFIG.ambientLightColor, 0.3));
        
        // Directional light (sun)
        directionalLight = new THREE.DirectionalLight(
            RENDER_CONFIG.directionalLightColor, 
            RENDER_CONFIG.directionalLightIntensity
        );
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = RENDER_CONFIG.shadowMapSize;
        directionalLight.shadow.mapSize.height = RENDER_CONFIG.shadowMapSize;
        
        // Configure shadow camera for better coverage
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 200;
        
        scene.add(directionalLight);
    }

    // Enhanced lighting setup with skybox
    function setupLightingWithSkybox(scene) {
        // Reduced ambient light since environment provides ambient lighting
        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
        
        // Directional light (sun) - positioned to match typical sky lighting
        directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = RENDER_CONFIG.shadowMapSize * 2;
        directionalLight.shadow.mapSize.height = RENDER_CONFIG.shadowMapSize * 2;
        
        // Enhanced shadow camera settings
        directionalLight.shadow.camera.left = -150;
        directionalLight.shadow.camera.right = 150;
        directionalLight.shadow.camera.top = 150;
        directionalLight.shadow.camera.bottom = -150;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 300;
        directionalLight.shadow.bias = -0.0001;
        
        scene.add(directionalLight);
        
        // Additional warm fill light from below (simulates ground bounce)
        const fillLight = new THREE.DirectionalLight(0xffd4a3, 0.2);
        fillLight.position.set(-50, -20, 30);
        scene.add(fillLight);
    }

    // Reduced fog since we have a proper skybox now
    scene.fog = new THREE.Fog(RENDER_CONFIG.fogColor, RENDER_CONFIG.fogNear * 2, RENDER_CONFIG.fogFar * 1.5);

    return {
        scene,
        renderer,
        directionalLight,
    };
} 