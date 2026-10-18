import type { Repositorio } from "@/repositorio/repositorio";

/** Proveedor creado en la app con límite mensual (en la moneda base actual). */
export async function guardarProveedorParaTest(repo: Repositorio, limite_mensual_usd: number): Promise<void> {
  await repo.guardarBeneficiario({
    id: "ben-proveedor-prueba",
    nombre: "Proveedor Prueba",
    pais: "CO",
    categoria: "general",
    tipo: "proveedor",
    cuenta: { tipo: "cuenta", banco: "Banco Cafetal", numero_enmascarado: "•••• 1111", ultimos4: "1111" },
    acuerdo: null,
    limite_mensual_usd,
    estado: "activo",
    canales: { correos: [], telegram_chat_id: null, portal_usuario: null },
  });
}
