class Input {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.keys = new Set();
    this.lookDelta = 0;
    this.lookWarmup = 0;
    this.touchMove = { forward: 0, strafe: 0 };
    this.touchSprint = false;
    this.movePointerId = null;
    this.lookPointerId = null;
    this.lookPointerX = 0;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const touchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
    this.mode = coarse || touchPoints ? "touch" : "desktop";
    this.actions = {
      KeyE: "interact", KeyR: "reload", KeyQ: "bomb", KeyC: "candy", KeyF: "flashlight",
      KeyM: "map", Tab: "map", KeyP: "pause", Escape: "pause", F8: "screenshot"
    };
    this.bind();
  }

  bind() {
    document.addEventListener("keydown", event => {
      if (event.target.closest("input, textarea")) return;
      if (["Tab", "Space", "F8", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
      this.setMode("desktop");
      this.keys.add(event.code);
      if (!event.repeat && this.actions[event.code]) this.game.handleAction(this.actions[event.code]);
    });
    document.addEventListener("keyup", event => this.keys.delete(event.code));
    document.addEventListener("pointerdown", event => {
      if (event.pointerType === "touch" || event.pointerType === "pen") this.setMode("touch");
      if (event.pointerType === "mouse") this.setMode("desktop");
    });
    document.addEventListener("mousemove", event => {
      if (this.mode !== "desktop" || document.pointerLockElement !== this.canvas || this.game.state !== "playing") return;
      if (this.lookWarmup > 0) {
        this.lookWarmup -= 1;
        return;
      }
      this.addLook(event.movementX);
    });
    document.addEventListener("mousedown", event => {
      if (this.mode !== "desktop" || event.target.closest("button, a, input, .screen")) return;
      if (this.game.state !== "playing") return;
      if (document.pointerLockElement !== this.canvas) {
        this.game.requestPointerLock();
        return;
      }
      if (event.button === 0) this.game.fireWeapon();
    });
    document.addEventListener("contextmenu", event => {
      if (event.target === this.canvas || event.target.closest("#touchControls")) event.preventDefault();
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) {
        this.lookDelta = 0;
        this.lookWarmup = 2;
      }
      this.game.onPointerLockChange();
    });
    window.addEventListener("blur", () => {
      this.clear();
      if (this.game.state === "playing") this.game.pause();
    });
    this.bindTouchControls();
  }

  bindTouchControls() {
    const moveZone = document.getElementById("moveZone");
    const lookZone = document.getElementById("lookZone");
    moveZone.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || this.game.state !== "playing" || this.movePointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      this.setMode("touch");
      this.movePointerId = event.pointerId;
      this.capture(moveZone, event.pointerId);
      this.updateMove(event);
    });
    moveZone.addEventListener("pointermove", event => {
      if (event.pointerId !== this.movePointerId) return;
      event.preventDefault();
      this.updateMove(event);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => {
      moveZone.addEventListener(name, event => this.releaseMove(event.pointerId));
    });
    lookZone.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || this.game.state !== "playing" || this.lookPointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      this.setMode("touch");
      this.lookPointerId = event.pointerId;
      this.lookPointerX = event.clientX;
      this.capture(lookZone, event.pointerId);
    });
    lookZone.addEventListener("pointermove", event => {
      if (event.pointerId !== this.lookPointerId) return;
      event.preventDefault();
      const movement = event.clientX - this.lookPointerX;
      this.lookPointerX = event.clientX;
      this.addLook(movement);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => {
      lookZone.addEventListener(name, event => this.releaseLook(event.pointerId));
    });
    document.querySelectorAll("[data-game-action]").forEach(button => {
      button.addEventListener("pointerdown", event => {
        if (event.pointerType === "mouse") return;
        event.preventDefault();
        event.stopPropagation();
        this.setMode("touch");
        this.capture(button, event.pointerId);
        button.classList.add("active");
        const action = button.dataset.gameAction;
        if (action === "fire") {
          if (this.game.state === "playing") this.game.fireWeapon();
        } else this.game.handleAction(action);
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => {
        button.addEventListener(name, event => {
          event.preventDefault();
          button.classList.remove("active");
        });
      });
    });
  }

  updateMove(event) {
    const base = document.getElementById("joystickBase");
    const rect = base.getBoundingClientRect();
    const radius = Math.max(1, rect.width * 0.36);
    const dx = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const dy = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(dx, dy);
    const clamped = Math.min(1, length);
    const deadzone = 0.14;
    const strength = clamped <= deadzone ? 0 : (clamped - deadzone) / (1 - deadzone);
    const normalX = length > 0 ? dx / length : 0;
    const normalY = length > 0 ? dy / length : 0;
    this.touchMove.strafe = normalX * strength;
    this.touchMove.forward = -normalY * strength;
    this.touchSprint = clamped >= 0.9;
    const knob = document.getElementById("joystickKnob");
    knob.style.transform = `translate(${normalX * clamped * radius}px, ${normalY * clamped * radius}px)`;
  }

  addLook(movement) {
    const clamped = Math.max(-80, Math.min(80, movement || 0));
    this.lookDelta = Math.max(-140, Math.min(140, this.lookDelta + clamped));
  }

  getMovement() {
    if (this.mode === "touch") return { ...this.touchMove };
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyA")) strafe -= 1;
    if (this.keys.has("KeyD")) strafe += 1;
    return { forward, strafe };
  }

  getTurn() {
    if (this.mode !== "desktop") return 0;
    return Number(this.keys.has("ArrowRight")) - Number(this.keys.has("ArrowLeft"));
  }

  isSprinting() {
    if (this.mode === "touch") return this.touchSprint;
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  isTouchMode() {
    return this.mode === "touch";
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.clear();
    this.mode = mode;
    this.game.updateInputMode();
  }

  capture(element, pointerId) {
    try {
      if (element.setPointerCapture) element.setPointerCapture(pointerId);
    } catch {}
  }

  release(element, pointerId) {
    try {
      if (element.releasePointerCapture) element.releasePointerCapture(pointerId);
    } catch {}
  }

  releaseMove(pointerId) {
    if (pointerId !== this.movePointerId) return;
    this.movePointerId = null;
    this.touchMove.forward = 0;
    this.touchMove.strafe = 0;
    this.touchSprint = false;
    document.getElementById("joystickKnob").style.transform = "translate(0, 0)";
    this.release(document.getElementById("moveZone"), pointerId);
  }

  releaseLook(pointerId) {
    if (pointerId !== this.lookPointerId) return;
    this.lookPointerId = null;
    this.release(document.getElementById("lookZone"), pointerId);
  }

  consumeLook() {
    const value = this.lookDelta;
    this.lookDelta = 0;
    return value;
  }

  clear() {
    this.keys.clear();
    this.lookDelta = 0;
    this.releaseMove(this.movePointerId);
    this.releaseLook(this.lookPointerId);
    document.querySelectorAll("[data-game-action]").forEach(button => button.classList.remove("active"));
  }
}

globalThis.Input = Input;