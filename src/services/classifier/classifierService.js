
import { buildFeatures } from "./features.js";
import { getBusinessRules } from "../rulesService.js";
import prisma from "../../config/prisma.js";
import ml from "./modelLoader.js";

export async function classificarItem(
  item,
  userId,
  rules = null
) {
  // Recupera as regras comerciais do usuário.
  const businessRules =
    rules ?? await getBusinessRules(userId);

  // Constrói as features utilizadas pelo modelo.
  const features = buildFeatures(item, businessRules);

  // Executa a classificação ONNX.
  const resultado = await ml.classify(features);

  // Registra a previsão original no banco.
  const predicao = await prisma.classificacaoPredicao.create({
    data: {
      itemId: item.id,
      usuarioId: userId,
      versaoModelo: resultado.versao,
      classePrevista: resultado.classe,
      probabilidades: JSON.stringify(
        resultado.probabilidades
      ),
      features: JSON.stringify(features),
    },
  });

  return {
    resultado,
    features,
    predicaoId: predicao.id,
  };
}

export async function buscarItensParaClassificar(ids, userId) {
  return prisma.item.findMany({
    where: {
      id: {
        in: ids,
      },
      userId,
    },
  });
}
