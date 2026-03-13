const stage = document.querySelector('.stage');
const overlay = document.querySelector('.overlay');
const screensEl = document.querySelector('.screens');
const buttonsEl = document.querySelector('.buttons');
const tray = document.querySelector('.tray');
const dropzonesEl = document.querySelector('.dropzones');

const state = {
  config: null,
  scaleX: 1,
  scaleY: 1,
  activeButtonId: null,
  cards: new Map(),
  cardToButton: new Map(),
  completedByButton: new Map(),
  completedButtons: new Set(),
  placements: new Map(),
  popup: { visible: false, queue: [], hideCurrent: null, suppressOnHide: false },
  started: false,
  finished: false,
  completed: new Set(),
  pointer: { active: false, card: null, ghost: null, offsetX: 0, offsetY: 0, overEl: null },
};

const sx = (value) => value * state.scaleX;
const sy = (value) => value * state.scaleY;

const setCssVar = (name, value) => {
  document.documentElement.style.setProperty(name, value);
};

const computeScale = (config) => {
  const screen = config.layout?.screen || { width: 1920, height: 1200 };
  const viewport = window.visualViewport;
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;
  return {
    scaleX: vw / screen.width,
    scaleY: vh / screen.height,
  };
};

const applyLayout = (config) => {
  const { scaleX, scaleY } = computeScale(config);
  state.scaleX = scaleX;
  state.scaleY = scaleY;

  if (config.background) {
    setCssVar('--bg-color', config.background.color || '#081225');
    const img = config.background.image ? `url(${config.background.image})` : 'none';
    setCssVar('--bg-image', img);
    setCssVar('--bg-size', config.background.size || 'cover');
    setCssVar('--bg-position', config.background.position || 'center');
    setCssVar('--bg-repeat', config.background.repeat || 'no-repeat');
  }

  const buttons = config.layout?.buttons || {};
  setCssVar('--buttons-top', `${sy(buttons.top ?? 24)}px`);
  setCssVar('--buttons-left', `${sx(buttons.left ?? 24)}px`);
  setCssVar('--buttons-gap', `${sx(buttons.gap ?? 12)}px`);
  if (buttons.size?.width != null) {
    setCssVar('--button-width', `${sx(buttons.size.width)}px`);
  }
  if (buttons.size?.height != null) {
    setCssVar('--button-height', `${sy(buttons.size.height)}px`);
  }

  const trayCfg = config.layout?.tray || {};
  setCssVar('--tray-top', `${sy(trayCfg.top ?? 140)}px`);
  setCssVar('--tray-left', `${sx(trayCfg.left ?? 24)}px`);
  setCssVar('--tray-gap', `${sx(trayCfg.gap ?? 12)}px`);
  setCssVar('--card-width', `${sx(config.layout?.cards?.width ?? 200)}px`);
  setCssVar('--card-height', `${sy(config.layout?.cards?.height ?? 140)}px`);

  const dz = config.layout?.dropzones || {};
  setCssVar('--dropzones-top', `${sy(dz.top ?? 140)}px`);
  setCssVar('--dropzones-right', `${sx(dz.right ?? 24)}px`);
  setCssVar('--dropzone-gap', `${sy(dz.gap ?? 16)}px`);
  if (dz.cornerRadius != null) {
    setCssVar('--dropzone-radius', `${sx(dz.cornerRadius)}px`);
  }
  if (dz.zones && dz.zones.length) {
    setCssVar('--dropzone-width', `${sx(dz.zones[0].width ?? 240)}px`);
    setCssVar('--dropzone-height', `${sy(dz.zones[0].height ?? 180)}px`);
  }

  const popupDefaults = config.targets?.popupDefaults || {};
  const pos = popupDefaults.position || {};
  const size = popupDefaults.size || {};
  if (pos.x != null) setCssVar('--popup-left', `${sx(pos.x)}px`);
  if (pos.y != null) setCssVar('--popup-top', `${sy(pos.y)}px`);
  if (pos.left != null) setCssVar('--popup-left', `${sx(pos.left)}px`);
  if (pos.top != null) setCssVar('--popup-top', `${sy(pos.top)}px`);
  if (size.width != null) setCssVar('--popup-width', `${sx(size.width)}px`);
  if (size.height != null) setCssVar('--popup-height', `${sy(size.height)}px`);
};

