<template>
  <span></span>
  <h4>
    Straight
    <span><font-awesome-icon :icon="['fas', 'warehouse']" /> Bestand</span>
  </h4>

  <div class="search-outer">
    <div class="search-container">
    <textarea
      v-model="searchQuery"
      placeholder="Suche nach Bezeichnung, Größe oder Standort"
      class="search-textarea"
      rows="1"
      @input="autoResize($event)"
    ></textarea>
    <button v-if="isModalOpen" class="add-button">+</button>
    <button
      v-if="!isModalOpen"
      class="add-button"
      @click="
        showAddModal = true;
        openModal();
      "
    >
      +
    </button>
  </div>

  <div class="filter-buttons">
  <div 
    :class="{ active: sortBy === 'name' }" 
    @click="setSortBy('name')" 
    id="nameFilter"
  >
    Name
    <font-awesome-icon 
      v-if="sortBy === 'name' && isAscending" 
      :icon="['fas', 'sort-up']" 
    />
    <font-awesome-icon 
      v-if="sortBy === 'name' && !isAscending" 
      :icon="['fas', 'sort-down']" 
    />
  </div>
  <div 
    :class="{ active: sortBy === 'count' }" 
    @click="setSortBy('count')" 
    id="countFilter"
  >
    Anzahl
    <font-awesome-icon 
      v-if="sortBy === 'count' && isAscending" 
      :icon="['fas', 'sort-up']" 
    />
    <font-awesome-icon 
      v-if="sortBy === 'count' && !isAscending" 
      :icon="['fas', 'sort-down']" 
    />
  </div>

  <div class="keyword-button" @click="insertKeyword('logistik')">
    Logistik
  </div>
  <div class="keyword-button" @click="insertKeyword('service')">
    Service
  </div>
