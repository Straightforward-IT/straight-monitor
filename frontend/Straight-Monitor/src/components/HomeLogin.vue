<template>
  <LoginTest />
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import LoginTest from '@/components/LoginTest.vue';
import { jwtDecode } from 'jwt-decode';

const router = useRouter();

// Check if user is already logged in and redirect
onMounted(() => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const decoded = jwtDecode(token);
      const isExpired = decoded.exp < (Date.now() / 1000);
      if (!isExpired) {
        const lastPath = localStorage.getItem('lastVisitedPath');
        if (lastPath && lastPath !== '/' && lastPath !== '/dashboard') {
          router.push(lastPath);
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      localStorage.removeItem('token');
    }
  }
});
</script>
