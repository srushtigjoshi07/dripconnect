/**
 * Web Audio API synthesizer for realistic medical bedside buzzer and alert notifications.
 * Pure client-side generation without external audio dependencies.
 */

class MedicalAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private buzzerIntervalId: number | null = null;
  private isBuzzerRunning = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Bedside buzzer: intermittent medical monitor alert sound (high-pitch pulse)
   */
  public startBedsideBuzzer(enabled: boolean = true, volumeScale: number = 1.0) {
    if (!enabled || this.isBuzzerRunning) return;
    this.isBuzzerRunning = true;

    const playBuzzerPulse = () => {
      try {
        const ctx = this.getContext();
        if (!ctx) return;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now); // A5 tone
        osc.frequency.setValueAtTime(987.77, now + 0.1); // B5 tone

        const peakGain = 0.08 * Math.max(0.1, Math.min(1.5, volumeScale));
        gain.gain.setValueAtTime(peakGain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.26);
      } catch {
        // audio playback blocked or unavailable
      }
    };

    playBuzzerPulse();
    this.buzzerIntervalId = window.setInterval(playBuzzerPulse, 1200);
  }

  public stopBedsideBuzzer() {
    this.isBuzzerRunning = false;
    if (this.buzzerIntervalId !== null) {
      clearInterval(this.buzzerIntervalId);
      this.buzzerIntervalId = null;
    }
  }

  /**
   * Warning alert chime (2 clean sine pulses)
   */
  public playWarningChime(enabled: boolean = true, volumeScale: number = 1.0) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const peakGain = 0.06 * Math.max(0.1, Math.min(1.5, volumeScale));

      [0, 0.16].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(i === 0 ? 659.25 : 783.99, now + delay); // E5, G5

        gain.gain.setValueAtTime(peakGain, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.13);
      });
    } catch {
      // safe fallback
    }
  }

  /**
   * Critical alarm chime (3 rapid warning bursts)
   */
  public playCriticalAlarm(enabled: boolean = true, volumeScale: number = 1.0) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const peakGain = 0.07 * Math.max(0.1, Math.min(1.5, volumeScale));

      [0, 0.12, 0.24].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, now + delay); // B5

        gain.gain.setValueAtTime(peakGain, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
      });
    } catch {
      // safe fallback
    }
  }

  /**
   * Phone ringing tone (for simulated nurse voice call)
   */
  public playPhoneRing(enabled: boolean = true, volumeScale: number = 1.0) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const peakGain = 0.05 * Math.max(0.1, Math.min(1.5, volumeScale));

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.setValueAtTime(peakGain, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.95);
      osc2.stop(now + 0.95);
    } catch {
      // safe fallback
    }
  }

  /**
   * Action acknowledgement tone
   */
  public playAcknowledgeTone(enabled: boolean = true, volumeScale: number = 1.0) {
    if (!enabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const peakGain = 0.06 * Math.max(0.1, Math.min(1.5, volumeScale));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15); // C6

      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // safe fallback
    }
  }
}

export const audioService = new MedicalAudioSynthesizer();
