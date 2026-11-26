"""
Vídeo do passo a passo do Portal do Aluno (25/11/2026): telas reais do celular, narração natural e legendas no estilo
do Dédalo (grupos de até 3 palavras, palavra-chave em itálico serifado dourado, entrada com leve "pop"), dentro do
guia da marca (verde Nova Acrópole, Amarelo Helios, Noto Sans).
 - Telas: docs/guias/telas-tutorial/*.png (scripts/capturar-telas-tutorial.ts).
 - Narração: voz neural pt-BR (edge-tts, pt-BR-FranciscaNeural) com o tempo de cada palavra, para sincronizar as legendas.
 - Trilha: acordes suaves sintetizados aqui mesmo, sem direitos de terceiros.
 - Legendas: arquivo ASS queimado pelo ffmpeg com as fontes do Dédalo.
Saída: public/guia-portal.mp4 (1080×1920) e public/guia-portal.srt.
Uso: python scripts/video-tutorial.py [caminho-do-ffmpeg] [alunos|voluntarios]
Perfil "voluntarios": telas de docs/guias/telas-voluntarios (scripts/capturar-telas-voluntarios.ts) -> public/guia-voluntarios.mp4.
"""
import asyncio
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
PERFIL = sys.argv[2] if len(sys.argv) > 2 else "alunos"
TELAS = RAIZ / ("docs/guias/telas-voluntarios" if PERFIL == "voluntarios" else "docs/guias/telas-tutorial")
TRAB = TELAS / "_video"
FONTES = Path(r"C:/Users/Henrique Zanchi/Apps/editor-reels-na/motor/recursos/fontes")
FFMPEG = sys.argv[1] if len(sys.argv) > 1 else "ffmpeg"
SAIDA = RAIZ / ("public/guia-voluntarios.mp4" if PERFIL == "voluntarios" else "public/guia-portal.mp4")
VOZ = "pt-BR-FranciscaNeural"
TAXA = 44100
W, H = 1080, 1920
VERDE, VERDE_ESCURO, DOURADO, BRANCO = "#086357", "#053f37", "#ffca00", "#ffffff"
CENTRO_LEGENDA_Y = 1560  # como os perfis verticais do Dédalo (1400–1425), um pouco abaixo por causa do celular

