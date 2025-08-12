document.addEventListener("DOMContentLoaded", () => {
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

  // Per-player playtime (in seconds) while on the pitch
  let playSec = [];

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
      // Auto stop at end of half
      if (halfElapsed >= halfLengthSec()) { clearInterval(interval); interval = null;
  try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch {}
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAACAgICAgICAg');
    audio.play().catch(()=>{});
  } catch {}
 }
    }
    // credit seconds to active players
    getActivePlayerIds().forEach((id) => {
      playSec[id] = (playSec[id] || 0) + 1;
    });
    updatePlaytimeWidgets();
  }

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
    return `${d.toISOString().slice(0, 10)}_${String(d.getHours()).padStart(2, "0")}${String(
      d.getMinutes()
    ).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  };
  let matches = loadMatches();
  let currentMatchId = null;
  const matchById = (id) => matches.find((m) => m.id === id) || null;
  const isMatchActive = () => !!currentMatchId;
  function setUIEnabled(enabled) {
    const disableClass = "disabled-ui";

    // Pitch & Formation
    field.classList.toggle(disableClass, !enabled);

    // Player Manager buttons and cards
    document.querySelectorAll("#teamLineUpList .player-card, #saveFormation, #loadFormation, #saveFormationToMatch, #putStartersOnPitch").forEach(el => {
      el.classList.toggle(disableClass, !enabled);
    });

    // Timer controls
    [startBtn, pauseBtn, resetBtn, startFirstHalfBtn, startSecondHalfBtn, halfLengthInput].forEach(el => {
      el.disabled = !enabled;
    });

    // Match Events form
    eventForm.querySelectorAll("select, button").forEach(el => {
      el.disabled = !enabled;
    });
  }

  // CSS to make disabled look obvious & block clicks
  const style = document.createElement("style");
  style.textContent = `
  .disabled-ui {
    pointer-events: none !important;
    opacity: 0.4;
  }
