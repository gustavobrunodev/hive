import { expect, it } from 'vitest'
import { priceOrder } from './index'

it('prices an order', () => {
  expect(priceOrder([{ price: 2, qty: 3 }])).toBe(6)
})
