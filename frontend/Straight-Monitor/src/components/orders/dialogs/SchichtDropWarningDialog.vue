<template>
  <ModalFrame
    v-if="modelValue && step"
    :model-value="modelValue"
    :title="dialogTitle"
    size="sm"
    :close-on-backdrop="!busy"
    :close-on-escape="!busy"
    style="--mf-max-width: 480px; --mf-max-height: 90dvh"
    @close="onCancel"
  >
    <template #header="{ titleId }">
      <h2 :id="titleId" class="drop-warn-title">
        <font-awesome-icon :icon="dialogIcon" class="drop-warn-title__icon" />
        <span>{{ dialogTitle }}</span>
      </h2>
    </template>

    <div class="drop-warn-body">
      <!-- 1. MISSING QUALIFICATION -->
      <template v-if="step.type === 'missing-qualification'">
        <p class="drop-warn-text">
          <strong>{{ step.employeeName }}</strong> besitzt noch nicht die für die Schicht
          <strong>{{ step.shiftName }}</strong> benötigte Qualifikation:
        </p>
        <div class="drop-warn-highlight drop-warn-highlight--quali">
          <font-awesome-icon icon="fa-solid fa-graduation-cap" />
          <span>{{ step.qualification.designation }}</span>
          <small v-if="step.qualification.qualificationKey">#{{ step.qualification.qualificationKey }}</small>
        </div>
        <p class="drop-warn-question">
          Möchtest du die Qualifikation <strong>{{ step.qualification.designation }}</strong> jetzt
          <strong>{{ step.employeeName }}</strong> zuweisen und fortfahren?
        </p>
      </template>

      <!-- 2. ALREADY PLANNED ON DAY -->
      <template v-else-if="step.type === 'already-planned'">
        <p class="drop-warn-text">
          <strong>{{ step.employeeName }}</strong> ist am
          <strong>{{ step.dateLabel }}</strong> bereits in einer anderen Schicht eingeplant:
        </p>
        <div class="drop-warn-jobs">
          <div
            v-for="(job, idx) in step.existingJobs"
            :key="job.einsatzId || idx"
            class="drop-warn-job-card"
          >
            <strong>{{ job.title }}</strong>
            <small v-if="job.subtitle">{{ job.subtitle }}</small>
          </div>
        </div>
        <p class="drop-warn-question">
          Wie möchtest du mit der Einplanung in <strong>{{ step.shiftName }}</strong> verfahren?
        </p>
      </template>

      <!-- 3. DISPO BLOCKED / NOT AVAILABLE -->
      <template v-else-if="step.type === 'dispo-blocked'">
        <p class="drop-warn-text">
          <strong>{{ step.employeeName }}</strong> hat sich für diesen Tag als
          <strong class="drop-warn-danger">{{ step.statusLabel || 'Nicht verfügbar' }}</strong>
          gemeldet.
        </p>
        <div v-if="step.note" class="drop-warn-highlight drop-warn-highlight--danger">
          <span>{{ step.note }}</span>
        </div>
        <p class="drop-warn-question">
          Wirklich in <strong>{{ step.shiftName }}</strong> {{ decisionMode === 'replan' ? 'umplanen' : 'einplanen' }}?
        </p>
      </template>

      <!-- 4. BEDARF EXCEEDED -->
      <template v-else-if="step.type === 'bedarf-exceeded'">
        <p class="drop-warn-text">
          Der Bedarf der Schicht <strong>{{ step.shiftName }}</strong> ist bereits erreicht bzw. überschritten:
        </p>
        <div class="drop-warn-highlight drop-warn-highlight--warn">
          <font-awesome-icon icon="fa-solid fa-users" />
          <span>Aktuell besetzt: <strong>{{ step.currentCount }} / {{ step.bedarf }}</strong></span>
        </div>
        <p class="drop-warn-question">
          Möchtest du <strong>{{ step.employeeName }}</strong> trotzdem {{ decisionMode === 'replan' ? 'umplanen' : 'einplanen' }}?
        </p>
      </template>
    </div>

    <template #footer>
      <div class="drop-warn-footer">
        <AppButton
          variant="secondary"
          :disabled="busy"
          @click="onCancel"
        >
          Abbrechen
        </AppButton>

        <template v-if="step.type === 'already-planned'">
          <CustomTooltip
            text="Bestehende Einplanung bleibt erhalten – der Mitarbeiter wird zusätzlich in diese Schicht eingeplant (Doppelbelegung)."
            position="top"
          >
            <AppButton
              variant="secondary"
              :disabled="busy"
              :loading="busy && activeAction === 'plan-anyway'"
              @click="onSelect('plan-anyway')"
            >
              Trotzdem Einplanen
            </AppButton>
          </CustomTooltip>

          <CustomTooltip
            text="Alten Einsatz löschen und Mitarbeiter in diese Schicht umplanen."
            position="top"
          >
            <AppButton
              variant="primary"
              :disabled="busy"
              :loading="busy && activeAction === 'replan'"
              @click="onSelect('replan')"
            >
              Umplanen
            </AppButton>
          </CustomTooltip>
        </template>

        <template v-else-if="step.type === 'missing-qualification'">
          <AppButton
            variant="primary"
            :disabled="busy"
            :loading="busy"
            @click="onSelect('assign-qualification')"
          >
            <font-awesome-icon icon="fa-solid fa-check" />
            Qualifikation zuweisen &amp; weiter
          </AppButton>
        </template>

        <template v-else-if="step.type === 'bedarf-exceeded'">
          <AppButton
            variant="primary"
            :disabled="busy"
            :loading="busy"
            @click="onSelect(decisionMode === 'replan' ? 'replan' : 'confirm')"
          >
            <font-awesome-icon icon="fa-solid fa-check" />
            {{ decisionMode === 'replan' ? 'Trotzdem Umplanen' : 'Trotzdem Einplanen' }}
          </AppButton>
        </template>

        <template v-else>
          <AppButton
            variant="primary"
            :disabled="busy"
            :loading="busy"
            @click="onSelect(decisionMode === 'replan' ? 'replan' : 'confirm')"
          >
            <font-awesome-icon icon="fa-solid fa-check" />
            {{ decisionMode === 'replan' ? 'Umplanen bestätigen' : 'Bestätigen' }}
          </AppButton>
        </template>
      </div>
    </template>
  </ModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue';
