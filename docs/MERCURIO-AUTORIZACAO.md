# Mercúrio: tela "Autorização" do Diretor (mapeada em 09/11/2026, só leitura)

Caminho: menu DIRETOR da filial → **Autorização** (`/diretor/dir_uniace1.php`). Lista quem tem login no Mercúrio da
filial, a situação da senha ("EXPIRADA" quando vencida) e uma coluna por módulo. Não há formulário: cada célula é um
link GET.

| Ícone | Link | Efeito |
|---|---|---|
| `chk.png` (tem acesso) | `dir_uniace1.php?x=<MÓDULO>&m=<matrícula>` | **retira** o acesso |
| `stop.png` (sem acesso) | `dir_uniace1.php?i=<MÓDULO>&m=<matrícula>` | **dá** o acesso |
| `key.png` | `dir_uniace1.php?s=<matrícula>` | senha da pessoa (não usar) |
| "Incluir Novo Usuário" | (link no topo) | cria login no Mercúrio |

Códigos dos módulos (ordem das colunas):

| Código | Módulo | Área equivalente no Portal (proposta) |
|---|---|---|
| UBIB | Biblioteca | Secretaria Biblioteca e Livraria |
| UCAD | Cadastro | Escolástica |
| PDIA | Diário de Classe | Instrutor (Minhas turmas) |
| UDIR | Diretor | Direção (a decidir: dá tudo) |
| UEVT | Eventos | Eventos |
| UINT | Integração | Secretaria Integração |
| UPAT | Patrimônio | Secretaria **Patrimônio** (inventário; não é manutenção — decisão do usuário 09/11) |
| UREC | Recepção | Secretaria **Recepção e Portaria** (a recepção vai além dos eventos — decisão do usuário 09/11) |
| URFV | Relatório FFVV | Grupos de FV (relatórios) |
| UREL | Relatório Mensal | **Relatório Mensal** (mantém o nome e a função própria — decisão do usuário 09/11) |
| UTES | Tesouraria | Economia |

Cuidados: clicar num link já grava (não há confirmação na tela); o robô só enxerga as filiais em que o usuário dele
tem DIRETOR (em 09/11/2026, uma entrada só). Nada foi alterado no mapeamento.
