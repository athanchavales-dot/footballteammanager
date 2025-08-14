document.addEventListener("DOMContentLoaded", () => {
  // --- Robust default players (used if no custom or inline data is available) ---
  const DEFAULT_PLAYERS = [
    {"number":1,"name":"Player One","position":"GK","altPosition":"DEF","photo":"avatars/player1.jpg"},
    {"number":2,"name":"Player Two","position":"DEF","altPosition":"MID","photo":"avatars/player2.jpg"},
    {"number":3,"name":"Player Three","position":"DEF","altPosition":"MID","photo":"avatars/player3.jpg"},
    {"number":4,"name":"Player Four","position":"DEF","altPosition":"FWD","photo":"avatars/player4.jpg"},
    {"number":5,"name":"Player Five","position":"MID","altPosition":"DEF","photo":"avatars/player5.jpg"},
    {"number":6,"name":"Player Six","position":"MID","altPosition":"FWD","photo":"avatars/player6.jpg"},
    {"number":7,"name":"Player Seven","position":"MID","altPosition":"FWD","photo":"avatars/player7.jpg"},
    {"number":8,"name":"Player Eight","position":"FWD","altPosition":"MID","photo":"avatars/player8.jpg"},
    {"number":9,"name":"Player Nine","position":"FWD","altPosition":"MID","photo":"avatars/player9.jpg"},
    {"number":10,"name":"Player Ten","position":"FWD","altPosition":"MID","photo":"avatars/player10.jpg"},
    {"number":11,"name":"Player Eleven","position":"DEF","altPosition":"MID","photo":"avatars/player11.jpg"},
    {"number":12,"name":"Player Twelve","position":"GK","altPosition":"DEF","photo":"avatars/player12.jpg"},
    {"number":13,"name":"Player Thirteen","position":"DEF","altPosition":"MID","photo":"avatars/player13.jpg"},
    {"number":14,"name":"Player Fourteen","position":"MID","altPosition":"FWD","photo":"avatars/player14.jpg"}
  ];

  // DOM
  const starterList = document.getElementById("starterList");
  const benchList = document.getElementById("benchList");
  const teamLineUpList = document.getElementById("teamLineUpList");
  const startersCounter = document.getElementById("startersCounter");
  const field = document.getElementById("formationField");
  const matchSelect = document.getElementById("matchSelect");
  const newMatchBtn = document.getElementById("newMatch");
  const deleteMatchBtn = document.getElementById("deleteMatch");
  const saveFormationToMatchBtn = document.getElementById("saveFormationToMatch");
  const putStartersBtn = document.getElementById("putStartersOnPitch");
  const formationSelect = document.getElementById("autoFormationSelect");

  // (removed runtime layout relocation; handled by HTML/CSS)

  try {
    const fieldPanel = field?.closest('.panel');
    const benchPanel = benchList?.closest('.panel');
    const startersPanel = starterList?.closest('.panel');
    if (fieldPanel && benchPanel && fieldPanel.after) {
      fieldPanel.after(benchPanel);
      benchPanel.classList.add('bench-dock');
    }
    if (fieldPanel?.parentElement) fieldPanel.parentElement.classList.add('center-stack');
    if (startersPanel) startersPanel.style.display = 'none';

    // minimal CSS injection for bench dock if stylesheet not updated
    const css = `.center-stack{display:flex;flex-direction:column;gap:12px}
.bench-dock{position:sticky;bottom:0;z-index:6;background:linear-gradient(180deg,rgba(11,18,32,0),#0b1220 55%);border:1px solid #1f2a44;border-radius:.5rem;padding-top:.5rem}
.bench-dock .panel-title{display:none}
#benchList{display:flex;flex-wrap:nowrap;gap:.5rem;overflow-x:auto;padding:.5rem;scroll-snap-type:x proximity}
#benchList .player-card{scroll-snap-align:start;min-width:110px}`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  } catch {}

  const timerEl = document.getElementById("matchTimer");
  const startBtn = document.getElementById("startTimer");
  const pauseBtn = document.getElementById("pauseTimer");
  const resetBtn = document.getElementById("resetTimer");
  const halfLengthInput = document.getElementById("halfLengthInput");
  const startFirstHalfBtn = document.getElementById("startFirstHalf");
  const startSecondHalfBtn = document.getElementById("startSecondHalf");
  const currentHalfLabel = document.getElementById("currentHalfLabel");
  const remainingTimeEl = document.getElementById("remainingTime");

  const eventForm = document.getElementById("eventForm");
  const eventTypeEl = document.getElementById("eventType");
  const eventPlayerEl = document.getElementById("eventPlayer");
  const assistPlayerEl = document.getElementById("assistPlayer");
  const eventLogEl = document.getElementById("eventLog");
  const exportCSVBtn = document.getElementById("exportCSV");

  const modal = document.getElementById("playerEditorModal");
  const openEditor = document.getElementById("openPlayerEditor");

  // State
  let players = [];
  let placementIndex = 0;
  let lastRemovedPlayer = null;

  // Timer / halves
  let timer = 0;
  let interval = null;
  let currentHalf = 0;
  let halfElapsed = 0;
  const halfLengthSec = () =>
    Math.max(5, Math.min(50, parseInt(halfLengthInput.value) || 35)) * 60;

  // Per-player playtime (seconds while on pitch)
  let playSec = [];

  // Helpers
  const formatTime = (s) => {
    const m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  };
  const renderTimer = () => { timerEl.textContent = formatTime(timer); };
  const renderRemaining = () => {
    if (!currentHalf) {
      currentHalfLabel.textContent = "—";
      remainingTimeEl.textContent = "00:00";
      return;
    }
    const rem = Math.max(0, halfLengthSec() - halfElapsed);
    currentHalfLabel.textContent = currentHalf === 1 ? "1st" : "2nd";
    remainingTimeEl.textContent = formatTime(rem);
  };

  function tick() {
    timer++;
    renderTimer();

    if (currentHalf) {
      halfElapsed = Math.min(halfLengthSec(), halfElapsed + 1);
      renderRemaining();
      if (halfElapsed >= halfLengthSec()) {
        clearInterval(interval);
        interval = null;
        try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch { }
        try {
          new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAACAgICAgICAg').play().catch(() => { });
        } catch { }
      }
    }

    getActivePlayerIds().forEach((id) => {
      playSec[id] = (playSec[id] || 0) + 1;
    });
    updatePlaytimeWidgets();
  }

  // Timer controls
  startBtn.addEventListener("click", () => { if (!interval) interval = setInterval(tick, 1000); });
  pauseBtn.addEventListener("click", () => { clearInterval(interval); interval = null; });
  resetBtn.addEventListener("click", () => {
    clearInterval(interval); interval = null;
    timer = 0; halfElapsed = 0; currentHalf = 0;
    renderTimer(); renderRemaining();
  });
  startFirstHalfBtn.addEventListener("click", () => { currentHalf = 1; halfElapsed = 0; renderRemaining(); });
  startSecondHalfBtn.addEventListener("click", () => { currentHalf = 2; halfElapsed = 0; renderRemaining(); });

  // Matches
  const loadMatches = () => JSON.parse(localStorage.getItem("matches") || "[]");
  const saveMatches = (m) => localStorage.setItem("matches", JSON.stringify(m));
  const uid = () => {
    const d = new Date();
    return `${d.toISOString().slice(0, 10)}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  };
  let matches = loadMatches();
  let currentMatchId = null;
  const matchById = (id) => matches.find((m) => m.id === id) || null;
  const isMatchActive = () => !!currentMatchId;

  
function setEventsEnabled(enabled) {
  if (typeof eventForm !== 'undefined' && eventForm) {
    eventForm.querySelectorAll("select, button").forEach(el => { el.disabled = !enabled; });
  }
  if (typeof exportCSVBtn !== 'undefined' && exportCSVBtn) exportCSVBtn.disabled = !enabled;
}
);
    eventForm.querySelectorAll("select, button").forEach(el => { el.disabled = !enabled; });
  }
  setEventsEnabled(false);

  function updateAvailabilityUI() {
    if (!teamLineUpList) return;
    teamLineUpList.classList.toggle("locked", isMatchActive());
  }
  function renderMatchOptions() {
    matchSelect.innerHTML = `<option value="" disabled ${currentMatchId ? "" : "selected"}>— Select a match —</option>`;
    matches.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.date} • ${m.title || m.id}`;
      matchSelect.appendChild(opt);
    });
    if (currentMatchId && matchById(currentMatchId)) matchSelect.value = currentMatchId;
    updateAvailabilityUI();
  }

  function createNewMatch() {
    const id = uid();
    const date = new Date().toISOString().slice(0, 10);
    const title = prompt("Optional match title") || "";
    const formation = takeFormationSnapshot();
    matches.push({ id, date, title, events: [], formation });
    saveMatches(matches);
    currentMatchId = id;

    // reset timers & playtime
    timer = 0; halfElapsed = 0; currentHalf = 0;
    renderTimer(); renderRemaining();
    playSec = new Array(players.length).fill(0);

    // kickoff: center ball
    placeFootballAtCenter();

    renderMatchOptions();
    renderEventLog();
    setEventsEnabled(true);
    alert("✅ New match started.");
  }

  function deleteCurrentMatch() {
    if (!currentMatchId) return alert("No match selected.");
    const m = matchById(currentMatchId);
    if (!m) return alert("Match not found.");
    if (!confirm(`Delete match "${m.title || m.id}"?`)) return;
    matches = matches.filter((mm) => mm.id !== currentMatchId);
    saveMatches(matches);
    currentMatchId = null;
    eventLogEl.innerHTML = "";
    updateAvailabilityUI();
    setEventsEnabled(false);
    alert("🗑️ Match deleted.");
  }

  function setActiveMatch(id, { loadFormation: lf = true } = {}) {
    currentMatchId = id;
    renderEventLog();
    if (lf) {
      const m = matchById(id);
      if (m?.formation) loadFormationSnapshot(m.formation);
    }
    playSec = new Array(players.length).fill(0);
    timer = 0; halfElapsed = 0; currentHalf = 0;
    renderTimer(); renderRemaining();
    setEventsEnabled(true);
  }

  // ---- FOOTBALL: manual drag + snap + stick ----
  const football = document.createElement("img");
  football.src = "football-png-32.png";
  football.alt = "Football";
  football.className = "football-icon";
  field.appendChild(football);

  function placeFootballAtCenter() {
    football.style.left = `${(field.clientWidth / 2) - 16}px`;
    football.style.top = `${(field.clientHeight / 2) - 16}px`;
  }
  placeFootballAtCenter();

  let ballHolder = null; // element with possession

  function positionBallOnPlayer(playerEl) {
    if (!playerEl) return;
    const pr = playerEl.getBoundingClientRect();
    const fr = field.getBoundingClientRect();
    const left = pr.left - fr.left + pr.width / 2 - football.offsetWidth / 2;
    const top = pr.top - fr.top + pr.height - 4;
    football.style.left = `${left}px`;
    football.style.top = `${top}px`;
  }

  function centerDistance(elA, elB) {
    const a = elA.getBoundingClientRect();
    const b = elB.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  function snapToNearestPlayer() {
    const playersOnPitch = [...field.querySelectorAll(".draggable-player")];
    if (!playersOnPitch.length) { ballHolder = null; return; }
    const SNAP_RADIUS = 50;
    let nearest = null, best = Infinity;
    for (const p of playersOnPitch) {
      const d = centerDistance(football, p);
      if (d < best) { best = d; nearest = p; }
    }
    if (nearest && best <= SNAP_RADIUS) {
      ballHolder = nearest;
      positionBallOnPlayer(nearest);
    } else {
      ballHolder = null;
    }
  }

  // follow holder while they move
  const mo = new MutationObserver(() => {
    if (ballHolder && field.contains(ballHolder)) positionBallOnPlayer(ballHolder);
  });
  mo.observe(field, { attributes: true, childList: true, subtree: true });

  // make the ball draggable
  (function makeFootballDraggable() {
    let offsetX = 0, offsetY = 0;

    function moveTo(clientX, clientY) {
      const rect = field.getBoundingClientRect();
      let x = clientX - rect.left - offsetX;
      let y = clientY - rect.top - offsetY;
      x = Math.max(0, Math.min(x, field.clientWidth - football.offsetWidth));
      y = Math.max(0, Math.min(y, field.clientHeight - football.offsetHeight));
      football.style.left = `${x}px`;
      football.style.top = `${y}px`;
    }

    // mouse
    football.addEventListener("mousedown", (e) => {
      e.preventDefault();
      ballHolder = null; // release from player
      const r = football.getBoundingClientRect();
      offsetX = e.clientX - r.left; offsetY = e.clientY - r.top;
      football.style.cursor = "grabbing";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
    function onMove(e) { moveTo(e.clientX, e.clientY); }
    function onUp() {
      football.style.cursor = "grab";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      snapToNearestPlayer();
    }

    // touch
    football.addEventListener("touchstart", (e) => {
      ballHolder = null;
      const t = e.touches[0];
      const r = football.getBoundingClientRect();
      offsetX = t.clientX - r.left; offsetY = t.clientY - r.top;
    }, { passive: true });
    football.addEventListener("touchmove", (e) => {
      const t = e.touches[0]; if (t) moveTo(t.clientX, t.clientY);
    }, { passive: true });
    football.addEventListener("touchend", () => snapToNearestPlayer());
  })();

  // ----- Lineup UI -----
  function updatePutButton() {
    const starters = starterList?.querySelectorAll(".player-card").length || 0;
    putStartersBtn.classList.toggle("hidden", starters !== 9);
  }
  function getStartersCount() {
    const count = starterList?.querySelectorAll(".player-card").length || 0;
    startersCounter.textContent = `Starters (${count}/9)`;
    updatePutButton();
    return count;
  }

  function setLineupUsed(playerId, used) {
    const card = teamLineUpList.querySelector(`.player-card[data-player-id="${playerId}"]`);
    if (card) {
      card.classList.toggle("used", used);
      card.classList.toggle("disabled", used);
    }
  }

  function playtimeWidgetHTML(pid) {
    return `<div class="pt-wrap" data-pt-id="${pid}">
      <div class="pt-time">⏱ <span class="pt-text" data-pt-text="${pid}">00:00</span></div>
      <div class="pt-bg"><div class="pt-bar pt-low" data-pt-bar="${pid}" style="width:0%"></div></div>
    </div>`;
  }

  function createLineupCard(player, index) {
    const card = document.createElement("div");
    card.className = "player-card text-center";
    card.dataset.playerId = index;
    card.dataset.listType = "lineup";
    card.innerHTML = `
      <img src="${player.photo}" onerror="this.src='avatars/placeholder.jpg'" class="mx-auto rounded-full object-cover"/>
      <div class="text-xs font-bold mt-1">#${player.number} ${player.name}</div>
      <div class="text-[10px] text-slate-300">${player.position} / ${player.altPosition}</div>
      ${playtimeWidgetHTML(index)}
    `;
    card.addEventListener("click", () => {
      if (isMatchActive()) {
        alert("This player is not available today. Use Starters or Game Changers for subs.");
        return;
      }
      if (card.classList.contains("disabled")) return;
      if (getStartersCount() < 9) {
        starterList.appendChild(createPlayerCard(player, index, "starter"));
      } else {
        benchList.appendChild(createPlayerCard(player, index, "bench"));
      }
      setLineupUsed(index, true);
      getStartersCount();
    });
    return card;
  }

  
function createPlayerCard(player, index, listType) {
  const card = document.createElement("div");
  card.className = "player-card text-center";
  card.dataset.playerId = index;
  card.dataset.listType = listType;
  card.innerHTML = `
    <img src="${player.photo}" onerror="this.src='avatars/placeholder.jpg'" class="mx-auto rounded-full object-cover" style="width:42px;height:42px"/>
    <div class="text-xs font-bold mt-1">#${player.number} ${player.name}</div>
    <div class="text-[10px] text-slate-300">${player.position} / ${player.altPosition}</div>
    ${playtimeWidgetHTML(index)}
  `;
  if (listType === "bench") {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    });
  }
  card.addEventListener("click", () => {
    if (!field.querySelector(`.draggable-player[data-player-id="${index}"]`)) {
      addPlayerToField(index, player);
    }
  });
  card.addEventListener("dblclick", () => {
    const pid = parseInt(card.dataset.playerId);
    card.remove();
    setLineupUsed(pid, false);
    getStartersCount();
  });
  return card;
}



  // Players loader (robust: only trusts non-empty custom list)
  async function loadPlayersData() {
    try {
      const customRaw = localStorage.getItem("customPlayers");
      if (customRaw) {
        const custom = JSON.parse(customRaw);
        if (Array.isArray(custom) && custom.length > 0) return custom;
      }
    } catch { /* ignore */ }
    try {
      const inline = document.getElementById("playersData");
      if (inline && inline.textContent.trim()) {
        const arr = JSON.parse(inline.textContent.trim());
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch { /* ignore */ }
    try {
      // try both with and without cache-busting param
      for (const url of ["players.json?v=5", "players.json"]) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (res.ok) {
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length > 0) return arr;
          }
        } catch {}
      }
    } catch {}
    // final guaranteed fallback
    return DEFAULT_PLAYERS;
  }

  loadPlayersData().then((data) => {
    players = data;
    playSec = new Array(players.length).fill(0);
    teamLineUpList.innerHTML = "";
    if (!Array.isArray(players) || players.length === 0) {
      teamLineUpList.innerHTML = "<div class='col-span-full text-rose-400 font-semibold'>No players available.</div>";
      return;
    }
    players.forEach((p, i) => teamLineUpList.appendChild(createLineupCard(p, i)));
    refreshEventPlayerDropdown();
    renderMatchOptions();
    getStartersCount();
    updatePlaytimeWidgets();
  });

  const getActivePlayerIds = () =>
    [...field.querySelectorAll(".draggable-player")]
      .map((div) => parseInt(div.dataset.playerId))
      .filter((id) => !Number.isNaN(id));

  function fillPlayerSelect(selectEl, excludeId = null) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="" ${selectEl === assistPlayerEl ? "" : "disabled"} selected>${selectEl === assistPlayerEl ? "— Select Assist Player (optional) —" : "— Select Player —"}</option>`;
    const activeIds = getActivePlayerIds();
    activeIds.forEach((id) => {
      if (excludeId !== null && String(id) === String(excludeId)) return;
      const p = players[id]; if (!p) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `#${p.number} ${p.name}`;
      selectEl.appendChild(opt);
    });
  }
  function refreshEventPlayerDropdown() {
    fillPlayerSelect(eventPlayerEl);
    if (eventTypeEl.value === "Goal") {
      assistPlayerEl.classList.remove("hidden");
      fillPlayerSelect(assistPlayerEl, eventPlayerEl.value || null);
    } else {
      assistPlayerEl.classList.add("hidden");
      assistPlayerEl.value = "";
    }
  }
  eventTypeEl.addEventListener("change", refreshEventPlayerDropdown);
  eventPlayerEl.addEventListener("change", () => {
    if (eventTypeEl.value === "Goal")
      fillPlayerSelect(assistPlayerEl, eventPlayerEl.value || null);
  });

  // Formations
  function getTemplatePercents(name = "3-3-2") {
    const lanesY = (n) => n === 1 ? [50] : n === 2 ? [35, 65] : n === 3 ? [25, 50, 75] : [18, 41, 59, 82];
    switch (name) {
      case "3-2-3": return [{ x: 6, y: 50 }, ...lanesY(3).map((y) => ({ x: 22, y })), ...lanesY(2).map((y) => ({ x: 45, y })), ...lanesY(3).map((y) => ({ x: 70, y }))];
      case "2-3-3": return [{ x: 6, y: 50 }, ...lanesY(2).map((y) => ({ x: 22, y })), ...lanesY(3).map((y) => ({ x: 45, y })), ...lanesY(3).map((y) => ({ x: 70, y }))];
      case "4-3-1": return [{ x: 6, y: 50 }, ...lanesY(4).map((y) => ({ x: 22, y })), ...lanesY(3).map((y) => ({ x: 47, y })), { x: 72, y: 50 }];
      default: return [{ x: 6, y: 50 }, ...lanesY(3).map((y) => ({ x: 22, y })), ...lanesY(3).map((y) => ({ x: 47, y })), ...lanesY(2).map((y) => ({ x: 72, y }))];
    }
  }

  function clearField() {
    field.querySelectorAll(".draggable-player").forEach((el) => {
      updatePlayerCardState(el.dataset.playerId, false);
      el.remove();
    });
    placementIndex = 0;
    lastRemovedPlayer = null;
    if (ballHolder && !field.contains(ballHolder)) ballHolder = null;
    refreshEventPlayerDropdown();
  }

  function autoPlaceStarters() {
    const starterCards = [...starterList.querySelectorAll(".player-card")];
    if (starterCards.length !== 9) return alert("You need exactly 9 starters.");
    const chosen = formationSelect?.value || "3-3-2";
    const template = getTemplatePercents(chosen);
    clearField();
    const W = field.clientWidth, H = field.clientHeight;

    const ids = starterCards.map((c) => parseInt(c.dataset.playerId));
    const gkIndex = ids.findIndex((id) => players[id]?.position === "GK");
    if (gkIndex > 0) { const [gk] = ids.splice(gkIndex, 1); ids.unshift(gk); }
    ids.slice(0, template.length).forEach((id, i) => {
      const p = players[id];
      const { x, y } = template[i];
      addPlayerToField(id, p, `${(x / 100) * W}px`, `${(y / 100) * H}px`);
    });
    refreshEventPlayerDropdown();
  }
  putStartersBtn?.addEventListener("click", autoPlaceStarters);

  function getAutoPosition() {
    const spacingX = 96, spacingY = 96, cols = 6;
    const x = 36 + (placementIndex % cols) * spacingX;
    const y = 36 + Math.floor(placementIndex / cols) * spacingY;
    placementIndex++;
    return { x, y };
  }

  function attachDropHandlers(div) {
    div.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      if (e.dataTransfer.types.includes("text/plain")) {
        e.preventDefault();
        div.classList.add("drop-target");
      }
    });
    div.addEventListener("dragleave", () => div.classList.remove("drop-target"));
    div.addEventListener("drop", (e) => {
      e.preventDefault();
      div.classList.remove("drop-target");
      const incomingId = parseInt(e.dataTransfer.getData("text/plain"));
      if (Number.isNaN(incomingId)) return;
      const benchCard = benchList.querySelector(`.player-card[data-player-id="${incomingId}"]`);
      if (!benchCard) return alert("Only Game Changers can come on. All Players are not available today.");
      if (field.querySelector(`.draggable-player[data-player-id="${incomingId}"]`)) return alert("That player is already on the pitch.");

      const targetId = parseInt(div.dataset.playerId);
      const incoming = players[incomingId], outgoing = players[targetId];
      if (!incoming || !outgoing) return;

      div.dataset.playerId = String(incomingId);
      div.innerHTML = playerOnPitchHTML(incoming);

      benchCard.remove();
      benchList.appendChild(createPlayerCard(outgoing, targetId, "bench"));
      setLineupUsed(incomingId, true);
      setLineupUsed(targetId, false);

      if (currentMatchId) {
        const m = matchById(currentMatchId);
        if (m) {
          m.events.push({
            time: timerEl.textContent,
            type: "Substitution",
            playerId: incomingId,
            playerName: `#${incoming.number} ${incoming.name} ⇆ #${outgoing.number} ${outgoing.name}`,
          });
          saveMatches(matches);
          renderEventLog();
        }
      }
      refreshEventPlayerDropdown();
    });
  }

  function playerOnPitchHTML(p) {
    return `
      <div class="flex flex-col items-center text-center">
        <img src="${p.photo}" onerror="this.src='avatars/placeholder.jpg'" class="w-12 h-12 rounded-full mx-auto object-cover"/>
        <div class="text-[10px] font-medium leading-tight text-center">${p.name}</div>
      </div>
    `;
  }

  function addPlayerToField(index, player, left = null, top = null) {
    if (field.querySelectorAll(".draggable-player").length >= 9 &&
      !field.querySelector(`.draggable-player[data-player-id="${index}"]`)) {
      return alert("⚠️ Only 9 players allowed.");
    }
    const div = document.createElement("div");
    div.className = "draggable-player";
    div.dataset.playerId = index;
    div.style.left = left || `${getAutoPosition().x}px`;
    div.style.top = top || `${getAutoPosition().y}px`;
    div.style.position = "absolute";
    div.innerHTML = playerOnPitchHTML(player);

    // remove from pitch (double click / double tap)
    let tapTs = 0;
    div.addEventListener("dblclick", () => removeFromPitch(div));
    div.addEventListener("touchend", () => {
      const now = Date.now(); if (now - tapTs < 250) removeFromPitch(div); tapTs = now;
    });

    makeDraggable(div);
    attachDropHandlers(div);
    field.appendChild(div);
    updatePlayerCardState(index, true);
    refreshEventPlayerDropdown();
  }

  function removeFromPitch(div) {
    const removedId = parseInt(div.dataset.playerId);
    const removedPlayer = players[removedId];
    if (ballHolder === div) ballHolder = null; // drop ball
    div.remove();
    updatePlayerCardState(removedId, false);
    if (currentMatchId && removedPlayer) {
      lastRemovedPlayer = {
        id: removedId,
        name: `#${removedPlayer.number} ${removedPlayer.name}`,
        time: timerEl.textContent,
      };
    }
    refreshEventPlayerDropdown();
  }

  
