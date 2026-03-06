<script setup lang="ts">
const input = ref('')
const loading = ref(false)
const chatId = crypto.randomUUID()

const {
  dropzoneRef,
  isDragging,
  open,
  files,
  isUploading,
  uploadedFiles,
  removeFile,
  clearFiles
} = useFileUploadWithStatus(chatId)

async function createChat(prompt: string) {
  input.value = prompt
  loading.value = true

  const parts: Array<{ type: string, text?: string, mediaType?: string, url?: string }> = [{ type: 'text', text: prompt }]

  if (uploadedFiles.value.length > 0) {
    parts.push(...uploadedFiles.value)
  }

  const chat = await $fetch('/api/chats', {
    method: 'POST',
    body: {
      id: chatId,
      message: {
        role: 'user',
        parts
      }
    }
  })

  refreshNuxtData('chats')
  navigateTo(`/chat/${chat?.id}`)
}

async function onSubmit() {
  await createChat(input.value)
  clearFiles()
}

const quickChats = [
  {
    label: 'How do I open the frunk on Model S?',
    icon: 'i-lucide-car'
  },
  {
    label: 'What is the recommended tire pressure?',
    icon: 'i-lucide-circle-gauge'
  },
  {
    label: 'How to use Autopilot safely?',
    icon: 'i-lucide-loader-pinwheel'
  },
  {
    label: 'How do I set up a charging schedule?',
    icon: 'i-lucide-battery-charging'
  },
  {
    label: 'What do the warning lights mean?',
    icon: 'i-lucide-alert-triangle'
  },
  {
    label: 'How to pair my phone via Bluetooth?',
    icon: 'i-lucide-bluetooth'
  }
]
</script>

<template>
  <UDashboardPanel
    id="home"
    class="min-h-0"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <div ref="dropzoneRef" class="flex flex-1">
        <DragDropOverlay :show="isDragging" />

        <UContainer class="flex-1 flex flex-col justify-center gap-4 sm:gap-6 py-8">
          <div class="space-y-2">
            <h1 class="text-3xl sm:text-4xl text-highlighted font-bold flex items-center gap-3">
              <UIcon name="i-simple-icons-tesla" class="size-9 shrink-0 text-[#E31937]" />
              <span>What would you like to know about your Tesla?</span>
            </h1>
            <p class="text-base text-muted max-w-2xl">
              Ask me about features, maintenance, charging, Autopilot, settings, or anything from the official Tesla owner's manuals. I answer based exclusively on uploaded documentation.
            </p>
          </div>

          <UChatPrompt
            v-model="input"
            :status="loading ? 'streaming' : 'ready'"
            :disabled="isUploading"
            class="[view-transition-name:chat-prompt]"
            variant="subtle"
            placeholder="e.g. How do I activate Sentry Mode?"
            :ui="{ base: 'px-1.5' }"
            @submit="onSubmit"
          >
            <template v-if="files.length > 0" #header>
              <div class="flex flex-wrap gap-2">
                <FileAvatar
                  v-for="fileWithStatus in files"
                  :key="fileWithStatus.id"
                  :name="fileWithStatus.file.name"
                  :type="fileWithStatus.file.type"
                  :preview-url="fileWithStatus.previewUrl"
                  :status="fileWithStatus.status"
                  :error="fileWithStatus.error"
                  removable
                  @remove="removeFile(fileWithStatus.id)"
                />
              </div>
            </template>

            <template #footer>
              <div class="flex items-center gap-1">
                <FileUploadButton :open="open" />

                <ModelSelect />
              </div>

              <UChatPromptSubmit color="neutral" size="sm" :disabled="isUploading" />
            </template>
          </UChatPrompt>

          <!-- Quick questions -->
          <div>
            <p class="text-xs text-dimmed mb-2 font-medium uppercase tracking-wide">Try asking</p>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="quickChat in quickChats"
                :key="quickChat.label"
                :icon="quickChat.icon"
                :label="quickChat.label"
                size="sm"
                color="neutral"
                variant="outline"
                class="rounded-full"
                @click="createChat(quickChat.label)"
              />
            </div>
          </div>

          <!-- Info box -->
          <div class="bg-primary/5 border border-primary/20 rounded-lg p-4 max-w-2xl">
            <div class="flex gap-3">
              <span class="text-xl shrink-0">⚡</span>
              <div class="text-sm text-muted space-y-1">
                <p class="font-medium text-highlighted">How does this work?</p>
                <p>
                  This chatbot uses RAG (Retrieval-Augmented Generation) to search through official
                  Tesla owner's manuals and answer your questions with sourced information. It does not
                  make up answers — if the information is not in the loaded documents, it will tell you.
                </p>
                <p class="text-xs text-dimmed">
                  Currently loaded with official Tesla owner's manuals. This is a technical demo
                  — always refer to your vehicle's official documentation for critical information.
                </p>
              </div>
            </div>
          </div>
        </UContainer>
      </div>
    </template>
  </UDashboardPanel>
</template>