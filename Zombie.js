class Zombie {
  constructor(options) {
    this.id = options.id;
    this.type = options.type || "sleepy";
    this.x = options.x;
    this.y = options.y;
    this.spawnX = options.x;
    this.spawnY = options.y;
    this.dormant = options.dormant !== false;
    this.alert = !this.dormant;
    this.purified = false;
    this.removed = false;
    this.purifyTimer = 0;
    this.animation = Math.random() * 10;
    this.path = [];
    this.pathTimer = Math.random() * 0.4;
    this.attackCooldown = Math.random();
    this.stun = 0;
    this.hitFlash = 0;
    this.bangSoundTimer = 0;
    this.lastDoor = null;
    const stats = {
      sleepy: { health: 3, speed: 0.72, radius: 0.25, hitRadius: 0.46, damage: 12, doorDamage: 11, scale: 0.88 },
      paper: { health: 2, speed: 1.16, radius: 0.2, hitRadius: 0.44, damage: 9, doorDamage: 6, scale: 0.82 },
      pumpkin: { health: 7, speed: 0.5, radius: 0.33, hitRadius: 0.58, damage: 20, doorDamage: 28, scale: 1.04 }
    }[this.type];
    Object.assign(this, stats);
    this.maxHealth = this.health;
  }

  update(delta, game) {
    this.animation += delta;
    this.hitFlash = Math.max(0, this.hitFlash - delta);
    if (this.purified) {
      this.purifyTimer -= delta;
      if (this.purifyTimer <= 0) this.removed = true;
      return;
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    this.stun = Math.max(0, this.stun - delta);
    this.bangSoundTimer = Math.max(0, this.bangSoundTimer - delta);
    const dx = game.player.x - this.x;
    const dy = game.player.y - this.y;
    const distance = Math.hypot(dx, dy);
    if (!this.alert) {
      const hearingDistance = this.type === "paper" ? 3.2 : 2.4;
      if (distance < hearingDistance) this.alert = true;
      else return;
    }
    if (game.isPlayerInSafeRoom()) {
      this.path = [];
      return;
    }
    if (this.stun > 0) return;

    if (distance < 0.72) {
      if (this.attackCooldown <= 0) {
        const modeScale = game.mode === "atmosphere" ? 0.62 : 1;
        game.player.damage(this.damage * modeScale, game);
        game.audio.zombieAttack(this.type);
        this.attackCooldown = this.type === "paper" ? 1.05 : 1.35;
      }
      return;
    }

    this.pathTimer -= delta;
    if (this.pathTimer <= 0) {
      this.path = game.world.findPath(this.x, this.y, game.player.x, game.player.y);
      this.pathTimer = 0.48 + Math.random() * 0.25;
    }
    if (!this.path.length) return;
    const next = this.path[0];
    const nextDoor = game.world.doorAt(Math.floor(next.x), Math.floor(next.y));
    if (nextDoor && !nextDoor.passable) {
      this.lastDoor = nextDoor;
      nextDoor.durability -= delta * this.doorDamage;
      if (this.bangSoundTimer <= 0) {
        game.audio.doorBang(this.type);
        this.bangSoundTimer = this.type === "pumpkin" ? 0.55 : 0.9;
      }
      if (nextDoor.durability <= 0) {
        nextDoor.forceOpen();
        game.audio.doorBreak();
        game.showSubtitle("声音", `${nextDoor.name}被撞开了！`, 2.2);
      }
      return;
    }

    const mx = next.x - this.x;
    const my = next.y - this.y;
    const length = Math.hypot(mx, my);
    if (length < 0.13) {
      this.path.shift();
      return;
    }
    const speed = this.speed * (game.mode === "atmosphere" ? 0.78 : 1);
    const moveX = mx / length * speed * delta;
    const moveY = my / length * speed * delta;
    if (!game.world.isCircleSolid(this.x + moveX, this.y, this.radius)) this.x += moveX;
    if (!game.world.isCircleSolid(this.x, this.y + moveY, this.radius)) this.y += moveY;
    this.applySeparation(game);
  }

  applySeparation(game) {
    for (const other of game.zombies) {
      if (other === this || other.purified || other.removed) continue;
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distance = Math.hypot(dx, dy);
      const minimum = (this.radius + other.radius) * 0.7;
      if (distance > 0 && distance < minimum) {
        const push = (minimum - distance) * 0.06;
        const nx = this.x + dx / distance * push;
        const ny = this.y + dy / distance * push;
        if (!game.world.isCircleSolid(nx, ny, this.radius)) {
          this.x = nx;
          this.y = ny;
        }
      }
    }
  }

  hear(x, y, radius) {
    if (this.purified || this.removed) return;
    if (Math.hypot(this.x - x, this.y - y) <= radius) this.alert = true;
  }

  takeDamage(amount, game, precise) {
    if (this.purified || this.removed) return;
    this.alert = true;
    this.health -= amount;
    this.hitFlash = 0.12;
    this.stun = precise ? 0.28 : 0.16;
    game.audio.hit(precise);
    if (this.health <= 0) {
      this.purified = true;
      this.purifyTimer = 0.72;
      game.stats.purified += 1;
      game.audio.purify(this.type);
      game.onZombiePurified(this);
    }
  }
}

globalThis.Zombie = Zombie;