const clearOverlay = () => {
  overlay.innerHTML = '';
};

const clearScreens = () => {
  screensEl.innerHTML = '';
};

const setUiVisible = (visible) => {
  [buttonsEl, tray, dropzonesEl].forEach((el) => {
    el.classList.toggle('is-hidden', !visible);
  });
};

const normalizePopup = (popup, defaults = {}) => {
  if (!popup) return null;
  if (typeof popup === 'string') return { ...defaults, src: popup };
  if (typeof popup === 'object') return { ...defaults, ...popup };
  return null;
};

const showPopupGroup = (popups, options = {}) => {
  if (state.popup.visible) {
    state.popup.queue.push({ popups, options });
    return;
  }
  const defaults = state.config.targets?.popupDefaults || {};
  const list = Array.isArray(popups) ? popups : [popups];
  const normalizedList = list
    .map((popup) => normalizePopup(popup, defaults))
    .filter((popup) => popup?.src);
  if (!normalizedList.length) return;

  clearOverlay();
  const images = normalizedList.map((normalized) => {
    const img = document.createElement('img');
    img.className = 'popup-image';
    img.src = normalized.src;
    img.alt = '';
    if (normalized.size?.width != null) {
      img.style.width = `${sx(normalized.size.width)}px`;
    }
    if (normalized.size?.height != null) {
      img.style.height = `${sy(normalized.size.height)}px`;
    }
    if (normalized.position?.x != null || normalized.position?.y != null) {
      if (normalized.position?.x != null) img.style.left = `${sx(normalized.position.x)}px`;
      if (normalized.position?.y != null) img.style.top = `${sy(normalized.position.y)}px`;
      const anchor = normalized.position?.anchor || 'top-left';
      img.style.transform = anchor === 'center' ? 'translate(-50%, -50%)' : 'translate(0, 0)';
    }
    overlay.appendChild(img);
    return img;
  });

  state.popup.visible = true;
  const type = options.type || 'wrong';
  const dismissOnAny = options.dismissOnAny ?? true;
  const dismissOnSelf = options.dismissOnSelf ?? (type === 'correct');

  const hide = () => {
    clearOverlay();
    state.popup.visible = false;
    if (!state.popup.suppressOnHide && typeof options.onHide === 'function') {
      options.onHide();
    }
    state.popup.hideCurrent = null;
    state.popup.suppressOnHide = false;
    if (state.popup.queue.length) {
      const next = state.popup.queue.shift();
      showPopupGroup(next.popups, next.options);
    }
  };
  state.popup.hideCurrent = hide;

  if (dismissOnSelf) {
    images.forEach((img) => {
      img.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        hide();
      });
    });
  }
  if (dismissOnAny) {
    const handler = () => {
      document.removeEventListener('pointerdown', handler, true);
      hide();
    };
    document.addEventListener('pointerdown', handler, true);
  }

  const durations = normalizedList
    .map((popup) => popup.duration)
    .filter((value) => typeof value === 'number');
  const duration =
    options.duration ??
    (durations.length ? Math.max(...durations) : type === 'wrong' ? 5000 : 0);
  if (duration > 0) {
    setTimeout(hide, duration);
  }
};

const showPopup = (popup, options = {}) => {
  showPopupGroup(popup, options);
};

const getDragConfig = () => state.config?.drag || {};
const getGhostConfig = () => getDragConfig().ghost || {};

