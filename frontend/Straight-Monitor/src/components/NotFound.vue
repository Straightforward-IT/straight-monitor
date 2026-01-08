<template>
  <div class="not-found">
    <div class="content">
      <div class="error-visual">
        <img src="@/assets/404.png" alt="404" class="error-image" />
        <div class="error-code">404</div>
      </div>
      <h1>Seite nicht gefunden</h1>
      <p>Die angeforderte Seite existiert nicht oder wurde verschoben.</p>
      
      <div class="actions">
        <button @click="goHome" class="btn-primary">
          <font-awesome-icon :icon="['fas', 'home']" />
          Zur Startseite
        </button>
        <button @click="goBack" class="btn-secondary">
          <font-awesome-icon :icon="['fas', 'arrow-left']" />
          Zurück
        </button>
      </div>
      
      <div class="suggestions">
        <p>Vielleicht suchst du nach:</p>
        <div class="links">
          <RouterLink to="/dashboard">Dashboard</RouterLink>
          <RouterLink to="/bestand">Bestand</RouterLink>
          <RouterLink to="/verlauf">Verlauf</RouterLink>
          <RouterLink to="/dokumente">Dokumente</RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

const router = useRouter();

const goHome = () => {
  router.push('/dashboard');
};

const goBack = () => {
  router.back();
};
</script>

<style scoped lang="scss">
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg);
  padding: 2rem;
}

.content {
  text-align: center;
  max-width: 600px;
  
  .error-visual {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
    
    .error-image {
      max-width: 300px;
      width: 100%;
      height: auto;
      opacity: 0.9;
    }
    
    .error-code {
      position: absolute;
      font-size: 6rem;
      font-weight: 900;
      color: var(--primary);
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      opacity: 0.8;
      pointer-events: none;
      top: 60%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  }
  
  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 1rem 0;
  }
  
  p {
    font-size: 1.1rem;
    color: var(--muted);
    margin: 0 0 2rem 0;
    line-height: 1.6;
  }
}

.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 3rem;
  flex-wrap: wrap;
  
  button {
    padding: 0.85rem 1.75rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
    
    &.btn-primary {
      background: var(--primary);
      color: white;
      
      &:hover {
        background: color-mix(in srgb, var(--primary) 90%, black);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    }
    
    &.btn-secondary {
      background: var(--hover);
      color: var(--text);
      border: 1px solid var(--border);
      
      &:hover {
        background: var(--tile-bg);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }
    
    &:active {
      transform: translateY(0);
    }
  }
}

.suggestions {
  padding-top: 2rem;
  border-top: 1px solid var(--border);
  
  p {
    font-size: 0.95rem;
    color: var(--muted);
    margin: 0 0 1rem 0;
  }
  
  .links {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    
    a {
      color: var(--primary);
      text-visual {
      .error-image {
        max-width: 200px;
      }
      
      .error-code {
        font-size: 4rem;
      };
      padding: 0.5rem 1rem;
      border-radius: 6px;
      transition: all 0.2s ease;
      
      &:hover {
        background: color-mix(in srgb, var(--primary) 10%, var(--bg));
        transform: translateY(-1px);
      }
    }
  }
}

@media (max-width: 768px) {
  .content {
    .error-code {
      font-size: 5rem;
    }
    
    h1 {
      font-size: 1.5rem;
    }
    
    p {
      font-size: 1rem;
    }
  }
  
  .actions {
    flex-direction: column;
    
    button {
      width: 100%;
      justify-content: center;
    }
  }
  
  .suggestions .links {
    flex-direction: column;
    
    a {
      width: 100%;
      text-align: center;
    }
  }
}

}
</style>
