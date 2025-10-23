<template>
  <div class="dialog-overlay" @click="$emit('close')">
    <div class="dialog-content" @click.stop>
      <div class="dialog-header">
        <h3>Mark as Value - Extract Variable</h3>
        <button @click="$emit('close')" class="btn-close">
          <font-awesome-icon icon="times" />
        </button>
      </div>

      <div class="dialog-body">
        <div class="form-group">
          <label>Variable Name</label>
          <input 
            v-model="variableName" 
            type="text" 
            placeholder="e.g., applicant_name"
            @keyup.enter="confirm"
          >
        </div>

        <div class="form-group">
          <label>Extraction Strategy</label>
          <select v-model="selector">
            <option value="nextLine">Next Line</option>
            <option value="nextElement">Next Element</option>
            <option value="sameLineAfter">Same Line After</option>
            <option value="sameLineBefore">Same Line Before</option>
            <option value="parentElement">Parent Element Text</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div v-if="selector === 'custom'" class="form-group">
          <label>CSS Selector or XPath</label>
          <input 
            v-model="customSelector" 
            type="text" 
            placeholder="e.g., .applicant-name or ../following-sibling::div"
          >
        </div>

        <div class="form-group">
          <label>Handle Multiple Occurrences</label>
          <div class="radio-group">
            <label>
              <input v-model="occurrence" type="radio" value="first" />
              <span>First occurrence only</span>
            </label>
            <label>
              <input v-model="occurrence" type="radio" value="all" />
              <span>All occurrences (array)</span>
            </label>
            <label>
              <input v-model="occurrence" type="radio" value="last" />
              <span>Last occurrence only</span>
            </label>
          </div>
        </div>

        <div v-if="element" class="preview-section">
          <h4>Preview</h4>
          <div class="preview-box">
            <p class="preview-label">Selected Element:</p>
            <p class="preview-text">{{ truncateText(element.text, 100) }}</p>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button @click="$emit('close')" class="btn-secondary">Cancel</button>
        <button @click="confirm" class="btn-primary">Confirm</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface EmailElement {
  tag: string;
  text: string;
  depth: number;
}

defineProps<{
  element: EmailElement | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [data: { variableName: string; selector: string; occurrence?: string }];
}>();

const variableName = ref('');
const selector = ref('nextLine');
const customSelector = ref('');
const occurrence = ref('first');

function truncateText(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + '...' : text;
}

function confirm() {
  if (!variableName.value.trim()) {
    alert('Variable name is required');
    return;
  }

  emit('confirm', {
    variableName: variableName.value,
    selector: selector.value === 'custom' ? customSelector.value : selector.value,
    occurrence: occurrence.value
  });
}
</script>

<style scoped lang="scss">
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dialog-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #ddd;

  h3 {
    margin: 0;
    font-size: 1.1rem;
  }

  .btn-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;

    &:hover {
      color: #333;
    }
  }
}

.dialog-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    font-size: 0.9rem;
    color: #333;
  }

  input[type="text"],
  select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font-weight: normal;
      cursor: pointer;

      input[type="radio"] {
        cursor: pointer;
      }

      span {
        font-size: 0.9rem;
      }
    }
  }
}

.preview-section {
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
  border-left: 3px solid #007bff;

  h4 {
    margin: 0 0 0.75rem 0;
    font-size: 0.9rem;
  }

  .preview-box {
    background: white;
    padding: 0.75rem;
    border-radius: 4px;
    border: 1px solid #ddd;

    .preview-label {
      margin: 0 0 0.5rem 0;
      font-size: 0.8rem;
      font-weight: bold;
      color: #999;
    }

    .preview-text {
      margin: 0;
      font-size: 0.9rem;
      word-break: break-word;
      color: #333;
    }
  }
}

.dialog-footer {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #ddd;
  background: #f9f9f9;

  button {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.9rem;

    &.btn-primary {
      background: #007bff;
      color: white;

      &:hover {
        background: #0056b3;
      }
    }

    &.btn-secondary {
      background: #6c757d;
      color: white;

      &:hover {
        background: #545b62;
      }
    }
  }
}
</style>
