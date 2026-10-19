# Rubricas de Doação (Recebimento → Doações)

Lista completa e única de "Tipo Doação" disponível na tela Recebimento →
Doações do Mercúrio (confirmada ao vivo em 14/09/2026, filial Barra do
Garças — mas é um catálogo do sistema, não muda por filial). Use o `id`
como `acao.rubricaId` nas regras do tipo `recebimento_doacao`.

| id | Nome |
|------|------|
| 338 | DOAÇÃO CRIANÇA PARA O BEM AVULSO |
| 333 | DOAÇÃO DE MEMBRO/PROVACIONISTA |
| 3064 | DOAÇÃO IPEARTE |
| 3333 | DOAÇÃO PARA COMPRA DE TERRENO-NACIONAL |
| 340 | DOAÇÃO PARA FAZENDA |
| 431 | DOAÇÃO TERRENO SEDE |

**Atenção:** o Mercúrio avisa que doações para "CRIANÇA PARA O BEM",
"FAZENDA" e "TERRENO SEDE" precisam ser repassadas para a SN Economia —
não são recursos que ficam na filial.

**Nota sobre "DOAÇÃO DE TERCEIROS":** ao auditar agosto/2026, encontrei um
lançamento real no caixa BANCO CONTA CORRENTE com a descrição "DOAÇÃO DE
TERCEIROS" (uma transferência entre filiais da Nova Acrópole) — mas essa
rubrica **não aparece** nesta lista de 6 opções, nem no catálogo "Avulsos"
que consultei. Não descobri por qual tela ela foi lançada (pode ser um
catálogo de outra aba tipo "Inscrições"/"Produtos", ou um acesso que meu
login de teste não tem). Se você receber transferências de outras filiais
e quiser automatizar isso, vale investigar essa tela específica antes —
por enquanto, o script sempre trata "sem regra correspondente" como algo
pra você lançar manualmente.
