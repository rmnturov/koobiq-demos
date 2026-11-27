const diagram = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">
  <defs>
    <pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="#d4dfea"/>
    </pattern>
  </defs>
  <rect width="640" height="180" fill="#eef3f8"/>
  <rect width="640" height="180" fill="url(#grid)"/>
  <g fill="none" stroke="#849ab1" stroke-width="2">
    <path d="M149 78h118m-7-6 7 6-7 6M371 78h118m-7-6 7 6-7 6"/>
  </g>
  <g stroke="#30475f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="80" y="47" width="44" height="56" rx="4" fill="#d9e5f0"/>
    <rect x="87" y="53" width="44" height="56" rx="4" fill="#fff"/>
    <path d="M97 67h24m-24 10h24m-24 10h15" fill="none"/>
    <rect x="292" y="47" width="46" height="58" rx="4" fill="#fff"/>
    <path d="m301 64 3 3 6-7m5 4h14m-28 14 3 3 6-7m5 4h9" fill="none"/>
    <circle cx="336" cy="90" r="11" fill="#d9e5f0"/>
    <path d="m344 98 10 11"/>
    <rect x="513" y="51" width="58" height="49" rx="5" fill="#fff"/>
    <path d="M514 64h56m-47-6h1m6 0h1"/>
    <circle cx="561" cy="96" r="14" fill="#b9e7ce"/>
    <path d="m555 96 4 4 8-9" fill="none"/>
  </g>
  <g fill="#24384d" font-family="system-ui,sans-serif" font-size="18" text-anchor="middle">
    <text x="106" y="143">Черновик</text>
    <text x="320" y="143">Проверка</text>
    <text x="542" y="143">Публикация</text>
  </g>
</svg>`;

export const publicationDiagram = `data:image/svg+xml,${encodeURIComponent(diagram)}`;
