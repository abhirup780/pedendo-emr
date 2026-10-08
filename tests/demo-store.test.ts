import { createDemoStore } from '../src/lib/store.demo'
import { storeContract } from './contract'

// One store for the whole file, as one signed-in doctor would have. Each test wipes it first.
const store = createDemoStore()
storeContract('demo store', async () => ({ store }))
