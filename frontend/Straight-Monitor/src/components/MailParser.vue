<template>
  <div class="mail-parser">
    <!-- View Header with Controls -->
    <div class="view-header">
      <div class="header-top">
        <h2>E-Mail Vorschau</h2>
        <div class="header-actions">
          <div v-if="lastSaveTime" class="save-status">
            <font-awesome-icon icon="floppy-disk" />
            <span>{{ lastSaveTime }}</span>
          </div>
          <button 
            @click="clearStorage" 
            class="btn-clear"
            title="Gespeicherte Sitzung löschen"
          >
            <font-awesome-icon :icon="['fas', 'times']" />
            Löschen
          </button>
          <button 
            v-if="emailHtml"
            @click="showRawData = !showRawData" 
            class="btn-inspector"
            title="E-Mail-Daten anzeigen/ausblenden"
          >
            <font-awesome-icon :icon="showRawData ? 'chevron-up' : 'chevron-down'" />
            {{ showRawData ? 'Ausblenden' : 'Anzeigen' }} Details
          </button>
        </div>
      </div>

      <!-- Email Source Controls -->
      <div class="email-controls">
        <button @click="fetchLatestParserEmail" class="btn-fetch" :disabled="fetchingEmail">
          <font-awesome-icon :icon="fetchingEmail ? 'spinner' : 'download'" :spin="fetchingEmail" />
          {{ fetchingEmail ? 'Lädt...' : 'Letzte abrufen' }}
        </button>
        <button @click="loadCachedEmails" class="btn-fetch" :disabled="fetchingEmail">
          <font-awesome-icon icon="sync" />
          Liste aktualisieren
        </button>
        <select v-model="selectedParserEmailId" @change="loadSelectedEmail" class="email-select">
          <option value="">Aus Mailbox wählen ({{ cachedEmails.length }})...</option>
          <option v-for="email in cachedEmails" :key="email.id" :value="email.id">
            {{ email.subject }} - {{ formatDate(email.receivedDateTime) }}
          </option>
        </select>
        <p class="hint">Test-E-Mails an <strong>parser@straightforward.email</strong> senden</p>
      </div>
    </div>

    <!-- Email Details Panel (collapsible) -->
    <div v-if="showRawData && currentEmail" class="email-details">
      <div class="details-header">
        <div class="detail-row">
          <span class="label">Von:</span>
          <span class="value">{{ currentEmail?.from?.name || currentEmail?.from?.address }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Betreff:</span>
          <span class="value">{{ currentEmail?.subject }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Empfangen:</span>
          <span class="value">{{ formatDate(currentEmail?.receivedDateTime) }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Email Content Preview (like Outlook) -->
      <div v-if="emailHtml" class="email-content-wrapper" @mouseup="handleTextSelection">
        <div class="email-content" v-html="emailHtml"></div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <font-awesome-icon icon="envelope" />
        <p>Keine E-Mail geladen. Rufen Sie oben eine E-Mail aus der Mailbox ab, um ihren Inhalt anzuzeigen.</p>
      </div>

      <!-- Values Panel (Right Sidebar) -->
      <div class="values-panel">
        <div class="values-header">
          <h3>Extrahierte Werte</h3>
          <span class="count">{{ extractedValues.length }}</span>
        </div>

        <div v-if="extractedValues.length > 0" class="test-button-container">
          <button @click="startTestMode" class="btn-test" title="Mit einer anderen E-Mail testen">
            <font-awesome-icon icon="flask" /> Testen
          </button>
        </div>

        <div v-if="extractedValues.length === 0" class="empty-values">
          <font-awesome-icon icon="hand-pointer" />
          <p>Wählen Sie Text in der E-Mail aus und klicken Sie auf „Wert setzen", um ihn zu extrahieren</p>
        </div>

        <div v-else class="values-list">
          <div v-for="(value, idx) in extractedValues" :key="idx" class="value-pair">
            <button @click="removeValue(idx)" class="btn-remove-top-right" title="Entfernen">
              <font-awesome-icon :icon="['fas', 'times']" />
            </button>
            <div class="pair-content">
              <div class="pair-name">
                <label>Feldname</label>
                <input 
                  :ref="(el) => { if (idx === extractedValues.length - 1 && needsFocus) nameInputRefs[idx] = el; }"
                  v-model="value.name" 
                  type="text" 
                  class="value-name"
                  placeholder="z.B. E-Mail, Telefon, Name..."
                />
              </div>
              <div class="pair-value">
                <label>Extrahierter Wert</label>
                <div class="value-display">
                  <span class="value-text">{{ truncateText(value.text, 150) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Test Mode Panel (Modal) -->
    <div v-if="testMode" class="test-mode-overlay">
      <div class="test-mode-modal-large">
        <div class="modal-header">
          <h3>E-Mail zum Extrahieren wählen</h3>
          <button @click="exitTestMode" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <div class="modal-content-large">
          <!-- Email Selection and Preview -->
          <div class="test-email-section">
            <div class="section-header">
              <h4>E-Mail auswählen und in der Vorschau anzeigen</h4>
            </div>

            <div class="email-selector">
              <select v-model="selectedParserEmailId" class="email-select-test">
                <option value="">E-Mail wählen...</option>
                <option v-for="email in cachedEmails" :key="email.id" :value="email.id">
                  {{ email.subject }} - {{ formatDate(email.receivedDateTime) }}
                </option>
              </select>
              <button @click="loadTestEmail" class="btn-load" :disabled="!selectedParserEmailId || fetchingEmail">
                <font-awesome-icon :icon="fetchingEmail ? 'spinner' : 'download'" :spin="fetchingEmail" />
                {{ fetchingEmail ? 'Lädt...' : 'Laden' }}
              </button>
            </div>

            <div v-if="testModeEmail" class="email-info">
              <div class="info-row">
                <span class="label">Von:</span>
                <span>{{ testModeEmail.from?.name || testModeEmail.from?.address }}</span>
              </div>
              <div class="info-row">
                <span class="label">Betreff:</span>
                <span>{{ testModeEmail.subject }}</span>
              </div>
              <div class="info-row">
                <span class="label">Datum:</span>
                <span>{{ formatDate(testModeEmail.receivedDateTime) }}</span>
              </div>
            </div>

            <div v-if="testModeHtml" class="email-preview-container">
              <div class="email-preview-content" v-html="testModeHtml"></div>
            </div>

            <div v-else-if="!testModeHtml && selectedParserEmailId" class="placeholder">
              <p>E-Mail-Vorschau wird geladen...</p>
            </div>

            <div v-else class="placeholder">
              <p>Wählen Sie eine E-Mail zur Vorschau aus</p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="test-actions-section">
            <button @click="useSelectedEmail" class="btn-use-email" :disabled="!testModeHtml">
              <font-awesome-icon icon="check" /> Diese E-Mail verwenden
            </button>
            <button @click="exitTestMode" class="btn-cancel-test">
              <font-awesome-icon icon="times" /> Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Selection Menu -->
    <div 
      v-if="showSelectionMenu"
      class="selection-quick-menu"
      :style="{ 
        position: 'fixed',
        left: selectionMenuX + 'px',
        top: selectionMenuY + 'px',
        zIndex: 10000
      }"
      @mouseleave="showSelectionMenu = false"
    >
      <div class="selection-menu-content">
        <div class="selection-text">{{ selectedText }}</div>
        <button @click="setValueFromSelection" class="quick-action-btn set-value">
          <font-awesome-icon icon="database" /> Wert setzen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import api from '@/utils/api';

// State - Email Display
const emailHtml = ref('');
const currentEmail = ref<any>(null);
const showRawData = ref(false);

// State - Email Loading
const fetchingEmail = ref(false);
const cachedEmails = ref<any[]>([]);
const selectedParserEmailId = ref('');

// State - Value Extraction
interface ExtractedValue {
  name: string;
  text: string;
}

const extractedValues = ref<ExtractedValue[]>([]);
const showSelectionMenu = ref(false);
const selectionMenuX = ref(0);
const selectionMenuY = ref(0);
const selectedText = ref('');
const lastSaveTime = ref('');
const nameInputRefs = ref<any>({});
const needsFocus = ref(false);
const testMode = ref(false);
const testModeEmail = ref<any>(null);
const testModeHtml = ref('');

// HTML Structure Analysis for Pattern Recognition

interface HTMLNode {
  tag: string;
  attributes: Record<string, string>;
  children: HTMLNode[];
  textContent?: string;
  index?: number;
}

/**
 * Convert HTML string to DOM structure with simplified representation
 */
function parseHTMLStructure(html: string): HTMLNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const nodes: HTMLNode[] = [];
  let nodeIndex = 0;

  function traverse(element: Element): HTMLNode[] {
    const children: HTMLNode[] = [];
    
    for (let child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        
        // Skip script and style tags
        if (['script', 'style', 'meta', 'link'].includes(tag)) continue;
        
        const node: HTMLNode = {
          tag,
          attributes: {},
          children: [],
          index: nodeIndex++
        };
        
        // Store important attributes
        if (el.className) node.attributes.class = el.className;
        if (el.id) node.attributes.id = el.id;
        
        // Get direct text content (immediate children only)
        const textContent = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => (n as Text).textContent?.trim())
          .filter(t => t && t.length > 0)
          .join(' ');
        
        if (textContent) {
          node.textContent = textContent;
        }
        
        node.children = traverse(el);
        children.push(node);
      }
    }
    
    return children;
  }
  
  return traverse(doc.body);
}

/**
 * Create a signature of HTML structure (ignoring text content)
 */
function createStructureSignature(nodes: HTMLNode[]): string {
  return nodes.map(node => {
    const classStr = node.attributes.class ? `.${node.attributes.class.replace(/\s+/g, '.')}` : '';
    const idStr = node.attributes.id ? `#${node.attributes.id}` : '';
    const childSig = node.children.length > 0 ? `(${node.children.length})` : '';
    return `${node.tag}${idStr}${classStr}${childSig}`;
  }).join('|');
}

/**
 * Find matching HTML structure patterns in a tree (with fallback to lenient matching)
 */
function findStructureMatch(
  sourceNodes: HTMLNode[],
  targetNodes: HTMLNode[],
  minLength = 3
): { startIdx: number; endIdx: number; score: number } | null {
  const sourceSignature = createStructureSignature(sourceNodes);
  let bestMatch = { startIdx: -1, endIdx: -1, score: 0 };

  // Try to find the source pattern in target with strict matching
  for (let i = 0; i < targetNodes.length; i++) {
    for (let j = i + minLength; j <= Math.min(targetNodes.length, i + sourceNodes.length + 5); j++) {
      const targetSignature = createStructureSignature(targetNodes.slice(i, j));
      
      // Calculate similarity score
      const score = calculateSimilarity(sourceSignature, targetSignature);
      
      if (score > bestMatch.score) {
        bestMatch = { startIdx: i, endIdx: j, score };
      }
    }
  }

  // If strict matching failed, use lenient matching: just use entire target
  if (bestMatch.score <= 0.6) {
    return {
      startIdx: 0,
      endIdx: targetNodes.length,
      score: 0.5 // Lower score indicates fallback match
    };
  }

  return bestMatch;
}

/**
 * Simple similarity score between two strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        const newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          costs[j - 1] = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        lastValue = costs[j];
      }
    }
  }
  
  return costs[s2.length];
}

/**
 * Find text within nodes matching a pattern
 */
function findTextInNodes(nodes: HTMLNode[], targetTag: string, targetClass?: string): string | null {
  for (let node of nodes) {
    if (node.tag === targetTag) {
      if (targetClass && !node.attributes.class?.includes(targetClass)) {
        continue;
      }
      
      if (node.textContent) {
        return node.textContent.substring(0, 100);
      }
    }
    
    const childResult = findTextInNodes(node.children, targetTag, targetClass);
    if (childResult) return childResult;
  }
  
  return null;
}

/**
 * Extract values from target email using source patterns
 */
function autoParseEmail(
  sourceHtml: string,
  targetHtml: string,
  sourceValues: ExtractedValue[]
): ExtractedValue[] {
  try {
    const sourceNodes = parseHTMLStructure(sourceHtml);
    const targetNodes = parseHTMLStructure(targetHtml);
    
    if (!sourceNodes || sourceNodes.length === 0 || !targetNodes || targetNodes.length === 0) {
      console.warn('Source or target nodes are empty');
      return [];
    }
    
    // Find matching section in target
    const match = findStructureMatch(sourceNodes, targetNodes);
    
    if (!match) {
      console.warn('Could not find matching structure. No match found.');
      return [];
    }

    const matchedTargetNodes = targetNodes.slice(match.startIdx, match.endIdx);
    const results: ExtractedValue[] = [];

    // For each extracted value, find its location pattern and extract from target
    sourceValues.forEach((value) => {
      const pattern = findTextLocationPattern(sourceNodes, value.text);
      
      if (pattern) {
        // First try structured search
        let extractedText = findTextInNodes(
          matchedTargetNodes,
          pattern.tag,
          pattern.class
        );
        
        // Fallback to flexible text search if structured search fails
        if (!extractedText) {
          extractedText = findSimilarText(matchedTargetNodes, value.text);
        }
        
        if (extractedText) {
          results.push({
            name: value.name,
            text: extractedText
          });
        }
      }
    });

    return results;
  } catch (error) {
    console.error('Auto-parse error:', error);
    return [];
  }
}

/**
 * Find the HTML location pattern of a text value
 */
function findTextLocationPattern(nodes: HTMLNode[], text: string): any {
  function search(nodes: HTMLNode[]): any {
    for (let node of nodes) {
      if (node.textContent && node.textContent.includes(text.substring(0, Math.min(20, text.length)))) {
        return {
          tag: node.tag,
          class: node.attributes.class?.split(' ')[0]
        };
      }
      
      const childResult = search(node.children);
      if (childResult) return childResult;
    }
    return null;
  }
  
  return search(nodes);
}

/**
 * Fallback: Find similar text in nodes by searching all text content
 */
function findSimilarText(nodes: HTMLNode[], targetText: string): string | null {
  const searchKey = targetText.substring(0, Math.min(15, targetText.length)).toLowerCase();
  
  function search(nodes: HTMLNode[]): string | null {
    for (let node of nodes) {
      if (node.textContent) {
        const nodeText = node.textContent.toLowerCase();
        // Check if any part of the target text appears in this node
        if (nodeText.includes(searchKey)) {
          return node.textContent.substring(0, 100).trim();
        }
      }
      
      const childResult = search(node.children);
      if (childResult) return childResult;
    }
    return null;
  }
  
  return search(nodes);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function truncateText(text: string, length: number): string {
  return text.length > length ? text.substring(0, length) + '...' : text;
}

function handleTextSelection() {
  const selection = window.getSelection();
  const selectedTextContent = selection?.toString().trim();

  if (selectedTextContent && selectedTextContent.length > 0) {
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    
    if (rect) {
      selectedText.value = selectedTextContent;
      selectionMenuX.value = rect.left + rect.width / 2 - 100;
      selectionMenuY.value = rect.bottom + 10;
      showSelectionMenu.value = true;
    }
  }
}

function setValueFromSelection() {
  if (selectedText.value) {
    extractedValues.value.push({
      name: '',
      text: selectedText.value
    });
    showSelectionMenu.value = false;
    selectedText.value = '';
    
    // Focus the newly added name input field
    needsFocus.value = true;
    nextTick(() => {
      const lastIdx = extractedValues.value.length - 1;
      const inputElement = nameInputRefs.value[lastIdx];
      if (inputElement) {
        inputElement.focus();
      }
      needsFocus.value = false;
    });
  }
}

function removeValue(index: number) {
  extractedValues.value.splice(index, 1);
}

// Test Mode Functions
function startTestMode() {
  testMode.value = true;
  testModeEmail.value = null;
  testModeHtml.value = '';
  selectedParserEmailId.value = '';
}

function exitTestMode() {
  testMode.value = false;
  testModeEmail.value = null;
  testModeHtml.value = '';
  selectedParserEmailId.value = '';
}

async function loadTestEmail() {
  if (!selectedParserEmailId.value) {
    alert('Please select an email first');
    return;
  }

  if (selectedParserEmailId.value === currentEmail.value?.id) {
    alert('Please select a different email than the current one');
    return;
  }
  
  fetchingEmail.value = true;
  try {
    const response = await api.get(`/api/graph/parser/emails-full/${selectedParserEmailId.value}`);
    if (response.data.ok) {
      const email = response.data.email;
      testModeEmail.value = email;
      testModeHtml.value = email.bodyHtml || email.body;
    }
  } catch (error: any) {
    console.error('Failed to load test email:', error);
    alert(`Error: ${error.response?.data?.error || 'Failed to load email'}`);
  } finally {
    fetchingEmail.value = false;
  }
}

function useSelectedEmail() {
  if (!testModeHtml.value || !testModeEmail.value) {
    alert('Please load an email first');
    return;
  }
  
  // Load test email into main panel
  emailHtml.value = testModeHtml.value;
  currentEmail.value = testModeEmail.value;
  
  // Add to cached emails if not already there
  if (!cachedEmails.value.find(e => e.id === testModeEmail.value?.id)) {
    cachedEmails.value.unshift(testModeEmail.value);
  }
  
  saveToStorage();
  exitTestMode();
}


// API Functions
async function fetchLatestParserEmail() {
  fetchingEmail.value = true;
  try {
    const response = await api.get('/api/graph/parser/fetch');
    if (response.data.ok && response.data.email) {
      const email = response.data.email;
      emailHtml.value = email.bodyHtml || email.body;
      currentEmail.value = email;
      
      // Add to cached emails if not already there
      if (!cachedEmails.value.find(e => e.id === email.id)) {
        cachedEmails.value.unshift(email);
      }
    } else {
      alert('No emails found in parser mailbox');
    }
  } catch (error: any) {
    console.error('Failed to fetch parser email:', error);
    alert(`Error: ${error.response?.data?.error || 'Failed to fetch email'}`);
  } finally {
    fetchingEmail.value = false;
  }
}

async function loadCachedEmails() {
  try {
    const response = await api.get('/api/graph/parser/list');
    if (response.data.ok) {
      cachedEmails.value = response.data.emails || [];
    }
  } catch (error: any) {
    console.error('Failed to load mailbox emails:', error);
  }
}

async function loadSelectedEmail() {
  if (!selectedParserEmailId.value) return;
  
  fetchingEmail.value = true;
  try {
    const response = await api.get(`/api/graph/parser/emails-full/${selectedParserEmailId.value}`);
    if (response.data.ok) {
      const email = response.data.email;
      emailHtml.value = email.bodyHtml || email.body;
      currentEmail.value = email;
    }
  } catch (error: any) {
    console.error('Failed to load email body:', error);
    alert(`Error: ${error.response?.data?.error || 'Failed to load email'}`);
  } finally {
    fetchingEmail.value = false;
  }
}

// Storage Functions
const STORAGE_KEY = 'mailparser_session';

interface StorageData {
  emailHtml: string;
  currentEmail: any;
  extractedValues: ExtractedValue[];
  timestamp: number;
}

function saveToStorage() {
  const data: StorageData = {
    emailHtml: emailHtml.value,
    currentEmail: currentEmail.value,
    extractedValues: extractedValues.value,
    timestamp: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  lastSaveTime.value = new Date(data.timestamp).toLocaleTimeString();
}

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: StorageData = JSON.parse(stored);
      emailHtml.value = data.emailHtml || '';
      currentEmail.value = data.currentEmail || null;
      extractedValues.value = data.extractedValues || [];
      lastSaveTime.value = new Date(data.timestamp).toLocaleTimeString();
      return true;
    }
  } catch (error) {
    console.error('Failed to load from storage:', error);
  }
  return false;
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
  emailHtml.value = '';
  currentEmail.value = null;
  extractedValues.value = [];
  lastSaveTime.value = '';
}

