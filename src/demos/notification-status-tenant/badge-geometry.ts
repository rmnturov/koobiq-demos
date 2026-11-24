export interface BadgeGeometry {
  statusSize: number;
  tenantSize: number;
  offset: number;
  gap: number;
  statusRadius: number;
  tenantRadius: number;
}

export const DEFAULT_GEOMETRY: BadgeGeometry = {
  statusSize: 32,
  tenantSize: 14,
  offset: 4,
  gap: 2,
  statusRadius: 8,
  tenantRadius: 4,
};

export const GEOMETRY_CONTROLS = [
  {
    key: 'statusSize',
    label: 'Размер статуса',
    variable: '--notification-status-size',
    min: 24,
  },
  {
    key: 'tenantSize',
    label: 'Размер тенанта',
    variable: '--notification-tenant-size',
    min: 12,
  },
  {
    key: 'offset',
    label: 'Вынос тенанта',
    variable: '--notification-tenant-offset',
    min: 0,
  },
  { key: 'gap', label: 'Толщина зазора', variable: '--notification-mask-gap', min: 0 },
  {
    key: 'statusRadius',
    label: 'Радиус статуса',
    variable: '--notification-status-radius',
    min: 0,
  },
  {
    key: 'tenantRadius',
    label: 'Радиус тенанта',
    variable: '--notification-tenant-radius',
    min: 0,
  },
] as const;

// Match core/styles/common/_squircle.scss, the mixin used by Koobiq Button.
function compensatedRadius(radius: number): number {
  return Math.max(radius * 1.85, Math.min(radius * 2, radius * 2.3 - 3.6));
}

function radiusLimit(size: number, squircle: boolean): number {
  if (!squircle) return Math.ceil(size / 2);
  let radius = 0;
  while (compensatedRadius(radius) < size / 2) radius++;
  return radius;
}

export function geometryControlMax(
  key: keyof BadgeGeometry,
  geometry: BadgeGeometry,
  squircle = false,
): number {
  switch (key) {
    case 'statusSize':
      return 80;
    case 'tenantSize':
      return Math.min(48, geometry.statusSize);
    case 'offset':
      return geometry.tenantSize;
    case 'gap':
      return 12;
    case 'statusRadius':
      return radiusLimit(geometry.statusSize, squircle);
    case 'tenantRadius':
      return radiusLimit(geometry.tenantSize, squircle);
  }
}

export function updateBadgeGeometry(
  geometry: BadgeGeometry,
  key: keyof BadgeGeometry,
  value: number,
  squircle = false,
): BadgeGeometry {
  const next = { ...geometry, [key]: value };
  for (const control of GEOMETRY_CONTROLS) {
    next[control.key] = Math.max(
      control.min,
      Math.min(geometryControlMax(control.key, next, squircle), next[control.key]),
    );
  }
  return next;
}

function tenantPath(size: number, baseRadius: number, squircle: boolean): string {
  const scaled = squircle ? compensatedRadius(baseRadius) : baseRadius;
  const radius = Math.min(size / 2, scaled);
  if (radius === 0) return `M0 0H${size}V${size}H0Z`;

  // corner-shape: squircle is superellipse(2), with exponent 4.
  const power = squircle ? 0.5 : 1;
  const centers = [
    [size - radius, radius],
    [size - radius, size - radius],
    [radius, size - radius],
    [radius, radius],
  ];
  const points = centers.flatMap(([cx, cy], corner) =>
    Array.from({ length: 33 }, (_, step) => {
      const angle = ((corner - 1) * Math.PI) / 2 + (step * Math.PI) / 64;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = cx + radius * Math.sign(cos) * Math.abs(cos) ** power;
      const y = cy + radius * Math.sign(sin) * Math.abs(sin) ** power;
      return `${x.toFixed(3)} ${y.toFixed(3)}`;
    }),
  );
  return `M${points.join('L')}Z`;
}

export function badgeGeometryStyles(
  geometry: BadgeGeometry,
  squircle: boolean,
): Record<string, string> {
  const { statusSize, tenantSize, offset, gap, tenantRadius } = geometry;
  const start = statusSize - tenantSize + offset;
  const path = tenantPath(tenantSize, tenantRadius, squircle);
  // Stroke expands the tenant silhouette by the gap, preserving an even transparent border.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${statusSize} ${statusSize}"><mask id="cutout" maskUnits="userSpaceOnUse" x="0" y="0" width="${statusSize}" height="${statusSize}"><rect width="${statusSize}" height="${statusSize}" fill="white"/><path d="${path}" transform="translate(${start} ${start})" fill="black" stroke="black" stroke-width="${gap * 2}" stroke-linejoin="round"/></mask><rect width="${statusSize}" height="${statusSize}" fill="white" mask="url(#cutout)"/></svg>`;
  return {
    ...Object.fromEntries(
      GEOMETRY_CONTROLS.map((control) => [control.variable, `${geometry[control.key]}px`]),
    ),
    '--notification-status-mask': `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
  };
}
