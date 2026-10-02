<template>
  <RouterPageLayout
    title="Einstellungen"
    :tabs="settingsTabs"
    default-tab="account"
    aria-label="Einstellungsbereiche"
    width="standard"
    content-variant="surface"
  >
    <template #default="{ activeTab }">
      <div class="settings-page">
        <section
          v-if="activeTab === 'account'"
          class="settings-section"
        >
          <header class="settings-section__header">
            <font-awesome-icon :icon="['fas', 'user']" />
            <div>
              <h2>Konto</h2>
              <p>{{ auth.user?.email }}</p>
            </div>
          </header>

          <form
            class="settings-form"
            @submit.prevent="saveProfile"
          >
            <label for="settings-display-name">Anzeigename</label>
            <div class="settings-form__row">
              <AppTextInput
                id="settings-display-name"
                v-model="displayName"
                type="text"
                minlength="2"
                maxlength="100"
                autocomplete="name"
                :disabled="profileSaving"
              />
              <AppButton
                type="submit"
                :disabled="profileSaving || displayName.trim().length < 2"
                :loading="profileSaving"
              >
                <font-awesome-icon :icon="['fas', 'save']" />
                {{ profileSaving ? 'Speichert…' : 'Speichern' }}
              </AppButton>
            </div>
            <p
              v-if="profileMessage"
              class="settings-message"
              :class="{ 'settings-message--error': profileError }"
            >
              {{ profileMessage }}
            </p>
          </form>

          <form
            class="settings-form settings-form--password"
            @submit.prevent="savePassword"
          >
            <h3>Passwort ändern</h3>
            <label for="settings-current-password">Aktuelles Passwort</label>
            <AppTextInput
              id="settings-current-password"
              v-model="passwordForm.current"
              type="password"
              autocomplete="current-password"
              :disabled="passwordSaving"
            />
            <label for="settings-new-password">Neues Passwort</label>
            <AppTextInput
              id="settings-new-password"
              v-model="passwordForm.next"
              type="password"
              minlength="8"
              autocomplete="new-password"
              :disabled="passwordSaving"
            />
            <label for="settings-confirm-password">Neues Passwort bestätigen</label>
            <AppTextInput
              id="settings-confirm-password"
              v-model="passwordForm.confirm"
              type="password"
              minlength="8"
              autocomplete="new-password"
              :disabled="passwordSaving"
            />
            <AppButton
              type="submit"
              class="settings-form__submit"
              :disabled="passwordSaving || !passwordFormComplete"
              :loading="passwordSaving"
            >
              <font-awesome-icon :icon="['fas', 'save']" />
              {{ passwordSaving ? 'Speichert…' : 'Passwort ändern' }}
            </AppButton>
            <p
              v-if="passwordMessage"
              class="settings-message"
              :class="{ 'settings-message--error': passwordError }"
            >
              {{ passwordMessage }}
            </p>
          </form>
        </section>

        <section
          v-else-if="activeTab === 'appearance'"
          class="settings-section"
        >
          <header class="settings-section__header">
            <font-awesome-icon :icon="['fas', 'palette']" />
            <div><h2>Darstellung</h2></div>
          </header>

          <div class="settings-choice">
            <h3>Farbschema</h3>
            <AppSegmentedControl
              :model-value="theme.theme"
              :options="themeOptions"
              label="Farbschema"
              :disabled="appearanceSaving"
              @update:model-value="saveTheme"
            >
              <template #option="{ option }">
                <font-awesome-icon :icon="['fas', option.icon]" />
                {{ option.label }}
              </template>
            </AppSegmentedControl>
          </div>

          <div class="settings-choice">
            <h3>Hauptfarbe</h3>
            <div
              class="accent-options"
              role="radiogroup"
              aria-label="Hauptfarbe"
            >
              <button
                v-for="option in accentColorOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="theme.accentColor === option.value"
                :class="{ active: theme.accentColor === option.value }"
                :disabled="accentColorSaving"
                @click="saveAccentColor(option.value)"
              >
                <span
                  class="accent-swatch"
                  :style="{ backgroundColor: option.color }"
                />
                <span>{{ option.label }}</span>
                <font-awesome-icon
                  v-if="theme.accentColor === option.value"
                  :icon="['fas', 'check']"
                />
              </button>
            </div>
          </div>

          <div class="settings-choice">
            <h3>Mitarbeiternamen</h3>
            <div
              class="name-format-options"
              role="radiogroup"
              aria-label="Format für Mitarbeiternamen"
            >
              <button
                v-for="option in nameFormatOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="auth.employeeNameFormat === option.value"
                :class="{ active: auth.employeeNameFormat === option.value }"
                :disabled="nameFormatSaving"
                @click="saveNameFormat(option.value)"
              >
                <span>{{ option.label }}</span>
                <strong>{{ option.preview }}</strong>
                <font-awesome-icon
                  v-if="auth.employeeNameFormat === option.value"
                  :icon="['fas', 'check']"
                />
              </button>
            </div>
          </div>

          <p
            v-if="appearanceMessage"
            class="settings-message settings-message--error"
          >
            {{ appearanceMessage }}
          </p>
        </section>

        <section
          v-else-if="activeTab === 'dashboard'"
          class="settings-section"
        >
          <header class="settings-section__header">
            <font-awesome-icon :icon="['fas', 'table-cells-large']" />
            <div><h2>Dashboard</h2></div>
          </header>
          <WidgetPreferenceControls />
        </section>
      </div>
    </template>
  </RouterPageLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { useRoute, useRouter } from 'vue-router';
