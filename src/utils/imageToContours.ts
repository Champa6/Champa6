export interface Point {
  x: number;
  y: number;
}

export interface Contour {
  points: Point[];
  isHole: boolean;
}

/**
 * Extract contours from an image using marching squares algorithm
 */
export async function imageToContours(
  imageSource: string | File,
  threshold: number = 128
): Promise<Contour[]> {
  const imageData = await loadImageData(imageSource);
  const binaryImage = toBinaryImage(imageData, threshold);
  const contours = marchingSquares(binaryImage, imageData.width, imageData.height);

  // Simplify and normalize contours
  const simplifiedContours = contours.map(contour => ({
    points: simplifyContour(contour.points, 1.5),
    isHole: contour.isHole
  }));

  // Normalize to center and scale
  return normalizeContours(simplifiedContours, imageData.width, imageData.height);
}

async function loadImageData(source: string | File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };

    img.onerror = reject;

    if (typeof source === 'string') {
      img.src = source;
    } else {
      img.src = URL.createObjectURL(source);
    }
  });
}

function toBinaryImage(imageData: ImageData, threshold: number): Uint8Array {
  const { data, width, height } = imageData;
  const binary = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];

    // Consider pixel as "filled" if it's dark enough and opaque enough
    const brightness = (r + g + b) / 3;
    const isFilled = a > 128 && brightness < threshold;
    binary[i] = isFilled ? 1 : 0;
  }

  return binary;
}

function marchingSquares(binary: Uint8Array, width: number, height: number): Contour[] {
  const visited = new Set<string>();
  const contours: Contour[] = [];

  // Pad the binary image
  const padded = new Uint8Array((width + 2) * (height + 2));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      padded[(y + 1) * (width + 2) + (x + 1)] = binary[y * width + x];
    }
  }

  const paddedWidth = width + 2;
  const paddedHeight = height + 2;

  // Find all contour starting points
  for (let y = 0; y < paddedHeight - 1; y++) {
    for (let x = 0; x < paddedWidth - 1; x++) {
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      const cell = getCellType(padded, paddedWidth, x, y);
      if (cell === 0 || cell === 15) continue;

      // Start tracing contour
      const contour = traceContour(padded, paddedWidth, paddedHeight, x, y, visited);
      if (contour.length >= 3) {
        // Offset by -1 to account for padding
        const offsetContour = contour.map(p => ({ x: p.x - 1, y: p.y - 1 }));
        const isHole = isContourClockwise(offsetContour);
        contours.push({ points: offsetContour, isHole });
      }
    }
  }

  return contours;
}

function getCellType(binary: Uint8Array, width: number, x: number, y: number): number {
  const tl = binary[y * width + x];
  const tr = binary[y * width + x + 1];
  const br = binary[(y + 1) * width + x + 1];
  const bl = binary[(y + 1) * width + x];
  return tl * 8 + tr * 4 + br * 2 + bl;
}

function traceContour(
  binary: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<string>
): Point[] {
  const points: Point[] = [];
  let x = startX;
  let y = startY;
  let prevDir = -1;

  const maxIterations = width * height * 2;
  let iterations = 0;

  do {
    const key = `${x},${y}`;
    visited.add(key);

    const cell = getCellType(binary, width, x, y);
    const edge = getEdgePoint(cell, x, y, prevDir);

    if (edge) {
      points.push(edge.point);
      const nextPos = getNextPosition(x, y, edge.dir);
      x = nextPos.x;
      y = nextPos.y;
      prevDir = (edge.dir + 2) % 4;
    } else {
      break;
    }

    iterations++;
  } while ((x !== startX || y !== startY) && iterations < maxIterations);

  return points;
}

function getEdgePoint(
  cell: number,
  x: number,
  y: number,
  prevDir: number
): { point: Point; dir: number } | null {
  // Direction: 0=right, 1=down, 2=left, 3=up
  const edges: { [key: number]: { point: Point; dir: number }[] } = {
    1: [{ point: { x: x, y: y + 0.5 }, dir: 3 }],
    2: [{ point: { x: x + 0.5, y: y + 1 }, dir: 0 }],
    3: [{ point: { x: x, y: y + 0.5 }, dir: 3 }],
    4: [{ point: { x: x + 1, y: y + 0.5 }, dir: 1 }],
    5: [{ point: { x: x, y: y + 0.5 }, dir: 3 }, { point: { x: x + 1, y: y + 0.5 }, dir: 1 }],
    6: [{ point: { x: x + 0.5, y: y + 1 }, dir: 0 }],
    7: [{ point: { x: x, y: y + 0.5 }, dir: 3 }],
    8: [{ point: { x: x + 0.5, y: y }, dir: 2 }],
    9: [{ point: { x: x + 0.5, y: y }, dir: 2 }],
    10: [{ point: { x: x + 0.5, y: y }, dir: 2 }, { point: { x: x + 0.5, y: y + 1 }, dir: 0 }],
    11: [{ point: { x: x + 0.5, y: y }, dir: 2 }],
    12: [{ point: { x: x + 1, y: y + 0.5 }, dir: 1 }],
    13: [{ point: { x: x + 1, y: y + 0.5 }, dir: 1 }],
    14: [{ point: { x: x + 0.5, y: y + 1 }, dir: 0 }],
  };

  const cellEdges = edges[cell];
  if (!cellEdges || cellEdges.length === 0) return null;

  // For ambiguous cases (5, 10), choose based on previous direction
  if (cellEdges.length > 1 && prevDir !== -1) {
    return cellEdges.find(e => e.dir !== (prevDir + 2) % 4) || cellEdges[0];
  }

  return cellEdges[0];
}

