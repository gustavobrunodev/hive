import { describe, expect, it } from 'vitest'
import { initialsOf } from './userIdentity'

describe('avatar identity', () => {
  it.each([
    [null, null],
    ['', null],
    ['  \t\n ', null],
    ['ana', 'A'],
    ['  ana\t maria  silva  ', 'AS'],
    ['Érica Óliveira', 'ÉÓ']
  ])('derives initials for %j', (name, expected) => {
    expect(initialsOf(name)).toBe(expected)
  })
})
