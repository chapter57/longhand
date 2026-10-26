"""Plays music for the reels, as audio files in assets/music/.

The pieces are written out here note by note and played on a simple
synthesized piano, so the recording is ours. The music itself has to be in
the public domain.

    python .github/reels/music.py      (needs numpy; ffmpeg makes the .m4a)
"""
import os
import subprocess
import wave

import numpy as np

RATE = 44100
NOTES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def freq(name):
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTES[pitch] + 12 * (octave + 1) - 69) / 12)


def piano(f, length, vel):
    """One note: a few decaying harmonics, slightly out of tune with each other, like a piano string."""
    t = np.arange(int(RATE * (length + 2.5))) / RATE
    tone = np.zeros_like(t)
    for k in range(1, 9):
        fk = f * k * (1 + 0.0004 * k * k)
        decay = (0.9 + 0.35 * k) * (f / 260) ** 0.35
        tone += (1 / k ** 1.6) * np.exp(-decay * t) * (np.sin(2 * np.pi * fk * t) + 0.5 * np.sin(2 * np.pi * fk * 1.0012 * t))
    attack = np.clip(t / 0.006, 0, 1)
    # the key is let go at the end of the note, softened as if the pedal were down
    release = np.where(t < length, 1.0, np.exp(-(t - length) * 2.2))
    return vel * tone * attack * release


def render(score, seconds, bpm):
    beat = 60 / bpm
    out = np.zeros(int(RATE * (seconds + 3)))
    for start, dur, name, vel in score:
        n = piano(freq(name), dur * beat, vel)
        i = int(start * beat * RATE)
        n = n[: len(out) - i]
        out[i:i + len(n)] += n
    # a little room around it
    ir_t = np.arange(int(RATE * 1.6)) / RATE
    ir = np.random.default_rng(1).standard_normal(len(ir_t)) * np.exp(-ir_t * 3.2)
    wet = np.convolve(out, ir)[: len(out)]
    wet /= np.abs(wet).max() or 1
    mix = out / (np.abs(out).max() or 1) + 0.18 * wet
    mix = mix[: int(RATE * seconds)]
    fade = int(RATE * 2.5)
    mix[-fade:] *= np.linspace(1, 0, fade) ** 2
    mix *= 0.7 / np.abs(mix).max()
    left = mix + 0.06 * np.roll(wet[: len(mix)], 300)
    right = mix + 0.06 * np.roll(wet[: len(mix)], 700)
    return np.stack([left, right], axis=1)


def gymnopedie1():
    """Erik Satie, Gymnopédie No. 1 (1888): the opening, slow and grave.
    The left hand rocks between G major 7 and D major 7; the melody enters
    in the third bar."""
    score = []
    chords = [("G2", ["B3", "D4", "F#4"]), ("D2", ["A3", "C#4", "F#4"])]
    for bar in range(8):
        bass, chord = chords[bar % 2]
        s = bar * 3
        score.append((s, 1, bass, 0.55))
        for c in chord:
            score.append((s + 1, 2, c, 0.22))
    melody = [(7, 1, "F#5"), (8, 1, "A5"), (9, 1, "G5"), (10, 1, "F#5"), (11, 1, "C#5"),
              (12, 1, "B4"), (13, 1, "C#5"), (14, 1, "D5"), (15, 3, "A4"), (18, 6, "F#4")]
    for s, d, n in melody:
        score.append((s, d, n, 0.42))
    return render(score, seconds=21, bpm=72)


def save(name, audio):
    os.makedirs("assets/music", exist_ok=True)
    wav = f"/tmp/{name}.wav"
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "160k", f"assets/music/{name}.m4a"], check=True)
    os.remove(wav)
    print("played", name)


if __name__ == "__main__":
    save("gymnopedie-1", gymnopedie1())
