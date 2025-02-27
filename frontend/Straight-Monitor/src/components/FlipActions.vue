<template>
    <div class="shortcuts">
      <h4>Flip Aktionen</h4>
      <div class="shortcut-container">
        <span class="list-item" @click="openErstellung">
          <img
            src="@/assets/SF_002.png"
            id="erstellung"
            alt="Erstellung"
            class="item-list-sf"
          />
          <label for="erstellung">
            <p>Benutzer Erstellen</p>
          </label>
        </span>
        <span class="list-item" @click="openAustritte">
          <img
            src="@/assets/SF_002.png"
            id="austritte"
            alt="Austritte"
            class="item-list-sf"
          />
          <label for="austritte">
            <p>Austritte</p>
          </label>
        </span>
      </div>
    </div>
  </template>
  
  <script>
  import api from "@/utils/api";

  export default {
    
    name: "Tools",
    emits: ["open-flip-bar"],
    props: {
        isFlipBarOpen: Boolean
    },
    methods: {
      openErstellung() {
        this.$router.push('/flip/benutzer-erstellen');
      },
      openAustritte() {
        this.$router.push('/flip/austritte');
      },
    },
  };
  </script>
  
  <style scoped lang="scss">
  @import "@/assets/styles/dashboard.scss";

  .shortcuts {
    text-align: center;
  }
  
  h4 {
    font-size: 20px;
    margin-bottom: 20px;
  }
  
  .shortcut-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
  }
  
  .list-item {
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s ease;
  
  }
  

  label {
    text-align: center;
    font-size: 14px;
  }
  </style>
  