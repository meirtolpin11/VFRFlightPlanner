export const LEG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#F97316', // orange
  '#EC4899', // pink
]

export function nextLegColor(existingColors: string[]): string {
  for (const color of LEG_COLORS) {
    if (!existingColors.includes(color)) return color
  }
  return LEG_COLORS[existingColors.length % LEG_COLORS.length]
}
