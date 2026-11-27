
import prisma from "../../config/prisma.js";

export const CLASSES = [
  "CAMPEAO",
  "POTENCIAL",
  "ALERTA",
  "PREJUIZO",
];

export async function registrarFeedback({
  itemId,
  usuarioId,
  concorda,
  classeCorreta,
  classificacao,
  features,
}) {
  if (!classificacao || !CLASSES.includes(classificacao.classe)) {
    throw new Error("Classe prevista inválida.");
  }

  if (!classificacao.versao) {
    throw new Error("Versão do modelo não informada.");
  }

  if (typeof concorda !== "boolean") {
    throw new Error("Feedback inválido.");
  }

  if (!concorda && !CLASSES.includes(classeCorreta)) {
    throw new Error("Classe corrigida inválida.");
  }

  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      userId: usuarioId,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw new Error("Anúncio não encontrado.");
  }

  const classeFinal = concorda
    ? classificacao.classe
    : classeCorreta;

  return prisma.classificacaoFeedback.create({
    data: {
      itemId,
      usuarioId,
      versaoModelo: classificacao.versao,
      classePrevista: classificacao.classe,
      classeCorreta: classeFinal,
      concordou,
      features: JSON.stringify(features),
      probabilidades: JSON.stringify(
        classificacao.probabilidades ?? {}
      ),
    },
  });
}
