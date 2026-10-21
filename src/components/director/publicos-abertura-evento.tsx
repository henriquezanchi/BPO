"use client";

import { listarFiliaisParaEventos } from "@/lib/actions/eventos-abertura-actions";
import { ABERTURAS, EVENT_AUDIENCES, REGIONAIS, type Abertura } from "@/lib/event-policy";
import { useEffect, useState } from "react";

const CAIXA = "flex items-center gap-2 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs dark:border-gray-700";

/**
 * Públicos do evento (vários ao mesmo tempo — pedido do usuário 2026-10-19).
 * "Membros" já inclui FV, HD, dirigentes e provacionistas.
 */
export function PublicosEvento({ inicial }: { inicial?: string[] }) {
  const [marcados, setMarcados] = useState<string[]>(inicial?.length ? inicial : ["membros"]);
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs">Quem pode ver e se inscrever? (marque um ou mais)</legend>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EVENT_AUDIENCES).map(([chave, rotulo]) => (
          <label key={chave} className={CAIXA}>
            <input
              type="checkbox"
              name="publicos"
              value={chave}
              checked={marcados.includes(chave)}
              onChange={(e) => setMarcados(e.target.checked ? [...marcados, chave] : marcados.filter((m) => m !== chave))}
            />
            {rotulo}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">&quot;Membros&quot; é do 2º nível em diante e inclui FV, HD, dirigentes e provacionistas. Quem não está no público não vê o evento.</p>
    </fieldset>
  );
}

/** Inscrições de outras filiais: todas, filiais escolhidas, regionais ou estados. */
export function AberturaEvento({ inicial, valoresIniciais }: { inicial?: string; valoresIniciais?: string[] }) {
  const [abertura, setAbertura] = useState<Abertura>((inicial as Abertura) ?? "filial");
  const [valores, setValores] = useState<string[]>(valoresIniciais ?? []);
  const [filiais, setFiliais] = useState<{ id: string; nome: string; uf: string | null }[]>([]);
  useEffect(() => {
    listarFiliaisParaEventos()
      .then(setFiliais)
      .catch(() => {});
  }, []);
  const opcoes: [string, string][] =
    abertura === "filiais"
      ? filiais.map((f) => [f.id, f.nome])
      : abertura === "regionais"
        ? Object.entries(REGIONAIS).map(([k, r]) => [k, r.nome])
        : abertura === "estados"
          ? [...new Set(filiais.map((f) => f.uf).filter((u): u is string => !!u))].sort().map((u) => [u, u])
          : [];
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-xs">
        Inscrições abertas a
        <select
          name="abertoA"
          value={abertura}
          onChange={(e) => {
            setAbertura(e.target.value as Abertura);
            setValores([]);
          }}
          className="w-full min-w-0 rounded-lg border border-gray-300 bg-transparent p-2.5 text-sm dark:border-gray-700"
        >
          {Object.entries(ABERTURAS).map(([k, r]) => (
            <option key={k} value={k}>
              {r}
            </option>
          ))}
        </select>
      </label>
      {opcoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {opcoes.map(([id, rotulo]) => (
            <label key={id} className={CAIXA}>
              <input
                type="checkbox"
                name="abertoValores"
                value={id}
                checked={valores.includes(id)}
                onChange={(e) => setValores(e.target.checked ? [...valores, id] : valores.filter((v) => v !== id))}
              />
              {rotulo}
            </label>
          ))}
        </div>
      )}
      {abertura !== "filial" && <p className="text-[11px] text-gray-500">O público escolhido acima vale também para as outras filiais. O pagamento continua indo para esta filial.</p>}
    </div>
  );
}