import RouterPageLayout from '@/components/layout/RouterPageLayout.vue';
import WidgetPreferenceControls from '@/components/widgets/WidgetPreferenceControls.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import AppSegmentedControl from '@/components/ui-elements/AppSegmentedControl.vue';
import AppTextInput from '@/components/ui-elements/AppTextInput.vue';
import { settingsTabs } from '@/components/layout/pageTabDefinitions';
import { useAuth } from '@/stores/auth';
import { useDashboardPrefs } from '@/stores/dashboardPrefs';
import { useTheme } from '@/stores/theme';
import { accentColorOptions } from '@/utils/appearance';

const auth = useAuth();
const theme = useTheme();
const dashboardPrefs = useDashboardPrefs();
const route = useRoute();
const router = useRouter();
const displayName = ref('');
const profileSaving = ref(false);
const profileError = ref(false);
const profileMessage = ref('');
const passwordSaving = ref(false);
const passwordError = ref(false);
const passwordMessage = ref('');
const appearanceSaving = ref(false);
const accentColorSaving = ref(false);
const nameFormatSaving = ref(false);
const appearanceMessage = ref('');
const passwordForm = reactive({ current: '', next: '', confirm: '' });
const nameFormatOptions = Object.freeze([
  { value: 'first-last', label: 'Vorname Nachname', preview: 'Max Mustermann' },
  { value: 'last-first', label: 'Nachname, Vorname', preview: 'Mustermann, Max' },
]);
const themeOptions = Object.freeze([
  { value: 'light', label: 'Hell', icon: 'sun' },
  { value: 'dark', label: 'Dunkel', icon: 'moon' },
]);
const passwordFormComplete = computed(() => passwordForm.current
  && passwordForm.next.length >= 8
  && passwordForm.confirm.length >= 8);

watch(() => auth.user?.name, (name) => { displayName.value = name || ''; }, { immediate: true });

function requestMessage(error, fallback) {
  return error?.response?.data?.msg || fallback;
}

async function saveProfile() {
  profileSaving.value = true;
  profileError.value = false;
  profileMessage.value = '';
  try {
    await auth.updateProfile(displayName.value);
    profileMessage.value = 'Anzeigename gespeichert.';
  } catch (error) {
    profileError.value = true;
    profileMessage.value = requestMessage(error, 'Anzeigename konnte nicht gespeichert werden.');
  } finally {
    profileSaving.value = false;
  }
}

async function savePassword() {
  passwordError.value = false;
  passwordMessage.value = '';
  if (passwordForm.next !== passwordForm.confirm) {
    passwordError.value = true;
    passwordMessage.value = 'Die neuen Passwörter stimmen nicht überein.';
    return;
  }

  passwordSaving.value = true;
  try {
    await auth.changePassword(passwordForm.current, passwordForm.next);
    Object.assign(passwordForm, { current: '', next: '', confirm: '' });
    passwordMessage.value = 'Passwort geändert.';
  } catch (error) {
    passwordError.value = true;
    passwordMessage.value = requestMessage(error, 'Passwort konnte nicht geändert werden.');
  } finally {
    passwordSaving.value = false;
  }
}