import ModalFrame from '@/components/frames/ModalFrame.vue';
import AppButton from '@/components/ui-elements/AppButton.vue';
import CustomTooltip from '@/components/CustomTooltip.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  step: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  decisionMode: { type: String, default: 'plan' },
});

const emit = defineEmits(['cancel', 'decide']);
const activeAction = ref('');

const dialogTitle = computed(() => {
  const type = props.step?.type;
  if (type === 'missing-qualification') return 'Fehlende Qualifikation';
  if (type === 'already-planned') return 'Bereits in anderer Schicht geplant';
  if (type === 'dispo-blocked') return 'Mitarbeiter nicht verfügbar';
  if (type === 'bedarf-exceeded') return 'Schichtbedarf überschritten';
  return 'Hinweis zur Einplanung';
});

const dialogIcon = computed(() => {
  const type = props.step?.type;
  if (type === 'missing-qualification') return 'fa-solid fa-graduation-cap';
  return 'fa-solid fa-triangle-exclamation';
});

function onCancel() {
  if (props.busy) return;
  activeAction.value = '';
  emit('cancel');
}

function onSelect(action) {
  if (props.busy) return;
  activeAction.value = action;
  emit('decide', action);
}
</script>

<style scoped lang="scss">
.drop-warn-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.02rem;
  color: var(--text);

  &__icon {
    color: #f59e0b;
  }
}

.drop-warn-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 0.88rem;
  color: var(--text);
  line-height: 1.45;
}

.drop-warn-text,
.drop-warn-question {
  margin: 0;
}

.drop-warn-question {
  color: var(--muted);
  font-size: 0.84rem;
}

.drop-warn-danger {
  color: #dc2626;
}

.drop-warn-highlight {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 0.85rem;
  font-weight: 600;

  small {
    margin-left: auto;
    color: var(--muted);
    font-weight: 500;
  }

  &--quali {
    background: color-mix(in srgb, #10b981 12%, var(--panel));
    border: 1px solid color-mix(in srgb, #10b981 40%, var(--border));
    color: #047857;
  }

  &--danger {
    background: color-mix(in srgb, #ef4444 12%, var(--panel));
    border: 1px solid color-mix(in srgb, #ef4444 40%, var(--border));
    color: #dc2626;
  }

  &--warn {
    background: color-mix(in srgb, #f59e0b 12%, var(--panel));
    border: 1px solid color-mix(in srgb, #f59e0b 40%, var(--border));
    color: #b45309;
  }
}

.drop-warn-jobs {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drop-warn-job-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, #6366f1 10%, var(--panel));
  border-left: 3px solid #6366f1;

  strong {
    font-size: 0.84rem;
    color: var(--text);
  }

  small {
    font-size: 0.76rem;
    color: var(--muted);
  }
}

.drop-warn-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
