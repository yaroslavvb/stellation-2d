function hsbColor(hue: number, saturation: number, value: number) {
  const sector = Math.floor(hue * 6);
  const fraction = hue * 6 - sector;
  const low = value * (1 - saturation);
  const falling = value * (1 - fraction * saturation);
  const rising = value * (1 - (1 - fraction) * saturation);
  let red: number;
  let green: number;
  let blue: number;

  switch (sector % 6) {
    case 0: [red, green, blue] = [value, rising, low]; break;
    case 1: [red, green, blue] = [falling, value, low]; break;
    case 2: [red, green, blue] = [low, value, rising]; break;
    case 3: [red, green, blue] = [low, falling, value]; break;
    case 4: [red, green, blue] = [rising, low, value]; break;
    default: [red, green, blue] = [value, low, falling];
  }

  return `rgb(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)})`;
}

export function buildOrbitCardinalityPalette(counts: Iterable<number>) {
  const sorted = [...new Set(counts)]
    .filter((count) => Number.isSafeInteger(count) && count > 0)
    .sort((a, b) => a - b);
  const palette = new Map<number, string>();

  sorted.forEach((count, index) => {
    const position = sorted.length > 1 ? index / (sorted.length - 1) : 0;
    palette.set(count, hsbColor((0.02 + 0.86 * position) % 1, 0.72, 0.86));
  });
  return palette;
}
