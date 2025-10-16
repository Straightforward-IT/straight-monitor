<template>
    <div class="shortcuts">
      <h4>Flip Aktionen</h4>
      <div class="shortcut-container">
        <custom-tooltip text="Neuen Benutzer in Flip erstellen" position="right" :delay="500">
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
        </custom-tooltip>
        <custom-tooltip text="Austretende Mitarbeiter verwalten" position="right" :delay="500">
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
        </custom-tooltip>
      </div>
    </div>
  </template>
  
  <script>
  import api from "@/utils/api";
import CustomTooltip from './CustomTooltip.vue';

  export default {
    name: "Tools",
    components: { CustomTooltip },
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
 @import "@/assets/styles/global.scss"; 

  .shortcuts {
    text-align: center;
  }
  
  h4 {
    font-size: 20px;
    margin-bottom: 20px;
  }
  
  .shortcut-container {
   font-size: 14px;
    color: $base-straight-gray;
    opacity: 0.65;
    font-weight: 400;

    .item-list-sf {
      width: 30px; /* Adjust the width as needed */
      height: auto; /* Maintain aspect ratio */
      margin: 5px;
      cursor: pointer;
    }
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
  