const STORAGE_KEY = "minemind-arena-v1";
const SPRINT_LIMIT_MS = 120000;

const MODES = [
  { id: "daily", label: "Daily", eyebrow: "Daily Challenge" },
  { id: "sprint", label: "Sprint 2:00", eyebrow: "Speed Arena" },
  { id: "classic", label: "Classic", eyebrow: "Classic Run" },
  { id: "trainer", label: "Trainer", eyebrow: "Probability Trainer" },
];

const DIFFICULTIES = {
  easy: { label: "Easy", rows: 9, cols: 9, mines: 10 },
  medium: { label: "Medium", rows: 16, cols: 16, mines: 40 },
  expert: { label: "Expert", rows: 16, cols: 30, mines: 99 },
};

// const CITY_NAMES = ["Рим", "Алматы", "Астана", "Москва", "Берлин", "Тбилиси", "Нью-Йорк"];
// const RIVAL_NAMES = [
//   "Aida",
//   "Leo",
//   "Mira",
//   "Nika",
//   "Sam",
//   "Ren",
//   "Yara",
//   "Ilya",
//   "Tao",
//   "Sofia",
//   "Noor",
//   "Ada",
// ];

const elements = {};
let appData = loadAppData();
let game = null;
let coachState = null;
let timerId = null;
let persistAt = 0;
let longPressTimer = null;
let longPressFired = false;

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  renderModeTabs();
  renderDifficultyTabs();
  bindEvents();
  applyThemeAndSkin();

  const restored = restoreCurrentGame();
  if (!restored) {
    startNewGame({
      mode: appData.settings.mode || "daily",
      difficulty: appData.settings.difficulty || "medium",
    });
  } else {
    if (game.status === "playing") startTimerLoop();
    renderAll();
  }
}

