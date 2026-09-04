<template>
  <ModalFrame
    v-if="mitarbeiterId"
    class="employee-card-modal"
    size="lg"
    aria-label="Mitarbeiterprofil"
    :show-close="false"
    minimizable
    :minimize-title="minimizeTitle"
    style="--mf-max-height: 92dvh; --mf-body-padding: 0; --mf-minimize-right: 56px"
    @close="$emit('close')"
  >
    <EmployeeCard
      :mitarbeiterId="mitarbeiterId"
      :initiallyExpanded="true"
      :showClose="true"
      style="border: 0; border-radius: 0; box-shadow: none"
      @close="$emit('close')"
      @profile-loaded="setMinimizeTitle"
    />
  </ModalFrame>
</template>

<script>
import { defineAsyncComponent } from "vue";
import ModalFrame from "@/components/frames/ModalFrame.vue";

const EmployeeCard = defineAsyncComponent(() => import("@/components/EmployeeCard.vue"));

export default {
  name: "EmployeeCardModal",
  components: { EmployeeCard, ModalFrame },
  props: {
    mitarbeiterId: { type: String, default: null },
  },
  emits: ["close"],
  data() {
    return { minimizeTitle: "Mitarbeiterprofil" };
  },
  methods: {
    setMinimizeTitle(employee) {
      const fullName = [employee?.vorname, employee?.nachname]
        .filter(Boolean)
        .join(" ");
      this.minimizeTitle = fullName || "Mitarbeiterprofil";
    },
  },
};
</script>
