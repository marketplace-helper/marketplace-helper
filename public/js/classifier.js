
(function () {
    const badges = [
        ...document.querySelectorAll(".classificacao-badge"),
    ];

    if (!badges.length) return;

    const classes = [
        "CAMPEAO",
        "POTENCIAL",
        "ALERTA",
        "PREJUIZO",
    ];

    const cores = {
        CAMPEAO: "success",
        POTENCIAL: "info",
        ALERTA: "warning",
        PREJUIZO: "danger",
    };

    function atualizarBadge(badge, classificacao) {
        badge.className = "classificacao-badge badge";

        if (!classificacao) {
            badge.classList.add("text-bg-secondary");
            badge.textContent = "Indefinido";
            return;
        }

        const classe = classificacao.classe;
        const confianca =
            classificacao.probabilidades?.[classe] ?? 0;

        const incerto = confianca < 0.45;

        badge.classList.add(
            incerto ? "text-bg-secondary" : `text-bg-${cores[classe] || "secondary"}`
        );

        badge.textContent = incerto
            ? "Indefinido"
            : `${classe} (${Math.round(confianca * 100)}%)`;

        const detalhes = classes
            .map((c) => {
                const p = classificacao.probabilidades?.[c] ?? 0;

                return `${c}: ${Math.round(p * 100)}%`;
            })
            .join(" · ");

        badge.title = `${detalhes} | Modelo ${classificacao.versao}`;
    }

    async function enviarFeedback(id, payload) {
        const response = await fetch(
            `/anuncios/${encodeURIComponent(id)}/classificacao/feedback`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            throw new Error("Falha ao enviar feedback.");
        }

        return response.json();
    }

    function criarFeedback(container, id, classificacao) {
        const wrapper = document.createElement("div");
        wrapper.className = "small mt-1";

        const pergunta = document.createElement("span");
        pergunta.textContent = "A classificação está correta? ";

        const sim = document.createElement("button");
        sim.type = "button";
        sim.className = "btn btn-link btn-sm p-0 me-2";
        sim.textContent = "Sim";

        const nao = document.createElement("button");
        nao.type = "button";
        nao.className = "btn btn-link btn-sm p-0";
        nao.textContent = "Não";

        async function enviar(payload) {
            try {
                sim.disabled = true;
                nao.disabled = true;

                await enviarFeedback(id, payload);

                wrapper.textContent = "Obrigado pelo feedback!";
            } catch {
                sim.disabled = false;
                nao.disabled = false;
                wrapper.textContent = "Erro ao enviar feedback. Tente novamente.";
            }
        }

        sim.addEventListener("click", () => {
            enviar({ concorda: true });
        });

        nao.addEventListener("click", () => {
            wrapper.replaceChildren();

            const perguntaClasse = document.createElement("span");
            perguntaClasse.textContent = "Qual é a classe correta? ";

            wrapper.appendChild(perguntaClasse);

            classes
                .filter((c) => c !== classificacao.classe)
                .forEach((classe) => {
                    const button = document.createElement("button");

                    button.type = "button";
                    button.className = "btn btn-link btn-sm p-0 me-2";
                    button.textContent = classe;

                    button.addEventListener("click", () => {
                        enviar({ concorda: false, classeCorreta: classe });
                    });

                    wrapper.appendChild(button);
                });
        });

        wrapper.append(pergunta, sim, nao);
        container.appendChild(wrapper);
    }

    async function carregarClassificacoes() {
        const ids = [
            ...new Set(badges.map((b) => Number(b.dataset.id))),
        ].filter((id) => Number.isInteger(id) && id > 0);

        if (!ids.length) return;

        badges.forEach((badge) => {
            badge.textContent = "Classificando...";
        });

        try {
            const response = await fetch(
                "/anuncios/classificacao-lote",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({ ids }),
                }
            );

            if (!response.ok) {
                throw new Error("Falha na classificação.");
            }

            const resultados = await response.json();

            badges.forEach((badge) => {
                const id = Number(badge.dataset.id);
                const classificacao = resultados[id];

                atualizarBadge(badge, classificacao);

                if (!classificacao) return;

                // O feedback aparece uma única vez por anúncio,
                // mesmo quando tabela e card estão presentes.
                const container = document.createElement("div");

                criarFeedback(container, id, classificacao);

                badge.after(container);
            });
        } catch (error) {
            console.error("[CLASSIFICADOR]", error);

            badges.forEach((badge) => {
                badge.className =
                    "classificacao-badge badge text-bg-secondary";

                badge.textContent = "Indisponível";
                badge.title = "Não foi possível carregar a classificação.";
            });
        }
    }

    carregarClassificacoes();
})();
