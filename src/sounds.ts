export class SoundManager {
  private ambientAudio: HTMLAudioElement | null = null;
  private isMuted = false;
  private currentAmbientTrack = 1;
  private sfxVolume = 0.6;
  private ambientVolume = 0.35;

  constructor() {
    this.initAmbient(1);
  }

  private initAmbient(trackNum: number): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }
    this.currentAmbientTrack = trackNum;
    this.ambientAudio = new Audio(`./assets/audio/mu_ambient_${trackNum}.mp3`);
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = this.ambientVolume;
  }

  public playAmbient(trackNum?: number): void {
    if (this.isMuted) return;
    if (trackNum && trackNum !== this.currentAmbientTrack) {
      this.initAmbient(trackNum);
    }
    if (this.ambientAudio) {
      this.ambientAudio.play().catch(() => {});
    }
  }

  public pauseAmbient(): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  public playSfx(name: 'button' | 'choice' | 'inventory' | 'cards'): void {
    if (this.isMuted) return;
    try {
      const audio = new Audio(`./assets/audio/so_${name}_1.mp3`);
      audio.volume = this.sfxVolume;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  public playButton(): void {
    this.playSfx('button');
  }

  public playChoice(): void {
    this.playSfx('choice');
  }

  public playInventory(): void {
    this.playSfx('inventory');
  }

  public playCards(): void {
    this.playSfx('cards');
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

  public getMuted(): boolean {
    return this.isMuted;
  }
}
