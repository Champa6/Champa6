import * as THREE from 'three';
import type { Contour, Point } from './imageToContours';

export interface CookieCutterParams {
  height: number;          // Total height in mm (default: 15)
  bladeThickness: number;  // Thickness at cutting edge in mm (default: 0.8)
  topThickness: number;    // Thickness at top in mm (default: 2.5)
  bladeHeight: number;     // Height of the thin cutting portion in mm (default: 5)
  size: number;            // Target size (longest dimension) in mm (default: 80)
}

const DEFAULT_PARAMS: CookieCutterParams = {
  height: 15,
  bladeThickness: 0.8,
  topThickness: 2.5,
  bladeHeight: 5,
  size: 80
};

/**
 * Creates a cookie cutter 3D geometry from contours
 * The cookie cutter has a tapered profile - thin at the bottom (cutting edge)
 * and thicker at the top (for pushing)
 */
export function createCookieCutterGeometry(
  contours: Contour[],
  params: Partial<CookieCutterParams> = {}
): THREE.BufferGeometry {
  const p = { ...DEFAULT_PARAMS, ...params };

  // Filter out holes - we only use the outer contours for the cutter walls
  const outerContours = contours.filter(c => !c.isHole);
  const holeContours = contours.filter(c => c.isHole);

  if (outerContours.length === 0) {
    throw new Error('No valid contours found');
  }

  // Scale factor: contours are normalized to 100mm, scale to target size
  const scaleFactor = p.size / 100;

  // Scale the contours to the target size
  const scaleContour = (contour: Contour): Contour => ({
    ...contour,
    points: contour.points.map(pt => ({
      x: pt.x * scaleFactor,
      y: pt.y * scaleFactor
    }))
  });

  const scaledOuterContours = outerContours.map(scaleContour);
  const scaledHoleContours = holeContours.map(scaleContour);

  const geometries: THREE.BufferGeometry[] = [];

  // Create wall geometry for each outer contour
  for (const contour of scaledOuterContours) {
    const wallGeom = createWallGeometry(contour.points, p);
    geometries.push(wallGeom);
  }

  // Create wall geometry for holes (inner cutouts)
  for (const hole of scaledHoleContours) {
    const wallGeom = createWallGeometry(hole.points, p);
    geometries.push(wallGeom);
  }

  // Merge all geometries
  const mergedGeometry = mergeGeometries(geometries);

  // Center the geometry
  mergedGeometry.computeBoundingBox();
  const center = new THREE.Vector3();
  mergedGeometry.boundingBox!.getCenter(center);
  mergedGeometry.translate(-center.x, -center.y, 0);

  return mergedGeometry;
}

/**
 * Creates the wall geometry for a single contour
 * The wall has a tapered profile: thin at bottom, thick at top
 */
