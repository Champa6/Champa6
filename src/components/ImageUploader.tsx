import React, { useCallback, useState } from 'react';

interface ImageUploaderProps {
  onImageLoad: (file: File) => void;
}

export function ImageUploader({ onImageLoad }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];

    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPG, GIF, SVG, or WebP)');
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    onImageLoad(file);
  }, [onImageLoad]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div className="image-uploader">
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${preview ? 'has-preview' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {preview ? (
          <div className="preview-container">
            <img src={preview} alt="Preview" className="preview-image" />
            <button
              className="change-image-btn"
              onClick={() => {
                setPreview(null);
              }}
            >
              Change Image
            </button>
          </div>
        ) : (
          <>
            <div className="drop-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="drop-text">
              Drag & drop an image here<br />
              or click to select
            </p>
            <p className="drop-hint">
              Supports PNG, JPG, GIF, SVG, WebP
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              onChange={handleInputChange}
              className="file-input"
            />
          </>
        )}
      </div>
    </div>
  );
}