function getNextPosition(x: number, y: number, dir: number): { x: number; y: number } {
  switch (dir) {
    case 0: return { x: x + 1, y };
    case 1: return { x, y: y + 1 };
    case 2: return { x: x - 1, y };
    case 3: return { x, y: y - 1 };
    default: return { x, y };
  }
}

function isContourClockwise(points: Point[]): boolean {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    sum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return sum > 0;
}

function simplifyContour(points: Point[], tolerance: number): Point[] {
  if (points.length <= 3) return points;

  // Douglas-Peucker algorithm
  const simplified = douglasPeucker(points, tolerance);
  return simplified.length >= 3 ? simplified : points;
}

function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLengthSq = dx * dx + dy * dy;

  if (lineLengthSq === 0) {
    return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
  }

  const t = Math.max(0, Math.min(1,
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSq
  ));

  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

function normalizeContours(contours: Contour[], _width: number, _height: number): Contour[] {
  if (contours.length === 0) return contours;

  // Find bounding box of all contours
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const contour of contours) {
    for (const point of contour.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  const contourWidth = maxX - minX;
  const contourHeight = maxY - minY;
  const scale = 100 / Math.max(contourWidth, contourHeight); // Normalize to 100mm max size

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return contours.map(contour => ({
    ...contour,
    points: contour.points.map(p => ({
      x: (p.x - centerX) * scale,
      y: (p.y - centerY) * scale
    }))
  }));
}

/**
 * Parse SVG and extract contours from paths
 */
export async function svgToContours(svgSource: string | File): Promise<Contour[]> {
  const svgText = typeof svgSource === 'string'
    ? await fetch(svgSource).then(r => r.text())
    : await svgSource.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  if (!svg) throw new Error('Invalid SVG');

  const paths = svg.querySelectorAll('path');
  const contours: Contour[] = [];

  for (const path of paths) {
    const d = path.getAttribute('d');
    if (!d) continue;

    const pathContours = parsePathData(d);
    contours.push(...pathContours);
  }

  // Also handle basic shapes
  const circles = svg.querySelectorAll('circle');
  const rects = svg.querySelectorAll('rect');
  const ellipses = svg.querySelectorAll('ellipse');
  const polygons = svg.querySelectorAll('polygon');

  for (const circle of circles) {
    const cx = parseFloat(circle.getAttribute('cx') || '0');
    const cy = parseFloat(circle.getAttribute('cy') || '0');
    const r = parseFloat(circle.getAttribute('r') || '0');
    contours.push(createCircleContour(cx, cy, r));
  }

  for (const ellipse of ellipses) {
    const cx = parseFloat(ellipse.getAttribute('cx') || '0');
    const cy = parseFloat(ellipse.getAttribute('cy') || '0');
    const rx = parseFloat(ellipse.getAttribute('rx') || '0');
    const ry = parseFloat(ellipse.getAttribute('ry') || '0');
    contours.push(createEllipseContour(cx, cy, rx, ry));
  }

  for (const rect of rects) {
    const x = parseFloat(rect.getAttribute('x') || '0');
    const y = parseFloat(rect.getAttribute('y') || '0');
    const w = parseFloat(rect.getAttribute('width') || '0');
    const h = parseFloat(rect.getAttribute('height') || '0');
    contours.push(createRectContour(x, y, w, h));
  }

  for (const polygon of polygons) {
    const pointsStr = polygon.getAttribute('points') || '';
    const points = parsePolygonPoints(pointsStr);
    if (points.length >= 3) {
      contours.push({ points, isHole: false });
    }
  }

  // Get SVG viewBox for normalization
  const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) || [0, 0, 100, 100];
  const svgWidth = viewBox[2] - viewBox[0];
  const svgHeight = viewBox[3] - viewBox[1];

  return normalizeContours(contours, svgWidth, svgHeight);
}

