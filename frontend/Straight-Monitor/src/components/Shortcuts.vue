<template>
  <div class="shortcuts">
    <div class="shortcuts-header">
      <h4>Shortcuts</h4>
      <button class="close-btn" @click="ui.close()">
        <font-awesome-icon :icon="['fas', 'times']" />
      </button>
    </div>

    <div class="actions">
      <button class="s-btn" @click="openLogiPaketModal">
        <img :src="logoSrc" alt="" />
        <span>Logi-Paket</span>
      </button>

      <button class="s-btn" @click="openServicePaketModal">
        <img :src="logoSrc" alt="" />
        <span>Service-Paket</span>
      </button>

      <button class="s-btn" @click="openBestandsUpdateModal">
        <img :src="logoSrc" alt="" />
        <span>Bestands-Update senden</span>
      </button>

      <button class="s-btn" :disabled="downloading" @click="getExcel">
        <img :src="logoSrc" alt="" />
        <span v-if="!downloading">Excel</span>
        <span v-else>Lädt…</span>
      </button>
    </div>

    <!-- LOGI MODAL -->
    <teleport to="body">
      <div v-if="showLogiModal" class="modal" @click.self="closeAllModals">
        <div class="modal-content">
          <font-awesome-icon
            class="close"
            :icon="['fas', 'times']"
            @click="closeAllModals"
          />

          <h4>Logi-Paket</h4>

          <div class="modal-scrollable">
            <label class="select-label">
              Standort
              <select v-model="selectedLocation">
                <option value="Hamburg">Hamburg</option>
                <option value="Köln">Köln</option>
                <option value="Berlin">Berlin</option>
              </select>
            </label>

            <div class="grid">
            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="cuttermesserChecked" />
                <span>Cuttermesser</span>
              </span>
              <select class="sel" disabled>
                <option>onesize</option>
              </select>
            </label>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="jutebeutelChecked" />
                <span>Jutebeutel</span>
              </span>
              <select
                class="sel"
                v-model="jutebeutelArt"
                :disabled="!jutebeutelChecked"
              >
                <option value="Gold">Gold</option>
                <option value="Weiß">Weiß</option>
              </select>
            </label>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="logistikHoseChecked" />
                <span>Logistikhose</span>
              </span>
              <select
                class="sel"
                v-model="logistikHoseSize"
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
                <option v-if="selectedLocation === 'Berlin'" value="58">
                  58
                </option>
              </select>
            </label>

            <label class="row" v-for="n in 3" :key="'t' + n">
              <span class="chk">
                <input type="checkbox" v-model="tshirtChecked[n - 1]" />
                <span>T-Shirt ({{ n }})</span>
              </span>
              <select
                class="sel"
                v-model="tshirtSize[n - 1]"
                :disabled="!tshirtChecked[n - 1]"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="3XL">3XL</option>
              </select>
            </label>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="schwarzeKapuzenjackeChecked" />
                <span>Schwarze Kapuzenjacke</span>
              </span>
              <select
                class="sel"
                v-model="schwarzeKapuzenjackeSize"
                :disabled="!schwarzeKapuzenjackeChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option v-if="selectedLocation !== 'Berlin'" value="3XL">
                  3XL
                </option>
              </select>
            </label>

            <label
              v-if="
                selectedLocation === 'Hamburg' || selectedLocation === 'Berlin'
              "
              class="row"
            >
              <span class="chk">
                <input type="checkbox" v-model="sicherheitshelmChecked" />
                <span>Sicherheitshelm</span>
              </span>
              <select
                class="sel"
                v-model="sicherheitshelmArt"
                :disabled="!sicherheitshelmChecked"
              >
                <option v-if="selectedLocation === 'Hamburg'" value="Festis">
                  Festis
                </option>
                <option value="Normal">Normal</option>
              </select>
            </label>

            <h5 class="sub">Optional</h5>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="softshelljackeChecked" />
                <span>Softshelljacke</span>
              </span>
              <select
                class="sel"
                v-model="softshelljackeSize"
                :disabled="!softshelljackeChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option v-if="selectedLocation !== 'Berlin'" value="XXL">
                  XXL
                </option>
                <option v-if="selectedLocation !== 'Berlin'" value="3XL">
                  3XL
                </option>
              </select>
            </label>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="bundhoseChecked" />
                <span>Bundhose E.S. Motion 2020</span>
              </span>
              <select
                class="sel"
                v-model="bundhoseSize"
                :disabled="!bundhoseChecked"
              >
                <option v-if="selectedLocation !== 'Hamburg'" value="44">
                  44
                </option>
                <option value="46">46</option>
                <option value="48">48</option>
                <option value="50">50</option>
                <option value="52">52</option>
                <option value="54">54</option>
                <option v-if="selectedLocation !== 'Hamburg'" value="56">
                  56
                </option>
                <option v-if="selectedLocation === 'Berlin'" value="58">
                  58
                </option>
              </select>
            </label>

            <h5 class="sub">Bezahlt</h5>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="sicherheitsschuheChecked" />
                <span>Sicherheitsschuhe</span>
              </span>
              <select
                class="sel"
                v-model="sicherheitsschuheSize"
                :disabled="!sicherheitsschuheChecked"
              >
                <option v-if="selectedLocation !== 'Köln'" value="36">
                  36
                </option>
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
            </label>

            <label class="row">
              <span class="chk">
                <input type="checkbox" v-model="handschuheChecked" />
                <span>Handschuhe</span>
              </span>
              <select
                class="sel"
                v-model="handschuheSize"
                :disabled="!handschuheChecked"
              >
                <option value="8">8</option>
                <option value="9">9</option>
                <option value="10">10</option>
              </select>
            </label>
          </div>

          <label class="full">
            Anmerkung
            <input
              type="text"
              placeholder="Anmerkung (optional)"
              v-model="anmerkung"
            />
          </label>
        </div>
        
        <!-- Fixed Buttons Outside Modal Content -->
        <div class="modal-buttons">
          <button @click="submitLogiModal('add')">Rückgabe</button>
          <button @click="submitLogiModal('remove')">Entnahme</button>
        </div>
      </div>
      </div>
    </teleport>

    <!-- SERVICE MODAL -->
    <teleport to="body">
      <div v-if="showServiceModal" class="modal" @click.self="closeAllModals">
        <div class="modal-content">
          <font-awesome-icon
            class="close"
            :icon="['fas', 'times']"
            @click="closeAllModals"
          />

          <h4>Service-Paket</h4>

          <div class="modal-scrollable">
            <label class="select-label">
              Standort
              <select v-model="selectedLocation">
                <option value="Hamburg">Hamburg</option>
                <option value="Köln">Köln</option>
                <option value="Berlin">Berlin</option>
              </select>
            </label>

            <div class="grid">
            <label class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="kellnermesserChecked" /><span
                  >Kellnermesser</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label v-if="selectedLocation === 'Hamburg'" class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="kellnerblockChecked" /><span
                  >Kellnerblock</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="kugelschreiberChecked" /><span
                  >Kugelschreiber</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="namensschildChecked" /><span
                  >Namensschild</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="feuerzeugChecked" /><span
                  >Feuerzeug</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="schuhputzzeugChecked" /><span
                  >Schuhputzzeug</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input
                  type="checkbox"
                  v-model="schwarzeKrawatteChecked"
                /><span>Schwarze Krawatte</span></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label v-if="selectedLocation === 'Berlin'" class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="schwarzeFliegeChecked" /><span
                  >Schwarze Fliege</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input
                  type="checkbox"
                  v-model="schwarzeSchuerzeChecked"
                /><span>Schwarze Schürze</span></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input type="checkbox" v-model="kleidersackChecked" /><span
                  >Kleidersack</span
                ></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >
            <label class="row"
              ><span class="chk"
                ><input
                  type="checkbox"
                  v-model="serviceHandschuheChecked"
                /><span>Service Handschuhe</span></span
              ><select class="sel" disabled>
                <option>onesize</option>
              </select></label
            >

            <label class="row">
              <span class="chk"
                ><input
                  type="checkbox"
                  v-model="weisseHemdenDamenChecked"
                /><span>Weiße Hemden Damen</span></span
              >
              <select
                class="sel"
                v-model="weisseHemdenDamenSize"
                :disabled="!weisseHemdenDamenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </label>

            <label class="row">
              <span class="chk"
                ><input
                  type="checkbox"
                  v-model="schwarzeHemdenDamenChecked"
                /><span>Schwarze Hemden Damen</span></span
              >
              <select
                class="sel"
                v-model="schwarzeHemdenDamenSize"
                :disabled="!schwarzeHemdenDamenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </label>

            <label class="row">
              <span class="chk"
                ><input
                  type="checkbox"
                  v-model="weisseHemdenHerrenChecked"
                /><span>Weiße Hemden Herren</span></span
              >
              <select
                class="sel"
                v-model="weisseHemdenHerrenSize"
                :disabled="!weisseHemdenHerrenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </label>

            <label class="row">
              <span class="chk"
                ><input
                  type="checkbox"
                  v-model="schwarzeHemdenHerrenChecked"
                /><span>Schwarze Hemden Herren</span></span
              >
              <select
                class="sel"
                v-model="schwarzeHemdenHerrenSize"
                :disabled="!schwarzeHemdenHerrenChecked"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </label>
          </div>

          <label class="full">
            Anmerkung
            <input
              type="text"
              placeholder="Anmerkung (optional)"
              v-model="anmerkung"
            />
          </label>
        </div>
        
        <!-- Fixed Buttons Outside Modal Content -->
        <div class="modal-buttons">
          <button @click="submitServiceModal('add')">Rückgabe</button>
          <button @click="submitServiceModal('remove')">Entnahme</button>
        </div>
      </div>
      </div>
    </teleport>

    <!-- BESTAND UPDATE MODAL -->
    <teleport to="body">
      <div
        v-if="showBestandUpdateModal"
        class="modal"
        @click.self="closeAllModals"
      >
        <div class="modal-content">
          <font-awesome-icon
            class="close"
            :icon="['fas', 'times']"
            @click="closeAllModals"
          />

          <h4>Bestands-Update senden</h4>

          <div class="form-group">
            <label>
              Standort
              <select v-model="inventoryLocation">
                <option value="all">Alle Standorte</option>
                <option value="Hamburg">Hamburg</option>
                <option value="Berlin">Berlin</option>
                <option value="Köln">Köln</option>
              </select>
            </label>

            <label>
              E-Mail
              <input
                type="email"
                v-model="inventoryEmail"
                placeholder="E-Mail-Adresse eingeben"
                required
              />
            </label>
          </div>
        </div>
        
        <!-- Fixed Buttons Outside Modal Content -->
        <div class="modal-buttons">
          <button @click="sendInventoryUpdate">Bestand senden</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import api from "@/utils/api";
