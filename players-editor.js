(() => {
  const POS = ["GK", "DEF", "MID", "FWD"];

  const modalEl = document.getElementById("playerEditorModal");
  const mountEl = document.getElementById("playerEditorApp");

  const tpl = `
  <div class="p-3">
    <div class="flex items-center gap-2 mb-3">
      <input v-model="q" class="pe-input max-w-sm" placeholder="Search by name or number" />
      <button class="pe-btn" @click="add()">Add</button>
      <button class="pe-btn" @click="renumber()">Renumber</button>
      <button class="pe-btn" @click="sortByNumber()">Sort #</button>
      <button class="pe-btn" @click="sortByPosition()">Sort Pos</button>
      <button class="pe-btn" @click="save()">Save</button>
      <button class="pe-btn" @click="close()">Close</button>
    </div>

    <div class="pe-table">
      <div class="pe-row pe-row--head">
        <div>#</div><div>Name</div><div>Pos</div><div>Alt</div><div>Photo</div><div>Actions</div>
      </div>

      <template v-for="(p, idx) in filtered" :key="idx">
        <div class="pe-row">
          <div><input v-model.number="p.number" type="number" class="pe-input w-14" min="1" /></div>
          <div><input v-model.trim="p.name" class="pe-input w-full" placeholder="Player name" /></div>
          <div>
            <select v-model="p.position" class="pe-input w-full">
              <option v-for="x in POS" :key="x" :value="x">{{x}}</option>
            </select>
          </div>
          <div>
            <select v-model="p.altPosition" class="pe-input w-full">
              <option v-for="x in POS" :key="x" :value="x">{{x}}</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <img :src="p.photo || placeholder" @error="p.photo = placeholder" class="pe-photo" :alt="p.name" />
            <label class="pe-drop" @dragover.prevent @drop.prevent="onDrop($event, p)" @paste="onPaste($event, p)">
              Drop / Click / Paste
              <input type="file" accept="image/*" @change="onFile($event, p)" />
            </label>
          </div>
          <div class="flex gap-2 justify-end">
            <button class="pe-btn" @click="duplicate(p)">Duplicate</button>
            <button class="pe-btn" @click="remove(p)">Delete</button>
          </div>
        </div>
      </template>
    </div>
  </div>
  `;

  const app = Vue.createApp({
    template: tpl,
    data() {
      return {
        players: [],
        q: "",
        POS,
        placeholder: "avatars/placeholder.jpg",
      };
    },
    computed: {
      filtered() {
        const q = (this.q || "").toLowerCase().trim();
        if (!q) return this.players;
        return this.players.filter(p =>
          String(p.number).includes(q) ||
          (p.name || "").toLowerCase().includes(q)
        );
      }
    },
    methods: {
      async load() {
        // 1) custom players from localStorage
        try {
          const raw = localStorage.getItem("customPlayers");
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length) {
              this.players = this._normalize(arr);
              return;
            }
          }
        } catch { }

        // 2) if the page’s loader exists, use it
        if (typeof window.loadPlayersData === "function") {
          const arr = await window.loadPlayersData();
          this.players = this._normalize(arr || []);
          return;
        }

        // 3) read inline JSON as fallback
        try {
          const inline = document.getElementById("playersData");
          if (inline?.textContent) {
            const arr = JSON.parse(inline.textContent.trim());
            if (Array.isArray(arr) && arr.length) {
              this.players = this._normalize(arr);
              return;
            }
          }
        } catch { }

        // 4) final fallback: fetch players.json directly
        try {
          const res = await fetch("players.json?v=5", { cache: "no-store" });
          if (res.ok) {
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length) {
              this.players = this._normalize(arr);
              return;
            }
          }
        } catch { }

        // Nothing worked – keep empty array
        this.players = [];
      },

      _normalize(arr) {
        return arr.map((p, i) => ({
          number: Number(p.number ?? i + 1),
          name: p.name ?? `Player ${i + 1}`,
          position: POS.includes(p.position) ? p.position : "MID",
          altPosition: POS.includes(p.altPosition) ? p.altPosition : "DEF",
          photo: p.photo || this.placeholder
        }));
      },

      add() {
        const maxNum = this.players.reduce((m, p) => Math.max(m, Number(p.number) || 0), 0);
        this.players.push({
          number: maxNum + 1,
          name: `Player ${maxNum + 1}`,
          position: "MID",
          altPosition: "DEF",
          photo: this.placeholder
        });
      },
      duplicate(p) {
        const clone = { ...p, number: this._nextNumber() };
        this.players.push(clone);
      }
      ,
      _nextNumber() {
        return this.players.reduce((m, p) => Math.max(m, Number(p.number) || 0), 0) + 1;
      },
      remove(p) {
        const i = this.players.indexOf(p);
        if (i >= 0) this.players.splice(i, 1);
      },
      renumber() {
        this.players
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .forEach((p, i) => (p.number = i + 1));
      },
      sortByNumber() {
        this.players.sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));
      },
      sortByPosition() {
        const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
        this.players.sort((a, b) => {
          const d = (order[a.position] ?? 9) - (order[b.position] ?? 9);
          return d || (Number(a.number) || 0) - (Number(b.number) || 0);
        });
      },
      async onFile(e, p) {
        const file = e.target.files?.[0];
        if (file) p.photo = await this._toDataURL(file);
        e.target.value = "";
      },
      async onDrop(e, p) {
        const file = e.dataTransfer?.files?.[0];
        if (file) p.photo = await this._toDataURL(file);
      },
      async onPaste(e, p) {
        const items = e.clipboardData?.items || [];
        for (const it of items) {
          if (it.kind === "file") {
            const file = it.getAsFile();
            if (file) { p.photo = await this._toDataURL(file); break; }
          }
        }
      },
      _toDataURL(file) {
        return new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
      },
      save() {
        localStorage.setItem("customPlayers", JSON.stringify(this.players));
        if (typeof window.refreshPlayersUI === "function") {
          window.refreshPlayersUI(this.players);
        }
        this.close();
        alert("✅ Players saved.");
      },
      close() {
        modalEl.classList.add("hidden");
      }
    },
    mounted() {
      this.load();
      // If the page defines loadPlayersData later, refresh once more.
      window.addEventListener("DOMContentLoaded", () => {
        if (!this.players.length && typeof window.loadPlayersData === "function") {
          this.load();
        }
      });
    }
  });

  app.mount(mountEl);
})();
