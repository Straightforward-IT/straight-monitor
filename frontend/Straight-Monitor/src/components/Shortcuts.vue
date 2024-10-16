<template>
  <div class="shortcuts">
    <a class="discrete">.</a>
    <h4>Shortcuts</h4>

    <div class="shortcut-container">
      <span class="list-item">
        <img
          src="@/assets/SF_002.png"
          id="logi-paket"
          alt="Logo"
          class="item-list-sf"
          @click="openLogiPaketModal"
        />
        <label for="logi-paket">
          <p>Logi-Paket</p>
        </label>
      </span>
      <span class="list-item">
        <img
          src="@/assets/SF_002.png"
          id="service-paket"
          alt="Logo"
          class="item-list-sf inactive"
          @click="openServicePaketModal"
        />
        <label for="service-paket">
          <p>Service-Paket</p>
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
                <option value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
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
                <option value="XXL">XXL</option>
                <option value="3XL">3XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="dickiesStoffhoseChecked" />
                <span class="checkmark"></span>
                Dickies Stoffhose
              </label>
              <select
                v-model="dickiesStoffhoseSize"
                class="size-dropdown"
                :disabled="!dickiesStoffhoseChecked"
              >
                <option value="44">44</option>
                <option value="50">50</option>
                <option value="52">52</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="pulloverChecked" />
                <span class="checkmark"></span>
                Pullover
              </label>
              <select
                v-model="pulloverSize"
                class="size-dropdown"
                :disabled="!pulloverChecked"
              >
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          </span>
          <span class="list-item">
            <div class="checkbox-container">
              <label class="custom-checkbox">
                <input type="checkbox" v-model="bundhoseChecked" />
                <span class="checkmark"></span>
                Bundhose e.s. Motion 2020
              </label>
              <select
                v-model="bundhoseSize"
                class="size-dropdown"
                :disabled="!bundhoseChecked"
              >
                <option value="44">44</option>
                <option value="46">46</option>
                <option value="48">48</option>
                <option value="50">50</option>
                <option value="52">52</option>
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
                <option value="36">36</option>
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
              <select
                v-model="serviceHandschuheSize"
                class="size-dropdown"
                :disabled="!serviceHandschuheChecked"
              >
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </select>
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
import axios from "axios";

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
      token: localStorage.getItem('token') || null,
      showLogiModal: false,
      cuttermesserChecked: false,
      jutebeutelChecked: false,
      logistikHoseChecked: false,
      tshirt1Checked: false,
      tshirt2Checked: false,
      tshirt3Checked: false,
      schwarzeKapuzenjackeChecked: false,
      sicherheitshelmChecked: false,
      softshelljackeChecked: false,
      dickiesStoffhoseChecked: false,
      pulloverChecked: false,
      bundhoseChecked: false,
      sicherheitsschuheChecked: false,
      handschuheChecked: false,

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
      schwarzeSchuerzeChecked: true,
      kleidersackChecked: true,
      serviceHandschuheChecked: true,
      weisseHemdenDamenChecked: false,
      schwarzeHemdenDamenChecked: false,
      weisseHemdenHerrenChecked: false,
      schwarzeHemdenHerrenChecked: false,

      serviceHandschuheSize: "",
      weisseHemdenDamenSize: "",
      schwarzeHemdenDamenSize: "",
      weisseHemdenHerrenSize: "",
      schwarzeHemdenHerrenSize: "",

    };
  },
  mounted(){
    this.setAxiosAuthToken();
  },
  watch: {
    token(newToken){
      if (newToken) {
        localStorage.setItem('token', newToken);
      }else{
        localStorage.removeItem('token');
      }
    },
  methods: {
    setAxiosAuthToken(){
      axios.defaults.headers.common['x-auth-token'] = this.token;
    },
    openModal() {
      this.$emit("update-modal", true);
    },
    closeModal() {
      this.$emit("update-modal", false);
    },
    async openLogiPaketModal() {
      this.openModal();
      this.showLogiModal = true;
    },
    async openServicePaketModal() {
      this.openModal();
      this.showServiceModal = true;
    },
    resetLogiPaket(){

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
      this.dickiesStoffhoseChecked = false;
      this.pulloverChecked = false;
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
    resetServicePaket(){
      this.kellnermesserChecked = true;
      this.kugelschreiberChecked = true;
      this.namensschildChecked = true;
      this.feuerzeugChecked = true;
      this.schuhputzzeugChecked = true;
      this.schwarzeKrawatteChecked = true;
      this.schwarzeSchuerzeChecked = true;
      this.kleidersackChecked = true;
      this.serviceHandschuheChecked = true;
      this.weisseHemdenDamenChecked = false;
      this.schwarzeHemdenDamenChecked = false;
      this.weisseHemdenHerrenChecked = false;
      this.schwarzeHemdenHerrenChecked = false;

      this.serviceHandschuheSize = "";
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
        errorMessages.push("Bitte wählen Sie eine Größe für die Schwarze Kapuzenjacke.");
      }
      if (this.sicherheitshelmChecked && !this.sicherheitshelmArt) {
        errorMessages.push("Bitte wählen Sie eine Art für den Sicherheitshelm.");
      }
      if (this.softshelljackeChecked && !this.softshelljackeSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Softshelljacke.");
      }
      if (this.dickiesStoffhoseChecked && !this.dickiesStoffhoseSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Dickies Stoffhose.");
      }
      if (this.pulloverChecked && !this.pulloverSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für den Pullover.");
      }
      if (this.bundhoseChecked && !this.bundhoseSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Bundhose.");
      }
      if (this.sicherheitsschuheChecked && !this.sicherheitsschuheSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Sicherheitsschuhe.");
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
    validateServiceSelections(){
      const errorMessages = [];

      if (this.serviceHandschuheChecked && !this.serviceHandschuheSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Service Handschuhe.");
      }
      if (this.weisseHemdenDamenChecked && !this.weisseHemdenDamenSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Weißen Damen Hemden.");
      }
      if (this.schwarzeHemdenDamenChecked && !this.schwarzeHemdenDamenSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Schwarzen Damen Hemden.");
      }
      if (this.weisseHemdenHerrenChecked && !this.weisseHemdenHerrenSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Weißen Herren Hemden.");
      }
      if (this.schwarzeHemdenHerrenChecked && !this.schwarzeHemdenHerrenSize) {
        errorMessages.push("Bitte wählen Sie eine Größe für die Schwarzen Herren Hemden.");
      }

      if (errorMessages.length > 0) {
        alert(errorMessages.join("\n"));
        return false;
      }
      return true;
    },
    async updateMultiple(selections, count){
      if(this.token){

        // Filter out only the checked items
  const selectedItems = selections
    .filter((selection) => selection.checked)
    .map((selection) => ({ _id: selection._id, size: selection.size }));


        axios.put(
    "https://straight-monitor-684d4006140b.herokuapp.com/api/items/updateMultiple", { items: selectedItems, count })
    .then((response) => {
      console.log("Items updated successfully", response.data);
    }).then(() => {
      this.$emit("itemsUpdated");
    })
    .catch((error) => {
      console.error("Error updating items", error);
      console.log(selectedItems);
    });


      }else{
    console.error("No Token Found")
    router.push('/');
  }


    },
    submitLogiModal(action) {
      if (!this.validateLogiSelections()) {
        return;
      }
  // Define a map of selections
  const selections = [
    { checked: this.cuttermesserChecked, _id: "66f409272bd7b954e71ded84", size: "onesize" },
    { checked: this.jutebeutelChecked, _id: "66fbe89a6971ca198c0dd6f2", size: "onesize" },
    { checked: this.logistikHoseChecked, _id: this.getLogistikHoseId(), size: this.logistikHoseSize },
    { checked: this.tshirt1Checked, _id: this.getTShirtId(this.tshirt1Size), size: this.tshirt1Size },
    { checked: this.tshirt2Checked, _id: this.getTShirtId(this.tshirt2Size), size: this.tshirt2Size },
    { checked: this.tshirt3Checked, _id: this.getTShirtId(this.tshirt3Size), size: this.tshirt3Size },
    { checked: this.schwarzeKapuzenjackeChecked, _id: this.getKapuzenjackeId(this.schwarzeKapuzenjackeSize), size: this.schwarzeKapuzenjackeSize },
    { checked: this.sicherheitshelmChecked, _id: this.getSicherheitshelmId(this.sicherheitshelmArt), size: this.sicherheitshelmArt },
    { checked: this.softshelljackeChecked, _id: this.getSoftshelljackeId(this.softshelljackeSize), size: this.softshelljackeSize },
    { checked: this.dickiesStoffhoseChecked, _id: this.getDickiesStoffhoseId(this.dickiesStoffhoseSize), size: this.dickiesStoffhoseSize },
    { checked: this.pulloverChecked, _id: this.getPulloverId(this.pulloverSize), size: this.pulloverSize },
    { checked: this.bundhoseChecked, _id: this.getBundhoseId(this.bundhoseSize), size: this.bundhoseSize },
    { checked: this.sicherheitsschuheChecked, _id: this.getSicherheitsschuheId(this.sicherheitsschuheSize), size: this.sicherheitsschuheSize },
    { checked: this.handschuheChecked, _id: this.getHandschuheId(this.handschuheSize), size: this.handschuheSize },
  ];
// Determine count based on action
const count = action === "add" ? 1 : action === "remove" ? -1 : 0;

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
    { checked: this.kellnermesserChecked, _id: "66fc02a16eba044dba7612ed", size: "onesize" },
    { checked: this.kugelschreiberChecked, _id: "66fc02b36eba044dba7612f2", size: "onesize" },
    { checked: this.namensschildChecked, _id: "66fc02c16eba044dba7612f7", size: "onesize" },
    { checked: this.feuerzeugChecked, _id: "66fc02c76eba044dba7612fc", size: "onesize" },
    { checked: this.schuhputzzeugChecked, _id: "66fc02d36eba044dba761301", size: "onesize" },
    { checked: this.schwarzeKrawatteChecked, _id: "66fc02966eba044dba7612e8", size: "onesize" },
    { checked: this.schwarzeSchuerzeChecked, _id: "66fc02826eba044dba7612e3", size: "onesize" },
    { checked: this.kleidersackChecked, _id: "66fc02696eba044dba7612de", size: "onesize" },
    { checked: this.serviceHandschuheChecked, _id: this.getServiceHandschuheId(this.serviceHandschuheSize), size: this.serviceHandschuheSize },
    { checked: this.weisseHemdenDamenChecked, _id: this.getWeisseHemdenDamenId(this.weisseHemdenDamenSize), size: this.weisseHemdenDamenSize },
    { checked: this.schwarzeHemdenDamenChecked, _id: this.getSchwarzeHemdenDamenId(this.schwarzeHemdenDamenSize), size: this.schwarzeHemdenDamenSize },
    { checked: this.weisseHemdenHerrenChecked, _id: this.getWeisseHemdenHerrenId(this.weisseHemdenHerrenSize), size: this.weisseHemdenHerrenSize },
    { checked: this.schwarzeHemdenHerrenChecked, _id: this.getSchwarzeHemdenHerrenId(this.schwarzeHemdenHerrenSize), size: this.schwarzeHemdenHerrenSize },
  ];
    const count = action === "add" ? 1 : action === "remove" ? -1 : 0;

      this.updateMultiple(selections, count);
      this.closeModal();
      this.showServiceModal = false;
      this.resetServicePaket();
},

    getLogistikHoseId() {
      const hoseMap = {
        44: "66fbe9416971ca198c0dd709",
        46: "66fbec896eba044dba7610f8",
        48: "66fbeded6eba044dba761107",
        50: "66fbeb576eba044dba7610db",
        52: "66fbedf66eba044dba76110c",
      };
      return hoseMap[this.logistikHoseSize];
    },

    getTShirtId(size) {
      const tshirtMap = {
        S: "66fbee256eba044dba761111",
        M: "66fbee2e6eba044dba761116",
        L: "66fbef426eba044dba761127",
        XL: "66fbef5d6eba044dba76112c",
        XXL: "66fbef636eba044dba761131",
        "3XL": "66fbef786eba044dba761136",
      };
      return tshirtMap[size];
    },

    getKapuzenjackeId(size) {
      const kapuzenjackeMap = {
        S: "66fbf0316eba044dba761141",
        M: "66fbf0366eba044dba761146",
        L: "66fbf03b6eba044dba76114b",
        XL: "66fbf0436eba044dba761150",
        XXL: "66fbf04a6eba044dba761155",
        "3XL": "66fbf04f6eba044dba76115a",
      };
      return kapuzenjackeMap[size];
    },

    getSicherheitshelmId(art) {
      const helmMap = {
        Festis: "66fbf08e6eba044dba76115f",
        Normal: "66fbf0926eba044dba761164",
      };
      return helmMap[art];
    },

    getSoftshelljackeId(size) {
      const softshellMap = {
        S: "66fbf0b16eba044dba761169",
        M: "66fbf0b66eba044dba76116e",
        L: "66fbf0c96eba044dba761178",
        XL: "66fbf0d26eba044dba76117d",
        XXL: "66fbf0d76eba044dba761182",
        "3XL": "66fbf0db6eba044dba761187",
      };
      return softshellMap[size];
    },

    getDickiesStoffhoseId(size) {
      const dickiesMap = {
        44: "66fbf24b6eba044dba761198",
        50: "66fbf47a6eba044dba7611a9",
        52: "66fbf47f6eba044dba7611ae",
      };
      return dickiesMap[size];
    },

    getPulloverId(size) {
      const pulloverMap = {
        L: "66fbf4ca6eba044dba7611c2",
        XL: "66fbf53e6eba044dba7611dd",
      };
      return pulloverMap[size];
    },

    getBundhoseId(size) {
      const bundhoseMap = {
        44: "66fbf5bc6eba044dba7611ec",
        46: "66fbf5c66eba044dba7611f1",
        48: "66fbf5ca6eba044dba7611f6",
        50: "66fbf5cf6eba044dba7611fb",
        52: "66fbf5d26eba044dba761200",
      };
      return bundhoseMap[size];
    },

    getSicherheitsschuheId(size) {
      const schuheMap = {
        36: "66fbff256eba044dba76127b",
        37: "66fbff1d6eba044dba761276",
        38: "66fbff176eba044dba761271",
        39: "66fbff0f6eba044dba76126c",
        40: "66fbff086eba044dba761267",
        41: "66fbff006eba044dba761262",
        42: "66fbfeea6eba044dba76125d",
        43: "66fbfec36eba044dba761254",
        44: "66fbfeb36eba044dba76124f",
        45: "66fbfdeb6eba044dba761246",
        46: "66fbfdde6eba044dba761241",
        47: "66fbfcdb6eba044dba761234",
        48: "66fbfcb56eba044dba76122b",
      };
      return schuheMap[size];
    },

    getHandschuheId(size) {
      const handschuheMap = {
        8: "66fc01306eba044dba761284",
        9: "66fc013a6eba044dba761289",
        10: "66fc01456eba044dba76128e",
      };
      return handschuheMap[size];
    },
    //Service
    getServiceHandschuheId(size) {
      const handschuheMap = {
      8: "66fc02fe6eba044dba761306",
      9: "66fc03036eba044dba76130b",
      10: "66fc03076eba044dba761310",
    };
    return handschuheMap[size];
  },

  getWeisseHemdenDamenId(size) {
    const hemdenMap = {
      S: "66fc01d16eba044dba761293",
      M: "66fc01d86eba044dba761298",
      L: "66fc01dd6eba044dba76129d",
      XL: "66fc01e56eba044dba7612a2",
    };
    return hemdenMap[size];
  },

  getSchwarzeHemdenDamenId(size) {
    const hemdenMap = {
      S: "66fc01f66eba044dba7612a7",
      M: "66fc01f96eba044dba7612ac",
      L: "66fc01fc6eba044dba7612b1",
    };
    return hemdenMap[size];
  },

  getWeisseHemdenHerrenId(size) {
    const hemdenMap = {
      S: "66fc020a6eba044dba7612b6",
      M: "66fc020d6eba044dba7612bb",
      L: "66fc02116eba044dba7612c0",
      XL: "66fc02156eba044dba7612c5",
    };
    return hemdenMap[size];
  },

  getSchwarzeHemdenHerrenId(size) {
    const hemdenMap = {
      S: "66fc022f6eba044dba7612ca",
      M: "66fc02336eba044dba7612cf",
      L: "66fc02366eba044dba7612d4",
      XL: "66fc023b6eba044dba7612d9",
    };
    return hemdenMap[size];
  },

  },
}
}
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
  position: relative; /* Needed for absolute positioning of the close button */

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