const buildDragGhost = (card) => {
  const styles = window.getComputedStyle(card);
  const scale = getGhostConfig().scale ?? 1;
  const width = parseFloat(styles.width) || card.offsetWidth;
  const height = parseFloat(styles.height) || card.offsetHeight;
  const opacity = getGhostConfig().opacity;
  const useCanvas = opacity != null && Number(opacity) < 1;

  if (useCanvas) {
    const canvas = document.createElement('canvas');
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const alpha = Number(opacity);
      ctx.globalAlpha = Number.isFinite(alpha) ? alpha : 1;
      const bg = styles.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }
      const bgImage = styles.backgroundImage || '';
      const match = bgImage.match(/url\\([\"']?(.*?)[\"']?\\)/i);
      const url = match?.[1];
      if (url) {
        const img = new Image();
        img.src = url;
        if (img.complete && img.naturalWidth > 0) {
          const scaleFit = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * scaleFit;
          const dh = img.naturalHeight * scaleFit;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }
    }
    canvas.className = 'drag-ghost';
    canvas.style.position = 'absolute';
    canvas.style.left = '-9999px';
    canvas.style.top = '-9999px';
    return canvas;
  }

  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = `${width * scale}px`;
  ghost.style.height = `${height * scale}px`;
  ghost.style.backgroundImage = styles.backgroundImage;
  ghost.style.backgroundColor = styles.backgroundColor;
  ghost.style.backgroundSize = styles.backgroundSize || 'contain';
  ghost.style.backgroundPosition = styles.backgroundPosition || 'center';
  ghost.style.backgroundRepeat = styles.backgroundRepeat || 'no-repeat';
  ghost.style.borderRadius = styles.borderRadius;
  if (opacity != null) {
    const value = String(opacity);
    ghost.style.opacity = value;
    ghost.style.filter = `opacity(${value})`;
  }
  ghost.style.position = 'absolute';
  ghost.style.left = '-9999px';
  ghost.style.top = '-9999px';
  return ghost;
};

const dismissPopupsForDrag = () => {
  if (!state.popup.visible && !state.popup.queue.length) return;
  state.popup.queue = [];
  state.popup.suppressOnHide = true;
  if (state.popup.hideCurrent) {
    state.popup.hideCurrent();
  } else {
    clearOverlay();
    state.popup.visible = false;
    state.popup.suppressOnHide = false;
  }
};

const normalizeScreen = (screen) => {
  if (!screen) return null;
  if (typeof screen === 'string') return { src: screen };
  if (typeof screen === 'object') return { ...screen };
  return null;
};

const showScreen = (screen) => {
  const normalized = normalizeScreen(screen);
  if (!normalized?.src) return null;

  clearScreens();
  const img = document.createElement('img');
  img.className = 'screen-image';
  img.src = normalized.src;
  img.alt = '';

  if (normalized.size?.width != null) {
    img.style.width = `${sx(normalized.size.width)}px`;
  }
  if (normalized.size?.height != null) {
    img.style.height = `${sy(normalized.size.height)}px`;
  }
  if (normalized.position?.x != null || normalized.position?.y != null) {
    if (normalized.position?.x != null) img.style.left = `${sx(normalized.position.x)}px`;
    if (normalized.position?.y != null) img.style.top = `${sy(normalized.position.y)}px`;
  }

  screensEl.appendChild(img);
  return img;
};

const showIntroScreen = () => {
  const intro = state.config.screens?.intro;
  if (!intro?.src) {
    state.started = true;
    setUiVisible(true);
    return;
  }
  setUiVisible(false);
  const img = showScreen(intro);
  if (!img) return;
  img.addEventListener('pointerdown', () => {
    clearScreens();
    state.started = true;
    setUiVisible(true);
  });
};

const showFinishScreen = () => {
  if (state.finished) return;
  const finish = state.config.screens?.finish;
  if (!finish?.src) return;
  clearOverlay();
  state.popup.queue = [];
  state.popup.visible = false;
  state.finished = true;
  setUiVisible(false);
  const img = showScreen(finish);
  if (!img) return;
  const delay = finish.dismissDelay ?? 0;
  img.style.pointerEvents = 'none';
  window.setTimeout(() => {
    img.style.pointerEvents = 'auto';
    img.addEventListener(
      'pointerdown',
      () => {
        clearScreens();
        window.location.href = '../index.html';
      },
      { once: true },
    );
  }, delay);
};

const buildButtons = (config) => {
  buttonsEl.innerHTML = '';
  const layoutButtons = config.layout?.buttons || {};
  const baseTop = layoutButtons.top ?? 24;
  const baseLeft = layoutButtons.left ?? 24;
  const gap = layoutButtons.gap ?? 12;
  const defaultSize = layoutButtons.size || {};
  const defaultWidth = defaultSize.width ?? 194;
  const defaultHeight = defaultSize.height ?? 194;
  config.buttons.forEach((btn, idx) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'action-btn';
    const label = btn.label || `Bouton ${idx + 1}`;
    el.setAttribute('aria-label', label);
    el.dataset.button = btn.id;
    const pos = btn.position || {};
    const x = pos.x != null ? pos.x : baseLeft + idx * (defaultWidth + gap);
    const y = pos.y != null ? pos.y : baseTop;
    el.style.left = `${sx(x)}px`;
    el.style.top = `${sy(y)}px`;
    if (btn.image) {
      const img = document.createElement('img');
      img.className = 'action-btn__img';
      img.alt = label;
      img.src = btn.image;
      if (btn.size?.width != null) img.style.width = `${sx(btn.size.width)}px`;
      if (btn.size?.height != null) img.style.height = `${sy(btn.size.height)}px`;
      img.dataset.src = btn.image;
      if (btn.imageActive) img.dataset.srcActive = btn.imageActive;
      if (btn.imageDisabled) img.dataset.srcDisabled = btn.imageDisabled;
      el.appendChild(img);
    } else {
      el.textContent = label;
    }
    el.addEventListener('click', () => setActiveButton(btn.id));
    buttonsEl.appendChild(el);
  });
};

const buildDropzones = (config) => {
  dropzonesEl.innerHTML = '';
  const zones = config.layout?.dropzones?.zones || [];
  zones.forEach((zoneCfg, idx) => {
    const zone = document.createElement('div');
    zone.className = 'dropzone';
    zone.dataset.zone = zoneCfg.id || String(idx + 1);
    if (zoneCfg.width) zone.style.width = `${sx(zoneCfg.width)}px`;
    if (zoneCfg.height) zone.style.height = `${sy(zoneCfg.height)}px`;
    if (zoneCfg.x != null) zone.style.left = `${sx(zoneCfg.x)}px`;
    if (zoneCfg.y != null) zone.style.top = `${sy(zoneCfg.y)}px`;
    zone.style.position = 'absolute';
    dropzonesEl.appendChild(zone);
  });
};

const buildCards = (config) => {
  state.cards.clear();
  state.cardToButton.clear();
  state.completedByButton.clear();
  state.completedButtons.clear();
  config.buttons.forEach((btn) => {
    btn.images.forEach((imageId) => {
      state.cardToButton.set(imageId, btn.id);
    });
  });
  config.images.items.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = item.id;
    const showLabels = config.cards?.showLabels ?? true;
    card.textContent = showLabels ? item.label || '' : '';
    card.dataset.imageId = item.id;
    if (item.src) {
      card.style.backgroundImage = `url(${item.src})`;
      card.style.backgroundColor = 'transparent';
    } else if (item.color) {
      card.style.backgroundColor = item.color;
    }
    wireCard(card);
    state.cards.set(item.id, card);
  });
};

