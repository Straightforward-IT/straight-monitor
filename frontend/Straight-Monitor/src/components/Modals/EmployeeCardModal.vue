<template>
  <ModalFrame
    v-if="mitarbeiterId"
    class="employee-card-modal"
    size="lg"
    title="Mitarbeiterprofil"
    style="--mf-max-height: 92dvh; --mf-body-padding: 0"
    @close="$emit('close')"
  >
    <EmployeeCard
      :mitarbeiterId="mitarbeiterId"
      :initiallyExpanded="true"
      style="border: 0; border-radius: 0; box-shadow: none"
      @close="$emit('close')"
    />
  </ModalFrame>
</template>

<script>
import EmployeeCard from "@/components/EmployeeCard.vue";
import ModalFrame from "@/components/frames/ModalFrame.vue";

export default {
  name: "EmployeeCardModal",
  components: { EmployeeCard, ModalFrame },
  props: {
    mitarbeiterId: { type: String, default: null },
  },
  emits: ["close"],
};
</script>
