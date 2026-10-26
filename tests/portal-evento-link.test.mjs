import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function carregar(arquivo, dependencias) {
  const source = fs.readFileSync(new URL(arquivo, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, URL, URLSearchParams, process,
    require: (name) => {
      assert.ok(name in dependencias, `Dependência inesperada: ${name}`);
      return dependencias[name];
    },
  });
  return exports;
}

test('visitante sem sessão mantém o evento no destino do login', async () => {
  const { proxy } = carregar('../src/proxy.ts', {
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    'next/server': { NextResponse: { next: () => ({}), redirect: (url) => url } },
  });
  const url = new URL('https://portal-na-one.vercel.app/portal?evento=integracao-7');
  const destino = await proxy({ url: url.href, nextUrl: url });
  assert.equal(destino.pathname, '/login');
  assert.equal(destino.searchParams.get('next'), '/portal?evento=integracao-7');
});

function pagina(member) {
  return carregar('../src/app/(member)/portal/page.tsx', {
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    '@/components/member/member-portal-client': { MemberPortalClient: 'Portal' },
    '@/components/inactive-member-notice': { InactiveMemberNotice: 'Inativo' },
    '@/lib/auth': { getAuthenticatedMember: async () => member },
    '@/lib/member-data': { getMemberDashboard: async (id) => ({ member: { id } }) },
    '@/lib/boletim-aurora': { ultimaEdicaoAurora: async () => ({ titulo: 'Edição de teste', data: '2026-10-25', link: 'https://acropole.org.br/boletim-aurora/teste/', resumo: '' }) },
    'next/navigation': { redirect: (url) => { throw new Error(url); } },
  }).default;
}
test('checagem de sessão na página também preserva o evento', async () => {
  await assert.rejects(
    pagina(null)({ searchParams: Promise.resolve({ evento: 'integracao-7' }) }),
    (error) => new URL(error.message, 'https://portal.test').searchParams.get('next') === '/portal?evento=integracao-7',
  );
});
test('membro autenticado recebe o evento solicitado junto da própria agenda', async () => {
  const render = await pagina({ id: 'membro-1', mercurioAtivo: true })({ searchParams: Promise.resolve({ evento: 'integracao-7' }) });
  assert.equal(render.type, 'Portal');
  assert.equal(render.props.eventoId, 'integracao-7');
  assert.equal(render.props.dashboard.member.id, 'membro-1');
  assert.equal(render.props.boletim.titulo, 'Edição de teste');
});
