const tray = document.querySelector('.tray');
const dropzonesContainer = document.querySelector('.dropzones');
const scoreEl = document.querySelector('[data-score]');
const timerEl = document.querySelector('[data-timer]');
const hud = document.querySelector('.hud');
const scoreCard = scoreEl.closest('.hud-card');
const timerCard = timerEl.closest('.hud-card');

const defaultConfig = {
  background: {
    color: '#050b1f',
    image: '',
    size: '100% 100%',
    position: 'center',
    repeat: 'no-repeat',
  },
  hud: {
    fontFamily: '"Oxanium", "Segoe UI", system-ui, sans-serif',
    color: '#e6f1ff',
    fontSize: '1.25rem',
    showScoreBackground: true,
    showTimerBackground: true,
    showScoreBorder: true,
    showTimerBorder: true,
    scoreDisplay: 'card',
    timerDisplay: 'card',
  },
  opacity: {
    hud: 0.92,
    tray: 0.92,
    dropzones: 0.92,
    dropzoneItems: 0.7,
    hudBorder: 1,
  },
  debug: {
    showZoneLabels: true,
  },
  opacity: {
    tray: 0.92,
    dropzones: 0.92,
  },
  layout: {
    screen: { width: 1280, height: 720 },
    tray: { top: 24, right: 24, left: null, columns: 3 },
    cards: { width: 120, height: 80, zoneWidth: 60, zoneHeight: 40 },
    dropzones: {
      count: 3,
      top: 0,
      right: null,
      left: 0,
      gap: 16,
      gravity: {
        enabled: true,
        mode: 'physics',
        acceleration: 2200,
        maxSpeed: 2600,
        bounce: 0,
        settleEpsilon: 12,
        stacking: true,
        gap: 6,
        padding: 10,
      },
      defaultWidth: 160,
      defaultHeight: 120,
      zones: [
        { id: '1', label: 'Zone 1', width: 160, height: 120, position: { top: 0, left: 0 } },
        { id: '2', label: 'Zone 2', width: 200, height: 140, position: { top: 140, left: 0 } },
        { id: '3', label: 'Zone 3', width: 180, height: 120, position: { top: 300, left: 0 } },
      ],
    },
  },
  images: {
    count: 6,
    showBackgroundColor: true,
    items: [
      { id: 'img-1', label: '1', src: 'images/img-1.png', color: 'coral' },
      { id: 'img-2', label: '2', src: 'images/img-2.png', color: 'gold' },
      { id: 'img-3', label: '3', src: 'images/img-3.png', color: 'mediumseagreen' },
      { id: 'img-4', label: '4', src: 'images/img-4.png', color: 'dodgerblue' },
      { id: 'img-5', label: '5', src: 'images/img-5.png', color: 'mediumpurple' },
      { id: 'img-6', label: '6', src: 'images/img-6.png', color: 'tomato' },
    ],
  },
  timer: {
    seconds: 90,
    autoStart: true,
    position: { top: 24, left: 200 },
  },
  scoring: {
    correct: 10,
    wrong: -2,
    position: { top: 24, left: 24 },
  },
  targets: {
    'img-1': '2',
    'img-2': '1',
    'img-3': '3',
    'img-4': '2',
    'img-5': '1',
    'img-6': '3',
  },
};

const state = {
  config: defaultConfig,
  score: 0,
  timeLeft: 0,
  timerId: null,
  placements: new Map(),
  isTimeUp: false,
  scaleX: 1,
  scaleY: 1,
  queue: [],
  dragImageCache: new Map(),
  dragImageHost: null,
};

const physics = {
  running: false,
  lastTime: 0,
  rafId: null,
  cards: new Map(),
};

const pointerDrag = {
  active: false,
  pointerId: null,
  card: null,
  ghost: null,
  offsetX: 0,
  offsetY: 0,
  overEl: null,
};

let fullscreenRequested = false;

const setCssVar = (name, value) => {
  document.documentElement.style.setProperty(name, value);
};

const resetHudCard = (card) => {
  if (!card) return;
  card.style.position = '';
  card.style.top = '';
  card.style.right = '';
  card.style.bottom = '';
  card.style.left = '';
};

const applyHudCardPosition = (card, position) => {
  if (!card || !position) return;
  card.style.position = 'absolute';
  if (position.top != null) card.style.top = `${sy(position.top)}px`;
  if (position.right != null) card.style.right = `${sx(position.right)}px`;
  if (position.bottom != null) card.style.bottom = `${sy(position.bottom)}px`;
  if (position.left != null) card.style.left = `${sx(position.left)}px`;
};

const applyHudPositions = (config) => {
  if (!hud || !scoreCard || !timerCard) return;
  const scorePos = config.scoring?.position;
  const timerPos = config.timer?.position;
  const hasPos = Boolean(scorePos || timerPos);
  hud.classList.toggle('is-positioned', hasPos);

  resetHudCard(scoreCard);
  resetHudCard(timerCard);
  if (scorePos) applyHudCardPosition(scoreCard, scorePos);
  if (timerPos) applyHudCardPosition(timerCard, timerPos);
};