</div>

  </div>
  

  
  <!-- Modal for adding an item -->
  <teleport to="body">
    <div v-if="showAddModal" class="modal" @click.self="showAddModal = false; closeModal();">
      <div class="modal-content add-item-modal">
        <font-awesome-icon
          class="close"
          :icon="['fas', 'times']"
          @click="
            showAddModal = false;
            closeModal();
          "
        />
        <h4>Artikel hinzufügen</h4>

        <div class="modal-scrollable">
          <!-- Input fields with keyup.enter event -->
          <label class="select-label">
            Standort
            <select
              v-model="newItem.standort"
              id="standort"
              required
            >
              <option value="" disabled>Standort auswählen</option>
              <option value="Hamburg">Hamburg</option>
              <option value="Köln">Köln</option>
              <option value="Berlin">Berlin</option>
            </select>
          </label>

          <label class="select-label">
            Bezeichnung
            <input
              v-model="newItem.bezeichnung"
              id="bezeichnung"
              type="text"
              placeholder="Bezeichnung"
              required
            />
          </label>

          <label class="select-label">
            Größe
            <input
              v-model="newItem.groesse"
              id="groesse"
              type="text"
              placeholder="Größe (optional)"
            />
          </label>

          <div class="count-row">
            <label class="count-label">
              Anzahl
              <input
                v-model="newItem.anzahl"
                id="anzahl"
                type="number"
                placeholder="Anzahl"
                min="0"
                required
              />
            </label>
            <label class="count-label">
              Sollwert
              <input
                v-model="newItem.soll"
                id="soll"
                type="number"
                placeholder="Sollwert"
                min="1"
                required
              />
            </label>
          </div>

          <label class="select-label">
            Anmerkung
            <input
              type="text"
              v-model="anmerkung"
              placeholder="Anmerkung (Optional)"
            />
          </label>
        </div>

        <!-- Submit button -->
        <div class="modal-buttons">
          <button @click="submitNewItem()">Hinzufügen</button>
        </div>
      </div>
    </div>
  </teleport>

  <teleport to="body">
    <div v-if="showInputField" class="modal" @click.self="resetInput()">
      <div class="modal-content update-item-modal">
        <font-awesome-icon
          class="close"
          :icon="['fas', 'times']"
          @click="resetInput()"
        />

        <div class="modal-header">
          <h4>{{ selectedItem?.bezeichnung }}</h4>
          <div class="header-badges">
            <span class="badge badge-size">{{ selectedItem?.groesse || "onesize" }}</span>
            <span class="badge badge-location">
              <font-awesome-icon :icon="['fas', 'location-dot']" />
              {{ selectedItem?.standort }}
            </span>
          </div>
        </div>

        <div class="modal-scrollable">
          <label class="select-label">
            Aktuell: {{ selectedItem?.anzahl }}
            <input
              type="number"
              v-model="inputValue"
              min="0"
              placeholder="Zahl eingeben"
            />
          </label>
          <label class="select-label">
            Anmerkung
            <input
              type="text"
              v-model="anmerkung"
              placeholder="Anmerkung (Optional)"
            />
          </label>
        </div>

        <div class="modal-buttons">
          <button @click="submitAddOrRemove('add')">Rückgabe</button>
          <button @click="submitAddOrRemove('remove')">Entnahme</button>
        </div>
      </div>
    </div>
  </teleport>

  <!-- Items Display -->
  <div class="items-container">
    <div v-for="item in filteredItems" :key="item.id" class="item-wrapper">
      <div class="item-card">
        <div class="item-header">
          <span class="header-and-pen">
            <strong 
            class="inputBez"
            v-if="!item.isEditing">{{ item.bezeichnung }}</strong>
            <input
              class="inputBez"
              v-if="item.isEditing"
              type="text"
              v-model="item.bezeichnung"
            />
            <font-awesome-icon
              v-if="!item.isEditing"
              class="edit-button"
              :icon="['fas', 'pencil']"
              @click="enableEdit(item)"
            />
            <span class="vertical-buttons">
              <font-awesome-icon
                v-if="item.isEditing"
                class="close-button"
                :icon="['fas', 'times']"
                @click="cancelEdit(item)"
              />
              <font-awesome-icon
                v-if="item.isEditing"
                class="accept-button"
                :icon="['fas', 'check']"
                @click="updateItem(item)"
              />
            </span>
          </span>
          <span v-if="item.isEditing" class="item-id-label">ID: {{ item._id }}</span>
        </div>

        <div class="item-detail">
          <span>Größe:</span>
          <span>{{ item.groesse ? item.groesse : "onesize" }}</span>
        </div>
        <div class="item-detail">
          <span>Soll:</span>
          <span v-if="!item.isEditing">{{ item.soll }}</span>
          <input
            class="inputMen"
            v-if="item.isEditing"
            type="number"
            v-model="item.soll"
          />
          
        </div>
        <div class="item-detail">
          <span>Menge:</span>
          <span v-if="!item.isEditing">{{ item.anzahl }}</span>
          <input
            class="inputMen"
            v-if="item.isEditing"
            type="number"
            v-model="item.anzahl"
          />
        </div>
        <div class="item-detail">
          <span>Standort:</span>
          <span>{{ item.standort }}</span>
        </div>
      </div>

      <div class="item-actions">
        <button class="update-button" @click="startUpdate(item, $event)">
          Entnahme/Einlagerung
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";

const collator = new Intl.Collator("de", { numeric: true, sensitivity: "base" });

