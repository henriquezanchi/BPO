import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = process.cwd(), routeDir = path.join(root, 'src/app/browser-whatsapp-local');
const base = 'http://127.0.0.1:3023';
let server, browser, output = '';
try {
  await mkdir(routeDir);
  await writeFile(path.join(routeDir, 'page.tsx'), await readFile('tests/browser/fixtures/whatsapp-art.tsx.fixture'));
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3023'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-only', SUPABASE_SERVICE_ROLE_KEY: 'test-only', DATABASE_URL: 'postgresql://localhost:1/test', DIRECT_URL: 'postgresql://localhost:1/test' },
  });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (d) => { output = (output + d).slice(-12000); });
  const until = Date.now() + 60000;
  while (true) {
    try { if ((await fetch(base + '/browser-whatsapp-local', { signal: AbortSignal.timeout(15000) })).ok) break; } catch {}
    if (Date.now() > until) throw new Error(output);
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  for (const width of [414, 1365]) {
    const page = await browser.newPage({ viewport: { width, height: 896 }, timezoneId: 'America/Sao_Paulo' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(({ mobile }) => {
      window.opened = []; window.shares = []; window.drawnText = [];
      window.open = (url) => { window.opened.push(url); return null; };
      Object.defineProperty(navigator, 'canShare', { value: () => mobile });
      Object.defineProperty(navigator, 'share', { value: async (data) => {
        if (window.abortShare) throw new DOMException('Cancelado', 'AbortError');
        window.shares.push({ text: data.text, type: data.files[0].type, size: data.files[0].size });
      } });
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) { window.drawnText.push(args[0]); return fillText.apply(this, args); };
    }, { mobile: width === 414 });
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (!url.startsWith(base)) return route.abort();
      if (url.endsWith('/poster-fixture.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="400" height="560" fill="#075c50"/><text x="35" y="140" fill="white" font-size="32">Cartaz original</text></svg>' });
      if (url.endsWith('/poster-ausente.png')) return route.fulfill({ status: 404, body: '' });
      return route.continue();
    });
    await page.goto(base + '/browser-whatsapp-local');
    await page.getByRole('region', { name: 'Sem cartaz', exact: true }).getByRole('button').click();
    const dialog = page.getByRole('dialog', { name: 'Compartilhar no WhatsApp', exact: true });
    await dialog.getByRole('button', { name: 'Compartilhar arte e convite', exact: true }).waitFor();
    assert.equal(await dialog.getByRole('img').evaluate((img) => img.naturalWidth), 1080);
    assert.equal(await dialog.getByRole('img').evaluate((img) => img.naturalHeight), 1350);
    const drawn = await page.evaluate(() => window.drawnText);
    assert.ok(drawn.includes('ENCONTRO DA ESCOLA'));
    assert.ok(!drawn.includes('EVENTO ABERTO AO PÚBLICO'));
    assert.ok(drawn.includes('CONFIRME NO PORTAL'));
    assert.ok(drawn.includes('Entrada gratuita'));
    assert.ok(drawn.some((line) => line.includes('Café compartilhado')));
    const textUrl = new URL(await dialog.getByRole('link', { name: 'Enviar somente o convite' }).getAttribute('href'));
    assert.ok(!textUrl.searchParams.get('text').includes('�'));
    if (width === 414) {
      await dialog.getByRole('button', { name: 'Compartilhar arte e convite', exact: true }).click();
      const shares = await page.evaluate(() => window.shares);
      assert.equal(shares.length, 1); assert.equal(shares[0].type, 'image/png'); assert.ok(shares[0].size > 1000);
      assert.match(shares[0].text, /evento=integracao-teste/);
      await page.evaluate(() => { window.abortShare = true; });
      await dialog.getByRole('button', { name: 'Compartilhar arte e convite', exact: true }).click();
      assert.equal(await dialog.getByRole('status').count(), 0);
    } else {
      const download = page.waitForEvent('download');
      await dialog.getByRole('button', { name: 'Compartilhar arte e convite', exact: true }).click();
      const png = await readFile(await (await download).path());
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.ok((await page.evaluate(() => window.opened[0])).startsWith('https://wa.me/?text='));
      await dialog.getByText(/Arte baixada/).waitFor();
    }
    await page.screenshot({ path: `/tmp/bpo-whatsapp-arte-${width}.png` });
    for (const name of ['Com cartaz', 'Cartaz indisponível']) {
      await dialog.getByRole('button', { name: 'Fechar compartilhamento' }).click();
      await page.getByRole('region', { name, exact: true }).getByRole('button').click();
      await dialog.getByRole('button', { name: 'Compartilhar arte e convite', exact: true }).waitFor();
      assert.equal(await dialog.getByRole('img').evaluate((img) => img.naturalWidth), 1080);
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS ${width}px: PNG sem cartaz, cartaz existente, fallback de imagem e compartilhamento.`);
    await page.close();
  }
} finally {
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
  await rm(routeDir, { recursive: true, force: true });
  await rm(path.join(root, '.next/dev/types'), { recursive: true, force: true });
}
