# Limitações conhecidas e próximos passos

[← Voltar ao README](../README.md)

- **Impostos:** o modelo é por conta, não por produto (sem NCM, ST, monofásico ou alíquota reduzida
  por SKU); o Simples não tem campo para o DAS; venda interestadual e DIFAL são % fixos. As alíquotas
  de CBS/IBS de 2027 em diante são estimativas. Detalhes em [Impostos](impostos.md#limitações-atuais).
- **Vencedor do catálogo:** o KPI "No catálogo" conta anúncios **no** catálogo; saber quem está
  **ganhando** o *buy box* exigiria uma chamada `price_to_win` por item na sincronização.
- **Medição real (câmera + balança):** `/medir` é uma **simulação** — a web não tem sensor de
  profundidade nem acesso à balança. No app móvel, basta trocar a simulação pela leitura real
  (câmera e Web Bluetooth); cálculo de frete, armazenamento por SKU e detecção de divergência já estão prontos.
- **OAuth no mobile:** o callback não confere a sessão de quem iniciou a autorização; está prevista
  uma página de confirmação.
- **Agendamento:** o *cron* depende do servidor em execução; a hospedagem precisa manter o processo ligado.
- **Escala:** sincronização e *cron* no mesmo processo da web foram pensados para **uma
  instância** e poucas dezenas de usuários. O banco já é PostgreSQL; para escalar:
  - revisar índices compostos por `userId`;
  - mover a sincronização para uma **fila de *jobs*** com *worker* separado e concorrência controlada
    (hoje o *cron* dispara o sync de todas as contas ao mesmo tempo);
  - guardar o progresso do sync e os limites de tentativa fora da memória;
  - persistir margem/lucro calculados para que filtros e ordenações rodem no banco.