const renderTrayForButton = (buttonId) => {
  tray.innerHTML = '';
  const btn = state.config.buttons.find((b) => b.id === buttonId);
  if (!btn) return;
  if (btn.trayFrame?.src) {
    const frame = document.createElement('img');
    frame.className = 'tray-frame';
    frame.alt = '';
    frame.src = btn.trayFrame.src;
    if (btn.trayFrame.size?.width != null) {
      frame.style.width = `${sx(btn.trayFrame.size.width)}px`;
    }
    if (btn.trayFrame.size?.height != null) {
      frame.style.height = `${sy(btn.trayFrame.size.height)}px`;
    }
    if (btn.trayFrame.position?.x != null) {
      frame.style.left = `${sx(btn.trayFrame.position.x)}px`;
    }
    if (btn.trayFrame.position?.y != null) {
      frame.style.top = `${sy(btn.trayFrame.position.y)}px`;
    }
    tray.appendChild(frame);
  }
  const trayCfg = state.config.layout?.tray || {};
  const positions = trayCfg.positions || [];
  const cardWidth = state.config.layout?.cards?.width ?? 200;
  const cardHeight = state.config.layout?.cards?.height ?? 140;
  const gap = trayCfg.gap ?? 12;
  const cols = Math.max(1, trayCfg.columns ?? 3);
  const baseLeft = trayCfg.left ?? 24;
  const baseTop = trayCfg.top ?? 140;

  btn.images.forEach((imageId, index) => {
    const card = state.cards.get(imageId);
    if (!card) return;
    if (state.completed.has(imageId)) return;
    tray.appendChild(card);
    const pos = positions[index];
    const x = pos?.x ?? baseLeft + (index % cols) * (cardWidth + gap);
    const y = pos?.y ?? baseTop + Math.floor(index / cols) * (cardHeight + gap);
    card.style.left = `${sx(x)}px`;
    card.style.top = `${sy(y)}px`;
    card.style.transform = 'translate(0, 0)';
  });
};

