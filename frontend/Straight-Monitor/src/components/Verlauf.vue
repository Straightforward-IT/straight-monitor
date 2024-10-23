<template>

</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import api from "@/utils/api";

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
            token: localStorage.getItem('token') || null,
            currentAnsicht: null,
            items: null,
            monitorings: null,
            
        }
    },
  mounted() {
    this.setAxiosAuthToken();
  },
    computed: {

    }, methods: {
        setAxiosAuthToken(){
      api.defaults.headers.common['x-auth-token'] = this.token;
    },
        async fetchUserData() {
      if (this.token) {
        try {
          const response = await api.get(
            "/api/users/me",
            
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
        const response = await api.get(
          "/api/items"
        );
        this.items = response.data;
        console.log("Items fetched.");
      } catch (error) {
        console.error("Fehler beim Abrufen der Artikel:", error);
      }
    },
    async fetchMonitoringLogs() {
        if(this.token){
            try {
            const response = await api.get(
                "/api/monitoring"
            );
            this.logs = response.data;
            console.log("Logs fetched.")
        }catch (error) {
            console.error("Fehler beim Abrufen der Logs: ", error)
        }
        }else{
            router.push('/');
        }
        
    },
    }, mounted() {
      this.setAxiosAuthToken();
        this.fetchUserData();
        this.fetchItems();
        this.fetchMonitoringLogs();
    }
}
</script>

<style scoped lang="scss">
@import "@/assets/styles/dashboard.scss";

</style>