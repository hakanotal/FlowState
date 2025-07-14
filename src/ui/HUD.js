import * as THREE from 'three';
import { RENDER_CONFIG } from '../utils/constants.js';

export class HUD {
    constructor(aircraft, terrain) {
        this.aircraft = aircraft;
        this.terrain = terrain;
        this.lastVelocityY = 0;
        
        // Get DOM elements
        this.speedElement = document.getElementById('speed');
        this.altitudeElement = document.getElementById('altitude');
        this.throttleElement = document.getElementById('throttle');
        this.gforceElement = document.getElementById('gforce');
        this.horizonElement = document.getElementById('horizon');
        this.fpsElement = document.getElementById('fps-value');
    }
    
    updateFog(scene) {
        // Adjust fog based on altitude for more realistic atmospheric effect
        const altitude = this.aircraft.getPosition().y - (this.terrain.getHeightAt(this.aircraft.getPosition().x, this.aircraft.getPosition().z) || 0);
        const baseNear = RENDER_CONFIG.fogNear;
        const baseFar = RENDER_CONFIG.fogFar;
        
        // Increase fog distance at higher altitudes
        const altitudeMultiplier = Math.max(1, 1 + altitude / 200);
        scene.fog.near = baseNear * altitudeMultiplier;
        scene.fog.far = baseFar * altitudeMultiplier;
    }
    
    update(deltaTime, scene) {
        if (!this.aircraft) return;
        
        const velocity = this.aircraft.getVelocity();
        const position = this.aircraft.getPosition();
        const quaternion = this.aircraft.getQuaternion();
        
        const speed = velocity.length();
        const altitude = position.y - (this.terrain.getHeightAt(position.x, position.z) || 0);
        const gForce = Math.abs(velocity.y - this.lastVelocityY) / (1 / 60 * 9.82) + 1;
        this.lastVelocityY = velocity.y;

        // Update HUD elements
        if (this.speedElement) this.speedElement.textContent = speed.toFixed(1);
        if (this.altitudeElement) this.altitudeElement.textContent = altitude.toFixed(1);
        if (this.throttleElement) this.throttleElement.textContent = (this.aircraft.controls.throttle * 100).toFixed(0);
        if (this.gforceElement) this.gforceElement.textContent = gForce.toFixed(1);
        
        // Update FPS display
        if (this.fpsElement && deltaTime > 0) {
            this.fpsElement.textContent = Math.round(1 / deltaTime);
        }

        // Update artificial horizon
        if (this.horizonElement) {
            const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
            const roll = euler.z * (180 / Math.PI);
            const pitch = euler.x * (180 / Math.PI);
            this.horizonElement.style.transform = `rotate(${-roll}deg) translateY(${pitch * 2}px)`;
        }
        
        // Update fog
        this.updateFog(scene);
    }
} 