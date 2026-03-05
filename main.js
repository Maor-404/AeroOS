import { Kernel } from './core/kernel.js';

const kernel = new Kernel();
window.AeroOS = kernel.exposePublicApi();

kernel.boot().catch((error) => {
  console.error('AeroOS failed to boot', error);
  document.body.innerHTML = `<pre style="color: white; background: #111; padding: 24px;">Boot error: ${error.message}</pre>`;
});
