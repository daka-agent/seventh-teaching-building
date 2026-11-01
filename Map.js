class Door {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.id = `door-${x}-${y}`;
    this.name = options.name || "教室门";
    this.type = options.type || "normal";
    this.locked = Boolean(options.locked);
    this.key = options.key || null;
    this.oneWay = Boolean(options.oneWay);
    this.safe = Boolean(options.safe);
    this.openAmount = options.open ? 1 : 0;
    this.targetOpen = Boolean(options.open);
    this.broken = false;
    this.durability = 100;
    this.lastBang = 0;
  }

  get passable() {
    return this.openAmount >= 0.78;
  }

  update(delta) {
    const speed = this.broken ? 2.4 : 1.65;
    if (this.targetOpen) this.openAmount = Math.min(1, this.openAmount + delta * speed);
    else this.openAmount = Math.max(0, this.openAmount - delta * speed);
  }

  forceOpen() {
    this.broken = true;
    this.locked = false;
    this.targetOpen = true;
    this.durability = 0;
  }
}

class WorldMap {
  constructor() {
    this.width = 36;
    this.height = 24;
    this.grid = Array.from({ length: this.height }, () => Array(this.width).fill("#"));
    this.doors = new Map();
    this.rooms = [
      { id: "security", name: "保安室 · 安全屋", x1: 2, y1: 2, x2: 7, y2: 8 },
      { id: "class1", name: "101 教室", x1: 9, y1: 2, x2: 14, y2: 8 },
      { id: "class2", name: "102 教室", x1: 16, y1: 2, x2: 21, y2: 8 },
      { id: "medical", name: "医务室", x1: 23, y1: 2, x2: 28, y2: 8 },
      { id: "broadcast", name: "广播室", x1: 30, y1: 2, x2: 33, y2: 8 },
      { id: "lobby", name: "教学楼大厅", x1: 2, y1: 14, x2: 7, y2: 21 },
      { id: "class3", name: "103 教室", x1: 9, y1: 14, x2: 14, y2: 20 },
      { id: "class4", name: "104 教室", x1: 16, y1: 14, x2: 21, y2: 20 },
      { id: "lab", name: "化学实验室", x1: 23, y1: 14, x2: 28, y2: 20 },
      { id: "stairs", name: "楼梯间", x1: 30, y1: 14, x2: 33, y2: 20 },
      { id: "corridor", name: "一层主走廊", x1: 2, y1: 10, x2: 33, y2: 12 }
    ];
    this.rooms.forEach(room => this.carve(room.x1, room.y1, room.x2, room.y2));
    this.addDoor(4, 9, { name: "保安室门", safe: true });
    this.addDoor(11, 9, { name: "101 教室门" });
    this.addDoor(18, 9, { name: "102 教室门" });
    this.addDoor(25, 9, { name: "医务室门", locked: true, key: "medicalKey" });
    this.addDoor(31, 9, { name: "广播室门", type: "broadcast", locked: true });
    this.addDoor(4, 13, { name: "大厅门" });
    this.addDoor(11, 13, { name: "103 教室捷径门", type: "oneWay", locked: true, oneWay: true });
    this.addDoor(18, 13, { name: "104 教室门" });
    this.addDoor(25, 13, { name: "实验室门", locked: true, key: "labKey" });
    this.addDoor(31, 13, { name: "楼梯间门", type: "sealed", locked: true });
    this.addDoor(15, 17, { name: "教室连通门" });
    this.props = this.createProps();
  }

  carve(x1, y1, x2, y2) {
    for (let y = y1; y <= y2; y += 1) {
      for (let x = x1; x <= x2; x += 1) this.grid[y][x] = ".";
    }
  }

  addDoor(x, y, options) {
    const door = new Door(x, y, options);
    this.doors.set(this.key(x, y), door);
    this.grid[y][x] = "D";
  }

  key(x, y) {
    return `${x},${y}`;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  doorAt(x, y) {
    return this.doors.get(this.key(x, y)) || null;
  }

  getRoomAt(x, y) {
    return this.rooms.find(room => x >= room.x1 && x <= room.x2 && y >= room.y1 && y <= room.y2) || null;
  }

  isSolidCell(x, y) {
    if (!this.inBounds(x, y)) return true;
    const cell = this.grid[y][x];
    if (cell === "#") return true;
    if (cell === "D") return !this.doorAt(x, y).passable;
    return false;
  }

  isCircleSolid(x, y, radius = 0.2) {
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      const px = Math.floor(x + Math.cos(angle) * radius);
      const py = Math.floor(y + Math.sin(angle) * radius);
      if (this.isSolidCell(px, py)) return true;
    }
    return this.isSolidCell(Math.floor(x), Math.floor(y));
  }

  isStructuralCorner(hit, directionX, directionY) {
    if (!hit || hit.door || hit.cell !== "#") return false;
    const atStart = hit.wallX < 0.04;
    const atEnd = hit.wallX > 0.96;
    if (!atStart && !atEnd) return false;
    const along = hit.side === 0 ? directionY : directionX;
    const neighborDirection = (atStart ? 1 : -1) * (along > 0 ? -1 : 1);
    const x = hit.mapX + (hit.side === 1 ? neighborDirection : 0);
    const y = hit.mapY + (hit.side === 0 ? neighborDirection : 0);
    return !this.inBounds(x, y) || this.grid[y][x] !== "#";
  }

