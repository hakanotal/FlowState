import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createNoise2D } from 'simplex-noise';
import { TERRAIN_CONFIG } from '../utils/constants.js';

export class Terrain {
  constructor(scene, world, groundMaterial) {
    this.scene = scene;
    this.world = world;
    this.groundMaterial = groundMaterial;
    this.chunks = new Map();
    this.chunkSize = TERRAIN_CONFIG.chunkSize;
    this.resolution = TERRAIN_CONFIG.resolution;
    this.renderDistance = TERRAIN_CONFIG.renderDistance;
    this.noise2D = createNoise2D();
    this.noiseScale = TERRAIN_CONFIG.noiseScale;
    this.noiseAmplitude = TERRAIN_CONFIG.noiseAmplitude;
    
    // Initialize instanced tree meshes
    this.maxTrees = TERRAIN_CONFIG.maxTrees;
    this.treeCount = 0;
    this.treeInstances = new Map();
    this.availableTreeInstances = [];
    
    // Create instanced meshes for tree parts
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 4, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      fog: true
    });
    this.trunkInstancedMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, this.maxTrees);
    this.trunkInstancedMesh.castShadow = true;
    this.scene.add(this.trunkInstancedMesh);
    
    const leavesGeometry = new THREE.ConeGeometry(2, 5, 8);
    const leavesMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x006400,
      fog: true
    });
    this.leavesInstancedMesh = new THREE.InstancedMesh(leavesGeometry, leavesMaterial, this.maxTrees);
    this.leavesInstancedMesh.castShadow = true;
    this.scene.add(this.leavesInstancedMesh);
  }

  generateChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return;

    const heightData = new Float32Array(this.resolution * this.resolution);
    const matrix = [];
    for (let j = 0; j < this.resolution; j++) {
      const row = [];
      for (let i = 0; i < this.resolution; i++) {
        const wx = cx * this.chunkSize + i * (this.chunkSize / (this.resolution - 1));
        const wz = cz * this.chunkSize + j * (this.chunkSize / (this.resolution - 1));
        const height = (this.noise2D(wx * this.noiseScale, wz * this.noiseScale) + 1) * this.noiseAmplitude / 2;
        heightData[j * this.resolution + i] = height;
        row.push(height);
      }
      matrix.push(row);
    }

    // Mesh
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.resolution * this.resolution * 3);
    const indices = [];
    for (let j = 0; j < this.resolution - 1; j++) {
      for (let i = 0; i < this.resolution - 1; i++) {
        const a = j * this.resolution + i;
        const b = j * this.resolution + (i + 1);
        const c = (j + 1) * this.resolution + (i + 1);
        const d = (j + 1) * this.resolution + i;
        indices.push(a, d, c);
        indices.push(c, b, a);
      }
    }
    for (let j = 0; j < this.resolution; j++) {
      for (let i = 0; i < this.resolution; i++) {
        const idx = (j * this.resolution + i) * 3;
        const wx = cx * this.chunkSize + i * (this.chunkSize / (this.resolution - 1));
        const wz = cz * this.chunkSize + j * (this.chunkSize / (this.resolution - 1));
        const wy = heightData[j * this.resolution + i];
        positions[idx] = wx;
        positions[idx + 1] = wy;
        positions[idx + 2] = wz;
      }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x228B22,
      fog: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Physics - Use trimesh instead of heightfield for better reliability
    const vertices = [];
    const faces = [];
    
    // Generate vertices
    for (let j = 0; j < this.resolution; j++) {
      for (let i = 0; i < this.resolution; i++) {
        const wx = cx * this.chunkSize + i * (this.chunkSize / (this.resolution - 1));
        const wz = cz * this.chunkSize + j * (this.chunkSize / (this.resolution - 1));
        const wy = matrix[j][i];
        vertices.push(wx, wy, wz);
      }
    }
    
    // Generate faces (triangles)
    for (let j = 0; j < this.resolution - 1; j++) {
      for (let i = 0; i < this.resolution - 1; i++) {
        const a = j * this.resolution + i;
        const b = j * this.resolution + (i + 1);
        const c = (j + 1) * this.resolution + (i + 1);
        const d = (j + 1) * this.resolution + i;
        
        // Two triangles per quad
        faces.push([a, d, c]);
        faces.push([c, b, a]);
      }
    }
    
    const trimeshShape = new CANNON.Trimesh(vertices, faces);
    const body = new CANNON.Body({ mass: 0, material: this.groundMaterial });
    body.addShape(trimeshShape);
    body.position.set(0, 0, 0);
    this.world.addBody(body);

    // Trees - Using instanced meshes
    const treeBodies = [];
    const treeInstanceIds = [];
    const numTrees = Math.floor(Math.random() * (TERRAIN_CONFIG.treesPerChunk.max - TERRAIN_CONFIG.treesPerChunk.min + 1)) + TERRAIN_CONFIG.treesPerChunk.min;
    
    for (let k = 0; k < numTrees; k++) {
      const tx = cx * this.chunkSize + Math.random() * this.chunkSize;
      const tz = cz * this.chunkSize + Math.random() * this.chunkSize;
      const ty = (this.noise2D(tx * this.noiseScale, tz * this.noiseScale) + 1) * this.noiseAmplitude / 2;
      
      // Get an instance ID (reuse or create new)
      let instanceId;
      if (this.availableTreeInstances.length > 0) {
        instanceId = this.availableTreeInstances.pop();
      } else if (this.treeCount < this.maxTrees) {
        instanceId = this.treeCount++;
      } else {
        break;
      }
      
      // Create transformation matrices for trunk and leaves
      const trunkMatrix = new THREE.Matrix4();
      trunkMatrix.makeTranslation(tx, ty + 2, tz);
      this.trunkInstancedMesh.setMatrixAt(instanceId, trunkMatrix);
      
      const leavesMatrix = new THREE.Matrix4();
      leavesMatrix.makeTranslation(tx, ty + 5.5, tz);
      this.leavesInstancedMesh.setMatrixAt(instanceId, leavesMatrix);
      
      // Physics body for collision
      const treeBody = new CANNON.Body({ mass: 0, material: this.groundMaterial });
      treeBody.addShape(new CANNON.Cylinder(0.5, 0.5, 4, 8));
      treeBody.position.set(tx, ty + 2, tz);
      this.world.addBody(treeBody);
      treeBodies.push(treeBody);
      
      treeInstanceIds.push(instanceId);
    }
    
    // Update the instanced mesh
    this.trunkInstancedMesh.instanceMatrix.needsUpdate = true;
    this.leavesInstancedMesh.instanceMatrix.needsUpdate = true;
    this.trunkInstancedMesh.count = this.treeCount;
    this.leavesInstancedMesh.count = this.treeCount;

    this.chunks.set(key, { mesh, body, heightData, treeBodies, treeInstanceIds });
  }

  getHeightAt(wx, wz) {
    const cx = Math.floor(wx / this.chunkSize);
    const cz = Math.floor(wz / this.chunkSize);
    const key = `${cx},${cz}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return undefined;
    const localI = (wx - cx * this.chunkSize) / (this.chunkSize / (this.resolution - 1));
    const localJ = (wz - cz * this.chunkSize) / (this.chunkSize / (this.resolution - 1));
    const i0 = Math.floor(localI);
    const j0 = Math.floor(localJ);
    const i1 = i0 + 1;
    const j1 = j0 + 1;
    if (i1 >= this.resolution || j1 >= this.resolution) return chunk.heightData[0];
    const fracI = localI - i0;
    const fracJ = localJ - j0;
    const h00 = chunk.heightData[j0 * this.resolution + i0];
    const h10 = chunk.heightData[j0 * this.resolution + i1];
    const h01 = chunk.heightData[j1 * this.resolution + i0];
    const h11 = chunk.heightData[j1 * this.resolution + i1];
    return (1 - fracI) * (1 - fracJ) * h00 + fracI * (1 - fracJ) * h10 + (1 - fracI) * fracJ * h01 + fracI * fracJ * h11;
  }

  update(position) {
    const cx = Math.floor(position.x / this.chunkSize);
    const cz = Math.floor(position.z / this.chunkSize);
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
        this.generateChunk(cx + dx, cz + dz);
      }
    }
    for (const [key, chunk] of this.chunks.entries()) {
      const [ex, ez] = key.split(',').map(Number);
      if (Math.abs(ex - cx) > this.renderDistance || Math.abs(ez - cz) > this.renderDistance) {
        this.scene.remove(chunk.mesh);
        this.world.removeBody(chunk.body);
        chunk.treeBodies.forEach(body => this.world.removeBody(body));
        this.removeTreeInstances(chunk.treeInstanceIds);
        this.chunks.delete(key);
      }
    }
  }
  
  removeTreeInstances(instanceIds) {
    const hiddenMatrix = new THREE.Matrix4();
    hiddenMatrix.makeTranslation(999999, 999999, 999999);
    
    instanceIds.forEach(id => {
      this.trunkInstancedMesh.setMatrixAt(id, hiddenMatrix);
      this.leavesInstancedMesh.setMatrixAt(id, hiddenMatrix);
      this.availableTreeInstances.push(id);
    });
    
    this.trunkInstancedMesh.instanceMatrix.needsUpdate = true;
    this.leavesInstancedMesh.instanceMatrix.needsUpdate = true;
  }
} 