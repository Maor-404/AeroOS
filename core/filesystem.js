const DB_NAME = 'aeroos-vfs';
const STORE = 'nodes';

const normalize = (path) => {
  if (!path) return '/';
  let p = path.replace(/\/+/g, '/');
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
};

export class FileSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.db = null;
  }

  async init() {
    this.db = await this.openDb();
    const root = await this.getNode('/');
    if (!root) {
      await this.seed();
    }
  }

  openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'path' });
        }
      };
    });
  }

  tx(mode = 'readonly') {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }

  seed() {
    const paths = ['/', '/system', '/apps', '/home', '/home/user', '/home/user/Desktop', '/home/user/Documents', '/home/user/Downloads'];
    return Promise.all(paths.map((p) => this.writeNode({ path: p, type: 'dir', content: '' })));
  }

  writeNode(node) {
    return new Promise((resolve, reject) => {
      const req = this.tx('readwrite').put(node);
      req.onsuccess = resolve;
      req.onerror = () => reject(req.error);
    });
  }

  getNode(path) {
    const key = normalize(path);
    return new Promise((resolve, reject) => {
      const req = this.tx().get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  delete(path) {
    const key = normalize(path);
    return new Promise((resolve, reject) => {
      const req = this.tx('readwrite').delete(key);
      req.onsuccess = () => {
        this.eventBus.emit('fs:deleted', { path: key });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async list(path = '/') {
    const base = normalize(path);
    const all = await this.all();
    return all
      .filter((node) => node.path !== base && node.path.startsWith(base === '/' ? '/' : `${base}/`))
      .filter((node) => node.path.replace(base, '').split('/').filter(Boolean).length === 1)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  all() {
    return new Promise((resolve, reject) => {
      const req = this.tx().getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async mkdir(path) {
    const key = normalize(path);
    await this.writeNode({ path: key, type: 'dir', content: '' });
    this.eventBus.emit('fs:created', { path: key, type: 'dir' });
  }

  async writeFile(path, content = '') {
    const key = normalize(path);
    await this.writeNode({ path: key, type: 'file', content, updatedAt: Date.now() });
    this.eventBus.emit('fs:updated', { path: key, type: 'file' });
  }

  async readFile(path) {
    const node = await this.getNode(path);
    if (!node || node.type !== 'file') throw new Error(`Not a file: ${path}`);
    return node.content;
  }

  async rename(from, to) {
    const src = await this.getNode(from);
    if (!src) throw new Error(`Not found: ${from}`);
    await this.writeNode({ ...src, path: normalize(to) });
    await this.delete(from);
    this.eventBus.emit('fs:renamed', { from: normalize(from), to: normalize(to) });
  }

  async copy(from, to) {
    const src = await this.getNode(from);
    if (!src) throw new Error(`Not found: ${from}`);
    await this.writeNode({ ...src, path: normalize(to) });
    this.eventBus.emit('fs:copied', { from: normalize(from), to: normalize(to) });
  }

  async move(from, to) {
    await this.copy(from, to);
    await this.delete(from);
    this.eventBus.emit('fs:moved', { from: normalize(from), to: normalize(to) });
  }
}

export const pathUtils = {
  normalize,
  dirname(path) {
    const p = normalize(path);
    if (p === '/') return '/';
    const parts = p.split('/').filter(Boolean);
    parts.pop();
    return `/${parts.join('/')}` || '/';
  },
  basename(path) {
    const p = normalize(path);
    if (p === '/') return '/';
    const parts = p.split('/').filter(Boolean);
    return parts[parts.length - 1];
  },
};