function parsePathData(d: string): Contour[] {
  const contours: Contour[] = [];
  let currentContour: Point[] = [];
  let currentX = 0, currentY = 0;
  let startX = 0, startY = 0;

  // Simple path parser - handles M, L, H, V, Z, C, Q commands
  const commands = d.match(/[MLHVZCSQTAmlhvzcsqta][^MLHVZCSQTAmlhvzcsqta]*/g) || [];

  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

    switch (type) {
      case 'M':
        if (currentContour.length >= 3) {
          contours.push({ points: currentContour, isHole: isContourClockwise(currentContour) });
        }
        currentContour = [];
        currentX = args[0];
        currentY = args[1];
        startX = currentX;
        startY = currentY;
        currentContour.push({ x: currentX, y: currentY });
        // Handle implicit lineto after moveto
        for (let i = 2; i < args.length; i += 2) {
          currentX = args[i];
          currentY = args[i + 1];
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'm':
        if (currentContour.length >= 3) {
          contours.push({ points: currentContour, isHole: isContourClockwise(currentContour) });
        }
        currentContour = [];
        currentX += args[0];
        currentY += args[1];
        startX = currentX;
        startY = currentY;
        currentContour.push({ x: currentX, y: currentY });
        for (let i = 2; i < args.length; i += 2) {
          currentX += args[i];
          currentY += args[i + 1];
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'L':
        for (let i = 0; i < args.length; i += 2) {
          currentX = args[i];
          currentY = args[i + 1];
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'l':
        for (let i = 0; i < args.length; i += 2) {
          currentX += args[i];
          currentY += args[i + 1];
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'H':
        for (const x of args) {
          currentX = x;
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'h':
        for (const dx of args) {
          currentX += dx;
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'V':
        for (const y of args) {
          currentY = y;
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'v':
        for (const dy of args) {
          currentY += dy;
          currentContour.push({ x: currentX, y: currentY });
        }
        break;

      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          const points = cubicBezier(
            { x: currentX, y: currentY },
            { x: args[i], y: args[i + 1] },
            { x: args[i + 2], y: args[i + 3] },
            { x: args[i + 4], y: args[i + 5] }
          );
          currentContour.push(...points.slice(1));
          currentX = args[i + 4];
          currentY = args[i + 5];
        }
        break;

      case 'c':
        for (let i = 0; i < args.length; i += 6) {
          const points = cubicBezier(
            { x: currentX, y: currentY },
            { x: currentX + args[i], y: currentY + args[i + 1] },
            { x: currentX + args[i + 2], y: currentY + args[i + 3] },
            { x: currentX + args[i + 4], y: currentY + args[i + 5] }
          );
          currentContour.push(...points.slice(1));
          currentX += args[i + 4];
          currentY += args[i + 5];
        }
        break;

      case 'Q':
        for (let i = 0; i < args.length; i += 4) {
          const points = quadraticBezier(
            { x: currentX, y: currentY },
            { x: args[i], y: args[i + 1] },
            { x: args[i + 2], y: args[i + 3] }
          );
          currentContour.push(...points.slice(1));
          currentX = args[i + 2];
          currentY = args[i + 3];
        }
        break;

      case 'q':
        for (let i = 0; i < args.length; i += 4) {
          const points = quadraticBezier(
            { x: currentX, y: currentY },
            { x: currentX + args[i], y: currentY + args[i + 1] },
            { x: currentX + args[i + 2], y: currentY + args[i + 3] }
          );
          currentContour.push(...points.slice(1));
          currentX += args[i + 2];
          currentY += args[i + 3];
        }
        break;

      case 'Z':
      case 'z':
        currentX = startX;
        currentY = startY;
        if (currentContour.length >= 3) {
          contours.push({ points: currentContour, isHole: isContourClockwise(currentContour) });
        }
        currentContour = [];
        break;
    }
  }

  if (currentContour.length >= 3) {
    contours.push({ points: currentContour, isHole: isContourClockwise(currentContour) });
  }

  return contours;
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, segments: number = 10): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    points.push({
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    });
  }
  return points;
}

function quadraticBezier(p0: Point, p1: Point, p2: Point, segments: number = 10): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;

    points.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
    });
  }
  return points;
}

function createCircleContour(cx: number, cy: number, r: number, segments: number = 32): Contour {
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }
  return { points, isHole: false };
}

function createEllipseContour(cx: number, cy: number, rx: number, ry: number, segments: number = 32): Contour {
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle)
    });
  }
  return { points, isHole: false };
}

function createRectContour(x: number, y: number, w: number, h: number): Contour {
  return {
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h }
    ],
    isHole: false
  };
}

function parsePolygonPoints(pointsStr: string): Point[] {
  const numbers = pointsStr.trim().split(/[\s,]+/).map(Number);
  const points: Point[] = [];
  for (let i = 0; i < numbers.length - 1; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}