const requestFullscreenOnce = async () => {
  if (fullscreenRequested) return;
  fullscreenRequested = true;

  const root = document.documentElement;
  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen();
    } else if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
  } catch {
    // Ignore if fullscreen is blocked by the browser.
  }
};

const computeScale = (config) => {
  const baseWidth = config.layout.screen?.width || window.innerWidth;
  const baseHeight = config.layout.screen?.height || window.innerHeight;
  const scaleX = window.innerWidth / baseWidth;
  const scaleY = window.innerHeight / baseHeight;
  return { scaleX, scaleY };
};

const sx = (value) => value * state.scaleX;
const sy = (value) => value * state.scaleY;

const applyConfig = (config) => {
  const { scaleX, scaleY } = computeScale(config);
  state.scaleX = scaleX;
  state.scaleY = scaleY;
  const gravityScale = Math.min(scaleX, scaleY);

  if (config.background) {
    setCssVar('--bg-color', config.background.color || '#050b1f');
    const imageValue = config.background.image ? `url(${config.background.image})` : 'none';
    setCssVar('--bg-image', imageValue);
    setCssVar('--bg-size', config.background.size || 'cover');
    setCssVar('--bg-position', config.background.position || 'center');
    setCssVar('--bg-repeat', config.background.repeat || 'no-repeat');
  }
  const hudAlpha = config.opacity?.hud ?? config.hud?.backgroundOpacity ?? 0.92;
  setCssVar('--hud-bg-alpha', String(hudAlpha));
  setCssVar('--hud-border-alpha', String(config.opacity?.hudBorder ?? 1));
  setCssVar('--tray-alpha', String(config.opacity?.tray ?? 0.92));
  setCssVar('--dropzones-alpha', String(config.opacity?.dropzones ?? 0.92));
  setCssVar('--dropzone-item-alpha', String(config.opacity?.dropzoneItems ?? 0.7));

  if (config.hud) {
    if (config.hud.fontFamily) {
      setCssVar('--hud-font', config.hud.fontFamily);
    }
    if (config.hud.color) {
      setCssVar('--hud-color', config.hud.color);
    }
    if (config.hud.fontSize) {
      setCssVar('--hud-font-size', config.hud.fontSize);
    }
    scoreCard?.classList.toggle(
      'show-bg',
      config.hud.showScoreBackground !== false
    );
    timerCard?.classList.toggle(
      'show-bg',
      config.hud.showTimerBackground !== false
    );
    const scoreDisplay = config.hud.scoreDisplay || 'card';
    const timerDisplay = config.hud.timerDisplay || 'card';
    scoreCard?.classList.toggle('text-only', scoreDisplay === 'text');
    timerCard?.classList.toggle('text-only', timerDisplay === 'text');
    if (scoreDisplay === 'text') {
      scoreCard?.classList.remove('show-bg');
    }
    if (timerDisplay === 'text') {
      timerCard?.classList.remove('show-bg');
    }
    scoreCard?.classList.toggle(
      'hide-border',
      config.hud.showScoreBorder === false
    );
    timerCard?.classList.toggle(
      'hide-border',
      config.hud.showTimerBorder === false
    );
  }

  const showLabels = config.debug?.showZoneLabels ?? true;
  document.body.classList.toggle('hide-zone-labels', !showLabels);

  applyHudPositions(config);

  setCssVar('--tray-top', `${sy(config.layout.tray.top)}px`);
  const trayRight = config.layout.tray.right == null ? 'auto' : `${sx(config.layout.tray.right)}px`;
  const trayLeft = config.layout.tray.left == null ? 'auto' : `${sx(config.layout.tray.left)}px`;
  setCssVar('--tray-right', trayRight);
  setCssVar('--tray-left', trayLeft);
  setCssVar('--tray-columns', config.layout.tray.columns);
  tray.classList.toggle('show-bg', config.layout.tray?.showBackground !== false);

  setCssVar('--card-width', `${sx(config.layout.cards.width)}px`);
  setCssVar('--card-height', `${sy(config.layout.cards.height)}px`);
  setCssVar('--card-zone-width', `${sx(config.layout.cards.zoneWidth)}px`);
  setCssVar('--card-zone-height', `${sy(config.layout.cards.zoneHeight)}px`);

  setCssVar('--dropzones-top', `${sy(config.layout.dropzones.top)}px`);
  const dropzonesRight =
    config.layout.dropzones.right == null ? 'auto' : `${config.layout.dropzones.right}px`;
  const dropzonesLeft =
    config.layout.dropzones.left == null ? 'auto' : `${config.layout.dropzones.left}px`;
  setCssVar('--dropzones-right', dropzonesRight === 'auto' ? 'auto' : `${sx(config.layout.dropzones.right)}px`);
  setCssVar('--dropzones-left', dropzonesLeft === 'auto' ? 'auto' : `${sx(config.layout.dropzones.left)}px`);
  setCssVar('--dropzone-gap', `${sy(config.layout.dropzones.gap)}px`);
  const gravity = config.layout.dropzones.gravity || {};
  const gravityPadding = gravity.padding ?? 10;
  const gravityGap = gravity.gap ?? 6;
  setCssVar('--dropzone-padding', `${Math.round(gravityPadding * gravityScale)}px`);
  setCssVar('--gravity-gap', `${Math.round(gravityGap * gravityScale)}px`);
  setCssVar('--dropzone-width', `${sx(config.layout.dropzones.defaultWidth)}px`);
  setCssVar('--dropzone-height', `${sy(config.layout.dropzones.defaultHeight)}px`);
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const updateScore = (delta) => {
  state.score += delta;
  scoreEl.textContent = state.score;
};

const updateTimerUI = () => {
  timerEl.textContent = formatTime(state.timeLeft);
};

const stopTimer = () => {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
};

const startTimer = () => {
  if (state.timerId || state.isTimeUp) return;
  state.timerId = setInterval(() => {
    state.timeLeft = Math.max(0, state.timeLeft - 1);
    updateTimerUI();
    if (state.timeLeft === 0) {
      state.isTimeUp = true;
      stopTimer();
      document.body.classList.add('is-timeup');
    }
  }, 1000);
};

const resetTimer = (seconds) => {
  stopTimer();
  state.timeLeft = seconds;
  state.isTimeUp = false;
  document.body.classList.remove('is-timeup');
  updateTimerUI();
  if (state.config.timer.autoStart) {
    startTimer();
  }
};

const setCardVisuals = (card, data) => {
  if (data.src) {
    card.style.backgroundImage = `url(${data.src})`;
  } else {
    card.style.backgroundImage = 'none';
  }

  const allowColor =
    state.config.images?.showBackgroundColor !== false || !data.src;

  if (data.color && allowColor) {
    card.style.backgroundColor = data.color;
  } else if (!allowColor) {
    card.style.backgroundColor = 'transparent';
  }
};

const setCardSize = (card, width, height) => {
  card.style.width = `${width}px`;
  card.style.height = `${height}px`;
};

const getScaledNativeSize = (record) => {
  if (!record?.loaded) return null;
  return {
    width: record.width * state.scaleX,
    height: record.height * state.scaleY,
  };
};

const setCardImage = (card, src) => {
  if (!src) {
    card.style.backgroundImage = 'none';
    return;
  }
  card.style.backgroundImage = `url(${src})`;
};

const getBaseImageSrc = (card) => card.dataset.srcOriginal || card.dataset.src || '';

const applyZoneImage = (card) => {
  const base = getBaseImageSrc(card);
  const zoneSrc = getDragImageSrc(base);
  if (zoneSrc) {
    setCardImage(card, zoneSrc);
    const record = state.dragImageCache.get(zoneSrc);
    const nativeSize = getScaledNativeSize(record);
    if (nativeSize) {
      setCardSize(card, nativeSize.width, nativeSize.height);
      card.dataset.nativeWidth = String(record.width);
      card.dataset.nativeHeight = String(record.height);
    }
  }
};

const applyTrayImage = (card) => {
  const base = getBaseImageSrc(card);
  if (base) setCardImage(card, base);
  setCardSize(
    card,
    sx(state.config.layout.cards.width),
    sy(state.config.layout.cards.height)
  );
};

const getDragImageSrc = (src) => {
  if (!src) return '';
  if (src.endsWith('.G.png')) {
    return src.replace(/\.G\.png$/, '.P.png');
  }
  return src;
};

const ensureDragImageHost = () => {
  if (state.dragImageHost) return;
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.top = '-10000px';
  host.style.left = '-10000px';
  host.style.width = '1px';
  host.style.height = '1px';
  host.style.overflow = 'visible';
  host.style.opacity = '0.01';
  host.style.pointerEvents = 'none';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);
  state.dragImageHost = host;
};