function getLastSaveTime(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: StorageData = JSON.parse(stored);
      return new Date(data.timestamp).toLocaleString();
    }
  } catch (error) {
    console.error('Failed to get save time:', error);
  }
  return '';
}

// Watch for changes and auto-save
watch([emailHtml, extractedValues], () => {
  saveToStorage();
}, { deep: true });

// Prevent body scroll when modal is open
watch(testMode, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

// Convert value names to lowercase
watch(extractedValues, (values) => {
  values.forEach(value => {
    if (value.name && value.name !== value.name.toLowerCase()) {
      value.name = value.name.toLowerCase();
    }
  });
}, { deep: true });

// Initialize
loadCachedEmails();
loadFromStorage();
</script>

<style scoped lang="scss">
@import "@/assets/styles/global.scss";

.mail-parser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.view-header {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem 1.5rem;
    border-bottom: 1px solid var(--border);

    h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text);
    }

    .header-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;

      .save-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 1rem;
        background: color-mix(in srgb, var(--primary) 15%, var(--panel));
        border-radius: 6px;
        font-size: 0.85rem;
        color: var(--primary);
        font-weight: 600;

        svg {
          font-size: 0.9rem;
        }
      }

      .btn-clear {
        padding: 0.6rem 1.2rem;
        background: var(--hover);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;

        &:hover {
          background: color-mix(in srgb, #dc3545 10%, var(--hover));
          border-color: #dc3545;
          color: #dc3545;
        }
      }

      .btn-inspector {
        padding: 0.6rem 1.2rem;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s;

        &:hover {
          background: color-mix(in srgb, var(--primary) 90%, black);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }
      }
    }
  }

  .email-controls {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    align-items: center;
    flex-wrap: wrap;
    background: var(--bg);

    .btn-fetch {
      padding: 0.6rem 1.2rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary) 90%, black);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .email-select {
      flex: 1;
      min-width: 300px;
      padding: 0.6rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.9rem;
      background: var(--panel);
      color: var(--text);
    }

    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--muted);
      font-style: italic;
      flex: 1;
      min-width: 100%;

      strong {
        color: var(--primary);
        font-weight: 600;
      }
    }
  }
}

