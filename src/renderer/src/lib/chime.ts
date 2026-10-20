// A short two-note "pling" when an export finishes (docs/DECISIONS.md #109). Generated, so no audio files.

export function playChime(): void {
  try {
    const context = new AudioContext()
    const notes = [880, 1318.5]
    notes.forEach((frequency, i) => {
      const start = context.currentTime + i * 0.09
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.06, start)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.25)
    })
    setTimeout(() => void context.close(), 600)
  } catch {
    // No audio device: the toast and system notification still show.
  }
}
