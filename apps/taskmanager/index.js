export const taskManagerApp = {
  id: 'taskmanager',
  name: 'Task Manager',
  category: 'System',
  icon: '📊',
  permissions: ['system.process.read', 'system.process.control'],
  defaultSize: { width: 820, height: 500 },
  launch(ctx) {
    const { mount, services } = ctx;

    mount.innerHTML = `
      <div class="task-manager">
        <div class="tm-toolbar">
          <select id="scheduler-algo">
            <option value="round-robin">Round Robin</option>
            <option value="priority">Priority</option>
            <option value="fcfs">First Come First Serve</option>
          </select>
          <button id="refresh-proc">Refresh</button>
        </div>
        <table>
          <thead>
            <tr><th>PID</th><th>Name</th><th>State</th><th>Priority</th><th>CPU%</th><th>Mem(MB)</th><th>Threads</th><th>Actions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    const tbody = mount.querySelector('tbody');

    const render = () => {
      const processes = services.processes.listProcesses();
      tbody.innerHTML = '';
      processes.forEach((proc) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${proc.pid}</td>
          <td>${proc.name}</td>
          <td>${proc.state}</td>
          <td>${proc.priority}</td>
          <td>${proc.cpuUsage}</td>
          <td>${proc.memoryUsage}</td>
          <td>${proc.threads}</td>
          <td>
            <button data-action="kill" data-pid="${proc.pid}">End</button>
            <button data-action="suspend" data-pid="${proc.pid}">Suspend</button>
            <button data-action="resume" data-pid="${proc.pid}">Resume</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    };

    mount.querySelector('#refresh-proc').addEventListener('click', render);
    mount.querySelector('#scheduler-algo').addEventListener('change', (e) => services.scheduler.setAlgorithm(e.target.value));

    mount.addEventListener('click', (e) => {
      const { action, pid } = e.target.dataset;
      if (!action || !pid) return;
      const processId = Number(pid);
      if (action === 'kill') services.processes.killProcess(processId);
      if (action === 'suspend') services.processes.suspendProcess(processId);
      if (action === 'resume') services.processes.resumeProcess(processId);
      render();
    });

    const off = services.events.on('process:updated', render);
    const off2 = services.events.on('process:spawned', render);
    const off3 = services.events.on('process:killed', render);
    render();

    return () => {
      off();
      off2();
      off3();
    };
  },
};
