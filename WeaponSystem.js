class WeaponSystem {
  constructor(mode = "atmosphere") {
    this.magSize = 6;
    this.ammo = this.magSize;
    this.reserve = mode === "atmosphere" ? 24 : 15;
    this.bombs = 1;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.muzzle = 0;
    this.bombCooldown = 0;
  }

  update(delta, game) {
    this.cooldown = Math.max(0, this.cooldown - delta);
    this.bombCooldown = Math.max(0, this.bombCooldown - delta);
    this.recoil = Math.max(0, this.recoil - delta * 5.5);
    this.muzzle = Math.max(0, this.muzzle - delta);
    if (this.reloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        const needed = this.magSize - this.ammo;
        const loaded = Math.min(needed, this.reserve);
        this.ammo += loaded;
        this.reserve -= loaded;
        this.reloading = false;
        game.audio.reload(true);
      }
    }
  }

  fire(game) {
    if (this.cooldown > 0 || this.reloading || game.state !== "playing") return;
    if (this.ammo <= 0) {
      game.audio.locked();
      game.showToast(this.reserve > 0 ? "弹仓空了，按 R 换弹" : "弹药用完了，试试关门撤退");
      this.cooldown = 0.25;
      return;
    }
    this.ammo -= 1;
    this.cooldown = 0.36;
    this.recoil = 1;
    this.muzzle = game.settings.reducedMotion ? 0.025 : 0.075;
    game.audio.shot();
    game.noise(game.player.x, game.player.y, 7.5);
    game.stats.shots += 1;
    const hit = this.findHit(game);
    if (hit) {
      hit.zombie.takeDamage(hit.precise ? 2 : 1, game, hit.precise);
      game.showHitMarker(hit.precise);
    }
    if (this.ammo === 0 && this.reserve > 0) game.showToast("弹仓已空，按 R 换弹");
  }

  findHit(game) {
    const candidates = [];
    for (const zombie of game.zombies) {
      if (zombie.purified || zombie.removed) continue;
      const dx = zombie.x - game.player.x;
      const dy = zombie.y - game.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 14 || distance === 0) continue;
      const angle = Math.atan2(dy, dx);
      const wall = game.world.castRay(game.player.x, game.player.y, dx / distance, dy / distance, 15);
      if (distance > wall.distance + 0.2) continue;
      const difference = Math.atan2(Math.sin(angle - game.player.angle), Math.cos(angle - game.player.angle));
      const assist = game.mode === "atmosphere" ? 0.018 : 0.006;
      const threshold = Math.atan2(zombie.hitRadius || zombie.radius, distance) + assist;
      if (Math.abs(difference) <= threshold) candidates.push({ zombie, distance, precise: Math.abs(difference) < threshold * 0.3 });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] || null;
  }

  reload(game) {
    if (this.reloading || this.ammo >= this.magSize || this.reserve <= 0 || game.state !== "playing") return;
    this.reloading = true;
    this.reloadTimer = 1.15;
    game.audio.reload(false);
  }

  addAmmo(amount) {
    const previousReserve = this.reserve;
    const needed = Math.max(0, this.magSize - this.ammo);
    const magazine = Math.min(needed, amount);
    this.ammo += magazine;
    this.reserve = Math.min(60, this.reserve + amount - magazine);
    return {
      magazine,
      reserve: this.reserve - previousReserve,
      added: magazine + this.reserve - previousReserve
    };
  }

  useBomb(game) {
    if (this.bombs <= 0 || this.bombCooldown > 0 || game.state !== "playing") {
      if (this.bombs <= 0) game.showToast("南瓜弹已经用完了");
      return;
    }
    this.bombs -= 1;
    this.bombCooldown = 1;
    game.audio.bomb();
    game.noise(game.player.x, game.player.y, 11);
    game.flashScreen("gold");
    let affected = 0;
    for (const zombie of game.zombies) {
      if (zombie.purified || zombie.removed) continue;
      const dx = zombie.x - game.player.x;
      const dy = zombie.y - game.player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 3.6) continue;
      const wall = game.world.castRay(game.player.x, game.player.y, dx / distance, dy / distance, distance + 0.2);
      if (wall.distance < distance - 0.25) continue;
      zombie.takeDamage(4, game, false);
      if (!zombie.purified && distance > 0) {
        const push = 0.65;
        const nx = zombie.x + dx / distance * push;
        const ny = zombie.y + dy / distance * push;
        if (!game.world.isCircleSolid(nx, ny, zombie.radius)) {
          zombie.x = nx;
          zombie.y = ny;
        }
      }
      affected += 1;
    }
    game.showToast(affected ? `南瓜灯亮起，净化波及 ${affected} 个目标` : "南瓜灯亮了，但附近没有目标");
  }

  serialize() {
    return { ammo: this.ammo, reserve: this.reserve, bombs: this.bombs };
  }

  restore(data) {
    if (!data) return;
    this.ammo = data.ammo;
    this.reserve = data.reserve;
    this.bombs = data.bombs;
    this.reloading = false;
    this.cooldown = 0;
  }
}

globalThis.WeaponSystem = WeaponSystem;