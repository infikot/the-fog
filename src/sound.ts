class SoundManager {
  private ambientAudio: HTMLAudioElement | null = null;
  private isMuted = false;

  constructor() {
    this.ambientAudio = new Audio('./ambient.mp3');
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = 0.35;
  }

  public playAmbient(): void {
    if (this.isMuted || !this.ambientAudio) return;
    this.ambientAudio.play().catch(() => {
      // Autoplay policy: will trigger on first user gesture
    });
  }

  public pauseAmbient(): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseAmbient();
    } else {
      this.playAmbient();
    }
    return this.isMuted;
  }
}

export const sounds = new SoundManager();
