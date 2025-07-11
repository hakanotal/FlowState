import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GUI } from 'dat.gui';

//======================================================================//
// SETUP
//======================================================================//

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB); // Sky blue
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

const groundMaterial = new CANNON.Material('groundMaterial');
const planeMaterial = new CANNON.Material('planeMaterial');
const contactMaterial = new CANNON.ContactMaterial(groundMaterial, planeMaterial, {
    friction: 0.5,
    restitution: 0.1,
});
world.addContactMaterial(contactMaterial);

//======================================================================//
// LIGHTING & ENVIRONMENT
//======================================================================//

scene.add(new THREE.AmbientLight(0x666666));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 50, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial3D = new THREE.MeshStandardMaterial({ color: 0x228B22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial3D);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial, shape: new CANNON.Plane() });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

// Create Trees
for (let i = 0; i < 100; i++) {
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.5) * 400;
    if (Math.abs(x) > 20 || Math.abs(z) > 20) {
        const treeGroup = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
        trunk.position.y = 2;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 8), new THREE.MeshStandardMaterial({ color: 0x006400 }));
        leaves.position.y = 5.5;
        trunk.castShadow = true;
        leaves.castShadow = true;
        treeGroup.add(trunk, leaves);
        treeGroup.position.set(x, 0, z);
        scene.add(treeGroup);
    }
}

//======================================================================//
// PLANE SETUP
//======================================================================//

const planeGroup = new THREE.Group();
const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
const wings = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 2), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 2), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
tail.position.set(0, 0.5, 2);
planeGroup.add(fuselage, wings, tail);
planeGroup.castShadow = true;
scene.add(planeGroup);

const planeBody = new CANNON.Body({ mass: 5, material: planeMaterial });
// Compound shape for better collision
planeBody.addShape(new CANNON.Box(new CANNON.Vec3(4, 0.1, 1)), new CANNON.Vec3(0, 0, 0)); // Wings
planeBody.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 2)), new CANNON.Vec3(0, 0, 0)); // Fuselage
planeBody.position.set(0, 10, 0);
planeBody.angularDamping = 0.8; // Add rotational stability
world.addBody(planeBody);

//======================================================================//
// CAMERA
//======================================================================//

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
let cameraMode = 'fpv'; // 'fpv' or 'chase'
const fpvOffset = new THREE.Vector3(0, 0.8, -1.5); // Inside cockpit
const chaseOffset = new THREE.Vector3(0, 5, 12); // Behind and above

//======================================================================//
// FLIGHT PARAMETERS & GUI
//======================================================================//

const flightParams = {
    liftCoefficient: 0.15,
    dragCoefficient: 0.05,
    maxThrust: 300,
    rollSensitivity: 50,
    pitchSensitivity: 25,
    yawSensitivity: 40,
};

const gui = new GUI();
const physicsFolder = gui.addFolder('Flight Physics');
physicsFolder.add(flightParams, 'liftCoefficient', 0, 1).name('Lift');
physicsFolder.add(flightParams, 'dragCoefficient', 0, 1).name('Drag');
physicsFolder.add(flightParams, 'maxThrust', 50, 1000).name('Max Thrust');
physicsFolder.add(flightParams, 'rollSensitivity', 10, 100).name('Roll Speed');
physicsFolder.add(flightParams, 'pitchSensitivity', 10, 100).name('Pitch Speed');
physicsFolder.open();

//======================================================================//
// CONTROLS
//======================================================================//

const controls = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
const keys = {};
document.addEventListener('keydown', (e) => (keys[e.code] = true));
document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyC') {
        cameraMode = cameraMode === 'fpv' ? 'chase' : 'fpv';
    }
    if (e.code === 'KeyR') {
        resetPlane();
    }
});

function updateControls() {
    // Throttle
    if (keys['KeyW']) controls.throttle = Math.min(1.0, controls.throttle + 0.02);
    if (keys['KeyS']) controls.throttle = Math.max(0.0, controls.throttle - 0.02);
    // Roll, Pitch, Yaw
    controls.roll = (keys['ArrowLeft'] ? 1 : keys['ArrowRight'] ? -1 : 0);
    controls.pitch = (keys['ArrowUp'] ? 1 : keys['ArrowDown'] ? -1 : 0);
    controls.yaw = (keys['KeyA'] ? -1 : keys['KeyD'] ? 1 : 0);
}

//======================================================================//
// PHYSICS & ANIMATION LOOP
//======================================================================//

const speedElement = document.getElementById('speed');
const altitudeElement = document.getElementById('altitude');
const throttleElement = document.getElementById('throttle');
const gforceElement = document.getElementById('gforce');
const horizonElement = document.getElementById('horizon');
let lastVelocityY = 0;

