<template>
  <ModalFrame
    v-if="mitarbeiterId && (hosted || !delegated)"
    class="employee-card-modal"
    size="lg"
    aria-label="Mitarbeiterprofil"
    :show-close="false"
    minimizable
    :minimize-title="minimizeTitle"
    style="--mf-max-height: 92dvh; --mf-body-padding: 0; --mf-minimize-right: 56px"
    @close="handleClose"
  >
    <EmployeeCard
      :mitarbeiterId="mitarbeiterId"
      :initiallyExpanded="true"
      :showClose="true"
      style="border: 0; border-radius: 0; box-shadow: none"
      @close="handleClose"
      @profile-loaded="setMinimizeTitle"
    />
  </ModalFrame>
</template>

<script>
import { defineAsyncComponent } from "vue";
import { useDockedModals } from "@bleck-it/vue-modal-dock";
import ModalFrame from "@/components/frames/ModalFrame.vue";

const EmployeeCard = defineAsyncComponent(() => import("@/components/EmployeeCard.vue"));

const EmployeeCardModal = {
  name: "EmployeeCardModal",
  components: { EmployeeCard, ModalFrame },
  props: {
    mitarbeiterId: { type: String, default: null },
    hosted: { type: Boolean, default: false },
  },
  emits: ["close"],
  data() {
    return {
      delegated: false,
      minimizeTitle: "Mitarbeiterprofil",
    };
  },
  setup() {
    return { dockedModals: useDockedModals() };
  },
  created() {
    this.openInGlobalDock();
  },
  watch: {
    mitarbeiterId() {
      this.openInGlobalDock();
    },
  },
  methods: {
    openInGlobalDock() {
      if (this.hosted || !this.mitarbeiterId) {
        this.delegated = false;
        return;
      }

      const id = `employee-${this.mitarbeiterId}`;
      this.delegated = true;
      this.dockedModals.open({
        id,
        title: "Mitarbeiterprofil",
        component: EmployeeCardModal,
        props: {
          mitarbeiterId: this.mitarbeiterId,
          hosted: true,
          onClose: () => {
            this.dockedModals.remove(id);
            this.$emit("close");
          },
        },
        persistence: {
          type: "employee-card",
          payload: { mitarbeiterId: this.mitarbeiterId },
        },
      });
    },
    handleClose() {
      this.$emit("close");
    },
    setMinimizeTitle(employee) {
      const fullName = [employee?.vorname, employee?.nachname]
        .filter(Boolean)
        .join(" ");
      this.minimizeTitle = fullName || "Mitarbeiterprofil";
      this.updateDockTitle(fullName);
    },
    updateDockTitle(fullName) {
      if (!this.hosted || !fullName) return;

      const id = `employee-${this.mitarbeiterId}`;
      const modal = this.dockedModals.get(id);
      if (!modal || modal.title === fullName) return;

      this.dockedModals.open({
        id,
        title: fullName,
        component: EmployeeCardModal,
        props: modal.props,
        persistence: modal.persistence,
      });
    },
  },
};

export default EmployeeCardModal;
</script>