  castRay(x, y, directionX, directionY, maxDistance = 40) {
    let mapX = Math.floor(x);
    let mapY = Math.floor(y);
    const deltaX = directionX === 0 ? Infinity : Math.abs(1 / directionX);
    const deltaY = directionY === 0 ? Infinity : Math.abs(1 / directionY);
    const stepX = directionX < 0 ? -1 : 1;
    const stepY = directionY < 0 ? -1 : 1;
    let sideX = directionX < 0 ? (x - mapX) * deltaX : (mapX + 1 - x) * deltaX;
    let sideY = directionY < 0 ? (y - mapY) * deltaY : (mapY + 1 - y) * deltaY;
    let side = 0;

    for (let steps = 0; steps < 96; steps += 1) {
      if (sideX < sideY) {
        mapX += stepX;
        side = 0;
      } else {
        mapY += stepY;
        side = 1;
      }
      const distance = side === 0 ? sideX - deltaX : sideY - deltaY;
      if (side === 0) sideX += deltaX;
      else sideY += deltaY;
      if (distance > maxDistance || !this.inBounds(mapX, mapY)) return { distance: maxDistance, cell: "#", side, mapX, mapY, wallX: 0 };
      const cell = this.grid[mapY][mapX];
      if (cell === ".") continue;
      const wallXraw = side === 0 ? y + distance * directionY : x + distance * directionX;
      const wallX = wallXraw - Math.floor(wallXraw);
      if (cell === "D") {
        const door = this.doorAt(mapX, mapY);
        if (door.openAmount >= 0.995 || wallX < door.openAmount) continue;
        return { distance, cell, door, side, mapX, mapY, wallX };
      }
      return { distance, cell, side, mapX, mapY, wallX };
    }
    return { distance: maxDistance, cell: "#", side, mapX, mapY, wallX: 0 };
  }

  isNavigableForZombie(x, y) {
    if (!this.inBounds(x, y)) return false;
    const cell = this.grid[y][x];
    if (cell === ".") return true;
    if (cell !== "D") return false;
    const door = this.doorAt(x, y);
    if (door.safe || door.type === "sealed") return false;
    if (door.passable || door.broken) return true;
    if (door.type === "broadcast") return false;
    return !door.locked && (door.type === "normal" || door.type === "oneWay");
  }

  isNavigableForGuide(x, y) {
    if (!this.inBounds(x, y)) return false;
    const cell = this.grid[y][x];
    if (cell === ".") return true;
    if (cell !== "D") return false;
    return this.doorAt(x, y).type !== "sealed";
  }

  findPath(startX, startY, targetX, targetY, guidance = false) {
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    const tx = Math.floor(targetX);
    const ty = Math.floor(targetY);
    if (sx === tx && sy === ty) return [];
    const queue = [{ x: sx, y: sy }];
    const visited = new Set([this.key(sx, sy)]);
    const previous = new Map();
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let found = false;

    for (let cursor = 0; cursor < queue.length && cursor < 900; cursor += 1) {
      const current = queue[cursor];
      for (const [dx, dy] of directions) {
        const x = current.x + dx;
        const y = current.y + dy;
        const key = this.key(x, y);
        const navigable = guidance ? this.isNavigableForGuide(x, y) : this.isNavigableForZombie(x, y);
        if (visited.has(key) || !navigable) continue;
        visited.add(key);
        previous.set(key, current);
        if (x === tx && y === ty) {
          found = true;
          cursor = queue.length;
          break;
        }
        queue.push({ x, y });
      }
    }
    if (!found) return [];
    const path = [];
    let current = { x: tx, y: ty };
    while (current.x !== sx || current.y !== sy) {
      path.unshift({ x: current.x + 0.5, y: current.y + 0.5 });
      current = previous.get(this.key(current.x, current.y));
      if (!current) return [];
    }
    return path;
  }

  createProps() {
    const props = [];
    const deskRooms = [
      [9, 2, "class1"], [16, 2, "class2"], [9, 14, "class3"], [16, 14, "class4"]
    ];
    deskRooms.forEach(([x, y, room]) => {
      [[1.5, 1.6], [3.5, 1.6], [1.5, 4.5], [3.5, 4.5]].forEach(([dx, dy], index) => {
        props.push({ type: "desk", x: x + dx, y: y + dy, scale: 0.42, id: `${room}-desk-${index}` });
      });
      props.push({ type: "poster", x: x + 4.8, y: y + 0.35, scale: 0.4, id: `${room}-poster` });
    });
    [[6.5, 10.4], [14.5, 11.6], [22.5, 10.4], [29.5, 11.6]].forEach(([x, y], index) => {
      props.push({ type: "pumpkin", x, y, scale: 0.3, id: `corridor-pumpkin-${index}`, light: true });
    });
    [
      ["sign-security", 4.5, 10.35], ["sign-lobby", 4.5, 11.65],
      ["sign-classrooms", 14.5, 10.35], ["sign-south", 18.5, 11.65],
      ["sign-medical", 25.5, 10.35], ["sign-broadcast", 31.5, 11.55]
    ].forEach(([type, x, y], index) => props.push({ type, x, y, scale: 0.52, id: `wayfinding-${index}`, z: 0.45 }));
    props.push({ type: "radio", x: 32.2, y: 3.1, scale: 0.5, id: "broadcast-console" });
    props.push({ type: "bed", x: 26.5, y: 3.2, scale: 0.5, id: "medical-bed" });
    props.push({ type: "flask", x: 26.5, y: 16.1, scale: 0.42, id: "lab-flask" });
    props.push({ type: "box", x: 3.1, y: 3.1, scale: 0.4, id: "cat-box" });
    return props;
  }
}

globalThis.Door = Door;
globalThis.WorldMap = WorldMap;