import itemMappings from "@/assets/ItemMappings.json";
import { useTheme } from "@/stores/theme";
import { useUi } from "@/stores/ui";
import { computed } from "vue";

export default {
  name: "Shortcuts",
  emits: ["update-modal", "itemsUpdated"],
  components: { FontAwesomeIcon },
  props: { isModalOpen: Boolean },
  setup() {
    const theme = useTheme();
    const ui = useUi();
    const logoSrc = computed(() =>
      theme.isDark
        ? new URL("@/assets/SF_000.svg", import.meta.url).href
        : new URL("@/assets/SF_002.png", import.meta.url).href
    );
    return { theme, ui, logoSrc };
  },
  data() {
    return {
      // auth & user
      token: localStorage.getItem("token") || null,
      userID: "",
      userLocation: "",

      // ui
      showLogiModal: false,
      showServiceModal: false,
      showBestandUpdateModal: false,
      downloading: false,
      anmerkung: "",
      selectedLocation: "Hamburg",

      // inventory update
      inventoryLocation: "all",
      inventoryEmail: "",

      // logi flags & sizes
      cuttermesserChecked: true,
      jutebeutelChecked: true,
      logistikHoseChecked: true,
      tshirtChecked: [true, true, false],
      tshirtSize: ["", "", ""],
      schwarzeKapuzenjackeChecked: true,
      sicherheitshelmChecked: false,
      softshelljackeChecked: false,
      bundhoseChecked: false,
      sicherheitsschuheChecked: false,
      handschuheChecked: false,
      jutebeutelArt: "",
      logistikHoseSize: "",
      schwarzeKapuzenjackeSize: "",
      sicherheitshelmArt: "",
      softshelljackeSize: "",
      bundhoseSize: "",
      sicherheitsschuheSize: "",
      handschuheSize: "",

      // service flags & sizes
      kellnermesserChecked: true,
      kellnerblockChecked: true,
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

  computed: {
    itemsMap() {
      return itemMappings[this.selectedLocation] || {};
    },
  },

  methods: {
    setAxiosAuthToken() {
      api.defaults.headers.common["x-auth-token"] = this.token;
    },
    async fetchUserData() {
      if (!this.token) return this.$router.push("/");
      try {
        const { data } = await api.get("/api/users/me");
        this.userID = data._id;
        this.userLocation = data.location || "Hamburg";
        this.selectedLocation = this.userLocation; // initiales Mapping
      } catch (e) {
        console.error("Error fetching user data:", e);
        this.$router.push("/");
      }
    },

    getItemId(category, sub = null) {
      const c = this.itemsMap?.[category];
      if (!c) return null;
      return sub ? c?.[sub] || null : c;
    },

    async getExcel() {
      try {
        this.downloading = true;
        const { data } = await api.get("/api/items/getExcel", {
          responseType: "blob",
        });
        const blob = new Blob([data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "items.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Excel Download fehlgeschlagen:", e);
        alert("Excel konnte nicht geladen werden.");
      } finally {
        this.downloading = false;
      }
    },

    openModal() {
      this.$emit("update-modal", true);
      if (this.userLocation === "Berlin" || this.userLocation === "Köln") {
      }
    },
    closeModal() {
      this.$emit("update-modal", false);
    },
    closeAllModals() {
      this.showLogiModal = false;
      this.showServiceModal = false;
      this.showBestandUpdateModal = false;
      this.closeModal();
    },

    handleEscapeKey(event) {
      if (event.key === "Escape") {
        this.closeAllModals();
      }
    },

    async sendInventoryUpdate() {
      if (!this.inventoryEmail) {
        alert("Bitte eine E-Mail-Adresse eingeben");
        return;
      }

      try {
        await api.post("/api/items/sendInventoryUpdate", {
          location: this.inventoryLocation,
          email: this.inventoryEmail,
        });
        alert("Bestandsupdate wurde verschickt!");
        this.closeAllModals();
      } catch (error) {
        console.error("Fehler beim Senden des Bestandsupdates:", error);
        alert("Fehler beim Senden des Bestandsupdates");
      }
    },

    openLogiPaketModal() {
      this.openModal();
      this.showLogiModal = true;
    },
    openServicePaketModal() {
      this.openModal();
      this.showServiceModal = true;
    },
    openBestandsUpdateModal() {
      this.openModal();
      this.showBestandUpdateModal = true;
    },
    validateLogiSelections() {
      const req = [];
      if (this.logistikHoseChecked && !this.logistikHoseSize)
        req.push("Logistikhose");
      if (this.tshirtChecked[0] && !this.tshirtSize[0]) req.push("T-Shirt (1)");
      if (this.tshirtChecked[1] && !this.tshirtSize[1]) req.push("T-Shirt (2)");
      if (this.tshirtChecked[2] && !this.tshirtSize[2]) req.push("T-Shirt (3)");
      if (this.schwarzeKapuzenjackeChecked && !this.schwarzeKapuzenjackeSize)
        req.push("Kapuzenjacke");
      if (this.sicherheitshelmChecked && !this.sicherheitshelmArt)
        req.push("Sicherheitshelm");
      if (this.softshelljackeChecked && !this.softshelljackeSize)
        req.push("Softshelljacke");
      if (this.bundhoseChecked && !this.bundhoseSize) req.push("Bundhose");
      if (this.sicherheitsschuheChecked && !this.sicherheitsschuheSize)
        req.push("Sicherheitsschuhe");
      if (this.handschuheChecked && !this.handschuheSize)
        req.push("Handschuhe");

      if (req.length) {
        alert("Bitte Größe/Art wählen für:\n• " + req.join("\n• "));
        return false;
      }
      return true;
    },

    validateServiceSelections() {
      const req = [];
      if (this.weisseHemdenDamenChecked && !this.weisseHemdenDamenSize)
        req.push("Weiße Hemden Damen");
      if (this.schwarzeHemdenDamenChecked && !this.schwarzeHemdenDamenSize)
        req.push("Schwarze Hemden Damen");
      if (this.weisseHemdenHerrenChecked && !this.weisseHemdenHerrenSize)
        req.push("Weiße Hemden Herren");
      if (this.schwarzeHemdenHerrenChecked && !this.schwarzeHemdenHerrenSize)
        req.push("Schwarze Hemden Herren");
      if (req.length) {
        alert("Bitte Größe wählen für:\n• " + req.join("\n• "));
        return false;
      }
      return true;
    },

    async updateMultiple(selections, count) {
      if (!this.token) return this.$router.push("/");
      const items = selections
        .filter((s) => s.checked)
        .map((s) => ({ _id: s._id, size: s.size }));
      try {
        await api.put("/api/items/updateMultiple", {
          userID: this.userID,
          items,
          count,
          anmerkung: this.anmerkung,
        });
        this.$emit("itemsUpdated");
      } catch (e) {
        console.error("UpdateMultiple failed:", e);
        alert("Aktualisierung fehlgeschlagen.");
      }
    },

    submitLogiModal(action) {
      if (!this.validateLogiSelections()) return;

      const sel = [
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
          checked: this.tshirtChecked[0],
          _id: this.getItemId("tshirt", this.tshirtSize[0]),
          size: this.tshirtSize[0],
        },
        {
          bezeichnung: "T-Shirt (2)",
          checked: this.tshirtChecked[1],
          _id: this.getItemId("tshirt", this.tshirtSize[1]),
          size: this.tshirtSize[1],
        },
        {
          bezeichnung: "T-Shirt (3)",
          checked: this.tshirtChecked[2],
          _id: this.getItemId("tshirt", this.tshirtSize[2]),
          size: this.tshirtSize[2],
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

      // Ungültige Infos melden
      const invalid = sel.filter((s) => s.checked && !s._id);
      if (invalid.length) {
        alert(
          "Nicht gefunden:\n" +
            invalid
              .map((i) => `• ${i.bezeichnung} (${i.size || "?"})`)
              .join("\n")
        );
        return;
      }

      const count = action === "add" ? 1 : -1;
      this.anmerkung = `Logistik-Paket: ${this.anmerkung || ""}`.trim();
      this.updateMultiple(sel, count);
      this.closeAllModals();
      this.resetLogiPaket();
    },

    submitServiceModal(action) {
      if (!this.validateServiceSelections()) return;

      const sel = [
        {
          checked: this.kellnermesserChecked,
          _id: this.getItemId("kellnermesser"),
          size: "onesize",
        },
        ...(this.selectedLocation === 'Hamburg' ? [{
          checked: this.kellnerblockChecked,
          _id: this.getItemId("kellnerblock"),
          size: "onesize",
        }] : []),
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

      const valid = sel.filter((s) => s.checked && s._id);
      if (!valid.length) {
        alert("Es wurde nichts ausgewählt.");
        return;
      }

      const count = action === "add" ? 1 : -1;
      this.anmerkung = `Service-Paket: ${this.anmerkung || ""}`.trim();
      this.updateMultiple(sel, count);
      this.closeAllModals();
      this.resetServicePaket();
    },

    // resets
    resetLogiPaket() {
      this.anmerkung = "";
      this.cuttermesserChecked = false;
      this.jutebeutelChecked = false;
      this.logistikHoseChecked = false;
      this.tshirtChecked = [false, false, false];
      this.schwarzeKapuzenjackeChecked = false;
      this.sicherheitshelmChecked = false;
      this.softshelljackeChecked = false;
      this.bundhoseChecked = false;
      this.sicherheitsschuheChecked = false;
      this.handschuheChecked = false;

      this.jutebeutelArt = "";
      this.logistikHoseSize = "";
      this.tshirtSize = ["", "", ""];
      this.schwarzeKapuzenjackeSize = "";
      this.sicherheitshelmArt = "";
      this.softshelljackeSize = "";
      this.bundhoseSize = "";
      this.sicherheitsschuheSize = "";
      this.handschuheSize = "";
    },

    resetServicePaket() {
      this.anmerkung = "";
      this.kellnermesserChecked = true;
      this.kellnerblockChecked = true;
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
  },

  mounted() {
    this.setAxiosAuthToken();
    this.fetchUserData();
    window.addEventListener("keydown", this.handleEscapeKey);
  },

  beforeUnmount() {
    window.removeEventListener("keydown", this.handleEscapeKey);
  },
};
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

/* Drawer */
.shortcuts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 6px;
  color: var(--text);
}

.shortcuts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 6px;
}

h4 {
  font-size: 15px;
  font-weight: 700;
  opacity: 0.9;
  margin: 0;
}

.close-btn {
  display: none; /* Desktop versteckt */
  background: none;
  border: none;
  color: var(--text);
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s, background 0.2s;
}
.close-btn:hover {
  opacity: 1;
  background: var(--hover);
}

@media (max-width: 768px) {
  .close-btn {
    display: block; /* Nur auf Mobile sichtbar */
  }
}

/* Buttons */
.actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.s-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  font-size: 12.5px;
  line-height: 1.2;
  transition: background 0.2s, transform 0.08s, border-color 0.2s;
}
.s-btn:hover {
  background: var(--hover);
  transform: translateY(-1px);
}
.s-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
.s-btn img {
  width: 16px;
  height: 16px;
  opacity: 0.6;
}

/* Modal Overlay (deins ggf. schon angepasst) */
.modal {
  position: fixed;
  inset: 0;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* Modal Card */
.modal-content {
  position: relative;
  width: 380px;
  max-width: calc(100vw - 32px);
  height: min(85vh, 640px); /* Increased max height */
  min-height: 300px; /* Minimum height to ensure buttons are always visible */
  background: var(--tile-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  font-size: 12.5px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Responsive adjustments for high zoom levels */
@media screen and (max-height: 500px) {
  .modal-content {
    height: calc(100vh - 40px);
    max-height: calc(100vh - 40px);
  }
}
.modal-content > h4 {
  margin: 0 0 8px;
  font-size: 15px;
  flex-shrink: 0; /* Prevent shrinking */
  padding: 12px 12px 0 12px;
}

/* Scrollable content area */
.modal-scrollable {
  flex: 1; /* Take available space */
  overflow-y: auto;
  padding: 0 12px 12px 12px;
  min-height: 0; /* Important for flex child to shrink */
}
.close {
  position: absolute;
  right: 8px;
  top: 8px;
  font-size: 20px;
  color: var(--muted);
  cursor: pointer;
  z-index: 1;
  padding: 4px;
}
.close:hover {
  color: var(--text);
}

.select-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.select-label select {
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  /* Remove max-height and overflow - parent handles it now */
}
.sub {
  margin: 4px 0 2px;
  color: var(--muted);
  font-weight: 600;
  font-size: 12.5px;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 6px;
  background: var(--hover);
}
.chk {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.sel {
  min-width: 90px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--tile-bg);
  color: var(--text);
}

.full {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.full input {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
}

/* Inventory Update Form */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 0;
}

.form-group label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group select,
.form-group input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--tile-bg);
  color: var(--text);
  font-size: 13px;
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--primary);
  outline: none;
}

/* Fixed Modal Buttons - Always visible at bottom */
.modal-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 12px;
  border-top: 1px solid var(--border);
  background: var(--tile-bg);
  border-radius: 0 0 10px 10px;
  flex-shrink: 0; /* Never shrink */
  min-height: 48px; /* Minimum height to ensure visibility */
  position: relative; /* Ensure it stays in place */
  z-index: 10; /* Above other content */
}

.modal-buttons button {
  min-width: 110px;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: var(--primary);
  color: #fff;
  cursor: pointer;
  font-size: 12.5px;
  transition: filter 0.2s;
}

.modal-buttons button:hover {
  filter: brightness(0.95);
}

.modal-buttons button:active {
  transform: scale(0.98);
}
</style>