const setActiveButton = (buttonId) => {
  if (state.completedButtons.has(buttonId)) return;
  resetDropzones();
  state.activeButtonId = buttonId;
  buttonsEl.querySelectorAll('.action-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.button === buttonId);
    const isDisabled = state.completedButtons.has(btn.dataset.button);
    btn.disabled = isDisabled;
    btn.classList.toggle('is-disabled', isDisabled);
    const img = btn.querySelector('.action-btn__img');
    if (img) {
      const isActive = btn.dataset.button === buttonId;
      const src = isDisabled
        ? img.dataset.srcDisabled || img.dataset.src
        : isActive
          ? img.dataset.srcActive || img.dataset.src
          : img.dataset.src;
      if (src) img.src = src;
    }
  });
  renderTrayForButton(buttonId);
};

const getTargets = () => state.config.targets?.items || {};

const isCorrectDrop = (cardId, zoneId) => {
  const entry = getTargets()[cardId];
  const zones = Array.isArray(entry) ? entry : entry ? [entry] : [];
  return zones.some((z) => String(z) === String(zoneId));
};

const handleDrop = (card, zone) => {
  if (!state.started || state.finished) return;
  if (!card || !zone) return;
  const zoneId = zone.dataset.zone;
  if (!isCorrectDrop(card.id, zoneId)) {
    const wrong = state.config.targets?.wrongPopup;
    if (wrong?.src) showPopup(wrong, { type: 'wrong' });
    renderTrayForButton(state.activeButtonId);
    return;
  }

  zone.appendChild(card);
  card.style.left = '50%';
  card.style.top = '50%';
  card.style.transform = 'translate(-50%, -50%)';

  if (state.completed.has(card.id)) return;

  const perCard = state.config.targets?.correctPopups?.[card.id];

  state.completed.add(card.id);
  const buttonId = state.cardToButton.get(card.id);
  if (buttonId) {
    const set = state.completedByButton.get(buttonId) || new Set();
    set.add(card.id);
    state.completedByButton.set(buttonId, set);
    const totalForButton =
      state.config.buttons.find((b) => b.id === buttonId)?.images?.length ?? 0;
    const remainingForButton = Math.max(0, totalForButton - set.size);
    if (remainingForButton > 0) {
      const placePopup = state.config.targets?.placePopup;
      showPopupGroup([perCard, placePopup].filter(Boolean), {
        type: 'correct',
        dismissOnSelf: true,
      });
    } else {
      const chosenPopup = state.config.targets?.chosenPopup;
      showPopupGroup([perCard, chosenPopup].filter(Boolean), {
        type: 'correct',
        dismissOnSelf: true,
        onHide: () => {
          const zones = dropzonesEl.querySelectorAll('.dropzone');
          zones.forEach((zone) => {
            zone.querySelectorAll('.card').forEach((placedCard) => {
              const placedId = placedCard.id;
              const placedBtn = state.cardToButton.get(placedId);
              if (placedBtn === buttonId) placedCard.remove();
            });
          });

          state.completedButtons.add(buttonId);
          const buttonEl = buttonsEl.querySelector(`[data-button="${buttonId}"]`);
          if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.classList.add('is-disabled');
            const img = buttonEl.querySelector('.action-btn__img');
            if (img && img.dataset.srcDisabled) img.src = img.dataset.srcDisabled;
          }

          if (state.completedButtons.size === state.config.buttons.length) {
            showFinishScreen();
          }
        },
      });
    }
  }
};

const clearOver = () => {
  dropzonesEl.querySelectorAll('.dropzone.is-over').forEach((z) => z.classList.remove('is-over'));
};

