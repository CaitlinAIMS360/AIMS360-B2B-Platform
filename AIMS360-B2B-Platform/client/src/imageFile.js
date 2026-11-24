// Turns a picture the person picked into a small data URL the portal can save.
// Everything is resized in the browser first, so a phone photo does not bloat a linesheet.
export function readImage(file, { maxW, maxH, type = 'image/jpeg', quality = 0.85 }) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Choose an image file (PNG, JPG, SVG or WebP).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || 600;
      const h0 = img.naturalHeight || 200;
      const scale = Math.min(1, maxW / w0, maxH / h0);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w0 * scale));
      canvas.height = Math.max(1, Math.round(h0 * scale));
      const ctx = canvas.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(type, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read. Try a PNG or JPG.')); };
    img.src = url;
  });
}
