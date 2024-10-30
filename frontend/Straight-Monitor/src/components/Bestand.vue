<template>
  <span></span>
  <h4>
    Straight
    <span><font-awesome-icon :icon="['fas', 'warehouse']" /> Bestand</span>
  </h4>
  <p>Benutzer: {{ userName }}</p>

  <!-- Suchleiste -->
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
        style="bottom: 95%"
      />
      <h4>Artikel hinzufügen</h4>

      <!-- Input fields with keyup.enter event -->
      <div class="ModalGroup">
        <label for="standort">Standort</label>
        <select
          class="standort-dropdown"
          v-model="newItem.standort"
          id="standort"
          @keyup.enter="submitNewItem"
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
          @keyup.enter="submitNewItem"
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
          @keyup.enter="submitNewItem"
        />
      </div>
      <div class="ModalGroup">
        <label for="anzahl">Anzahl</label>
        <input
          v-model="newItem.anzahl"
          id="anzahl"
          type="number"
          placeholder="Anzahl"
          min="0"
          @keyup.enter="submitNewItem"
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
            <strong v-if="!item.isEditing">{{ item.bezeichnung }}</strong>
            <input class="inputBez"
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
          <span>Menge:</span>
          <span v-if="!item.isEditing">{{ item.anzahl }}</span>
          <input class="inputMen"
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
      showAddModal: false, // Track if add modal is open
      modalOpen: false,
      mouseX: 0,
      mouseY: 0,
      selectedItem: null,
      items: [],
      newItem: {
        bezeichnung: "",
        groesse: "",
        anzahl: 0,
        standort: "",
      }, // Store new item data
      originalBezeichnung: "",
      originalAnzahl: 0,
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
      const searchWords = this.searchQuery
        .toLowerCase()
        .split(" ")
        .filter((word) => word);

      // Setting 'standort' based on searchWords
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

      // Filtering and capitalizing bezeichnung
      this.newItem.bezeichnung = searchWords
        .filter(
          (word) => !["hamburg", "köln", "berlin"].includes(word.toLowerCase())
        )
        .map(
          (word) =>
            word
              .split("-") // Split by hyphen
              .map(
                (part) =>
                  part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
              ) // Capitalize each part
              .join("-") // Join the parts back with a hyphen
        )
        .join(" "); // Join words with a space

      // Filtering and sorting items
      return this.items
        .filter((item) => {
          const itemData =
            `${item.bezeichnung} ${item.groesse} ${item.standort}`.toLowerCase();
          return searchWords.every((word) => itemData.includes(word));
        })
        .sort((a, b) => {
          // Priority 1: Standort
          if (a.standort.toLowerCase() < b.standort.toLowerCase()) return -1;
          if (a.standort.toLowerCase() > b.standort.toLowerCase()) return 1;

          // Priority 2: Bezeichnung
          if (a.bezeichnung.toLowerCase() < b.bezeichnung.toLowerCase())
            return -1;
          if (a.bezeichnung.toLowerCase() > b.bezeichnung.toLowerCase())
            return 1;

          // Priority 3: Groesse (Size)
          const sizeOrder = ["S", "M", "L", "XL", "XXL", "3XL"]; // Custom size order

          const aSize = a.groesse.trim();
          const bSize = b.groesse.trim();

          // Check if the sizes are numeric and compare them as numbers
          const aIsNumeric = !isNaN(aSize);
          const bIsNumeric = !isNaN(bSize);

          if (aIsNumeric && bIsNumeric) {
            return parseInt(aSize) - parseInt(bSize); // Numeric sorting
          }

          // If one is numeric and the other is not, prioritize the numeric one
          if (aIsNumeric) return -1;
          if (bIsNumeric) return 1;

          // If both are non-numeric, check for special size values like S, M, L, etc.
          const aIndex = sizeOrder.indexOf(aSize.toUpperCase());
          const bIndex = sizeOrder.indexOf(bSize.toUpperCase());

          // If both sizes are found in the custom size order, sort accordingly
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }

          // If one size is found and the other is not, prioritize the found one
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;

          // If neither is found, sort alphabetically as a fallback
          return aSize.localeCompare(bSize);
        });
    },
  },
  methods: {
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    enableEdit(item) {
      this.originalBezeichnung = item.bezeichnung;
      this.originalAnzahl = item.anzahl;
      item.isEditing = true;
    },
    cancelEdit(item) {
      item.bezeichnung = this.originalBezeichnung;
      item.anzahl = this.originalAnzahl;
      item.isEditing = false;
    },
    async updateItem(item) {
      
      if (item.bezeichnung === this.originalBezeichnung && item.anzahl === this.originalAnzahl) {
        return this.cancelEdit(item);
      }

      try {
       
        const response = await api.put(`/api/items/edit/${item._id}`, {
          userID: this.userID,
          bezeichnung: item.bezeichnung,
          anzahl: item.anzahl,
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
        console.error("Fehler beim Aktualisieren des Namens:", error);
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
      let { bezeichnung, groesse, anzahl, standort } = this.newItem;

      // Set 'groesse' to 'onesize' if it's empty or an empty string
      if (!groesse || groesse.trim() === "") {
        groesse = "onesize";
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
@import "@/assets/styles/dashboard.scss";

.search-container {
  display: flex;
  align-items: center;
  width: 100%;
  margin-bottom: 15px;
}

.search-textarea {
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

  .inputMen{
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
  background-color: $primary;
  color: white;
  border: none;
  margin-top: 0px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    box-shadow: 0 2px 6px -1px rgba($primary, 0.65);
    background-color: mix(black, $primary, 10%);

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
  justify-content: center;
  align-items: center;
  background-color: $primary;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: mix(black, $primary, 10%);
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
      background-color: mix(black, $primary, 10%);
    }
  }
}

.ModalGroup {
  display: inline-grid;
}
</style>
