/**
 * Drug allergies are one text box on the patient. Three things have to be told apart: an
 * allergy is written down, the family was asked and there is none, or nobody has asked yet.
 * A blank box is "not recorded"; "none known" is stored as the sentence below.
 */
export const NO_KNOWN_ALLERGY = 'No known drug allergy'

export type AllergyStatus = 'some' | 'none' | 'unrecorded'

// What a doctor types by hand to mean the same thing.
const NONE_KNOWN = /^(no|nil|none|nka|nkda|none known|no known (drug )?allerg(y|ies))$/
// Not an answer either way: it counts as not recorded, and is never printed as an allergy.
const NOT_KNOWN = /^(-+|\?+|na|n\/a|unknown|not known|not asked|not recorded)$/

export function allergyStatus(text: string): AllergyStatus {
  const t = text.trim().toLowerCase().replace(/[.\s]+$/, '').replace(/\s+/g, ' ')
  if (!t || NOT_KNOWN.test(t)) return 'unrecorded'
  return NONE_KNOWN.test(t) ? 'none' : 'some'
}
