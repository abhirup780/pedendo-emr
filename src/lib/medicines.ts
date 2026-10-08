import type { RxItem } from './types'

/**
 * Offered once from Settings to seed the doctor's own medicine list. Defaults are starting
 * points only: every field stays editable on each prescription, and weight-based doses
 * are deliberately left blank.
 */
export const STARTER_MEDICINES: RxItem[] = [
  { name: 'Somatropin (recombinant GH) 5 mg cartridge', dose: '', frequency: 'Once daily at bedtime', route: 'Subcutaneous', duration: 'Continue', instructions: 'Rotate injection sites.' },
  { name: 'Levothyroxine 25 mcg tablet', dose: '', frequency: 'Once daily, empty stomach', route: 'Oral', duration: 'Continue', instructions: '30 minutes before breakfast.' },
  { name: 'Hydrocortisone 5 mg tablet', dose: '', frequency: 'Three times daily', route: 'Oral', duration: 'Continue', instructions: '' },
  { name: 'Insulin glargine 100 U/mL', dose: '', frequency: 'Once daily at bedtime', route: 'Subcutaneous', duration: 'Continue', instructions: '' },
  { name: 'Insulin aspart 100 U/mL', dose: '', frequency: 'Before meals', route: 'Subcutaneous', duration: 'Continue', instructions: '' },
  { name: 'Metformin 500 mg tablet', dose: '', frequency: 'Twice daily', route: 'Oral', duration: '3 months', instructions: 'After meals.' },
  { name: 'Leuprolide depot 3.75 mg injection', dose: '', frequency: 'Every 4 weeks', route: 'Intramuscular', duration: 'Continue', instructions: '' },
  { name: 'Cholecalciferol 60,000 IU sachet', dose: '1 sachet', frequency: 'Once weekly', route: 'Oral', duration: '8 weeks', instructions: 'After food, with milk.' },
  { name: 'Calcium carbonate 500 mg tablet', dose: '', frequency: 'Once daily', route: 'Oral', duration: '3 months', instructions: 'After food.' },
]
