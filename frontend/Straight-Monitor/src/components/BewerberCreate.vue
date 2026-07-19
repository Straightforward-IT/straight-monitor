<template>
  <main class="bewerber-create">
    <section class="form-panel">
      <header class="panel-header">
        <div>
          <p class="eyebrow">Hamburg</p>
          <h1>Bewerber erstellen</h1>
          <p>Die Asana-Aufgabe wird mit einem eigenständigen Bewerber verknüpft. Es wird kein Mitarbeiter- oder Flip-Konto angelegt.</p>
        </div>
        <a v-if="form.asana_permalink" :href="form.asana_permalink" target="_blank" rel="noopener" class="asana-link">
          Asana öffnen
        </a>
      </header>

      <div v-if="loading" class="state">Asana-Aufgabe wird geladen ...</div>
      <div v-else-if="existingApplicant" class="state state--info">
        Für diese Asana-Aufgabe besteht bereits ein Bewerber.
        <button type="button" class="link-button" @click="openExisting">Bewerber öffnen</button>
      </div>
      <div v-else>
        <p v-if="error" class="state state--error">{{ error }}</p>

        <form @submit.prevent="createApplicant">
          <div class="form-grid">
            <label>
              Vorname
              <input v-model.trim="form.vorname" required autocomplete="given-name" />
            </label>
            <label>
              Nachname
              <input v-model.trim="form.nachname" required autocomplete="family-name" />
            </label>
            <label>
              E-Mail
              <input v-model.trim="form.email" required type="email" autocomplete="email" />
            </label>
            <label>
              Telefon
              <input v-model.trim="form.telefon" type="tel" autocomplete="tel" />
            </label>
            <label>
              Geburtsdatum
              <input v-model="form.geburtsdatum" type="date" autocomplete="bday" />
            </label>
            <label>
              Bevorzugter Bereich
              <select v-model="form.bevorzugterBereich">
                <option value="">Nicht angegeben</option>
                <option value="service">Service</option>
                <option value="logistik">Logistik</option>
                <option value="beides">Service &amp; Logistik</option>
              </select>
            </label>
            <label>
              Führerschein
              <select :value="form.fuehrerscheine[0] || ''" @change="setLicense($event.target.value)">
                <option value="">Kein Führerschein angegeben</option>
                <option v-for="license in licenseClasses" :key="license" :value="license">Klasse {{ license }}</option>
              </select>
            </label>
            <label>
              Verfügbar ab
              <input v-model="form.verfuegbarAb" type="date" />
            </label>
            <label>
              Verfügbar bis
              <input v-model="form.verfuegbarBis" type="date" />
            </label>
            <label class="form-field--full">
              Verfügbarkeit
              <textarea v-model.trim="form.verfuegbarkeit" rows="3" placeholder="Zum Beispiel Wochentage, Schichten oder Sperrzeiten" />
            </label>
            <label class="form-field--full">
              Aktueller Job / Anstellungsverhältnis
              <input v-model.trim="form.aktuellesAnstellungsverhaeltnis" type="text" />
            </label>
            <label class="form-field--full">
              Erfahrung in Gastronomie / Logistik
              <textarea v-model.trim="form.erfahrungGastronomieLogistik" rows="3" />
            </label>
            <label class="form-field--full">
              Bemerkungen
              <textarea v-model.trim="form.bemerkungen" rows="3" />
            </label>
          </div>

          <div class="actions">
            <button type="button" class="secondary-button" @click="$router.back()">Abbrechen</button>
            <button type="submit" class="primary-button" :disabled="submitting">
              {{ submitting ? "Wird erstellt ..." : "Bewerber erstellen" }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <aside v-if="task" class="task-panel">
      <p class="eyebrow">Asana-Aufgabe</p>
      <h2>{{ task.name }}</h2>
      <p v-if="task.notes" class="task-notes">{{ task.notes }}</p>
    </aside>
  </main>
</template>

<script>
import api from "@/utils/api";

function parseTaskName(name = "") {
  const cleaned = name
    .replace(/\s*-\s*(?:s|service|l|logi|logistik|s\+l|l\+s)\b.*$/i, "")
    .trim();
  const parts = cleaned.includes(",")
    ? cleaned.split(",").reverse().join(" ").trim().split(/\s+/)
    : cleaned.split(/\s+/);

  return {
    vorname: parts.slice(0, -1).join(" "),
    nachname: parts.at(-1) || "",
  };
}

function extractContact(text = "") {
  const plainText = String(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/[^\s<]+/gi, " ");
  const email = plainText.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
  const telefon = plainText.match(/(?:\+?\d[\d\s/()\-.]{6,}\d)/)?.[0]?.trim() || "";
  return { email, telefon };
}

export default {
  name: "BewerberCreate",
  data() {
    return {
      task: null,
      loading: true,
      submitting: false,
      existingApplicant: null,
      error: "",
      form: {
        asana_id: this.$route.params.id || "",
        asana_permalink: "",
        teamKey: "hamburg",
        vorname: "",
        nachname: "",
        email: "",
        telefon: "",
        geburtsdatum: "",
        bevorzugterBereich: "",
        fuehrerscheine: [],
        erfahrungGastronomieLogistik: "",
        aktuellesAnstellungsverhaeltnis: "",
        verfuegbarAb: "",
        verfuegbarBis: "",
        verfuegbarkeit: "",
        bemerkungen: "",
      },
    };
  },
  computed: {
    licenseClasses() {
      return ["B", "BE", "A", "A1", "C1", "C1E", "C", "CE", "D1", "D1E", "D", "DE", "L", "T", "M"];
    },
  },
  methods: {
    setLicense(value) {
      this.form.fuehrerscheine = value ? [value] : [];
    },
    async loadTask() {
      const taskId = this.form.asana_id;
      if (!taskId) {
        this.error = "Keine Asana-Aufgabe angegeben.";
        this.loading = false;
        return;
      }

      try {
        const [taskResponse, existingResponse] = await Promise.all([
          api.get(`/api/asana/task/${taskId}`),
          api.get(`/api/bewerber/asana/${taskId}`).catch((error) => {
            if (error.response?.status === 404) return null;
            throw error;
          }),
        ]);

        this.task = taskResponse.data.task;
        this.existingApplicant = existingResponse?.data?.data || null;
        this.form.asana_permalink = this.task.permalink_url || "";

        const name = parseTaskName(this.task.name);
        const contact = extractContact(`${this.task.notes || ""}\n${this.task.html_notes || ""}`);
        this.form.vorname = name.vorname;
        this.form.nachname = name.nachname;
        this.form.email = contact.email;
        this.form.telefon = contact.telefon;
      } catch (error) {
        this.error = error.response?.data?.message || "Die Asana-Aufgabe konnte nicht geladen werden.";
      } finally {
        this.loading = false;
      }
    },
    async createApplicant() {
      this.submitting = true;
      this.error = "";
      try {
        const response = await api.post("/api/bewerber", this.form);
        const id = response.data.data._id;
        this.$router.push({ path: "/personal", query: { tab: "bewerber", bewerber_id: id } });
      } catch (error) {
        this.error = error.response?.data?.message || "Der Bewerber konnte nicht erstellt werden.";
        if (error.response?.status === 409 && error.response.data.id) {
          this.existingApplicant = { _id: error.response.data.id };
        }
      } finally {
        this.submitting = false;
      }
    },
    openExisting() {
      this.$router.push({
        path: "/personal",
        query: { tab: "bewerber", bewerber_id: this.existingApplicant._id },
      });
    },
  },
  mounted() {
    this.loadTask();
  },
};
</script>

<style scoped lang="scss">
.bewerber-create {
  width: min(1040px, calc(100% - 32px));
  margin: 32px auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.38fr);
  gap: 20px;
}

