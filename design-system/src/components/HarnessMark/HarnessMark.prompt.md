HarnessMark from @hive/design-system. Use via `window.Hive.HarnessMark` (bundle loaded from the root `_ds_bundle.js`).

Marca do produto **Harness Builder** (iniciativa HIVE), direção "colmeia afiada":
herda o hexágono da marca-mãe HIVE, com o núcleo em foco (o agente sob controle /
o harness firme) e as células que se dispersam ao topo (a evolução contínua do
harness). Coral conduz o traço, verde marca o núcleo. Cores 100% da paleta HIVE.

## Props

```ts
interface HarnessMarkProps {
  variant?: 'symbol' | 'horizontal' | 'stacked' | 'wordmark' | 'icon'; // default 'symbol'
  tone?: 'color' | 'mono';   // default 'color'
  color?: string;            // cor da versão mono (default currentColor)
  size?: number;             // px do símbolo; escala o lockup
  background?: string;       // fundo do tile no variant 'icon' (default var(--bordo-2))
  endorsement?: boolean;     // "Uma skill · HIVE" (default true)
  className?: string;
}
```

## Examples

### Horizontal

```jsx
() => <HarnessMark variant="horizontal" size={44} />
```

### Simbolo

```jsx
() => <HarnessMark variant="symbol" size={56} />
```

### IconeDeApp

```jsx
() => <HarnessMark variant="icon" size={96} background="var(--bordo-sensatez)" />
```

### Negativa

```jsx
() => (
  <span style={{ background: "var(--coral)", padding: 20, display: "inline-flex" }}>
    <HarnessMark variant="stacked" size={56} tone="mono" color="#260a12" />
  </span>
)
```