function applyAerodynamics() {
    const velocity = planeBody.velocity;
    const speed = velocity.length();
    
    // 1. Thrust
    const thrustVector = new CANNON.Vec3(0, 0, -1);
    planeBody.vectorToWorldFrame(thrustVector, thrustVector);
    const thrustForce = thrustVector.scale(controls.throttle * flightParams.maxThrust);
    planeBody.applyForce(thrustForce);

    // 2. Lift & Drag (True Angle of Attack)
    if (speed > 1.0) {
        const worldVelocity = planeBody.velocity;
        const localVelocity = new CANNON.Vec3();
        planeBody.quaternion.inverse().vmult(worldVelocity, localVelocity);
        
        const angleOfAttack = Math.atan2(-localVelocity.y, -localVelocity.z);
        const wingArea = 16; // From wing geometry (8 * 2)
        const airDensity = 1.225;

        // Lift Force (Perpendicular to velocity)
        const liftMagnitude = 0.5 * airDensity * speed * speed * wingArea * flightParams.liftCoefficient * Math.sin(angleOfAttack * 2); // sin(2a) is a good approximation
        const liftDirection = new CANNON.Vec3(0, 1, 0); // Start with local 'up'
        planeBody.vectorToWorldFrame(liftDirection, liftDirection);
        const liftForce = liftDirection.scale(liftMagnitude);
        planeBody.applyForce(liftForce);
        
        // Drag Force (Opposite to velocity)
        const dragMagnitude = 0.5 * airDensity * speed * speed * wingArea * flightParams.dragCoefficient;
        const dragForce = velocity.clone().scale(-dragMagnitude);
        planeBody.applyForce(dragForce);
    }
    
    // 3. Control Torques
    const controlEffectiveness = Math.min(1.0, speed / 25.0); // Controls are less effective at low speed
    
    // Define the torque in the plane's local coordinate system
    const localTorque = new CANNON.Vec3(
        controls.pitch * flightParams.pitchSensitivity * controlEffectiveness,
        controls.yaw * flightParams.yawSensitivity * controlEffectiveness,
        controls.roll * flightParams.rollSensitivity * controlEffectiveness
    );

    // Convert the local torque vector to world coordinates
    const worldTorque = planeBody.quaternion.vmult(localTorque);

    // Apply the torque in world coordinates
    planeBody.applyTorque(worldTorque);
}

function updateCamera() {
    const offset = cameraMode === 'fpv' ? fpvOffset : chaseOffset;
    const cameraTargetPosition = planeGroup.position.clone().add(offset.clone().applyQuaternion(planeGroup.quaternion));
    camera.position.lerp(cameraTargetPosition, 0.1); // Smooth camera movement
    
    if (cameraMode === 'fpv') {
        // In FPV mode, match the plane's orientation for realistic cockpit view
        camera.quaternion.slerp(planeGroup.quaternion, 0.1);
    } else {
        // In chase mode, just look at the plane
        const lookAtTarget = planeGroup.position.clone();
        camera.lookAt(lookAtTarget);
    }
}

function updateHUD() {
    const speed = planeBody.velocity.length();
    const altitude = planeBody.position.y;
    const gForce = Math.abs(planeBody.velocity.y - lastVelocityY) / (1 / 60 * 9.82) + 1;
    lastVelocityY = planeBody.velocity.y;

    speedElement.textContent = speed.toFixed(1);
    altitudeElement.textContent = altitude.toFixed(1);
    throttleElement.textContent = (controls.throttle * 100).toFixed(0);
    gforceElement.textContent = gForce.toFixed(1);

    const euler = new THREE.Euler().setFromQuaternion(planeGroup.quaternion, 'YXZ');
    const roll = euler.z * (180 / Math.PI);
    const pitch = euler.x * (180 / Math.PI);
    horizonElement.style.transform = `rotate(${-roll}deg) translateY(${pitch * 2}px)`;
}

function resetPlane() {
    planeBody.position.set(0, 10, 0);
    planeBody.quaternion.set(0, 0, 0, 1);
    planeBody.velocity.set(0, 0, 0);
    planeBody.angularVelocity.set(0, 0, 0);
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const fpsValue = document.getElementById('fps-value');
    if (fpsValue && deltaTime > 0) {
        fpsValue.textContent = Math.round(1 / deltaTime);
    }

    updateControls();
    applyAerodynamics();

    world.step(1 / 60, deltaTime, 3);
    
    // Sync visual model with physics body
    planeGroup.position.copy(planeBody.position);
    planeGroup.quaternion.copy(planeBody.quaternion);

    if (planeBody.position.y < 0.5) {
        resetPlane();
    }
    
    updateCamera();
    updateHUD();

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});