function cacheElements() {
  [
    "modeTabs",
    "difficultyTabs",
    "difficultyLabel",
    "board",
    "boardWrap",
    "newGameButton",
    "flagModeButton",
    "themeToggle",
    "profileButton",
    "profileName",
    "profileInitials",
    "cityLeague",
    "leagueRank",
    "statGrid",
    "historyList",
    "clearHistoryButton",
    "modeEyebrow",
    "gameStatus",
    "statusDot",
    "metricRow",
    "seedLabel",
    "accuracyStrip",
    "coachTitle",
    "coachText",
    "riskMeterFill",
    "coachHighlightButton",
    "coachApplyButton",
    "riskToggleButton",
    "leaderboard",
    "leaderboardDate",
    "proBadge",
    "upgradeButton",
    "proPanelButton",
    "profileDialog",
    "profileForm",
    "nameInput",
    "cityInput",
    "skinInput",
    "proDialog",
    "proForm",
    "demoProButton",
    "stripeButton",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  on(elements.newGameButton, "click", () => startNewGame());

  on(elements.flagModeButton, "click", () => {
    game.flagMode = !game.flagMode;
    renderControls();
    persistCurrentGame();
  });

  on(elements.themeToggle, "click", () => {
    appData.settings.theme = appData.settings.theme === "dark" ? "light" : "dark";
    saveAppData();
    applyThemeAndSkin();
  });

  on(elements.profileButton, "click", openProfileDialog);
  on(elements.upgradeButton, "click", openProDialog);
  on(elements.proPanelButton, "click", openProDialog);

  on(elements.clearHistoryButton, "click", () => {
    appData.games = [];
    appData.bests = {};
    saveAppData();
    renderStats();
    renderHistory();
    renderLeaderboard();
  });

  on(elements.profileForm, "submit", (event) => {
    if (event.submitter?.id !== "saveProfileButton") return;
    appData.profile.name = elements.nameInput?.value.trim() || "Игрок";
    appData.profile.city = elements.cityInput?.value || appData.profile.city;
    appData.profile.skin = appData.profile.pro ? elements.skinInput?.value || "signal" : "signal";
    saveAppData();
    applyThemeAndSkin();
    renderAll();
  });

  on(elements.proForm, "submit", (event) => {
    if (event.submitter?.id === "demoProButton" || event.submitter?.id === "stripeButton") {
      appData.profile.pro = true;
      saveAppData();
      renderAll();
    }
  });

  on(elements.coachHighlightButton, "click", () => {
    if (!coachState?.recommendation) return;
    game.highlighted = coachState.recommendation.index;
    renderBoard();
    persistCurrentGame();
  });

  on(elements.coachApplyButton, "click", applyCoachMove);
  on(elements.riskToggleButton, "click", toggleRiskMap);

  on(elements.board, "click", (event) => {
    const button = event.target.closest(".cell");
    if (!button) return;
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    const index = Number(button.dataset.index);
    if (game.flagMode) {
      toggleFlag(index);
      return;
    }
    revealIndex(index);
  });

  on(elements.board, "dblclick", (event) => {
    const button = event.target.closest(".cell");
    if (!button) return;
    chordCell(Number(button.dataset.index));
  });

  on(elements.board, "contextmenu", (event) => {
    const button = event.target.closest(".cell");
    if (!button) return;
    event.preventDefault();
    toggleFlag(Number(button.dataset.index));
  });

  on(elements.board, "pointerdown", (event) => {
    const button = event.target.closest(".cell");
    if (!button || event.pointerType === "mouse") return;
    const index = Number(button.dataset.index);
    longPressFired = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      toggleFlag(index);
    }, 430);
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach((name) => {
    on(elements.board, name, () => clearTimeout(longPressTimer));
  });
}

function on(element, eventName, handler) {
  if (element) element.addEventListener(eventName, handler);
}

function renderModeTabs() {
  elements.modeTabs.replaceChildren();
  MODES.forEach((mode) => {
    const button = document.createElement("button");
    button.className = "mode-tab";
    button.type = "button";
    button.textContent = mode.label;
    button.dataset.mode = mode.id;
    button.addEventListener("click", () => startNewGame({ mode: mode.id }));
    elements.modeTabs.append(button);
  });
}

function renderDifficultyTabs() {
  elements.difficultyTabs.replaceChildren();
  Object.entries(DIFFICULTIES).forEach(([id, difficulty]) => {
    const button = document.createElement("button");
    button.className = "difficulty-tab";
    button.type = "button";
    button.textContent = difficulty.label;
    button.dataset.difficulty = id;
    button.addEventListener("click", () => startNewGame({ difficulty: id }));
    elements.difficultyTabs.append(button);
  });
}

function startNewGame(options = {}) {
  stopTimerLoop();
  const mode = options.mode || game?.mode || appData.settings.mode || "daily";
  const difficulty = options.difficulty || game?.difficulty || appData.settings.difficulty || "medium";
  const config = DIFFICULTIES[difficulty];
  const today = todayKey();
  const seed =
    mode === "daily"
      ? `daily-${today}-${difficulty}`
      : `${mode}-${difficulty}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  game = {
    version: 1,
    mode,
    difficulty,
    rows: config.rows,
    cols: config.cols,
    mines: config.mines,
    seed,
    board: createEmptyBoard(config.rows, config.cols),
    minesPlaced: false,
    status: "idle",
    startedAt: null,
    elapsedMs: 0,
    moves: 0,
    flags: 0,
    revealed: 0,
    safeOpens: 0,
    mistakes: 0,
    hintsUsed: 0,
    flagMode: false,
    riskVisible: mode === "trainer" || Boolean(appData.settings.riskVisible),
    highlighted: null,
    recorded: false,
    createdAt: Date.now(),
  };

  if (mode === "daily") {
    const opener = centerIndex(game.rows, game.cols);
    const excluded = new Set([opener, ...neighbors(opener)]);
    game.board = generateBoard(game.rows, game.cols, game.mines, game.seed, excluded);
    game.minesPlaced = true;
    revealCascade(opener);
  }

  appData.settings.mode = mode;
  appData.settings.difficulty = difficulty;
  saveAppData();
  renderAll();
  persistCurrentGame();
}

function restoreCurrentGame() {
  const current = appData.current;
  if (!current || current.version !== 1 || !Array.isArray(current.board)) return false;
  if (!DIFFICULTIES[current.difficulty] || !MODES.some((mode) => mode.id === current.mode)) return false;
  game = current;
  game.flagMode = false;
  if (game.mode === "sprint" && game.status === "playing" && currentElapsed() >= SPRINT_LIMIT_MS) {
    finishGame("lost", "timeout");
  }
  return true;
}

function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows * cols }, (_, index) => ({
    index,
    mine: false,
    revealed: false,
    flagged: false,
    adj: 0,
  }));
}

function generateBoard(rows, cols, mines, seed, excluded) {
  const board = createEmptyBoard(rows, cols);
  const rng = mulberry32(hashString(seed));
  const candidates = [];

  for (let index = 0; index < board.length; index += 1) {
    if (!excluded.has(index)) candidates.push(index);
  }

  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  candidates.slice(0, mines).forEach((index) => {
    board[index].mine = true;
  });

  board.forEach((cell) => {
    if (cell.mine) return;
    cell.adj = neighbors(cell.index, rows, cols).filter((index) => board[index].mine).length;
  });

  return board;
}

function ensureMines(openIndex) {
  if (game.minesPlaced) return;
  const previousFlags = new Set(game.board.filter((cell) => cell.flagged).map((cell) => cell.index));
  const excluded = new Set([openIndex, ...neighbors(openIndex)]);
  game.board = generateBoard(game.rows, game.cols, game.mines, game.seed, excluded);
  previousFlags.forEach((index) => {
    if (index !== openIndex) game.board[index].flagged = true;
  });
  game.flags = game.board.filter((cell) => cell.flagged).length;
  game.minesPlaced = true;
}

function revealIndex(index, options = {}) {
  if (!game || game.status === "won" || game.status === "lost") return;
  ensureMines(index);

  const cell = game.board[index];
  if (!cell || cell.revealed || cell.flagged) return;

  if (!options.system) {
    startClockIfNeeded();
    game.moves += 1;
  }

  if (cell.mine) {
    cell.revealed = true;
    game.mistakes += 1;
    game.highlighted = null;
    finishGame("lost", "mine");
    return;
  }

  const before = game.revealed;
  revealCascade(index);
  if (!options.system) game.safeOpens += game.revealed - before;
  game.highlighted = null;

  if (game.revealed >= game.rows * game.cols - game.mines) {
    finishGame("won", "cleared");
    return;
  }

  renderAll();
  persistCurrentGame();
}

function revealCascade(startIndex) {
  const queue = [startIndex];
  const visited = new Set();

  while (queue.length) {
    const index = queue.shift();
    if (visited.has(index)) continue;
    visited.add(index);
    const cell = game.board[index];
    if (!cell || cell.revealed || cell.flagged || cell.mine) continue;

    cell.revealed = true;
    game.revealed += 1;

    if (cell.adj !== 0) continue;
    neighbors(index).forEach((next) => {
      const nextCell = game.board[next];
      if (nextCell && !nextCell.revealed && !nextCell.flagged && !nextCell.mine) {
        queue.push(next);
      }
    });
  }
}

function toggleFlag(index, options = {}) {
  if (!game || game.status === "won" || game.status === "lost") return;
  const cell = game.board[index];
  if (!cell || cell.revealed) return;

  if (!options.system) {
    game.moves += 1;
    if (game.minesPlaced) startClockIfNeeded();
  }

  cell.flagged = !cell.flagged;
  game.flags += cell.flagged ? 1 : -1;
  game.highlighted = null;

  renderAll();
  persistCurrentGame();
}

function chordCell(index) {
  if (!game || game.status !== "playing") return;
  const cell = game.board[index];
  if (!cell?.revealed || cell.adj === 0) return;
  const around = neighbors(index);
  const flagCount = around.filter((next) => game.board[next].flagged).length;
  if (flagCount !== cell.adj) return;
  around
    .filter((next) => !game.board[next].revealed && !game.board[next].flagged)
    .forEach((next) => revealIndex(next));
}

function finishGame(outcome, reason) {
  game.elapsedMs = currentElapsed();
  game.status = outcome;
  game.endReason = reason;
  stopTimerLoop();

  if (outcome === "lost") {
    game.board.forEach((cell) => {
      if (cell.mine) cell.revealed = true;
    });
  } else {
    game.board.forEach((cell) => {
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
      }
    });
    game.flags = game.mines;
  }

  recordGame(outcome, reason);
  renderAll();
  persistCurrentGame();
}

function recordGame(outcome, reason) {
  if (game.recorded) return;
  const record = {
    id: `${game.seed}-${Date.now()}`,
    mode: game.mode,
    difficulty: game.difficulty,
    outcome,
    reason,
    elapsedMs: game.elapsedMs,
    moves: game.moves,
    accuracy: calculateAccuracy(),
    hintsUsed: game.hintsUsed,
    city: appData.profile.city,
    seed: game.seed,
    date: todayKey(),
    createdAt: Date.now(),
    score: calculateScore(game.elapsedMs, calculateAccuracy(), game.hintsUsed),
  };

  appData.games.unshift(record);
  appData.games = appData.games.slice(0, 40);

  if (outcome === "won") {
    const bestKey = `${game.mode}:${game.difficulty}`;
    const previous = appData.bests[bestKey];
    if (!previous || record.score < previous.score) appData.bests[bestKey] = record;
  }

  game.recorded = true;
  saveAppData();
}

function startClockIfNeeded() {
  if (game.status === "idle") {
    game.status = "playing";
    game.startedAt = Date.now() - game.elapsedMs;
    startTimerLoop();
  }
}

function startTimerLoop() {
  stopTimerLoop();
  timerId = setInterval(() => {
    game.elapsedMs = currentElapsed();
    if (game.mode === "sprint" && game.elapsedMs >= SPRINT_LIMIT_MS) {
      finishGame("lost", "timeout");
      return;
    }
    renderStatus();
    renderMetrics();
    renderAccuracyStrip();
    const now = Date.now();
    if (now - persistAt > 1200) persistCurrentGame();
  }, 250);
}

function stopTimerLoop() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function currentElapsed() {
  if (!game) return 0;
  if (game.status === "playing" && game.startedAt) return Date.now() - game.startedAt;
  return game.elapsedMs || 0;
}

function renderAll() {
  coachState = analyzeBoard();
  renderControls();
  renderProfile();
  renderStats();
  renderHistory();
  renderStatus();
  renderMetrics();
  renderAccuracyStrip();
  renderBoard();
  renderCoach();
  renderLeaderboard();
}

function renderControls() {
  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === game.mode);
  });
  document.querySelectorAll(".difficulty-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === game.difficulty);
  });
  elements.flagModeButton?.setAttribute("aria-pressed", String(Boolean(game.flagMode)));
  elements.riskToggleButton?.setAttribute("aria-pressed", String(Boolean(game.riskVisible)));
  if (elements.difficultyLabel) elements.difficultyLabel.textContent = DIFFICULTIES[game.difficulty].label;
}

function renderProfile() {
  const { name, city, pro } = appData.profile;
  if (elements.profileName) elements.profileName.textContent = name;
  if (elements.profileInitials) elements.profileInitials.textContent = initials(name);
  if (elements.cityLeague) elements.cityLeague.textContent = city;
  if (elements.proBadge) {
    elements.proBadge.textContent = pro ? "Pro" : "Free";
    elements.proBadge.classList.toggle("active", Boolean(pro));
  }
  if (elements.upgradeButton) elements.upgradeButton.textContent = pro ? "Pro active" : "Upgrade to Pro";
  if (elements.proPanelButton) elements.proPanelButton.textContent = pro ? "Pro активен" : "Upgrade to Pro";
}

function renderStats() {
  if (!elements.statGrid) return;
  const games = appData.games;
  const wins = games.filter((item) => item.outcome === "won").length;
  const losses = games.filter((item) => item.outcome === "lost").length;
  const winRate = games.length ? Math.round((wins / games.length) * 100) : 0;
  const best = appData.bests[`${game.mode}:${game.difficulty}`];
  const streak = currentStreak(games);
  const stats = [
    ["Партии", String(games.length)],
    ["Win rate", `${winRate}%`],
    ["Streak", String(streak)],
    ["Best", best ? formatTime(best.elapsedMs) : "--"],
  ];

  elements.statGrid.replaceChildren();
  stats.forEach(([label, value]) => {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    tile.append(labelEl, valueEl);
    elements.statGrid.append(tile);
  });

  if (!losses && !wins) {
    if (elements.leagueRank) elements.leagueRank.textContent = "#--";
  }
}

function renderHistory() {
  if (!elements.historyList) return;
  elements.historyList.replaceChildren();
  const history = appData.games.slice(0, 6);
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Первые результаты появятся здесь.";
    elements.historyList.append(empty);
    return;
  }

  history.forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";
    const outcome = document.createElement("span");
    outcome.className = `history-outcome ${item.outcome === "won" ? "win" : "loss"}`;
    outcome.textContent = item.outcome === "won" ? "W" : "L";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${modeLabel(item.mode)} · ${DIFFICULTIES[item.difficulty]?.label || item.difficulty}`;
    const meta = document.createElement("small");
    meta.textContent = `${formatTime(item.elapsedMs)} · ${item.accuracy}% · ${item.city}`;
    copy.append(title, meta);
    const score = document.createElement("strong");
    score.textContent = String(Math.round(item.score));
    row.append(outcome, copy, score);
    elements.historyList.append(row);
  });
}

