import React from "react";
import { Logo } from "@hive/design-system";

const lg = <style>{`.hds-logo svg { height: 5rem }`}</style>;

export function ColorSimple() {
  return (
    <div style={{ background: "#fff", padding: "var(--s-5)" }}>
      {lg}
      <Logo tone="color" mark="simple" />
    </div>
  );
}

export function ColorFull() {
  return (
    <div style={{ background: "#fff", padding: "var(--s-5)" }}>
      {lg}
      <Logo tone="color" mark="full" />
    </div>
  );
}

export function ColorDescription() {
  return (
    <div style={{ background: "#fff", padding: "var(--s-5)" }}>
      {lg}
      <Logo tone="color" mark="description" />
    </div>
  );
}

export function ColorBrain() {
  return (
    <div style={{ background: "#fff", padding: "var(--s-5)" }}>
      {lg}
      <Logo tone="color" mark="brain" />
    </div>
  );
}

export function BlackSimple() {
  return (
    <div style={{ background: "#fff", padding: "var(--s-5)" }}>
      {lg}
      <Logo tone="black" mark="simple" />
    </div>
  );
}

export function WhiteSimple() {
  return (
    <div style={{ background: "var(--bordo)", padding: "var(--s-5)" }}>
      {lg}
      <Logo tone="white" mark="simple" />
    </div>
  );
}