const preloadDragImage = (src) => {
  if (!src || state.dragImageCache.has(src)) return;
  const img = new Image();
  img.decoding = 'async';
  const record = {
    img,
    loaded: false,
    width: 0,
    height: 0,
    el: null,
    canvas: null,
  };
  img.onload = () => {
    record.loaded = true;
    record.width = img.naturalWidth || img.width;
    record.height = img.naturalHeight || img.height;
    if (record.el) {
      record.el.width = record.width;
      record.el.height = record.height;
    }
    if (record.canvas) {
      record.canvas.width = record.width;
      record.canvas.height = record.height;
      const ctx = record.canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, record.canvas.width, record.canvas.height);
        ctx.drawImage(img, 0, 0, record.canvas.width, record.canvas.height);
      }
    }
  };
  img.src = src;
  state.dragImageCache.set(src, record);
};

const pickDragSource = (src) => {
  if (!src) return '';
  return getDragImageSrc(src);
};

const buildDragGhost = (card) => {
  const ghost = document.createElement('div');
  ghost.classList.add('drag-ghost');
  ghost.style.margin = '0';
  ghost.style.transform = 'none';
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  ghost.style.left = '-1000px';
  ghost.style.borderRadius = '8px';
  ghost.style.fontSize = '0.85rem';
  ghost.style.opacity = '1';

  const src = card.dataset.src;
  const dragSrc = pickDragSource(src);
  const record = dragSrc ? state.dragImageCache.get(dragSrc) : null;
  const nativeSize = getScaledNativeSize(record);
  const fallbackWidth = sx(state.config.layout.cards.zoneWidth);
  const fallbackHeight = sy(state.config.layout.cards.zoneHeight);
  const width = nativeSize ? nativeSize.width : fallbackWidth;
  const height = nativeSize ? nativeSize.height : fallbackHeight;
  ghost.style.width = `${width}px`;
  ghost.style.height = `${height}px`;
  const allowColor =
    state.config.images?.showBackgroundColor !== false || !src;
  const computedBg = getComputedStyle(card).backgroundColor;
  const color = card.dataset.color || card.style.backgroundColor || computedBg;
  if (allowColor && color && color !== 'rgba(0, 0, 0, 0)') {
    ghost.style.backgroundColor = color;
  }

  if (dragSrc) {
    const img = document.createElement('img');
    img.src = dragSrc;
    if (nativeSize) {
      img.width = nativeSize.width;
      img.height = nativeSize.height;
    }
    img.alt = '';
    img.draggable = false;
    ghost.appendChild(img);
  } else {
    ghost.style.display = 'grid';
    ghost.style.placeItems = 'center';
    ghost.style.color = card.style.color || '#081225';
    ghost.style.border = '2px solid rgba(255, 255, 255, 0.28)';
    ghost.textContent = card.textContent || '';
  }

  return ghost;
};

