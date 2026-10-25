/**
 * Frases das telas de TV (pedidos do usuário 2026-10-24/25). Cada filial tem a própria
 * lista (tabela FraseTela, editada na aba Telas); filial sem frase ativa usa esta lista padrão,
 * que também pode ser importada para a filial e editada lá. A TV mostra a próxima a cada volta.
 *
 * Só frases conferidas palavra por palavra na fonte indicada em `fonte` (pesquisas de 25/10/2026).
 * Autores do programa de estudos e demais autores: a frase está num site oficial da Nova Acrópole
 * (acropole.org.br, nova-acropole.pt, biblioteca.acropolis.org, library.acropolis.org,
 * revistaesfinge.com, nueva-acropolis.es, revue-acropolis.fr) e também no texto original do autor.
 * Pessoa, Cora, Manoel, Gibran, Rumi, Sri Ram e Blavatsky: arquivopessoa.net, ts-adyar.org,
 * theosociety.org, Gutenberg, archive.org e trabalhos acadêmicos que citam livro e página.
 * Traduções de espanhol/inglês/francês sem versão oficial em português são nossas, fiéis à página.
 * Fora, a pedido do usuário: Nietzsche, Schopenhauer e afins. Muitas frases que circulam com o
 * nome de Rumi, Cora Coralina e Manoel de Barros são falsas: não incluir sem fonte.
 */
export type FraseDaTela = { texto: string; autor: string; obra: string | null };
type FraseComFonte = FraseDaTela & { fonte: string };

const BIBLIOTECA_NA = "https://biblioteca.acropolis.org";
const ACROPOLE_BR = "https://acropole.org.br";
const VOZ_DO_SILENCIO = "https://www.theosociety.org/pasadena/voice";
const PROFETA = "https://www.gutenberg.org/ebooks/58585";
const MASNAVI = "https://archive.org/details/masnaviimanavisp00jala_0";

