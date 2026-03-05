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
    label: 'How often can I take paracetamol?',
    icon: 'i-lucide-pill'
  },
  {
    label: 'Can I mix ibuprofen with omeprazole?',
    icon: 'i-lucide-flask-conical'
  },
  {
    label: 'Which antihistamine does not cause drowsiness?',
    icon: 'i-lucide-moon'
  },
  {
    label: 'What is the maximum daily dose of amoxicillin?',
    icon: 'i-lucide-shield-check'
  },
  {
    label: 'Can I take aspirin during pregnancy?',
    icon: 'i-lucide-baby'
  },
  {
    label: 'What are the side effects of metformin?',
    icon: 'i-lucide-alert-triangle'
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
            <h1 class="text-3xl sm:text-4xl text-highlighted font-bold">
              🏥 What would you like to know?
            </h1>
            <p class="text-base text-muted max-w-2xl">
              Ask me about medications, dosages, side effects, drug interactions, or anything from the uploaded medical documentation. I answer based exclusively on official drug leaflets and technical datasheets.
            </p>
          </div>

          <UChatPrompt
            v-model="input"
            :status="loading ? 'streaming' : 'ready'"
            :disabled="isUploading"
            class="[view-transition-name:chat-prompt]"
            variant="subtle"
            placeholder="e.g. Can I take ibuprofen on an empty stomach?"
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
              <span class="text-xl shrink-0">💊</span>
              <div class="text-sm text-muted space-y-1">
                <p class="font-medium text-highlighted">How does this work?</p>
                <p>
                  This chatbot uses RAG (Retrieval-Augmented Generation) to search through official
                  medication datasheets and answer your questions with sourced information. It does not
                  make up answers — if the information is not in the loaded documents, it will tell you.
                </p>
                <p class="text-xs text-dimmed">
                  Currently loaded with drug leaflets from AEMPS (Spanish Agency of Medicines). This is a
                  technical demo and should not replace professional medical advice.
                </p>
              </div>
            </div>
          </div>
        </UContainer>
      </div>
    </template>
  </UDashboardPanel>
</template>