async function saveTheme(value) {
  if (value === theme.theme) return;
  appearanceSaving.value = true;
  appearanceMessage.value = '';
  try {
    await theme.setForUser(value);
  } catch (error) {
    appearanceMessage.value = requestMessage(error, 'Farbschema konnte nicht gespeichert werden.');
  } finally {
    appearanceSaving.value = false;
  }
}

async function saveNameFormat(value) {
  if (value === auth.employeeNameFormat) return;
  nameFormatSaving.value = true;
  appearanceMessage.value = '';
  try {
    await auth.updatePreferences({ display: { employeeNameFormat: value } });
  } catch (error) {
    appearanceMessage.value = requestMessage(error, 'Namensformat konnte nicht gespeichert werden.');
  } finally {
    nameFormatSaving.value = false;
  }
}

async function saveAccentColor(value) {
  if (value === theme.accentColor) return;
  accentColorSaving.value = true;
  appearanceMessage.value = '';
  try {
    await theme.setAccentColorForUser(value);
  } catch (error) {
    appearanceMessage.value = requestMessage(error, 'Hauptfarbe konnte nicht gespeichert werden.');
  } finally {
    accentColorSaving.value = false;
  }
}

onMounted(async () => {
  if (route.query.tab === 'dispo') {
    const { tab: _tab, ...query } = route.query;
    await router.replace({ name: 'UserSettings', query });
  }

  const user = auth.user || await auth.fetchMe();
  theme.hydrateFromUser(user);
  if (!dashboardPrefs.loaded) dashboardPrefs.load(user._id, user.dashboardPrefs, user.roles || []);
});
</script>

<style scoped lang="scss">
.settings-page { width: min(760px, 100%); }
.settings-section { display: grid; gap: 24px; }
.settings-section__header { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.settings-section__header > svg { width: 20px; margin-top: 2px; color: var(--primary); font-size: 18px; }
.settings-section__header h2, .settings-section__header p { margin: 0; }
.settings-section__header h2 { color: var(--text); font-size: 18px; }
.settings-section__header p { margin-top: 4px; color: var(--muted); font-size: 13px; }
.settings-form { display: grid; gap: 8px; max-width: 560px; }
.settings-form--password { padding-top: 20px; border-top: 1px solid var(--border); }
.settings-form h3, .settings-choice h3 { margin: 0 0 4px; color: var(--text); font-size: 14px; }
.settings-form label { color: var(--muted); font-size: 12px; font-weight: 600; }
.settings-form__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.settings-form__submit { width: fit-content; margin-top: 6px; }
.settings-message { margin: 2px 0 0; color: #237a42; font-size: 13px; }
.settings-message--error { color: #c43d3d; }
.settings-choice { display: grid; gap: 10px; }
.accent-options { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.accent-options button { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); color: var(--text); text-align: left; cursor: pointer; }
.accent-options button.active { border-color: var(--primary); color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.accent-options button:disabled { cursor: wait; opacity: .6; }
.accent-options button svg { font-size: 12px; }
.accent-swatch { width: 20px; height: 20px; border: 1px solid color-mix(in srgb, #000 14%, transparent); border-radius: 50%; }
.name-format-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.name-format-options button { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 12px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); color: var(--text); text-align: left; cursor: pointer; }
.name-format-options button span { color: var(--muted); font-size: 12px; }
.name-format-options button strong { font-size: 15px; }
.name-format-options button svg { grid-column: 2; grid-row: 1 / span 2; color: var(--primary); }
.name-format-options button.active { border-color: var(--primary); color: var(--primary); }
.settings-command { display: inline-flex; min-height: 38px; width: fit-content; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--primary); border-radius: var(--control-radius); background: var(--action-primary); color: var(--on-action-primary); font-weight: 600; text-decoration: none; cursor: pointer; }
@media (max-width: 620px) {
  .settings-form__row, .name-format-options { grid-template-columns: 1fr; }
  .accent-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .settings-form__row :deep(.app-button) { width: 100%; }
  :deep(.app-segmented-control) { width: 100%; }
}
</style>
