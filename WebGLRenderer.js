class WebGLRenderer {
  static create(canvas, game) {
    const glCanvas = document.createElement("canvas");
    glCanvas.width = canvas.width;
    glCanvas.height = canvas.height;
    const gl = glCanvas.getContext("webgl", { antialias: true, alpha: false, depth: true, powerPreference: "high-performance" }) || glCanvas.getContext("experimental-webgl");
    if (!gl) return null;
    try {
      return new WebGLRenderer(canvas, game, glCanvas, gl);
    } catch (error) {
      console.warn("WebGL 初始化失败，已回退到兼容渲染。", error);
      return null;
    }
  }

  constructor(canvas, game, glCanvas, gl) {
    this.canvas = canvas;
    this.game = game;
    this.glCanvas = glCanvas;
    this.gl = gl;
    this.context = canvas.getContext("2d");
    this.helper = new Renderer(canvas, game);
    this.isWebGL = true;
    this.world = null;
    this.meshes = [];
    this.dynamicDoors = new Map();
    this.textureCache = new WeakMap();
    this.spriteTextureSources = new WeakMap();
    this.surfaceCanvases = {};
    this.initGL();
    this.createSurfaceTextures();
    this.glCanvas.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      this.game.recoverRenderer(new Error("WebGL 图形上下文丢失"));
    });
  }

  initGL() {
    const gl = this.gl;
    const vertexSource = `
      attribute vec3 aPosition;
      attribute vec2 aUV;
      attribute vec3 aColor;
      uniform mat4 uProjection;
      uniform mat4 uView;
      varying vec2 vUV;
      varying vec3 vColor;
      varying vec3 vWorld;
      void main() {
        gl_Position = uProjection * uView * vec4(aPosition, 1.0);
        vUV = aUV;
        vColor = aColor;
        vWorld = aPosition;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform float uAlpha;
      uniform float uBrightness;
      uniform float uFlashlight;
      uniform vec3 uPlayer;
      varying vec2 vUV;
      varying vec3 vColor;
      varying vec3 vWorld;
      void main() {
        vec4 texel = texture2D(uTexture, vUV);
        float alpha = texel.a * uAlpha;
        if (alpha < 0.08) discard;
        float distanceToPlayer = distance(vWorld.xz, uPlayer.xz);
        float baseLight = uFlashlight > 0.5 ? 1.08 : 0.72;
        float attenuation = 1.0 - min(0.34, distanceToPlayer * 0.012);
        vec3 color = texel.rgb * vColor * baseLight * attenuation * uBrightness;
        color = max(color, texel.rgb * vColor * 0.3);
        float fog = smoothstep(15.0, 32.0, distanceToPlayer);
        color = mix(color, vec3(0.085, 0.075, 0.13), fog);
        gl_FragColor = vec4(color, alpha);
      }
    `;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    this.program = program;
    gl.useProgram(program);
    this.locations = {
      position: gl.getAttribLocation(program, "aPosition"),
      uv: gl.getAttribLocation(program, "aUV"),
      color: gl.getAttribLocation(program, "aColor"),
      projection: gl.getUniformLocation(program, "uProjection"),
      view: gl.getUniformLocation(program, "uView"),
      texture: gl.getUniformLocation(program, "uTexture"),
      alpha: gl.getUniformLocation(program, "uAlpha"),
      brightness: gl.getUniformLocation(program, "uBrightness"),
      flashlight: gl.getUniformLocation(program, "uFlashlight"),
      player: gl.getUniformLocation(program, "uPlayer")
    };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1);
    gl.disable(gl.CULL_FACE);
    gl.uniform1i(this.locations.texture, 0);
    this.spriteBuffer = gl.createBuffer();
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  createSurfaceTextures() {
    const zones = {
      corridor: [92, 82, 84], security: [78, 96, 82], class1: [102, 84, 73], class2: [82, 88, 96],
      class3: [105, 82, 77], class4: [88, 80, 99], medical: [75, 98, 91], lab: [63, 88, 80],
      broadcast: [82, 70, 94], lobby: [108, 80, 64], stairs: [75, 70, 74]
    };
    Object.entries(zones).forEach(([zone, color]) => {
      const canvas = this.helper.makeCanvas(64, 64);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "rgba(25,22,34,.28)";
      ctx.fillRect(0, 0, 64, 4);
      ctx.fillRect(0, 0, 4, 64);
      ctx.fillStyle = "rgba(244,236,217,.08)";
      ctx.fillRect(4, 60, 60, 4);
      ctx.fillRect(60, 4, 4, 60);
      for (let index = 0; index < 20; index += 1) {
        ctx.fillStyle = `rgba(244,236,217,${Math.random() * 0.035})`;
        ctx.fillRect(Math.random() * 60 + 4, Math.random() * 60 + 4, 2, 2);
      }
      this.surfaceCanvases[`floor-${zone}`] = canvas;
    });
    const ceiling = this.helper.makeCanvas(64, 64);
    const c = ceiling.getContext("2d");
    c.fillStyle = "#3d3747";
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = "#292533";
    c.fillRect(0, 0, 64, 4);
    c.fillRect(0, 0, 4, 64);
    c.fillStyle = "rgba(244,236,217,.05)";
    c.fillRect(4, 60, 60, 4);
    c.fillRect(60, 4, 4, 60);
    this.surfaceCanvases.ceiling = ceiling;
    this.surfaceCanvases.frame = this.solidTexture("#ead6ac");
    this.surfaceCanvases.thresholdOpen = this.solidTexture("#689a77");
    this.surfaceCanvases.thresholdClosed = this.solidTexture("#977046");
  }

  solidTexture(color) {
    const canvas = this.helper.makeCanvas(64, 64);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 64);
    return canvas;
  }

  getTexture(canvas) {
    if (this.textureCache.has(canvas)) return this.textureCache.get(canvas);
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const powerOfTwo = value => (value & (value - 1)) === 0;
    if (powerOfTwo(canvas.width) && powerOfTwo(canvas.height)) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    this.textureCache.set(canvas, texture);
    return texture;
  }

  getSpriteTexture(image) {
    if (!this.spriteTextureSources.has(image)) {
      const flipped = this.helper.makeCanvas(image.width, image.height);
      const context = flipped.getContext("2d");
      context.translate(image.width, 0);
      context.scale(-1, 1);
      context.drawImage(image, 0, 0);
      this.spriteTextureSources.set(image, flipped);
    }
    return this.getTexture(this.spriteTextureSources.get(image));
  }

  addQuad(vertices, points, color = [1, 1, 1], uvs = [[0, 1], [1, 1], [1, 0], [0, 0]]) {
    const order = [0, 1, 2, 0, 2, 3];
    order.forEach(index => {
      const point = points[index];
      const uv = uvs[index];
      vertices.push(point[0], point[1], point[2], uv[0], uv[1], color[0], color[1], color[2]);
    });
  }

  addBox(vertices, x, y, z, width, height, depth, color = [1, 1, 1]) {
    const x0 = x - width / 2;
    const x1 = x + width / 2;
    const y0 = y - height / 2;
    const y1 = y + height / 2;
    const z0 = z - depth / 2;
    const z1 = z + depth / 2;
    this.addQuad(vertices, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], color);
    this.addQuad(vertices, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], color);
    this.addQuad(vertices, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], color);
    this.addQuad(vertices, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], color);
    this.addQuad(vertices, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], color);
    this.addQuad(vertices, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], color);
  }

  createMesh(vertices, canvas, dynamic = false) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    return { buffer, count: vertices.length / 8, texture: this.getTexture(canvas), dynamic };
  }

  updateMesh(mesh, vertices, canvas) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    mesh.count = vertices.length / 8;
    mesh.texture = this.getTexture(canvas);
  }

  buildWorld() {
    const gl = this.gl;
    this.meshes.forEach(mesh => gl.deleteBuffer(mesh.buffer));
    this.meshes = [];
    this.dynamicDoors.clear();
    const world = this.game.world;
    this.world = world;
    const groups = new Map();
    const addToGroup = (canvas, vertices) => {
      if (!groups.has(canvas)) groups.set(canvas, []);
      groups.get(canvas).push(...vertices);
    };
    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const cell = world.grid[y][x];
        if (cell !== "#") {
          const room = world.getRoomAt(x + 0.5, y + 0.5);
          const zone = room ? room.id : "corridor";
          const floorVertices = [];
          this.addQuad(floorVertices, [[x, 0, y], [x + 1, 0, y], [x + 1, 0, y + 1], [x, 0, y + 1]], [0.92, 0.92, 0.92], [[0, 0], [1, 0], [1, 1], [0, 1]]);
          addToGroup(this.surfaceCanvases[`floor-${zone}`] || this.surfaceCanvases["floor-corridor"], floorVertices);
          const ceilingVertices = [];
          this.addQuad(ceilingVertices, [[x, 1.4, y + 1], [x + 1, 1.4, y + 1], [x + 1, 1.4, y], [x, 1.4, y]], [0.88, 0.88, 0.94], [[0, 0], [1, 0], [1, 1], [0, 1]]);
          addToGroup(this.surfaceCanvases.ceiling, ceilingVertices);
          continue;
        }
        const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        neighbors.forEach(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (!world.inBounds(nx, ny) || world.grid[ny][nx] === "#") return;
          const room = world.getRoomAt(nx + 0.5, ny + 0.5);
          const zone = room ? room.id : "corridor";
          const canvas = this.helper.textures[`wall-${zone}`] || this.helper.textures["wall-corridor"];
          let points;
          if (dy === -1) points = [[x, 0, y], [x + 1, 0, y], [x + 1, 1.4, y], [x, 1.4, y]];
          if (dx === 1) points = [[x + 1, 0, y], [x + 1, 0, y + 1], [x + 1, 1.4, y + 1], [x + 1, 1.4, y]];
          if (dy === 1) points = [[x + 1, 0, y + 1], [x, 0, y + 1], [x, 1.4, y + 1], [x + 1, 1.4, y + 1]];
          if (dx === -1) points = [[x, 0, y + 1], [x, 0, y], [x, 1.4, y], [x, 1.4, y + 1]];
          const vertices = [];
          this.addQuad(vertices, points, dx === 0 ? [1, 1, 1] : [0.91, 0.91, 0.95]);
          addToGroup(canvas, vertices);
        });
      }
    }
    groups.forEach((vertices, canvas) => this.meshes.push(this.createMesh(vertices, canvas)));
    world.doors.forEach(door => {
      const frameVertices = [];
      const horizontal = world.grid[door.y][door.x - 1] === "#" && world.grid[door.y][door.x + 1] === "#";
      if (horizontal) {
        this.addBox(frameVertices, door.x + 0.03, 0.7, door.y + 0.5, 0.07, 1.44, 0.2);
        this.addBox(frameVertices, door.x + 0.97, 0.7, door.y + 0.5, 0.07, 1.44, 0.2);
        this.addBox(frameVertices, door.x + 0.5, 1.38, door.y + 0.5, 1.06, 0.09, 0.2);
      } else {
        this.addBox(frameVertices, door.x + 0.5, 0.7, door.y + 0.03, 0.2, 1.44, 0.07);
        this.addBox(frameVertices, door.x + 0.5, 0.7, door.y + 0.97, 0.2, 1.44, 0.07);
        this.addBox(frameVertices, door.x + 0.5, 1.38, door.y + 0.5, 0.2, 0.09, 1.06);
      }
      this.meshes.push(this.createMesh(frameVertices, this.surfaceCanvases.frame));
      this.dynamicDoors.set(door.id, {
        panel: this.createMesh([], this.helper.getDoorTexture(door), true),
        threshold: this.createMesh([], this.surfaceCanvases.thresholdClosed, true)
      });
    });
  }

  updateDoors() {
    const world = this.game.world;
    world.doors.forEach(door => {
      const meshes = this.dynamicDoors.get(door.id);
      const horizontal = world.grid[door.y][door.x - 1] === "#" && world.grid[door.y][door.x + 1] === "#";
      const panelVertices = [];
      const slide = door.openAmount * 0.96;
      if (horizontal) {
        const x0 = door.x + 0.04 + slide;
        this.addBox(panelVertices, x0 + 0.46, 0.68, door.y + 0.5, 0.92, 1.32, 0.07);
      } else {
        const z0 = door.y + 0.04 + slide;
        this.addBox(panelVertices, door.x + 0.5, 0.68, z0 + 0.46, 0.07, 1.32, 0.92);
      }
      this.updateMesh(meshes.panel, panelVertices, this.helper.getDoorTexture(door));
      const thresholdVertices = [];
      this.addQuad(thresholdVertices, [[door.x, 0.008, door.y], [door.x + 1, 0.008, door.y], [door.x + 1, 0.008, door.y + 1], [door.x, 0.008, door.y + 1]], [1, 1, 1], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      this.updateMesh(meshes.threshold, thresholdVertices, door.passable ? this.surfaceCanvases.thresholdOpen : this.surfaceCanvases.thresholdClosed);
    });
  }

  drawMesh(mesh, alpha = 1) {
    if (!mesh.count) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.enableVertexAttribArray(this.locations.uv);
    gl.enableVertexAttribArray(this.locations.color);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(this.locations.uv, 2, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(this.locations.color, 3, gl.FLOAT, false, 32, 20);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mesh.texture);
    gl.uniform1f(this.locations.alpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  billboardRight(angle) {
    return { x: -Math.sin(angle), z: Math.cos(angle) };
  }

  drawSprites() {
    const gl = this.gl;
    const player = this.game.player;
    const right = this.billboardRight(player.angle);
    const rightX = right.x;
    const rightZ = right.z;
    const sprites = this.helper.collectSprites();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const sprite of sprites) {
      const image = this.helper.getSprite(sprite);
      const height = sprite.scale * 1.4;
      const width = height * image.width / image.height;
      const bottom = sprite.type === "door-marker" ? 0.96 : (sprite.z || 0) * 1.4;
      const leftX = sprite.x - rightX * width / 2;
      const leftZ = sprite.y - rightZ * width / 2;
      const rightWorldX = sprite.x + rightX * width / 2;
      const rightWorldZ = sprite.y + rightZ * width / 2;
      const vertices = [];
      this.addQuad(vertices, [
        [leftX, bottom, leftZ], [rightWorldX, bottom, rightWorldZ],
        [rightWorldX, bottom + height, rightWorldZ], [leftX, bottom + height, leftZ]
      ]);
      const mesh = { buffer: this.spriteBuffer, count: 6, texture: this.getSpriteTexture(image) };
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      this.drawMesh(mesh, sprite.alpha === undefined ? 1 : sprite.alpha);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  render() {
    if (this.gl.isContextLost && this.gl.isContextLost()) {
      this.game.recoverRenderer(new Error("WebGL 图形上下文不可用"));
      return;
    }
    if (this.world !== this.game.world) this.buildWorld();
    const gl = this.gl;
    const player = this.game.player;
    glCanvasSize(this.glCanvas, this.canvas.width, this.canvas.height);
    gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    gl.clearColor(0.075, 0.066, 0.115, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const projection = this.perspective(Math.PI / 3, this.glCanvas.width / this.glCanvas.height, 0.035, 40);
    const bob = this.game.settings.reducedMotion ? 0 : Math.sin(player.bobPhase * 2) * player.bobAmount * 0.008;
    const eye = [player.x, 0.68 + bob, player.y];
    const center = [player.x + Math.cos(player.angle), 0.68 + bob, player.y + Math.sin(player.angle)];
    const view = this.lookAt(eye, center, [0, 1, 0]);
    gl.uniformMatrix4fv(this.locations.projection, false, projection);
    gl.uniformMatrix4fv(this.locations.view, false, view);
    gl.uniform1f(this.locations.brightness, this.game.settings.brightness / 110);
    gl.uniform1f(this.locations.flashlight, player.flashlight ? 1 : 0);
    gl.uniform3f(this.locations.player, player.x, 0.68, player.y);
    this.updateDoors();
    this.meshes.forEach(mesh => this.drawMesh(mesh));
    this.dynamicDoors.forEach(meshes => {
      this.drawMesh(meshes.threshold);
      this.drawMesh(meshes.panel);
    });
    this.drawSprites();
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.imageSmoothingEnabled = true;
    this.context.drawImage(this.glCanvas, 0, 0, this.canvas.width, this.canvas.height);
    this.helper.ctx.clearRect(0, 0, this.helper.view.width, this.helper.view.height);
    this.helper.drawWeapon();
    this.context.drawImage(this.helper.view, 0, 0, this.canvas.width, this.canvas.height);
    if (this.game.flags.hasMap && this.game.state !== "menu") this.helper.drawMiniMap();
  }

  renderMap(canvas) {
    this.helper.renderMap(canvas);
  }

  collectSprites() {
    return this.helper.collectSprites();
  }

  perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const range = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * range, -1,
      0, 0, 2 * far * near * range, 0
    ]);
  }

  lookAt(eye, center, up) {
    const normalize = vector => {
      const length = Math.hypot(...vector) || 1;
      return vector.map(value => value / length);
    };
    const subtract = (a, b) => a.map((value, index) => value - b[index]);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    const z = normalize(subtract(eye, center));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
    ]);
  }
}

function glCanvasSize(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

globalThis.WebGLRenderer = WebGLRenderer;