export default {
  name: "Bestand",
  emits: [
    "update-modal",
    "switch-to-bestand",
    "switch-to-dashboard",
    "switch-to-verlauf",
  ],
  components: { FontAwesomeIcon },
  props: { isModalOpen: Boolean },

  data() {
    return {
      token: localStorage.getItem("token") || null,

      userEmail: "",
      userName: "",
      userID: "",

      // Suche & UI
      searchQuery: "",
      searchWords: [],          // ← wird aus searchQuery (debounced) befüllt
      debounceMs: 300,
      _searchT: null,           // timer handle fürs Debounce

      // Modal / Eingaben
      inputValue: "",
      anmerkung: "",
      showInputField: false,
      showAddModal: false,
      modalOpen: false,
      mouseX: 0,
      mouseY: 0,
      selectedItem: null,

      // Daten
      items: [],
      newItem: {
        bezeichnung: "",
        groesse: "",
        anzahl: 0,
        soll: 0,
        standort: "",
      },

      // Edit-Puffer
      originalBezeichnung: "",
      originalAnzahl: 0,
      originalSoll: 0,

      // Sortierung
      sortBy: "name",    // "name" | "count"
      isAscending: true,
    };
  },

  watch: {
    // Token-Update (optional, falls du’s noch lokal setzt)
    token(newToken) {
      if (newToken) {
        localStorage.setItem("token", newToken);
        this.setAxiosAuthToken();
      } else {
        localStorage.removeItem("token");
      }
    },

    // Debounced Suche + Standort-Autofill — KEINE Seiteneffekte mehr im computed!
    searchQuery: {
      immediate: true,
      handler(q) {
        clearTimeout(this._searchT);
        const text = (q || "").toLowerCase();

        this._searchT = setTimeout(() => {
          const words = text.split(/\s+/).filter(Boolean);
          this.searchWords = words;

          // Standort-Autofill nur wenn eindeutig
          const hasHB = words.includes("hamburg");
          const hasK  = words.includes("köln");
          const hasB  = words.includes("berlin");
          if (hasHB && !hasK && !hasB) this.newItem.standort = "Hamburg";
          else if (!hasHB && hasK && !hasB) this.newItem.standort = "Köln";
          else if (!hasHB && !hasK && hasB) this.newItem.standort = "Berlin";
          else this.newItem.standort = "";
        }, this.debounceMs);
      },
    },
  },

  computed: {
    filteredItems() {
      const words = this.searchWords;

      // Filtern
      let filtered = words.length
        ? this.items.filter((item) => {
            const bezeichnung = (item.bezeichnung || "").toLowerCase();
            const groesse    = (item.groesse || "").toLowerCase();
            const standort   = (item.standort || "").toLowerCase();
            const hay = `${bezeichnung} ${groesse} ${standort}`;
            return words.every((w) => hay.includes(w));
          })
        : this.items.slice(); // Kopie, damit sort() nicht das Original zerdeppert

      // Sortiere mit stabilem Index für editierte Items
      filtered.sort((a, b) => {
        // Beide editiert: behalte relative Position aus items array
        if (a.isEditing && b.isEditing) {
          return this.items.indexOf(a) - this.items.indexOf(b);
        }
        
        // Nur a editiert: behalte Position basierend auf original array
        if (a.isEditing) {
          return this.items.indexOf(a) - this.items.indexOf(b);
        }
        
        // Nur b editiert: behalte Position basierend auf original array
        if (b.isEditing) {
          return this.items.indexOf(a) - this.items.indexOf(b);
        }
        
        // Beide nicht editiert: normale Sortierung
        if (this.sortBy === "count") {
          return this.isAscending
            ? (a.anzahl ?? 0) - (b.anzahl ?? 0)
            : (b.anzahl ?? 0) - (a.anzahl ?? 0);
        } else {
          return this.isAscending
            ? collator.compare(a.bezeichnung || "", b.bezeichnung || "")
            : collator.compare(b.bezeichnung || "", a.bezeichnung || "");
        }
      });

      return filtered;
    },
  },

  methods: {
    setAxiosAuthToken() {
      // Mit neuem api-Interceptor eigentlich nicht mehr nötig,
      // aber schadet nicht, falls du den Token hier zentral pflegst.
      api.defaults.headers.common["x-auth-token"] = this.token;
    },

    enableEdit(item) {
      this.originalBezeichnung = item.bezeichnung;
      this.originalAnzahl = item.anzahl;
      this.originalSoll = item.soll;
      item.isEditing = true;
    },
    cancelEdit(item) {
      item.bezeichnung = this.originalBezeichnung;
      item.anzahl = this.originalAnzahl;
      item.soll = this.originalSoll;
      item.isEditing = false;
    },

    setSortBy(criteria) {
      if (this.sortBy === criteria) {
        this.isAscending = !this.isAscending;
      } else {
        this.sortBy = criteria;
        this.isAscending = true;
      }
    },

    insertKeyword(keyword) {
      // robust: toggelt "logistik" vs "service" ohne Freitext zu vermurksen
      const kw = String(keyword || "").toLowerCase();
      if (!kw) return;

      const tokens = (this.searchQuery || "").toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.includes(kw)) return;

      const other = kw === "logistik" ? "service" : "logistik";
      const re = new RegExp(`\\b${other}\\b`, "i");
      let next = (this.searchQuery || "").replace(re, "").trim();

      this.searchQuery = `${next} ${kw}`.trim();
    },

    async updateItem(item) {
      if (
        item.bezeichnung === this.originalBezeichnung &&
        item.anzahl === this.originalAnzahl &&
        item.soll === this.originalSoll
      ) {
        return this.cancelEdit(item);
      }

      try {
        const { data: updatedItem } = await api.put(`/api/items/edit/${item._id}`, {
          userID: this.userID,
          bezeichnung: item.bezeichnung,
          anzahl: item.anzahl,
          soll: item.soll,
        });

        const idx = this.items.findIndex((x) => x._id === updatedItem._id);
        if (idx !== -1) this.items.splice(idx, 1, updatedItem);
        item.isEditing = false;
      } catch (error) {
        console.error("Fehler beim Aktualisieren des Items:", error);
      }
    },

    autoResize(event) {
      const ta = event.target;
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    },

    openModal() { this.$emit("update-modal", true); },
    closeModal() { this.$emit("update-modal", false); },

    async fetchUserData() {
      if (!this.token) return this.$router.push("/");
      try {
        const { data } = await api.get("/api/users/me");
        this.userEmail = data.email;
        this.userID = data._id;
        this.userName = data.name;

        // Standort als Start-Suchbegriff (triggert Watcher → searchWords & Autofill)
        this.searchQuery = data.location || "";
      } catch (error) {
        console.error("Fehler beim Abrufen der Benutzerdaten:", error);
        this.$router.push("/");
      }
    },

    async fetchItems() {
      try {
        const { data } = await api.get("/api/items");
        this.items = Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("Fehler beim Abrufen der Artikel:", error);
      }
    },

    async submitNewItem() {
      let { bezeichnung, groesse, anzahl, soll, standort } = this.newItem;

      groesse = (groesse && groesse.trim()) ? groesse.trim() : "onesize";
      anzahl = Number.isFinite(+anzahl) ? +anzahl : 0;
      soll   = Number.isFinite(+soll)   ? +soll   : 0;

      if (!bezeichnung || !standort || anzahl < 0) {
        alert("Bezeichnung, Anzahl und Standort sind erforderlich");
        return;
      }

      try {
        const { data: created } = await api.post("/api/items/addNew", {
          userID: this.userID,
          bezeichnung,
          groesse,
          anzahl,
          soll,
          standort,
          anmerkung: this.anmerkung,
        });
        this.items.push(created);
        this.resetNewItem();
        this.showAddModal = false;
        this.closeModal();
      } catch (error) {
        console.error("Fehler beim Hinzufügen des Artikels:", error);
      }
    },

    resetNewItem() {
      this.newItem = { bezeichnung: "", groesse: "", anzahl: 0, soll: 0, standort: "" };
      this.anmerkung = "";
    },

    startUpdate(item) {
      this.selectedItem = item;
      this.showInputField = true;
      this.openModal();
    },

    async submitAddOrRemove(action) {
      const value = parseInt(this.inputValue, 10);
      if (Number.isNaN(value)) return;

      try {
        const endpoint =
          action === "add"
            ? `/api/items/add/${this.selectedItem._id}`
            : `/api/items/remove/${this.selectedItem._id}`;

        const { data: updated } = await api.put(endpoint, {
          userID: this.userID,
          anzahl: value,
          anmerkung: this.anmerkung,
        });

        const idx = this.items.findIndex((x) => x._id === updated._id);
        if (idx !== -1) this.items.splice(idx, 1, updated);

        this.resetInput();
      } catch (error) {
        console.error("Fehler beim Aktualisieren des Artikels:", error);
      }
    },

    resetInput() {
      this.inputValue = "";
      this.anmerkung = "";
      this.showInputField = false;
      this.closeModal();
      this.selectedItem = null;
    },
  },

  mounted() {
    this.setAxiosAuthToken();   // harmless; eig. durch api-Interceptor abgedeckt
    this.fetchUserData();
    this.fetchItems();
  },

  beforeUnmount() {
    clearTimeout(this._searchT);
  },
};
</script>

