export const textEditorApp = {
  id: 'texteditor',
  name: 'Text Editor',
  category: 'Productivity',
  icon: '📝',
  permissions: ['filesystem.read', 'filesystem.write', 'notifications'],
  defaultSize: { width: 760, height: 500 },
  launch(ctx) {
    const { mount, services } = ctx;
    let currentPath = '/home/user/Documents/note.txt';

    mount.innerHTML = `
      <div class="text-editor">
        <div class="editor-toolbar">
          <input class="editor-path" value="${currentPath}" />
          <button data-action="open">Open</button>
          <button data-action="save">Save</button>
        </div>
        <textarea spellcheck="false"></textarea>
      </div>
    `;

    const textarea = mount.querySelector('textarea');
    const pathInput = mount.querySelector('.editor-path');

    const load = async () => {
      currentPath = pathInput.value;
      try {
        textarea.value = await services.fs.readFile(currentPath);
      } catch {
        textarea.value = '';
      }
    };

    mount.querySelector('.editor-toolbar').addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (action === 'open') await load();
      if (action === 'save') {
        currentPath = pathInput.value;
        await services.fs.writeFile(currentPath, textarea.value);
        services.events.emit('notify', { message: `Saved ${currentPath}`, type: 'info' });
      }
    });

    load();
  },
};