.form-panel,
.task-panel {
  background: var(--tile-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 24px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 1.5rem;
  color: var(--text);
}

h2 {
  color: var(--text);
  font-size: 1rem;
  margin-bottom: 12px;
}

.panel-header p:not(.eyebrow),
.task-notes {
  color: var(--muted);
  line-height: 1.5;
  margin-top: 8px;
}

.eyebrow {
  color: var(--primary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
  margin-bottom: 4px;
}

.asana-link,
.link-button {
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
}

.link-button {
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

label {
  color: var(--text);
  display: grid;
  font-size: 0.85rem;
  font-weight: 600;
  gap: 6px;
}

input,
select,
textarea {
  min-height: 42px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  padding: 8px 10px;
}

select[multiple] {
  min-height: 116px;
}

textarea {
  min-height: 80px;
  resize: vertical;
}

.form-field--full {
  grid-column: 1 / -1;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--primary);
  outline: 2px solid color-mix(in srgb, var(--primary) 20%, transparent);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.primary-button,
.secondary-button {
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  min-height: 40px;
  padding: 8px 14px;
}

.primary-button {
  background: var(--primary);
  border: 1px solid var(--primary);
  color: #fff;
}

.secondary-button {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.primary-button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.state {
  color: var(--muted);
  line-height: 1.5;
}

.state--error {
  color: var(--danger, #b91c1c);
  margin-bottom: 16px;
}

.state--info {
  color: var(--text);
}

@media (max-width: 760px) {
  .bewerber-create {
    grid-template-columns: 1fr;
    margin: 16px auto;
  }

  .panel-header,
  .form-grid {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>