<style scoped lang="scss">@import "@/assets/styles/global.scss";

/* --------- Layout Grundstruktur --------- */
.session {
  display: flex;
  flex-direction: row;
}

.left { display: block; }

@media only screen and (max-width: 768px) {
  .left { display: none; }
  form { width: 100%; height: 100%; }
}

/* --------- Links/Typo --------- */
a.discrete {
  user-select: none;
  color: color-mix(in srgb, var(--text) 40%, transparent);
  font-size: 14px;
  border-bottom: solid 1px rgba(0,0,0,0);
  cursor: pointer;
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 0;

  &:hover { border-bottom: solid 1px var(--border); }
}

.top { display: block; }

/* --------- Formular-Panel (Kopfbereich) --------- */
form {
  padding: 40px 30px 20px;
  background: var(--panel);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 500px;

  h4 {
    font-size: 24px;
    font-weight: 600;
    color: var(--text);
    opacity: 0.85;
    margin-bottom: 20px;

    span {
      color: var(--text);
      font-weight: 700;
    }
  }

  p {
    line-height: 155%;
    font-size: 14px;
    color: var(--text);
    opacity: 0.65;
    font-weight: 400;
    max-width: 200px;
    margin: 0 0 40px;
  }
}

/* (Duplikat aus Original behalten) */
a.discrete {
  user-select: none;
  color: color-mix(in srgb, var(--text) 40%, transparent);
  font-size: 14px;
  border-bottom: solid 1px rgba(0,0,0,0);
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 40px;

  &:hover { border-bottom: solid 1px var(--border); }
}