const showNextCard = () => {
  if (tray.querySelector('.card')) return;
  const next = state.queue.shift();
  if (!next) return;
  next.dataset.seq = 'active';
  tray.appendChild(next);
};

const clearOverState = () => {
  if (pointerDrag.overEl) {
    pointerDrag.overEl.classList.remove('is-over');
    pointerDrag.overEl = null;
  }
};

const updatePointerOver = (clientX, clientY) => {
  const el = document.elementFromPoint(clientX, clientY);
  const target = el?.closest('.dropzone, .tray') || null;
  if (target !== pointerDrag.overEl) {
    clearOverState();
    if (target) {
      target.classList.add('is-over');
      pointerDrag.overEl = target;
    }
  }
};

const getGravityConfig = () => state.config.layout.dropzones.gravity || {};

const isGravityEnabled = () => {
  const gravity = getGravityConfig();
  if (!gravity) return true;
  return gravity.enabled !== false;
};

const isPhysicsMode = () => {
  const gravity = getGravityConfig();
  if (gravity.mode) return gravity.mode === 'physics';
  return true;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const layoutZoneStack = (zone, animateCard = null) => {
  if (!isGravityEnabled() || isPhysicsMode()) return;

  const gravity = getGravityConfig();
  const gap = gravity.gap ?? 6;
  const padding = gravity.padding ?? 10;
  const stacking = gravity.stacking !== false;
  const align = gravity.align || 'left';
  const durationMs = gravity.durationMs ?? 800;
  const easing = gravity.easing || 'cubic-bezier(0.22, 1, 0.36, 1)';

  const cardWidth = sx(state.config.layout.cards.zoneWidth);
  const cardHeight = sy(state.config.layout.cards.zoneHeight);
  const padX = sx(padding);
  const padY = sy(padding);
  const gapY = sy(gap);

  let left = padX;
  if (align === 'center') {
    left = Math.max(padX, (zone.clientWidth - cardWidth) / 2);
  } else if (align === 'right') {
    left = Math.max(padX, zone.clientWidth - cardWidth - padX);
  }

  const cards = Array.from(zone.querySelectorAll('.card'));
  cards.forEach((card, index) => {
    card.style.position = 'absolute';
    card.style.left = `${left}px`;
    const targetBottom = padY + index * (cardHeight + gapY);
    card.style.bottom = `${targetBottom}px`;

    if (card === animateCard) {
      const zoneHeight = zone.clientHeight;
      const finalTop = zoneHeight - targetBottom - cardHeight;
      const startTop = padY;
      const startOffset = Math.round(startTop - finalTop);
      card.style.transition = `transform ${durationMs}ms ${easing}`;
      card.style.transform = `translateY(${startOffset}px)`;
      requestAnimationFrame(() => {
        card.style.transform = 'translateY(0px)';
      });
      card.addEventListener(
        'transitionend',
        () => {
          card.style.transition = '';
        },
        { once: true }
      );
    } else {
      card.style.transition = '';
      card.style.transform = '';
    }
  });
};

const layoutAllZoneStacks = (animateCard = null) => {
  if (!isGravityEnabled() || isPhysicsMode()) return;
  dropzonesContainer.querySelectorAll('.dropzone').forEach((zone) => {
    const shouldAnimate = animateCard && zone.contains(animateCard);
    layoutZoneStack(zone, shouldAnimate ? animateCard : null);
  });
};

const resetCardLayout = (card) => {
  card.style.position = '';
  card.style.left = '';
  card.style.right = '';
  card.style.top = '';
  card.style.bottom = '';
  card.style.transition = '';
  card.style.transform = '';
};

const getCardSize = (card) => {
  const rect = card.getBoundingClientRect();
  const fallbackWidth = sx(state.config.layout.cards.zoneWidth);
  const fallbackHeight = sy(state.config.layout.cards.zoneHeight);
  return {
    width: rect.width || fallbackWidth,
    height: rect.height || fallbackHeight,
  };
};

const ensureZoneCardStates = (zone) => {
  const zoneId = zone.dataset.zone;
  const zoneRect = zone.getBoundingClientRect();
  zone.querySelectorAll('.card').forEach((card) => {
    if (physics.cards.has(card)) return;
    const cardRect = card.getBoundingClientRect();
    const x = cardRect.left - zoneRect.left;
    const y = cardRect.top - zoneRect.top;
    const size = getCardSize(card);
    physics.cards.set(card, {
      x,
      y,
      vy: 0,
      zoneId,
      settled: true,
      width: size.width,
      height: size.height,
    });
  });
};

const startPhysicsLoop = () => {
  if (physics.running) return;
  physics.running = true;
  physics.lastTime = performance.now();
  physics.rafId = requestAnimationFrame(stepPhysics);
};

const stopPhysicsLoop = () => {
  physics.running = false;
  if (physics.rafId) {
    cancelAnimationFrame(physics.rafId);
    physics.rafId = null;
  }
};

const stepPhysics = (time) => {
  const dt = Math.min(0.033, (time - physics.lastTime) / 1000);
  physics.lastTime = time;
  const hasMoving = updatePhysics(dt);
  if (hasMoving) {
    physics.rafId = requestAnimationFrame(stepPhysics);
  } else {
    stopPhysicsLoop();
  }
};

const updatePhysics = (dt) => {
  if (!isGravityEnabled() || !isPhysicsMode()) return false;

  const gravity = getGravityConfig();
  const accel = gravity.acceleration ?? 2200;
  const maxSpeed = gravity.maxSpeed ?? 2600;
  const bounce = gravity.bounce ?? 0;
  const settleEpsilon = gravity.settleEpsilon ?? 12;
  const gap = gravity.gap ?? 6;
  const padding = gravity.padding ?? 10;
  const stacking = gravity.stacking !== false;

  const gapY = sy(gap);
  const padX = sx(padding);
  const padY = sy(padding);

  let hasMoving = false;
  const zones = new Map();

  for (const [card, cardState] of physics.cards.entries()) {
    const zone = dropzonesContainer.querySelector(`.dropzone[data-zone=\"${cardState.zoneId}\"]`);
    if (!zone) continue;
    ensureZoneCardStates(zone);
    if (!zones.has(zone)) {
      zones.set(zone, { zone, cards: [] });
    }
    zones.get(zone).cards.push({ card, state: cardState });
  }

  zones.forEach(({ zone, cards }) => {
    const zoneHeight = zone.clientHeight;
    const zoneWidth = zone.clientWidth;

    const ordered = [...cards].sort((a, b) => b.state.y - a.state.y);
    ordered.forEach(({ card, state: cardState }) => {
      const cardWidth = cardState.width || getCardSize(card).width;
      const cardHeight = cardState.height || getCardSize(card).height;
      cardState.width = cardWidth;
      cardState.height = cardHeight;

      const floorY = zoneHeight - padY - cardHeight;
      cardState.x = clamp(cardState.x, padX, zoneWidth - padX - cardWidth);

      let landingY = floorY;
      let supportSettled = true;

      if (stacking) {
        cards.forEach(({ state: otherState }) => {
          if (otherState === cardState) return;
          const otherWidth = otherState.width || cardWidth;
          const overlaps =
            cardState.x < otherState.x + otherWidth && cardState.x + cardWidth > otherState.x;
          if (!overlaps) return;
          if (otherState.y >= cardState.y - 0.5) {
            const surface = otherState.y - gapY - cardHeight;
            if (surface < landingY) {
              landingY = surface;
              supportSettled = otherState.settled;
            }
          }
        });
      }

      if (!cardState.settled) {
        cardState.vy = Math.min(cardState.vy + accel * dt, maxSpeed);
      }
      let nextY = cardState.y + cardState.vy * dt;

      if (nextY >= landingY) {
        nextY = landingY;
        if (bounce > 0 && Math.abs(cardState.vy) > settleEpsilon) {
          cardState.vy = -cardState.vy * bounce;
          cardState.settled = false;
          hasMoving = true;
        } else {
          cardState.vy = 0;
          cardState.settled = supportSettled;
          if (!supportSettled) {
            hasMoving = true;
          }
        }
      } else {
        cardState.settled = false;
        hasMoving = true;
      }

      cardState.y = nextY;
      card.style.position = 'absolute';
      card.style.left = `${cardState.x}px`;
      card.style.top = `${cardState.y}px`;
      card.style.transition = 'none';
      card.style.transform = '';
    });
  });

  return hasMoving;
};

const startPhysicsDrop = (card, zone, clientX, clientY) => {
  if (!isGravityEnabled() || !isPhysicsMode()) return;

  const gravity = getGravityConfig();
  const padding = gravity.padding ?? 10;
  const size = getCardSize(card);
  const cardWidth = size.width;
  const cardHeight = size.height;
  const padX = sx(padding);
  const padY = sy(padding);

  const zoneRect = zone.getBoundingClientRect();
  const safeX = Number.isFinite(clientX) ? clientX : zoneRect.left + zoneRect.width / 2;
  const safeY = Number.isFinite(clientY) ? clientY : zoneRect.top + padY;
  const rawX = safeX - zoneRect.left - cardWidth / 2;
  const rawY = safeY - zoneRect.top - cardHeight / 2;
  const x = clamp(rawX, padX, zoneRect.width - padX - cardWidth);
  const y = clamp(rawY, padY, zoneRect.height - padY - cardHeight);

  ensureZoneCardStates(zone);
  physics.cards.set(card, {
    x,
    y,
    vy: 0,
    zoneId: zone.dataset.zone,
    settled: false,
    width: cardWidth,
    height: cardHeight,
  });

  card.style.position = 'absolute';
  card.style.left = `${x}px`;
  card.style.top = `${y}px`;
  card.style.bottom = '';
  card.style.right = '';
  card.style.transition = 'none';
  card.style.transform = '';

  startPhysicsLoop();
};

const updateZoneState = (zone) => {
  if (zone.querySelector('.card')) {
    zone.classList.add('has-items');
  } else {
    zone.classList.remove('has-items');
  }
};

const updateAllZones = (animateCard = null) => {
  dropzonesContainer.querySelectorAll('.dropzone').forEach(updateZoneState);
  if (!isPhysicsMode()) {
    layoutAllZoneStacks(animateCard);
  }
};

const wireCard = (card) => {
  card.addEventListener('dragstart', (event) => {
    if (state.isTimeUp) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('text/plain', card.id);
    event.dataTransfer.effectAllowed = 'move';

    ensureDragImageHost();
    const dragSrc = pickDragSource(card.dataset.src);
    const record = dragSrc ? state.dragImageCache.get(dragSrc) : null;
    let dragEl;
    let offsetX;
    let offsetY;

    if (record?.loaded) {
      if (!record.canvas) {
        const canvas = document.createElement('canvas');
        canvas.width = record.width;
        canvas.height = record.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(record.img, 0, 0, canvas.width, canvas.height);
        }
        state.dragImageHost.appendChild(canvas);
        record.canvas = canvas;
      }
      dragEl = record.canvas;
      const width = record.canvas?.width || record.width;
      const height = record.canvas?.height || record.height;
      offsetX = Math.round(width / 2);
      offsetY = Math.round(height / 2);
    } else {
      const ghost = buildDragGhost(card);
      document.body.appendChild(ghost);
      const ghostRect = ghost.getBoundingClientRect();
      dragEl = ghost;
      offsetX = Math.round(ghostRect.width / 2);
      offsetY = Math.round(ghostRect.height / 2);
      card._dragGhostRemovable = true;
    }

    event.dataTransfer.setDragImage(dragEl, offsetX, offsetY);
    card._dragGhost = dragEl;

    requestAnimationFrame(() => {
      card.classList.add('is-dragging');
    });
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    if (card._dragGhost && card._dragGhostRemovable) {
      card._dragGhost.remove();
    }
    card._dragGhost = null;
    card._dragGhostRemovable = false;
  });

  card.addEventListener('pointerdown', (event) => {
    if (state.isTimeUp) return;
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    requestFullscreenOnce();

    pointerDrag.active = true;
    pointerDrag.pointerId = event.pointerId;
    pointerDrag.card = card;
    pointerDrag.ghost = buildDragGhost(card);
    pointerDrag.ghost.classList.add('pointer-ghost');
    document.body.appendChild(pointerDrag.ghost);

    const ghostRect = pointerDrag.ghost.getBoundingClientRect();
    pointerDrag.offsetX = ghostRect.width / 2;
    pointerDrag.offsetY = ghostRect.height / 2;

    card.setPointerCapture(event.pointerId);
    card.classList.add('is-dragging');
    pointerDrag.ghost.style.left = `${event.clientX - pointerDrag.offsetX}px`;
    pointerDrag.ghost.style.top = `${event.clientY - pointerDrag.offsetY}px`;
    updatePointerOver(event.clientX, event.clientY);
  });

  card.addEventListener('pointermove', (event) => {
    if (!pointerDrag.active || pointerDrag.pointerId !== event.pointerId) return;
    pointerDrag.ghost.style.left = `${event.clientX - pointerDrag.offsetX}px`;
    pointerDrag.ghost.style.top = `${event.clientY - pointerDrag.offsetY}px`;
    updatePointerOver(event.clientX, event.clientY);
  });

  card.addEventListener('pointerup', (event) => {
    if (!pointerDrag.active || pointerDrag.pointerId !== event.pointerId) return;
    clearOverState();

    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(
      '.dropzone, .tray'
    );
    if (target?.classList.contains('dropzone')) {
      dropCardToZone(pointerDrag.card, target, event.clientX, event.clientY);
    } else if (target?.classList.contains('tray')) {
      dropCardToTray(pointerDrag.card);
    }

    pointerDrag.card.classList.remove('is-dragging');
    pointerDrag.card.releasePointerCapture(event.pointerId);
    pointerDrag.ghost.remove();
    pointerDrag.active = false;
    pointerDrag.pointerId = null;
    pointerDrag.card = null;
    pointerDrag.ghost = null;
  });

  card.addEventListener('pointercancel', () => {
    if (!pointerDrag.active) return;
    clearOverState();
    pointerDrag.card?.classList.remove('is-dragging');
    pointerDrag.ghost?.remove();
    pointerDrag.active = false;
    pointerDrag.pointerId = null;
    pointerDrag.card = null;
    pointerDrag.ghost = null;
  });
};

