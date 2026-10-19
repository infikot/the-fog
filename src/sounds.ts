export class SoundManager {
  private ambientAudio: HTMLAudioElement | null = null;
  private isMuted = false;
  private sfxVolume = 0.8;
  private ambientVolume = 0.35;
  private sfxPool: Record<string, HTMLAudioElement> = {};

  constructor() {
    this.loadSettings();
    this.preloadSfx();
    this.initAmbient(1);
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('thefog_sound_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
        if (typeof parsed.ambientVolume === 'number') this.ambientVolume = parsed.ambientVolume;
        if (typeof parsed.isMuted === 'boolean') this.isMuted = parsed.isMuted;
      }
    } catch (e) {}
  }

  public saveSettings(): void {
    try {
      localStorage.setItem('thefog_sound_config', JSON.stringify({
        sfxVolume: this.sfxVolume,
        ambientVolume: this.ambientVolume,
        isMuted: this.isMuted
      }));
    } catch (e) {}
  }

  private preloadSfx(): void {
    const sfxList = ['button', 'choice', 'inventory', 'cards'];
    for (const name of sfxList) {
      const a = new Audio(`./assets/audio/so_${name}_1.mp3`);
      a.preload = 'auto';
      this.sfxPool[name] = a;
    }
  }

  private initAmbient(trackNum: number): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
      this.ambientAudio = null;
    }
    this.ambientAudio = new Audio(`./assets/audio/mu_ambient_${trackNum}.mp3`);
    this.ambientAudio.loop = true;
    this.ambientAudio.volume = this.isMuted ? 0 : this.ambientVolume;
  }

  public playAmbient(trackNum = 1): void {
    if (this.isMuted || this.ambientVolume <= 0) return;
    if (!this.ambientAudio) {
      this.initAmbient(trackNum);
    }
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.ambientVolume;
      this.ambientAudio.play().catch(() => {});
    }
  }

  public pauseAmbient(): void {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  public playSfx(name: 'button' | 'choice' | 'inventory' | 'cards'): void {
    if (this.isMuted || this.sfxVolume <= 0) return;
    try {
      const original = this.sfxPool[name];
      if (original) {
        // Fast playback without delay: clone node or reset currentTime
        const audio = original.cloneNode() as HTMLAudioElement;
        audio.volume = this.sfxVolume;
        audio.play().catch(() => {});
      } else {
        const audio = new Audio(`./assets/audio/so_${name}_1.mp3`);
        audio.volume = this.sfxVolume;
        audio.play().catch(() => {});
      }
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

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public setAmbientVolume(vol: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.isMuted ? 0 : this.ambientVolume;
      if (this.ambientVolume > 0 && this.ambientAudio.paused && !this.isMuted) {
        this.ambientAudio.play().catch(() => {});
      } else if (this.ambientVolume === 0) {
        this.ambientAudio.pause();
      }
    }
    this.saveSettings();
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public toggle(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.pauseAmbient();
    } else {
      this.playAmbient();
    }
    this.saveSettings();
    return !this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}