.email-details {
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  padding: 1rem 1.5rem;
  max-height: 200px;
  overflow-y: auto;

  .details-header {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    .detail-row {
      display: flex;
      gap: 1rem;
      padding: 0.75rem;
      background: var(--bg);
      border-radius: 6px;
      border: 1px solid var(--border);

      .label {
        font-weight: 600;
        min-width: 100px;
        color: var(--muted);
        font-size: 0.85rem;
        text-transform: uppercase;
      }

      .value {
        flex: 1;
        word-break: break-word;
        color: var(--text);
      }
    }
  }
}

// Main Content Area with Two Panels
.main-content {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
  background: var(--bg);

  // Email Preview on the left
  .email-content-wrapper {
    flex: 1;
    overflow: auto;
    background: var(--panel);
    display: flex;
    min-width: 0;
    border-right: 2px solid var(--border);

    .email-content {
      width: 100%;
      padding: 2rem 2.5rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      font-size: 0.95rem;
      line-height: 1.6;
      color: #333;
      user-select: text;

      // Ensure email HTML renders properly (like Outlook)
      ::deep {
        // Reset and normalize email content styles
        * {
          box-sizing: border-box;
        }

        // Headings
        h1, h2, h3, h4, h5, h6 {
          margin: 0.75rem 0;
          color: #222;
          font-weight: 600;
        }

        h1 { font-size: 1.75rem; }
        h2 { font-size: 1.5rem; }
        h3 { font-size: 1.25rem; }
        h4 { font-size: 1.1rem; }
        h5 { font-size: 1rem; }
        h6 { font-size: 0.95rem; }

        // Paragraphs
        p {
          margin: 0.75rem 0;
        }

        // Lists
        ul, ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        li {
          margin: 0.3rem 0;
        }

        // Links
        a {
          color: #0066cc;
          text-decoration: none;

          &:hover {
            text-decoration: underline;
          }
        }

        // Code blocks
        code {
          background: #f4f4f4;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.9em;
        }

        pre {
          background: #f4f4f4;
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          margin: 0.75rem 0;

          code {
            background: transparent;
            padding: 0;
          }
        }

        // Tables
        table {
          border-collapse: collapse;
          margin: 1rem 0;
          width: 100%;
        }

        th {
          background: #f0f0f0;
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          border: 1px solid #ddd;
        }

        td {
          padding: 0.75rem;
          border: 1px solid #ddd;
        }

        tr:nth-child(even) {
          background: #fafafa;
        }

        // Blockquotes
        blockquote {
          border-left: 4px solid #ddd;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #666;
        }

        // Images
        img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 0.5rem 0;
        }

        // Horizontal rule
        hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 1rem 0;
        }

        // Remove unwanted margins from email signatures
        .signature {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 0.9rem;
        }

        // Remove quote markers that appear in forwarded emails
        .moz-cite-prefix {
          color: #666;
        }
      }
    }
  }

  // Values Panel on the right
  .values-panel {
    width: 380px;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .values-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 1.25rem;
      background: var(--panel);
      border-bottom: 2px solid var(--border);

      h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text);
        letter-spacing: 0.3px;
      }

      .count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 28px;
        background: var(--primary);
        color: white;
        border-radius: 14px;
        font-size: 0.9rem;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
    }

    .test-button-container {
      padding: 1rem 1.25rem;
      background: var(--panel);
      border-bottom: 1px solid var(--border);

      .btn-test {
        width: 100%;
        padding: 0.85rem 1rem;
        background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 90%, black) 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-size: 0.95rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }

    .empty-values {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
      text-align: center;
      color: var(--muted);

      svg {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.3;
        color: var(--muted);
      }

      p {
        font-size: 0.9rem;
        margin: 0;
        line-height: 1.5;
        max-width: 280px;
      }
    }

    .values-list {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: var(--bg);

      // Custom scrollbar
      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: var(--bg);
      }

      &::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 3px;

        &:hover {
          background: var(--muted);
        }
      }

      .value-pair {
        position: relative;
        background: var(--panel);
        border-radius: 8px;
        padding: 1rem;
        border: 1px solid var(--border);
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

        &:hover {
          border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transform: translateY(-1px);
        }

        .btn-remove-top-right {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          width: 24px;
          height: 24px;
          padding: 0;
          background: transparent;
          color: #333;
          border: none;
          border-radius: 0;
          cursor: pointer;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 20;
          opacity: 0.6;

          &:hover {
            opacity: 1;
            color: #000;
          }
        }

        .pair-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding-right: 1.5rem;

          .pair-name {
            width: 100%;

            label {
              display: block;
              font-size: 0.75rem;
              font-weight: 600;
              color: var(--muted);
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 0.4rem;
            }

            .value-name {
              width: 100%;
              padding: 0.65rem 0.85rem;
              border: 1.5px solid var(--border);
              border-radius: 6px;
              font-size: 0.9rem;
              font-weight: 600;
              background: var(--bg);
              color: var(--text);
              transition: all 0.2s;

              &:focus {
                outline: none;
                border-color: var(--primary);
                background: var(--panel);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
              }

              &::placeholder {
                color: var(--muted);
                font-weight: 400;
                font-style: italic;
              }
            }
          }

          .pair-value {
            width: 100%;
            
            label {
              display: block;
              font-size: 0.75rem;
              font-weight: 600;
              color: var(--muted);
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 0.4rem;
            }

            .value-display {
              padding: 0.75rem 0.85rem;
              background: color-mix(in srgb, var(--primary) 5%, var(--bg));
              border: 1.5px solid color-mix(in srgb, var(--primary) 20%, var(--border));
              border-radius: 6px;
              min-height: 3rem;
              display: flex;
              align-items: center;

              .value-text {
                display: block;
                font-size: 0.9rem;
                color: var(--text);
                word-break: break-word;
                line-height: 1.5;
                font-weight: 500;
              }
            }
          }
        }
      }
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;

  svg {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  p {
    font-size: 1rem;
    text-align: center;
  }
}

