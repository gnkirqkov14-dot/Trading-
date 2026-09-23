// Малко конфети за празнуване 🎉
export function confetti(n = 80) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F45'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random() * 0.6 + 's';
    p.style.animationDuration = 1.6 + Math.random() * 1.4 + 's';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 3600);
}
