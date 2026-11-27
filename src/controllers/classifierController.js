
import prisma from "../config/prisma.js";

import {
    classificarItem,
    buscarItensParaClassificar,
} from "../services/classifier/classifierService.js";

import {
    CLASSES,
    registrarFeedback,
} from "../services/classifier/feedbackService.js";

export async function classificar(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID inválido.",
            });
        }

        const item = await prisma.item.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!item) {
            return res.status(404).json({
                error: "Anúncio não encontrado.",
            });
        }

        const { resultado, predicaoId } = await classificarItem(
            item,
            req.user.id
        );

        return res.json({
            ...resultado,
            predicaoId,
        });

        return res.json(resultado);
    } catch (error) {
        console.error("[ML CLASSIFIER]", error);

        return res.status(error.status === 503 ? 503 : 500).json({
            error: "Não foi possível classificar o anúncio.",
        });
    }
}

export async function classificarLote(req, res) {
    try {
        const ids = req.body?.ids;

        if (
            !Array.isArray(ids) ||
            ids.length === 0 ||
            ids.length > 100 ||
            !ids.every(
                (id) => Number.isInteger(Number(id)) && Number(id) > 0
            )
        ) {
            return res.status(400).json({
                error: "Envie de 1 a 100 IDs válidos.",
            });
        }

        const unicos = [...new Set(ids.map(Number))];

        const itens = await buscarItensParaClassificar(
            unicos,
            req.user.id
        );

        const porId = new Map(
            itens.map((item) => [item.id, item])
        );

        const saida = {};

        for (const id of unicos) {
            const item = porId.get(id);

            if (!item) {
                saida[id] = null;
                continue;
            }

            try {
                const { resultado, predicaoId } = await classificarItem(
                    item,
                    req.user.id
                );

                saida[id] = {
                    ...resultado,
                    predicaoId,
                };
            } catch (error) {
                if (error.status === 503) {
                    throw error;
                }

                console.error(
                    `[ML CLASSIFIER] Falha no anúncio ${id}:`,
                    error
                );

                saida[id] = null;
            }
        }

        return res.json(saida);
    } catch (error) {
        console.error("[ML CLASSIFIER]", error);

        return res.status(error.status === 503 ? 503 : 500).json({
            error: "Falha ao classificar anúncios.",
        });
    }
}

export async function enviarFeedback(req, res) {
    try {
        const id = Number(req.params.id);

        const { concorda, classeCorreta } = req.body || {};

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID inválido.",
            });
        }

        if (typeof concorda !== "boolean") {
            return res.status(400).json({
                error: "Informe se concorda com a classificação.",
            });
        }

        if (!concorda && !CLASSES.includes(classeCorreta)) {
            return res.status(400).json({
                error: "Classe correta inválida.",
            });
        }

        const item = await prisma.item.findFirst({
            where: {
                id,
                userId: req.user.id,
            },
        });

        if (!item) {
            return res.status(404).json({
                error: "Anúncio não encontrado.",
            });
        }

        // A previsão é produzida novamente no servidor.
        // Nenhuma classe prevista enviada pelo navegador é aceita.
        const { resultado, features } = await classificarItem(
            item,
            req.user.id
        );

        await registrarFeedback({
            itemId: item.id,
            usuarioId: req.user.id,
            concorda,
            classeCorreta,
            classificacao: resultado,
            features,
        });

        return res.json({
            ok: true,
            classeRegistrada: concorda
                ? resultado.classe
                : classeCorreta,
        });
    } catch (error) {
        console.error("[ML FEEDBACK]", error);

        return res.status(error.status === 503 ? 503 : 500).json({
            error: "Não foi possível registrar o feedback.",
        });
    }
}
