export default defineNuxtRouteMiddleware(async (to) => {  
  const publicRoutes = ['/login']
  if (publicRoutes.includes(to.path)) return

  try {
    await $fetch('/api/auth/me')
  }
  catch {
    return navigateTo('/login')
  }
})