function renderStatus() {
  const mode = MODES.find((item) => item.id === game.mode);
  if (elements.modeEyebrow) elements.modeEyebrow.textContent = mode?.eyebrow || "Arena";
  const statusCopy = {
    idle: game.mode === "daily" ? "Daily поле открыто" : "Готово",
    playing: game.mode === "sprint" ? "Sprint идет" : "Игра идет",
    won: "Победа",
    lost: game.endReason === "timeout" ? "Время вышло" : "Поле взорвано",
  };
  if (elements.gameStatus) elements.gameStatus.textContent = statusCopy[game.status] || "Готово";
  if (elements.statusDot) {
    elements.statusDot.className = "status-dot";
    if (game.status === "won") elements.statusDot.classList.add("won");
    if (game.status === "lost") elements.statusDot.classList.add("lost");
  }
  if (elements.seedLabel) {
    elements.seedLabel.textContent =
      game.mode === "daily" ? game.seed.replace("daily-", "") : `${game.mode}-${game.difficulty}`;
  }
}

function renderMetrics() {
  if (!elements.metricRow) return;
  const remaining = Math.max(0, game.mines - game.flags);
  const elapsed = currentElapsed();
  const timeValue =
    game.mode === "sprint" ? formatTime(Math.max(0, SPRINT_LIMIT_MS - elapsed)) : formatTime(elapsed);
  const metrics = [
    ["Time", timeValue],
    ["Mines", String(remaining)],
    ["Moves", String(game.moves)],
    ["Coach", String(game.hintsUsed)],
  ];
  elements.metricRow.replaceChildren();
  metrics.forEach(([label, value]) => {
    const metric = document.createElement("div");
    metric.className = "metric";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    metric.append(labelEl, valueEl);
    elements.metricRow.append(metric);
  });
}

