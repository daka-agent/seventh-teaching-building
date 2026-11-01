class DesignBoard {
  constructor() {
    this.toastTimer = null;
    this.characters = {
      sleepy: {
        number: "CHARACTER 01",
        english: "SLEEPY STUDENT",
        name: "熬夜僵尸",
        role: "普通教室 · 基础追击者",
        quote: "“再睡五分钟……就五分钟。”",
        description: "抱着课本在课桌间打瞌睡，听见脚步才会摇摇晃晃地醒来。纽扣眼和松垮校服让它看起来并不凶，直到它突然认出了你。",
        behavior: "先打瞌睡，再突然惊醒",
        effect: "变成一只打呼的布艺玩偶",
        traits: "大头 / 纽扣眼 / 松垮校服"
      },
      paper: {
        number: "CHARACTER 02",
        english: "PAPER WHISPER",
        name: "考卷纸人",
        role: "侧走廊 · 快速骚扰者",
        quote: "“沙沙……你听见我写答案了吗？”",
        description: "被遗落的考卷折成了人的形状，穿过教室时会留下细小的纸屑。它身体轻、速度快，却会在明亮的南瓜灯前迟疑。",
        behavior: "贴墙移动，停下时伪装成折纸",
        effect: "展开成一张写着晚安的空白考卷",
        traits: "折纸 / 铅笔线 / 不对称剪影"
      },
      pumpkin: {
        number: "CHARACTER 03",
        english: "PUMPKIN MONITOR",
        name: "南瓜头值日生",
        role: "实验室 · 门区压迫者",
        quote: "“晚会结束了。你怎么还在这里？”",
        description: "圆胖的身体套着值日生制服，手里的灯笼早已熄灭。它不会猛冲，只会一步一步堵在门前，用缓慢的拍门声打断你的计划。",
        behavior: "封住门口，有节奏地拍门",
        effect: "南瓜头滚落，露出满满一罐糖果",
        traits: "圆胖 / 大灯笼 /  oversized 南瓜头"
      },
      cat: {
        number: "CHARACTER 04",
        english: "THE GUIDE · CHAR SIU",
        name: "校猫「叉烧」",
        role: "安全屋 · 路线与危险引导",
        quote: "“喵。跟紧一点，别碰那扇门。”",
        description: "戴着薄荷绿围巾的橘白校猫。它不会替玩家战斗，只会在岔路口回头等待，或对危险教室竖起尾巴。保安室的旧纸箱是它的临时窝。",
        behavior: "引导、等待，对危险低吼或炸毛",
        effect: "安全屋里可以摸摸头，听一会儿呼噜声",
        traits: "橘白软毛 / 薄荷绿围巾 / 金色铃铛"
      }
    };
    this.initReveal();
    this.initCharacters();
    this.initPalette();
    this.initDoor();
    this.initNavigation();
  }

  initReveal() {
    const elements = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach(element => element.classList.add("visible"));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements.forEach(element => observer.observe(element));
  }

  initCharacters() {
    const tabs = [...document.querySelectorAll(".character-card")];
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => this.selectCharacter(tab.dataset.character, tabs));
      tab.addEventListener("keydown", event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
        const next = tabs[(index + direction + tabs.length) % tabs.length];
        next.focus();
        this.selectCharacter(next.dataset.character, tabs);
      });
    });
  }

  selectCharacter(key, tabs) {
    const character = this.characters[key];
    if (!character) return;
    tabs.forEach(tab => {
      const active = tab.dataset.character === key;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    const fields = {
      profileNumber: character.number,
      profileEnglish: character.english,
      profileName: character.name,
      profileRole: character.role,
      profileQuote: character.quote,
      profileDescription: character.description,
      profileBehavior: character.behavior,
      profileEffect: character.effect,
      profileTraits: character.traits
    };
    Object.entries(fields).forEach(([id, value]) => {
      document.getElementById(id).textContent = value;
    });
  }

  initPalette() {
    document.querySelectorAll(".swatch").forEach(swatch => {
      swatch.addEventListener("click", async () => {
        const color = swatch.dataset.color;
        try {
          await navigator.clipboard.writeText(color);
        } catch {
          const input = document.createElement("textarea");
          input.value = color;
          input.style.position = "fixed";
          input.style.opacity = "0";
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
        this.showToast(`${color} 已复制到剪贴板`);
      });
    });
  }

  initDoor() {
    const stage = document.getElementById("doorStage");
    const doorButton = document.getElementById("doorToggle");
    const lightButton = document.getElementById("lightToggle");
    doorButton.addEventListener("click", () => {
      const isOpen = stage.classList.toggle("is-open");
      doorButton.setAttribute("aria-expanded", String(isOpen));
      document.getElementById("doorButtonText").textContent = isOpen ? "先关上，再想想" : "轻轻推开教室门";
      document.getElementById("doorStatusText").textContent = isOpen ? "状态：发现纸人，可以后退" : "状态：未知，未探索";
      document.getElementById("sceneTime").textContent = isOpen ? "23:52 · 教室显现" : "23:52 · 门扉紧闭";
      document.getElementById("soundCaption").innerHTML = isOpen ? "<span>♪</span> 摩擦声停了。黑板上的字，像是刚刚写下。" : "<span>♪</span> 门后传来很轻的纸张摩擦声……";
    });
    lightButton.addEventListener("click", () => {
      const lightsOut = stage.classList.toggle("lights-out");
      lightButton.setAttribute("aria-pressed", String(lightsOut));
      document.getElementById("lightButtonText").textContent = lightsOut ? "重新点亮走廊灯" : "熄灭走廊灯";
    });
  }

  initNavigation() {
    const links = [...document.querySelectorAll(".topbar nav a")];
    const sections = links.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach(link => link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`));
    }, { rootMargin: "-25% 0px -60%", threshold: [0, 0.1, 0.5] });
    sections.forEach(section => observer.observe(section));
  }

  showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }
}

window.addEventListener("DOMContentLoaded", () => new DesignBoard());