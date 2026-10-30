import type { Member, School } from "@prisma/client";

/**
 * Termo oficial de Adesão ao Serviço Voluntário da Nova Acrópole
 * (Termo_Voluntario_V220219.pdf, enviado pelo usuário 2026-10-18).
 * Desde 30/10/2026 só para leitura: o termo vale assinado no gov.br ou em
 * papel com 2 testemunhas, com a filial (Instituto Maat). A assinatura pelo
 * Portal saiu; os registros antigos ficam em VolunteerTermSignature.
 */

function formatarCnpj(cnpj: string | null) {
  const d = (cnpj ?? "").replace(/\D/g, "");
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj || "—";
}

export function nomeDaOrganizacao(school: Pick<School, "name">) {
  return `ORGANIZAÇÃO NOVA ACRÓPOLE ${school.name.replace(/^Nova Acrópole\s*-\s*/i, "").toUpperCase()}`;
}

type DadosTermo = Pick<
  Member,
  "name" | "estadoCivil" | "profession" | "rgNumero" | "addressStreet" | "addressNumber" | "addressComplement" | "addressNeighborhood" | "addressCity" | "addressState" | "addressZip" | "whatsapp" | "email"
>;

/** Texto do termo preenchido com os dados do cadastro. CPF entra só no momento da assinatura (não fica guardado no cadastro). */
export function montarTermo(m: DadosTermo, school: Pick<School, "name" | "cnpj">, cpfMascarado: string | null) {
  const v = (s: string | null | undefined) => (s && s.trim() ? s.trim() : "—");
  const endereco = [m.addressStreet, m.addressNumber, m.addressComplement, m.addressNeighborhood].filter((p) => p && p.trim()).join(", ");
  const cep = m.addressZip ? m.addressZip.replace(/^(\d{5})(\d{3})$/, "$1-$2") : null;
  return `TERMO DE ADESÃO AO SERVIÇO VOLUNTÁRIO

NOME: ${v(m.name)}
ESTADO CIVIL: ${v(m.estadoCivil)}    PROFISSÃO: ${v(m.profession)}
IDENTIDADE: ${v(m.rgNumero)}    CPF: ${v(cpfMascarado)}
ENDEREÇO: ${v(endereco)}
CIDADE/UF: ${v([m.addressCity, m.addressState].filter(Boolean).join("/"))}    CEP: ${v(cep)}    TELEFONE: ${v(m.whatsapp)}
E-MAIL: ${v(m.email)}

Pelo presente termo de adesão, estabelecido em obediência ao art. 2º da Lei nº 9.608/98, o doravante chamado VOLUNTÁRIO, propõe-se a prestar serviços voluntários em favor da ${nomeDaOrganizacao(school)}, pessoa jurídica sem fins lucrativos, inscrita no CNPJ sob o nº ${formatarCnpj(school.cnpj)}.

1. O presente termo tem por objeto regular a prestação de serviços em todas as áreas de atuação da instituição, em conformidade com seu estatuto, em sua sede ou nos locais onde realizar suas atividades, permanentes ou esporádicas;

2. Os serviços serão prestados em horários estabelecidos em comum acordo entre as partes, sem controle de frequência e por prazo indeterminado, ficando as partes dispensadas de qualquer pré-aviso formal que implique qualquer espécie de indenização em caso de descontinuidade dos serviços prestados.

3. Caso o voluntário deixe de participar das atividades da organização, ele será automaticamente excluído da lista de voluntários da instituição, sem necessidade de comunicação ao Voluntário por qualquer meio de comunicação.

4. Em caso de necessidade de atualização de dados, ou o voluntário retorne a participar da Instituição, um novo termo poderá ser assinado, sem que isso signifique a invalidação do termo anteriormente assinado. Neste caso, o novo termo assinado servirá também como confirmação do anterior e aceitação das regras antes firmadas e as novas regras vigentes ao tempo da assinatura.

5. O Voluntário declara e concorda que os serviços serão prestados independentemente de remuneração, respeitadas a qualificação, a aptidão e a necessidade do serviço, a serem aferidas exclusivamente pela parte beneficiária dos serviços.

6. O Voluntário declara que todas as informações e dados a que tiver acesso, a partir do banco de dados da Nova Acrópole, serão utilizados exclusivamente para as suas atividades voluntárias, sendo PROIBIDA qualquer divulgação ou uso para interesse particular ou qualquer outro uso diverso, sob as penas da Lei, em especial da Lei Geral de Proteção de Dados.

7. Poderá ocorrer ressarcimento pelas despesas que comprovadamente o voluntário realizar no desempenho das atividades voluntárias, desde que autorizadas prévia e expressamente, por escrito, pelo responsável pela Instituição no local da prestação dos serviços, e nos valores dentro dos limites da autorização e mediante prestação de contas.

8. Fica estabelecido, desde logo, que o presente termo não gera para a parte aderente vínculo empregatício nem funcional ou quaisquer obrigações de caráter trabalhista, previdenciário ou afim, bem como qualquer direito a indenização, conforme preceitua o parágrafo único do art. 1º, da Lei nº 9.608/98.

Orientações gerais: um novo termo deve ser assinado caso o voluntário mude de unidade; refazer o termo a cada 5 anos, guardando os anteriores.`;
}