function renderAccuracyStrip() {
  if (!elements.accuracyStrip) return;
  const pills = [
    ["Точность", `${calculateAccuracy()}%`],
    ["Открыто", `${game.revealed}/${game.rows * game.cols - game.mines}`],
    ["Риск", coachState ? `${Math.round((coachState.recommendation?.risk ?? coachState.baseRisk) * 100)}%` : "--"],
  ];
  elements.accuracyStrip.replaceChildren();
  pills.forEach(([label, value]) => {
    const pill = document.createElement("span");
    pill.className = "accuracy-pill";
    pill.textContent = `${label}: ${value}`;
    elements.accuracyStrip.append(pill);
  });
}

function renderBoard() {
  if (!elements.board) return;
  elements.board.style.setProperty("--cols", String(game.cols));
  elements.board.replaceChildren();
  const fragment = document.createDocumentFragment();

  game.board.forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.index = String(cell.index);
    button.setAttribute("role", "gridcell");

    if (cell.revealed) {
      button.classList.add("is-revealed");
      if (cell.mine) {
        button.classList.add("is-mine");
        button.textContent = "*";
      } else if (cell.adj > 0) {
        button.classList.add(`n${cell.adj}`);
        button.textContent = String(cell.adj);
      }
    } else {
      button.classList.add("is-hidden");
      if (cell.flagged) {
        button.classList.add("is-flagged");
        button.textContent = "!";
      } else if (game.riskVisible && coachState?.risks?.has(cell.index)) {
        const risk = coachState.risks.get(cell.index);
        button.style.setProperty("--risk-alpha", String(Math.min(0.5, 0.06 + risk * 0.42)));
      }
    }

    if (game.highlighted === cell.index) button.classList.add("is-highlighted");
    button.setAttribute("aria-label", cellAriaLabel(cell));
    fragment.append(button);
  });

  elements.board.append(fragment);
}