// Quick Selection Menu
.selection-quick-menu {
  background: white;
  border: 2px solid #007bff;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  animation: slideIn 0.15s ease-out;

  .selection-menu-content {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.5rem;
    min-width: 200px;

    .selection-text {
      padding: 0.5rem;
      background: #f0f8ff;
      border-radius: 3px;
      font-size: 0.85rem;
      font-weight: 500;
      color: #007bff;
      border-left: 3px solid #007bff;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .quick-action-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      &.set-value {
        background: #28a745;
        color: white;

        &:hover {
          background: #218838;
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
      }
    }
  }
}

// Test Mode Modal
.test-mode-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;

  .test-mode-modal-large {
    background: var(--panel);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 1200px;
    height: 85vh;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
    border: 1px solid var(--border);

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      background: var(--primary);
      color: white;
      border-radius: 12px 12px 0 0;

      h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
      }

      .btn-close {
        background: transparent;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover {
          opacity: 0.8;
          transform: scale(1.1);
        }
      }
    }

    .modal-content-large {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      overflow: hidden;
      background: var(--border);
      height: 100%;

      .test-email-section {
        flex: 0 0 45%;
        background: var(--panel);
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .section-header {
          padding: 1rem 1.2rem;
          background: var(--bg);
          border-bottom: 1px solid var(--border);

          h4 {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text);
            font-weight: 600;
          }
        }

        .email-selector {
          display: flex;
          gap: 0.5rem;
          padding: 1rem;
          border-bottom: 1px solid var(--border);

          .email-select-test {
            flex: 1;
            padding: 0.6rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 0.9rem;
            background: var(--panel);
            color: var(--text);
          }

          .btn-load {
            padding: 0.6rem 1rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            white-space: nowrap;
            transition: all 0.2s;
            font-size: 0.9rem;

            &:hover:not(:disabled) {
              background: color-mix(in srgb, var(--primary) 90%, black);
              transform: translateY(-1px);
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            }

            &:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
          }
        }

        .email-info {
          padding: 1rem;
          background: color-mix(in srgb, var(--primary) 8%, var(--panel));
          border-bottom: 1px solid var(--border);

          .info-row {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;

            &:last-child {
              margin-bottom: 0;
            }

            .label {
              font-weight: 600;
              color: var(--muted);
              min-width: 70px;
            }
          }
        }

        .email-preview-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;

          .email-preview-content {
            font-size: 0.9rem;
            line-height: 1.5;
            color: var(--text);

            ::deep {
              p { margin: 0.5rem 0; }
              div { margin: 0.5rem 0; }
              br { margin: 0.25rem 0; }
            }
          }
        }

        .placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          text-align: center;
        }
      }

      .test-results-section {
        flex: 1;
        background: var(--panel);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        .section-header {
          padding: 1rem 1.2rem;
          background: var(--bg);
          border-bottom: 1px solid var(--border);

          h4 {
            margin: 0;
            font-size: 0.95rem;
            color: var(--text);
            font-weight: 600;
          }
        }

        .no-results-large {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: var(--muted);

          svg {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }

          p {
            margin: 0 0 1rem 0;
            font-size: 0.95rem;
          }

          .btn-run-parser {
            padding: 0.75rem 1.5rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;

            &:hover {
              background: color-mix(in srgb, var(--primary) 90%, black);
              transform: translateY(-1px);
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
            }
          }
        }

        .auto-parse-results-large {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 1rem;
          gap: 1rem;

          .results-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: color-mix(in srgb, var(--primary) 15%, var(--panel));
            color: var(--primary);
            border-radius: 6px;
            border: 1px solid color-mix(in srgb, var(--primary) 25%, var(--border));

            .results-info {
              font-weight: 600;
            }

            .results-match-quality {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              font-size: 0.9rem;

              .quality-badge {
                padding: 0.25rem 0.75rem;
                background: var(--primary);
                color: white;
                border-radius: 3px;
                font-weight: 600;
                font-size: 0.85rem;
              }
            }
          }

          .results-list-large {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.5rem;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg);

            .result-item-large {
              background: var(--panel);
              border: 1px solid var(--border);
              border-radius: 6px;
              padding: 0.75rem;
              display: flex;
              flex-direction: column;
              gap: 0.5rem;

              .result-header {
                display: flex;
                justify-content: space-between;
                align-items: center;

                .result-name {
                  font-weight: 600;
                  color: var(--text);
                  font-size: 0.9rem;
                }

                .result-confidence {
                  background: var(--primary);
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 3px;
                  font-weight: 600;
                  font-size: 0.75rem;
                  min-width: 45px;
                  text-align: center;
                }
              }

              .result-values {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.85rem;

                .old-value,
                .new-value {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  gap: 0.25rem;
                  padding: 0.5rem;
                  background: var(--bg);
                  border-radius: 3px;

                  .value-label {
                    font-weight: 600;
                    color: var(--muted);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                  }

                  .value-text {
                    color: var(--text);
                    word-break: break-word;
                  }
                }

                .arrow {
                  color: var(--muted);
                  font-size: 1.2rem;
                }
              }
            }
          }

          .feedback-section {
            padding: 0.75rem 1rem;
            background: color-mix(in srgb, var(--primary) 10%, var(--panel));
            border-radius: 6px;
            border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));

            .checkbox {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              cursor: pointer;
              font-size: 0.9rem;
              color: var(--text);

              input {
                cursor: pointer;
              }

              span {
                font-weight: 500;
              }
            }
          }

          .results-actions-large {
            display: flex;
            gap: 0.5rem;

            button {
              flex: 1;
              padding: 0.75rem;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
              transition: all 0.2s;
              font-size: 0.9rem;
            }

            .btn-confirm {
              background: color-mix(in srgb, #28a745 100%, transparent);
              color: white;

              &:hover {
                background: color-mix(in srgb, #228735 100%, transparent);
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
              }
            }

            .btn-retry-large {
              background: color-mix(in srgb, #ffc107 100%, transparent);
              color: #333;

              &:hover {
                background: color-mix(in srgb, #ffb300 100%, transparent);
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
              }
            }

            .btn-cancel {
              background: color-mix(in srgb, #dc3545 100%, transparent);
              color: white;

              &:hover {
                background: color-mix(in srgb, #c82333 100%, transparent);
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
              }
            }
          }
        }
      }
    }
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
