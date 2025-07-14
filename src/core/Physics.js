import * as CANNON from 'cannon-es';
import { PHYSICS_CONFIG } from '../utils/constants.js';

export function setupPhysics() {
    const world = new CANNON.World();
    world.gravity.set(0, PHYSICS_CONFIG.gravity, 0);

    const groundMaterial = new CANNON.Material('groundMaterial');
    const planeMaterial = new CANNON.Material('planeMaterial');
    const contactMaterial = new CANNON.ContactMaterial(groundMaterial, planeMaterial, {
        friction: PHYSICS_CONFIG.friction,
        restitution: PHYSICS_CONFIG.restitution,
    });
    world.addContactMaterial(contactMaterial);

    return {
        world,
        groundMaterial,
        planeMaterial,
    };
} 