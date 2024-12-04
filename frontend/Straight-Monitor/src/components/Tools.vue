<template>
    <div class="shortcuts">
      <h4>Tools</h4>
      <div class="shortcut-container">
        <span class="list-item" @click="openAuswertung">
          <img
            src="@/assets/SF_002.png"
            id="auswertung"
            alt="Auswertung Logo"
            class="item-list-sf"
          />
          <label for="auswertung">
            <p>Auswertung</p>
          </label>
        </span>
        <span class="list-item" @click="openTeamleiterExcel">
          <img
            src="@/assets/SF_002.png"
            id="teamleiter-excel"
            alt="Excel Logo"
            class="item-list-sf"
          />
          <label for="teamleiter-excel">
            <p>Teamleiter Excel</p>
          </label>
        </span>
        <span class="list-item" @click="uploadFlipExcel">
          <input 
          type="file"
          ref="fileInput"
          style="display: none;"
          @change="handleFileChange"
          accept=".xls, .xlsx"
          >
          <img
            src="@/assets/SF_002.png"
            id="flip-import"
            alt="Flip import"
            class="item-list-sf"
          />
          <label for="flip-import">
            <p>Flip Import</p>
          </label>
        </span>
      </div>
    </div>
  </template>
  
  <script>
  import api from "@/utils/api";

  export default {
    

    name: "Tools",
    emits: ["open-tools-bar"],
    props: {
        isToolBarOpen: Boolean
    },
    methods: {
      openAuswertung() {
        this.$router.push('/auswertung');
      },
      openTeamleiterExcel() {
        this.$router.push('/excelFormatierung');
      },
      uploadFlipExcel() {
        this.$refs.fileInput.click();
      },
      async handleFileChange() {
        const file = event.target.files[0];

        if(!file) {
          alert('Keine Datei ausgewählt');
          return;
        }
         // Validate file type (must be Excel)
      const validMimeTypes = [
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      ];

      if (!validMimeTypes.includes(file.type)) {
        alert('Invalid file type. Please upload a valid Excel file (.xls or .xlsx).');
        return;
      }

      // Submit the file to the server
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await api.post('/api/personal/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        alert('File uploaded successfully!');
        console.log('Server Response:', response.data);
      } catch (error) {
        console.error('File upload failed:', error);
        alert('File upload failed. Please try again.');
      }
      }
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
  