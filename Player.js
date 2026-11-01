class Player {
  constructor(x = 4.5, y = 19.5) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = 100;
    this.stamina = 100;
    this.radius = 0.2;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.stepTimer = 0;
    this.moving = false;
    this.flashlight = true;
  }

  update(delta, input, game) {
    const rawLook = input.consumeLook();
    const look = Math.max(-70, Math.min(70, rawLook));
    const radiansPerPixel = 0.0006 + game.settings.sensitivity / 100 * 0.0026;
    this.angle += look * radiansPerPixel;
    const turnSpeed = 1.9 * delta;
    this.angle += input.getTurn() * turnSpeed;
    this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));

    const movement = input.getMovement();
    let forward = movement.forward;
    let strafe = movement.strafe;
    const length = Math.hypot(forward, strafe);
    this.moving = length > 0.01;
    if (length > 1) {
      forward /= length;
      strafe /= length;
    }

    const sprinting = this.moving && input.isSprinting() && this.stamina > 2;
    const speed = sprinting ? 2.65 : 1.7;
    if (sprinting) this.stamina = Math.max(0, this.stamina - delta * (game.mode === "atmosphere" ? 15 : 22));
    else this.stamina = Math.min(100, this.stamina + delta * 17);

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const moveX = (cos * forward - sin * strafe) * speed * delta;
    const moveY = (sin * forward + cos * strafe) * speed * delta;
    if (!game.world.isCircleSolid(this.x + moveX, this.y, this.radius)) this.x += moveX;
    if (!game.world.isCircleSolid(this.x, this.y + moveY, this.radius)) this.y += moveY;

    const targetBob = this.moving && !game.settings.reducedMotion ? (sprinting ? 0.65 : 0.35) : 0;
    this.bobAmount += (targetBob - this.bobAmount) * Math.min(1, delta * 8);
    if (this.moving) {
      this.bobPhase += delta * (sprinting ? 11 : 8);
      this.stepTimer -= delta;
      if (this.stepTimer <= 0) {
        game.audio.footstep(sprinting);
        this.stepTimer = sprinting ? 0.3 : 0.46;
      }
    } else {
      this.stepTimer = 0;
    }
  }

  damage(amount, game) {
    this.health = Math.max(0, this.health - amount);
    game.onPlayerDamaged();
    if (this.health <= 0) game.rescuePlayer();
  }

  heal(amount) {
    const previous = this.health;
    this.health = Math.min(100, this.health + amount);
    return this.health - previous;
  }

  serialize() {
    return {
      x: this.x,
      y: this.y,
      angle: this.angle,
      health: this.health,
      stamina: this.stamina,
      flashlight: this.flashlight
    };
  }

  restore(data) {
    if (!data) return;
    this.x = data.x;
    this.y = data.y;
    this.angle = data.angle;
    this.health = data.health;
    this.stamina = data.stamina;
    this.flashlight = data.flashlight !== false;
  }
}

globalThis.Player = Player;