import { pathUtils } from '../../core/filesystem.js';

export const fileManagerApp = {
  id: 'filemanager',
  name: 'File Manager',
  category: 'Utilities',
  icon: '📁',
  defaultSize: { width: 840, height: 520 },
  launch(ctx) {
    const { mount, services } = ctx;
    let cwd = '/home/user';

    mount.innerHTML = `
      <div class="file-manager">
        <aside class="fm-sidebar"></aside>
        <section class="fm-list"></section>
        <aside class="fm-info">Select an item.</aside>
      </div>
    `;

    const sidebar = mount.querySelector('.fm-sidebar');
    const list = mount.querySelector('.fm-list');
    const info = mount.querySelector('.fm-info');
    const roots = ['/home/user/Desktop', '/home/user/Documents', '/home/user/Downloads', '/system', '/apps'];

    const renderSidebar = () => {
      sidebar.innerHTML = '<h4>Places</h4>';
      roots.forEach((path) => {
        const btn = document.createElement('button');
        btn.textContent = path;
        btn.addEventListener('click', () => {
          cwd = path;
          renderList();
        });
        sidebar.appendChild(btn);
      });

      const create = document.createElement('button');
      create.textContent = '+ New Folder';
      create.addEventListener('click', async () => {
        const name = prompt('Folder name');
        if (!name) return;
        await services.fs.mkdir(`${cwd}/${name}`);
        renderList();
      });
      sidebar.appendChild(create);
    };

    const renderList = async () => {
      const entries = await services.fs.list(cwd);
      list.innerHTML = `<header>${cwd}</header>`;
      entries.forEach((entry) => {
        const row = document.createElement('button');
        row.className = 'fm-row';
        row.innerHTML = `<span>${entry.type === 'dir' ? '📂' : '📄'}</span><strong>${pathUtils.basename(entry.path)}</strong>`;
        row.addEventListener('click', () => {
          info.innerHTML = `<h4>${pathUtils.basename(entry.path)}</h4><p>Type: ${entry.type}</p><p>Path: ${entry.path}</p>`;
        });
        row.addEventListener('dblclick', async () => {
          if (entry.type === 'dir') {
            cwd = entry.path;
            renderList();
            return;
          }
          const content = await services.fs.readFile(entry.path);
          services.events.emit('notify', { message: `Preview: ${content.slice(0, 40) || '(empty)'}` });
        });

        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const action = prompt('Action: rename/delete');
          if (action === 'delete') {
            services.fs.delete(entry.path).then(renderList);
          }
          if (action === 'rename') {
            const next = prompt('New name');
            if (!next) return;
            services.fs.rename(entry.path, `${cwd}/${next}`).then(renderList);
          }
        });
        list.appendChild(row);
      });
    };

    renderSidebar();
    renderList();
  },
};