const GRUPOS: FraseComFonte[][] = [
  [
    { texto: "Em um mundo que avança, o que não caminha, retrocede.", autor: "Jorge Ángel Livraga", obra: null, fonte: `${ACROPOLE_BR}/artigos/filosofia/a-aceleracao-dos-tempos/` },
    { texto: "O Ser Humano é arquiteto do seu próprio destino.", autor: "Jorge Ángel Livraga", obra: null, fonte: `${ACROPOLE_BR}/newsletter/228-a-construcao-de-nos-mesmos/` },
    { texto: "Todos nós podemos fazer algo para tornar o mundo melhor.", autor: "Jorge Ángel Livraga", obra: null, fonte: `${ACROPOLE_BR}/artigos/filosofia/quem-foi-jorge-angel-livraga-rizzi/` },
    { texto: "Ninguém pode sustentar um capitel sem ter uma coluna embaixo.", autor: "Jorge Ángel Livraga", obra: "Como ser um idealista", fonte: `${BIBLIOTECA_NA}/como-ser-un-idealista/` },
    { texto: "As emoções não se combatem com ideias, as emoções se combatem com emoções.", autor: "Jorge Ángel Livraga", obra: "Como ser um idealista", fonte: `${BIBLIOTECA_NA}/como-ser-un-idealista/` },
    { texto: "Todos, desde crianças, somos “philo-sophos”, isto é, enamorados da verdade, enamorados da realidade.", autor: "Jorge Ángel Livraga", obra: "O homem diante do mistério da vida e da morte", fonte: `${BIBLIOTECA_NA}/el-hombre-frente-al-misterio-de-la-vida-y-la-muerte/` },
    { texto: "Os ideais do corpo são “número”; os ideais da alma são “qualidade”.", autor: "Jorge Ángel Livraga", obra: "Os ideais do corpo e da alma", fonte: `${BIBLIOTECA_NA}/los-ideales-del-cuerpo-y-del-alma/` },
    { texto: "Todo ser humano tem direito a um pedaço de pão, mas também todos temos direito a um pedaço de glória.", autor: "Jorge Ángel Livraga", obra: null, fonte: `${BIBLIOTECA_NA}/el-sentido-heroico-de-la-vida/` },
  ],
  [
    { texto: "Valeu a pena? Tudo vale a pena / Se a alma não é pequena.", autor: "Fernando Pessoa", obra: "Mensagem, “Mar Português”", fonte: "http://arquivopessoa.net/textos/2405" },
    { texto: "Deus quer, o homem sonha, a obra nasce.", autor: "Fernando Pessoa", obra: "Mensagem, “O Infante”", fonte: "http://arquivopessoa.net/textos/2375" },
    { texto: "Para ser grande, sê inteiro: nada / Teu exagera ou exclui. / Sê todo em cada coisa. Põe quanto és / No mínimo que fazes.", autor: "Fernando Pessoa", obra: "Ricardo Reis, Odes", fonte: "http://arquivopessoa.net/textos/503" },
    { texto: "Porque eu sou do tamanho do que vejo / E não do tamanho da minha altura...", autor: "Fernando Pessoa", obra: "Alberto Caeiro, O Guardador de Rebanhos", fonte: "http://arquivopessoa.net/textos/1486" },
    { texto: "Não sou nada. / Nunca serei nada. / Não posso querer ser nada. / À parte isso, tenho em mim todos os sonhos do mundo.", autor: "Fernando Pessoa", obra: "Álvaro de Campos, Tabacaria", fonte: "http://arquivopessoa.net/textos/163" },
    { texto: "A vida é o que fazemos dela. As viagens são os viajantes. O que vemos, não é o que vemos, senão o que somos.", autor: "Fernando Pessoa", obra: "Bernardo Soares, Livro do Desassossego", fonte: "http://arquivopessoa.net/textos/4445" },
  ],
  [
    { texto: "A Filosofia se fundamenta no Amor, precisamente porque essa é a raiz da palavra Filosofia: é Amor pela Sabedoria, e quem busca a Sabedoria aprende a amar tudo e a todos.", autor: "Delia Steinberg Guzmán", obra: null, fonte: `${ACROPOLE_BR}/artigos/entrevista-com-delia-steinberg-presidente-de-honra-da-nova-acropole/` },
    { texto: "Só os vaidosos têm certeza de saber tudo.", autor: "Delia Steinberg Guzmán", obra: null, fonte: `${ACROPOLE_BR}/artigos/entrevista-com-delia-steinberg-presidente-de-honra-da-nova-acropole/` },
    { texto: "Sinto-me como alguém que recebeu uma tocha acesa e precisa mantê-la viva para transmiti-la adiante, com a mesma luz, o mesmo calor, a mesma inspiração.", autor: "Delia Steinberg Guzmán", obra: null, fonte: `${ACROPOLE_BR}/artigos/entrevista-com-delia-steinberg-presidente-de-honra-da-nova-acropole/` },
    { texto: "A paciência é indício de trabalho continuado, de trabalho com sabor de eternidade, de trabalho banhado em fé.", autor: "Delia Steinberg Guzmán", obra: "A paciência é uma forma de fé", fonte: `${BIBLIOTECA_NA}/la-paciencia-es-una-forma-de-fe/` },
    { texto: "Não há nada definitivamente perdido, nem há nada que venha a nós sem que nós tenhamos posto nosso grão de vontade para realizá-lo.", autor: "Delia Steinberg Guzmán", obra: "Pessimismo e otimismo", fonte: `${BIBLIOTECA_NA}/pesimismo-y-optimismo/` },
    { texto: "O futuro chegará, sim, das mãos do tempo e das nossas próprias, e o fará com a mesma fortaleza com que tivermos saído em sua busca.", autor: "Delia Steinberg Guzmán", obra: "Pessimismo e otimismo", fonte: `${BIBLIOTECA_NA}/pesimismo-y-optimismo/` },
    { texto: "O que é bom é digno de ser levado em conta para repeti-lo; o que é mau deve mobilizar nossas energias para superá-lo.", autor: "Delia Steinberg Guzmán", obra: "Pessimismo e otimismo", fonte: `${BIBLIOTECA_NA}/pesimismo-y-optimismo/` },
  ],
  [
    { texto: "O trabalho é o amor tornado visível.", autor: "Khalil Gibran", obra: "O Profeta", fonte: PROFETA },
    { texto: "Vocês dão pouco quando dão de seus bens. É quando dão de si mesmos que verdadeiramente dão.", autor: "Khalil Gibran", obra: "O Profeta", fonte: PROFETA },
    { texto: "Quanto mais fundo a tristeza escava o seu ser, mais alegria você pode conter.", autor: "Khalil Gibran", obra: "O Profeta", fonte: PROFETA },
    { texto: "A sua dor é o romper da casca que envolve o seu entendimento.", autor: "Khalil Gibran", obra: "O Profeta", fonte: PROFETA },
    { texto: "Não diga: “Encontrei o caminho da alma.” Diga antes: “Encontrei a alma caminhando em meu caminho.”", autor: "Khalil Gibran", obra: "O Profeta", fonte: PROFETA },
    { texto: "Se é de fato sábio, ele não o convida a entrar na casa da sabedoria dele, mas o conduz ao limiar da sua própria mente.", autor: "Khalil Gibran", obra: "O Profeta", fonte: PROFETA },
  ],
  [
    { texto: "A Filosofia nos ensina que quanto maior a percepção interna do essencial, maior a evidência externa do que é fraterno.", autor: "Carlos Adelantado", obra: null, fonte: `${ACROPOLE_BR}/artigos/filosofia/o-que-e-a-nova-acropole-presidente-responde/` },
    { texto: "O caminho da filosofia é longo, mas não é duro.", autor: "Carlos Adelantado", obra: "Construir o futuro", fonte: `${BIBLIOTECA_NA}/construir-el-futuro/` },
    { texto: "Eis aí o bom uso da nossa liberdade: saber compassar nossa pequena vida ao ritmo da grande Vida.", autor: "Carlos Adelantado", obra: "Construir o futuro", fonte: `${BIBLIOTECA_NA}/construir-el-futuro/` },
    { texto: "Esta é a grande diferença: os problemas se resolvem, mas as provas se superam.", autor: "Carlos Adelantado", obra: "O sentido heroico da vida", fonte: `${BIBLIOTECA_NA}/el-sentido-heroico-de-la-vida/` },
    { texto: "Saber amar é fixar-se no que os demais têm de bom, no melhor que os outros têm.", autor: "Carlos Adelantado", obra: "O sentido heroico da vida", fonte: `${BIBLIOTECA_NA}/el-sentido-heroico-de-la-vida/` },
    { texto: "Se estivermos atentos, descobriremos que a vida vai nos mostrando uma série de portas. E toda porta tem sua chave para abri-la.", autor: "Carlos Adelantado", obra: "A chave do triunfo", fonte: `${BIBLIOTECA_NA}/la-llave-del-triunfo/` },
    { texto: "O bom e o verdadeiro que há em cada ser humano se mostram e se demonstram na beleza das formas externas que ele adota.", autor: "Carlos Adelantado", obra: "Influência da beleza no caráter", fonte: `${BIBLIOTECA_NA}/influencia-de-la-belleza-en-el-caracter/` },
    { texto: "A responsabilidade é coisa de todos.", autor: "Carlos Adelantado", obra: "A responsabilidade", fonte: `${BIBLIOTECA_NA}/la-responsabilidad/` },
  ],
  [
    { texto: "Que tua Alma empreste o ouvido a todo grito de dor, assim como o lótus desnuda seu coração para beber o sol da manhã.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice1.htm` },
    { texto: "Não deixes que o Sol ardente seque uma só lágrima de dor antes que tu mesmo a tenhas enxugado dos olhos de quem sofre.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice1.htm` },
    { texto: "Ajuda a Natureza e trabalha com ela; e a Natureza te considerará um de seus criadores e te prestará reverência.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice1.htm` },
    { texto: "Viver para beneficiar a humanidade é o primeiro passo.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice2.htm` },
    { texto: "Sê humilde, se queres alcançar a Sabedoria. Sê mais humilde ainda, quando a Sabedoria tiveres dominado.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice2.htm` },
    { texto: "Tem paciência, Candidato, como quem não teme o fracasso nem corteja o sucesso.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice2.htm` },
    { texto: "O caminho que conduz adiante é iluminado por um só fogo: a luz da ousadia, ardendo no coração.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice3.htm` },
    { texto: "O Caminho é um só para todos; os meios para alcançar a meta devem variar conforme os Peregrinos.", autor: "Helena Blavatsky", obra: "A Voz do Silêncio", fonte: `${VOZ_DO_SILENCIO}/voice3.htm` },
  ],
  [
    { texto: "O que vale na vida não é o ponto de partida e sim a caminhada. / Caminhando e semeando, no fim, terás o que colher.", autor: "Cora Coralina", obra: "Vintém de Cobre", fonte: "https://repositorio.ufu.br/bitstream/123456789/15442/1/MRSRMoraisDISSPRT.pdf" },
    { texto: "Removi pedras, quebrei arestas da vida e plantei roseiras.", autor: "Cora Coralina", obra: "Vintém de Cobre, “Semente e Fruto”", fonte: "https://repositorio.ufu.br/bitstream/123456789/35091/1/MeiasConfiss%c3%b5esAninha.pdf" },
    { texto: "Acredito numa energia imanente / que virá um dia ligar a família humana / numa corrente de fraternidade universal", autor: "Cora Coralina", obra: "Vintém de Cobre", fonte: "https://repositorio.ufu.br/bitstream/123456789/35091/1/MeiasConfiss%c3%b5esAninha.pdf" },
    { texto: "Acredito nos jovens à procura de caminhos novos / Abrindo espaços largos na vida.", autor: "Cora Coralina", obra: "Vintém de Cobre", fonte: "https://repositorio.ufu.br/bitstream/123456789/35091/1/MeiasConfiss%c3%b5esAninha.pdf" },
    { texto: "Recria tua vida, sempre, sempre. / Remove pedras e planta roseiras e faz doces. / Recomeça.", autor: "Cora Coralina", obra: "“Aninha e suas pedras”", fonte: "https://bdtd.ufcg.edu.br/jspui/bitstream/riufcg/9160/3/%c3%8dTALA%20MORGANA%20SILVA%20LEITE.%20TCC.%20LICENCIATURA%20EM%20LETRAS%20-%20L%c3%8dNGUA%20PORTUGUESA.%202017.pdf" },
    { texto: "Eu sou aquela mulher / a quem o tempo / muito ensinou. / Ensinou a amar a vida. / Não desistir da luta.", autor: "Cora Coralina", obra: "Vintém de Cobre, “Ofertas de Aninha”", fonte: "https://bdtd.ufcg.edu.br/jspui/bitstream/riufcg/9160/3/%c3%8dTALA%20MORGANA%20SILVA%20LEITE.%20TCC.%20LICENCIATURA%20EM%20LETRAS%20-%20L%c3%8dNGUA%20PORTUGUESA.%202017.pdf" },
  ],
  [
    { texto: "Nenhum indivíduo pode, em última instância, fracassar. A Divindade que desce à humanidade está destinada a recuperar seu estado original.", autor: "N. Sri Ram", obra: "Pensamentos para aspirantes", fonte: "https://www.ts-adyar.org/book/thoughts-aspirantsist-ser" },
    { texto: "De todas as artes que existem, a de viver exige a mais elevada qualidade de inteligência e é a mais exigente.", autor: "N. Sri Ram", obra: null, fonte: "https://www.ts-adyar.org/node/312" },
    { texto: "A experiência de viver é, em última instância, a experiência de uma natureza em nós mesmos, que se mostra como beleza, como amor, como verdade.", autor: "N. Sri Ram", obra: null, fonte: "https://www.ts-adyar.org/node/312" },
    { texto: "Se o que se diz representa a verdade em alguma medida, não pode ser propriedade nem invenção de ninguém. A verdade não tem donos.", autor: "N. Sri Ram", obra: "Uma abordagem da realidade", fonte: "https://www.ts-adyar.org/book/approach-reality" },
    { texto: "Somos completamente livres somente quando estamos livres de nós mesmos.", autor: "N. Sri Ram", obra: null, fonte: "https://www.ts-adyar.org/sites/default/files/2026-09/Vol147No12Sep2026.pdf" },
    { texto: "Esqueça-se de si mesmo apenas para lembrar-se do bem dos outros.", autor: "N. Sri Ram", obra: "Regeneração humana", fonte: "https://www.ts-adyar.org/sites/default/files/2024-06/Vol145No9%20Jun2024_0.pdf" },
    { texto: "É a direção do nosso progresso que importa, não onde estamos no momento.", autor: "N. Sri Ram", obra: null, fonte: "https://www.ts-adyar.org/sites/default/files/2026-10/Vol148No01Oct2026.pdf" },
    { texto: "Pode-se estar no mundo, mas não ser dele.", autor: "N. Sri Ram", obra: "Buscando a sabedoria", fonte: "https://www.ts-adyar.org/sites/default/files/2024-01/Vol144No07%20Apr2023.pdf" },
  ],
  [
    { texto: "Quem reconhece e confessa os próprios defeitos / está se apressando no caminho que leva à perfeição!", autor: "Rumi", obra: "Masnavi", fonte: MASNAVI },
    { texto: "A dor é um tesouro, pois contém misericórdias; / o miolo é macio quando se raspa a casca.", autor: "Rumi", obra: "Masnavi", fonte: MASNAVI },
    { texto: "O mar é uma coisa, a espuma é outra; / não dê atenção à espuma e contemple o mar com seus olhos.", autor: "Rumi", obra: "Masnavi", fonte: MASNAVI },
    { texto: "Guarde silêncio, para que possa ouvi-Lo falar / palavras que a língua não consegue pronunciar.", autor: "Rumi", obra: "Masnavi", fonte: MASNAVI },
    { texto: "Quando você tiver acolhido a Luz, ó amado, / quando contemplar sem véu o que está velado, / como uma estrela caminhará pelos céus.", autor: "Rumi", obra: "Masnavi", fonte: "https://www.gutenberg.org/ebooks/45159" },
    { texto: "Como em cada coração há uma janela para os outros corações, / eles não estão separados e isolados como dois corpos.", autor: "Rumi", obra: "Masnavi", fonte: MASNAVI },
  ],
  [
    { texto: "O olho vê, a lembrança revê, e a imaginação transvê. / É preciso transver o mundo.", autor: "Manoel de Barros", obra: "Livro sobre nada", fonte: "https://textopoetico.emnuvens.com.br/rtp/article/download/46/47/78" },
    { texto: "A força de um artista vem das suas derrotas.", autor: "Manoel de Barros", obra: "Livro sobre nada", fonte: "https://textopoetico.emnuvens.com.br/rtp/article/download/46/47/78" },
    { texto: "Prezo insetos mais que aviões. / Prezo a velocidade / das tartarugas mais que a dos mísseis.", autor: "Manoel de Barros", obra: "Memórias inventadas: a infância", fonte: "https://www.ppghufgd.com/wp-content/uploads/2017/06/FERNANDA-MARTINS-DA-SILVA.pdf" },
    { texto: "Meu quintal é maior do que o mundo.", autor: "Manoel de Barros", obra: "Memórias inventadas: a infância", fonte: "https://www.ppghufgd.com/wp-content/uploads/2017/06/FERNANDA-MARTINS-DA-SILVA.pdf" },
    { texto: "Dou respeito às coisas desimportantes / e aos seres desimportantes.", autor: "Manoel de Barros", obra: "Memórias inventadas: a infância", fonte: "https://www.ppghufgd.com/wp-content/uploads/2017/06/FERNANDA-MARTINS-DA-SILVA.pdf" },
  ],
  [
    { texto: "Vivemos um tempo em que a informação é abundante, mas a sabedoria parece cada vez mais escassa.", autor: "Lúcia Helena Galvão", obra: null, fonte: "https://acropole.org.br/artigos/a-era-do-odio-reflexoes-filosoficas-sobre-o-nosso-tempo/" },
    { texto: "Ao reconhecermos em nós o que também existe no outro, nasce a compaixão — e ela é o antídoto do ódio.", autor: "Lúcia Helena Galvão", obra: null, fonte: "https://acropole.org.br/artigos/a-era-do-odio-reflexoes-filosoficas-sobre-o-nosso-tempo/" },
    { texto: "A filosofia é, em última instância, uma educação do coração humano.", autor: "Lúcia Helena Galvão", obra: null, fonte: "https://acropole.org.br/artigos/a-era-do-odio-reflexoes-filosoficas-sobre-o-nosso-tempo/" },
    { texto: "Poder é capacidade de ser, de fazer, de realizar, de transformar.", autor: "Lúcia Helena Galvão", obra: null, fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/voluntariado-vontade-de-poder/" },
    { texto: "A beleza verdadeira não é estética. É ética.", autor: "Lúcia Helena Galvão", obra: null, fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/a-beleza-segundo-gibran-espelho-da-alma-ou-mascara-da-vaidade/" },
    { texto: "A saída nunca é para os lados. A saída é para cima.", autor: "Lúcia Helena Galvão", obra: null, fonte: "https://acropole.org.br/artigos/filosofia/psicologia-filosofia-o-que-sao-valores-humanos-hoje-lucia-helena-galvao-e-rossandro-klinjey/" },
  ],
  [
    { texto: "O que faz com que as qualidades do ser humano revertam realmente para o bem da sociedade é a Bondade.", autor: "Luis Carlos Marques", obra: null, fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/palavras-do-prof-luis-carlos-marques-fonseca-no-seminario-30-anos-da-convencao-sobre-os-direitos-da-crianca/" },
    { texto: "Este é o nosso dever: amar a criança tal como ela é, para que seja ela mesma, não um ser produtivo a mais na sociedade.", autor: "Luis Carlos Marques", obra: null, fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/palavras-do-prof-luis-carlos-marques-fonseca-no-seminario-30-anos-da-convencao-sobre-os-direitos-da-crianca/" },
    { texto: "Qual é a semente, qual é o fruto próprio de um ser humano? O que o ser humano tem que produzir que o transforma em Ser Humano?", autor: "Luis Carlos Marques", obra: null, fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/palavras-do-prof-luis-carlos-marques-fonseca-no-seminario-30-anos-da-convencao-sobre-os-direitos-da-crianca/" },
    { texto: "Penso, quando falamos de direitos da criança, que a educação é um dos principais, mas, sem amor, não creio em educação.", autor: "Luis Carlos Marques", obra: null, fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/palavras-do-prof-luis-carlos-marques-fonseca-no-seminario-30-anos-da-convencao-sobre-os-direitos-da-crianca/" },
    { texto: "Se o homem não é generoso, se não colabora com os demais, não é bom, embora possa ter todas as outras qualidades humanas.", autor: "Luis Carlos Marques", obra: "Prometeu Acorrentado", fonte: "https://acropole.org.br/artigos/reflexoes-filosoficas/prometeu-acorrentado/" },
    { texto: "O objetivo da justiça é entrelaçar todas as coisas, formando a unidade.", autor: "Luis Carlos Marques", obra: null, fonte: "https://acropole.org.br/artigos/filosofia/encontro-nacional-do-instituto-maat-2025-reflete-sobre-a-justica-nas-diferentes-tradicoes/" },
  ],
  [
    { texto: "O medo não é mau; má é a reação que geramos diante dele, porque não fomos educados de forma correta para enfrentá-lo.", autor: "Michel Echenique", obra: "O que é o medo", fonte: "https://biblioteca.acropolis.org/que-es-el-miedo/" },
    { texto: "Todos nós temos nosso temperamento, mas nem sempre conseguimos estruturar nosso caráter para trabalhar com ele.", autor: "Michel Echenique", obra: "As raízes da violência", fonte: "https://biblioteca.acropolis.org/las-raices-de-la-violencia-conocer-para-evitar/" },
    { texto: "O medo se relaciona com o poder, e quando aprendemos a nos relacionar com o medo, aprendemos a nos relacionar com o poder.", autor: "Michel Echenique", obra: "Como enfrentar o medo", fonte: "https://www.revistaesfinge.com/2013/08/como-enfrentar-el-miedo-michel-echenique/" },
  ],
  [
    { texto: "Mais glorioso do que vencer mil inimigos em batalha, é vencer a si mesmo.", autor: "Buda", obra: "Dhammapada", fonte: "https://acropole.org.br/artigos/filosofia/reflexoes-filosoficas-sobre-o-bhagavad-gita/" },
    { texto: "O ódio nunca se extingue pelo ódio neste mundo; somente se apaga por meio do amor. Tal é uma antiga lei eterna.", autor: "Buda", obra: "Dhammapada", fonte: "https://www.nueva-acropolis.es/libros/Dhammapada.pdf" },
    { texto: "Se um homem fala ou age com mente pura, a felicidade o segue como sua sombra inseparável.", autor: "Buda", obra: "Dhammapada", fonte: "https://nueva-acropolis.es/curso-de-filosofia-para-vivir/filosofia-budista-siddharta-gautama-el-buddha/" },
    { texto: "Por meio do esforço, da diligência, da disciplina e do autocontrole, que o homem sábio faça de si mesmo uma ilha que nenhuma inundação possa submergir.", autor: "Buda", obra: "Dhammapada", fonte: "https://www.nueva-acropolis.es/libros/Dhammapada.pdf" },
    { texto: "Como uma rocha sólida não se move com o vento, assim o sábio permanece imperturbável diante da calúnia e do elogio.", autor: "Buda", obra: "Dhammapada", fonte: "https://www.nueva-acropolis.es/libros/Dhammapada.pdf" },
    { texto: "Melhor que mil discursos, melhor que um mero amontoado de palavras sem significado, é uma frase sensata, ao ouvir a qual a pessoa se acalma.", autor: "Buda", obra: "Dhammapada", fonte: "https://www.nueva-acropolis.es/libros/Dhammapada.pdf" },
    { texto: "O abandono do mal, o cultivo do bem e a purificação da mente: tal é o ensinamento dos budas.", autor: "Buda", obra: "Dhammapada", fonte: "https://www.nueva-acropolis.es/libros/Dhammapada.pdf" },
    { texto: "Conquista o homem irado pelo amor; conquista o homem de má vontade pela bondade; conquista o avarento pela generosidade; conquista o mentiroso pela verdade.", autor: "Buda", obra: "Dhammapada", fonte: "https://www.nueva-acropolis.es/libros/Dhammapada.pdf" },
  ],
  [
    { texto: "Sobrepõe-te a esse medíocre desalento e levanta-te como o fogo que queima tudo o que encontra à sua passagem.", autor: "Bhagavad Gita", obra: null, fonte: "https://www.nova-acropole.pt/a-senda-moral-dos-guerreiros-no-ocidente-e-no-oriente/" },
    { texto: "Nas obras dos melhores homens, os demais encontram seu exemplo a seguir. O caminho por onde anda um grande homem torna-se um guia para o resto da humanidade.", autor: "Bhagavad Gita", obra: null, fonte: "https://www.nueva-acropolis.es/libros/Bhagavad_Gita.pdf" },
    { texto: "A sabedoria leva o homem além do bem e do mal. Encontra, pois, a sabedoria: o Yoga é a sabedoria em ação.", autor: "Bhagavad Gita", obra: null, fonte: "https://www.nueva-acropolis.es/libros/Bhagavad_Gita.pdf" },
    { texto: "E cada vez que a mente, em sua contínua divagação, se afastar do Espírito, uma e outra vez traze-a de volta e repousa-a sobre o Espírito.", autor: "Bhagavad Gita", obra: null, fonte: "https://www.nueva-acropolis.es/libros/Bhagavad_Gita.pdf" },
  ],
  [
    { texto: "Quem vence os outros é forte; quem vence a si mesmo é poderoso.", autor: "Lao-Tsé", obra: "Tao Te Ching", fonte: "https://www.nueva-acropolis.es/libros/Lao_Tse-Tao_Te_King.pdf" },
    { texto: "Aquele que conhece os homens é sábio; aquele que se conhece a si mesmo está iluminado.", autor: "Lao-Tsé", obra: "Tao Te Ching", fonte: "https://www.nueva-acropolis.es/libros/Lao_Tse-Tao_Te_King.pdf" },
    { texto: "Aquele que se contenta com o que tem é rico; aquele que age com determinação tem vontade.", autor: "Lao-Tsé", obra: "Tao Te Ching", fonte: "https://www.nueva-acropolis.es/libros/Lao_Tse-Tao_Te_King.pdf" },
    { texto: "Um bom soldado nunca é agressivo; um bom guerreiro nunca é irascível.", autor: "Lao-Tsé", obra: "Tao Te Ching", fonte: "https://www.revistaesfinge.com/2016/01/lo-que-lao-tse-predijo-de-la-politica-actual/" },
    { texto: "A jornada de mil léguas começa com um passo.", autor: "Lao-Tsé", obra: "Tao Te Ching", fonte: "https://www.gutenberg.org/ebooks/216" },
  ],
  [
    { texto: "Aprender sem pensar é inútil; pensar sem aprender é perigoso.", autor: "Confúcio", obra: "Analectos", fonte: "https://www.revistaesfinge.com/2019/11/analectas-de-confucio/" },
    { texto: "O que busca o homem superior está em si mesmo; o que busca o homem vulgar está nos outros.", autor: "Confúcio", obra: "Analectos", fonte: "https://acropole.org.br/artigos/filosofia/o-valor-da-moral-no-pensamento-de-confucio/" },
    { texto: "É o homem quem amplia o Caminho, não o Caminho que amplia o homem.", autor: "Confúcio", obra: "Analectos", fonte: "https://acropole.org.br/artigos/filosofia/o-valor-da-moral-no-pensamento-de-confucio/" },
    { texto: "O homem superior coloca em prática suas palavras antes de dizê-las, e depois fala em conformidade com suas ações.", autor: "Confúcio", obra: "Analectos", fonte: "https://acropole.org.br/artigos/filosofia/o-valor-da-moral-no-pensamento-de-confucio/" },
    { texto: "Quando virdes um homem sábio, pensai em igualar suas virtudes. Quando virdes um homem desprovido de virtude, examinai-vos a vós mesmos.", autor: "Confúcio", obra: "Analectos", fonte: "https://www.revistaesfinge.com/wp-content/uploads/revista/Esfinge-2019-12.pdf" },
    { texto: "Não imponha aos outros o que não deseja para si.", autor: "Confúcio", obra: "Analectos", fonte: "https://acropole.org.br/artigos/filosofia/a-etica-segundo-confucio-licoes-praticas-para-a-vida-lucia-helena-galvao/" },
  ],
  [
    { texto: "O homem benevolente não tem rival.", autor: "Mêncio", obra: null, fonte: "https://library.acropolis.org/the-philosophy-of-benevolence/" },
    { texto: "A tendência natural dos homens para a bondade é como a tendência da água de buscar o nível mais baixo.", autor: "Mêncio", obra: null, fonte: "https://library.acropolis.org/the-philosophy-of-benevolence/" },
  ],
  [
    { texto: "Da ilusão conduz-me à Verdade. Da escuridão conduz-me à Luz. Da morte conduz-me à imortalidade.", autor: "Upanishads", obra: "Brihadaranyaka Upanishad", fonte: "https://library.acropolis.org/philosophy-of-education/" },
  ],
  [
    { texto: "Que teu coração não seja vaidoso por conta daquilo que conheces. Toma conselho tanto junto ao ignorante quanto junto ao sábio.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://acropole.org.br/artigos/filosofia/as-maximas-de-ptahhotep-a-sabedoria-do-egito-antigo-para-a-vida-moderna-com-profa-lucia-helena-galvao/" },
    { texto: "Grande é a regra, duradoura a sua eficácia; não foi perturbada desde os tempos de Osíris.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://nova-acropole.pt/deusa-maat-estudo-simbolico/" },
    { texto: "Mesmo quando tudo chega ao seu fim, o Ideal permanece.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://www.revistaesfinge.com/2014/09/un-manual-para-sacar-partido-a-la-vida/" },
    { texto: "Nada cobices, propõe-te viver em paz com aquilo que tens e os dons de Deus chegarão naturalmente.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://www.revistaesfinge.com/2014/09/un-manual-para-sacar-partido-a-la-vida/" },
    { texto: "Segue o teu coração durante toda a tua vida, encontra sempre a justa medida. Não diminuas o tempo e a vida que pertencem ao teu coração.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://www.revistaesfinge.com/2014/09/un-manual-para-sacar-partido-a-la-vida/" },
    { texto: "Não repitas um rumor maledicente, não o escutes.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://www.revistaesfinge.com/2014/09/un-manual-para-sacar-partido-a-la-vida/" },
    { texto: "Quando a escuta é boa, a palavra é boa. Quem escuta é mestre do proveitoso.", autor: "Ptahhotep", obra: "Máximas", fonte: "https://acropole.org.br/artigos/filosofia/as-maximas-de-ptahhotep-a-sabedoria-do-egito-antigo-para-a-vida-moderna-com-profa-lucia-helena-galvao/" },
  ],
  [
    { texto: "O espanto é o princípio da filosofia.", autor: "Platão", obra: "Teeteto", fonte: "https://library.acropolis.org/celebrating-2400-years-of-platos-academy/" },
    { texto: "Vencer a si mesmo é a primeira e a melhor de todas as vitórias.", autor: "Platão", obra: "As Leis", fonte: "https://library.acropolis.org/living-philosophy-how-words-of-plato-and-marcus-aurelius-are-relevant-today/" },
    { texto: "Aprender não é senão recordar.", autor: "Platão", obra: "Mênon", fonte: "https://www.revistaesfinge.com/2021/04/los-arquetipos-de-platon-la-verdad/" },
    { texto: "À alma não resta outra salvação e escape dos males senão tornar-se a melhor e a mais sensata possível.", autor: "Platão", obra: "Fédon", fonte: "https://www.revistaesfinge.com/2026/08/platon-y-la-filosofia-como-modo-de-existencia/" },
  ],
  [
    { texto: "Uma vida sem exame não vale a pena ser vivida.", autor: "Sócrates", obra: "Platão, Apologia", fonte: "https://acropole.org.br/artigos/filosofia/humanizar-o-homem-para-regenerar-a-sociedade-filosofia-classica-cidadania-e-a-superacao-da-polarizacao-copy/" },
    { texto: "As coisas belas são difíceis.", autor: "Sócrates", obra: "Platão, República", fonte: "https://biblioteca.acropolis.org/socrates/" },
  ],
  [
    { texto: "Não faças, sozinho ou com os outros, aquilo que te daria vergonha.", autor: "Pitágoras", obra: "Versos de Ouro", fonte: "https://acropole.org.br/artigos/filosofia/versos-de-ouro-de-pitagoras-honra-amizade-e-virtude-segundo-lucia-helena-galvao/" },
    { texto: "Entre os outros, escolhe como amigo o mais sábio e virtuoso.", autor: "Pitágoras", obra: "Versos de Ouro", fonte: "https://acropole.org.br/artigos/filosofia/versos-de-ouro-de-pitagoras-honra-amizade-e-virtude-segundo-lucia-helena-galvao/" },
    { texto: "Nunca feches os olhos sem te perguntares: o que fiz hoje e o que esqueci? Começa por isso e continua reprovando o mal que fizeste e alegrando-te com o que fizeste bem.", autor: "Pitágoras", obra: "Versos de Ouro", fonte: "https://biblioteca.acropolis.org/los-ejercicios-espirituais-en-las-escuelas-antiguas/" },
    { texto: "Entre os amigos, as coisas são comuns.", autor: "Pitágoras", obra: null, fonte: "https://biblioteca.acropolis.org/pitagoras/" },
  ],
  [
    { texto: "A harmonia invisível é maior que a harmonia visível.", autor: "Heráclito", obra: "Fragmentos", fonte: "https://biblioteca.acropolis.org/anecdotas-de-los-filosofos-presocraticos/" },
    { texto: "Nem mesmo percorrendo todo caminho chegarás a encontrar os limites da alma; tão profundo logos ela tem.", autor: "Heráclito", obra: "Fragmentos", fonte: "https://biblioteca.acropolis.org/anecdotas-de-los-filosofos-presocraticos/" },
  ],
  [
    { texto: "A natureza nos fez suscetíveis de adquirir virtudes, mas é o hábito que as desenvolve em nós.", autor: "Aristóteles", obra: "Ética a Nicômaco", fonte: "https://www.revistaesfinge.com/2013/06/citas-celebres-9/" },
    { texto: "O amigo é outro eu que nos proporciona o que não podemos obter por nós mesmos.", autor: "Aristóteles", obra: "Ética a Nicômaco", fonte: "https://www.revistaesfinge.com/2026/05/aristoteles-amistad/" },
    { texto: "Todos os homens, por natureza, desejam saber.", autor: "Aristóteles", obra: "Metafísica", fonte: "https://www.revistaesfinge.com/2021/09/el-banquete-de-dante/" },
  ],
  [
    { texto: "Grande milagre, ó Asclépio, é o homem.", autor: "Hermes Trismegisto", obra: "Asclépio", fonte: "https://biblioteca.acropolis.org/discurso-sobre-la-dignidad-del-hombre/" },
  ],
  [
    { texto: "Não ponhas o teu coração em buscar a riqueza. Não te canses buscando a abundância; o que tens, isso te basta.", autor: "Amenemope", obra: "Instrução de Amenemope", fonte: "https://www.revistaesfinge.com/2021/07/el-valor-del-trabajo/" },
  ],
  [
    { texto: "A alma se torna tingida com a cor de seus pensamentos", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://acropole.org.br/artigos/filosofia/estoicismo/" },
    { texto: "Em nenhuma parte o homem se retira com maior tranquilidade e mais calma que em sua própria alma.", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://acropole.org.br/artigos/filosofia/meditacoes-marco-aurelio-imperador-filosofo/" },
    { texto: "O que não beneficia a colmeia, tampouco beneficia a abelha", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://acropole.org.br/artigos/filosofia/meditacoes-marco-aurelio-imperador-filosofo/" },
    { texto: "Já não se trata de discutir esta tese: o que é um homem de bem?, mas de sê-lo.", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://www.nueva-acropolis.es/libros/Marco_Aurelio-Meditaciones.pdf" },
    { texto: "Busca dentro de ti mesmo. Ali está a fonte do bem, tanto mais inesgotável quanto mais se aprofunda.", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://www.nueva-acropolis.es/libros/Marco_Aurelio-Meditaciones.pdf" },
    { texto: "Sê como um promontório contra o qual vêm quebrar-se continuamente as ondas do mar: sempre imóvel, ao seu redor a fúria se torna impotente.", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://www.nueva-acropolis.es/libros/Marco_Aurelio-Meditaciones.pdf" },
    { texto: "Diz o que julgares mais justo, mas sempre com doçura, com modéstia e sem dissimulação.", autor: "Marco Aurélio", obra: "Meditações", fonte: "https://www.revistaesfinge.com/2019/12/meditaciones-de-marco-aurelio-la-vida-interior-del-emperador/" },
  ],
  [
    { texto: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.", autor: "Sêneca", obra: "Cartas a Lucílio", fonte: "https://acropole.org.br/artigos/filosofia/quem-foi-seneca-vida-e-filosofia/" },
    { texto: "Não é que tenhamos pouco tempo, é que desperdiçamos muito.", autor: "Sêneca", obra: "Sobre a brevidade da vida", fonte: "https://acropole.org.br/artigos/filosofia/estoicismo-na-pratica-como-aplicar-o-estoicismo/" },
    { texto: "Nenhum vento será bom para quem não sabe a que porto se dirige.", autor: "Sêneca", obra: "Cartas a Lucílio", fonte: "https://blog.nueva-acropolis.es/2017/no-hay-viento-bueno-para-quien-no-sabe-donde-va/" },
    { texto: "Tudo o que está por vir assenta em terreno inseguro: vive desde agora!", autor: "Sêneca", obra: "Sobre a brevidade da vida", fonte: "https://www.revistaesfinge.com/2019/06/seneca-el-valor-del-tiempo/" },
    { texto: "O adiamento é a maior perda da vida.", autor: "Sêneca", obra: "Sobre a brevidade da vida", fonte: "https://www.revistaesfinge.com/2019/06/seneca-el-valor-del-tiempo/" },
    { texto: "A fortuna teme os fortes e acossa os covardes.", autor: "Sêneca", obra: "Medeia", fonte: "https://www.revistaesfinge.com/2019/12/seneca-la-filosofia-como-terapia/" },
  ],
  [
    { texto: "Não são as coisas que nos perturbam, mas a opinião que temos sobre elas.", autor: "Epicteto", obra: "Manual", fonte: "https://acropole.org.br/artigos/filosofia/estoicismo/" },
    { texto: "Busca não que os acontecimentos se deem como queres, mas deseja que os acontecimentos se deem como se dão e encontrarás tranquilidade.", autor: "Epicteto", obra: "Manual", fonte: "https://acropole.org.br/artigos/filosofia/estoicismo-na-pratica-como-aplicar-o-estoicismo/" },
    { texto: "Podes ser invencível se apenas não aceitares um combate cuja vitória não esteja sob o teu controle.", autor: "Epicteto", obra: "Manual", fonte: "https://www.nueva-acropolis.es/libros/Epicteto-Maximas.pdf" },
    { texto: "Ninguém pode ferir-te se tu não o consentires.", autor: "Epicteto", obra: "Manual", fonte: "https://www.nueva-acropolis.es/libros/Epicteto-Maximas.pdf" },
    { texto: "Primeiro diz a ti mesmo o que queres ser; depois faz o que tens de fazer.", autor: "Epicteto", obra: "Discursos", fonte: "https://en.wikisource.org/wiki/All_the_Works_of_Epictetus,_Which_Are_Now_Extant/Book_3/Chapter_23" },
  ],
  [
    { texto: "Nunca deixes de esculpir a tua própria estátua.", autor: "Plotino", obra: "Enéadas", fonte: "https://nueva-acropolis.es/cordoba/2013/la-belleza-segun-el-filosofo-plotino/" },
    { texto: "Jamais um olho veria o Sol sem ter se tornado de algum modo semelhante ao Sol, nem uma alma veria o belo se ela mesma não se fizesse bela.", autor: "Plotino", obra: "Enéadas", fonte: "https://nueva-acropolis.es/curso-de-filosofia-para-vivir/plotino-eclecticismo-y-elevacion-del-alma/" },
    { texto: "Esforça-te por elevar o que há de divino em nós ao que há de divino no universo.", autor: "Plotino", obra: "Porfírio, Vida de Plotino", fonte: "https://biblioteca.acropolis.org/plotino/" },
  ],
  [
    { texto: "Poderás degenerar ao inferior, com os brutos; poderás elevar-te à altura das coisas divinas, por tua própria decisão.", autor: "Pico della Mirandola", obra: "Discurso sobre a dignidade do homem", fonte: "https://www.revistaesfinge.com/2020/06/sobre-la-dignidad-del-hombre-un-gozne-historico/" },
    { texto: "O que cada um cultivar, isso florescerá e dará seu fruto dentro dele.", autor: "Pico della Mirandola", obra: "Discurso sobre a dignidade do homem", fonte: "https://www.revistaesfinge.com/2020/06/sobre-la-dignidad-del-hombre-un-gozne-historico/" },
  ],
  [
    { texto: "Todas as coisas são dirigidas pelo Bem ao Bem. Alegra-te no presente. Não estimes os bens nem busques honras; evita o excesso, evita os negócios. Alegra-te no presente.", autor: "Marsilio Ficino", obra: "Cartas", fonte: "https://biblioteca.acropolis.org/ficino-y-el-neoplatonismo-florentino/" },
  ],
  [
    { texto: "Vós sentis talvez mais temor ao proferir esta sentença do que eu ao recebê-la.", autor: "Giordano Bruno", obra: "Resposta aos juízes da Inquisição", fonte: "https://www.revue-acropolis.fr/histoire-civilisations/giordano-bruno-savant-philosophe-inquisition/" },
  ],
  [
    { texto: "Eu me pergunto se as estrelas se iluminam a fim de que, algum dia, cada um possa encontrar a sua.", autor: "Antoine de Saint-Exupéry", obra: "O Pequeno Príncipe", fonte: "https://www.revistaesfinge.com/2019/06/citas-celebres-70/" },
  ],
  [
    { texto: "Cada criatura, ao nascer, nos traz a mensagem de que Deus ainda não perdeu a esperança nos homens.", autor: "Rabindranath Tagore", obra: "Pássaros Perdidos", fonte: "https://www.revistaesfinge.com/2020/11/citas-celebres-85/" },
  ],
  [
    { texto: "O homem mais feliz é aquele que pode enlaçar o final de sua vida com o princípio.", autor: "Goethe", obra: "Máximas e Reflexões", fonte: "https://www.revistaesfinge.com/2014/11/citas-celebres-26/" },
    { texto: "O belo é uma manifestação de certas leis secretas da natureza que, sem essa revelação, permaneceriam eternamente ocultas aos nossos olhos.", autor: "Goethe", obra: "Máximas e Reflexões", fonte: "https://www.revistaesfinge.com/2016/09/citas-celebres-42/" },
  ],
  [
    { texto: "Aquele que lê muito e anda muito vê muito e sabe muito.", autor: "Miguel de Cervantes", obra: "Dom Quixote", fonte: "https://www.revistaesfinge.com/2016/03/citas-celebres-38/" },
  ],
  [
    { texto: "Apressa-te; não confies nas horas vindouras. Quem hoje não está disposto, menos o estará amanhã.", autor: "Ovídio", obra: "Remédios do Amor", fonte: "https://www.revistaesfinge.com/2016/08/citas-celebres-41/" },
  ],
  [
    { texto: "Sou homem e, portanto, nada que seja humano me é estranho.", autor: "Terêncio", obra: "O Atormentador de Si Mesmo", fonte: "https://www.revistaesfinge.com/2018/08/citas-celebres-62/" },
  ],
  [
    { texto: "Por que buscais a felicidade, ó mortais, fora de vós mesmos?", autor: "Boécio", obra: "A Consolação da Filosofia", fonte: "https://www.revistaesfinge.com/2014/03/citas-celebres-17/" },
  ],
  [
    { texto: "Toda a terra está ao alcance do sábio, pois a pátria de uma alma elevada é o universo.", autor: "Demócrito", obra: "Fragmentos", fonte: "https://www.revistaesfinge.com/2014/01/citas-celebres-15/" },
  ],
  [
    { texto: "Não basta levantar o fraco, é preciso sustentá-lo depois.", autor: "William Shakespeare", obra: "Timão de Atenas", fonte: "https://www.revistaesfinge.com/2016/03/citas-celebres-38/" },
    { texto: "Os covardes morrem muitas vezes antes de sua verdadeira morte; os valentes provam a morte uma só vez.", autor: "William Shakespeare", obra: "Júlio César", fonte: "https://www.revistaesfinge.com/2019/10/citas-celebres-73/" },
  ],
  [
    { texto: "O riso é o sol que afugenta o inverno do rosto humano.", autor: "Victor Hugo", obra: "Os Miseráveis", fonte: "https://www.revistaesfinge.com/2017/03/citas-celebres-46/" },
  ],
  [
    { texto: "Não peço riquezas, nem esperanças, nem amor, nem um amigo que me compreenda; tudo o que peço é o céu sobre mim e um caminho a meus pés.", autor: "Robert Louis Stevenson", obra: "Canções de Viagem", fonte: "https://www.revistaesfinge.com/2014/01/citas-celebres-15/" },
  ],
  [
    { texto: "Aprendemos a voar como os pássaros, a nadar como os peixes; mas não aprendemos a simples arte de viver como irmãos.", autor: "Martin Luther King Jr.", obra: "Conferência do Nobel da Paz, 1964", fonte: "https://www.revistaesfinge.com/2017/04/citas-celebres-47/" },
  ],
  [
    { texto: "Você não pode esperar construir um mundo melhor sem melhorar as pessoas.", autor: "Marie Curie", obra: "Pierre Curie (notas autobiográficas)", fonte: "https://www.revistaesfinge.com/2017/02/citas-celebres-45/" },
  ],
  [
    { texto: "É tão difícil ver a si mesmo quanto olhar para trás sem se virar.", autor: "Henry David Thoreau", obra: "Diário", fonte: "https://www.revistaesfinge.com/2019/01/citas-celebres-65/" },
  ],
];

/** Um autor por vez (rodízio entre os grupos), para semanas seguidas não repetirem o autor. */
function rodizio<T>(grupos: T[][]): T[] {
  const saida: T[] = [];
  for (let i = 0; i < Math.max(...grupos.map((g) => g.length)); i++) for (const g of grupos) if (g[i]) saida.push(g[i]);
  return saida;
}

export const FRASES_COM_FONTE: FraseComFonte[] = rodizio(GRUPOS);
export const FRASES_PADRAO: FraseDaTela[] = FRASES_COM_FONTE.map(({ texto, autor, obra }) => ({ texto, autor, obra }));

