import { FIELDS, FIELD_LABEL, type FieldState } from "../lib/data";

/** One cell per Dublin Core field, like the holes on a catalogue punch card. */
export default function Strip({ fields, size = "md" }: { fields: Record<string, FieldState>; size?: "md" | "lg" }) {
  const label = FIELDS.map((f) => `${FIELD_LABEL[f]}: ${fields[f]}`).join(", ");
  return (
    <span className={`strip strip-${size}`} role="img" aria-label={label} title={label}>
      {FIELDS.map((f) => <i key={f} className={`cell ${fields[f]}`} />)}
    </span>
  );
}
