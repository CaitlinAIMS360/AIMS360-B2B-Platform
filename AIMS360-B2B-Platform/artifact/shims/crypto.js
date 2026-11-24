const randomUUID = () => globalThis.crypto.randomUUID();
const randomBytes = (n) => {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(n));
  return { toString: () => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
};
export default { randomUUID, randomBytes };
