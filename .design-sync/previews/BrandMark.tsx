import { BrandMark } from "@hive/design-system";

export const Default = () => <BrandMark />;

export const AlternateLetter = () => (
  <div style={{ display: "flex", gap: "12px" }}>
    <BrandMark letter="Z" />
    <BrandMark letter="H" />
    <BrandMark letter="A" />
  </div>
);
