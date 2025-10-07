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
  <div v-if="showAddModal" class="modal">
    <div class="modal-content">
      <font-awesome-icon
        class="close-modal"
        :icon="['fas', 'times']"
        @click="
          showAddModal = false;
          closeModal();
        "
        style="bottom: 96%"
      />
      <h4>Artikel hinzufügen</h4>

      <!-- Input fields with keyup.enter event -->
      <div class="ModalGroup">
        <label for="standort">Standort</label>
        <select
          class="standort-dropdown"
          v-model="newItem.standort"
          id="standort"
          required
        >
          <option value="" disabled>Standort auswählen</option>
          <option value="Hamburg">Hamburg</option>
          <option value="Köln">Köln</option>
          <option value="Berlin">Berlin</option>
        </select>
      </div>
      <div class="ModalGroup">
        <label for="bezeichnung">Bezeichnung</label>
        <input
          v-model="newItem.bezeichnung"
          id="bezeichnung"
          type="text"
          placeholder="Bezeichnung"
          required
        />
      </div>
      <div class="ModalGroup">
        <label for="groesse">Größe</label>
        <input
          v-model="newItem.groesse"
          id="groesse"
          type="text"
          placeholder="Größe (optional)"
        />
        <label for="anzahl">Anzahl / Soll</label>
      </div>
      <div class="ModalGroup CountGroup">
          <input class="CountInput"
          v-model="newItem.anzahl"
          id="anzahl"
          type="number"
          placeholder="Anzahl"
          min="0"
          required
        />
        <input 
          style="margin-left: auto;"
          class="CountInput"
          v-model="newItem.soll"
          id="soll"
          type="number"
          placeholder="Sollwert"
          min="1"
          required
        />
      </div>
      <div class="ModalGroup">
        <label for="anmerkung">Anmerkung</label>
        <input
          ref="floatingInput"
          type="text"
          v-model="anmerkung"
          placeholder="Anmerkung (Optional)"
        />
      </div>

      <!-- Submit button -->
      <button @click="submitNewItem()">Hinzufügen</button>
    </div>
  </div>

  <div v-if="showInputField" class="modal">
    <div class="modal-content">
      <font-awesome-icon
        class="close-modal"
        :icon="['fas', 'times']"
        @click="resetInput()"
      />

      <h4>
        {{ selectedItem?.bezeichnung }} ({{
          selectedItem?.groesse || "onesize"
        }}) ({{ selectedItem?.standort }})
      </h4>

      <div class="ModalGroup">
        <label for="anzahl">Aktuell: {{ selectedItem?.anzahl }}</label>
        <input
          ref="floatingInput"
          type="number"
          v-model="inputValue"
          min="0"
          placeholder="Zahl eingeben"
        />
        <input
          ref="floatingInput"
          type="text"
          v-model="anmerkung"
          placeholder="Anmerkung (Optional)"
        />
      </div>

      <button @click="submitAddOrRemove('add')">Hinzufügen</button>
      <button @click="submitAddOrRemove('remove')">Entnehmen</button>
    </div>
  </div>

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

      // Sortieren
      if (this.sortBy === "count") {
        filtered.sort((a, b) =>
          this.isAscending
            ? (a.anzahl ?? 0) - (b.anzahl ?? 0)
            : (b.anzahl ?? 0) - (a.anzahl ?? 0)
        );
      } else {
        filtered.sort((a, b) =>
          this.isAscending
            ? collator.compare(a.bezeichnung || "", b.bezeichnung || "")
            : collator.compare(b.bezeichnung || "", a.bezeichnung || "")
        );
      }

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
  margin-left: auto;
  font-weight: 500;
  box-shadow: 0px 2px 6px -1px rgba(0,0,0,0.13);
  border: none;
  outline: 0;
}

/* --------- Modal Grundstruktur --------- */
.modal { z-index: 10; }

.close-modal {
  position: absolute;
  cursor: pointer;
  bottom: 94%;
  left: 95%;
  background-color: var(--tile-bg);
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 50%;
  width: 30px; height: 30px;
  font-size: 16px;
  display: flex; justify-content: center; align-items: center;

  &:hover { color: color-mix(in srgb, var(--text) 60%, transparent); }
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
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--overlay);
  display: flex; justify-content: center; align-items: center;
}

.modal-content {
  background: var(--tile-bg);
  color: var(--text);
  padding: 20px; border-radius: 8px;
  width: 400px; text-align: center;
  position: relative; border: 1px solid var(--border);

  button {
    margin: 10px; border-radius: 5px; cursor: pointer;
    transition: background-color 0.3s ease;

    &:hover { background-color: color-mix(in srgb, var(--primary) 90%, black); }
  }
}

/* --------- Gruppen --------- */
.ModalGroup { display: inline-grid; }

.CountGroup {
  display: flex !important;

  .CountInput { width: 40%; }
}


</style>
