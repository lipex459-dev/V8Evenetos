(() => {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const canvas = document.querySelector("#network");
  const ctx = canvas.getContext("2d", { alpha: false });
  const bar = document.querySelector(".progress span");
  const chapter = document.querySelector(".chapter");
  const cards = [...document.querySelectorAll(".glass-card")];
  let width = innerWidth;
  let height = innerHeight;
  let dpr = Math.min(devicePixelRatio || 1, 1.7);
  let pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  let scrollProgress = 0;
  let targetScroll = 0;
  let last = performance.now();
  let points = [];
  let audio;
  let gain;

  function makePoints() {
    const total = Math.min(850, Math.max(380, Math.round(width * height / 2100)));
    points = Array.from({ length: total }, (_, index) => ({
      x: (Math.random() - 0.5) * 28,
      y: (Math.random() - 0.5) * 18,
      z: Math.random() * 24 - 2,
      size: Math.random() * 1.7 + 0.3,
      alpha: Math.random() * 0.7 + 0.18,
      phase: Math.random() * Math.PI * 2,
      hot: index % 7 === 0
    }));
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makePoints();
  }

  function project(point, time) {
    let z = (point.z - scrollProgress * 17) % 24;
    if (z < -2) z += 24;
    const depth = z + 4.8;
    const swirl = scrollProgress * 0.72 + time * 0.025;
    const cosine = Math.cos(swirl);
    const sine = Math.sin(swirl);
    const x = point.x * cosine - point.y * sine * 0.22;
    const y = point.y + Math.sin(point.phase + time * 0.6 + scrollProgress * 3) * 0.16;
    const focal = Math.min(width, height) * 0.88;

    return {
      x: width * (0.5 + (pointer.x - 0.5) * 0.055) + x / depth * focal,
      y: height * (0.5 + (pointer.y - 0.5) * 0.045) + y / depth * focal,
      scale: Math.max(0.06, 2.2 / depth),
      alpha: Math.min(1, Math.max(0, (1 - depth / 30) * point.alpha)),
      depth
    };
  }

  function drawHub(time) {
    const centerX = width * (0.5 + (pointer.x - 0.5) * 0.035);
    const centerY = height * (0.48 + (pointer.y - 0.5) * 0.025);
    const radius = Math.min(width, height) * (0.16 + Math.sin(scrollProgress * Math.PI) * 0.035);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(time * 0.025 + scrollProgress * 1.4);
    ctx.globalCompositeOperation = "lighter";

    for (let ring = 0; ring < 4; ring += 1) {
      ctx.beginPath();
      for (let step = 0; step <= 180; step += 1) {
        const angle = step / 180 * Math.PI * 2;
        const noise = Math.sin(angle * (7 + ring * 2) + time * 0.7 + ring) * (5 + ring * 2);
        const x = Math.cos(angle) * (radius + noise) * (1 + ring * 0.14);
        const y = Math.sin(angle) * (radius + noise) * (0.29 + ring * 0.06);
        if (step) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      const color = ring === 1 ? "255,92,78" : "220,23,23";
      ctx.strokeStyle = "rgba(" + color + "," + (0.045 + ring * 0.026) + ")";
      ctx.lineWidth = ring === 1 ? 1.2 : 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  function render(now) {
    const delta = Math.min(0.035, (now - last) / 1000);
    last = now;
    targetScroll = scrollY / Math.max(1, document.documentElement.scrollHeight - height);
    scrollProgress += (targetScroll - scrollProgress) * (reduced ? 1 : Math.min(1, delta * 3.6));
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, delta * 4.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, delta * 4.5);

    const backdrop = ctx.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.78);
    backdrop.addColorStop(0, "#1d0d0d");
    backdrop.addColorStop(0.38, "#0d0808");
    backdrop.addColorStop(1, "#030303");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, width, height);
    drawHub(now * 0.001);

    ctx.globalCompositeOperation = "lighter";
    for (const point of points) {
      const projected = project(point, now * 0.001);
      if (projected.x < -20 || projected.x > width + 20 || projected.y < -20 || projected.y > height + 20 || projected.depth <= 0.1) continue;
      const size = Math.min(6, point.size * projected.scale * 2.1);
      const alpha = projected.alpha * (0.68 + Math.sin(point.phase + now * 0.0012) * 0.22);
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, Math.max(0.3, size), 0, Math.PI * 2);
      ctx.fillStyle = point.hot ? "rgba(255,93,79," + alpha + ")" : "rgba(220,23,23," + alpha * 0.72 + ")";
      ctx.fill();

      if (size > 2.1) {
        const halo = ctx.createRadialGradient(projected.x, projected.y, 0, projected.x, projected.y, size * 5);
        halo.addColorStop(0, "rgba(255,72,60," + alpha * 0.22 + ")");
        halo.addColorStop(1, "rgba(255,72,60,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(projected.x - size * 5, projected.y - size * 5, size * 10, size * 10);
      }
    }
    ctx.globalCompositeOperation = "source-over";
    bar.style.height = targetScroll * 100 + "%";

    document.querySelectorAll("[data-parallax]").forEach((element) => {
      const box = element.getBoundingClientRect();
      const speed = parseFloat(element.dataset.parallax);
      element.style.transform = "translate3d(" + ((pointer.x - 0.5) * speed * -120) + "px," + (box.top * speed) + "px,0)";
    });

    const projects = document.querySelector(".projects");
    const projectsBox = projects.getBoundingClientRect();
    const sectionProgress = Math.max(0, Math.min(1, -projectsBox.top / Math.max(1, projectsBox.height - height)));
    document.querySelector(".cards").style.setProperty("--shift", (sectionProgress - 0.5) * 170);
    requestAnimationFrame(render);
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, { threshold: 0.15 });
  document.querySelectorAll("[data-reveal]").forEach((element) => revealObserver.observe(element));

  const chapterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) chapter.textContent = entry.target.dataset.chapter;
    });
  }, { threshold: 0.54 });
  document.querySelectorAll("[data-chapter]").forEach((element) => chapterObserver.observe(element));

  addEventListener("pointermove", (event) => {
    pointer.tx = event.clientX / width;
    pointer.ty = event.clientY / height;
    root.style.setProperty("--mx", event.clientX + "px");
    root.style.setProperty("--my", event.clientY + "px");
  }, { passive: true });

  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const bounds = card.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width;
      const y = (event.clientY - bounds.top) / bounds.height;
      card.style.setProperty("--ty", (x - 0.5) * 12 + "deg");
      card.style.setProperty("--tx", (0.5 - y) * 10 + "deg");
      card.style.setProperty("--sx", (x - 0.5) * 45 + "%");
      card.style.setProperty("--sy", (y - 0.5) * 35 + "%");
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--ty", "0deg");
      card.style.setProperty("--tx", "0deg");
    });
  });

  document.querySelector(".sound").addEventListener("click", (event) => {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      gain = audio.createGain();
      gain.gain.value = 0.018;
      gain.connect(audio.destination);
      const oscillator = audio.createOscillator();
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 150;
      oscillator.type = "sine";
      oscillator.frequency.value = 54;
      oscillator.connect(filter);
      filter.connect(gain);
      oscillator.start();
    }
    const on = event.currentTarget.getAttribute("aria-pressed") !== "true";
    event.currentTarget.setAttribute("aria-pressed", String(on));
    event.currentTarget.textContent = on ? "Som on" : "Som off";
    gain.gain.setTargetAtTime(on ? 0.018 : 0, audio.currentTime, 0.08);
  });

  document.querySelector("#year").textContent = new Date().getFullYear();
  resize();
  addEventListener("resize", resize, { passive: true });

  let value = reduced ? 100 : 0;
  const number = document.querySelector(".loader-number");
  const loaderBar = document.querySelector(".loader-bar");
  const loader = document.querySelector(".loader");
  const interval = setInterval(() => {
    value = Math.min(100, value + Math.ceil(Math.random() * 8));
    number.textContent = String(value).padStart(2, "0");
    loaderBar.style.width = value + "%";
    if (value >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        loader.classList.add("hide");
        document.body.classList.remove("loading");
      }, reduced ? 80 : 350);
    }
  }, reduced ? 10 : 55);

  requestAnimationFrame(render);
})();
