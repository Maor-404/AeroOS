import { pathUtils } from '../../core/filesystem.js';

export const terminalApp = {
  id: 'terminal',
  name: 'Terminal',
  category: 'System',
  icon: '🖥️',
  defaultSize: { width: 760, height: 440 },
  launch(ctx) {
    const { mount, services } = ctx;
    mount.innerHTML = `
      <div class="terminal-app">
        <div class="terminal-output"></div>
        <form class="terminal-input-row">
          <span>aero@user:</span>
          <input autocomplete="off" placeholder="type help" />
        </form>
      </div>
    `;

    const output = mount.querySelector('.terminal-output');
    const input = mount.querySelector('input');
    const form = mount.querySelector('form');
    const history = [];
    let historyIndex = 0;
    let cwd = '/home/user';

    const print = (line = '') => {
      const row = document.createElement('div');
      row.textContent = line;
      output.appendChild(row);
      output.scrollTop = output.scrollHeight;
    };

    const commands = {
      help: () => 'help ls cd pwd mkdir touch rm cat echo clear whoami date tree',
      pwd: () => cwd,
      whoami: () => 'user',
      date: () => new Date().toString(),
      clear: () => {
        output.innerHTML = '';
        return '';
      },
      echo: (args) => args.join(' '),
      ls: async () => (await services.fs.list(cwd)).map((n) => pathUtils.basename(n.path)).join('  '),
      cd: async (args) => {
        const target = args[0] || '/home/user';
        const next = pathUtils.normalize(target.startsWith('/') ? target : `${cwd}/${target}`);
        const node = await services.fs.getNode(next);
        if (!node || node.type !== 'dir') throw new Error('directory not found');
        cwd = next;
        return '';
      },
      mkdir: async (args) => {
        const name = args[0];
        if (!name) throw new Error('name required');
        await services.fs.mkdir(`${cwd}/${name}`);
        return '';
      },
      touch: async (args) => {
        const name = args[0];
        await services.fs.writeFile(`${cwd}/${name}`, '');
        return '';
      },
      rm: async (args) => {
        await services.fs.delete(`${cwd}/${args[0]}`);
        return '';
      },
      cat: async (args) => services.fs.readFile(`${cwd}/${args[0]}`),
      tree: async () => {
        const all = await services.fs.all();
        return all.map((n) => `${n.type === 'dir' ? '📁' : '📄'} ${n.path}`).join('\n');
      },
    };

    const run = async (value) => {
      const [cmd, ...args] = value.trim().split(/\s+/);
      if (!cmd) return;
      print(`> ${value}`);
      if (!commands[cmd]) {
        print(`command not found: ${cmd}`);
        return;
      }
      try {
        const result = await commands[cmd](args);
        if (result) result.split('\n').forEach(print);
      } catch (error) {
        print(`error: ${error.message}`);
      }
    };

    print('AeroOS Terminal v1.0');
    print('Type help for commands');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = input.value;
      history.push(value);
      historyIndex = history.length;
      input.value = '';
      await run(value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history[historyIndex] || '';
      }
      if (e.key === 'ArrowDown') {
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = history[historyIndex] || '';
      }
    });
  },
};