function updatePlayerCardState(playerId, active) {
  [starterList, benchList, teamLineUpList].forEach((list) => {
    if (!list) return;
    const card = list.querySelector(`.player-card[data-player-id="${playerId}"]`);
    if (card) {
      card.classList.toggle("used", active);
      card.classList.toggle("disabled", active);
      // restore drag for bench cards when they become available
      if (!active && card.dataset.listType === "bench") {
        card.setAttribute("draggable", "true");
        card.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", String(playerId));
          e.dataTransfer.effectAllowed = "move";
        }, { once: true });
      }
    }
  });
}
});
  }
  // Drag helpers for players
  // ===== Bench -> Field pointer drag (mobile friendly) =====
  (function enableBenchPointerDrag(){
    if (!benchList || !field) return;

    // apply touch-action/overscroll safeguards
    try {
      document.documentElement.style.overscrollBehavior = 'contain';
      field.style.touchAction = 'none';
      benchList.style.touchAction = 'none';
    } catch {}

    let drag = null; // {id, ghost}

    function makeGhost(fromEl){
      const g = document.createElement('div');
      g.className = 'drag-ghost';
      g.style.position = 'fixed';
      g.style.zIndex = '9999';
      g.style.pointerEvents = 'none';
      g.style.transform = 'translate(-50%,-50%)';
      g.style.width = '44px';
      g.style.height = '44px';
      g.style.borderRadius = '9999px';
      g.style.boxShadow = '0 8px 24px rgba(0,0,0,.45)';
      const img = fromEl.querySelector('img')?.cloneNode();
      if (img) { img.style.width='44px'; img.style.height='44px'; img.style.borderRadius='9999px'; g.appendChild(img); }
      else { g.style.background = '#f59e0b'; }
      document.body.appendChild(g);
      return g;
    }
    function moveGhost(e){
      if (!drag) return;
      drag.ghost.style.left = e.clientX + 'px';
      drag.ghost.style.top  = e.clientY + 'px';
    }
    benchList.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.player-card');
      if (!card) return;
      const pid = parseInt(card.dataset.playerId, 10);
      if (Number.isNaN(pid)) return;
      e.preventDefault();
      drag = { id: pid, fromEl: card, ghost: makeGhost(card) };
    }, { passive:false });

    window.addEventListener('pointermove', (e)=>{ if (drag){ e.preventDefault(); moveGhost(e); } }, { passive:false });
    window.addEventListener('pointerup', (e)=>{
      if (!drag) return;
      e.preventDefault();
      const incomingId = drag.id;
      const drop = document.elementFromPoint(e.clientX, e.clientY);
      const targetChip = drop?.closest?.('.draggable-player');
      if (targetChip){
        const targetId = parseInt(targetChip.dataset.playerId, 10);
        if (!Number.isNaN(targetId) && incomingId !== targetId) {
          const benchCard = benchList.querySelector(`.player-card[data-player-id="${incomingId}"]`);
          if (benchCard && !field.querySelector(`.draggable-player[data-player-id="${incomingId}"]`)) {
            const incoming = players[incomingId], outgoing = players[targetId];
            if (incoming && outgoing){
              targetChip.dataset.playerId = String(incomingId);
              targetChip.innerHTML = playerOnPitchHTML(incoming);

              benchCard.remove();
              benchList.appendChild(createPlayerCard(outgoing, targetId, "bench"));
              setLineupUsed(incomingId, true);
              setLineupUsed(targetId, false);

              if (currentMatchId) {
                const m = matchById(currentMatchId);
                if (m) {
                  m.events.push({
                    time: timerEl.textContent,
                    type: "Substitution",
                    playerId: incomingId,
                    playerName: `#${incoming.number} ${incoming.name} ⇆ #${outgoing.number} ${outgoing.name}`,
                  });
                  saveMatches(matches);
                  renderEventLog();
                }
              }
              refreshEventPlayerDropdown();
            }
          }
        }
      } else if (drop?.closest?.('#formationField')) {
        if (!field.querySelector(`.draggable-player[data-player-id="${incomingId}"]`)) {
          if (field.querySelectorAll('.draggable-player').length < 9) {
            const r = field.getBoundingClientRect();
            const left = Math.max(0, Math.min(e.clientX - r.left - 36, field.clientWidth - 72)) + 'px';
            const top  = Math.max(0, Math.min(e.clientY - r.top  - 36, field.clientHeight - 72)) + 'px';
            addPlayerToField(incomingId, players[incomingId], left, top);
            const benchCard = benchList.querySelector(`.player-card[data-player-id="${incomingId}"]`);
            benchCard?.remove();
            setLineupUsed(incomingId, true);
          }
        }
      }
      drag.ghost?.remove();
      drag = null;
    }, { passive:false });
  })();

  function makeDraggable(el) {
    let offsetX, offsetY;

    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
    function onMouseMove(e) { moveTo(e.clientX, e.clientY); }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    el.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      offsetX = t.clientX - rect.left;
      offsetY = t.clientY - rect.top;
    }, { passive: true });

    el.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      moveTo(t.clientX, t.clientY);
    }, { passive: true });

    function moveTo(clientX, clientY) {
      const rect = field.getBoundingClientRect();
      let x = clientX - rect.left - offsetX;
      let y = clientY - rect.top - offsetY;
      x = Math.max(0, Math.min(x, field.clientWidth - el.offsetWidth));
      y = Math.max(0, Math.min(y, field.clientHeight - el.offsetHeight));
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      if (ballHolder === el) positionBallOnPlayer(el); // keep ball at feet
    }

    el.style.cursor = "move";
  }

  // Save / Load formation
  document.getElementById("saveFormation").addEventListener("click", () => {
    localStorage.setItem("savedFormation", JSON.stringify(takeFormationSnapshot()));
    alert("✅ Formation saved!");
  });
  document.getElementById("loadFormation").addEventListener("click", () => {
    const data = localStorage.getItem("savedFormation");
    if (!data) return alert("⚠️ No saved formation.");
    loadFormationSnapshot(JSON.parse(data));
  });
  saveFormationToMatchBtn.addEventListener("click", () => {
    if (!currentMatchId) return alert("Select or create a match first.");
    const m = matchById(currentMatchId);
    if (m) {
      m.formation = takeFormationSnapshot();
      saveMatches(matches);
      alert("📌 Attached.");
    }
  });

  const takeFormationSnapshot = () =>
    [...field.querySelectorAll(".draggable-player")].map((div) => ({
      id: div.dataset.playerId,
      left: div.style.left,
      top: div.style.top,
    }));

  function loadFormationSnapshot(formation) {
    field.querySelectorAll(".draggable-player").forEach((el) => {
      updatePlayerCardState(el.dataset.playerId, false);
      el.remove();
    });
    placementIndex = 0;
    formation.forEach((pos) => {
      const player = players[pos.id];
      if (player) addPlayerToField(pos.id, player, pos.left, pos.top);
    });
    refreshEventPlayerDropdown();
  }

  // Events
  function renderEventLog() {
    eventLogEl.innerHTML = "";
    if (!currentMatchId) return;
    const match = matchById(currentMatchId);
    if (!match) return;
    match.events.forEach((ev, i) => {
      const li = document.createElement("li");
      const assistText = ev.assistName ? ` (assist: ${ev.assistName})` : "";
      li.textContent = `[${ev.time}] ${ev.type} — ${ev.playerName}${ev.type === "Goal" ? assistText : ""}`;
      const del = document.createElement("button");
      del.textContent = "✕";
      del.className = "text-xs bg-rose-600 text-white px-1 rounded ml-2";
      del.addEventListener("click", () => {
        match.events.splice(i, 1);
        saveMatches(matches);
        renderEventLog();
      });
      li.appendChild(del);
      eventLogEl.appendChild(li);
    });
  }

  eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentMatchId) return alert("Please select a match first.");
    const match = matchById(currentMatchId);

    const pid = parseInt(eventPlayerEl.value);
    const player = players[pid];
    if (!player) return;

    const ev = {
      time: timerEl.textContent,
      type: eventTypeEl.value,
      playerId: pid,
      playerName: `#${player.number} ${player.name}`,
    };

    if (eventTypeEl.value === "Goal") {
      const aid = assistPlayerEl.value ? parseInt(assistPlayerEl.value) : null;
      if (aid !== null && !Number.isNaN(aid)) {
        if (aid === pid) return alert("Scorer and assist cannot be the same player.");
        const a = players[aid];
        if (a) { ev.assistId = aid; ev.assistName = `#${a.number} ${a.name}`; }
      }
    }
    match.events.push(ev);
    saveMatches(matches);
    renderEventLog();
    eventForm.reset();
    refreshEventPlayerDropdown();
  });

  // CSV Export
  exportCSVBtn.addEventListener("click", () => {
    if (!currentMatchId) return alert("Please select a match first.");
    const m = matchById(currentMatchId);
    if (!m) return;

    const rows = [
      ["Match ID", "Date", "Title", "Clock", "Type", "Player", "Assist"],
      ...m.events.map((ev) => [
        m.id, m.date, m.title || "", ev.time, ev.type, ev.playerName || "", ev.assistName || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.date}_${(m.title || "match").replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Match bindings
  matchSelect.addEventListener("change", () => setActiveMatch(matchSelect.value));
  newMatchBtn.addEventListener("click", createNewMatch);
  deleteMatchBtn.addEventListener("click", deleteCurrentMatch);

  // Playtime helpers
  function getSelectedTodayIds() {
    const ids = new Set();
    [...starterList.querySelectorAll(".player-card"), ...benchList.querySelectorAll(".player-card")].forEach((c) => {
      ids.add(parseInt(c.dataset.playerId));
    });
    return [...ids];
  }
  function fairTargetSec() {
    const totalMatch = 2 * halfLengthSec();
    const selectedCount = Math.max(1, getSelectedTodayIds().length || 9);
    return (9 * totalMatch) / selectedCount;
  }
  function updatePlaytimeWidgets() {
    const target = Math.max(1, fairTargetSec());
    players.forEach((p, i) => {
      const sec = playSec[i] || 0;
      document.querySelectorAll(`[data-pt-text="${i}"]`).forEach((el) => (el.textContent = formatTime(sec)));
      const ratio = Math.min(1, sec / target);
      document.querySelectorAll(`[data-pt-bar="${i}"]`).forEach((el) => {
        el.style.width = `${Math.round(ratio * 100)}%`;
        el.classList.remove("pt-low", "pt-mid", "pt-high");
        if (ratio < 0.5) el.classList.add("pt-low");
        else if (ratio < 0.9) el.classList.add("pt-mid");
        else el.classList.add("pt-high");
      });
    });
  }

  // Player editor modal
  openEditor.addEventListener("click", () => modal.classList.remove("hidden"));
  modal.addEventListener("click", (e) => { if (e.target.classList.contains("pe-backdrop")) modal.classList.add("hidden"); });
  window.__closePlayerEditor = () => modal.classList.add("hidden");

  // Hooks for the player editor
  window.loadPlayersData = loadPlayersData;
  window.refreshPlayersUI = function (newPlayers) {
    players = newPlayers || players;
    teamLineUpList.innerHTML = "";
    players.forEach((p, i) => teamLineUpList.appendChild(createLineupCard(p, i)));
    playSec = new Array(players.length).fill(0);
    updatePlaytimeWidgets();
    refreshEventPlayerDropdown();
  };

  // Initial draw
  renderTimer();
  renderRemaining();
});

// ---- Backup helpers ----
function loadLS(key, fallback = null) { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; } }
function saveLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function exportAll() {
  const payload = {
    matches: loadLS('matches', []),
    players: loadLS('customPlayers', null),
    formation: loadLS('savedFormation', null),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'team-manager-backup.json';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

async function importAll(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Invalid backup');
  if ('matches' in data) saveLS('matches', data.matches ?? []);
  if ('players' in data) saveLS('customPlayers', data.players ?? null);
  if ('formation' in data) saveLS('savedFormation', data.formation ?? null);
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportBtn')?.addEventListener('click', exportAll);
  document.getElementById('importInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    try { await importAll(file); alert('Import complete.'); }
    catch (err) { console.error(err); alert('Import failed: ' + err.message); }
    finally { e.target.value = ''; }
  });
});