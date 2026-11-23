"""
Vídeo do passo a passo dos membros com narração e trilha (23/11/2026).
Recebe a pasta com os quadros q0.png..q7.png (gerados por scripts/gerar-guia-membros.ts) e grava public/guia-membros.mp4.
 - Narração: voz neural pt-BR (edge-tts, pt-BR-FranciscaNeural). Só o texto do roteiro abaixo sai da máquina.
 - Trilha: composta aqui mesmo (acordes suaves sintetizados), sem direitos de terceiros.
 - Cada tela fica no ar o tempo da fala + uma pausa; transição suave entre telas.
Uso: python scripts/video-guia-membros.py <pasta-dos-quadros> [caminho-do-ffmpeg]
"""
import asyncio
import json
import subprocess
import sys
import wave
from pathlib import Path

import edge_tts
import numpy as np

VOZ = "pt-BR-FranciscaNeural"
ROTEIRO = [
    "Pague sua contribuição pelo Portal da Nova Acrópole. É rápido, e você faz tudo pelo celular.",
    "Primeiro, abra o Portal no celular, pelo endereço que aparece na tela.",
    "Toque em Entrar com a conta Nova Acrópole, e use o e-mail cadastrado na secretaria. Se for a primeira vez, faça o cadastro com esse mesmo e-mail.",
    "Na tela inicial, aparece a sua contribuição. Toque em Pagar agora.",
    "Escolha como pagar. Para Pix, toque em Gerar Pix. Se preferir, pague com cartão de crédito.",
    "Toque em Copiar o código. Depois, abra o app do seu banco, entre em Pix Copia e Cola, cole o código, confira o valor e confirme.",
    "Pronto! O pagamento é registrado sozinho na sua ficha, e o recibo fica no Portal.",
    "Comece agora, pelo endereço na tela, ou baixe o app. Qualquer dúvida, fale com a secretaria da sua escola.",
]
PAUSA_ANTES = 0.6   # segundos de silêncio no começo de cada tela
PAUSA_DEPOIS = 0.9  # depois da fala, antes de trocar de tela
TRANSICAO = 0.5
TAXA = 44100

pasta = Path(sys.argv[1])
FFMPEG = sys.argv[2] if len(sys.argv) > 2 else "ffmpeg"
saida = Path("public/guia-membros.mp4")


def ff(*args):
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", *args], check=True)


def duracao(arquivo: Path) -> float:
    r = subprocess.run([FFMPEG, "-i", str(arquivo)], capture_output=True, text=True)
    linha = next(l for l in r.stderr.splitlines() if "Duration" in l)
    h, m, s = linha.split("Duration:")[1].split(",")[0].strip().split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


async def narrar():
    for i, texto in enumerate(ROTEIRO):
        await edge_tts.Communicate(texto, VOZ, rate="-5%").save(str(pasta / f"fala{i}.mp3"))


def trilha(segundos: float, destino: Path):
    """Acordes suaves (Dó, Lá menor, Fá, Sol), com ataque lento, um arpejo leve e entrada/saída graduais."""
    t = np.arange(int(segundos * TAXA)) / TAXA
    acordes = [[261.63, 329.63, 392.00], [220.00, 261.63, 329.63], [174.61, 220.00, 261.63], [196.00, 246.94, 293.66]]
    dur_acorde = 4.0
    som = np.zeros_like(t)
    for k in range(int(np.ceil(segundos / dur_acorde))):
        ini, fim = k * dur_acorde, (k + 1) * dur_acorde + 1.0
        janela = (t >= ini) & (t < fim)
        tt = t[janela] - ini
        env = np.minimum(1, tt / 1.2) * np.minimum(1, np.maximum(0, (fim - ini - tt) / 1.5))
        for f in acordes[k % 4]:
            som[janela] += env * (0.5 * np.sin(2 * np.pi * f / 2 * tt) + 0.25 * np.sin(2 * np.pi * f * tt) + 0.06 * np.sin(2 * np.pi * f * 2 * tt))
        # Arpejo: uma nota por meio segundo, decaindo.
        for j in range(8):
            n0 = ini + j * 0.5
            nota = (t >= n0) & (t < n0 + 0.5) & janela
            tn = t[nota] - n0
            f = acordes[k % 4][j % 3] * 2
            som[nota] += 0.12 * np.exp(-tn * 5) * np.sin(2 * np.pi * f * tn)
    som *= np.minimum(1, t / 2.0) * np.minimum(1, (segundos - t) / 3.0)
    som = som / np.max(np.abs(som)) * 0.9
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes((som * 32767).astype(np.int16).tobytes())


def main():
    asyncio.run(narrar())
    falas = [pasta / f"fala{i}.mp3" for i in range(len(ROTEIRO))]
    tempos = [PAUSA_ANTES + duracao(f) + PAUSA_DEPOIS for f in falas]

    # Narração contínua: cada fala começa PAUSA_ANTES depois do início da sua tela (descontando as transições).
    inicio, filtro, entradas = 0.0, [], []
    for i, f in enumerate(falas):
        entradas += ["-i", str(f)]
        atraso = int((inicio + PAUSA_ANTES) * 1000)
        filtro.append(f"[{i}:a]adelay={atraso}|{atraso}[a{i}]")
        inicio += tempos[i] - TRANSICAO
    total = sum(tempos) - TRANSICAO * (len(tempos) - 1)
    mistura = "".join(f"[a{i}]" for i in range(len(falas)))
    narracao = pasta / "narracao.wav"
    ff(*entradas, "-filter_complex", ";".join(filtro) + f";{mistura}amix=inputs={len(falas)}:normalize=0[n]", "-map", "[n]", "-ar", str(TAXA), "-t", f"{total:.2f}", str(narracao))

    musica = pasta / "trilha.wav"
    trilha(total, musica)

    # Vídeo: quadros com transição, narração por cima da trilha baixa (a trilha abaixa ainda mais quando há fala).
    vids, fv, anterior, desloc = [], "", "[0:v]", 0.0
    for i, s in enumerate(tempos):
        vids += ["-loop", "1", "-t", f"{s:.2f}", "-i", str(pasta / f"q{i}.png")]
    for i in range(1, len(tempos)):
        desloc += tempos[i - 1] - TRANSICAO
        rot = "[v]" if i == len(tempos) - 1 else f"[x{i}]"
        fv += f"{anterior}[{i}:v]xfade=transition=fade:duration={TRANSICAO}:offset={desloc:.2f}{rot};"
        anterior = rot
    n = len(tempos)
    fa = f"[{n + 1}:a]volume=0.22[m];[{n}:a]asplit=2[voz][chave];[m][chave]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[mb];[voz][mb]amix=inputs=2:normalize=0,volume=1.1[a]"
    ff(*vids, "-i", str(narracao), "-i", str(musica), "-filter_complex", fv + fa, "-map", "[v]", "-map", "[a]", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", f"{total:.2f}", str(saida))
    print(json.dumps({"segundos": round(total, 1), "telas": [round(x, 1) for x in tempos]}))


main()
