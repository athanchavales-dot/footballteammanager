
(function () {
  const { createApp, ref, computed, onMounted } = Vue;

  function defaultPlayer(n = 0) {
    return { number: n, name: "New Player", position: "MID", altPosition: "FWD", photo: "avatars/placeholder.jpg" };
  }

  // Resize to square dataURL (offline-friendly)
  async function fileToDataURLSquare(file, size = 128) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const r = Math.max(size / img.width, size / img.height);
      const w = img.width * r, h = img.height * r;
      const x = (size - w) / 2, y = (size - h) / 2;
      ctx.drawImage(img, x, y, w, h);
      return canvas.toDataURL("image/jpeg", 0.85);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  createApp({
    setup() {
      const players = ref([]);
      const filter = ref("");

      const filtered = computed(() =>
        players.value.filter(p =>
          p.name.toLowerCase().includes(filter.value.toLowerCase()) ||
          String(p.number).includes(filter.value)
        )
      );

      async function load() {
        let arr = [];
        try {
          const custom = localStorage.getItem("customPlayers");
          if (custom) arr = JSON.parse(custom);
          else if (window.loadPlayersData) arr = await window.loadPlayersData();
        } catch {}
        if (!Array.isArray(arr) || arr.length === 0) {
          try {
            const res = await fetch("players.json");
            if (res.ok) arr = await res.json();
          } catch { arr = [defaultPlayer(1)]; }
        }
        players.value = JSON.parse(JSON.stringify(arr));
      }

      function add() {
        const nextNo = (players.value.reduce((m, p) => Math.max(m, Number(p.number) || 0), 0) || 0) + 1;
        players.value.push(defaultPlayer(nextNo));
      }
      function duplicate(idx) {
        const p = players.value[idx]; if (!p) return;
        const copy = JSON.parse(JSON.stringify(p));
        copy.number = (players.value.reduce((m, q) => Math.max(m, Number(q.number) || 0), 0) || 0) + 1;
        copy.name = p.name + " (Copy)";
        players.value.splice(idx + 1, 0, copy);
      }
      function remove(idx) {
        if (!confirm("Remove this player?")) return;
        players.value.splice(idx, 1);
      }
      function renumber() {
        const used = new Set();
        players.value.forEach((p) => {
          let n = Number(p.number) || 0;
          while (n <= 0 || used.has(n)) n++;
          used.add(n);
          p.number = n;
        });
      }
      function sortByNumber() { players.value.sort((a, b) => (a.number || 0) - (b.number || 0)); }
      function sortByPosition() {
        const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
        players.value.sort((a, b) => {
          const ao = order[a.position] ?? 9, bo = order[b.position] ?? 9;
          return ao - bo || (a.number || 0) - (b.number || 0);
        });
      }
      function save() {
        localStorage.setItem("customPlayers", JSON.stringify(players.value));
        if (window.refreshPlayersUI) window.refreshPlayersUI(players.value);
        alert("✅ Players saved.");
      }
      function close() { if (window.__closePlayerEditor) window.__closePlayerEditor(); }

      // Avatar helpers (compact pill)
      function imgError(ev) { ev.target.src = "avatars/placeholder.jpg"; }
      function pickFile(idx) {
        const input = document.getElementById("pe_file_" + idx);
        if (input) input.click();
      }
      async function fileChosen(idx, ev) {
        const f = ev.target?.files?.[0];
        if (!f || !f.type.startsWith("image/")) return;
        players.value[idx].photo = await fileToDataURLSquare(f, 128);
        ev.target.value = "";
      }
      function dragOver(ev) { ev.preventDefault(); ev.currentTarget.classList.add("pe-drop--hover"); }
      function dragLeave(ev) { ev.currentTarget.classList.remove("pe-drop--hover"); }
      async function dropped(idx, ev) {
        ev.preventDefault();
        ev.currentTarget.classList.remove("pe-drop--hover");
        const f = ev.dataTransfer?.files?.[0];
        if (!f || !f.type.startsWith("image/")) return;
        players.value[idx].photo = await fileToDataURLSquare(f, 128);
      }
      async function pasted(idx, ev) {
        const items = ev.clipboardData?.items || [];
        for (const it of items) {
          if (it.type?.startsWith("image/")) {
            const f = it.getAsFile();
            players.value[idx].photo = await fileToDataURLSquare(f, 128);
            break;
          }
        }
      }

      onMounted(load);

      return {
        players, filter, filtered,
        add, duplicate, remove, renumber, sortByNumber, sortByPosition, save, close,
        imgError, pickFile, fileChosen, dragOver, dragLeave, dropped, pasted
      };
    },

    template: `
      <div class="pe-header">
        <div class="pe-title">Player Editor</div>
        <div class="pe-actions">
          <input class="pe-input" v-model="filter" placeholder="Search by name or number" style="width:220px"/>
          <button class="pe-btn blue" @click="add()">Add</button>
          <button class="pe-btn" @click="renumber()">Renumber</button>
          <button class="pe-btn" @click="sortByNumber()">Sort #</button>
          <button class="pe-btn" @click="sortByPosition()">Sort Pos</button>
          <button class="pe-btn green" @click="save()">Save</button>
          <button class="pe-btn red" @click="close()">Close</button>
        </div>
      </div>

      <table class="pe-table">
        <thead>
          <tr>
            <th style="width:70px">#</th>
            <th style="width:26%">Name</th>
            <th style="width:80px">Pos</th>
            <th style="width:80px">Alt</th>
            <th style="width:240px">Photo</th>
            <th>URL (optional)</th>
            <th style="width:140px">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, idx) in filtered" :key="idx" class="pe-row">
            <td><input class="pe-input" type="number" v-model.number="p.number" min="0"/></td>
            <td><input class="pe-input" v-model="p.name"/></td>
            <td>
              <select class="pe-input" v-model="p.position">
                <option>GK</option><option>DEF</option><option>MID</option><option>FWD</option>
              </select>
            </td>
            <td>
              <select class="pe-input" v-model="p.altPosition">
                <option>GK</option><option>DEF</option><option>MID</option><option>FWD</option>
              </select>
            </td>

            <td>
              <div class="pe-photo">
                <img :src="p.photo" class="pe-thumb" @error="imgError"/>
                <div class="pe-drop"
                     title="Click to choose, or drop/paste an image"
                     @click="pickFile(idx)"
                     @dragover="dragOver"
                     @dragleave="dragLeave"
                     @drop="dropped(idx, $event)"
                     @paste="pasted(idx, $event)">
                  Drop / Click / Paste
                </div>
                <input type="file" accept="image/*" class="pe-file" :id="'pe_file_' + idx" @change="fileChosen(idx, $event)"/>
              </div>
            </td>

            <td><input class="pe-input" v-model="p.photo" placeholder="Or paste an image URL here"/></td>

            <td class="pe-mini">
              <button class="pe-btn" @click="duplicate(idx)">Duplicate</button>
              <button class="pe-btn red" @click="remove(idx)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    `,
  }).mount("#playerEditorApp");
})();
