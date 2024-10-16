<template>

</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import axios from "axios";

export default{
    name: "Verlauf",
    emit: ["update-modal", "switch-to-bestand", "switch-to-verlauf", "switch-to-dashboard"],
    compontens: {
        FontAwesomeIcon,
    }, props: {
        isModalOpen: Boolean,
    },
    data() {
        return {

        }
    },
    computed: {

    }, methods: {
        async fetchUserData() {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const response = await axios.get(
            "https://straight-monitor-684d4006140b.herokuapp.com/api/users/me",
            {
              headers: { "x-auth-token": token },
            }
          );
          if (response.status === 401) {
            this.$router.push("/");
          }
          this.userEmail = response.data.email;
          this.userID = response.data._id;
          this.userName = response.data.name;
          this.searchQuery = response.data.location;
        } catch (error) {
          console.error("Fehler beim Abrufen der Benutzerdaten:", error);
          this.$router.push("/");
        }
      } else {
        this.$router.push("/");
      }
    },
    async fetchItems() {
      try {
        const response = await axios.get(
          "https://straight-monitor-684d4006140b.herokuapp.com/api/items"
        );
        this.items = response.data;
        console.log("Items fetched.");
      } catch (error) {
        console.error("Fehler beim Abrufen der Artikel:", error);
      }
    },
    async fetchMonitoringLogs() {
        try {
            const response = await axios.get(
                "https://straight-monitor-684d4006140b.herokuapp.com/api/monitoring"
            );
            this.logs = response.data;
            console.log("Logs fetched.")
        }catch (error) {
            console.error("Fehler beim Abrufen der Logs: ", error)
        }
    },
    }, mounted() {
        this.fetchUserData();
        this.fetchItems();
        this.fetchMonitoringLogs();
    }
}
</script>

<style scoped lang="scss">
@import "@/assets/styles/dashboard.scss";

</style>