class AudioSystem {
  constructor() {
    this.context = null;
    this.master = null;
    this.enabled = true;
    this.ambientStarted = false;
  }

  init() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.32 : 0;
      this.master.connect(this.context.destination);
      this.startAmbient();
    }
    if (this.context.state !== "running" && this.context.state !== "closed") {
      try {
        const result = this.context.resume();
        if (result && result.catch) result.catch(() => {});
      } catch {}
    }
  }

  suspend() {
    if (!this.context || this.context.state === "closed" || !this.context.suspend) return;
    try {
      const result = this.context.suspend();
      if (result && result.catch) result.catch(() => {});
    } catch {}
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master && this.context) this.master.gain.setTargetAtTime(enabled ? 0.32 : 0, this.context.currentTime, 0.04);
  }

  tone(frequency, duration, type = "sine", volume = 0.08, slide = 0, delay = 0) {
    if (!this.context || !this.enabled) return;
    const time = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
  }

  noise(duration = 0.12, volume = 0.08, frequency = 1000, delay = 0) {
    if (!this.context || !this.enabled) return;
    const sampleCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(this.context.currentTime + delay);
  }

  startAmbient() {
    if (!this.context || this.ambientStarted) return;
    this.ambientStarted = true;
    [48, 72].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = index ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index ? 0.009 : 0.012;
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start();
    });
  }

  shot() {
    this.noise(0.14, 0.34, 1800);
    this.tone(145, 0.15, "square", 0.14, -85);
    this.tone(780, 0.05, "triangle", 0.05, -240);
  }

  hit(precise) {
    this.tone(precise ? 960 : 620, 0.08, "sine", 0.07, precise ? 280 : -120);
  }

  purify(type) {
    const base = type === "pumpkin" ? 190 : type === "paper" ? 520 : 340;
    this.tone(base, 0.28, "triangle", 0.07, 300);
    this.tone(base * 1.5, 0.22, "sine", 0.05, 280, 0.07);
  }

  reload(finished) {
    if (finished) {
      this.tone(520, 0.07, "square", 0.05, 80);
      this.tone(760, 0.08, "square", 0.04, 100, 0.07);
    } else {
      this.noise(0.06, 0.1, 2300);
      this.tone(260, 0.09, "square", 0.04, -60, 0.1);
    }
  }

  pickup() {
    this.tone(540, 0.1, "sine", 0.07, 100);
    this.tone(810, 0.14, "sine", 0.06, 140, 0.09);
  }

  door() {
    this.tone(115, 0.48, "sawtooth", 0.035, 60);
    this.noise(0.22, 0.04, 420);
  }

  locked() {
    this.tone(150, 0.08, "square", 0.05, -20);
    this.tone(125, 0.1, "square", 0.05, -20, 0.1);
  }

  doorBang(type) {
    this.noise(0.1, type === "pumpkin" ? 0.24 : 0.13, type === "paper" ? 1400 : 280);
    if (type !== "paper") this.tone(70, 0.12, "sine", 0.11, -15);
  }

  doorBreak() {
    this.noise(0.4, 0.3, 700);
    this.tone(95, 0.32, "sawtooth", 0.09, -50);
  }

  footstep(sprinting) {
    this.noise(0.055, sprinting ? 0.055 : 0.032, 340);
  }

  zombieAttack(type) {
    const base = type === "paper" ? 430 : type === "pumpkin" ? 90 : 150;
    this.tone(base, 0.24, "sawtooth", 0.07, -45);
  }

  hurt() {
    this.tone(105, 0.24, "sawtooth", 0.09, -45);
  }

  bomb() {
    this.noise(0.5, 0.28, 900);
    this.tone(180, 0.55, "sine", 0.13, 520);
    this.tone(540, 0.4, "triangle", 0.06, 480, 0.05);
  }

  meow() {
    this.tone(480, 0.18, "sawtooth", 0.035, 280);
    this.tone(760, 0.24, "sawtooth", 0.028, -300, 0.16);
  }

  rescue() {
    [392, 523, 659].forEach((frequency, index) => this.tone(frequency, 0.25, "sine", 0.055, 30, index * 0.12));
  }

  broadcast() {
    this.noise(0.35, 0.08, 2100);
    this.tone(440, 0.16, "sine", 0.06, 0, 0.1);
    this.tone(660, 0.24, "sine", 0.05, 0, 0.28);
  }
}

globalThis.AudioSystem = AudioSystem;