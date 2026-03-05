export const browserApp = {
  id: 'browser',
  name: 'Aero Browser',
  category: 'Internet',
  icon: '🌐',
  defaultSize: { width: 900, height: 560 },
  launch(ctx) {
    const { mount } = ctx;
    mount.innerHTML = `
      <div class="mini-browser">
        <div class="browser-toolbar">
          <input value="https://example.com" />
          <button>Go</button>
        </div>
        <iframe sandbox="allow-same-origin allow-scripts allow-forms" referrerpolicy="no-referrer"></iframe>
      </div>
    `;

    const input = mount.querySelector('input');
    const button = mount.querySelector('button');
    const frame = mount.querySelector('iframe');

    const navigate = () => {
      let url = input.value.trim();
      if (!url.startsWith('http')) url = `https://${url}`;
      frame.src = url;
    };

    button.addEventListener('click', navigate);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && navigate());
    navigate();
  },
};
