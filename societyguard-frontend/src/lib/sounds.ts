"use client";

class SoundService {
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("rakshak_notifications_muted", muted ? "true" : "false");
    }
  }

  isMuted() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("rakshak_notifications_muted");
      if (stored !== null) {
        return stored === "true";
      }
    }
    return this.muted;
  }

  playVisitorSound() {
    if (this.isMuted()) return;
    this.playTone(587.33, 'triangle', 0.15, 0.15); // D5
    setTimeout(() => this.playTone(880, 'triangle', 0.25, 0.15), 100); // A5
  }

  playDeliverySound() {
    if (this.isMuted()) return;
    this.playTone(659.25, 'sine', 0.2, 0.1); // E5
    setTimeout(() => this.playTone(987.77, 'sine', 0.3, 0.1), 120); // B5
  }

  playSOSSound() {
    // SOS alert cannot be muted easily, or is played at maximum prominence
    const ctx = this.getAudioContext();
    if (!ctx) return;
    
    // Play alternating siren tone 8 times
    let count = 0;
    const interval = setInterval(() => {
      if (count >= 10) {
        clearInterval(interval);
        return;
      }
      const freq = count % 2 === 0 ? 880 : 1200; // Alternating siren frequency
      this.playTone(freq, 'sawtooth', 0.25, 0.2);
      count++;
    }, 250);
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    return new AudioContextClass();
  }

  private playTone(frequency: number, type: OscillatorType, duration: number, volume: number) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("[SoundService] Sound failed to play", e);
    }
  }
}

export const sounds = new SoundService();
