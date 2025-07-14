import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FLIGHT_PARAMS, PHYSICS_CONFIG, CONTROLS_CONFIG } from '../utils/constants.js';

export class Aircraft {
    constructor(scene, world, planeMaterial, terrain) {
        this.scene = scene;
        this.world = world;
        this.terrain = terrain;
        
        // Controls state
        this.controls = { 
            throttle: CONTROLS_CONFIG.initialThrottle, 
            roll: 0, 
            pitch: 0, 
            yaw: 0 
        };
        this.keys = {};
        
        // Stuck detection
        this.stuckTimer = 0;
        this.lastPosition = new CANNON.Vec3();
        
        // Flight parameters (modifiable via GUI)
        this.flightParams = { ...FLIGHT_PARAMS };
        
        // Create visual model
        this.createVisualModel();
        
        // Create physics body
        this.createPhysicsBody(planeMaterial);
        
        // Setup controls
        this.setupControls();
    }
    
    createVisualModel() {
        this.planeGroup = new THREE.Group();
        const fuselage = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 4), 
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        const wings = new THREE.Mesh(
            new THREE.BoxGeometry(8, 0.2, 2), 
            new THREE.MeshStandardMaterial({ color: 0xcccccc })
        );
        const tail = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 1, 2), 
            new THREE.MeshStandardMaterial({ color: 0xcccccc })
        );
        tail.position.set(0, 0.5, 2);
        this.planeGroup.add(fuselage, wings, tail);
        this.planeGroup.castShadow = true;
        this.scene.add(this.planeGroup);
    }
    
    createPhysicsBody(planeMaterial) {
        this.planeBody = new CANNON.Body({ mass: PHYSICS_CONFIG.planeMass, material: planeMaterial });
        this.planeBody.addShape(new CANNON.Sphere(PHYSICS_CONFIG.planeRadius));
        this.planeBody.position.set(0, 50, 0);
        this.planeBody.angularDamping = PHYSICS_CONFIG.angularDamping;
        this.planeBody.linearDamping = PHYSICS_CONFIG.linearDamping;
        this.world.addBody(this.planeBody);
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => (this.keys[e.code] = true));
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'KeyR') {
                this.reset();
            }
        });
    }
    
    updateControls() {
        // Throttle
        if (this.keys['KeyW']) this.controls.throttle = Math.min(1.0, this.controls.throttle + CONTROLS_CONFIG.throttleStep);
        if (this.keys['KeyS']) this.controls.throttle = Math.max(0.0, this.controls.throttle - CONTROLS_CONFIG.throttleStep);
        // Roll, Pitch, Yaw
        this.controls.roll = (this.keys['ArrowLeft'] ? 1 : this.keys['ArrowRight'] ? -1 : 0);
        this.controls.pitch = (this.keys['ArrowUp'] ? 1 : this.keys['ArrowDown'] ? -1 : 0);
        this.controls.yaw = (this.keys['KeyA'] ? -1 : this.keys['KeyD'] ? 1 : 0);
    }
    
    applyAerodynamics() {
        const velocity = this.planeBody.velocity;
        const speed = velocity.length();
        
        // 1. Thrust
        const thrustVector = new CANNON.Vec3(0, 0, -1);
        this.planeBody.vectorToWorldFrame(thrustVector, thrustVector);
        const thrustForce = thrustVector.scale(this.controls.throttle * this.flightParams.maxThrust);
        this.planeBody.applyForce(thrustForce);

        // 2. Lift & Drag (True Angle of Attack)
        if (speed > 1.0) {
            const worldVelocity = this.planeBody.velocity;
            const localVelocity = new CANNON.Vec3();
            this.planeBody.quaternion.inverse().vmult(worldVelocity, localVelocity);
            
            const angleOfAttack = Math.atan2(-localVelocity.y, -localVelocity.z);
            const wingArea = 16; // From wing geometry (8 * 2)
            const airDensity = 1.225;

            // Lift Force (Perpendicular to velocity)
            const liftMagnitude = 0.5 * airDensity * speed * speed * wingArea * this.flightParams.liftCoefficient * Math.sin(angleOfAttack * 2);
            const liftDirection = new CANNON.Vec3(0, 1, 0);
            this.planeBody.vectorToWorldFrame(liftDirection, liftDirection);
            const liftForce = liftDirection.scale(liftMagnitude);
            this.planeBody.applyForce(liftForce);
            
            // Drag Force (Opposite to velocity)
            const dragMagnitude = 0.5 * airDensity * speed * speed * wingArea * this.flightParams.dragCoefficient;
            const dragForce = velocity.clone().scale(-dragMagnitude);
            this.planeBody.applyForce(dragForce);
        }
        
        // 3. Control Torques
        const controlEffectiveness = Math.min(1.0, speed / 25.0);
        
        const localTorque = new CANNON.Vec3(
            this.controls.pitch * this.flightParams.pitchSensitivity * controlEffectiveness,
            this.controls.yaw * this.flightParams.yawSensitivity * controlEffectiveness,
            this.controls.roll * this.flightParams.rollSensitivity * controlEffectiveness
        );

        const worldTorque = this.planeBody.quaternion.vmult(localTorque);
        this.planeBody.applyTorque(worldTorque);
    }
    
    updateStuckDetection(deltaTime) {
        const currentPos = this.planeBody.position.clone();
        const distanceMoved = currentPos.distanceTo(this.lastPosition);
        const speed = this.planeBody.velocity.length();
        
        // If plane is moving very slowly or stuck
        if (speed < CONTROLS_CONFIG.stuckSpeedThreshold && distanceMoved < CONTROLS_CONFIG.stuckDistanceThreshold) {
            this.stuckTimer += deltaTime;
            if (this.stuckTimer > CONTROLS_CONFIG.stuckDetectionTime) {
                // Push the plane upward and forward to unstick it
                const groundHeight = this.terrain.getHeightAt(this.planeBody.position.x, this.planeBody.position.z) || 0;
                this.planeBody.position.y = Math.max(this.planeBody.position.y, groundHeight + 10);
                this.planeBody.velocity.set(0, 5, -10);
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
        
        this.lastPosition.copy(currentPos);
    }
    
    checkCrash() {
        const groundHeight = this.terrain.getHeightAt(this.planeBody.position.x, this.planeBody.position.z) || 0;
        if (this.planeBody.position.y < groundHeight + 1.0) {
            this.reset();
        }
    }
    
    reset() {
        this.planeBody.position.set(0, (this.terrain.getHeightAt(0, 0) || 0) + 40, 0);
        this.planeBody.quaternion.set(0, 0, 0, 1);
        this.planeBody.velocity.set(0, 0, 0);
        this.planeBody.angularVelocity.set(0, 0, 0);
    }
    
    update(deltaTime) {
        this.updateControls();
        this.applyAerodynamics();
        this.updateStuckDetection(deltaTime);
        this.checkCrash();
        
        // Sync visual model with physics body
        this.planeGroup.position.copy(this.planeBody.position);
        this.planeGroup.quaternion.copy(this.planeBody.quaternion);
    }
    
    getPosition() {
        return this.planeBody.position;
    }
    
    getVelocity() {
        return this.planeBody.velocity;
    }
    
    getQuaternion() {
        return this.planeGroup.quaternion;
    }
} 