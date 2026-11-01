class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.game = game;
    this.view = document.createElement("canvas");
    this.view.width = 480;
    this.view.height = 270;
    this.ctx = this.view.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.context.imageSmoothingEnabled = false;
    this.fov = Math.PI / 3;
    this.projection = this.view.width / (2 * Math.tan(this.fov / 2));
    this.zBuffer = new Float32Array(this.view.width);
    this.background = this.ctx.createImageData(this.view.width, this.view.height);
    this.floorZoneWorld = null;
    this.floorZones = [];
    this.textures = {};
    this.sprites = new Map();
    this.createTextures();
  }

  makeCanvas(width = 128, height = 160) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  resize() {
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const width = Math.max(240, Math.min(720, Math.round(270 * aspect)));
    if (this.view.width === width && this.view.height === 270) return;
    this.view.width = width;
    this.view.height = 270;
    this.ctx.imageSmoothingEnabled = false;
    this.context.imageSmoothingEnabled = false;
    this.projection = this.view.width / (2 * Math.tan(this.fov / 2));
    this.zBuffer = new Float32Array(this.view.width);
    this.background = this.ctx.createImageData(this.view.width, this.view.height);
    this.floorZoneWorld = null;
  }

  createTextures() {
    const zones = {
      wall: ["#d3c6ad", "#667c70", "#465c54"],
      corridor: ["#d8c8aa", "#72897b", "#f0d487"],
      security: ["#ddc49b", "#628574", "#f4c86a"],
      class1: ["#d9c7ad", "#8c7a91", "#e8894e"],
      class2: ["#d3c3a8", "#6f8392", "#a9c9ae"],
      class3: ["#d9c7ad", "#947581", "#e8894e"],
      class4: ["#d3c3a8", "#7d7291", "#a9c9ae"],
      medical: ["#d8d7bd", "#6b9a8a", "#f4ecd9"],
      lab: ["#c4d1c4", "#4f7d72", "#a9c9ae"],
      broadcast: ["#cbbbd4", "#6d5d82", "#e8894e"],
      lobby: ["#dfbf9e", "#a26f55", "#f4c86a"],
      stairs: ["#bbb2a5", "#625c61", "#827a70"]
    };
    Object.entries(zones).forEach(([zone, palette]) => this.textures[`wall-${zone}`] = this.makeWallTexture(palette));
    ["normal", "oneWay", "safe", "broadcast", "sealed"].forEach(type => this.textures[type] = this.makeDoorTexture(type, "教室"));
  }

  makeWallTexture(palette) {
    const canvas = this.makeCanvas(64, 64);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, 64, 38);
    ctx.fillStyle = palette[1];
    ctx.fillRect(0, 39, 64, 25);
    ctx.fillStyle = "#3d4142";
    ctx.fillRect(0, 35, 64, 4);
    ctx.fillStyle = palette[2];
    ctx.fillRect(0, 32, 64, 3);
    ctx.fillStyle = "rgba(36,32,56,.1)";
    for (let x = 15; x < 64; x += 16) ctx.fillRect(x, 39, 1, 25);
    for (let y = 6; y < 32; y += 10) ctx.fillRect(0, y, 64, 1);
    for (let index = 0; index < 16; index += 1) {
      ctx.fillStyle = `rgba(36,32,56,${0.02 + Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 4, 1 + Math.random() * 2);
    }
    return canvas;
  }

  makeDoorTexture(type, label, locked = false) {
    const canvas = this.makeCanvas(64, 64);
    const ctx = canvas.getContext("2d");
    const colors = { normal: "#665c68", oneWay: "#715e5b", safe: "#315c59", broadcast: "#9a5c36", sealed: "#514c50" };
    ctx.fillStyle = colors[type] || colors.normal;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#ead6ac";
    ctx.fillRect(0, 0, 5, 64);
    ctx.fillRect(59, 0, 5, 64);
    ctx.fillRect(0, 0, 64, 4);
    ctx.strokeStyle = "#2c2832";
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 4, 54, 60);
    ctx.fillStyle = "#202a2d";
    ctx.fillRect(26, 6, 12, 22);
    ctx.fillStyle = "#9fb5ad";
    ctx.fillRect(28, 8, 8, 18);
    ctx.fillStyle = "rgba(244,236,217,.35)";
    ctx.fillRect(29, 8, 2, 17);
    ctx.fillStyle = locked ? "#b7635a" : "#a9d7b5";
    ctx.fillRect(8, 31, 48, 3);
    ctx.fillStyle = "rgba(25,22,34,.82)";
    ctx.fillRect(8, 36, 48, 19);
    ctx.fillStyle = "#fff0d2";
    ctx.font = `bold ${label.length > 3 ? 10 : 17}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, 32, 49);
    ctx.fillStyle = "#f4c86a";
    ctx.beginPath();
    ctx.arc(54, 54, 3, 0, Math.PI * 2);
    ctx.fill();
    if (locked) {
      ctx.strokeStyle = "#f4ecd9";
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 51, 8, 7);
      ctx.beginPath();
      ctx.arc(12, 51, 3, Math.PI, 0);
      ctx.stroke();
    }
    if (type === "sealed") {
      ctx.strokeStyle = "#342f35";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(4, 14); ctx.lineTo(60, 50); ctx.moveTo(4, 50); ctx.lineTo(60, 14); ctx.stroke();
    }
    return canvas;
  }

  getDoorTexture(door) {
    const labels = {
      "保安室门": "保安室", "101 教室门": "101", "102 教室门": "102", "医务室门": "医务室",
      "广播室门": "广播室", "大厅门": "大厅", "103 教室捷径门": "103", "104 教室门": "104",
      "实验室门": "实验室", "楼梯间门": "楼梯间", "教室连通门": "连通门"
    };
    const label = labels[door.name] || "教室";
    const key = `door-${door.id}-${door.locked ? 1 : 0}`;
    if (!this.textures[key]) this.textures[key] = this.makeDoorTexture(door.type, label, door.locked);
    return this.textures[key];
  }

  getWallTexture(hit) {
    const neighbors = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const rooms = neighbors.map(([dx, dy]) => this.game.world.getRoomAt(hit.mapX + dx, hit.mapY + dy)).filter(Boolean);
    const room = rooms.find(candidate => candidate.id !== "corridor") || rooms[0];
    return this.textures[`wall-${room ? room.id : "corridor"}`] || this.textures["wall-corridor"];
  }

  render() {
    if (!this.game.player || !this.game.world) return;
    this.drawWorld();
    this.drawWeapon();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.view, 0, 0, this.canvas.width, this.canvas.height);
    if (this.game.flags.hasMap && this.game.state !== "menu") this.drawMiniMap();
  }

  drawWorld() {
    const { ctx, view } = this;
    const { player, world } = this.game;
    const width = view.width;
    const height = view.height;
    const horizon = height / 2 + Math.sin(player.bobPhase * 2) * player.bobAmount * 1.5;
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const planeX = -dirY * Math.tan(this.fov / 2);
    const planeY = dirX * Math.tan(this.fov / 2);
    this.drawPerspectiveBackground(horizon, dirX, dirY, planeX, planeY);
    const rayWidth = 2;
    for (let x = 0; x < width; x += rayWidth) {
      const cameraX = 2 * x / width - 1;
      const rayX = dirX + planeX * cameraX;
      const rayY = dirY + planeY * cameraX;
      const hit = world.castRay(player.x, player.y, rayX, rayY, 28);
      const distance = Math.max(0.04, hit.distance);
      const lineHeight = Math.min(height * 5, this.projection / distance);
      const start = horizon - lineHeight / 2;
      let texture = this.getWallTexture(hit);
      let textureX = Math.floor(hit.wallX * 64);
      if (hit.door) {
        texture = this.getDoorTexture(hit.door);
        const openness = hit.door.openAmount;
        textureX = Math.floor((hit.wallX - openness) / Math.max(0.01, 1 - openness) * 64);
      }
      textureX = Math.max(0, Math.min(63, textureX));
      ctx.drawImage(texture, textureX, 0, 1, 64, x, start, rayWidth + 0.5, lineHeight);
      const shade = Math.min(0.64, distance / 18 * 0.52 + (hit.side ? 0.055 : 0));
      ctx.fillStyle = `rgba(15,15,29,${shade})`;
      ctx.fillRect(x, start, rayWidth + 0.5, lineHeight);
      if (world.isStructuralCorner(hit, rayX, rayY)) {
        ctx.fillStyle = "rgba(224,207,176,.24)";
        ctx.fillRect(x, start, rayWidth + 1, lineHeight);
      }
      for (let offset = 0; offset < rayWidth && x + offset < width; offset += 1) this.zBuffer[x + offset] = distance;
    }
    this.drawSprites(horizon, dirX, dirY, planeX, planeY);
    this.drawLighting();
  }

  drawPerspectiveBackground(horizon, dirX, dirY, planeX, planeY) {
    const { view, background } = this;
    const { player, world } = this.game;
    const width = view.width;
    const height = view.height;
    const data = background.data;
    const leftX = dirX - planeX;
    const leftY = dirY - planeY;
    const rightX = dirX + planeX;
    const rightY = dirY + planeY;
    const colors = {
      corridor: [92, 82, 84], security: [78, 96, 82], class1: [102, 84, 73], class2: [82, 88, 96],
      class3: [105, 82, 77], class4: [88, 80, 99], medical: [75, 98, 91], lab: [63, 88, 80],
      broadcast: [82, 70, 94], lobby: [108, 80, 64], stairs: [75, 70, 74]
    };
    if (this.floorZoneWorld !== world) {
      this.floorZoneWorld = world;
      this.floorZones = Array.from({ length: world.height }, (_, y) => Array.from({ length: world.width }, (_, x) => world.getRoomAt(x + 0.5, y + 0.5)?.id || "corridor"));
    }
    for (let y = 0; y < height; y += 1) {
      if (y < horizon) {
        const rowDistance = 0.5 * this.projection / Math.max(1, horizon - y);
        const stepX = rowDistance * (rightX - leftX) / width;
        const stepY = rowDistance * (rightY - leftY) / width;
        let ceilingX = player.x + rowDistance * leftX;
        let ceilingY = player.y + rowDistance * leftY;
        const light = Math.max(0.38, 1 - rowDistance * 0.03);
        for (let x = 0; x < width; x += 1) {
          const tileX = Math.floor(ceilingX);
          const tileY = Math.floor(ceilingY);
          const fractionX = ceilingX - tileX;
          const fractionY = ceilingY - tileY;
          const grout = fractionX < 0.045 || fractionY < 0.045;
          const alternate = (tileX + tileY) % 2 === 0 ? 4 : -2;
          const lightPanel = Math.abs(tileX * 7 + tileY * 3) % 17 === 0 && fractionX > 0.25 && fractionX < 0.75 && fractionY > 0.25 && fractionY < 0.75;
          let red = lightPanel ? 151 : 61 + alternate;
          let green = lightPanel ? 137 : 55 + alternate;
          let blue = lightPanel ? 96 : 67 + alternate;
          if (grout && !lightPanel) {
            red *= 0.68;
            green *= 0.68;
            blue *= 0.72;
          }
          const index = (y * width + x) * 4;
          data[index] = red * light;
          data[index + 1] = green * light;
          data[index + 2] = blue * light;
          data[index + 3] = 255;
          ceilingX += stepX;
          ceilingY += stepY;
        }
        continue;
      }
      const rowDistance = 0.5 * this.projection / Math.max(1, y - horizon);
      const stepX = rowDistance * (rightX - leftX) / width;
      const stepY = rowDistance * (rightY - leftY) / width;
      let floorX = player.x + rowDistance * leftX;
      let floorY = player.y + rowDistance * leftY;
      const light = Math.max(0.42, 1 - rowDistance * 0.035);
      for (let x = 0; x < width; x += 1) {
        const tileX = Math.floor(floorX);
        const tileY = Math.floor(floorY);
        const inside = world.inBounds(tileX, tileY);
        const zone = inside ? this.floorZones[tileY][tileX] : "corridor";
        const base = colors[zone] || colors.corridor;
        const alternate = (tileX + tileY) % 2 === 0 ? 5 : -3;
        const fractionX = floorX - tileX;
        const fractionY = floorY - tileY;
        const grout = fractionX < 0.055 || fractionY < 0.055;
        const door = inside ? world.doorAt(tileX, tileY) : null;
        let red = door ? (door.passable ? 104 : 151) : base[0] + alternate;
        let green = door ? (door.passable ? 154 : 112) : base[1] + alternate;
        let blue = door ? (door.passable ? 119 : 69) : base[2] + alternate;
        if (grout && !door) {
          red *= 0.62;
          green *= 0.62;
          blue *= 0.68;
        }
        if (!inside) {
          red = 24;
          green = 23;
          blue = 32;
        }
        const index = (y * width + x) * 4;
        data[index] = red * light;
        data[index + 1] = green * light;
        data[index + 2] = blue * light;
        data[index + 3] = 255;
        floorX += stepX;
        floorY += stepY;
      }
    }
    this.ctx.putImageData(background, 0, 0);
  }

  collectSprites() {
    const sprites = [];
    const add = (type, x, y, scale, extra = {}) => sprites.push({ type, x, y, scale, ...extra });
    this.game.world.props.forEach(prop => add(prop.type, prop.x, prop.y, prop.scale, { id: prop.id, z: prop.z || 0 }));
    if (this.game.settings.routeGuide) {
      const player = this.game.player;
      const targetPoint = this.game.guidance.path.find(point => this.game.world.doorAt(Math.floor(point.x), Math.floor(point.y)));
      this.game.world.doors.forEach(door => {
        if (door.type === "sealed") return;
        const centerX = door.x + 0.5;
        const centerY = door.y + 0.5;
        const dx = centerX - player.x;
        const dy = centerY - player.y;
        const distance = Math.hypot(dx, dy);
        const isTarget = targetPoint && Math.floor(targetPoint.x) === door.x && Math.floor(targetPoint.y) === door.y;
        if (distance > 7 || (!isTarget && distance > 3.2) || distance === 0) return;
        const offset = Math.min(0.2, distance * 0.08);
        add("door-marker", centerX - dx / distance * offset, centerY - dy / distance * offset, isTarget ? 0.36 : 0.28, {
          id: `marker-${door.id}`, doorId: door.id, target: isTarget, z: 1.02
        });
      });
    }
    if (this.game.settings.routeGuide && this.game.guidance.path.length) {
      this.game.guidance.path.slice(0, 12).forEach((point, index) => {
        if (index % 2 === 0) add("paw", point.x, point.y, 0.12, { id: `guide-paw-${index}`, z: 0.03, alpha: 0.72 });
      });
    }
    this.game.items.filter(item => !item.collected).forEach(item => add(item.type, item.x, item.y, item.type === "map" ? 0.28 : 0.24, { id: item.id, bob: true }));
    this.game.getNPCs().forEach(npc => add(npc.kind === "cat" ? "cat" : `student-${npc.variant}`, npc.x, npc.y, npc.kind === "cat" ? 0.42 : 0.84, { id: npc.id }));
    this.game.zombies.filter(zombie => !zombie.removed).forEach(zombie => {
      add(`zombie-${zombie.type}`, zombie.x, zombie.y, zombie.scale, {
        id: zombie.id,
        frame: Math.floor(zombie.animation * 5) % 2,
        sleeping: !zombie.alert,
        hit: zombie.hitFlash > 0,
        alpha: zombie.purified ? Math.max(0, zombie.purifyTimer / 0.72) : 1,
        purified: zombie.purified
      });
    });
    this.game.particles.forEach(particle => add(particle.type, particle.x, particle.y, particle.scale, { z: particle.z, alpha: Math.max(0, particle.life / particle.maxLife) }));
    const player = this.game.player;
    sprites.forEach(sprite => sprite.distance = Math.hypot(sprite.x - player.x, sprite.y - player.y));
    return sprites.filter(sprite => sprite.distance > 0.12).sort((a, b) => b.distance - a.distance);
  }

  drawSprites(horizon, dirX, dirY, planeX, planeY) {
    const { ctx, view } = this;
    const player = this.game.player;
    const inverse = 1 / (planeX * dirY - dirX * planeY);
    for (const sprite of this.collectSprites()) {
      const relativeX = sprite.x - player.x;
      const relativeY = sprite.y - player.y;
      const transformX = inverse * (dirY * relativeX - dirX * relativeY);
      const transformY = inverse * (-planeY * relativeX + planeX * relativeY);
      if (transformY <= 0.08) continue;
      const screenX = Math.floor(view.width / 2 * (1 + transformX / transformY));
      const bob = sprite.bob ? Math.sin(this.game.stats.elapsed * 3 + sprite.x) * 3 : 0;
      const size = Math.abs(this.projection / transformY * sprite.scale);
      if (size < 1 || size > view.height * 8) continue;
      const floorY = horizon + this.projection / (2 * transformY);
      const zLift = (sprite.z || 0) * this.projection / transformY;
      const top = Math.floor(floorY - size - zLift + bob);
      const startX = Math.floor(screenX - size / 2);
      const endX = Math.ceil(screenX + size / 2);
      if (endX < 0 || startX >= view.width) continue;
      const image = this.getSprite(sprite);
      ctx.globalAlpha = sprite.alpha === undefined ? 1 : sprite.alpha;
      for (let x = Math.max(0, startX); x < Math.min(view.width, endX); x += 1) {
        if (transformY >= this.zBuffer[x]) continue;
        const sourceX = Math.max(0, Math.min(image.width - 1, Math.floor((x - startX) / (endX - startX) * image.width)));
        ctx.drawImage(image, sourceX, 0, 1, image.height, x, top, 1, size);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawLighting() {
    const { ctx, view } = this;
    const brightness = this.game.settings.brightness / 100;
    const dark = (this.game.player.flashlight ? 0.46 : 0.7) / brightness;
    const gradient = ctx.createRadialGradient(view.width / 2, view.height / 2, 12, view.width / 2, view.height / 2, view.width * 0.58);
    gradient.addColorStop(0, this.game.player.flashlight ? "rgba(8,9,22,.02)" : `rgba(8,9,22,${dark * 0.65})`);
    gradient.addColorStop(0.45, `rgba(8,9,22,${dark * 0.25})`);
    gradient.addColorStop(1, `rgba(8,9,22,${Math.min(0.9, dark)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.width, view.height);
    if (this.game.isPlayerInSafeRoom()) {
      ctx.fillStyle = "rgba(244,200,106,.045)";
      ctx.fillRect(0, 0, view.width, view.height);
    }
  }

  drawWeapon() {
    const { ctx, view } = this;
    const weapon = this.game.weapon;
    const bobX = Math.sin(this.game.player.bobPhase) * this.game.player.bobAmount * 4;
    const bobY = Math.abs(Math.cos(this.game.player.bobPhase)) * this.game.player.bobAmount * 3;
    const recoil = weapon.recoil * 16;
    ctx.save();
    ctx.translate(view.width - 148 + bobX, view.height - 74 + bobY + recoil);
    ctx.rotate(-0.12 - weapon.recoil * 0.08);
    ctx.fillStyle = "#d5a080";
    ctx.strokeStyle = "#242038";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-18, 17, 62, 46, 15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#655879";
    ctx.beginPath();
    ctx.roundRect(9, -2, 38, 57, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8894e";
    ctx.beginPath();
    ctx.roundRect(-25, -35, 112, 44, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4ecd9";
    ctx.beginPath();
    ctx.roundRect(63, -31, 62, 34, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#a9c9ae";
    ctx.beginPath();
    ctx.roundRect(-8, -51, 53, 19, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4c86a";
    ctx.beginPath();
    ctx.arc(17, -14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#242038";
    ctx.font = "bold 13px serif";
    ctx.textAlign = "center";
    ctx.fillText("★", 17, -9);
    if (weapon.muzzle > 0) {
      ctx.fillStyle = "rgba(244,200,106,.9)";
      ctx.beginPath();
      ctx.moveTo(125, -32);
      ctx.lineTo(151, -18);
      ctx.lineTo(130, -11);
      ctx.lineTo(143, 8);
      ctx.lineTo(119, -2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  getSprite(sprite) {
    const key = `${sprite.type}-${sprite.doorId || ""}-${sprite.target ? 1 : 0}-${sprite.frame || 0}-${sprite.sleeping ? 1 : 0}-${sprite.hit ? 1 : 0}`;
    if (!this.sprites.has(key)) this.sprites.set(key, this.createSprite(sprite));
    return this.sprites.get(key);
  }

  createSprite(sprite) {
    const canvas = this.makeCanvas();
    const ctx = canvas.getContext("2d");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#242038";
    if (sprite.type.startsWith("zombie-")) this.drawZombie(ctx, sprite);
    else if (sprite.type === "door-marker") this.drawDoorMarker(ctx, sprite);
    else if (sprite.type === "cat") this.drawCat(ctx);
    else if (sprite.type.startsWith("student-")) this.drawStudent(ctx, Number(sprite.type.split("-")[1]));
    else this.drawObject(ctx, sprite.type);
    if (sprite.hit) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "rgba(232,137,78,.72)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }

  drawDoorMarker(ctx, sprite) {
    const door = [...this.game.world.doors.values()].find(candidate => candidate.id === sprite.doorId);
    const label = door ? door.name.replace("教室捷径门", "").replace("教室连通门", "连通").replace("教室门", "").replace("门", "") : "出口";
    ctx.fillStyle = sprite.target ? "#e8894e" : "#a9c9ae";
    ctx.beginPath();
    ctx.roundRect(7, 46, 114, 53, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#242038";
    ctx.font = `bold ${sprite.target ? 15 : 14}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(sprite.target ? `目标 · ${label}` : label, 64, 77);
    ctx.beginPath();
    ctx.moveTo(52, 102);
    ctx.lineTo(76, 102);
    ctx.lineTo(64, 119);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(244,236,217,.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(25, 46);
    ctx.lineTo(25, 28);
    ctx.moveTo(103, 46);
    ctx.lineTo(103, 28);
    ctx.stroke();
  }

  drawZombie(ctx, sprite) {
    const type = sprite.type.split("-")[1];
    const step = sprite.frame ? 4 : -4;
    if (type === "sleepy") {
      ctx.fillStyle = "#59536f";
      ctx.beginPath();
      ctx.roundRect(35, 91, 60, 53, 12);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#242038";
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(46, 137); ctx.lineTo(43 - step, 153); ctx.moveTo(84, 137); ctx.lineTo(86 + step, 153); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.fillStyle = "#a9c9ae";
      ctx.beginPath(); ctx.roundRect(27, 23, 76, 78, 29); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#454158";
      ctx.beginPath(); ctx.moveTo(31, 52); ctx.quadraticCurveTo(28, 17, 68, 20); ctx.quadraticCurveTo(108, 22, 100, 53); ctx.lineTo(80, 38); ctx.lineTo(60, 45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f4ecd9";
      [49, 81].forEach(x => { ctx.beginPath(); ctx.arc(x, 61, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      ctx.strokeStyle = "#242038";
      ctx.lineWidth = 2;
      [49, 81].forEach(x => { ctx.beginPath(); ctx.moveTo(x - 5, 61); ctx.lineTo(x + 5, 61); ctx.moveTo(x, 56); ctx.lineTo(x, 66); ctx.stroke(); });
      ctx.lineWidth = 3;
      if (sprite.sleeping) {
        ctx.beginPath(); ctx.moveTo(54, 83); ctx.quadraticCurveTo(65, 77, 76, 83); ctx.stroke();
        ctx.fillStyle = "#f4c86a"; ctx.font = "bold 18px serif"; ctx.fillText("Z", 103, 26); ctx.font = "bold 12px serif"; ctx.fillText("Z", 115, 12);
      } else {
        ctx.beginPath(); ctx.moveTo(54, 84); ctx.lineTo(76, 84); ctx.stroke();
      }
      ctx.fillStyle = "#e8894e";
      ctx.fillRect(61, 98, 10, 29);
      ctx.fillStyle = "#f4ecd9";
      ctx.save(); ctx.translate(19, 102); ctx.rotate(-0.18); ctx.fillRect(0, 0, 28, 36); ctx.strokeRect(0, 0, 28, 36); ctx.restore();
    } else if (type === "paper") {
      ctx.fillStyle = "#f4ecd9";
      ctx.beginPath(); ctx.moveTo(34, 23); ctx.lineTo(67, 10); ctx.lineTo(98, 27); ctx.lineTo(91, 99); ctx.lineTo(65, 113); ctx.lineTo(34, 96); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(38, 105); ctx.lineTo(65, 115); ctx.lineTo(94, 103); ctx.lineTo(103, 145); ctx.lineTo(66, 154); ctx.lineTo(27, 143); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#c5b9cd"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(65, 14); ctx.lineTo(65, 108); ctx.moveTo(36, 28); ctx.lineTo(65, 47); ctx.lineTo(95, 29); ctx.moveTo(38, 123); ctx.lineTo(87, 116); ctx.stroke();
      ctx.fillStyle = "#655879";
      ctx.beginPath(); ctx.moveTo(43, 57); ctx.lineTo(58, 53); ctx.lineTo(54, 68); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(87, 57); ctx.lineTo(72, 53); ctx.lineTo(76, 68); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#242038"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(51, 83); ctx.lineTo(60, 78); ctx.lineTo(68, 84); ctx.lineTo(77, 78); ctx.stroke();
      ctx.strokeStyle = "#e8894e"; ctx.beginPath(); ctx.moveTo(42, 37); ctx.lineTo(54, 41); ctx.moveTo(76, 33); ctx.lineTo(89, 39); ctx.stroke();
    } else {
      ctx.fillStyle = "#514b65";
      ctx.beginPath(); ctx.roundRect(25, 92, 82, 52, 15); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#242038"; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(43, 139); ctx.lineTo(40 - step, 154); ctx.moveTo(89, 139); ctx.lineTo(92 + step, 154); ctx.stroke(); ctx.lineWidth = 4;
      ctx.fillStyle = "#e8894e";
      ctx.beginPath(); ctx.ellipse(65, 58, 48, 47, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#c6653e"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(65, 12); ctx.lineTo(65, 103); ctx.moveTo(43, 17); ctx.quadraticCurveTo(24, 57, 45, 98); ctx.moveTo(87, 17); ctx.quadraticCurveTo(106, 57, 85, 98); ctx.stroke();
      ctx.fillStyle = "#f4c86a"; ctx.strokeStyle = "#242038"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(31, 53); ctx.lineTo(53, 44); ctx.lineTo(50, 65); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(99, 53); ctx.lineTo(77, 44); ctx.lineTo(80, 65); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(45, 80); ctx.lineTo(56, 86); ctx.lineTo(66, 80); ctx.lineTo(76, 86); ctx.lineTo(87, 79); ctx.quadraticCurveTo(82, 101, 65, 100); ctx.quadraticCurveTo(48, 98, 45, 80); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4c86a"; ctx.fillRect(103, 112, 20, 30); ctx.strokeRect(103, 112, 20, 30);
    }
  }

  drawCat(ctx) {
    ctx.strokeStyle = "#242038";
    ctx.lineWidth = 4;
    ctx.fillStyle = "#d98a4b";
    ctx.beginPath(); ctx.ellipse(67, 116, 33, 36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(35, 63); ctx.lineTo(38, 23); ctx.lineTo(56, 41); ctx.quadraticCurveTo(67, 36, 78, 41); ctx.lineTo(96, 23); ctx.lineTo(96, 64); ctx.quadraticCurveTo(103, 100, 66, 101); ctx.quadraticCurveTo(29, 99, 35, 63); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f4ecd9";
    ctx.beginPath(); ctx.ellipse(65, 126, 20, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(65, 82, 25, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a9d7b5";
    ctx.beginPath(); ctx.ellipse(49, 64, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(82, 64, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#242038"; ctx.fillRect(47, 59, 3, 10); ctx.fillRect(80, 59, 3, 10);
    ctx.strokeStyle = "#a85d35"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(56, 42); ctx.lineTo(60, 50); ctx.moveTo(76, 42); ctx.lineTo(72, 50); ctx.stroke();
    ctx.fillStyle = "#a9c9ae"; ctx.strokeStyle = "#242038";
    ctx.beginPath(); ctx.moveTo(37, 96); ctx.quadraticCurveTo(65, 109, 94, 96); ctx.lineTo(91, 111); ctx.quadraticCurveTo(65, 120, 40, 109); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f4c86a"; ctx.beginPath(); ctx.arc(66, 111, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#d98a4b"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(93, 132); ctx.quadraticCurveTo(126, 129, 114, 102); ctx.stroke();
  }

  drawStudent(ctx, variant) {
    const colors = ["#e8894e", "#a9c9ae", "#8d80aa"];
    ctx.fillStyle = "#efc3a2";
    ctx.beginPath(); ctx.roundRect(30, 24, 70, 72, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ["#4a3540", "#3b3545", "#6a493b"][variant % 3];
    ctx.beginPath(); ctx.moveTo(32, 59); ctx.quadraticCurveTo(25, 17, 66, 18); ctx.quadraticCurveTo(108, 20, 99, 62); ctx.lineTo(85, 42); ctx.lineTo(51, 39); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#242038";
    ctx.beginPath(); ctx.arc(50, 62, 4, 0, Math.PI * 2); ctx.arc(81, 62, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#9c655c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(53, 81); ctx.quadraticCurveTo(65, 90, 78, 80); ctx.stroke();
    ctx.strokeStyle = "#242038"; ctx.lineWidth = 4; ctx.fillStyle = colors[variant % 3];
    ctx.beginPath(); ctx.roundRect(28, 94, 75, 52, 13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f4ecd9"; ctx.beginPath(); ctx.moveTo(48, 96); ctx.lineTo(65, 113); ctx.lineTo(82, 96); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#242038"; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(45, 141); ctx.lineTo(43, 154); ctx.moveTo(86, 141); ctx.lineTo(88, 154); ctx.stroke();
  }

  drawObject(ctx, type) {
    ctx.strokeStyle = "#242038";
    ctx.lineWidth = 4;
    if (type.startsWith("sign-")) {
      const labels = {
        "sign-security": ["保安室", "地图 · 安全屋"], "sign-lobby": ["大厅", "集合点 · 出口"],
        "sign-classrooms": ["101 · 102", "教室"], "sign-south": ["103 · 104", "教室 · 实验室"],
        "sign-medical": ["医务室", "实验室钥匙卡"], "sign-broadcast": ["广播室", "求救信号"]
      };
      const label = labels[type] || ["教学楼", "一层"];
      ctx.fillStyle = "#242038";
      ctx.beginPath(); ctx.roundRect(4, 43, 120, 64, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#e8894e"; ctx.fillRect(4, 43, 7, 64);
      ctx.fillStyle = "#f4ecd9"; ctx.font = "bold 17px sans-serif"; ctx.textAlign = "center"; ctx.fillText(label[0], 66, 70);
      ctx.fillStyle = "#f4c86a"; ctx.font = "10px sans-serif"; ctx.fillText(label[1], 66, 91);
      ctx.strokeStyle = "#827a70"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(30, 43); ctx.lineTo(30, 25); ctx.moveTo(100, 43); ctx.lineTo(100, 25); ctx.stroke();
    } else if (type === "paw") {
      ctx.fillStyle = "#f4c86a";
      ctx.beginPath(); ctx.ellipse(64, 91, 18, 14, 0, 0, Math.PI * 2); ctx.fill();
      [[43, 65], [58, 55], [76, 56], [88, 69]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); });
    } else if (type === "desk") {
      ctx.fillStyle = "#b5855d"; ctx.fillRect(13, 76, 102, 34); ctx.strokeRect(13, 76, 102, 34);
      ctx.fillStyle = "#51434a"; ctx.fillRect(22, 110, 9, 43); ctx.fillRect(96, 110, 9, 43);
      ctx.fillStyle = "#f4ecd9"; ctx.save(); ctx.translate(44, 65); ctx.rotate(-0.1); ctx.fillRect(0, 0, 43, 24); ctx.restore();
    } else if (type === "pumpkin" || type === "bomb") {
      ctx.fillStyle = "#e8894e"; ctx.beginPath(); ctx.ellipse(64, 102, 40, 37, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4c86a"; ctx.beginPath(); ctx.moveTo(35, 96); ctx.lineTo(53, 88); ctx.lineTo(50, 106); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(93, 96); ctx.lineTo(75, 88); ctx.lineTo(78, 106); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#718c68"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(65, 66); ctx.lineTo(71, 52); ctx.stroke();
    } else if (["ammo", "candy", "key", "keycard", "fuse", "map", "medicalKey", "labKey"].includes(type)) {
      ctx.fillStyle = "rgba(244,200,106,.16)"; ctx.beginPath(); ctx.arc(64, 100, 42, 0, Math.PI * 2); ctx.fill();
      if (type === "ammo") {
        ctx.fillStyle = "#e8894e"; ctx.beginPath(); ctx.roundRect(30, 70, 68, 58, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f4c86a"; ctx.fillRect(42, 80, 12, 34); ctx.fillRect(62, 80, 12, 34);
      } else if (type === "candy") {
        ctx.fillStyle = "#a9c9ae"; ctx.beginPath(); ctx.roundRect(37, 78, 54, 40, 14); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(38, 86); ctx.lineTo(20, 73); ctx.lineTo(24, 111); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(90, 86); ctx.lineTo(108, 73); ctx.lineTo(104, 111); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (["key", "medicalKey", "labKey"].includes(type)) {
        ctx.strokeStyle = "#f4c86a"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(48, 86, 17, 0, Math.PI * 2); ctx.moveTo(62, 98); ctx.lineTo(95, 129); ctx.moveTo(79, 113); ctx.lineTo(89, 103); ctx.moveTo(88, 122); ctx.lineTo(98, 112); ctx.stroke();
      } else if (type === "fuse") {
        ctx.fillStyle = "#a9c9ae"; ctx.beginPath(); ctx.roundRect(37, 70, 54, 66, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#827a70"; ctx.fillRect(31, 65, 66, 15); ctx.fillRect(31, 127, 66, 15);
      } else {
        ctx.fillStyle = "#f4ecd9"; ctx.save(); ctx.translate(28, 61); ctx.rotate(-0.08); ctx.fillRect(0, 0, 74, 76); ctx.strokeRect(0, 0, 74, 76); ctx.strokeStyle = "#655879"; ctx.lineWidth = 2; ctx.strokeRect(10, 14, 48, 34); ctx.restore();
      }
    } else if (type === "radio") {
      ctx.fillStyle = "#655879"; ctx.beginPath(); ctx.roundRect(18, 61, 94, 77, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#242038"; ctx.fillRect(29, 74, 51, 29); ctx.fillStyle = "#a9c9ae"; ctx.fillRect(34, 79, 41, 17);
      ctx.fillStyle = "#f4c86a"; ctx.beginPath(); ctx.arc(94, 82, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#f4ecd9"; ctx.beginPath(); ctx.moveTo(91, 60); ctx.lineTo(106, 25); ctx.stroke();
    } else if (type === "bed") {
      ctx.fillStyle = "#f4ecd9"; ctx.beginPath(); ctx.roundRect(8, 70, 112, 53, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#a9c9ae"; ctx.fillRect(14, 91, 101, 28); ctx.fillStyle = "#fff8e9"; ctx.fillRect(17, 75, 36, 20);
    } else if (type === "flask") {
      ctx.fillStyle = "rgba(169,201,174,.75)"; ctx.beginPath(); ctx.moveTo(53, 49); ctx.lineTo(75, 49); ctx.lineTo(75, 83); ctx.lineTo(103, 132); ctx.lineTo(25, 132); ctx.lineTo(53, 83); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#655879"; ctx.beginPath(); ctx.moveTo(39, 106); ctx.lineTo(89, 106); ctx.lineTo(101, 129); ctx.lineTo(27, 129); ctx.closePath(); ctx.fill();
    } else if (type === "box") {
      ctx.fillStyle = "#b58b61"; ctx.fillRect(21, 72, 86, 67); ctx.strokeRect(21, 72, 86, 67);
      ctx.fillStyle = "#f4ecd9"; ctx.font = "bold 16px serif"; ctx.textAlign = "center"; ctx.fillText("叉烧", 64, 111);
    } else if (type === "poster") {
      ctx.fillStyle = "#f4ecd9"; ctx.fillRect(28, 33, 73, 104); ctx.strokeRect(28, 33, 73, 104);
      ctx.fillStyle = "#e8894e"; ctx.beginPath(); ctx.arc(64, 72, 23, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#655879"; ctx.font = "bold 12px serif"; ctx.textAlign = "center"; ctx.fillText("万圣晚会", 64, 117);
    } else if (type === "spark" || type === "paperParticle") {
      ctx.fillStyle = type === "spark" ? "#f4c86a" : "#f4ecd9";
      if (type === "spark") { ctx.beginPath(); ctx.moveTo(64, 42); ctx.lineTo(73, 68); ctx.lineTo(95, 77); ctx.lineTo(73, 85); ctx.lineTo(64, 112); ctx.lineTo(55, 85); ctx.lineTo(33, 77); ctx.lineTo(55, 68); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(45, 55, 38, 48);
    } else {
      ctx.fillStyle = "#a9c9ae"; ctx.beginPath(); ctx.arc(64, 100, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }

  drawMiniMap() {
    const ctx = this.context;
    const scale = 3;
    const width = this.game.world.width * scale;
    const height = this.game.world.height * scale;
    const x0 = this.canvas.width - width - 22;
    const y0 = 82;
    ctx.fillStyle = "rgba(24,21,37,.74)";
    ctx.fillRect(x0 - 7, y0 - 7, width + 14, height + 14);
    for (const key of this.game.discovered) {
      const [x, y] = key.split(",").map(Number);
      const door = this.game.world.doorAt(x, y);
      ctx.fillStyle = door ? (door.locked ? "#655879" : "#e8894e") : "#a89b8d";
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale + 0.2, scale + 0.2);
    }
    ctx.fillStyle = "#f4c86a";
    ctx.beginPath();
    ctx.arc(x0 + this.game.player.x * scale, y0 + this.game.player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  renderMap(canvas) {
    const ctx = canvas.getContext("2d");
    const world = this.game.world;
    const scale = Math.min((canvas.width - 100) / world.width, (canvas.height - 80) / world.height);
    const offsetX = (canvas.width - world.width * scale) / 2;
    const offsetY = (canvas.height - world.height * scale) / 2 + 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e9dfcc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d8cbb7";
    ctx.font = "12px monospace";
    ctx.fillText("N ↑  七教一层 · 晚会疏散示意图", offsetX, 25);
    for (const key of this.game.discovered) {
      const [x, y] = key.split(",").map(Number);
      const door = world.doorAt(x, y);
      ctx.fillStyle = door ? (door.locked ? "#8a7890" : "#d68a53") : "#f8f1df";
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale + 0.3, scale + 0.3);
      if (!door) {
        ctx.strokeStyle = "rgba(80,66,72,.06)";
        ctx.strokeRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }
    ctx.strokeStyle = "#514552";
    ctx.lineWidth = 2;
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        if (world.grid[y][x] !== "#") continue;
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        if (!neighbors.some(([dx, dy]) => this.game.discovered.has(world.key(x + dx, y + dy)))) continue;
        ctx.fillStyle = "#625867";
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale + 0.2, scale + 0.2);
      }
    }
    world.rooms.forEach(room => {
      if (!this.game.discoveredRooms.has(room.id)) return;
      ctx.fillStyle = "#6d5e6c";
      ctx.font = `bold ${Math.max(10, scale * 0.55)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(room.name.replace(" · 安全屋", ""), offsetX + (room.x1 + room.x2 + 1) / 2 * scale, offsetY + (room.y1 + room.y2 + 1) / 2 * scale);
    });
    const target = this.game.getObjectiveTarget();
    if (target) {
      ctx.fillStyle = "#d5a73f";
      ctx.beginPath();
      ctx.arc(offsetX + target.x * scale, offsetY + target.y * scale, 6 + Math.sin(this.game.stats.elapsed * 4), 0, Math.PI * 2);
      ctx.fill();
    }
    const px = offsetX + this.game.player.x * scale;
    const py = offsetY + this.game.player.y * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.game.player.angle);
    ctx.fillStyle = "#c96539";
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.textAlign = "left";
  }
}

globalThis.Renderer = Renderer;