`;
  document.head.appendChild(style);

  // Initially lock everything until match is active
  setUIEnabled(false);

  // Then update it whenever match changes
  const originalSetActiveMatch = setActiveMatch;
  setActiveMatch = function (id, opts) {
    originalSetActiveMatch.call(this, id, opts);
    setUIEnabled(!!currentMatchId);
  };

  const originalCreateNewMatch = createNewMatch;
  createNewMatch = function () {
    originalCreateNewMatch.call(this);
    setUIEnabled(true);
  };

  function updateAvailabilityUI() {
    if (!teamLineUpList) return;
    teamLineUpList.classList.toggle("locked", isMatchActive());
  }

  function renderMatchOptions() {
    matchSelect.innerHTML = `<option value="" disabled ${currentMatchId ? "" : "selected"}>— Select a match —</option>`;
    matches
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .forEach((m) => {
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

    lastRemovedPlayer = null;
    timer = 0; halfElapsed = 0; currentHalf = 0;
    renderTimer(); renderRemaining();

    playSec = new Array(players.length).fill(0);

    renderMatchOptions();
    renderEventLog();
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
    lastRemovedPlayer = null;
    renderMatchOptions();
    eventLogEl.innerHTML = "";
    alert("🗑️ Match deleted.");
  }

  function setActiveMatch(id, { loadFormation: lf = true } = {}) {
    currentMatchId = id;
    lastRemovedPlayer = null;
    renderEventLog();
    if (lf) {
      const m = matchById(id);
      if (m?.formation) loadFormationSnapshot(m.formation);
    }
    playSec = new Array(players.length).fill(0);
    timer = 0; halfElapsed = 0; currentHalf = 0;
    renderTimer(); renderRemaining();
    updateAvailabilityUI();
  }

  function updatePutButton() {
    if (!putStartersBtn) return;
    const starters = starterList?.querySelectorAll(".player-card").length || 0;
    putStartersBtn.classList.toggle("hidden", starters !== 9);
  }
  function getStartersCount() {
    const count = starterList?.querySelectorAll(".player-card").length || 0;
    if (startersCounter) startersCounter.textContent = `Starters (${count}/9)`;
    updatePutButton();
    return count;
  }

  function setLineupUsed(playerId, used) {
    const card = teamLineUpList?.querySelector(`.player-card[data-player-id="${playerId}"]`);
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

  // LOAD PLAYERS: prefer customPlayers in localStorage (from editor), then inline, then JSON
  async function loadPlayersData() {
    try {
      const custom = localStorage.getItem("customPlayers");
      if (custom) return JSON.parse(custom);
    } catch { }
    const inline = document.getElementById("playersData");
    if (inline) {
      try { return JSON.parse(inline.textContent.trim()); } catch { }
    }
    try {
      const res = await fetch("players.json?v=3");
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return [];
    }
  }

  loadPlayersData().then((data) => {
    players = data;
    playSec = new Array(players.length).fill(0);
    teamLineUpList.innerHTML = "";
    if (!Array.isArray(players) || players.length === 0) {
      teamLineUpList.innerHTML =
        "<div class='col-span-full text-rose-400 font-semibold'>No players available.</div>";
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
    selectEl.innerHTML = `<option value="" ${selectEl === assistPlayerEl ? "" : "disabled"
      } selected>${selectEl === assistPlayerEl ? "— Select Assist Player (optional) —" : "— Select Player —"}</option>`;
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

  function getTemplatePercents(name = "3-3-2") {
    const lanesY = (n) =>
      n === 1 ? [50] : n === 2 ? [35, 65] : n === 3 ? [25, 50, 75] : [18, 41, 59, 82];
    switch (name) {
      case "3-2-3":
        return [{ x: 6, y: 50 }, ...lanesY(3).map((y) => ({ x: 22, y })), ...lanesY(2).map((y) => ({ x: 45, y })), ...lanesY(3).map((y) => ({ x: 70, y }))];
      case "2-3-3":
        return [{ x: 6, y: 50 }, ...lanesY(2).map((y) => ({ x: 22, y })), ...lanesY(3).map((y) => ({ x: 45, y })), ...lanesY(3).map((y) => ({ x: 70, y }))];
      case "4-3-1":
        return [{ x: 6, y: 50 }, ...lanesY(4).map((y) => ({ x: 22, y })), ...lanesY(3).map((y) => ({ x: 47, y })), { x: 72, y: 50 }];
      default:
        return [{ x: 6, y: 50 }, ...lanesY(3).map((y) => ({ x: 22, y })), ...lanesY(3).map((y) => ({ x: 47, y })), ...lanesY(2).map((y) => ({ x: 72, y }))];
    }
  }

  function clearField() {
    field.querySelectorAll(".draggable-player").forEach((el) => {
      updatePlayerCardState(el.dataset.playerId, false);
      el.remove();
    });
    placementIndex = 0;
    lastRemovedPlayer = null;
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
    if (gkIndex > 0) {
      const [gk] = ids.splice(gkIndex, 1);
      ids.unshift(gk);
    }
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
      const benchCard = benchList.querySelector(
        `.player-card[data-player-id="${incomingId}"]`
      );
      if (!benchCard) {
        alert("Only Game Changers can come on. All Players are not available today.");
        return;
      }
      if (field.querySelector(`.draggable-player[data-player-id="${incomingId}"]`)) {
        return alert("That player is already on the pitch.");
      }
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
      <img src="${p.photo}" onerror="this.src='avatars/placeholder.jpg'" class="w-12 h-12 rounded-full mx-auto object-cover"/>
      <div class="text-xs font-bold text-center mt-1">#${p.number} ${p.name}</div>
      <div class="text-[10px] text-center">${p.position} / ${p.altPosition}</div>
    `;
  }

  function addPlayerToField(index, player, left = null, top = null) {
    if (
      field.querySelectorAll(".draggable-player").length >= 9 &&
      !field.querySelector(`.draggable-player[data-player-id="${index}"]`)
    ) {
      return alert("⚠️ Only 9 players allowed.");
    }
    const div = document.createElement("div");
    div.className = "draggable-player";
    div.dataset.playerId = index;
    div.style.left = left || `${getAutoPosition().x}px`;
    div.style.top = top || `${getAutoPosition().y}px`;
    div.style.position = "absolute";
    div.innerHTML = playerOnPitchHTML(player);

    // remove from pitch (double click or double tap)
    let tapTs = 0;
    div.addEventListener("dblclick", () => removeFromPitch(div));
    div.addEventListener("touchend", () => {
      const now = Date.now();
      if (now - tapTs < 250) removeFromPitch(div);
      tapTs = now;
    });

    makeDraggable(div);
    attachDropHandlers(div);
    field.appendChild(div);
    updatePlayerCardState(index, true);

    if (lastRemovedPlayer && currentMatchId) {
      const m = matchById(currentMatchId);
      if (m) {
        m.events.push({
          time: timerEl.textContent,
          type: "Substitution",
          playerId: index,
          playerName: `#${player.number} ${player.name} ⇆ ${lastRemovedPlayer.name}`,
        });
        saveMatches(matches);
        renderEventLog();
      }
      lastRemovedPlayer = null;
    }
    refreshEventPlayerDropdown();
  }

  function removeFromPitch(div) {
    const removedId = parseInt(div.dataset.playerId);
    const removedPlayer = players[removedId];
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
        if (!active && card.dataset.listType === "bench") {
          card.setAttribute("draggable", "true");
          card.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", String(playerId));
            e.dataTransfer.effectAllowed = "move";
          });
        }
      }
    });
  }

  // ===== DRAGGABLE with mouse + touch =====
  function makeDraggable(el) {
    let offsetX, offsetY;

    // mouse
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

    // touch
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
        if (a) {
          ev.assistId = aid;
          ev.assistName = `#${a.number} ${a.name}`;
        }
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

  matchSelect.addEventListener("change", () => setActiveMatch(matchSelect.value));
  newMatchBtn.addEventListener("click", createNewMatch);
  deleteMatchBtn.addEventListener("click", deleteCurrentMatch);

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

  // Modal open/close
  openEditor.addEventListener("click", () => modal.classList.remove("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("pe-backdrop")) modal.classList.add("hidden");
  });
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


// --- Data backup helpers ---
function loadLS(key, fallback=null){
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; }
  catch { return fallback; }
}
function saveLS(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function exportAll(){
  const payload = {
    matches: loadLS('matches', []),
    players: loadLS('customPlayers', null),
    formation: loadLS('savedFormation', null),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'team-manager-backup.json';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

async function importAll(file){
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Invalid backup');

  if ('matches' in data) saveLS('matches', data.matches ?? []);
  if ('players' in data) saveLS('customPlayers', data.players ?? null);
  if ('formation' in data) saveLS('savedFormation', data.formation ?? null);

  if (typeof initApp === 'function') initApp();
  else location.reload();
}

// Bind export/import once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportBtn')?.addEventListener('click', exportAll);
  document.getElementById('importInput')?.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    try{
      await importAll(file);
      alert('Import complete.');
    }catch(err){
      console.error(err);
      alert('Import failed: ' + err.message);
    }finally{
      e.target.value = '';
    }
  });
});