function renderCoach() {
  if (!elements.coachText) return;
  const recommendation = coachState?.recommendation;
  if (elements.coachTitle) {
    elements.coachTitle.textContent =
      game.mode === "trainer" ? "Вероятностный тренер" : recommendation ? "Лучший следующий ход" : "Анализ поля";
  }
  elements.coachText.textContent = coachState?.text || "Откройте первую клетку, и тренер начнет считать безопасные ходы.";
  if (elements.riskMeterFill) {
    elements.riskMeterFill.style.width = `${Math.round((recommendation?.risk ?? coachState?.baseRisk ?? 0) * 100)}%`;
  }
  if (elements.coachHighlightButton) elements.coachHighlightButton.disabled = !recommendation;
  if (elements.coachApplyButton) {
    elements.coachApplyButton.disabled = !recommendation;
    elements.coachApplyButton.textContent =
      recommendation?.type === "flag" ? "Поставить флаг" : recommendation ? "Открыть" : "Применить";
  }
}

function renderLeaderboard() {
  if (!elements.leaderboard) return;
  const rows = buildLeaderboard();
  elements.leaderboard.replaceChildren();
  if (elements.leaderboardDate) elements.leaderboardDate.textContent = formatDate(todayKey());

  let ownRank = null;
  rows.forEach((item, index) => {
    if (item.you) ownRank = index + 1;
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    if (item.you) row.classList.add("is-you");
    const rank = document.createElement("span");
    rank.className = `leader-rank ${index < 3 ? "top" : ""}`;
    rank.textContent = String(index + 1);
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.you ? `${item.name} · вы` : item.name;
    const meta = document.createElement("small");
    meta.textContent = `${item.city} · ${item.accuracy}% · ${item.hints} coach`;
    copy.append(name, meta);
    const score = document.createElement("strong");
    score.textContent = formatTime(item.elapsedMs);
    row.append(rank, copy, score);
    elements.leaderboard.append(row);
  });

  if (elements.leagueRank) elements.leagueRank.textContent = ownRank ? `#${ownRank}` : "#--";
}

