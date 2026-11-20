// Tiny WebAudio synth: engine hum, police siren, gunshots, pickups. No audio files,
// everything is generated, and every call is guarded so a missing AudioContext
// can never break the game.

export function createAudio() {
  let ctx = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let sirenPhase = 0;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engine.connect(engineGain);
      engineGain.connect(ctx.destination);
      engine.start();
      siren = ctx.createOscillator();
      siren.type = 'square';
      siren.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      siren.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      siren.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function blip(freqA, freqB, seconds, volume, type) {
    if (!ensure()) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freqA, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), ctx.currentTime + seconds);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  function noiseBurst(seconds, volume) {
    if (!ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      // Sound is garnish; never let it break the game.
    }
  }

  return {
    ensure,
    /** Called every frame with the driving state: hum follows speed, siren follows heat. */
    update(dt, driving, speed, wanted) {
      if (!ctx) return;
      try {
        if (engine && engineGain) {
          engineGain.gain.value = driving ? 0.018 + Math.min(0.05, Math.abs(speed) * 0.00006) : 0;
          engine.frequency.value = 52 + Math.abs(speed) * 0.14;
        }
        if (siren && sirenGain) {
          if (wanted > 0) {
            sirenTimer -= dt;
            if (sirenTimer <= 0) {
              sirenTimer = 0.42;
              sirenPhase = 1 - sirenPhase;
              siren.frequency.value = sirenPhase ? 950 : 700;
            }
            sirenGain.gain.value = 0.012;
          } else {
            sirenGain.gain.value = 0;
          }
        }
      } catch {
        // Sound is garnish; never let it break the game.
      }
    },
    shot() {
      noiseBurst(0.09, 0.16);
    },
    pickup() {
      blip(880, 1320, 0.12, 0.08);
    },
    mission() {
      blip(523, 523, 0.1, 0.09);
      setTimeout(() => blip(659, 659, 0.1, 0.09), 110);
      setTimeout(() => blip(784, 784, 0.16, 0.09), 220);
    },
    hurt() {
      blip(220, 90, 0.18, 0.1, 'triangle');
    },
  };
}
