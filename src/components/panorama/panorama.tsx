import { PainelProfissoes } from "@/components/relatorios/painel-profissoes";
import { formatBRL } from "@/lib/format";
import type { Alcance, Panorama } from "@/lib/panorama";
import { DIA_LIMITE_DESCONTO } from "@/lib/situacao-contribuicao";
import { BookOpenText, Briefcase, Cake, CalendarDays, ChevronRight, GraduationCap, HandHeart, RefreshCw, Smartphone, Users, Wallet } from "lucide-react";
import Link from "next/link";

/**
 * Visão geral (antes "Visão da filial" e "Painel Nacional", pedido do usuário 2026-10-25): os mesmos
 * índices, distribuídos por área, para uma filial, uma regional ou todas. Links para as áreas só quando o
 * alcance é a própria filial de quem vê (as áreas do Portal trabalham na filial da pessoa).
 */
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const COR_ENTRADA = "bg-[#009485] dark:bg-[#16a090]";
const COR_SAIDA = "bg-[#9a6b00] dark:bg-[#b8862a]";
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const quando = (ms: number) => new Date(ms).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");

function Numero({ valor, rotulo, destaque }: { valor: string | number; rotulo: string; destaque?: "alerta" }) {
  return (
    <div className="min-w-0">
      <p className={`text-2xl font-black tabular-nums ${destaque === "alerta" ? "text-na-danger-dark dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}>{valor}</p>
      <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{rotulo}</p>
    </div>
  );
}

function Area({ titulo, icone: Icone, href, children, detalhes, largo }: { titulo: string; icone: typeof Users; href?: string; children: React.ReactNode; detalhes?: React.ReactNode; largo?: boolean }) {
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 ${largo ? "lg:col-span-2" : ""}`}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-gray-700 uppercase dark:text-gray-300">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-na-green-light text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
            <Icone size={15} />
          </span>
          {titulo}
        </h2>
        {href && (
          <Link href={href} className="flex items-center gap-0.5 text-[12px] font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
            Abrir <ChevronRight size={13} />
          </Link>
        )}
      </header>
      {children}
      {detalhes && (
        <details className="group border-t border-gray-100 pt-3 dark:border-gray-800">
          <summary className="cursor-pointer text-[12px] font-semibold text-gray-600 dark:text-gray-300">{largo ? "Financeiro no Portal" : "Detalhes"}</summary>
          <div className="mt-3 flex flex-col gap-3">{detalhes}</div>
        </details>
      )}
    </section>
  );
}

