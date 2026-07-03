import { describe, expect, it } from "vitest"
import { cx } from "./cx"

describe("cx", () => {
  it("joins truthy strings with a space", () => {
    expect(cx("a", "b", "c")).toBe("a b c")
  })

  it("drops falsy values (false, null, undefined, empty string)", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b")
  })

  it("returns an empty string for empty input", () => {
    expect(cx()).toBe("")
  })
})
