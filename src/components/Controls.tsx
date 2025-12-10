import type { CookieCutterParams } from '../utils/cookieCutterGeometry';

interface ControlsProps {
  params: CookieCutterParams;
  onChange: (params: CookieCutterParams) => void;
  onExport: () => void;
  hasGeometry: boolean;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  invertColors: boolean;
  onInvertColorsChange: (invert: boolean) => void;
  isSvg: boolean;
}

export function Controls({
  params,
  onChange,
  onExport,
  hasGeometry,
  threshold,
  onThresholdChange,
  invertColors,
  onInvertColorsChange,
  isSvg
}: ControlsProps) {

  const handleParamChange = (key: keyof CookieCutterParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="controls">
      <h3>Cookie Cutter Settings</h3>

      {!isSvg && (
        <>
          <div className="control-group">
            <label>
              <span className="label-text">Image Threshold</span>
              <span className="label-value">{threshold}</span>
            </label>
            <input
              type="range"
              min="1"
              max="255"
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
            />
            <p className="control-hint">Adjust to capture more or less of the image</p>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={invertColors}
                onChange={(e) => onInvertColorsChange(e.target.checked)}
              />
              <span className="label-text">Invert colors</span>
            </label>
            <p className="control-hint">Enable for light shapes on dark backgrounds</p>
          </div>
        </>
      )}

      <div className="control-group">
        <label>
          <span className="label-text">Size (longest side)</span>
          <span className="label-value">{params.size} mm</span>
        </label>
        <input
          type="range"
          min="30"
          max="150"
          step="5"
          value={params.size}
          onChange={(e) => handleParamChange('size', Number(e.target.value))}
        />
        <p className="control-hint">Final size of the cookie cutter</p>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">Total Height</span>
          <span className="label-value">{params.height} mm</span>
        </label>
        <input
          type="range"
          min="8"
          max="30"
          step="0.5"
          value={params.height}
          onChange={(e) => handleParamChange('height', Number(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">Blade Height</span>
          <span className="label-value">{params.bladeHeight} mm</span>
        </label>
        <input
          type="range"
          min="2"
          max="10"
          step="0.5"
          value={params.bladeHeight}
          onChange={(e) => handleParamChange('bladeHeight', Number(e.target.value))}
        />
        <p className="control-hint">Height of the thin cutting edge</p>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">Blade Thickness</span>
          <span className="label-value">{params.bladeThickness} mm</span>
        </label>
        <input
          type="range"
          min="0.4"
          max="1.5"
          step="0.1"
          value={params.bladeThickness}
          onChange={(e) => handleParamChange('bladeThickness', Number(e.target.value))}
        />
        <p className="control-hint">Thickness at the cutting edge (bottom)</p>
      </div>

      <div className="control-group">
        <label>
          <span className="label-text">Top Thickness</span>
          <span className="label-value">{params.topThickness} mm</span>
        </label>
        <input
          type="range"
          min="1.5"
          max="5"
          step="0.1"
          value={params.topThickness}
          onChange={(e) => handleParamChange('topThickness', Number(e.target.value))}
        />
        <p className="control-hint">Thickness at the top (for pressing)</p>
      </div>

      <button
        className="export-btn"
        onClick={onExport}
        disabled={!hasGeometry}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download STL
      </button>

      <div className="info-box">
        <h4>Tips for best results:</h4>
        <ul>
          <li>Use images with clear, dark shapes on light backgrounds</li>
          <li>Simple shapes work better than complex ones</li>
          <li>SVG files give the best quality</li>
          <li>Adjust the threshold if the shape isn't captured correctly</li>
        </ul>
      </div>
    </div>
  );
}
