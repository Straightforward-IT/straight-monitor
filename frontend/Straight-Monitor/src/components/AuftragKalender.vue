<template>
  <AuftragCalendarWorkspace :view-mode="viewMode" />
</template>

<script>
import AuftragCalendarWorkspace from "@/components/orders/calendar/AuftragCalendarWorkspace.vue";

/**
 * Stable calendar boundary for the Aufträge route.
 *
 * Keep page routing and future calendar sub-components independent from the
 * stateful workspace implementation.
 */
export default {
  name: "AuftragKalender",
  components: { AuftragCalendarWorkspace },
  props: {
    viewMode: {
      type: String,
      default: "calendar",
      validator: (value) => ["calendar", "list"].includes(value),
    },
  },
};
</script>