# (imagem ou None para cartão, texto da narração)
ROTEIRO = [
    (None, "Este é o Portal do Aluno da Nova Acrópole. Em dois minutos você vê como entrar e o que dá para fazer por ele."),
    ("01-entrar", "Para entrar, abra o endereço do Portal no celular e toque em Entrar com a conta Nova Acrópole."),
    ("02-login-acropole", "Use o e-mail que está no seu cadastro na secretaria. Se for a primeira vez, toque em Cadastre-se com esse mesmo e-mail. Esqueceu a senha? Tem o link ali mesmo."),
    ("03-inicio", "Esta é a tela inicial. No alto, o seu cartão, com Meus dados e a Carteirinha. Abaixo, uma busca e os atalhos do dia a dia."),
    ("04-pagamentos", "Em Pagamentos você vê a sua contribuição, paga pelo Pix na hora e baixa o comprovante de qualquer mês."),
    ("05-carteirinha", "A Carteirinha digital identifica você na escola e no café. É só mostrar o QR code."),
    ("06-agenda", "Em Agenda e Eventos estão as aulas, os encontros e os eventos da sua escola. Toque para se inscrever."),
    ("07-fortuna", "A carteira Fortuna guarda o seu crédito para o café. Adicione créditos pelo Pix e pague pela carteirinha ou pelo nome."),
    ("08-estudos", "Na Área de Estudos ficam a biblioteca, os seus livros e as anotações das aulas."),
    ("09-meus-dados", "Em Meus dados você confere o cadastro, coloca a sua foto e corrige contato ou endereço. Vale na hora."),
    ("10-app", "Prefere um app? No Android, toque em Baixar o app. No iPhone, adicione o Portal à tela de início pelo Safari."),
    ("11-ajuda", "Ficou com dúvida? A Central de Ajuda responde as perguntas mais comuns, e a secretaria está a um toque no WhatsApp."),
    (None, "Entre hoje mesmo pelo endereço na tela. Nos vemos no Portal."),
]
ROTEIRO_VOLUNTARIOS = [
    (None, "Este é o passo a passo da Área do Voluntário do Portal da Nova Acrópole. Em dois minutos você vê onde fica cada coisa do seu trabalho na escola."),
    ("01-inicio-aluno", "Entre no Portal como sempre. No cartão do topo, toque em Área do Voluntário. O botão aparece para quem tem função, secretaria ou grupo na filial."),
    ("02-voluntario", "Esta é a sua tela de trabalho. No alto, os seus grupos, secretarias e próximos encontros. Abaixo, os atalhos em três blocos: Meu trabalho, Secretarias e Gestão da filial. Cada pessoa vê só o que faz parte do seu papel."),
    ("03-grupos", "Em Grupos ficam os GAFs, os grupos de estudo e os de Formação Viva. Marque presenças, registre o que foi feito no encontro e mande a programação para o WhatsApp."),
    ("04-calendario", "O Calendário reúne aulas, reuniões, eventos e feriados da filial, para todo mundo enxergar a mesma agenda."),
    ("05-oportunidades", "Em Oportunidades a filial publica o que precisa, e quem se oferece aparece aqui para você responder."),
    ("06-secretarias", "Em Secretarias da filial estão os responsáveis, as equipes e as atividades de cada secretaria."),
    ("07-eventos", "Quem é da Secretaria de Eventos cria e acompanha os eventos por aqui: inscrições, cartaz e recepção."),
    ("08-cafe", "O Café é o caixa Fortuna: lançar o consumo pela carteirinha ou pelo nome, e acompanhar o dia."),
    ("09-trajetoria", "Minha trajetória traz as suas funções, distinções e marcos registrados no Mercúrio."),
    ("10-termo", "E o Termo de voluntariado mostra como assinar o termo com a sua filial."),
    (None, "Explore a sua Área do Voluntário. Se faltar algo para a sua função, fale com a direção da filial."),
]
if PERFIL == "voluntarios":
    ROTEIRO = ROTEIRO_VOLUNTARIOS
PAUSA_ANTES, PAUSA_DEPOIS, TRANSICAO = 0.5, 0.8, 0.5
PAUSA_FECHA_GRUPO = 0.5
FIM_APOS_ULTIMA = 0.45


def ff(*args):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", *args], check=True)


def duracao(arquivo: Path) -> float:
    r = subprocess.run([FFMPEG, "-i", str(arquivo)], capture_output=True, text=True)
    linha = next(l for l in r.stderr.splitlines() if "Duration" in l)
    h, m, s = linha.split("Duration:")[1].split(",")[0].strip().split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


# ───────── narração com o tempo de cada palavra ─────────
async def narrar_um(i: int, texto: str):
    com = edge_tts.Communicate(texto, VOZ, rate="-4%", boundary="WordBoundary")
    audio, palavras = bytearray(), []
    async for parte in com.stream():
        if parte["type"] == "audio":
            audio += parte["data"]
        elif parte["type"] == "WordBoundary":
            palavras.append({"t": parte["text"], "ini": parte["offset"] / 1e7, "fim": (parte["offset"] + parte["duration"]) / 1e7})
    # O serviço devolve as palavras sem pontuação; recupera a pontuação do texto original (fecha grupo no fim da frase).
    pos = 0
    for w in palavras:
        k = texto.find(w["t"], pos)
        if k < 0:
            continue
        k += len(w["t"])
        while k < len(texto) and texto[k] in ".,!?;:":
            w["t"] += texto[k]; k += 1
        pos = k
    (TRAB / f"fala{i}.mp3").write_bytes(audio)
    (TRAB / f"fala{i}.json").write_text(json.dumps(palavras, ensure_ascii=False), encoding="utf-8")


