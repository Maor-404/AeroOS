export const systemMonitorApp = {
  id: 'systemmonitor',
  name: 'System Monitor',
  category: 'System',
  icon: '🛰️',
  permissions: ['system.metrics.read'],
  defaultSize: { width: 760, height: 460 },
  launch(ctx) {
    const { mount, services } = ctx;
    mount.innerHTML = `
      <div class="sys-monitor">
        <canvas width="700" height="300"></canvas>
        <div class="sys-stats"></div>
      </div>
    `;

    const canvas = mount.querySelector('canvas');
    const stats = mount.querySelector('.sys-stats');
    const g = canvas.getContext('2d');
    const history = [];

    const draw = () => {
      const processes = services.processes.listProcesses();
      const cpu = processes.reduce((sum, p) => sum + Number(p.cpuUsage || 0), 0);
      const memory = services.memory.reportUsage();
      const fsNodes = services.fs.all ? null : null;

      history.push({ cpu, mem: memory.usedMemoryMb, count: processes.length });
      if (history.length > 50) history.shift();

      g.clearRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 0, canvas.width, canvas.height);

      const drawLine = (key, color, scale) => {
        g.beginPath();
        g.strokeStyle = color;
        history.forEach((point, idx) => {
          const x = (idx / 49) * canvas.width;
          const y = canvas.height - Math.min(canvas.height - 10, point[key] * scale) - 10;
          if (idx === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
      };

      drawLine('cpu', '#71f5ff', 2.2);
      drawLine('mem', '#ffd166', 0.05);
      drawLine('count', '#8aff80', 8);

      stats.innerHTML = `
        <p>CPU total: ${cpu.toFixed(1)}%</p>
        <p>Memory: ${memory.usedMemoryMb} / ${memory.totalMemoryMb} MB</p>
        <p>Process count: ${processes.length}</p>
        <p>Filesystem usage: simulated in IndexedDB</p>
      `;
    };

    const timer = setInterval(draw, 900);
    draw();
    return () => clearInterval(timer);
  },
};
