import { useState } from 'react';
import { readImage } from '../imageFile.js';

// Upload, preview and remove one picture. `value` is a data URL or ''.
export default function ImagePicker({ value, onChange, label, help, options, previewClass = '', dark }) {
  const [error, setError] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      onChange(await readImage(file, options));
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div className="imgpick">
      {value
        ? <div className={`imgpick-preview ${previewClass} ${dark ? 'dark' : ''}`}><img src={value} alt={`${label} preview`} /></div>
        : <div className={`imgpick-preview empty ${previewClass}`}>No image yet</div>}
      <div className="row">
        <label className="btn sm" style={{ cursor: 'pointer' }}>
          {value ? `Replace ${label}` : `Upload ${label}`}
          <input type="file" accept="image/*" onChange={pick} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
        </label>
        {value && <button type="button" className="btn ghost sm danger" onClick={() => onChange('')}>Remove</button>}
      </div>
      {help && <p className="small muted" style={{ margin: '8px 0 0' }}>{help}</p>}
      {error && <p className="small" style={{ color: 'var(--bad)', margin: '8px 0 0' }} role="alert">{error}</p>}
    </div>
  );
}
