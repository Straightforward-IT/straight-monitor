<template>
  <div class="shortcuts">
    <a class="discrete">.</a>
    <h4>Shortcuts</h4>

    <div class="shortcut-container">
      <span class="list-item" @click="openLogiPaketModal()">
        <img
          src="@/assets/SF_002.png"
          id="logi-paket"
          alt="Logo"
          class="item-list-sf"
        />
        <label for="logi-paket">
          <p>Logi-Paket</p>
        </label>
      </span>
      <span class="list-item" @click="openServicePaketModal()">
        <img
          src="@/assets/SF_002.png"
          id="service-paket"
          alt="Logo"
          class="item-list-sf"
        />
        <label for="service-paket">
          <p>Service-Paket</p>
        </label>
      </span>
      <span class="list-item" @click="getExcel()">
        <img
          src="@/assets/SF_002.png"
          id="excel"
          alt="Logo"
          class="item-list-sf"
        />
        <label for="excel">
          <p>Excel</p>
        </label>
      </span>
    </div>

    <div v-if="showLogiModal" class="modal">
      <div class="modal-content">
        <font-awesome-icon
          class="close-modal"
          :icon="['fas', 'times']"
          @click="
            showLogiModal = false;
            closeModal();
          "
          style="bottom: 97%"
        />
        <h4>Logi-Paket</h4>

        <select v-model="selectedLocation" @change="updateItemMappings">
          <option value="Hamburg">Hamburg</option>
          <option value="Köln">Köln</option>
          <option value="Berlin">Berlin</option>
        </select>

        <div class="modalGroup">
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="cuttermesserChecked" />
                <span class="checkmark"></span>
                Cuttermesser
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="jutebeutelChecked" />
                <span class="checkmark"></span>
                Jutebeutel
              </label>
              <select
                v-model="jutebeutelArt"
                class="size-dropdown"
                :disabled="!jutebeutelChecked"
              >
                <option value="Gold">Gold</option>
                <option value="Weiß">Weiß</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="logistikHoseChecked" />
                <span class="checkmark"></span>
                Logistikhose
              </label>
              <select
                v-model="logistikHoseSize"
                class="size-dropdown"
                :disabled="!logistikHoseChecked"
                @focus="logistikHoseChecked = true"
              >
                <option value="44">44</option>
                <option value="46">46</option>
                <option value="48">48</option>
                <option value="50">50</option>
                <option value="52">52</option>
                <option value="54">54</option>
                <option value="56">56</option>
                <option v-if="selectedLocation === 'Berlin'" value="58">58</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="tshirt1Checked" />
                <span class="checkmark"></span>
                T-Shirt ( 1 )
              </label>
              <select
                v-model="tshirt1Size"
                class="size-dropdown"
                :disabled="!tshirt1Checked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="tshirt2Checked" />
                <span class="checkmark"></span>
                T-Shirt ( 2 )
              </label>
              <select
                v-model="tshirt2Size"
                class="size-dropdown"
                :disabled="!tshirt2Checked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="tshirt3Checked" />
                <span class="checkmark"></span>
                T-Shirt ( 3 )
              </label>
              <select
                v-model="tshirt3Size"
                class="size-dropdown"
                :disabled="!tshirt3Checked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schwarzeKapuzenjackeChecked" />
                <span class="checkmark"></span>
                Schwarze Kapuzenjacke
              </label>
              <select
                v-model="schwarzeKapuzenjackeSize"
                class="size-dropdown"
                :disabled="!schwarzeKapuzenjackeChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option v-if="selectedLocation != 'Berlin'" value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span v-if="selectedLocation === 'Hamburg'" class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="sicherheitshelmChecked" />
                <span class="checkmark"></span>
                Sicherheitshelm
              </label>
              <select
                v-model="sicherheitshelmArt"
                class="size-dropdown"
                :disabled="!sicherheitshelmChecked"
              >
                <option value="Festis">Festis</option>
                <option value="Normal">Normal</option>
              </select>
            </div>
          </span>
          <h5>Optional</h5>
          <hr />

          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="softshelljackeChecked" />
                <span class="checkmark"></span>
                Softshelljacke
              </label>
              <select
                v-model="softshelljackeSize"
                class="size-dropdown"
                :disabled="!softshelljackeChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option v-if="selectedLocation != 'Berlin'" value="XXL">XXL</option>
                <option v-if="selectedLocation != 'Berlin'" value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="bundhoseChecked" />
                <span class="checkmark"></span>
                Bundhose E.S. Motion 2020
              </label>
              <select
                v-model="bundhoseSize"
                class="size-dropdown"
                :disabled="!bundhoseChecked"
              >
                
                <option v-if="selectedLocation != 'Hamburg'" value="44">44</option>
                <option value="46">46</option>
                <option value="48">48</option>
                <option value="50">50</option>
                <option value="52">52</option>
                <option value="54">54</option>
                <option v-if="selectedLocation != 'Hamburg'" value="56">56</option>
                <option v-if="selectedLocation === 'Berlin'" value="58">58</option>
              </select>
            </div>
          </span>
          <h5>Bezahlt</h5>
          <hr />
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="sicherheitsschuheChecked" />
                <span class="checkmark"></span>
                Sicherheitsschuhe
              </label>
              <select
                v-model="sicherheitsschuheSize"
                class="size-dropdown"
                :disabled="!sicherheitsschuheChecked"
              >
                <option v-if="selectedLocation != Köln" value="36">36</option>
                <option value="37">37</option>
                <option value="38">38</option>
                <option value="39">39</option>
                <option value="40">40</option>
                <option value="41">41</option>
                <option value="42">42</option>
                <option value="43">43</option>
                <option value="44">44</option>
                <option value="45">45</option>
                <option value="46">46</option>
                <option value="47">47</option>
                <option value="48">48</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="handschuheChecked" />
                <span class="checkmark"></span>
                Handschuhe
              </label>
              <select
                v-model="handschuheSize"
                class="size-dropdown"
                :disabled="!handschuheChecked"
              >
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </select>
            </div>
          </span>
          <div class="item-actions">
            <button @click="submitLogiModal('add')">Rückgabe</button>
            <button @click="submitLogiModal('remove')">Entnahme</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showServiceModal" class="modal">
      <div class="modal-content">
        <font-awesome-icon
          class="close-modal"
          :icon="['fas', 'times']"
          @click="
            showServiceModal = false;
            closeModal();
          "
          style="bottom: 97%"
        />
        <h4>Service-Paket</h4>

        <select v-model="selectedLocation" @change="updateItemMappings">
          <option value="Hamburg">Hamburg</option>
          <option value="Köln">Köln</option>
          <option value="Berlin">Berlin</option>
        </select>

        <div class="modalGroup">
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="kellnermesserChecked" />
                <span class="checkmark"></span>
                Kellnermesser
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="kugelschreiberChecked" />
                <span class="checkmark"></span>
                Kugelschreiber
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="namensschildChecked" />
                <span class="checkmark"></span>
                Namensschild
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="feuerzeugChecked" />
                <span class="checkmark"></span>
                Feuerzeug
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schuhputzzeugChecked" />
                <span class="checkmark"></span>
                Schuhputzzeug
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schwarzeKrawatteChecked" />
                <span class="checkmark"></span>
                Schwarze Krawatte
              </label>
            </div>
          </span>
          <span v-if="selectedLocation === 'Berlin' " class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schwarzeFliegeChecked" />
                <span class="checkmark"></span>
                Schwarze Fliege
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schwarzeSchuerzeChecked" />
                <span class="checkmark"></span>
                Schwarze Schürze
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="kleidersackChecked" />
                <span class="checkmark"></span>
                Kleidersack
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="serviceHandschuheChecked" />
                <span class="checkmark"></span>
                Service Handschuhe
              </label>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="weisseHemdenDamenChecked" />
                <span class="checkmark"></span>
                Weiße Hemden Damen
              </label>
              <select
                v-model="weisseHemdenDamenSize"
                class="size-dropdown"
                :disabled="!weisseHemdenDamenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schwarzeHemdenDamenChecked" />
                <span class="checkmark"></span>
                Schwarze Hemden Damen
              </label>
              <select
                v-model="schwarzeHemdenDamenSize"
                class="size-dropdown"
                :disabled="!schwarzeHemdenDamenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="weisseHemdenHerrenChecked" />
                <span class="checkmark"></span>
                Weiße Hemden Herren
              </label>
              <select
                v-model="weisseHemdenHerrenSize"
                class="size-dropdown"
                :disabled="!weisseHemdenHerrenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="schwarzeHemdenHerrenChecked" />
                <span class="checkmark"></span>
                Schwarze Hemden Herren
              </label>
              <select
                v-model="schwarzeHemdenHerrenSize"
                class="size-dropdown"
                :disabled="!schwarzeHemdenHerrenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          </span>
          <div class="item-actions">
            <button @click="submitServiceModal('add')">Rückgabe</button>
            <button @click="submitServiceModal('remove')">Entnahme</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import itemMappings from "@/assets/ItemMappings.json";

