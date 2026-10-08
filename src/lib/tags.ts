/** Tag colours from the design: soft background, dark text (contrast above 4.5:1). */
export const TAG_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  teal: { bg: '#DDEFEE', fg: '#0A4F57', label: 'Teal' },
  orange: { bg: '#FBE6D4', fg: '#8A3C06', label: 'Orange' },
  blue: { bg: '#DDE8F8', fg: '#1D4587', label: 'Blue' },
  green: { bg: '#E0F0DF', fg: '#22602A', label: 'Green' },
  purple: { bg: '#E9E3F6', fg: '#4A2E8A', label: 'Purple' },
  olive: { bg: '#ECEDE2', fg: '#4C5230', label: 'Olive' },
  pink: { bg: '#F8E0EC', fg: '#8A1F55', label: 'Pink' },
  sand: { bg: '#F3EBCF', fg: '#6B5207', label: 'Sand' },
  grey: { bg: '#ECEFEE', fg: '#44545B', label: 'Grey' },
}

export function tagColor(key: string) {
  return TAG_COLORS[key] ?? TAG_COLORS.grey
}

/** Offered on first use; the doctor can rename, recolour, add or delete. */
export const STARTER_CONDITIONS: { name: string; color: string }[] = [
  { name: 'GH deficiency', color: 'teal' },
  { name: 'Short stature', color: 'sand' },
  { name: 'Type 1 diabetes', color: 'orange' },
  { name: 'Hypothyroidism', color: 'blue' },
  { name: 'Turner syndrome', color: 'green' },
  { name: 'CAH', color: 'purple' },
  { name: 'Obesity', color: 'olive' },
  { name: 'Precocious puberty', color: 'pink' },
  { name: 'Delayed puberty', color: 'grey' },
  { name: 'Rickets', color: 'sand' },
]
