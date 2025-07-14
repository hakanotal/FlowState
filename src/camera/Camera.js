import * as THREE from 'three';
import { CAMERA_CONFIG } from '../utils/constants.js';

export class CameraController {
    constructor() {
        this.camera = new THREE.PerspectiveCamera(
            CAMERA_CONFIG.fov, 
            window.innerWidth / window.innerHeight, 
            CAMERA_CONFIG.near, 
            CAMERA_CONFIG.far
        );
        
        this.mode = 'fpv'; // 'fpv' or 'chase'
        this.fpvOffset = new THREE.Vector3(
            CAMERA_CONFIG.fpvOffset.x, 
            CAMERA_CONFIG.fpvOffset.y, 
            CAMERA_CONFIG.fpvOffset.z
        );
        this.chaseOffset = new THREE.Vector3(
            CAMERA_CONFIG.chaseOffset.x, 
            CAMERA_CONFIG.chaseOffset.y, 
            CAMERA_CONFIG.chaseOffset.z
        );
        
        this.setupControls();
        this.setupResizeHandler();
    }
    
    setupControls() {
        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyC') {
                this.toggleMode();
            }
        });
    }
    
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }
    
    toggleMode() {
        this.mode = this.mode === 'fpv' ? 'chase' : 'fpv';
    }
    
    update(planeGroup) {
        const offset = this.mode === 'fpv' ? this.fpvOffset : this.chaseOffset;
        const cameraTargetPosition = planeGroup.position.clone()
            .add(offset.clone().applyQuaternion(planeGroup.quaternion));
        
        // Smooth camera movement
        this.camera.position.lerp(cameraTargetPosition, 0.1);
        
        if (this.mode === 'fpv') {
            // In FPV mode, match the plane's orientation for realistic cockpit view
            this.camera.quaternion.slerp(planeGroup.quaternion, 0.1);
        } else {
            // In chase mode, just look at the plane
            const lookAtTarget = planeGroup.position.clone();
            this.camera.lookAt(lookAtTarget);
        }
    }
    
    getCamera() {
        return this.camera;
    }
    
    getMode() {
        return this.mode;
    }
} 