const resetDropzones = () => {
  const cardsInZones = dropzonesEl.querySelectorAll('.card');
  cardsInZones.forEach((card) => {
    const cardId = card.id;
    card.remove();
    if (state.completed.has(cardId)) {
      state.completed.delete(cardId);
      const buttonId = state.cardToButton.get(cardId);
      if (buttonId) {
        const set = state.completedByButton.get(buttonId);
        if (set) {
          set.delete(cardId);
          if (!set.size) state.completedByButton.delete(buttonId);
        }
        state.completedButtons.delete(buttonId);
      }
    }
  });
  clearOver();
};

const wireCard = (card) => {
  card.setAttribute('draggable', 'true');

  card.addEventListener('dragstart', (event) => {
    dismissPopupsForDrag();
    event.dataTransfer.setData('text/plain', card.id);
    card.classList.add('is-dragging');
    const ghostCfg = getGhostConfig();
    if (ghostCfg.enabled) {
      const ghost = buildDragGhost(card);
      document.body.appendChild(ghost);
      const rect = ghost.getBoundingClientRect();
      event.dataTransfer.setDragImage(ghost, rect.width / 2, rect.height / 2);
      card._dragGhost = ghost;
    }
    if (getDragConfig().hideSource) {
      card.style.opacity = '0';
    }
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    clearOver();
    if (card._dragGhost) {
      card._dragGhost.remove();
      card._dragGhost = null;
    }
    card.style.opacity = '';
  });

  card.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    dismissPopupsForDrag();

    state.pointer.active = true;
    state.pointer.card = card;
    card.classList.add('is-dragging');
    if (getDragConfig().hideSource) {
      card.style.opacity = '0';
    }

    const ghost = buildDragGhost(card);
    document.body.appendChild(ghost);

    state.pointer.ghost = ghost;
    state.pointer.offsetX = ghost.offsetWidth / 2;
    state.pointer.offsetY = ghost.offsetHeight / 2;
    ghost.style.left = `${event.clientX - state.pointer.offsetX}px`;
    ghost.style.top = `${event.clientY - state.pointer.offsetY}px`;
  });

  card.addEventListener('pointermove', (event) => {
    if (!state.pointer.active || state.pointer.card !== card) return;
    state.pointer.ghost.style.left = `${event.clientX - state.pointer.offsetX}px`;
    state.pointer.ghost.style.top = `${event.clientY - state.pointer.offsetY}px`;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.dropzone');
    clearOver();
    if (target) target.classList.add('is-over');
  });

  card.addEventListener('pointerup', (event) => {
    if (!state.pointer.active || state.pointer.card !== card) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.dropzone');
    if (target) handleDrop(card, target);
    card.classList.remove('is-dragging');
    card.style.opacity = '';
    state.pointer.ghost?.remove();
    state.pointer.active = false;
    state.pointer.card = null;
    state.pointer.ghost = null;
    clearOver();
  });
};

const wireDropzones = () => {
  dropzonesEl.querySelectorAll('.dropzone').forEach((zone) => {
    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('is-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      const id = event.dataTransfer.getData('text/plain');
      const card = state.cards.get(id);
      zone.classList.remove('is-over');
      handleDrop(card, zone);
      clearOver();
    });
  });
};

const init = (config) => {
  state.config = config;
  state.started = false;
  state.finished = false;
  state.completed = new Set();
  applyLayout(config);
  buildButtons(config);
  buildDropzones(config);
  buildCards(config);
  wireDropzones();
  const firstButton = config.buttons[0]?.id;
  if (firstButton) setActiveButton(firstButton);
  showIntroScreen();
};

const loadConfig = async () => {
  const res = await fetch('config.json', { cache: 'no-store' });
  return res.json();
};

const handleResize = () => {
  if (!state.config) return;
  applyLayout(state.config);
  buildButtons(state.config);
  buildDropzones(state.config);
  const active = state.activeButtonId || state.config.buttons[0]?.id;
  if (active) setActiveButton(active);
  if (!state.started) showIntroScreen();
  if (state.finished) showFinishScreen();
};

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleResize);
  window.visualViewport.addEventListener('scroll', handleResize);
}

loadConfig().then(init).catch((err) => {
  console.error('Erreur chargement config', err);
});
