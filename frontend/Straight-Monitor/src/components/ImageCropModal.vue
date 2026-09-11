<template>
  <ModalFrame
    title="Profilbild hochladen"
    size="sm"
    style="--mf-max-width: 540px; --mf-body-padding: 20px"
    @close="$emit('close')"
  >
    <div v-if="!imageSrc" class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="onDrop">
      <font-awesome-icon icon="fa-solid fa-cloud-arrow-up" class="upload-icon" />
      <p>Bild hierher ziehen oder klicken</p>
      <small>JPEG, PNG, WebP oder GIF – max. 10 MB</small>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden-input" @change="onFileSelect" />
    </div>

    <div v-else class="cropper-wrapper">
      <VueCropper
        ref="cropper"
        :img="imageSrc"
        :autoCrop="true"
        :autoCropWidth="280"
        :autoCropHeight="280"
        :fixed="true"
        :fixedNumber="[1, 1]"
        :centerBox="true"
        :canScale="true"
        :canMove="true"
        :canMoveBox="true"
        :info="true"
        :outputType="'png'"
        :outputSize="1"
        :high="true"
        :maxImgSize="2000"
      />
    </div>

    <template #footer>
      <button v-if="imageSrc" class="btn btn-ghost" type="button" @click="resetImage">
          <font-awesome-icon icon="fa-solid fa-rotate-left" /> Anderes Bild
      </button>
      <div class="footer-right">
        <button class="btn btn-ghost" type="button" @click="$emit('close')">Abbrechen</button>
        <button class="btn btn-primary" type="button" :disabled="!imageSrc || uploading" @click="uploadCropped">
          <font-awesome-icon :icon="uploading ? 'fa-solid fa-spinner' : 'fa-solid fa-check'" :class="{ 'fa-spin': uploading }" />
          {{ uploading ? 'Wird hochgeladen…' : 'Hochladen' }}
        </button>
      </div>
    </template>
  </ModalFrame>
</template>

<script>
import { VueCropper } from "vue-cropper";
import "vue-cropper/dist/index.css";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faTimes, faCloudArrowUp, faRotateLeft, faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import api from "@/utils/api";
import ModalFrame from "@/components/frames/ModalFrame.vue";

library.add(faTimes, faCloudArrowUp, faRotateLeft, faCheck, faSpinner);

export default {
  name: "ImageCropModal",
  components: { VueCropper, FontAwesomeIcon, ModalFrame },
  props: {
    mitarbeiterId: { type: String, required: true },
  },
  emits: ["close", "uploaded"],

  data() {
    return {
      imageSrc: "",
      uploading: false,
    };
  },

  methods: {
    triggerFileInput() {
      this.$refs.fileInput.click();
    },

    onFileSelect(e) {
      const file = e.target.files?.[0];
      if (file) this.loadFile(file);
    },

    onDrop(e) {
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) this.loadFile(file);
    },

    loadFile(file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Datei ist zu groß (max. 10 MB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.imageSrc = ev.target.result;
      };
      reader.readAsDataURL(file);
    },

    resetImage() {
      this.imageSrc = "";
    },

    async uploadCropped() {
      if (!this.$refs.cropper) return;
      this.uploading = true;

      try {
        // Get the cropped blob from vue-cropper
        const blob = await new Promise((resolve) => {
          this.$refs.cropper.getCropBlob(resolve);
        });

        const formData = new FormData();
        formData.append("image", blob, "profilbild.png");

        const res = await api.post(
          `/api/personal/mitarbeiter/${this.mitarbeiterId}/profilbild`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );

        if (res.data?.success) {
          this.$emit("uploaded", res.data.profilbild);
        }
      } catch (err) {
        console.error("Profilbild-Upload fehlgeschlagen:", err);
        alert("Upload fehlgeschlagen. Bitte versuche es erneut.");
      } finally {
        this.uploading = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">

.upload-area {
  border: 2px dashed var(--border, #d0d0d0);
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: 150ms ease;
  color: var(--muted, #888);

  &:hover {
    border-color: var(--primary, #f08c00);
    background: color-mix(in srgb, var(--primary, #f08c00) 5%, transparent);
  }

  .upload-icon {
    font-size: 2.5rem;
    margin-bottom: 12px;
    color: var(--primary, #f08c00);
  }

  p {
    margin: 0 0 4px;
    font-weight: 600;
    color: var(--text, #333);
  }

  small {
    font-size: 0.8rem;
  }
}

.hidden-input {
  display: none;
}

.cropper-wrapper {
  width: 100%;
  height: 400px;
  border-radius: 10px;
  overflow: hidden;
  background: #1a1a1a;
}

.footer-right {
  display: flex;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: 120ms ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost {
  background: transparent;
  color: var(--text, #333);

  &:hover:not(:disabled) {
    background: var(--hover, #f0f0f0);
  }
}

.btn-primary {
  background: var(--primary, #f08c00);
  color: #fff;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }
}
</style>
