import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface Viewer3DProps {
  geometry: THREE.BufferGeometry | null;
}

function CookieCutterMesh({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#e8e8e8"
        metalness={0.3}
        roughness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene({ geometry }: Viewer3DProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[50, 50, 50]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-50, 30, -50]} intensity={0.3} />

      {geometry && <CookieCutterMesh geometry={geometry} />}

      <Grid
        position={[0, 0, -0.1]}
        args={[200, 200]}
        cellSize={5}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={300}
        fadeStrength={1}
        followCamera={false}
      />

      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 1.5}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />

      <Environment preset="studio" />
    </>
  );
}

export function Viewer3D({ geometry }: Viewer3DProps) {
  return (
    <div className="viewer-3d">
      <Canvas
        shadows
        camera={{
          position: [80, 80, 80],
          fov: 50,
          near: 0.1,
          far: 2000
        }}
        gl={{ antialias: true }}
      >
        <Scene geometry={geometry} />
      </Canvas>

      {!geometry && (
        <div className="viewer-placeholder">
          <p>Upload an image to generate your cookie cutter</p>
        </div>
      )}
    </div>
  );
}
