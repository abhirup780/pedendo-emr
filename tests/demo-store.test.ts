import { describe, expect, it } from 'vitest'
import { createDemoStore } from '../src/lib/store.demo'
import { storeContract } from './contract'

// One store for the whole file, as one signed-in doctor would have. Each test wipes it first.
const store = createDemoStore()
storeContract('demo store', async () => ({ store }))

describe('demo store: sign-in', () => {
  it('opens without a password and has no second step', async () => {
    const s = createDemoStore()
    await s.signOut()
    expect(await s.getUser()).toBeNull()
    expect(await s.signIn('', '')).toBe('ok')
    expect(await s.getUser()).not.toBeNull()
    expect(await s.twoStep()).toEqual({ on: false, enforced: false })
    await expect(s.changePassword('anything at all')).rejects.toThrow(/demo/)
    await expect(s.startTwoStep()).rejects.toThrow(/demo/)
  })
})