function createWallGeometry(points: Point[], params: CookieCutterParams): THREE.BufferGeometry {
  const { height, bladeThickness, topThickness, bladeHeight } = params;

  const vertices: number[] = [];
  const indices: number[] = [];

  const numPoints = points.length;

  // Calculate normals for each point (perpendicular to the contour)
  const normals: Point[] = [];
  for (let i = 0; i < numPoints; i++) {
    const prev = points[(i - 1 + numPoints) % numPoints];
    const curr = points[i];
    const next = points[(i + 1) % numPoints];

    // Average of the two edge normals
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // Perpendicular vectors (rotate 90 degrees)
    const nx1 = -dy1;
    const ny1 = dx1;
    const nx2 = -dy2;
    const ny2 = dx2;

    // Normalize and average
    const len1 = Math.sqrt(nx1 * nx1 + ny1 * ny1) || 1;
    const len2 = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;

    const nx = (nx1 / len1 + nx2 / len2) / 2;
    const ny = (ny1 / len1 + ny2 / len2) / 2;
    const len = Math.sqrt(nx * nx + ny * ny) || 1;

    normals.push({ x: nx / len, y: ny / len });
  }

  // Create vertices for each layer of the wall profile
  // Profile: bottom edge (thin) -> transition -> top (thick)
  const layers = [
    { z: 0, offset: bladeThickness / 2 },                    // Bottom outer
    { z: 0, offset: -bladeThickness / 2 },                   // Bottom inner
    { z: bladeHeight, offset: bladeThickness / 2 },          // End of blade outer
    { z: bladeHeight, offset: -bladeThickness / 2 },         // End of blade inner
    { z: height, offset: topThickness / 2 },                 // Top outer
    { z: height, offset: -topThickness / 2 },                // Top inner
  ];

  // Generate vertices
  for (let i = 0; i < numPoints; i++) {
    const point = points[i];
    const normal = normals[i];

    for (const layer of layers) {
      vertices.push(
        point.x + normal.x * layer.offset,
        point.y + normal.y * layer.offset,
        layer.z
      );
    }
  }

  const layerCount = layers.length;

  // Generate faces connecting layers
  for (let i = 0; i < numPoints; i++) {
    const next = (i + 1) % numPoints;

    // Outer wall (bottom to blade transition)
    addQuad(indices,
      i * layerCount + 0, next * layerCount + 0,
      next * layerCount + 2, i * layerCount + 2
    );

    // Outer wall (blade to top)
    addQuad(indices,
      i * layerCount + 2, next * layerCount + 2,
      next * layerCount + 4, i * layerCount + 4
    );

    // Inner wall (bottom to blade transition)
    addQuad(indices,
      i * layerCount + 1, i * layerCount + 3,
      next * layerCount + 3, next * layerCount + 1
    );

    // Inner wall (blade to top)
    addQuad(indices,
      i * layerCount + 3, i * layerCount + 5,
      next * layerCount + 5, next * layerCount + 3
    );

    // Bottom face (connects inner and outer at bottom)
    addQuad(indices,
      i * layerCount + 0, i * layerCount + 1,
      next * layerCount + 1, next * layerCount + 0
    );

    // Top face (connects inner and outer at top)
    addQuad(indices,
      i * layerCount + 4, next * layerCount + 4,
      next * layerCount + 5, i * layerCount + 5
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function addQuad(indices: number[], a: number, b: number, c: number, d: number) {
  // Two triangles for a quad
  indices.push(a, b, c);
  indices.push(a, c, d);
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (geometries.length === 0) {
    return new THREE.BufferGeometry();
  }

  if (geometries.length === 1) {
    return geometries[0];
  }

  let totalVertices = 0;
  let totalIndices = 0;

  for (const geom of geometries) {
    totalVertices += geom.attributes.position.count;
    totalIndices += geom.index ? geom.index.count : 0;
  }

  const mergedPositions = new Float32Array(totalVertices * 3);
  const mergedIndices: number[] = [];

  let vertexOffset = 0;
  let positionOffset = 0;

  for (const geom of geometries) {
    const positions = geom.attributes.position.array as Float32Array;
    mergedPositions.set(positions, positionOffset);

    if (geom.index) {
      const indices = geom.index.array;
      for (let i = 0; i < indices.length; i++) {
        mergedIndices.push(indices[i] + vertexOffset);
      }
    }

    vertexOffset += geom.attributes.position.count;
    positionOffset += positions.length;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(mergedPositions, 3));
  merged.setIndex(mergedIndices);
  merged.computeVertexNormals();

  return merged;
}

/**
 * Create a simple preview geometry (just extruded walls without the taper)
 * Used for faster preview during parameter adjustments
 */
export function createPreviewGeometry(
  contours: Contour[],
  height: number = 15,
  thickness: number = 1.5
): THREE.BufferGeometry {
  const outerContours = contours.filter(c => !c.isHole);
  const holeContours = contours.filter(c => c.isHole);

  const geometries: THREE.BufferGeometry[] = [];

  for (const contour of [...outerContours, ...holeContours]) {
    const shape = new THREE.Shape();
    const points = contour.points;

    if (points.length < 3) continue;

    // Create outer path
    shape.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].y);
    }
    shape.closePath();

    // Create offset path (inner)
    const innerShape = offsetContour(points, -thickness);
    const holePath = new THREE.Path();
    holePath.moveTo(innerShape[0].x, innerShape[0].y);
    for (let i = 1; i < innerShape.length; i++) {
      holePath.lineTo(innerShape[i].x, innerShape[i].y);
    }
    holePath.closePath();
    shape.holes.push(holePath);

    const extrudeSettings = {
      depth: height,
      bevelEnabled: false
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometries.push(geometry);
  }

  return mergeGeometries(geometries);
}

function offsetContour(points: Point[], offset: number): Point[] {
  const result: Point[] = [];
  const numPoints = points.length;

  for (let i = 0; i < numPoints; i++) {
    const prev = points[(i - 1 + numPoints) % numPoints];
    const curr = points[i];
    const next = points[(i + 1) % numPoints];

    // Calculate perpendicular direction at this vertex
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;

    // Normalized edge directions
    const ux1 = dx1 / len1, uy1 = dy1 / len1;
    const ux2 = dx2 / len2, uy2 = dy2 / len2;

    // Perpendicular (normal) directions
    const nx1 = -uy1, ny1 = ux1;
    const nx2 = -uy2, ny2 = ux2;

    // Average normal
    let nx = nx1 + nx2;
    let ny = ny1 + ny2;
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
    nx /= nlen;
    ny /= nlen;

    // Calculate miter length (to handle sharp corners)
    const dot = nx1 * nx + ny1 * ny;
    const miterLength = offset / (dot || 0.1);
    const clampedMiter = Math.sign(miterLength) * Math.min(Math.abs(miterLength), Math.abs(offset) * 2);

    result.push({
      x: curr.x + nx * clampedMiter,
      y: curr.y + ny * clampedMiter
    });
  }

  return result;
}