/* --------- Buttons --------- */
button {
  user-select: none;
  width: auto;
  min-width: 100px;
  border-radius: 24px;
  text-align: center;
  padding: 15px 40px;
  margin-top: 5px;
  background-color: var(--primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0px 2px 6px -1px rgba(0,0,0,0.13);
  border: none;
  outline: 0;
}

/* Modal Buttons spezifisch zentrieren */
.modal-buttons button {
  margin-left: 0;
}

/* --------- Modal Grundstruktur --------- */
.modal { z-index: 10; }

.close {
  position: absolute;
  right: 8px;
  top: 8px;
  font-size: 20px;
  color: var(--muted);
  cursor: pointer;
  z-index: 1;
  padding: 4px;

  &:hover { color: var(--text); }
}

/* --------- Floating Label Karte --------- */
.floating-label {
  transition: all 0.3s ease;

  &:hover {
    cursor: pointer;
    transform: translateY(-3px);
    box-shadow: 0px 10px 20px 0px rgba(0,0,0,0.2);

    &:active { transform: scale(0.99); }
  }

  button { margin-top: 0; }
  .icon { height: 48px !important; }
}

.inactive {
  transition: unset;

  &:hover {
    cursor: unset;
    transform: unset;
    box-shadow: unset;
  }

  button { background-color: color-mix(in srgb, var(--tile-bg) 70%, var(--text) 30%); }
}

/* --------- Inputs & Dropdowns --------- */
input,
.standort-dropdown {
  user-select: none;
  font-size: 16px;
  padding: 20px 0px;
  height: 56px;
  border: none;
  border-bottom: solid 1px var(--border);
  background: var(--tile-bg);
  width: 280px;
  box-sizing: border-box;
  transition: all 0.3s linear;
  color: var(--text);
  font-weight: 400;

  &:focus {
    border-bottom: solid 1px var(--primary);
    outline: 0;
    box-shadow: 0 2px 6px -8px color-mix(in srgb, var(--primary) 45%, transparent);
  }
}

.standort-dropdown { height: unset; }

/* Floating label helper (behalten) */
.floating-label {
  position: relative;
  margin-bottom: 10px;
  width: 100%;

  label {
    position: absolute;
    top: calc(50% - 7px);
    left: 0;
    opacity: 0;
    transition: all 0.3s ease;
    padding-left: 44px;
  }

  input {
    width: calc(100% - 44px);
    margin-left: auto;
    display: flex;
  }

  .icon {
    position: absolute;
    top: 0; left: 0;
    height: 56px; width: 44px;
    display: flex;

    svg {
      height: 30px; width: 30px;
      margin: auto;
      opacity: 0.15;
      transition: all 0.3s ease;

      path { transition: all 0.3s ease; }
    }
  }

  input:not(:placeholder-shown) { padding: 28px 0px 12px 0px; }
  input:not(:placeholder-shown) + label { transform: translateY(-10px); opacity: 0.7; }

  input:valid:not(:placeholder-shown) + label + .icon svg {
    opacity: 1;
    path { fill: var(--primary); }
  }

  input:not(:valid):not(:focus) + label + .icon {
    animation-name: shake-shake;
    animation-duration: 0.3s;
  }
}

$displacement: 3px;
@keyframes shake-shake {
  0% { transform: translateX(-$displacement); }
  20% { transform: translateX($displacement); }
  40% { transform: translateX(-$displacement); }
  60% { transform: translateX($displacement); }
  80% { transform: translateX(-$displacement); }
  100% { transform: translateX(0px); }
}

/* --------- Wrapper + Sidebarhintergrund --------- */
.session {
  display: flex;
  flex-direction: row;
  width: auto; height: auto;
  margin: auto auto;
  background: var(--panel);
  border-radius: 4px;
  box-shadow: 0px 0px 20px 10px rgba(255,255,255,0.02);
}

.left {
  width: 220px; height: auto; min-height: 100%;
  position: relative;
  background-image: url("@/assets/SF_001.jpg");
  background-position: 60% center;
  background-size: cover;
  border-top-left-radius: 4px; border-bottom-left-radius: 4px;
  box-shadow: 10px 0px 20px -5px rgba(0,0,0,0.1);

  svg { height: 40px; width: auto; margin: 20px; }
}

.right {
  padding: 15px 15px;
  box-shadow: -10px 0px 20px -5px rgba(0,0,0,0.1);
  background: var(--tile-bg);
  display: flex; flex-direction: column; align-items: flex-start;
  padding-bottom: 20px;
  width: 160px;

  h4 {
    margin-bottom: 20px;
    color: var(--text);
    opacity: 0.7;

    span { color: var(--text); font-weight: 700; }
  }

  .shortcut-container {
    font-size: 14px;
    color: var(--text);
    opacity: 0.65;
    font-weight: 400;

    .item-list-sf {
      width: 30px; height: auto;
      margin: 5px; cursor: pointer;
    }
  }
}

.list-item { display: flex; flex-direction: row; align-items: center; }

/* SVG Fills (belassen) */
.logo-svg .st01 { fill: #fff; }
.icon-svg .st0 { fill: none; }
.icon-svg .st1 { fill: #010101; }

.logo-svg {
  width: 50px; height: auto;
  margin: 20px 0px 0px 10px;
}

/* --------- Suche + Filter (wie vorher, nur thematisiert) --------- */
.search-container {
  display: flex;
  align-items: center;
  width: 100%;
}

.search-outer{
  width: 500px;
  padding: 1vh;
}

.search-textarea {
  z-index: 4;
  width: 100%;
  padding: 8px;
  font-size: 16px; /* Verhindert Auto-Zoom auf Mobile */
  border: 1px solid var(--border);
  border-radius: 5px;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;
  background: var(--tile-bg);
  color: var(--text);

  &::placeholder {
    font-size: 16px; /* Gleiche Größe wie Haupttext */
    color: var(--muted);
    opacity: 1;
  }
}

/* Mobile-spezifische Anpassungen */
@media (max-width: 768px) {
  .search-textarea {
    font-size: 16px; /* Explizit für Mobile */
    padding: 12px; /* Größere Touch-Targets */
    line-height: 1.4;
  }
  
  .search-textarea::placeholder {
    font-size: 16px;
  }
}

.filter-buttons {
  z-index: 3;
  margin-top: -3px;
  display: flex;
  gap: 5px !important;
  margin-bottom: 10px;
  width: 50%;

  div {
    font-size: 9px;
    min-width: 40px;
    margin-top: 0;
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background-color: var(--tile-bg);
    color: var(--text);
    display: flex; justify-content: space-between; align-items: center;
    cursor: pointer;
    transition: background-color 0.3s, color 0.2s, border-color 0.2s;
    user-select: none;

    &.active {
      background-color: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }

    &:hover {
      background-color: var(--hover);
      color: var(--text);
    }
  }

  .keyword-button {
    background-color: var(--hover);
    padding: 5px;
    cursor: pointer;
    border-radius: 5px;

    &:hover {
      background-color: color-mix(in srgb, var(--hover) 80%, var(--primary) 20%);
    }
  }
}

/* --------- Items Grid --------- */
.items-container{
  width: 100%;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

@media (min-width: 700px)  { .items-container{ grid-template-columns: repeat(2, 1fr);} }
@media (min-width: 1100px) { .items-container{ grid-template-columns: repeat(3, 1fr);} }
@media (min-width: 1500px) { .items-container{ grid-template-columns: repeat(4, 1fr);} }

form {
  @media only screen and (max-width: 768) { width: 300px; }
}

.item-wrapper {
  margin-bottom: 20px;
  position: relative;
}

.header-and-pen {
  display: flex;
  justify-content: space-between;
  align-items: center;
  word-wrap: break-word;
  width: 100%;
}

.item-card {
  background-color: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 10px;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  color: var(--text);

  .close-button,
  .accept-button {
    position: absolute;
    right: 10px;
    font-size: 16px;
    cursor: pointer;
    color: var(--text);
    opacity: .85;

    &:hover { color: var(--muted); }
  }

  .close-button { top: 10px; }
  .accept-button { top: 25px; right: 9px; }
}

.edit-button {
  position: absolute;
  top: 10px; right: 10px;
  font-size: 16px;
  cursor: pointer;
  color: var(--text);

  &:hover { color: var(--muted); }
}

/* Item Header and Input */
.item-header {
  font-size: 16px;
  margin-bottom: 5px;
  text-align: center;

  .inputBez {
    width: calc(100% - 20px);
    height: min-content;
    font-size: 16px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 4px;
    outline: none;
    background: var(--tile-bg);
    color: var(--text);
  }

  .item-id-label {
    display: block;
    margin-top: 6px;
    font-size: 10px;
    color: var(--muted);
    opacity: 0.6;
    font-family: monospace;
    letter-spacing: -0.5px;
  }
}

.item-detail {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;

  .inputMen {
    width: 30%;
    height: min-content;
    font-size: 16px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 4px;
    outline: none;
    background: var(--tile-bg);
    color: var(--text);
  }
}

.item-detail span { font-size: 14px; }

/* Actions */
.item-actions { display: flex; justify-content: center; }

.update-button {
  width: 100%; height: 2rem;
  font-size: 14px; line-height: 0rem;
  background-color: var(--primary);
  color: white; border: none;
  margin-top: 0; border-radius: 5px;
  cursor: pointer; transition: background-color 0.3s;

  &:hover {
    box-shadow: 0 2px 6px -1px color-mix(in srgb, var(--primary) 65%, transparent);
    background-color: color-mix(in srgb, var(--primary) 90%, black);

    &:active { transform: translateY(-3px); }
  }
}

/* Add (+) Button neben Suche */
.add-button {
  width: 2rem; height: 2rem;
  margin: 0 10px;
  display: flex; justify-content: center; align-items: center;
  z-index: 5;
  background-color: var(--primary);
  color: white; border: none; border-radius: 5px;
  cursor: pointer; transition: background-color 0.3s ease;

  &:hover { background-color: color-mix(in srgb, var(--primary) 95%, black); }
}

.floating-input {
  position: fixed; z-index: 1000;
  background-color: var(--tile-bg);
  border: 1px solid var(--border);
  padding: 10px; border-radius: 5px;
  color: var(--text);
}

.floating-input input {
  width: 50px; text-align: center; background: var(--tile-bg); color: var(--text);
}

/* --------- Modal Overlay & Card --------- */
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  width: 360px;
  max-width: calc(100vw - 32px);
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
    padding: 16px 16px 12px 16px;
    text-align: left;
    color: var(--text);
    opacity: 0.9;
  }
}

.modal-header {
  padding: 16px 16px 12px 16px;
  flex-shrink: 0;

  h4 {
    margin: 0 0 8px 0;
    padding: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    opacity: 0.95;
  }

  .header-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.2;

    svg {
      font-size: 10px;
      opacity: 0.8;
    }
  }

  .badge-size {
    background: color-mix(in srgb, var(--primary) 15%, var(--tile-bg));
    color: color-mix(in srgb, var(--primary) 95%, black);
    border: 1px solid color-mix(in srgb, var(--primary) 25%, transparent);
  }

  .badge-location {
    background: color-mix(in srgb, var(--muted) 10%, var(--tile-bg));
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    opacity: 0.85;
  }
}

.add-item-modal,
.update-item-modal {
  height: auto;
  max-height: min(80vh, 560px);
  min-height: 260px;
}

@media screen and (max-height: 500px) {
  .modal-content {
    height: calc(100vh - 40px);
    max-height: calc(100vh - 40px);
  }
}

.modal-scrollable {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px 16px;
  min-height: 0;
}

.select-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  opacity: 0.85;

  select,
  input {
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--tile-bg);
    color: var(--text);
    font-size: 13px;
    height: auto;
    width: 100%;
    transition: border-color 0.2s, box-shadow 0.2s;

    &:focus {
      border-color: var(--primary);
      outline: none;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent);
    }

    &::placeholder {
      color: var(--muted);
      opacity: 0.5;
      font-size: 12.5px;
    }
  }
}

.count-row {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;

  .count-label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--text);
    opacity: 0.85;
    min-width: 0;

    input {
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--tile-bg);
      color: var(--text);
      font-size: 13px;
      height: auto;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;

      &:focus {
        border-color: var(--primary);
        outline: none;
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary) 12%, transparent);
      }
    }
  }
}

.modal-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 14px 16px;
  border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  background: var(--tile-bg);
  border-radius: 0 0 12px 12px;
  flex-shrink: 0;
  min-height: auto;
  position: relative;
  z-index: 10;

  button {
    flex: 1;
    max-width: 140px;
    padding: 9px 16px;
    border: none;
    border-radius: 6px;
    background: var(--primary);
    color: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: filter 0.2s, transform 0.1s;
    margin: 0;

    &:hover {
      filter: brightness(0.95);
    }

    &:active {
      transform: scale(0.97);
    }
  }
}


</style>
