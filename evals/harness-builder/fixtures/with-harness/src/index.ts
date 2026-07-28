import { readFileSync } from 'fs'

export function loadConfig(path: string): any {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

export function priceOrder(items: any[]): number {
  let total = 0
  for (const item of items) {
    total += item.price * item.qty
  }
  return total
}
