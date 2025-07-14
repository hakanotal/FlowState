// Flight physics parameters
export const FLIGHT_PARAMS = {
    liftCoefficient: 0.15,
    dragCoefficient: 0.05,
    maxThrust: 800,
    rollSensitivity: 200,
    pitchSensitivity: 200,
    yawSensitivity: 50,
};

// Terrain configuration
export const TERRAIN_CONFIG = {
    chunkSize: 128,
    resolution: 50,
    renderDistance: 2,
    noiseScale: 0.01,
    noiseAmplitude: 15,
    maxTrees: 2000,
    treesPerChunk: { min: 30, max: 50 },
};

// Camera settings
export const CAMERA_CONFIG = {
    fov: 75,
    near: 0.1,
    far: 2000,
    fpvOffset: { x: 0, y: 0.8, z: -1.5 },
    chaseOffset: { x: 0, y: 5, z: 12 },
};

// Physics constants
export const PHYSICS_CONFIG = {
    gravity: -9.82,
    timeStep: 1 / 60,
    maxSubSteps: 3,
    planeMass: 5,
    planeRadius: 2.5,
    angularDamping: 0.8,
    linearDamping: 0.1,
    friction: 0.5,
    restitution: 0.1,
};

// Rendering settings
export const RENDER_CONFIG = {
    antialias: true,
    shadowMapSize: 2048,
    clearColor: 0x000000,
    ambientLightColor: 0x666666,
    directionalLightColor: 0xffffff,
    directionalLightIntensity: 0.7,
    fogColor: 0xa0c8a0,
    fogNear: 64,
    fogFar: 256,
};

// Controls configuration
export const CONTROLS_CONFIG = {
    initialThrottle: 0.2,
    throttleStep: 0.02,
    stuckDetectionTime: 3.0,
    stuckSpeedThreshold: 1.0,
    stuckDistanceThreshold: 0.1,
};

// FPS and timing
export const TIMING_CONFIG = {
    targetFPS: 60,
    targetFrameTime: 1000 / 60, // ms per frame
}; 