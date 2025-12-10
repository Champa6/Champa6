import { useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { ImageUploader } from './components/ImageUploader';
import { Viewer3D } from './components/Viewer3D';
import { Controls } from './components/Controls';
import { imageToContours, svgToContours, type Contour } from './utils/imageToContours';
import { createCookieCutterGeometry, type CookieCutterParams } from './utils/cookieCutterGeometry';
import { exportToSTL } from './utils/stlExporter';
import './App.css';

const DEFAULT_PARAMS: CookieCutterParams = {
  height: 15,
  bladeThickness: 0.8,
  topThickness: 2.5,
  bladeHeight: 5
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [contours, setContours] = useState<Contour[]>([]);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [params, setParams] = useState<CookieCutterParams>(DEFAULT_PARAMS);
  const [threshold, setThreshold] = useState(128);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process image when file or threshold changes
  useEffect(() => {
    if (!file) return;

    const processImage = async () => {
      setIsProcessing(true);
      setError(null);

      try {
        let extractedContours: Contour[];

        if (file.type === 'image/svg+xml') {
          extractedContours = await svgToContours(file);
        } else {
          extractedContours = await imageToContours(file, threshold);
        }

        if (extractedContours.length === 0) {
          throw new Error('No shapes found in the image. Try adjusting the threshold.');
        }

        setContours(extractedContours);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image');
        setContours([]);
      } finally {
        setIsProcessing(false);
      }
    };

    processImage();
  }, [file, threshold]);

  // Generate geometry when contours or params change
  useEffect(() => {
    if (contours.length === 0) {
      setGeometry(null);
      return;
    }

    try {
      const newGeometry = createCookieCutterGeometry(contours, params);
      setGeometry(newGeometry);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate geometry');
      setGeometry(null);
    }
  }, [contours, params]);

  const handleImageLoad = useCallback((loadedFile: File) => {
    setFile(loadedFile);
    setError(null);
  }, []);

  const handleExport = useCallback(() => {
    if (!geometry) return;

    const filename = file
      ? `${file.name.replace(/\.[^.]+$/, '')}-cookie-cutter.stl`
      : 'cookie-cutter.stl';

    exportToSTL(geometry, filename);
  }, [geometry, file]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cookie Cutter Generator</h1>
        <p>Transform your images into 3D printable cookie cutters</p>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <ImageUploader onImageLoad={handleImageLoad} />

          {file && (
            <Controls
              params={params}
              onChange={setParams}
              onExport={handleExport}
              hasGeometry={geometry !== null}
              threshold={threshold}
              onThresholdChange={setThreshold}
            />
          )}
        </aside>

        <section className="viewer-section">
          {isProcessing && (
            <div className="processing-overlay">
              <div className="spinner"></div>
              <p>Processing image...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          <Viewer3D geometry={geometry} />
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Cookie Cutter Generator - Upload an image, adjust settings, and download your STL file for 3D printing
        </p>
      </footer>
    </div>
  );
}

export default App;