export default {
  name: "Shortcuts",
  emits: ["update-modal", "itemsUpdated"],
  components: {
    FontAwesomeIcon,
  },
  props: {
    isModalOpen: Boolean,
  },
  data() {
    return {
      token: localStorage.getItem("token") || null,
      anmerkung: "",
      userID: "",
      userLocation: "",
      selectedLocation: this.userLocation,
      items: itemMappings[this.userLocation],
      showLogiModal: false,
      cuttermesserChecked: true,
      jutebeutelChecked: true,
      logistikHoseChecked: true,
      tshirt1Checked: true,
      tshirt2Checked: true,
      tshirt3Checked: false,
      schwarzeKapuzenjackeChecked: true,
      sicherheitshelmChecked: false,
      softshelljackeChecked: false,
      bundhoseChecked: false,
      sicherheitsschuheChecked: false,
      handschuheChecked: false,

      jutebeutelArt: "",
      logistikHoseSize: "",
      tshirt1Size: "",
      tshirt2Size: "",
      tshirt3Size: "",
      schwarzeKapuzenjackeSize: "",
      sicherheitshelmArt: "",
      softshelljackeSize: "",
      dickiesStoffhoseSize: "",
      pulloverSize: "",
      bundhoseSize: "",
      sicherheitsschuheSize: "",
      handschuheSize: "",

      showServiceModal: false,

      kellnermesserChecked: true,
      kugelschreiberChecked: true,
      namensschildChecked: true,
      feuerzeugChecked: true,
      schuhputzzeugChecked: true,
      schwarzeKrawatteChecked: true,
      schwarzeFliegeChecked: false,
      schwarzeSchuerzeChecked: true,
      kleidersackChecked: true,
      serviceHandschuheChecked: true,
      weisseHemdenDamenChecked: false,
      schwarzeHemdenDamenChecked: false,
      weisseHemdenHerrenChecked: false,
      schwarzeHemdenHerrenChecked: false,

      weisseHemdenDamenSize: "",
      schwarzeHemdenDamenSize: "",
      weisseHemdenHerrenSize: "",
      schwarzeHemdenHerrenSize: "",
    };
  },

  watch: {
    token(newToken) {
      if (newToken) {
        localStorage.setItem("token", newToken);
      } else {
        localStorage.removeItem("token");
      }
    },
  },
  methods: {
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get("/api/users/me", {});
          this.userID = response.data._id;
          this.userLocation = response.data.location;
        } catch (error) {
          console.error("Error fetching user data:", error);
          this.$router.push("/");
        }
      } else {
        console.error("No token found");
        this.$router.push("/");
      }
    },
    updateItemMappings() {
      this.items = itemMappings[this.selectedLocation];
    },
    // Simplified logic to fetch item IDs based on new JSON format
    getItemId(category, subcategory = null) {
      if (!this.items || !this.items[category]) {
        console.warn(`No mapping found for category: ${category}`);
        return null;
      }
      if (subcategory && !this.items[category][subcategory]) {
        console.warn(
          `No mapping found for subcategory: ${subcategory} in category: ${category}`
        );
        return null;
      }
      return subcategory
        ? this.items[category][subcategory]
        : this.items[category];
    },
    async getExcel() {
      if (this.token) {
        try {
          const response = await api.get("/api/items/getExcel", {
            responseType: "blob",
          });

          const blob = new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });

          const link = document.createElement("a");
          const url = window.URL.createObjectURL(blob);
          link.href = url;
          link.download = "items.xlsx";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Error downloading the Excel file:", error);
        }
      }
    },
    openModal() {
      console.log("called");
      this.$emit("update-modal", true);

      if (this.userLocation === "Berlin" || this.userLocation === "Köln") {
        alert(
          "Achtung! Für deinen Standort müssen die Gegenstände erst hinzugefügt werden."
        );
      }
    },
    closeModal() {
      this.$emit("update-modal", false);
    },
    openLogiPaketModal() {
      this.openModal();
      this.showLogiModal = true;
    },
    openServicePaketModal() {
      this.openModal();
      this.showServiceModal = true;
    },
    resetLogiPaket() {
      this.anmerkung = "";

      this.showLogiModal = false;
      this.cuttermesserChecked = false;
      this.jutebeutelChecked = false;
      this.logistikHoseChecked = false;
      this.tshirt1Checked = false;
      this.tshirt2Checked = false;
      this.tshirt3Checked = false;
      this.schwarzeKapuzenjackeChecked = false;
      this.sicherheitshelmChecked = false;
      this.softshelljackeChecked = false;
      this.bundhoseChecked = false;
      this.sicherheitsschuheChecked = false;
      this.handschuheChecked = false;

      this.logistikHoseSize = "";
      this.tshirt1Size = "";
      this.tshirt2Size = "";
      this.tshirt3Size = "";
      this.schwarzeKapuzenjackeSize = "";
      this.sicherheitshelmArt = "";
      this.softshelljackeSize = "";
      this.dickiesStoffhoseSize = "";
      this.pulloverSize = "";
      this.bundhoseSize = "";
      this.sicherheitsschuheSize = "";
      this.handschuheSize = "";
    },
    resetServicePaket() {
      this.anmerkung = "";

      this.kellnermesserChecked = true;
      this.kugelschreiberChecked = true;
      this.namensschildChecked = true;
      this.feuerzeugChecked = true;
      this.schuhputzzeugChecked = true;
      this.schwarzeKrawatteChecked = true;
      this.schwarzeFliegeChecked = false;
      this.schwarzeSchuerzeChecked = true;
      this.kleidersackChecked = true;
      this.serviceHandschuheChecked = true;
      this.weisseHemdenDamenChecked = false;
      this.schwarzeHemdenDamenChecked = false;
      this.weisseHemdenHerrenChecked = false;
      this.schwarzeHemdenHerrenChecked = false;

      this.weisseHemdenDamenSize = "";
      this.schwarzeHemdenDamenSize = "";
      this.weisseHemdenHerrenSize = "";
      this.schwarzeHemdenHerrenSize = "";
    },

    // Validation method to check if all required dropdowns are selected
    validateLogiSelections() {
      const errorMessages = [];

      if (this.logistikHoseChecked && !this.logistikHoseSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Logistikhose.");
      }
      if (this.tshirt1Checked && !this.tshirt1Size) {
        errorMessages.push("Bitte wählen Sie eine Größe für das T-Shirt (1).");
      }
      if (this.tshirt2Checked && !this.tshirt2Size) {
        errorMessages.push("Bitte wählen Sie eine Größe für das T-Shirt (2).");
      }
      if (this.tshirt3Checked && !this.tshirt3Size) {
        errorMessages.push("Bitte wählen Sie eine Größe für das T-Shirt (3).");
      }
      if (this.schwarzeKapuzenjackeChecked && !this.schwarzeKapuzenjackeSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Schwarze Kapuzenjacke."
        );
      }
      if (this.sicherheitshelmChecked && !this.sicherheitshelmArt) {
        errorMessages.push(
          "Bitte wählen Sie eine Art für den Sicherheitshelm."
        );
      }
      if (this.softshelljackeChecked && !this.softshelljackeSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Softshelljacke."
        );
      }
      if (this.bundhoseChecked && !this.bundhoseSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Bundhose.");
      }
      if (this.sicherheitsschuheChecked && !this.sicherheitsschuheSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Sicherheitsschuhe."
        );
      }
      if (this.handschuheChecked && !this.handschuheSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Handschuhe.");
      }

      if (errorMessages.length > 0) {
        alert(errorMessages.join("\n"));
        return false;
      }
      return true;
    },
    validateServiceSelections() {
      const errorMessages = [];

      if (this.weisseHemdenDamenChecked && !this.weisseHemdenDamenSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Weißen Damen Hemden."
        );
      }
      if (this.schwarzeHemdenDamenChecked && !this.schwarzeHemdenDamenSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Schwarzen Damen Hemden."
        );
      }
      if (this.weisseHemdenHerrenChecked && !this.weisseHemdenHerrenSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Weißen Herren Hemden."
        );
      }
      if (this.schwarzeHemdenHerrenChecked && !this.schwarzeHemdenHerrenSize) {
        errorMessages.push(
          "Bitte wählen Sie eine Größe für die Schwarzen Herren Hemden."
        );
      }

      if (errorMessages.length > 0) {
        alert(errorMessages.join("\n"));
        return false;
      }
      return true;
    },
    async updateMultiple(selections, count) {
      if (this.token) {
        // Filter out only the checked items
        const selectedItems = selections
          .filter((selection) => selection.checked)
          .map((selection) => ({ _id: selection._id, size: selection.size }));

        api
          .put("/api/items/updateMultiple", {
            userID: this.userID,
            items: selectedItems,
            count,
            anmerkung: this.anmerkung,
          })
          .then((response) => {
            console.log("Items updated successfully", response.data);
          })
          .then(() => {
            this.$emit("itemsUpdated");
          })
          .catch((error) => {
            console.error("Error updating items", error);
            console.log(selectedItems);
          });
      } else {
        console.error("No Token Found");
        router.push("/");
      }
    },
    submitLogiModal(action) {
      if (!this.validateLogiSelections()) {
        return;
      }
      const selections = [
  {
    bezeichnung: "Cuttermesser",
    checked: this.cuttermesserChecked,
    _id: this.getItemId("cuttermesser"),
    size: "onesize",
  },
  {
    bezeichnung: "Jutebeutel",
    checked: this.jutebeutelChecked,
    _id: this.getItemId("jutebeutel", this.jutebeutelArt),
    size: this.jutebeutelArt,
  },
  {
    bezeichnung: "Logistik Hose",
    checked: this.logistikHoseChecked,
    _id: this.getItemId("logistikHose", this.logistikHoseSize),
    size: this.logistikHoseSize,
  },
  {
    bezeichnung: "T-Shirt (1)",
    checked: this.tshirt1Checked,
    _id: this.getItemId("tshirt", this.tshirt1Size),
    size: this.tshirt1Size,
  },
  {
    bezeichnung: "T-Shirt (2)",
    checked: this.tshirt2Checked,
    _id: this.getItemId("tshirt", this.tshirt2Size),
    size: this.tshirt2Size,
  },
  {
    bezeichnung: "T-Shirt (3)",
    checked: this.tshirt3Checked,
    _id: this.getItemId("tshirt", this.tshirt3Size),
    size: this.tshirt3Size,
  },
  {
    bezeichnung: "Schwarze Kapuzenjacke",
    checked: this.schwarzeKapuzenjackeChecked,
    _id: this.getItemId("kapuzenjacke", this.schwarzeKapuzenjackeSize),
    size: this.schwarzeKapuzenjackeSize,
  },
  {
    bezeichnung: "Sicherheitshelm",
    checked: this.sicherheitshelmChecked,
    _id: this.getItemId("sicherheitshelm", this.sicherheitshelmArt),
    size: this.sicherheitshelmArt,
  },
  {
    bezeichnung: "Softshelljacke",
    checked: this.softshelljackeChecked,
    _id: this.getItemId("softshelljacke", this.softshelljackeSize),
    size: this.softshelljackeSize,
  },
  {
    bezeichnung: "Bundhose",
    checked: this.bundhoseChecked,
    _id: this.getItemId("bundhose", this.bundhoseSize),
    size: this.bundhoseSize,
  },
  {
    bezeichnung: "Sicherheitsschuhe",
    checked: this.sicherheitsschuheChecked,
    _id: this.getItemId("sicherheitsschuhe", this.sicherheitsschuheSize),
    size: this.sicherheitsschuheSize,
  },
  {
    bezeichnung: "Handschuhe",
    checked: this.handschuheChecked,
    _id: this.getItemId("handschuhe", this.handschuheSize),
    size: this.handschuheSize,
  },
];

// Check for invalid items
const invalidItems = selections.filter(
  (selection) => selection.checked && !selection._id
);

if (invalidItems.length > 0) {
  alert(
    `Folgende Items konnten nicht gefunden werden:\n${invalidItems
      .map((item) => `${item.bezeichnung} (Größe: ${item.size || "?"})`)
      .join("\n")}`
  );
  return;
}


      const count = action === "add" ? 1 : action === "remove" ? -1 : 0;

      this.anmerkung = "Logistik-Paket: ".concat(this.anmerkung);
      this.updateMultiple(selections, count);
      this.closeModal();
      this.showLogiModal = false;
      this.resetLogiPaket();
    },
    submitServiceModal(action) {
      if (!this.validateServiceSelections()) {
        return;
      }
      const selections = [
        {
          checked: this.kellnermesserChecked,
          _id: this.getItemId("kellnermesser"),
          size: "onesize",
        },
        {
          checked: this.kugelschreiberChecked,
          _id: this.getItemId("kugelschreiber"),
          size: "onesize",
        },
        {
          checked: this.namensschildChecked,
          _id: this.getItemId("namensschild"),
          size: "onesize",
        },
        {
          checked: this.feuerzeugChecked,
          _id: this.getItemId("feuerzeug"),
          size: "onesize",
        },
        {
          checked: this.schuhputzzeugChecked,
          _id: this.getItemId("schuhputzzeug"),
          size: "onesize",
        },
        {
          checked: this.schwarzeKrawatteChecked,
          _id: this.getItemId("schwarzeKrawatte"),
          size: "onesize",
        },
        {
          checked: this.schwarzeFliegeChecked,
          _id: this.getItemId("schwarzeFliege"),
          size: "onesize",
        },
        {
          checked: this.schwarzeSchuerzeChecked,
          _id: this.getItemId("schwarzeSchuerze"),
          size: "onesize",
        },
        {
          checked: this.kleidersackChecked,
          _id: this.getItemId("kleidersack"),
          size: "onesize",
        },
        {
          checked: this.serviceHandschuheChecked,
          _id: this.getItemId("serviceHandschuhe"),
          size: "onesize",
        },
        {
          checked: this.weisseHemdenDamenChecked,
          _id: this.getItemId("weisseHemdenDamen", this.weisseHemdenDamenSize),
          size: this.weisseHemdenDamenSize,
        },
        {
          checked: this.schwarzeHemdenDamenChecked,
          _id: this.getItemId(
            "schwarzeHemdenDamen",
            this.schwarzeHemdenDamenSize
          ),
          size: this.schwarzeHemdenDamenSize,
        },
        {
          checked: this.weisseHemdenHerrenChecked,
          _id: this.getItemId(
            "weisseHemdenHerren",
            this.weisseHemdenHerrenSize
          ),
          size: this.weisseHemdenHerrenSize,
        },
        {
          checked: this.schwarzeHemdenHerrenChecked,
          _id: this.getItemId(
            "schwarzeHemdenHerren",
            this.schwarzeHemdenHerrenSize
          ),
          size: this.schwarzeHemdenHerrenSize,
        },
      ];
      // Filter out invalid selections
      const validSelections = selections.filter(
        (selection) => selection.checked && selection._id
      );

      if (validSelections.length === 0) {
        alert("No valid items selected.");
        return;
      }

      const count = action === "add" ? 1 : action === "remove" ? -1 : 0;

      this.anmerkung = "Service-Paket: ".concat(this.anmerkung);
      this.updateMultiple(selections, count);
      this.closeModal();
      this.showServiceModal = false;
      this.resetServicePaket();
    },
  },
  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    this.updateItemMappings();
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/dashboard.scss";

