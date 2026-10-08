import type { RefSex, Sex } from './types'

/** How the sex reads on screen. 'U' is a child whose sex has not been assigned yet. */
export function sexLabel(sex: Sex): string {
  return sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : 'Sex not yet assigned'
}

/** The sex to use for sex-specific references (growth, puberty timing); null when not assigned. */
export function refSex(sex: Sex): RefSex | null {
  return sex === 'U' ? null : sex
}