async def narrar():
    for i, (_, texto) in enumerate(ROTEIRO):
        await narrar_um(i, texto)


# ───────── trilha ─────────
def trilha(segundos: float, destino: Path):
    t = np.arange(int(segundos * TAXA)) / TAXA
    acordes = [[261.63, 329.63, 392.00], [220.00, 261.63, 329.63], [174.61, 220.00, 261.63], [196.00, 246.94, 293.66]]
    dur = 4.0
    som = np.zeros_like(t)
    for k in range(int(np.ceil(segundos / dur))):
        ini, fim = k * dur, (k + 1) * dur + 1.0
        j = (t >= ini) & (t < fim)
        tt = t[j] - ini
        env = np.minimum(1, tt / 1.2) * np.minimum(1, np.maximum(0, (fim - ini - tt) / 1.5))
        for f in acordes[k % 4]:
            som[j] += env * (0.5 * np.sin(2 * np.pi * f / 2 * tt) + 0.25 * np.sin(2 * np.pi * f * tt) + 0.06 * np.sin(2 * np.pi * f * 2 * tt))
        for n in range(8):
            n0 = ini + n * 0.5
            nota = (t >= n0) & (t < n0 + 0.5) & j
            tn = t[nota] - n0
            som[nota] += 0.12 * np.exp(-tn * 5) * np.sin(2 * np.pi * acordes[k % 4][n % 3] * 2 * tn)
    som *= np.minimum(1, t / 2.0) * np.minimum(1, (segundos - t) / 3.0)
    som = som / np.max(np.abs(som)) * 0.9
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(TAXA)
        w.writeframes((som * 32767).astype(np.int16).tobytes())


# ───────── quadros ─────────
def fundo() -> Image.Image:
    im = Image.new("RGB", (W, H), VERDE_ESCURO)
    d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / H
        c = tuple(int(a + (b - a) * k) for a, b in zip((5, 63, 55), (3, 7, 18)))
        d.line([(0, y), (W, y)], fill=c)
    # Brilho suave no alto.
    luz = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(luz).ellipse([-200, -500, W + 200, 700], fill=(8, 99, 87))
    luz = luz.filter(ImageFilter.GaussianBlur(220))
    return Image.blend(im, Image.composite(luz, im, luz.convert("L")), 0.7)


def fonte(nome: str, px: int):
    return ImageFont.truetype(str(FONTES / nome), px)


def logo() -> Image.Image | None:
    p = RAIZ / "public/na-logo.png"
    if not p.exists():
        return None
    im = Image.open(p).convert("RGBA")
    # Logo branca sobre o verde.
    r, g, b, a = im.split()
    return Image.merge("RGBA", (Image.new("L", im.size, 255), Image.new("L", im.size, 255), Image.new("L", im.size, 255), a))


def arredondar(im: Image.Image, raio: int) -> Image.Image:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], raio, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def quadro_tela(nome: str, destino: Path):
    base = fundo()
    tela = Image.open(TELAS / f"{nome}.png").convert("RGB")
    alt = 1250
    larg = round(tela.width * alt / tela.height)
    tela = arredondar(tela.resize((larg, alt), Image.LANCZOS), 54)
    x, y = (W - larg) // 2, 130
    sombra = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle([x - 6, y + 18, x + larg + 6, y + alt + 30], 60, fill=(0, 0, 0, 140))
    sombra = sombra.filter(ImageFilter.GaussianBlur(28))
    base = Image.alpha_composite(base.convert("RGBA"), sombra)
    # Moldura fina dourada.
    ImageDraw.Draw(base).rounded_rectangle([x - 4, y - 4, x + larg + 4, y + alt + 4], 58, outline=DOURADO, width=3)
    base.alpha_composite(tela, (x, y))
    base.convert("RGB").save(destino)