export function PanoramaAreas({ p, alcance, base, minhaFilial, financeiro }: { p: Panorama; alcance: Alcance; base: string; minhaFilial: boolean; financeiro?: React.ReactNode }) {
  const m = p.mercurio;
  const varias = alcance.escolas.length > 1;
  const link = (href: string) => (minhaFilial ? href : undefined);
  const mesAtual = m.meses.at(-1);
  const maxMov = Math.max(1, ...m.meses.flatMap((x) => [x.entradas, x.saidas]));
  const c = m.contribuicao;
  const fichas = c.paga + c.emBranco + c.atrasada + c.isenta || 1;
  const hojeDia = Number(new Date(p.agora).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(8, 10));
  const [recAnt, recAtual] = m.receita.length > 1 ? m.receita : [undefined, m.receita[0]];

  return (
    <div className="flex flex-col gap-5">
      {/* Data da atualização sempre visível (pedido do usuário 2026-10-25). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-na-green-light px-3 py-1 text-[12px] font-bold text-na-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
          <RefreshCw size={12} />
          {p.atualizadoEm ? `Atualizado em ${quando(p.atualizadoEm)}` : "Aguardando a primeira atualização"}
          {p.atualizadoEm && p.atualizadoAte && p.atualizadoAte - p.atualizadoEm > 36e5 ? ` a ${quando(p.atualizadoAte)}` : ""}
        </span>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Pessoas e recibos lidos do Mercúrio nessa hora; ficha de contribuição do Mercúrio de{" "}
          {m.atualizacaoMercurio ? new Date(m.atualizacaoMercurio.replace(" ", "T") + "-03:00").toLocaleDateString("pt-BR") : "—"}. Filiais inteiras no Mercúrio, não só quem usa o Portal
          {p.foraDoPortal ? ` · ${p.foraDoPortal} unidade${p.foraDoPortal === 1 ? "" : "s"} ainda fora do Portal (sem números do Portal)` : ""}
          {p.faltamResumos.length ? ` · ainda sem resumo: ${p.faltamResumos.length > 5 ? `${p.faltamResumos.length} unidades` : p.faltamResumos.join(", ")}` : ""}.
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Area
          titulo="Pessoas e Escolástica"
          icone={GraduationCap}
          href={link("/escolastica")}
          detalhes={
            <>
              <ul className="flex flex-col gap-1.5">
                {m.porNivel.map((n) => (
                  <li key={n.nivel} className="flex items-center gap-3 text-[12px] text-gray-700 dark:text-gray-300">
                    <span className="w-44 shrink-0 text-[11px] leading-tight">{n.rotulo}</span>
                    <span className="h-2 rounded-r bg-[#009485] dark:bg-[#16a090]" style={{ width: `${pct(n.total, Math.max(1, m.pessoas.ativos))}%`, minWidth: 3 }} />
                    <span className="tabular-nums">{n.total}</span>
                  </li>
                ))}
              </ul>
              {m.motivosSaida.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300">Motivos de saída (últimos 3 meses)</p>
                  <ul className="flex flex-col gap-0.5 text-[12px] text-gray-600 dark:text-gray-400">
                    {m.motivosSaida.map((x) => (
                      <li key={x.motivo} className="flex justify-between gap-3">
                        <span className="first-letter:uppercase">{x.motivo}</span>
                        <span className="tabular-nums">{x.total}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.detalhes && (
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="text-[10px] text-gray-500 uppercase dark:text-gray-400">
                      <tr>
                        <th className="py-1 pr-2 font-semibold">Turma</th>
                        <th className="py-1 pr-2 font-semibold">Dia</th>
                        <th className="py-1 pr-2 text-right font-semibold">Alunos</th>
                        <th className="py-1 text-right font-semibold">Instr.</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {p.detalhes.turmas.map((t) => (
                        <tr key={t.turma} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-1 pr-2">{t.turma}</td>
                          <td className="py-1 pr-2 capitalize">
                            {t.dia} {t.horario}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums">{t.alunos}</td>
                          <td className={`py-1 text-right tabular-nums ${t.instrutores === 0 ? "font-semibold text-na-danger-dark dark:text-red-300" : ""}`}>{t.instrutores}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          }
        >
          <div className="grid grid-cols-3 gap-3">
            <Numero valor={m.pessoas.ativos} rotulo="ativos" />
            <Numero valor={m.pessoas.membros} rotulo="membros (2º nível+)" />
            <Numero valor={mesAtual ? `${mesAtual.entradas - mesAtual.saidas >= 0 ? "+" : ""}${mesAtual.entradas - mesAtual.saidas}` : "—"} rotulo={mesAtual ? `${mesAtual.entradas} entradas · ${mesAtual.saidas} saídas no mês` : "saldo do mês"} />
          </div>
          <div>
            <div className="flex h-20 items-end gap-1 border-b border-gray-200 dark:border-gray-700" role="img" aria-label="Entradas e saídas nos últimos 12 meses">
              {m.meses.map((x) => (
                <div key={x.mes} className="flex h-full flex-1 items-end justify-center gap-[2px]" title={`${rotuloMes(x.mes)}: ${x.entradas} entradas, ${x.saidas} saídas`}>
                  <div className={`w-1/2 max-w-3 rounded-t ${COR_ENTRADA}`} style={{ height: `${(x.entradas / maxMov) * 100}%`, minHeight: x.entradas ? 2 : 0 }} />
                  <div className={`w-1/2 max-w-3 rounded-t ${COR_SAIDA}`} style={{ height: `${(x.saidas / maxMov) * 100}%`, minHeight: x.saidas ? 2 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-sm ${COR_ENTRADA}`} /> Entradas
              </span>
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-sm ${COR_SAIDA}`} /> Saídas
              </span>
              <span>últimos 12 meses</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ["FV", m.pessoas.fv],
              ["Provacionistas", m.pessoas.provacionistas],
              ["HD", m.pessoas.hd],
              ["Dirigentes", m.pessoas.dirigentes],
            ].map(([r, v]) => (
              <div key={r as string}>
                <p className="text-lg font-black text-gray-900 tabular-nums dark:text-gray-100">{v}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">{r}</p>
              </div>
            ))}
          </div>
          <ul className="flex flex-col gap-1 text-[12px] text-gray-700 dark:text-gray-300">
            <li className="flex justify-between gap-3">
              <span>Turmas no Mercúrio</span>
              <strong className="tabular-nums">
                {m.turmas.total} · {m.turmas.alunos} alunos
              </strong>
            </li>
            <li className="flex justify-between gap-3">
              <span>Turmas sem instrutor</span>
              <strong className={`tabular-nums ${m.turmas.semInstrutor ? "text-na-danger-dark dark:text-red-300" : ""}`}>{m.turmas.semInstrutor}</strong>
            </li>
            <li className="flex justify-between gap-3">
              <span>Pedidos de cadastro e pendências</span>
              <strong className="tabular-nums">{p.portal.pedidosCadastro + p.portal.pendencias}</strong>
            </li>
            {p.detalhes?.avaliacao && (
              <li className="flex justify-between gap-3">
                <span>Avaliação dos instrutores ({p.detalhes.avaliacao.aberta ? "aberta" : "encerrada"})</span>
                <strong className="tabular-nums">
                  {p.detalhes.avaliacao.participantes} resp. · nota {p.detalhes.avaliacao.mediaInstrutores?.toFixed(1) ?? "—"}
                </strong>
              </li>
            )}
          </ul>
        </Area>

        <div className="flex min-w-0 flex-col gap-5">
          <Area titulo="Eventos" icone={CalendarDays} href={link("/voluntario/eventos")}>
            <div className="grid grid-cols-3 gap-3">
              <Numero valor={p.eventos.proximos} rotulo="nos próximos 30 dias" />
              <Numero valor={p.eventos.inscritosProximos} rotulo="inscritos pelo Portal" />
              <Numero valor={p.eventos.inscritosPassados ? `${pct(p.eventos.presencaPassados, p.eventos.inscritosPassados)}%` : "—"} rotulo="presença (últimos 30 dias)" />
            </div>
            {p.eventos.lista.length > 0 && (
              <ul className="flex flex-col gap-1 text-[12px] text-gray-700 dark:text-gray-300">
                {p.eventos.lista.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="tabular-nums text-gray-500 dark:text-gray-400">{new Date(e.inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}</span> {e.titulo}
                      {varias && <span className="text-gray-500 dark:text-gray-400"> · {e.filial}</span>}
                    </span>
                    {e.inscritos !== null && <span className="shrink-0 tabular-nums">{e.inscritos}{e.vagas ? `/${e.vagas}` : ""}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Area>

          <Area titulo="Abertura de turmas" icone={BookOpenText} href={link("/voluntario/aberturas")}>
            <div className="grid grid-cols-3 gap-3">
              <Numero valor={p.aberturas.ativas} rotulo="aberturas planejadas ou em curso" />
              <Numero valor={p.aberturas.interessados.toLocaleString("pt-BR")} rotulo="na base de interessados (desde o início)" />
              <Numero valor={p.aberturas.matriculas.toLocaleString("pt-BR")} rotulo="matrículas vindas de interessados" />
            </div>
          </Area>
        </div>

        <Area titulo="Voluntariado e grupos" icone={HandHeart} href={link("/grupos")}>
          <div className="grid grid-cols-3 gap-3">
            <Numero valor={p.voluntariado.acessos} rotulo="voluntários com acesso liberado" />
            <Numero valor={p.voluntariado.secretarias} rotulo="secretarias no Portal" />
            <Numero valor={p.voluntariado.gaf + p.voluntariado.estudos} rotulo="GAF, estudos e leituras" />
          </div>
          <p className="text-[12px] text-gray-600 dark:text-gray-400">
            {p.voluntariado.gaf} GAF · {p.voluntariado.estudos} grupos de estudo e leituras · {p.voluntariado.fv} grupos de FV · {p.voluntariado.gdve} GDVE
          </p>
        </Area>

        <Area titulo="Portal e comunicação" icone={Smartphone} href={link("/voluntario/acessos")}>
          <div className="grid grid-cols-3 gap-3">
            <Numero valor={p.portal.entraram} rotulo={`já entraram no Portal (${pct(p.portal.entraram, m.pessoas.ativos)}% dos ativos)`} />
            <Numero valor={p.portal.notificacoes} rotulo="com notificações ativas" />
            <Numero valor={p.portal.contas} rotulo="contas criadas" />
          </div>
          {p.portal.falhas > 0 && <p className="text-[12px] text-na-danger-dark dark:text-red-300">{p.portal.falhas} envio(s) ao Mercúrio com falha.</p>}
          <Link href={`/voluntario/filial/uso${alcance.chave.includes(",") ? `?filiais=${alcance.chave}` : `?alcance=${alcance.chave}`}`} className="flex w-fit items-center gap-0.5 text-[12px] font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
            Ver quem usa e quem não usa <ChevronRight size={13} />
          </Link>
        </Area>

        <Area
          titulo="Economia"
          icone={Wallet}
          largo
          href={link("/economia")}
          detalhes={financeiro}
        >
          <div className="grid grid-cols-3 gap-3">
            <Numero valor={`${pct(c.paga, fichas)}%`} rotulo={`contribuições pagas no mês (${c.paga} de ${fichas})`} />
            <Numero valor={c.pessoasComAtraso} rotulo="pessoas com atraso no ano" destaque={c.pessoasComAtraso ? "alerta" : undefined} />
            <Numero valor={formatBRL(recAtual?.valor ?? 0)} rotulo={recAnt ? `recebido no mês (anterior: ${formatBRL(recAnt.valor)})` : "recebido no mês"} />
          </div>
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Situação das contribuições do mês">
            {[
              [c.paga, "bg-na-success"],
              [c.emBranco, hojeDia > DIA_LIMITE_DESCONTO ? "bg-na-warning" : "bg-gray-300 dark:bg-gray-600"],
              [c.isenta, "bg-gray-200 dark:bg-gray-700"],
            ].map(([v, cls], i) => ((v as number) > 0 ? <span key={i} className={cls as string} style={{ width: `${((v as number) / fichas) * 100}%` }} /> : null))}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Pagas {c.paga} · em aberto {c.emBranco} · isentas {c.isenta}. Pago até o dia {DIA_LIMITE_DESCONTO}: com desconto.
          </p>
        </Area>
      </div>

      {p.detalhes && p.detalhes.aniversariantes.length > 0 && (
        <details className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-gray-700 dark:text-gray-300">
            <Cake size={15} /> Aniversariantes do mês ({p.detalhes.aniversariantes.length})
          </summary>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {p.detalhes.aniversariantes.map((a) => (
              <li key={a.matricula} className={`flex justify-between gap-3 rounded-lg px-2 py-1 text-[12px] ${a.dia >= hojeDia && a.dia < hojeDia + 7 ? "bg-na-gold/15" : ""}`}>
                <span className="truncate">{a.nome}</span>
                <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">dia {a.dia}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {varias && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-[13px] font-bold tracking-wide text-gray-700 uppercase dark:text-gray-300">Por filial</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead className="text-[10px] text-gray-500 uppercase dark:text-gray-400">
                <tr>
                  {["Filial", "Ativos", "Entradas/saídas no mês", "Pagas no mês", "Eventos (30 dias)", "Aberturas", "Grupos", "Voluntários", "Entraram no Portal"].map((h, i) => (
                    <th key={h} className={`py-1.5 pr-3 font-semibold ${i ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-gray-800 tabular-nums dark:text-gray-200">
                {p.porFilial.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50">
                    <td className="py-1.5 pr-3">
                      <Link href={`${base}?alcance=${f.id}`} className="font-semibold text-na-green-dark hover:underline dark:text-emerald-400">
                        {f.nome}
                      </Link>
                      {f.foraDoPortal && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">fora do Portal</span>}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{f.ativos ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right">{f.entradas === null ? "—" : `${f.entradas}/${f.saidas}`}</td>
                    <td className="py-1.5 pr-3 text-right">{f.pagaPct === null ? "—" : `${f.pagaPct}%`}</td>
                    <td className="py-1.5 pr-3 text-right">{f.eventos}</td>
                    <td className="py-1.5 pr-3 text-right">{f.aberturas}</td>
                    <td className="py-1.5 pr-3 text-right">{f.grupos}</td>
                    <td className="py-1.5 pr-3 text-right">{f.voluntarios}</td>
                    <td className="py-1.5 text-right">{f.entraram}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <summary className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-gray-700 dark:text-gray-300">
          <Briefcase size={15} /> Profissões e áreas de atuação
        </summary>
        <div className="mt-3">
          {p.profissoes ? (
            <PainelProfissoes dados={p.profissoes} nacional={varias} />
          ) : (
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Disponível depois da próxima sincronização com o Mercúrio (3h30).</p>
          )}
        </div>
      </details>
    </div>
  );
}