const handleDragOver = (event) => {
  if (state.isTimeUp) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

const handleDragEnter = (event) => {
  if (state.isTimeUp) return;
  event.preventDefault();
  event.currentTarget.classList.add('is-over');
};

const handleDragLeave = (event) => {
  event.currentTarget.classList.remove('is-over');
};

const applyScoring = (cardId, zoneId) => {
  const target = state.config.targets[cardId];
  const isCorrect = target && String(target) === String(zoneId);
  const delta = isCorrect ? state.config.scoring.correct : state.config.scoring.wrong;

  const prev = state.placements.get(cardId);
  if (prev) {
    updateScore(-prev.delta);
  }

  updateScore(delta);
  state.placements.set(cardId, { zoneId, delta });
};

const removeScoring = (cardId) => {
  const prev = state.placements.get(cardId);
  if (!prev) return;
  updateScore(-prev.delta);
  state.placements.delete(cardId);
};

const dropCardToZone = (card, zone, clientX, clientY) => {
  if (!card || !zone) return;
  const wasActive = card.dataset.seq === 'active';
  zone.classList.remove('is-over');
  zone.appendChild(card);
  zone.classList.add('has-items');
  applyZoneImage(card);
  applyScoring(card.id, zone.dataset.zone);
  updateAllZones(card);
  if (isPhysicsMode()) {
    physics.cards.delete(card);
    startPhysicsDrop(card, zone, clientX, clientY);
  }
  if (wasActive) {
    delete card.dataset.seq;
    showNextCard();
  }

  card.classList.add('just-dropped');
  card.addEventListener(
    'animationend',
    () => {
      card.classList.remove('just-dropped');
    },
    { once: true }
  );
};

const dropCardToTray = (card) => {
  if (!card) return false;
  const current = tray.querySelector('.card');
  if (current && current !== card) {
    tray.animate(
      [
        { transform: 'translateX(0px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0px)' },
      ],
      { duration: 200 }
    );
    return false;
  }

  tray.classList.remove('is-over');
  tray.appendChild(card);
  card.dataset.seq = 'active';
  physics.cards.delete(card);
  resetCardLayout(card);
  applyTrayImage(card);
  removeScoring(card.id);
  updateAllZones();

  card.classList.add('just-dropped');
  card.addEventListener(
    'animationend',
    () => {
      card.classList.remove('just-dropped');
    },
    { once: true }
  );
  return true;
};

const handleDropToZone = (event) => {
  if (state.isTimeUp) return;
  event.preventDefault();
  const zone = event.currentTarget;

  const cardId = event.dataTransfer.getData('text/plain');
  const card = document.getElementById(cardId);
  if (!card) return;

  dropCardToZone(card, zone, event.clientX, event.clientY);
};

const handleDropToTray = (event) => {
  if (state.isTimeUp) return;
  event.preventDefault();

  const cardId = event.dataTransfer.getData('text/plain');
  const card = document.getElementById(cardId);
  if (!card) return;

  dropCardToTray(card);
};

const wireDropzone = (zone) => {
  zone.addEventListener('dragover', handleDragOver);
  zone.addEventListener('dragenter', handleDragEnter);
  zone.addEventListener('dragleave', handleDragLeave);
  zone.addEventListener('drop', handleDropToZone);
};

const applyZoneLayout = (zone, zoneConfig) => {
  if (zoneConfig.width) {
    zone.style.width = `${sx(zoneConfig.width)}px`;
  } else {
    zone.style.width = '';
  }

  if (zoneConfig.height) {
    zone.style.height = `${sy(zoneConfig.height)}px`;
  } else {
    zone.style.height = '';
  }

  if (zoneConfig.position) {
    zone.style.position = 'absolute';
    if (zoneConfig.position.top !== undefined) {
      zone.style.top = `${sy(zoneConfig.position.top)}px`;
    }
    if (zoneConfig.position.right !== undefined) {
      zone.style.right = `${sx(zoneConfig.position.right)}px`;
    }
    if (zoneConfig.position.bottom !== undefined) {
      zone.style.bottom = `${sy(zoneConfig.position.bottom)}px`;
    }
    if (zoneConfig.position.left !== undefined) {
      zone.style.left = `${sx(zoneConfig.position.left)}px`;
    }
  } else {
    zone.style.position = '';
    zone.style.top = '';
    zone.style.right = '';
    zone.style.bottom = '';
    zone.style.left = '';
  }
};

const buildDropzones = (config) => {
  dropzonesContainer.innerHTML = '';
  const hasPosition = config.layout.dropzones.zones.some((zone) => zone.position);
  dropzonesContainer.classList.toggle('is-positioned', hasPosition);
  const gravityEnabled = config.layout.dropzones.gravity?.enabled !== false;

  for (const zoneConfig of config.layout.dropzones.zones) {
    const zone = document.createElement('div');
    zone.className = 'dropzone';
    zone.dataset.zone = zoneConfig.id;
    if (gravityEnabled) zone.classList.add('gravity');
    applyZoneLayout(zone, zoneConfig);

    const label = document.createElement('span');
    label.className = 'zone-label';
    label.textContent = zoneConfig.label || `Zone ${zoneConfig.id}`;
    zone.appendChild(label);

    dropzonesContainer.appendChild(zone);
    wireDropzone(zone);
  }
};

const updateZoneLayouts = (config) => {
  for (const zoneConfig of config.layout.dropzones.zones) {
    const zone = dropzonesContainer.querySelector(`.dropzone[data-zone=\"${zoneConfig.id}\"]`);
    if (zone) {
      applyZoneLayout(zone, zoneConfig);
    }
  }
  if (!isPhysicsMode()) {
    layoutAllZoneStacks();
  }
};

const updateDropCardSizes = () => {
  dropzonesContainer.querySelectorAll('.card').forEach((card) => {
    const base = getBaseImageSrc(card);
    const zoneSrc = getDragImageSrc(base);
    const record = zoneSrc ? state.dragImageCache.get(zoneSrc) : null;
    const nativeSize = getScaledNativeSize(record);
    if (nativeSize) {
      setCardSize(card, nativeSize.width, nativeSize.height);
    }
  });
};

const stripJsonComments = (input) => {
  let output = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  let escape = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inLine) {
      if (char === '\n') {
        inLine = false;
        output += char;
      }
      continue;
    }

    if (inBlock) {
      if (char === '*' && next === '/') {
        inBlock = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escape) {
        escape = false;
      } else if (char === '\\\\') {
        escape = true;
      } else if (char === '\"') {
        inString = false;
      }
      continue;
    }

    if (char === '\"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLine = true;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlock = true;
      i += 1;
      continue;
    }

    output += char;
  }

  return output;
};

