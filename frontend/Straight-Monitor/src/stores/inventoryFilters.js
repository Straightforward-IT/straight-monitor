import { defineStore } from 'pinia';

export const useInventoryFilters = defineStore('inventoryFilters', {
  state: () => ({ locationIds: [] }),
  actions: {
    toggleLocation(locationId) {
      const id = String(locationId);
      this.locationIds = this.locationIds.includes(id)
        ? this.locationIds.filter((entry) => entry !== id)
        : [...this.locationIds, id];
    },
    clearLocations() {
      this.locationIds = [];
    },
    setLocations(locationIds) {
      this.locationIds = [...new Set(locationIds.map(String))];
    },
  },
});
