<template>
  <header class="Header-Banner">
    <!-- Header content goes here -->
  </header>
</template>

<style scoped>
.Header-Banner {
  background-image: url("@/assets/Banner.png");
  background-color: #1d1d1d;
  background-size: cover;
  background-position: center;
  height: 200px; /* Adjust the height as needed */
  width: 100%;
  display: flex;
  align-items: left;
  justify-content: left;
}

@media only screen and (max-width: 768px) {

  .Header-Banner{
    height: 100px;
  }
}

</style>