def quadro_cartao(titulo: str, sub: str, destino: Path, rodape: str | None = None):
    base = fundo().convert("RGBA")
    lg = logo()
    if lg:
        lw = 520
        lg = lg.resize((lw, round(lg.height * lw / lg.width)), Image.LANCZOS)
        base.alpha_composite(lg, ((W - lw) // 2, 520))
    d = ImageDraw.Draw(base)
    f1, f2 = fonte("NotoSans-Black.ttf", 92), fonte("NotoSans-SemiBold.ttf", 44)
    d.text((W / 2, 980), titulo, font=f1, fill=DOURADO, anchor="mm")
    d.text((W / 2, 1080), sub, font=f2, fill=BRANCO, anchor="mm")
    if rodape:
        d.text((W / 2, 1300), rodape, font=fonte("NotoSans-SemiBold.ttf", 40), fill=DOURADO, anchor="mm")
    base.convert("RGB").save(destino)


# ───────── legendas (estilo Dédalo) ─────────
def e_data_hora(t: str) -> bool:
    return bool(re.search(r"\d", t))


def grupos_de(palavras: list[dict]) -> list[list[int]]:
    """Grupos de até 3 palavras; fecham em pausa >= 0,5 s ou fim de frase."""
    grupos, atual = [], []
    for i, p in enumerate(palavras):
        atual.append(i)
        ultima = i == len(palavras) - 1
        fim_frase = p["t"].rstrip("\"'”’)»").endswith((".", "!", "?"))
        if ultima or len(atual) == 3 or fim_frase or palavras[i + 1]["ini"] - p["fim"] >= PAUSA_FECHA_GRUPO:
            grupos.append(atual); atual = []
    return grupos


def ass_escape(t: str) -> str:
    return t.replace("{", "(").replace("}", ")")


def tempo_ass(s: float) -> str:
    h = int(s // 3600); m = int(s % 3600 // 60); sec = s % 60
    return f"{h:d}:{m:02d}:{sec:05.2f}"


def tempo_srt(s: float) -> str:
    h = int(s // 3600); m = int(s % 3600 // 60); sec = int(s % 60); ms = int(round((s - int(s)) * 1000))
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def gerar_legendas(inicios: list[float]) -> tuple[str, str]:
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Fala,Noto Sans SemiBold,70,&H00FFFFFF,&H00FFFFFF,&H64000000,&H96000000,0,0,0,0,100,100,0,0,1,2,6,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    eventos, srt, n = [], [], 1
    for i, (_, _texto) in enumerate(ROTEIRO):
        palavras = json.loads((TRAB / f"fala{i}.json").read_text(encoding="utf-8"))
        base = inicios[i] + PAUSA_ANTES
        grupos = grupos_de(palavras)
        for k, g in enumerate(grupos):
            ini = base + palavras[g[0]]["ini"]
            fim = base + palavras[g[-1]]["fim"] + FIM_APOS_ULTIMA
            if k + 1 < len(grupos):
                fim = min(fim, base + palavras[grupos[k + 1][0]]["ini"])
            chave = max(g, key=lambda j: len(palavras[j]["t"]))
            partes = []
            for j in g:
                t = ass_escape(palavras[j]["t"])
                if j == chave:
                    cor = "&H0080DE4A&" if e_data_hora(t) else "&H0000CAFF&"  # verde-claro para números, dourado Helios no resto
                    partes.append("{\\fnNoto Serif\\i1\\fs81\\c" + cor + "}" + t + "{\\r}")
                else:
                    partes.append(t)
            texto = " ".join(partes)
            anim = "{\\an5\\pos(540," + str(CENTRO_LEGENDA_Y) + ")\\fad(80,0)\\fscx82\\fscy82\\t(0,140,\\fscx100\\fscy100)}"
            eventos.append(f"Dialogue: 0,{tempo_ass(ini)},{tempo_ass(fim)},Fala,,0,0,0,,{anim}{texto}")
            srt.append(f"{n}\n{tempo_srt(ini)} --> {tempo_srt(fim)}\n{' '.join(palavras[j]['t'] for j in g)}\n"); n += 1
    return cab + "\n".join(eventos) + "\n", "\n".join(srt)


def main():
    TRAB.mkdir(parents=True, exist_ok=True)
    asyncio.run(narrar())
    falas = [TRAB / f"fala{i}.mp3" for i in range(len(ROTEIRO))]
    tempos = [PAUSA_ANTES + duracao(f) + PAUSA_DEPOIS for f in falas]

    # Quadros.
    for i, (img, _) in enumerate(ROTEIRO):
        dest = TRAB / f"q{i}.png"
        if img:
            quadro_tela(img, dest)
        elif i == 0:
            quadro_cartao("Área do Voluntário" if PERFIL == "voluntarios" else "Portal do Aluno", "Onde fica cada coisa do seu trabalho" if PERFIL == "voluntarios" else "Passo a passo para entrar e usar", dest)
        else:
            quadro_cartao("Até o Portal", "Entre pelo endereço da sua escola", dest, "portal-na-one.vercel.app" + ("/voluntario" if PERFIL == "voluntarios" else ""))

    # Narração contínua e início de cada tela.
    inicio, inicios, filtro, entradas = 0.0, [], [], []
    for i, f in enumerate(falas):
        inicios.append(inicio)
        entradas += ["-i", str(f)]
        atraso = int((inicio + PAUSA_ANTES) * 1000)
        filtro.append(f"[{i}:a]adelay={atraso}|{atraso}[a{i}]")
        inicio += tempos[i] - TRANSICAO
    total = sum(tempos) - TRANSICAO * (len(tempos) - 1)
    mistura = "".join(f"[a{i}]" for i in range(len(falas)))
    narracao = TRAB / "narracao.wav"
    ff(*entradas, "-filter_complex", ";".join(filtro) + f";{mistura}amix=inputs={len(falas)}:normalize=0[n]", "-map", "[n]", "-ar", str(TAXA), "-t", f"{total:.2f}", str(narracao))
    musica = TRAB / "trilha.wav"
    trilha(total, musica)

    ass, srt = gerar_legendas(inicios)
    (TRAB / "legendas.ass").write_text(ass, encoding="utf-8")
    SAIDA.with_suffix(".srt").write_text(srt, encoding="utf-8")

    vids, fv, anterior, desloc = [], "", "[0:v]", 0.0
    for i, s in enumerate(tempos):
        vids += ["-loop", "1", "-t", f"{s:.2f}", "-i", str(TRAB / f"q{i}.png")]
    for i in range(1, len(tempos)):
        desloc += tempos[i - 1] - TRANSICAO
        rot = "[vx]" if i == len(tempos) - 1 else f"[x{i}]"
        fv += f"{anterior}[{i}:v]xfade=transition=fade:duration={TRANSICAO}:offset={desloc:.2f}{rot};"
        anterior = rot
    ass_path = str(TRAB / "legendas.ass").replace("\\", "/").replace(":", "\\:")
    fontsdir = str(FONTES).replace("\\", "/").replace(":", "\\:")
    fv += f"[vx]subtitles='{ass_path}':fontsdir='{fontsdir}'[v];"
    n = len(tempos)
    fa = f"[{n + 1}:a]volume=0.2[m];[{n}:a]asplit=2[voz][chave];[m][chave]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[mb];[voz][mb]amix=inputs=2:normalize=0,volume=1.1[a]"
    ff(*vids, "-i", str(narracao), "-i", str(musica), "-filter_complex", fv + fa, "-map", "[v]", "-map", "[a]", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(SAIDA))
    print(json.dumps({"segundos": round(total, 1), "telas": [round(x, 1) for x in tempos], "saida": str(SAIDA)}))


main()
