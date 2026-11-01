class Game {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.mode = "atmosphere";
    this.state = "menu";
    this.settings = this.loadSettings();
    this.audio = new AudioSystem();
    this.audio.enabled = this.settings.sound;
    this.timers = {};
    this.settingsReturn = "menu";
    this.saveKey = "seventh-teaching-building-save-v1";
    this.orientationBlocked = false;
    this.resizeFrame = 0;
    this.resetData(this.mode);
    this.renderer = WebGLRenderer.create(this.canvas, this) || new Renderer(this.canvas, this);
    this.input = new Input(this.canvas, this);
    this.bindUI();
    this.bindMobileLifecycle();
    this.applySettings();
    this.updateInputMode();
    this.updateContinueButton();
    this.lastTime = performance.now();
    this.hudTimer = 0;
    requestAnimationFrame(time => this.loop(time));
  }

  resetData(mode) {
    this.mode = mode;
    this.world = new WorldMap();
    this.player = new Player();
    this.weapon = new WeaponSystem(mode);
    this.zombies = this.createZombies();
    this.items = this.createItems();
    this.students = this.createStudents();
    this.rescued = new Set();
    this.inventory = new Set();
    this.candy = 0;
    this.particles = [];
    this.stats = { elapsed: 0, shots: 0, purified: 0 };
    this.flags = {
      hasMap: false,
      broadcastStarted: false,
      broadcastComplete: false,
      broadcastTime: 0,
      defenseDuration: mode === "atmosphere" ? 30 : 45,
      defenseSpawnStage: 0
    };
    this.discovered = new Set();
    this.discoveredRooms = new Set();
    this.currentInteraction = null;
    this.guidance = { path: [], timer: 0, waypoint: null, target: null };
    this.cat = { id: "cat", kind: "cat", x: 4.8, y: 16.4 };
    this.objective = "前往保安室，寻找教学楼地图";
    this.safeSaveTimer = 0;
    this.dropCounter = 0;
    this.reviving = false;
  }

  createZombies() {
    const data = [
      ["z01", "sleepy", 11.5, 5.8, true], ["z02", "sleepy", 13.2, 3.1, true],
      ["z03", "paper", 18.2, 4.5, true], ["z04", "paper", 20.1, 7.1, true], ["z05", "sleepy", 17.4, 7.2, true],
      ["z06", "paper", 11.2, 17.5, true], ["z07", "paper", 13.4, 15.3, true],
      ["z08", "sleepy", 18.2, 17.8, true], ["z09", "sleepy", 20.1, 15.2, true],
      ["z10", "sleepy", 25.2, 5.6, true], ["z11", "paper", 27.1, 7.1, true],
      ["z12", "pumpkin", 25.4, 17.4, true], ["z13", "paper", 27.2, 15.4, true], ["z14", "paper", 24.1, 19.1, true],
      ["z15", "sleepy", 15.5, 11.4, false]
    ];
    return data.map(([id, type, x, y, dormant]) => new Zombie({ id, type, x, y, dormant }));
  }

  createItems() {
    const data = [
      ["map", "map", 4.3, 4.1, 1, "教学楼地图"],
      ["ammo-lobby", "ammo", 6.1, 18.5, 6, "糖果弹药 ×6"],
      ["ammo-security", "ammo", 6.2, 6.5, 9, "糖果弹药 ×9"],
      ["candy-security", "candy", 3.1, 6.7, 1, "恢复糖果"],
      ["medical-key", "medicalKey", 12.7, 3.4, 1, "医务室钥匙"],
      ["ammo-101", "ammo", 9.8, 7.2, 6, "糖果弹药 ×6"],
      ["candy-102", "candy", 20.1, 3.1, 1, "恢复糖果"],
      ["ammo-102", "ammo", 16.8, 5.6, 6, "糖果弹药 ×6"],
      ["lab-key", "labKey", 24.1, 6.7, 1, "实验室钥匙卡"],
      ["candy-medical", "candy", 27.1, 4.1, 1, "恢复糖果"],
      ["fuse", "fuse", 26.4, 18.5, 1, "广播室保险丝"],
      ["bomb-lab", "bomb", 23.8, 15.1, 1, "南瓜弹"],
      ["ammo-lab", "ammo", 27.2, 19.1, 9, "糖果弹药 ×9"],
      ["ammo-103", "ammo", 10.1, 19.1, 6, "糖果弹药 ×6"],
      ["candy-104", "candy", 20.2, 19.1, 1, "恢复糖果"],
      ["bomb-corridor", "bomb", 21.5, 11.5, 1, "南瓜弹"],
      ["ammo-broadcast", "ammo", 30.8, 6.8, 9, "糖果弹药 ×9"]
    ];
    return data.map(([id, type, x, y, amount, name]) => ({ id, type, x, y, amount, name, collected: false }));
  }

  createStudents() {
    return [
      { id: "student1", name: "林小满", variant: 0, x: 10.2, y: 3.4, rescued: false, line: "我就知道广播会有人来听。医务室钥匙放在讲台边了，我先去保安室等大家。" },
      { id: "student2", name: "周禾", variant: 1, x: 26.4, y: 5.2, rescued: false, line: "我没事，只是腿有点软。实验室钥匙卡给你，广播室的保险丝一定还在那里。" },
      { id: "student3", name: "陈星", variant: 2, x: 31.3, y: 4.1, rescued: false, line: "求救带还在，但机器缺了保险丝。装好以后，我陪着你把信号发出去。" }
    ];
  }

  bindUI() {
    document.querySelectorAll("[data-mode]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-mode]").forEach(other => other.classList.toggle("selected", other === button));
        this.mode = button.dataset.mode;
      });
    });
    document.getElementById("newGameButton").addEventListener("click", () => this.startNew());
    document.getElementById("continueButton").addEventListener("click", () => this.continueGame());
    document.getElementById("resumeButton").addEventListener("click", () => this.resume());
    document.getElementById("closeMapButton").addEventListener("click", () => this.closeMap());
    document.getElementById("screenshotButton").addEventListener("click", () => this.captureScreenshot());
    document.getElementById("pauseScreenshotButton").addEventListener("click", () => this.captureScreenshot());
    document.getElementById("closeScreenshotButton").addEventListener("click", () => this.closeScreenshot());
    document.getElementById("restartButton").addEventListener("click", () => this.startNew());
    document.getElementById("endingRestartButton").addEventListener("click", () => this.startNew());
    document.getElementById("backMenuButton").addEventListener("click", () => this.returnToMenu());
    document.getElementById("openSettingsButton").addEventListener("click", () => this.openSettings("menu"));
    document.getElementById("pauseSettingsButton").addEventListener("click", () => this.openSettings("pause"));
    document.getElementById("closeSettingsButton").addEventListener("click", () => this.closeSettings());
    const bindings = [
      ["soundSetting", "sound"], ["subtitleSetting", "subtitles"], ["guideSetting", "routeGuide"], ["motionSetting", "reducedMotion"],
      ["brightnessSetting", "brightness"], ["sensitivitySetting", "sensitivity"]
    ];
    bindings.forEach(([id, key]) => {
      document.getElementById(id).addEventListener("input", event => {
        this.settings[key] = event.target.type === "checkbox" ? event.target.checked : Number(event.target.value);
        this.applySettings();
        this.saveSettings();
      });
    });
  }

  startNew() {
    try { localStorage.removeItem(this.saveKey); } catch {}
    this.resetData(this.mode);
    this.audio.init();
    this.enterPlaying();
    this.showSubtitle("叉烧", "喵。先去保安室，那里还亮着灯。", 4);
    this.showToast(this.input.isTouchMode() ? "左侧摇杆移动 · 右侧拖动观察 · 跟随橙色爪印" : "轻移鼠标观察 · W 朝准星方向前进 · 跟随橙色爪印");
  }

  continueGame() {
    let save;
    try {
      save = JSON.parse(localStorage.getItem(this.saveKey));
    } catch {
      save = null;
    }
    if (!save) {
      this.startNew();
      return;
    }
    this.resetData(save.mode || "atmosphere");
    this.mode = save.mode || "atmosphere";
    this.player.restore(save.player);
    this.weapon.restore(save.weapon);
    this.stats = { ...this.stats, ...save.stats };
    this.inventory = new Set(save.inventory || []);
    this.candy = save.candy || 0;
    this.rescued = new Set(save.rescued || []);
    this.students.forEach(student => student.rescued = this.rescued.has(student.id));
    this.flags = { ...this.flags, ...save.flags };
    if (this.flags.broadcastStarted && !this.flags.broadcastComplete) {
      this.flags.broadcastStarted = false;
      this.flags.broadcastTime = 0;
      this.flags.defenseSpawnStage = 0;
    }
    this.discovered = new Set(save.discovered || []);
    this.discoveredRooms = new Set(save.discoveredRooms || []);
    this.items.forEach(item => item.collected = (save.collected || []).includes(item.id));
    this.zombies.forEach(zombie => {
      if ((save.purified || []).includes(zombie.id)) {
        zombie.purified = true;
        zombie.removed = true;
      }
    });
    (save.doors || []).forEach(data => {
      const door = this.world.doors.get(data.id);
      if (!door) return;
      door.locked = data.locked;
      door.openAmount = data.openAmount;
      door.targetOpen = data.targetOpen;
      door.broken = data.broken;
      door.durability = data.durability;
    });
    this.audio.init();
    this.enterPlaying();
    this.showSubtitle("叉烧", "欢迎回来。保安室的灯一直亮着。", 3);
  }

  enterPlaying() {
    this.state = "playing";
    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("pauseScreen").classList.add("hidden");
    document.getElementById("endingScreen").classList.add("hidden");
    document.getElementById("mapScreen").classList.add("hidden");
    document.getElementById("hud").classList.remove("hidden");
    this.input.clear();
    this.updateDiscovery();
    this.updateObjective();
    this.updateHUD();
    this.updateLayout();
    if (this.state !== "playing" || this.checkEnding()) return;
    this.requestPointerLock();
  }

  loop(time) {
    const delta = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    if (this.state === "playing") this.update(delta);
    try {
      this.renderer.render();
    } catch (error) {
      this.recoverRenderer(error);
    }
    requestAnimationFrame(next => this.loop(next));
  }

  recoverRenderer(error) {
    if (!this.renderer.isWebGL) {
      console.error("兼容渲染发生错误", error);
      return;
    }
    console.warn("WebGL 渲染中断，已恢复为兼容画面。", error);
    this.renderer = new Renderer(this.canvas, this);
    this.renderer.resize();
    this.showToast("图形画面已自动恢复，当前探索进度已保留");
  }

  update(delta) {
    this.stats.elapsed += delta;
    this.player.update(delta, this.input, this);
    this.weapon.update(delta, this);
    this.world.doors.forEach(door => door.update(delta));
    this.zombies.forEach(zombie => zombie.update(delta, this));
    this.updateParticles(delta);
    this.updateDiscovery();
    this.updateDefense(delta);
    if (this.checkEnding()) return;
    this.updateObjective();
    this.updateGuidance(delta);
    this.currentInteraction = this.getInteraction();
    this.updateInteractionPrompt();
    this.hudTimer -= delta;
    if (this.hudTimer <= 0) {
      this.updateHUD();
      this.hudTimer = 0.08;
    }
    const room = this.world.getRoomAt(this.player.x, this.player.y);
    if (room && room.id === "security") {
      this.safeSaveTimer -= delta;
      if (this.safeSaveTimer <= 0) {
        this.saveGame();
        this.safeSaveTimer = 8;
      }
    } else this.safeSaveTimer = 0;
  }

  checkEnding() {
    if (this.state !== "playing" || !this.flags.broadcastComplete) return false;
    if (this.world.getRoomAt(this.player.x, this.player.y)?.id !== "lobby") return false;
    this.finishGame();
    return true;
  }

  handleAction(action) {
    const screenshotOpen = !document.getElementById("screenshotScreen").classList.contains("hidden");
    const settingsOpen = !document.getElementById("settingsScreen").classList.contains("hidden");
    if (action === "pause" && screenshotOpen) {
      this.closeScreenshot();
      return;
    }
    if (action === "pause" && settingsOpen) {
      this.closeSettings();
      return;
    }
    if (action === "screenshot" && ["playing", "pause"].includes(this.state) && !screenshotOpen) {
      this.captureScreenshot();
      return;
    }
    if (action === "map") {
      if (this.state === "playing") this.openMap();
      else if (this.state === "map") this.closeMap();
      return;
    }
    if (action === "pause") {
      if (this.state === "map") this.closeMap();
      else if (this.state === "playing") this.pause();
      else if (this.state === "pause") this.resume();
      return;
    }
    if (this.state !== "playing") return;
    if (action === "interact") this.interact();
    if (action === "reload") this.weapon.reload(this);
    if (action === "bomb") this.weapon.useBomb(this);
    if (action === "candy") this.useCandy();
    if (action === "flashlight") {
      this.player.flashlight = !this.player.flashlight;
      this.audio.tone(280, 0.06, "square", 0.025, this.player.flashlight ? 80 : -60);
      this.showToast(this.player.flashlight ? "手电已打开" : "手电已关闭，南瓜灯仍会提供指引");
    }
  }

  fireWeapon() {
    this.weapon.fire(this);
  }

  getInteraction() {
    const candidates = [];
    const add = (kind, target, x, y, range, label) => {
      const distance = Math.hypot(this.player.x - x, this.player.y - y);
      if (distance <= range) candidates.push({ kind, target, distance, label });
    };
    this.items.filter(item => !item.collected).forEach(item => add("item", item, item.x, item.y, 1.05, `拾取 ${item.name}`));
    this.students.filter(student => !student.rescued).forEach(student => add("student", student, student.x, student.y, 1.35, `与 ${student.name} 交谈`));
    add("cat", this.cat, this.cat.x, this.cat.y, 1.3, "摸摸叉烧，听听它的提示");
    if (!this.flags.broadcastComplete) add("console", null, 32.2, 3.1, 1.4, this.flags.broadcastStarted ? "查看求救信号" : "使用广播控制台");

    this.world.doors.forEach(door => add("door", door, door.x + 0.5, door.y + 0.5, 1.25, this.getDoorLabel(door)));
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] || null;
  }

  getDoorLabel(door) {
    if (door.broken) return `${door.name}已损坏`;
    if (door.locked) return `查看 ${door.name}`;
    return door.targetOpen ? `关上 ${door.name}` : `打开 ${door.name}`;
  }

  interact() {
    const interaction = this.currentInteraction || this.getInteraction();
    if (!interaction) return;
    if (interaction.kind === "item") this.collectItem(interaction.target);
    if (interaction.kind === "student") this.rescueStudent(interaction.target);
    if (interaction.kind === "cat") this.talkToCat();
    if (interaction.kind === "door") this.useDoor(interaction.target);
    if (interaction.kind === "console") this.useConsole();

  }

  useDoor(door) {
    if (door.broken) {
      this.showToast("门锁已经损坏，这扇门无法再次关闭");
      return;
    }
    if (door.type === "sealed") {
      this.audio.locked();
      this.showSubtitle("旁白", "楼梯间被晚会布景架牢牢挡住，暂时无法通行。", 2.5);
      return;
    }
    if (door.type === "broadcast" && door.locked) {
      if (!this.inventory.has("fuse")) {
        this.audio.locked();
        this.showSubtitle("门锁", "电子锁没有电。需要找到广播设备使用的保险丝。", 3);
        return;
      }
      if (this.rescued.size < 2) {
        this.audio.locked();
        this.showSubtitle("叉烧", "还有同学没找到。先把医务室附近的人带回来吧。", 3);
        return;
      }
      door.locked = false;
      this.showToast("保险丝让电子锁恢复了供电");
    }
    if (door.oneWay && door.locked) {
      if (this.player.y > door.y) {
        door.locked = false;
        this.showToast("捷径已从教室内侧解锁");
        this.audio.pickup();
      } else {
        this.audio.locked();
        this.showSubtitle("旁白", "门从另一侧锁住了。也许能通过 104 教室绕过去。", 3);
        return;
      }
    }
    if (door.locked && door.key) {
      if (!this.inventory.has(door.key)) {
        this.audio.locked();
        const hint = door.key === "medicalKey" ? "门锁着。101 教室的晚会记录里提到过备用钥匙。" : "需要实验室钥匙卡。医务室里也许有登记卡。";
        this.showSubtitle("门锁", hint, 3);
        return;
      }
      door.locked = false;
      this.showToast(`使用${door.key === "medicalKey" ? "医务室钥匙" : "实验室钥匙卡"}解锁`);
      this.audio.pickup();
    }
    if (door.targetOpen && door.passable) door.targetOpen = false;
    else {
      door.targetOpen = true;
      this.noise(door.x + 0.5, door.y + 0.5, 2.8);
    }
    this.audio.door();
  }

  collectItem(item) {
    if (item.collected) return;
    let ammoResult = null;
    if (item.type === "ammo") {
      ammoResult = this.weapon.addAmmo(item.amount);
      if (ammoResult.added === 0) {
        this.showToast("弹仓和备用弹药都已满，这份弹药先留在原地");
        return;
      }
    }
    item.collected = true;
    if (item.type === "candy") this.candy = Math.min(5, this.candy + 1);
    if (item.type === "bomb") this.weapon.bombs = Math.min(3, this.weapon.bombs + 1);
    if (["medicalKey", "labKey", "fuse"].includes(item.type)) this.inventory.add(item.type);
    if (item.type === "map") {
      this.flags.hasMap = true;
      this.showSubtitle("旁白", "地图背面写着：保安室是安全屋，进来时会自动记录探索进度。", 4);
    } else if (item.type === "ammo") {
      const changes = [];
      if (ammoResult.magazine) changes.push(`弹仓 +${ammoResult.magazine}`);
      if (ammoResult.reserve) changes.push(`备用 +${ammoResult.reserve}`);
      this.showToast(`${changes.join(" · ")}｜弹仓 ${this.weapon.ammo}/6，备用 ${this.weapon.reserve}`);
      const card = document.getElementById("ammoCard");
      card.classList.remove("pickup");
      void card.offsetWidth;
      card.classList.add("pickup");
      clearTimeout(this.timers.ammo);
      this.timers.ammo = setTimeout(() => card.classList.remove("pickup"), 450);
      this.updateHUD();
    } else this.showToast(`获得：${item.name}`);
    this.audio.pickup();
  }

  useCandy() {
    if (this.candy <= 0) {
      this.showToast("口袋里没有恢复糖果");
      return;
    }
    if (this.player.health >= 100) {
      this.showToast("现在状态很好，把糖果留着吧");
      return;
    }
    this.candy -= 1;
    this.player.heal(42);
    this.audio.pickup();
    this.showToast("甜甜的味道让人安心了一些 · 状态恢复");
  }

  rescueStudent(student) {
    if (student.rescued) return;
    student.rescued = true;
    this.rescued.add(student.id);
    this.audio.rescue();
    this.showSubtitle(student.name, student.line, 5.5);
    this.showToast(`${student.name} 已前往保安室 · 找到 ${this.rescued.size} / 3 名同学`);
  }

  talkToCat() {
    this.audio.meow();
    let hint = "保安室的灯一直亮着，累了就回去休息。";
    if (!this.flags.hasMap) hint = "先跟叉烧去保安室，地图就在桌上。";
    else if (!this.rescued.has("student1")) hint = "101 教室有翻课本的声音，小满也许还在那里。";
    else if (!this.rescued.has("student2")) hint = "拿到钥匙后，沿走廊去找医务室。";
    else if (!this.inventory.has("fuse")) hint = "实验室里有一股薄荷味。保险丝可能还在操作台上。";
    else if (!this.rescued.has("student3")) hint = "广播室就在走廊东边，陈星一定在等信号恢复。";
    else if (!this.flags.broadcastComplete) hint = "启动广播后别走远，信号需要一点时间才能发出去。";
    else hint = "大家都到齐了。回大厅，一起回家。";
    this.showSubtitle("叉烧", `喵。${hint}`, 4.5);
  }

  useConsole() {
    if (!this.rescued.has("student3")) {
      this.showSubtitle("陈星的声音", "有人吗？我还在广播室里面。", 2.5);
      return;
    }
    if (this.flags.broadcastComplete) return;
    if (this.flags.broadcastStarted) {
      this.showToast("信号正在发送，请留在广播室");
      return;
    }
    this.flags.broadcastStarted = true;
    this.flags.broadcastTime = this.flags.defenseDuration;
    this.flags.defenseSpawnStage = 1;
    this.audio.broadcast();
    this.noise(31.5, 4.5, 30);
    this.spawnDefenseGroup(1);
    this.showSubtitle("陈星", "信号开始发送了！声音会引来它们，守住这里，我陪着你。", 4);
  }

  updateDefense(delta) {
    if (!this.flags.broadcastStarted || this.flags.broadcastComplete) return;
    const room = this.world.getRoomAt(this.player.x, this.player.y);
    if (room && room.id === "broadcast") this.flags.broadcastTime = Math.max(0, this.flags.broadcastTime - delta);
    const progress = 1 - this.flags.broadcastTime / this.flags.defenseDuration;
    if (progress >= 0.34 && this.flags.defenseSpawnStage === 1) {
      this.flags.defenseSpawnStage = 2;
      this.spawnDefenseGroup(2);
      this.showSubtitle("广播杂音", "走廊里传来纸张摩擦声……", 2.5);
    }
    if (progress >= 0.68 && this.flags.defenseSpawnStage === 2) {
      this.flags.defenseSpawnStage = 3;
      this.spawnDefenseGroup(3);
      this.showSubtitle("陈星", "再坚持一下，信号已经快发出去了！", 2.5);
    }
    if (this.flags.broadcastTime <= 0) {
      this.flags.broadcastComplete = true;
      this.flags.broadcastStarted = false;
      this.audio.rescue();
      this.showSubtitle("校外救援队", "信号收到。请到大厅集合，我们马上打开校门。", 5);
      this.showToast("求救成功 · 返回大厅，和大家一起离开");
    }
  }

  spawnDefenseGroup(stage) {
    const groups = {
      1: [["paper", 28.5, 11.5], ["sleepy", 24.5, 10.5]],
      2: [["paper", 19.5, 11.5], ["paper", 27.5, 10.5], ["sleepy", 22.5, 12.4]],
      3: [["pumpkin", 25.5, 11.5], ["paper", 29.2, 10.4]]
    };
    (groups[stage] || []).forEach(([type, x, y], index) => {
      const zombie = new Zombie({ id: `defense-${stage}-${index}-${Date.now()}`, type, x, y, dormant: false });
      zombie.alert = true;
      this.zombies.push(zombie);
    });
  }

  onZombiePurified(zombie) {
    for (let index = 0; index < 12; index += 1) {
      const life = 0.55 + Math.random() * 0.65;
      this.particles.push({
        type: index % 3 === 0 ? "spark" : "paperParticle",
        x: zombie.x,
        y: zombie.y,
        z: 0.35 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        vz: 0.4 + Math.random() * 0.5,
        scale: 0.07 + Math.random() * 0.06,
        life,
        maxLife: life
      });
    }
    if (Math.random() < (this.mode === "atmosphere" ? 0.32 : 0.2)) {
      const type = Math.random() < 0.55 ? "ammo" : "candy";
      this.items.push({ id: `drop-${this.dropCounter += 1}`, type, x: zombie.x, y: zombie.y, amount: type === "ammo" ? 3 : 1, name: type === "ammo" ? "糖果弹药 ×3" : "恢复糖果", collected: false });
    }
  }

  updateParticles(delta) {
    this.particles.forEach(particle => {
      particle.life -= delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
      particle.vz -= delta * 1.3;
      if (particle.z < 0.05) {
        particle.z = 0.05;
        particle.vz *= -0.25;
      }
    });
    this.particles = this.particles.filter(particle => particle.life > 0);
  }

  noise(x, y, radius) {
    this.zombies.forEach(zombie => zombie.hear(x, y, radius));
  }

  getNPCs() {
    const npcs = this.students.filter(student => !student.rescued).map(student => ({ ...student, kind: "student" }));
    const safePositions = [{ x: 3.2, y: 4.8 }, { x: 5.1, y: 3.3 }, { x: 6.1, y: 5.1 }];
    this.students.filter(student => student.rescued).forEach(student => npcs.push({ ...student, ...safePositions[Number(student.id.slice(-1)) - 1], kind: "student" }));
    npcs.push(this.cat);
    return npcs;
  }

  updateDiscovery() {
    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);
    for (let y = py - 2; y <= py + 2; y += 1) {
      for (let x = px - 2; x <= px + 2; x += 1) {
        if (this.world.inBounds(x, y) && this.world.grid[y][x] !== "#") this.discovered.add(this.world.key(x, y));
      }
    }
    const room = this.world.getRoomAt(this.player.x, this.player.y);
    if (room) this.discoveredRooms.add(room.id);
  }

  updateObjective() {
    this.objective = this.getObjectiveText();
    this.updateCatPosition();
  }

  getObjectiveText() {
    if (!this.flags.hasMap) return "前往保安室，寻找教学楼地图";
    if (!this.rescued.has("student1")) return "探索 101 教室，寻找林小满";
    if (!this.inventory.has("medicalKey")) return "在 101 教室寻找医务室钥匙";
    if (!this.rescued.has("student2")) return "解锁医务室，寻找周禾";
    if (!this.inventory.has("labKey")) return "在医务室寻找实验室钥匙卡";
    if (!this.inventory.has("fuse")) return "进入化学实验室，找到保险丝";
    if (!this.rescued.has("student3")) return "恢复广播室门锁供电，寻找陈星";
    if (!this.flags.broadcastStarted && !this.flags.broadcastComplete) return "启动广播控制台，发送求救信号";
    if (this.flags.broadcastStarted) {
      const room = this.world.getRoomAt(this.player.x, this.player.y);
      return room && room.id === "broadcast" ? `留在广播室，守住求救信号 · ${Math.ceil(this.flags.broadcastTime)} 秒` : "返回广播室，信号发送已暂停";
    }
    return "返回大厅，和大家一起离开";
  }

  getObjectiveTarget() {
    if (!this.flags.hasMap) return { x: 4.3, y: 4.1 };
    if (!this.rescued.has("student1")) return { x: 10.2, y: 3.4 };
    if (!this.inventory.has("medicalKey")) return { x: 12.7, y: 3.4 };
    if (!this.rescued.has("student2")) return { x: 26.4, y: 5.2 };
    if (!this.inventory.has("labKey")) return { x: 24.1, y: 6.7 };
    if (!this.inventory.has("fuse")) return { x: 26.4, y: 18.5 };
    if (!this.rescued.has("student3")) return { x: 31.3, y: 4.1 };
    if (!this.flags.broadcastComplete) return { x: 32.2, y: 3.1 };
    return { x: 4.5, y: 17.5 };
  }

  updateCatPosition() {
    const target = this.getObjectiveTarget();
    if (!target) return;
    if (this.isPlayerInSafeRoom()) {
      this.cat.x = 3.8;
      this.cat.y = 3.4;
      return;
    }
    if (this.flags.broadcastComplete) {
      this.cat.x = 4.8;
      this.cat.y = 16.4;
      return;
    }
    const room = this.world.getRoomAt(target.x, target.y);
    if (!room) return;
    const x = Math.max(room.x1 + 0.6, Math.min(room.x2 - 0.5, target.x + 0.7));
    const y = Math.max(room.y1 + 0.6, Math.min(room.y2 - 0.5, target.y + 0.7));
    if (Math.hypot(this.player.x - this.cat.x, this.player.y - this.cat.y) > 5 || this.world.getRoomAt(this.cat.x, this.cat.y)?.id !== room.id) {
      this.cat.x = x;
      this.cat.y = y;
    }
  }

  updateGuidance(delta) {
    this.guidance.timer -= delta;
    if (this.guidance.timer <= 0) {
      const target = this.getObjectiveTarget();
      this.guidance.target = target;
      this.guidance.path = target ? this.world.findPath(this.player.x, this.player.y, target.x, target.y, true) : [];
      this.guidance.timer = 0.35;
    }
    while (this.guidance.path.length && Math.hypot(this.player.x - this.guidance.path[0].x, this.player.y - this.guidance.path[0].y) < 0.24) this.guidance.path.shift();
    this.guidance.waypoint = this.guidance.path[0] || this.guidance.target;
  }

  updateRouteGuide() {
    const guide = document.getElementById("routeGuide");
    guide.classList.toggle("hidden", !this.settings.routeGuide);
    if (!this.settings.routeGuide) return;
    const target = this.guidance.target || this.getObjectiveTarget();
    const waypoint = this.guidance.waypoint || target;
    if (!target || !waypoint) return;
    const angle = Math.atan2(waypoint.y - this.player.y, waypoint.x - this.player.x);
    const difference = Math.atan2(Math.sin(angle - this.player.angle), Math.cos(angle - this.player.angle));
    document.getElementById("guideArrow").style.transform = `rotate(${difference}rad)`;
    document.getElementById("guideDistance").textContent = `${Math.max(1, Math.round(Math.hypot(target.x - this.player.x, target.y - this.player.y) * 1.5))} 米`;
    const room = this.world.getRoomAt(target.x, target.y);
    const offscreen = Math.abs(difference) > Math.PI / 3;
    guide.classList.toggle("offscreen", offscreen);
    const turnText = Math.abs(difference) > Math.PI * 0.72 ? "目标在身后，请转身" : difference > 0 ? "目标在右侧，请转向 →" : "目标在左侧，请转向 ←";
    document.getElementById("guideTarget").textContent = offscreen ? turnText : room ? room.name.replace(" · 安全屋", "") : "当前目标";
    const directions = ["北 N", "东 E", "南 S", "西 W"];
    const index = ((Math.round((this.player.angle + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
    document.getElementById("compassText").textContent = directions[index];
  }

  updateInteractionPrompt() {
    const prompt = document.getElementById("interactionPrompt");
    document.getElementById("touchInteractButton").classList.toggle("ready", Boolean(this.currentInteraction) && this.state === "playing");
    if (!this.currentInteraction || this.state !== "playing") {
      prompt.classList.add("hidden");
      return;
    }
    prompt.classList.remove("hidden");
    prompt.querySelector("span").textContent = this.currentInteraction.label;
  }

  updateHUD() {
    document.getElementById("objectiveText").textContent = this.objective;
    document.getElementById("roomName").textContent = this.world.getRoomAt(this.player.x, this.player.y)?.name || "教学楼门廊";
    document.getElementById("healthBar").style.width = `${this.player.health}%`;
    document.getElementById("healthText").textContent = Math.ceil(this.player.health);
    document.getElementById("staminaBar").style.width = `${this.player.stamina}%`;
    document.getElementById("candyCount").textContent = this.candy;
    document.getElementById("bombCount").textContent = this.weapon.bombs;
    document.getElementById("magText").textContent = this.weapon.ammo;
    document.getElementById("reserveText").textContent = this.weapon.reserve;
    document.getElementById("weaponState").textContent = this.weapon.reloading ? "换弹中……" : "南瓜净化器";
    const keys = [];
    if (this.inventory.has("medicalKey")) keys.push("医务钥匙");
    if (this.inventory.has("labKey")) keys.push("实验卡");
    if (this.inventory.has("fuse")) keys.push("保险丝");
    document.getElementById("keyText").textContent = keys.length ? keys.join(" · ") : "无钥匙";
    document.getElementById("rescueCount").textContent = `${this.rescued.size} / 3`;
    document.querySelectorAll("[data-rescue]").forEach(icon => icon.classList.toggle("saved", this.rescued.has(icon.dataset.rescue)));
    const defense = document.getElementById("defenseTimer");
    defense.classList.toggle("hidden", !this.flags.broadcastStarted);
    if (this.flags.broadcastStarted) defense.querySelector("strong").textContent = Math.ceil(this.flags.broadcastTime);
    document.getElementById("pauseObjective").textContent = `当前目标：${this.objective}`;
    this.updateRouteGuide();
  }

  onPlayerDamaged() {
    this.audio.hurt();
    const vignette = document.getElementById("damageVignette");
    vignette.style.opacity = this.settings.reducedMotion ? "0.3" : "0.85";
    clearTimeout(this.timers.damage);
    this.timers.damage = setTimeout(() => vignette.style.opacity = "0", 180);
  }

  rescuePlayer() {
    if (this.reviving) return;
    this.reviving = true;
    document.getElementById("fadeLayer").classList.add("active");
    setTimeout(() => {
      this.player.x = 4.5;
      this.player.y = 5.5;
      this.player.health = 100;
      this.player.stamina = 100;
      this.weapon.ammo = this.weapon.magSize;
      this.weapon.reserve = Math.max(this.weapon.reserve, 6);
      this.zombies.forEach(zombie => {
        if (zombie.purified) return;
        zombie.x = zombie.spawnX;
        zombie.y = zombie.spawnY;
        zombie.alert = false;
        zombie.path = [];
      });
      this.saveGame();
      document.getElementById("fadeLayer").classList.remove("active");
      this.showSubtitle("叉烧", "喵……没事了。先喝口水，再从保安室出发。", 4);
      this.reviving = false;
    }, 550);
  }

  isPlayerInSafeRoom() {
    return this.world.getRoomAt(this.player.x, this.player.y)?.id === "security";
  }

  openMap() {
    if (!this.flags.hasMap) {
      this.showToast("还没有地图，先去保安室找找");
      return;
    }
    this.state = "map";
    this.input.clear();
    this.updateTouchControls();
    document.getElementById("mapScreen").classList.remove("hidden");
    this.renderer.renderMap(document.getElementById("mapCanvas"));
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeMap() {
    if (this.state !== "map") return;
    document.getElementById("mapScreen").classList.add("hidden");
    this.state = "playing";
    this.audio.init();
    this.lastTime = performance.now();
    this.updateLayout();
    if (this.state === "playing") this.requestPointerLock();
  }

  pause() {
    if (this.state !== "playing") return;
    this.state = "pause";
    this.input.clear();
    this.updateTouchControls();
    document.getElementById("pauseScreen").classList.remove("hidden");
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.suspend();
  }

  resume() {
    if (this.state !== "pause") return;
    this.updateLayout();
    if (this.orientationBlocked) return;
    document.getElementById("pauseScreen").classList.add("hidden");
    this.state = "playing";
    this.audio.init();
    this.lastTime = performance.now();
    this.updateTouchControls();
    this.requestPointerLock();
  }

  requestPointerLock() {
    if (this.state !== "playing" || this.input.isTouchMode()) return;
    try {
      const result = this.canvas.requestPointerLock();
      if (result && result.catch) result.catch(() => {});
    } catch {}
  }

  onPointerLockChange() {
    if (!this.input.isTouchMode() && !document.pointerLockElement && this.state === "playing") this.pause();
  }

  openSettings(returnTo) {
    this.settingsReturn = returnTo;
    if (returnTo === "menu") document.getElementById("startScreen").classList.add("hidden");
    if (returnTo === "pause") document.getElementById("pauseScreen").classList.add("hidden");
    document.getElementById("settingsScreen").classList.remove("hidden");
    this.syncSettingsUI();
  }

  closeSettings() {
    document.getElementById("settingsScreen").classList.add("hidden");
    if (this.settingsReturn === "menu") document.getElementById("startScreen").classList.remove("hidden");
    if (this.settingsReturn === "pause") document.getElementById("pauseScreen").classList.remove("hidden");
  }

  syncSettingsUI() {
    document.getElementById("soundSetting").checked = this.settings.sound;
    document.getElementById("subtitleSetting").checked = this.settings.subtitles;
    document.getElementById("guideSetting").checked = this.settings.routeGuide;
    document.getElementById("motionSetting").checked = this.settings.reducedMotion;
    document.getElementById("brightnessSetting").value = this.settings.brightness;
    document.getElementById("sensitivitySetting").value = this.settings.sensitivity;
  }

  applySettings() {
    this.audio.setEnabled(this.settings.sound);
    document.getElementById("brightnessValue").textContent = `${this.settings.brightness}%`;
    document.getElementById("sensitivityValue").textContent = `${this.settings.sensitivity}%`;
  }

  updateInputMode() {
    const touch = this.input.isTouchMode();
    document.body.classList.toggle("touch-mode", touch);
    document.getElementById("controlsHint").textContent = touch ? "左侧摇杆移动 · 右侧拖动观察 · 触控按钮射击与互动" : "WASD 移动 · Shift 冲刺 · C 糖果 · F 手电 · M 地图 · Esc 暂停";
    document.getElementById("startInputHint").textContent = touch ? "建议佩戴耳机 · 横屏游玩 · 左侧移动，右侧观察" : "建议佩戴耳机 · 点击开始后锁定鼠标";
    document.getElementById("sensitivityLabel").textContent = touch ? "观察灵敏度" : "鼠标灵敏度";
    document.getElementById("closeMapButton").textContent = touch ? "关闭地图" : "M / Tab 关闭";
    document.getElementById("ammoHint").textContent = touch ? "使用触控按钮换弹与投掷" : "R 换弹（弹仓最多 6 发） · Q 南瓜弹";
    this.updateLayout();
  }

  updateTouchControls() {
    const visible = this.input.isTouchMode() && this.state === "playing" && !this.orientationBlocked;
    document.getElementById("touchControls").classList.toggle("hidden", !visible);
  }

  bindMobileLifecycle() {
    const scheduleLayout = () => {
      if (this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        this.updateLayout();
      });
    };
    window.addEventListener("resize", scheduleLayout);
    window.addEventListener("orientationchange", scheduleLayout);
    window.addEventListener("pageshow", () => {
      this.lastTime = performance.now();
      scheduleLayout();
    });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", scheduleLayout);
    document.addEventListener("visibilitychange", () => {
      this.input.clear();
      if (document.hidden) {
        if (this.state === "playing") {
          this.saveGame();
          this.pause();
        }
        this.audio.suspend();
      } else {
        this.lastTime = performance.now();
        scheduleLayout();
      }
    });
    window.addEventListener("pagehide", () => {
      this.input.clear();
      if (!["menu", "ending"].includes(this.state)) this.saveGame();
    });
  }

  updateLayout() {
    const touch = this.input.isTouchMode();
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 720;
    const needsLandscape = ["playing", "pause", "map"].includes(this.state);
    this.orientationBlocked = touch && needsLandscape && height > width;
    document.getElementById("rotateScreen").classList.toggle("hidden", !this.orientationBlocked);
    if (this.orientationBlocked) {
      this.input.clear();
      if (this.state === "playing") this.pause();
    }
    this.updateTouchControls();
    this.resizeCanvas();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
    const cssWidth = Math.max(1, Math.round(rect && rect.width ? rect.width : window.innerWidth || 1280));
    const cssHeight = Math.max(1, Math.round(rect && rect.height ? rect.height : window.innerHeight || 720));
    const touch = this.input.isTouchMode();
    const density = touch ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    const pixelBudget = touch ? 900000 : 1280 * 720;
    const scale = Math.min(density, Math.sqrt(pixelBudget / (cssWidth * cssHeight)));
    const width = Math.max(1, Math.round(cssWidth * scale));
    const height = Math.max(1, Math.round(cssHeight * scale));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.renderer) {
      if (this.renderer.isWebGL) this.renderer.helper.resize();
      else this.renderer.resize();
      if (this.renderer.context) this.renderer.context.imageSmoothingEnabled = false;
    }
  }

  loadSettings() {
    const defaults = {
      sound: true,
      subtitles: true,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      routeGuide: true,
      brightness: 120,
      sensitivity: 55
    };
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem("seventh-teaching-building-settings") || "{}") };
    } catch {
      return defaults;
    }
  }

  saveSettings() {
    try { localStorage.setItem("seventh-teaching-building-settings", JSON.stringify(this.settings)); } catch {}
  }

  saveGame() {
    if (!this.flags.hasMap && this.stats.elapsed < 1) return;
    const data = {
      version: 1,
      mode: this.mode,
      player: this.player.serialize(),
      weapon: this.weapon.serialize(),
      stats: this.stats,
      inventory: [...this.inventory],
      candy: this.candy,
      rescued: [...this.rescued],
      flags: { ...this.flags, broadcastStarted: false },
      discovered: [...this.discovered],
      discoveredRooms: [...this.discoveredRooms],
      collected: this.items.filter(item => item.collected).map(item => item.id),
      purified: this.zombies.filter(zombie => zombie.purified).map(zombie => zombie.id),
      doors: [...this.world.doors.values()].map(door => ({ id: door.id, locked: door.locked, openAmount: door.openAmount, targetOpen: door.targetOpen, broken: door.broken, durability: door.durability }))
    };
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(data));
      this.updateContinueButton();
    } catch {}
  }

  updateContinueButton() {
    let hasSave = false;
    try { hasSave = Boolean(localStorage.getItem(this.saveKey)); } catch {}
    document.getElementById("continueButton").classList.toggle("hidden", !hasSave);
  }

  returnToMenu() {
    this.saveGame();
    this.state = "menu";
    this.input.clear();
    document.getElementById("pauseScreen").classList.add("hidden");
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("startScreen").classList.remove("hidden");
    this.updateLayout();
    this.updateContinueButton();
  }

  finishGame() {
    if (this.state !== "playing") return;
    this.state = "ending";
    this.input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById("hud").classList.add("hidden");
    document.getElementById("endingScreen").classList.remove("hidden");
    this.updateLayout();
    document.getElementById("endingTime").textContent = this.formatTime(this.stats.elapsed);
    document.getElementById("endingPurified").textContent = this.stats.purified;
    try { localStorage.removeItem(this.saveKey); } catch {}
    this.audio.rescue();
  }

  captureScreenshot() {
    const screen = document.getElementById("screenshotScreen");
    if (!["playing", "pause"].includes(this.state) || !screen.classList.contains("hidden")) return;
    this.screenshotResume = this.state === "playing";
    if (this.screenshotResume) this.pause();
    this.renderer.render();
    const output = document.createElement("canvas");
    output.width = this.canvas.width;
    output.height = this.canvas.height + 58;
    const context = output.getContext("2d");
    context.fillStyle = "#171525";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(this.canvas, 0, 0);
    const now = new Date();
    const room = this.world.getRoomAt(this.player.x, this.player.y)?.name || "教学楼门廊";
    const angle = Math.round((this.player.angle * 180 / Math.PI + 360) % 360);
    context.fillStyle = "#f4ecd9";
    context.font = "16px Microsoft YaHei, sans-serif";
    context.textAlign = "left";
    context.fillText(`${room}　坐标 X ${this.player.x.toFixed(2)} / Y ${this.player.y.toFixed(2)}　视角 ${angle}°`, 18, this.canvas.height + 24);
    context.fillStyle = "#a99bad";
    context.font = "12px Microsoft YaHei, sans-serif";
    context.fillText(`万圣夜：第七教学楼　${now.toLocaleString("zh-CN")}　${this.renderer.isWebGL ? "WebGL 真3D" : "Canvas 兼容渲染"} · FOV 60°`, 18, this.canvas.height + 45);
    const image = output.toDataURL("image/png");
    document.getElementById("screenshotPreview").src = image;
    const download = document.getElementById("downloadScreenshot");
    download.href = image;
    download.download = `第七教学楼-${room.replace(/\s/g, "")}-${now.toISOString().replace(/[:.]/g, "-")}.png`;
    screen.classList.remove("hidden");
  }

  closeScreenshot() {
    document.getElementById("screenshotScreen").classList.add("hidden");
    if (this.screenshotResume) {
      this.screenshotResume = false;
      this.resume();
    }
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${rest}`;
  }

  showSubtitle(speaker, text, duration = 3) {
    if (!this.settings.subtitles) return;
    document.getElementById("subtitleSpeaker").textContent = speaker;
    document.getElementById("subtitleText").textContent = text;
    document.getElementById("subtitle").classList.remove("hidden");
    clearTimeout(this.timers.subtitle);
    this.timers.subtitle = setTimeout(() => document.getElementById("subtitle").classList.add("hidden"), duration * 1000);
  }

  showToast(text) {
    const toast = document.getElementById("toast");
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(this.timers.toast);
    this.timers.toast = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  showHitMarker(precise) {
    const marker = document.getElementById("hitMarker");
    marker.style.color = precise ? "#f4c86a" : "#f4ecd9";
    marker.classList.remove("show");
    void marker.offsetWidth;
    marker.classList.add("show");
    if (precise) this.showToast("正中额头 · 净化加深");
  }

  flashScreen() {
    if (this.settings.reducedMotion) return;
    const vignette = document.getElementById("damageVignette");
    vignette.style.background = "radial-gradient(circle,rgba(244,200,106,.35),rgba(232,137,78,.35))";
    vignette.style.opacity = "0.8";
    clearTimeout(this.timers.flash);
    this.timers.flash = setTimeout(() => {
      vignette.style.opacity = "0";
      setTimeout(() => vignette.style.background = "", 250);
    }, 120);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.seventhGame = new Game();
});