function analyzeBoard() {
  const result = {
    text: "",
    baseRisk: 0,
    risks: new Map(),
    recommendation: null,
  };

  if (!game?.minesPlaced) {
    result.text = "Первый ход защищен: поле сгенерируется без мин вокруг стартовой клетки.";
    return result;
  }

  const hidden = game.board.filter((cell) => !cell.revealed && !cell.flagged);
  const remainingMines = Math.max(0, game.mines - game.flags);
  result.baseRisk = hidden.length ? clamp(remainingMines / hidden.length, 0, 1) : 0;
  if (!hidden.length) {
    result.text = "Поле полностью разобрано.";
    return result;
  }

  const safe = new Set();
  const mines = new Set();
  const contributions = new Map();

  game.board.forEach((cell) => {
    if (!cell.revealed || cell.mine || cell.adj === 0) return;
    const around = neighbors(cell.index);
    const flagged = around.filter((index) => game.board[index].flagged).length;
    const closed = around.filter((index) => {
      const next = game.board[index];
      return next && !next.revealed && !next.flagged;
    });
    const need = cell.adj - flagged;
    if (!closed.length || need < 0) return;

    if (need === 0) closed.forEach((index) => safe.add(index));
    if (need === closed.length) closed.forEach((index) => mines.add(index));

    const probability = clamp(need / closed.length, 0, 1);
    closed.forEach((index) => {
      if (!contributions.has(index)) contributions.set(index, []);
      contributions.get(index).push(probability);
    });
  });

  mines.forEach((index) => safe.delete(index));

  hidden.forEach((cell) => {
    const values = contributions.get(cell.index);
    const risk = values?.length ? average(values) : result.baseRisk;
    result.risks.set(cell.index, clamp(risk, 0, 1));
  });

  if (safe.size) {
    const index = [...safe].sort((a, b) => a - b)[0];
    result.recommendation = { type: "open", index, risk: 0 };
    result.text = `${coord(index)} безопасна: все мины вокруг связанного числа уже отмечены.`;
    return result;
  }

  if (mines.size) {
    const index = [...mines].sort((a, b) => a - b)[0];
    result.recommendation = { type: "flag", index, risk: 1 };
    result.text = `${coord(index)} почти точно мина: число требует все закрытые клетки в этом кластере.`;
    return result;
  }

  const [bestIndex, bestRisk] = [...result.risks.entries()].sort((a, b) => a[1] - b[1])[0] || [hidden[0].index, 1];
  result.recommendation = { type: "risk", index: bestIndex, risk: bestRisk };
  result.text = `${coord(bestIndex)} имеет минимальный расчетный риск: ${Math.round(bestRisk * 100)}%.`;
  return result;
}

