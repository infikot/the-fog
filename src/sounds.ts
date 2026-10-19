export class SoundManager {
  private ambientAudio: HTMLAudioElement | null = null;
  private isMuted = false;

  constructor() {
    this.ambientAudio = new Audio('./ambient.mp3');
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = 0.35;
  }

  public playAmbient(): void {
    if (this.isMuted || !this.ambientAudio) return;
    this.ambientAudio.play().catch(() => {});
  }

  public pauseAmbient(): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  public playButton(): void {
    // Subtle tactile click using web audio api
    if (this.isMuted) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {}
  }

  public toggle(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseAmbient();
    } else {
      this.playAmbient();
    }
    return !this.isMuted;
  }
}
