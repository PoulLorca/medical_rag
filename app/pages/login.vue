<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <div class="w-full max-w-sm">
      <!-- Logo / Header -->
      <div class="text-center mb-8">
        <div class="text-4xl mb-3">🏥</div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">MedDoc Assistant</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          AI assistant for consulting drug information
        </p>
      </div>

      <!-- Login Form -->
      <UCard>
        <form @submit.prevent="handleLogin" class="space-y-4">
          <UFormField label="Email">
            <UInput
              class="w-full"
              v-model="form.email"
              type="email"
              placeholder="your@email.com"
              icon="i-lucide-mail"
              size="lg"
              :disabled="loading"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              class="w-full"
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              icon="i-lucide-lock"
              size="lg"
              :disabled="loading"
            >
              <template #trailing>
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :disabled="loading"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="loading"
            :disabled="!form.email || !form.password"
          >
            Sign in
          </UButton>

          <p v-if="error" class="text-sm text-red-500 text-center">
            {{ error }}
          </p>

          <p class="text-xs text-gray-400 text-center">
            Don't have an account? Contact the administrator to request access.
          </p>
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const router = useRouter()
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)

const form = reactive({
  email: '',
  password: ''
})

async function handleLogin() {
  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: form.email, password: form.password }
    })

    // Redirect based on role
    const { user } = await $fetch('/api/auth/me')    
    router.push('/')
    
  }
  catch (e: any) {
    error.value = e.data?.statusMessage || 'Login failed. Please try again.'
  }
  finally {
    loading.value = false
  }
}
</script>