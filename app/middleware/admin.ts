export default defineNuxtRouteMiddleware(async () => {
  try {
    const { user } = await $fetch('/api/auth/me')
    if (user.role !== 'admin') {
      return navigateTo('/')
    }
  }
  catch {
    return navigateTo('/login')
  }
})