function applyCoachMove() {
  const recommendation = coachState?.recommendation;
  if (!recommendation) return;

  if (!appData.profile.pro && game.hintsUsed >= 3) {
    openProDialog();
    return;
  }

  game.hintsUsed += 1;
  if (recommendation.type === "flag") {
    toggleFlag(recommendation.index, { fromCoach: true });
  } else {
    revealIndex(recommendation.index, { fromCoach: true });
  }
}

function toggleRiskMap() {
  if (!appData.profile.pro && game.mode !== "trainer") {
    openProDialog();
    return;
  }
  game.riskVisible = !game.riskVisible;
  appData.settings.riskVisible = game.riskVisible;
  saveAppData();
  renderAll();
  persistCurrentGame();
}

function openProfileDialog() {
  if (!elements.profileDialog) return;
  if (elements.nameInput) elements.nameInput.value = appData.profile.name;
  if (elements.cityInput) elements.cityInput.value = appData.profile.city;
  if (elements.skinInput) {
    elements.skinInput.value = appData.profile.pro ? appData.profile.skin : "signal";
    elements.skinInput.disabled = !appData.profile.pro;
  }
  elements.profileDialog.showModal();
}

function openProDialog() {
  if (elements.proDialog) elements.proDialog.showModal();
}

function buildLeaderboard() {
  const city = appData.profile.city;
  const rng = mulberry32(hashString(`${todayKey()}-${city}-${game.difficulty}-${game.mode}`));
  const baseline = {
    easy: [24000, 78000],
    medium: [82000, 240000],
    expert: [260000, 760000],
  }[game.difficulty];

  const rows = Array.from({ length: 9 }, (_, index) => {
    const elapsedMs = Math.round(baseline[0] + rng() * (baseline[1] - baseline[0]));
    const accuracy = Math.round(86 + rng() * 14);
    const hints = Math.floor(rng() * 4);
    return {
      name: RIVAL_NAMES[(index + Math.floor(rng() * RIVAL_NAMES.length)) % RIVAL_NAMES.length],
      city,
      elapsedMs,
      accuracy,
      hints,
      score: calculateScore(elapsedMs, accuracy, hints),
      you: false,
    };
  });

  const ownDaily = appData.games.find(
    (item) =>
      item.mode === "daily" &&
      item.difficulty === game.difficulty &&
      item.outcome === "won" &&
      item.date === todayKey() &&
      item.city === city,
  );

  if (ownDaily) {
    rows.push({
      name: appData.profile.name,
      city,
      elapsedMs: ownDaily.elapsedMs,
      accuracy: ownDaily.accuracy,
      hints: ownDaily.hintsUsed,
      score: ownDaily.score,
      you: true,
    });
  }

  return rows.sort((a, b) => a.score - b.score).slice(0, 10);
}

