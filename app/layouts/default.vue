<script setup lang="ts">
import { LazyModalConfirm } from '#components'

const route = useRoute()
const toast = useToast()
const overlay = useOverlay()

const open = ref(false)

// Check if current user is admin
const currentUser = ref<{ role?: string, username?: string, email?: string } | null>(null)

try {
  const { user } = await $fetch('/api/auth/me')
  currentUser.value = user
} catch {
  currentUser.value = null
}

const isAdmin = computed(() => currentUser.value?.role === 'admin')

const deleteModal = overlay.create(LazyModalConfirm, {
  props: {
    title: 'Delete chat',
    description: 'Are you sure you want to delete this chat? This cannot be undone.'
  }
})

const { data: chats, refresh: refreshChats } = await useFetch('/api/chats', {
  key: 'chats',
  transform: data => data.map(chat => ({
    id: chat.id,
    label: chat.title || 'Untitled',
    to: `/chat/${chat.id}`,
    icon: 'i-lucide-message-circle',
    createdAt: chat.createdAt
  }))
})

onNuxtReady(async () => {
  const first10 = (chats.value || []).slice(0, 10)
  for (const chat of first10) {
    await $fetch(`/api/chats/${chat.id}`)
  }
})

const { groups } = useChats(chats)

const items = computed(() => groups.value?.flatMap((group) => {
  return [{
    label: group.label,
    type: 'label' as const
  }, ...group.items.map(item => ({
    ...item,
    slot: 'chat' as const,
    icon: undefined,
    class: item.label === 'Untitled' ? 'text-muted' : ''
  }))]
}))

async function deleteChat(id: string) {
  const instance = deleteModal.open()
  const result = await instance.result
  if (!result) {
    return
  }

  await $fetch(`/api/chats/${id}`, { method: 'DELETE' })

  toast.add({
    title: 'Chat deleted',
    description: 'Your chat has been deleted',
    icon: 'i-lucide-trash'
  })

  refreshChats()

  if (route.params.id === id) {
    navigateTo('/')
  }
}

async function handleLogout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  navigateTo('/login')
}

defineShortcuts({
  c: () => {
    navigateTo('/')
  }
})
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      :min-size="12"
      collapsible
      resizable
      class="border-r-0 py-4"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-end gap-1.5">
          <span class="text-2xl shrink-0">🏥</span>
          <span v-if="!collapsed" class="text-lg font-bold text-highlighted">MedDoc</span>
        </NuxtLink>

        <div v-if="!collapsed" class="flex items-center gap-1.5 ms-auto">
          <UDashboardSearchButton collapsed />
        </div>
      </template>

      <template #default="{ collapsed }">
        <div class="flex flex-col gap-1.5">
          <UButton
            v-bind="collapsed ? { icon: 'i-lucide-plus' } : { label: 'New chat' }"
            variant="soft"
            block
            to="/"
            @click="open = false"
          />

          <!-- Admin link -->
          <UButton
            v-if="isAdmin"
            v-bind="collapsed ? { icon: 'i-lucide-upload' } : { label: 'Manage documents' }"
            variant="ghost"
            color="neutral"
            block
            to="/admin"
          />

          <template v-if="collapsed">
            <UDashboardSearchButton collapsed />
          </template>
        </div>

        <UNavigationMenu
          v-if="!collapsed"
          :items="items"
          :collapsed="collapsed"
          orientation="vertical"
          :ui="{ link: 'overflow-hidden' }"
        >
          <template #chat-trailing="{ item }">
            <div class="flex -mr-1.25 translate-x-full group-hover:translate-x-0 transition-transform">
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                class="text-muted hover:text-primary hover:bg-accented/50 focus-visible:bg-accented/50 p-0.5"
                tabindex="-1"
                @click.stop.prevent="deleteChat((item as any).id)"
              />
            </div>
          </template>
        </UNavigationMenu>
      </template>

      <template #footer="{ collapsed }">
        <div v-if="currentUser" class="flex flex-col gap-1 w-full">
          <!-- User info -->
          <div v-if="!collapsed" class="flex items-center gap-2 px-2 py-1.5">
            <UAvatar
              :alt="currentUser.username || currentUser.email || '?'"
              size="sm"
              icon="i-lucide-user"
            />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-highlighted truncate">
                {{ currentUser.username || currentUser.email }}
              </p>
              <p class="text-xs text-dimmed">
                {{ currentUser.role === 'admin' ? 'Administrator' : 'User' }}
              </p>
            </div>
          </div>

          <div class="flex gap-1 w-full" :class="collapsed ? 'flex-col' : ''">
            <UButton
              v-bind="collapsed ? { icon: 'i-lucide-log-out' } : { label: 'Log out', icon: 'i-lucide-log-out' }"
              color="neutral"
              variant="ghost"
              block
              class="w-full"
              @click="handleLogout"
            />
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch
      placeholder="Search chats..."
      :groups="[{
        id: 'links',
        items: [{
          label: 'New chat',
          to: '/',
          icon: 'i-lucide-square-pen'
        }]
      }, ...groups]"
    />

    <div class="flex-1 flex m-4 lg:ml-0 rounded-lg ring ring-default bg-default/75 shadow min-w-0">
      <slot />
    </div>
  </UDashboardGroup>
</template>