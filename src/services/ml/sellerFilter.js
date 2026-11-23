// Mantém apenas os anúncios que pertencem ao vendedor conectado. O webhook do ML é público,
// então um MLB de outro vendedor nunca pode ser salvo como anúncio do usuário.
export function filtrarItensDoVendedor(details, mlUserId) {
  const dono = String(mlUserId);
  const out = [];
  for (const d of details || []) {
    if (d && String(d.seller_id) === dono) out.push(d);
    else console.warn(`[SYNC] anúncio ${d?.id} ignorado: não pertence ao vendedor conectado.`);
  }
  return out;
}
