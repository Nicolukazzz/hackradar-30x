import { Button } from "@/components/ui/button";

// Botón del prototipo (§13 "Comunes"): siempre ≥ 44 px de alto (size "tactil"), radio 10 px.
// primaria = tinta (acción principal) · secundaria = borde · acento = verde de marca · peligro = rechazar.
// Las variantes viven en buttonVariants (src/components/ui/button.tsx).

const VARIANTES = { primaria: "primaria", secundaria: "secundaria", acento: "acento", peligro: "peligro", fantasma: "ghost" } as const;

export type VarianteBoton = keyof typeof VARIANTES;

export function Boton({
  variante = "secundaria",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant" | "size"> & { variante?: VarianteBoton }) {
  return <Button variant={VARIANTES[variante]} size="tactil" {...props} />;
}
