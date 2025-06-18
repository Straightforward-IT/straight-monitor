<template>
  <span></span>
  <h4>
    Straight
    <span><font-awesome-icon :icon="['fas', 'warehouse']" /> Bestand</span>
  </h4>
  <p>Benutzer: {{ userName }}</p>

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

export default {
  name: "Bestand",
  emits: [
    "update-modal",
    "switch-to-bestand",
    "switch-to-dashboard",
    "switch-to-verlauf",
  ],
  components: {
    FontAwesomeIcon,
  },
  props: {
    isModalOpen: Boolean,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      userEmail: "",
      userName: "",
      userID: "",
      searchQuery: "",
      inputValue: "",
      anmerkung: "",
      showInputField: false,
      showAddModal: false,
      modalOpen: false,
      mouseX: 0,
      mouseY: 0,
      selectedItem: null,
      items: [],
      newItem: {
        bezeichnung: "",
        groesse: "",
        anzahl: 0,
        soll: 0,
        standort: "",
      }, // Store new item data
      originalBezeichnung: "",
      originalAnzahl: 0,
      originalSoll: 0,
      sortBy: "name",
      isAscending: true,
    };
  },
  watch: {
    token(newToken) {
      if (newToken) {
        localStorage.setItem("token", newToken);
        this.setAxiosAuthToken();
      } else {
        localStorage.removeItem("token");
      }
    },
  },
  computed: {
    filteredItems() {
      this.searchQuery = this.searchQuery.toLocaleLowerCase();

  const searchWords = this.searchQuery
    .toLowerCase()
    .split(" ")
    .filter((word) => word);

  if (
    searchWords.includes("hamburg") &&
    !searchWords.includes("köln") &&
    !searchWords.includes("berlin")
  ) {
    this.newItem.standort = "Hamburg";
  } else if (
    !searchWords.includes("hamburg") &&
    searchWords.includes("köln") &&
    !searchWords.includes("berlin")
  ) {
    this.newItem.standort = "Köln";
  } else if (
    !searchWords.includes("hamburg") &&
    !searchWords.includes("köln") &&
    searchWords.includes("berlin")
  ) {
    this.newItem.standort = "Berlin";
  } else {
    this.newItem.standort = "";
  }

  // Filter items based on search terms (by name, size, or location)
  let filtered = this.items.filter((item) => {
    const itemData =
      `${item.bezeichnung} ${item.groesse} ${item.standort}`.toLowerCase();
    return searchWords.every((word) => itemData.includes(word));
  });

  // Sort filtered items based on the selected criterion and ascending/descending order
  if (this.sortBy === "count") {
    // Sort by quantity (Anzahl), considering ascending or descending order
    filtered.sort((a, b) => 
      this.isAscending ? a.anzahl - b.anzahl : b.anzahl - a.anzahl
    );
  } else {
    // Default: Sort by name (Bezeichnung) in alphabetical order, considering order
    filtered.sort((a, b) => 
      this.isAscending 
        ? a.bezeichnung.localeCompare(b.bezeichnung) 
        : b.bezeichnung.localeCompare(a.bezeichnung)
    );
  }

  return filtered;
},
  },
  methods: {
    setAxiosAuthToken() {
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
      // Toggle the direction if the same criteria is clicked
      this.isAscending = !this.isAscending;
    } else {
      // Set new criteria and default to ascending
      this.sortBy = criteria;
      this.isAscending = true;
    }
  },
    insertKeyword(keyword) {
      if (keyword === "logistik") {
        if (this.searchQuery.toLocaleLowerCase().includes(keyword)) {
          return;
        } else {
          if (this.searchQuery.toLocaleLowerCase().includes("service")) {
            this.searchQuery = this.searchQuery.toLocaleLowerCase().replace(" service", "");
          }
          this.searchQuery += ` ${keyword}`;
        }
      } else {
        if (this.searchQuery.toLocaleLowerCase().includes(keyword)){
          return;
        }else{
          if(this.searchQuery.toLocaleLowerCase().includes("logistik")) {
            this.searchQuery = this.searchQuery.toLocaleLowerCase().replace(" logistik", "");
          }
          this.searchQuery += ` ${keyword}`
        }
      }
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
        const response = await api.put(`/api/items/edit/${item._id}`, {
          userID: this.userID,
          bezeichnung: item.bezeichnung,
          anzahl: item.anzahl,
          soll: item.soll
        });
        const updatedItem = response.data;
        const index = this.items.findIndex(
          (item) => item._id === updatedItem._id
        );
        if (index !== -1) {
          this.items.splice(index, 1, updatedItem);
        }
        item.isEditing = false;
      } catch (error) {
        console.error("Fehler beim Aktualisieren des Items:", error);
      }
    },
    autoResize(event) {
      const textarea = event.target;
      event.target.style.height = "auto";
      event.target.style.height = `${textarea.scrollHeight}px`;
    },
    openModal() {
      this.$emit("update-modal", true);
    },
    closeModal() {
      this.$emit("update-modal", false);
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me");
          this.userEmail = response.data.email;
          this.userID = response.data._id;
          this.userName = response.data.name;
          this.searchQuery = response.data.location;
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerdaten:", error);
          this.$router.push("/");
        }
      } else {
        this.$router.push("/");
      }
    },
    async fetchItems() {
      try {
        const response = await api.get("/api/items");
        this.items = response.data;
        console.log("Items fetched:");
      } catch (error) {
        console.error("Fehler beim Abrufen der Artikel:", error);
      }
    },
    async submitNewItem() {
      let { bezeichnung, groesse, anzahl, soll, standort } = this.newItem;

      // Set 'groesse' to 'onesize' if it's empty or an empty string
      if (!groesse || groesse.trim() === "") {
        groesse = "onesize";
      }
      if (!soll) {
        soll = 0;
      }

      // Check for required fields
      if (!bezeichnung || !standort || anzahl < 0) {
        alert("Bezeichnung, Anzahl und Standort sind erforderlich");
        return;
      }

      try {
        const response = await api.post("/api/items/addNew", {
          userID: this.userID,
          bezeichnung,
          groesse,
          anzahl,
          soll,
          standort,
          anmerkung: this.anmerkung,
        });
        this.items.push(response.data); // Add the new item to the list
        this.resetNewItem(); // Reset the form
        this.showAddModal = false; // Close the modal
        this.closeModal();
      } catch (error) {
        console.error("Fehler beim Hinzufügen des Artikels:", error);
      }
    },
    resetNewItem() {
      this.newItem = {
        bezeichnung: "",
        groesse: "",
        anzahl: 0,
        standort: "",
      };
      this.anmerkung = "";
    },
    startUpdate(item) {
      this.selectedItem = item;
      this.showInputField = true; // Show the update modal
      this.openModal();
    },
    async submitAddOrRemove(action) {
      const value = parseInt(this.inputValue);
      if (!isNaN(value)) {
        const amount = value;
        try {
          let response;
          const endpoint =
            action === "add"
              ? `/api/items/add/${this.selectedItem._id}`
              : `/api/items/remove/${this.selectedItem._id}`;
          response = await api.put(endpoint, {
            userID: this.userID,
            anzahl: amount,
            anmerkung: this.anmerkung,
          });
          const updatedItem = response.data;
          const index = this.items.findIndex(
            (item) => item._id === updatedItem._id
          );
          if (index !== -1) {
            this.items.splice(index, 1, updatedItem); // Replace the item with the updated one
          }
          this.resetInput();
        } catch (error) {
          console.error("Fehler beim Aktualisieren des Artikels:", error);
        }
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
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.fetchItems();
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss"; 

.session {
  display: flex;
  flex-direction: row;
}

.left {
  display: block;
}



@media only screen and (max-width: 768px) {
  .left {
    display: none; /* Hide on mobile screens */
  }

  form {
    width: 100%;
    height: 100%;
  }
}

a.discrete {
  user-select: none;
  color: rgba(#000, 0.4);
  font-size: 14px;
  border-bottom: solid 1px rgba(#000, 0);
  cursor: pointer;
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 0px;

  &:hover {
    border-bottom: solid 1px rgba(#000, 0.2);
  }
}

.top {
  display: block;
}


form {
  padding: 40px 30px;
  background: #fefefe;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 20px;
  width: 500px;

  h4 {
      font-size: 24px;
  font-weight: 600;
  color: #000;
  opacity: 0.85;
    margin-bottom: 20px;
    color: rgba(#000, 0.5);
    span {
      color: rgba(#000, 1);
      font-weight: 700;
    }
  }
  p {
    line-height: 155%;
    margin-bottom: 5px;
    font-size: 14px;
    color: #000;
    opacity: 0.65;
    font-weight: 400;
    max-width: 200px;
    margin-bottom: 40px;
  }
}
a.discrete {
  user-select: none;
  color: rgba(#000, 0.4);
  font-size: 14px;
  border-bottom: solid 1px rgba(#000, 0);
  padding-bottom: 4px;
  margin-left: auto;
  font-weight: 300;
  transition: all 0.3s ease;
  margin-top: 40px;
  &:hover {
    border-bottom: solid 1px rgba(#000, 0.2);
  }
}

button {
  user-select: none;
  width: auto;
  min-width: 100px;
  border-radius: 24px;
  text-align: center;
  padding: 15px 40px;
  margin-top: 5px;
  background-color: $base-primary;
  color: #fff;
  font-size: 14px;
  margin-left: auto;
  font-weight: 500;
  box-shadow: 0px 2px 6px -1px rgba(0, 0, 0, 0.13);
  border: none;
  outline: 0;
}
.modal {
  z-index: 10;
}
.close-modal {
  position: absolute;
  cursor: pointer;
  bottom: 94%;
  left: 95%; /* Place the button at the top-right corner */
  background-color: white;
  color: #e3e3e3;
  border: 1px solid gray;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    color: #999;
  }
}

.floating-label {
  transition: all 0.3s ease;
  &:hover {
    cursor: pointer;
    transform: translateY(-3px);
    box-shadow: 0px 10px 20px 0px rgba(0, 0, 0, 0.2);
    &:active {
      transform: scale(0.99);
    }
  }
  button {
    margin-top: 0px;
  }
  .icon {
    height: 48px !important;
  }
}
.inactive {
  transition: unset;
  &:hover {
    cursor: unset;
    transform: unset;
    box-shadow: unset;
  }
  button {
    background-color: #e0e0e0;
  }
}

input,
.standort-dropdown {
  user-select: none;
  font-size: 16px;
  padding: 20px 0px;
  height: 56px;
  border: none;
  border-bottom: solid 1px rgba(0, 0, 0, 0.1);
  background: #fff;
  width: 280px;
  box-sizing: border-box;
  transition: all 0.3s linear;
  color: #000;
  font-weight: 400;
  &:focus {
    border-bottom: solid 1px $base-primary;
    outline: 0;
    box-shadow: 0 2px 6px -8px rgba($base-primary, 0.45);
  }
}

.standort-dropdown {
  height: unset;
}

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
    top: 0;
    left: 0;
    height: 56px;
    width: 44px;
    display: flex;
    svg {
      height: 30px;
      width: 30px;
      margin: auto;
      opacity: 0.15;
      transition: all 0.3s ease;
      path {
        transition: all 0.3s ease;
      }
    }
  }
  input:not(:placeholder-shown) {
    padding: 28px 0px 12px 0px;
  }
  input:not(:placeholder-shown) + label {
    transform: translateY(-10px);
    opacity: 0.7;
  }
  input:valid:not(:placeholder-shown) + label + .icon {
    svg {
      opacity: 1;
      path {
        fill: $base-primary;
      }
    }
  }
  input:not(:valid):not(:focus) + label + .icon {
    animation-name: shake-shake;
    animation-duration: 0.3s;
  }
}
$displacement: 3px;
@keyframes shake-shake {
  0% {
    transform: translateX(-$displacement);
  }
  20% {
    transform: translateX($displacement);
  }
  40% {
    transform: translateX(-$displacement);
  }
  60% {
    transform: translateX($displacement);
  }
  80% {
    transform: translateX(-$displacement);
  }
  100% {
    transform: translateX(0px);
  }
}
.session {
  display: flex;
  flex-direction: row;
  width: auto;
  height: auto;
  margin: auto auto;
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 0px 0px 20px 10px rgba(255, 255, 255, 0.2);
}
.left {
  width: 220px;
  height: auto;
  min-height: 100%;
  position: relative;
  background-image: url("@/assets/SF_001.jpg");
  background-position: 60% center;
  background-size: cover;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  box-shadow: 10px 0px 20px -5px rgba(0, 0, 0, 0.1);
  svg {
    height: 40px;
    width: auto;
    margin: 20px;
  }
}

.right {
  padding: 15px 15px;
  box-shadow: -10px 0px 20px -5px rgba(0, 0, 0, 0.1);
  background: #fefefe;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 20px;
  width: 160px;

  h4 {
    margin-bottom: 20px;
    color: rgba(#000, 0.5);
    span {
      color: rgba(#000, 1);
      font-weight: 700;
    }
  }

  .shortcut-container {
    font-size: 14px;
    color: #000;
    opacity: 0.65;
    font-weight: 400;

    .item-list-sf {
      width: 30px; /* Adjust the width as needed */
      height: auto; /* Maintain aspect ratio */
      margin: 5px;
      cursor: pointer;
    }
  }
}
.list-item {
  display: flex;
  flex-direction: row;
  align-items: center;
}

/* src/assets/base.scss or any global stylesheet */
.logo-svg .st01 {
  fill: #fff;
}
.icon-svg .st0 {
  fill: none;
}
.icon-svg .st1 {
  fill: #010101;
}

.logo-svg {
  width: 50px; /* Adjust the width as needed */
  height: auto; /* Maintain aspect ratio */
  margin: 20px 0px 0px 10px;
  /* Add other styles if needed */
}

.search-container {
  
  display: flex;
  align-items: center;
  width: 100%;
}

.search-outer{
  width: 500px;
}
.search-textarea {
  z-index: 4;
  width: 100%;
  padding: 8px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-sizing: border-box;
  resize: none;
  overflow: hidden;

  &::placeholder {
    font-size: 12px;
    color: #999;
    opacity: 1;
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
    margin-top: 0px;
    padding: 5px 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    background-color: #f0f0f0;
    display: flex;
    justify-content: space-between;
    cursor: pointer;
    transition: background-color 0.3s;
    user-select: none;
    &.active {
      background-color: #5d5d5d; /* Active button color */
      color: white;
    }

    &:hover {
      background-color: #1d1d1d30;
    }
  }
  
  .keyword-button {
    background-color: #eee;
    padding: 5px;
    cursor: pointer;

    &:hover {
      background-color: #1d1d1d30;
    }
  }
}

.items-container {
  width: 100%;
  height: 400px;
  overflow-y: auto;
  padding-right: 10px;
  display: grid;
  grid-template-columns: repeat(
    2,
    1fr
  ); /* Two equal-width columns by default */
  grid-gap: 15px;

  /* Media query for mobile devices */
  @media only screen and (max-width: 768px) {
    grid-template-columns: 1fr; /* Switch to one column on mobile */
  }
}
form {
  @media only screen and (max-width: 768) {
    width: 300px;
  }
}

.item-wrapper {
  margin-bottom: 20px;
  position: relative; /* To position the edit button */
}

.header-and-pen {
  display: flex;
  justify-content: space-between;
  align-items: center;
  word-wrap: break-word;
  width: 100%;
}
.item-card {
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 10px;
  font-size: 14px;
  width: 100%; /* Ensure the card takes up the full column width */
  box-sizing: border-box;

  .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    font-size: 16px;
    cursor: pointer;
    color: #323231;

    &:hover {
      color: #999;
    }
  }

  .accept-button {
    position: absolute;
    top: 25px;
    right: 9px;
    font-size: 16px;
    cursor: pointer;
    color: #323231;

    &:hover {
      color: #999;
    }
  }
}

.edit-button {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 16px;
  cursor: pointer;
  color: #323231;

  &:hover {
    color: #999;
  }
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
    border: 1px solid #ddd;
    border-radius: 4px;
    outline: none;
  }
}

.item-detail {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;

  .inputMen {
    width: calc(30%);
    height: min-content;
    font-size: 16px;
    padding: 5px;
    border: 1px solid #ddd;
    border-radius: 4px;
    outline: none;
  }
}

.item-detail span {
  font-size: 14px;
}

.item-actions {
  display: flex;
  justify-content: center;
}

.update-button {
  width: 100%;
  height: 2rem;
  font-size: 14px;
  line-height: 0rem;
  background-color: $base-primary;
  color: white;
  border: none;
  margin-top: 0px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    box-shadow: 0 2px 6px -1px rgba($base-primary, 0.65);
    background-color: mix(black, $base-primary, 10%);

    &:active {
      transform: translateY(-3px);
    }
  }
}
.add-button {
  width: 2rem; /* Set the width equal to the height */
  margin: 0 10px 0 10px;
  height: 2rem; /* Same as the search input height */
  display: flex;
  z-index: 5;
  justify-content: center;
  align-items: center;
  background-color: rgba($base-primary, 100); 
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: mix(black, rgba($base-primary,100), 5%);
  }
}

.floating-input {
  position: fixed;
  z-index: 1000;
  background-color: white;
  border: 1px solid #ccc;
  padding: 10px;
  border-radius: 5px;
}

.floating-input input {
  width: 50px;
  text-align: center;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 400px;
  text-align: center;
  position: relative; /* Needed for absolute positioning of the close button */

  button {
    margin: 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s ease;

    &:hover {
      background-color: mix(black, $base-primary, 10%);
    }
  }
}

.ModalGroup {
  display: inline-grid;
}
.CountGroup{
  display: flex !important;

  .CountInput{
    width: 40%;
  }
}


</style>