.discrete {
  color: transparent;
  cursor: default;
}
h4 {
  z-index: 1;
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
  padding: 30px;
  border-radius: 8px;
  width: 350px;
  text-align: center;
  position: relative;

  .item-actions {
    display: flex;
    justify-content: center;
  }

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

.checkbox-container {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Space between label/checkbox and dropdown */
  width: 100%; /* Ensure the container spans the full width */
}
.list-item {
  margin-bottom: 10px;
  height: 31px;
}
/* Align checkbox and label to the left */
.custom-checkbox {
  display: flex;
  align-items: center;
  font-size: 14px;
  cursor: pointer;
  margin-right: 10px;
  flex-grow: 1; /* Ensure the checkbox and label take up available space */
}

/* Hide the default checkbox */
.custom-checkbox input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

input {
  width: auto;
}

/* Create a custom checkmark */
.custom-checkbox .checkmark {
  position: relative;
  height: 20px;
  width: 20px;
  background-color: #ccc;
  border-radius: 4px;
  transition: 0.2s;
  margin-right: 10px;
}

/* Checkmark when the checkbox is checked */
.custom-checkbox input:checked + .checkmark {
  background-color: $primary;
}

/* Checkmark icon */
.custom-checkbox .checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

/* Display the checkmark when the checkbox is checked */
.custom-checkbox input:checked + .checkmark:after {
  display: block;
}

/* Checkmark (tick) style */
.custom-checkbox .checkmark:after {
  left: 6px;
  top: 3px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Dropdown aligned to the right */
.size-dropdown {
  text-align: right;
  margin-left: auto; /* Push the dropdown to the right */
  padding: 5px;
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
}

hr {
  margin: 10px 0;
}
</style>