function calculateAccuracy() {
  if (!game?.board) return 100;
  const flagged = game.board.filter((cell) => cell.flagged);
  const correctFlags = flagged.filter((cell) => cell.mine).length;
  const flagAccuracy = flagged.length ? correctFlags / flagged.length : 1;
  const safeAccuracy = game.safeOpens + game.mistakes ? game.safeOpens / (game.safeOpens + game.mistakes) : 1;
  return Math.round(clamp(safeAccuracy * 0.72 + flagAccuracy * 0.28, 0, 1) * 100);
}

function calculateScore(elapsedMs, accuracy, hints) {
  return elapsedMs / 1000 + (100 - accuracy) * 1.8 + hints * 8;
}

function persistCurrentGame() {
  persistAt = Date.now();
  appData.current = {
    ...game,
    board: game.board.map((cell) => ({ ...cell })),
  };
  saveAppData();
}

function loadAppData() {
  const fallback = {
    version: 1,
    profile: { name: "Игрок", city: "Рим", pro: false, skin: "signal" },
    settings: { theme: "light", mode: "daily", difficulty: "medium", riskVisible: false },
    games: [],
    bests: {},
    current: null,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 1) return fallback;
    return {
      ...fallback,
      ...saved,
      profile: { ...fallback.profile, ...saved.profile },
      settings: { ...fallback.settings, ...saved.settings },
      games: Array.isArray(saved.games) ? saved.games : [],
      bests: saved.bests || {},
    };
  } catch {
    return fallback;
  }
}

function saveAppData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function applyThemeAndSkin() {
  document.body.classList.toggle("theme-dark", appData.settings.theme === "dark");
  document.body.classList.remove("skin-ember", "skin-mint");
  if (appData.profile.pro && appData.profile.skin !== "signal") {
    document.body.classList.add(`skin-${appData.profile.skin}`);
  }
}

function neighbors(index, rows = game.rows, cols = game.cols) {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const list = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
        list.push(nextRow * cols + nextCol);
      }
    }
  }
  return list;
}

function centerIndex(rows, cols) {
  return Math.floor(rows / 2) * cols + Math.floor(cols / 2);
}

function coord(index) {
  const row = Math.floor(index / game.cols) + 1;
  const col = (index % game.cols) + 1;
  return `R${row}C${col}`;
}

function cellAriaLabel(cell) {
  const label = coord(cell.index);
  if (cell.revealed && cell.mine) return `${label}, мина`;
  if (cell.revealed) return `${label}, открыта, ${cell.adj || "пусто"}`;
  if (cell.flagged) return `${label}, флаг`;
  return `${label}, закрыта`;
}

function modeLabel(modeId) {
  return MODES.find((mode) => mode.id === modeId)?.label || modeId;
}

function formatTime(ms) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "MM";
}

function currentStreak(games) {
  let streak = 0;
  for (const item of games) {
    if (item.outcome !== "won") break;
    streak += 1;
  }
  return streak;
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function nextRandom() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