const buildCards = (config) => {
  if (!config.images || !Array.isArray(config.images.items)) {
    return;
  }

  tray.innerHTML = '';
  state.queue = [];
  state.dragImageCache.clear();
  if (state.dragImageHost) {
    state.dragImageHost.innerHTML = '';
  }
  for (const item of config.images.items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = item.id;
    card.draggable = true;
    if (item.color) card.dataset.color = item.color;
    if (item.src) card.dataset.src = item.src;
    if (item.src) card.dataset.srcOriginal = item.src;
    card.textContent = item.label || '';
    setCardVisuals(card, item);
    const dragSrc = getDragImageSrc(item.src);
    if (dragSrc) {
      preloadDragImage(dragSrc);
    }
    state.queue.push(card);
    wireCard(card);
  }

  showNextCard();
};

const init = (config) => {
  state.config = config;
  applyConfig(config);
  ensureDragImageHost();
  buildDropzones(config);
  buildCards(config);

  document.addEventListener('pointerdown', requestFullscreenOnce, { once: true });

  tray.addEventListener('dragover', handleDragOver);
  tray.addEventListener('dragenter', handleDragEnter);
  tray.addEventListener('dragleave', handleDragLeave);
  tray.addEventListener('drop', handleDropToTray);

  state.score = 0;
  scoreEl.textContent = state.score;
  resetTimer(config.timer.seconds);
  updateAllZones();
};

const handleResize = () => {
  if (!state.config) return;
  const prevScaleX = state.scaleX;
  const prevScaleY = state.scaleY;
  applyConfig(state.config);
  const ratioX = prevScaleX ? state.scaleX / prevScaleX : 1;
  const ratioY = prevScaleY ? state.scaleY / prevScaleY : 1;
  if (ratioX !== 1 || ratioY !== 1) {
    for (const [card, cardState] of physics.cards.entries()) {
      cardState.x *= ratioX;
      cardState.y *= ratioY;
      card.style.left = `${cardState.x}px`;
      card.style.top = `${cardState.y}px`;
      cardState.width = (cardState.width || 0) * ratioX;
      cardState.height = (cardState.height || 0) * ratioY;
    }
  }
  updateZoneLayouts(state.config);
  updateDropCardSizes();
};

const loadConfig = async () => {
  try {
    const response = await fetch('config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Config not found');
    const text = await response.text();
    const config = JSON.parse(stripJsonComments(text));
    init(config);
  } catch (error) {
    init(defaultConfig);
  }
};

loadConfig();
window.addEventListener('resize', handleResize);
