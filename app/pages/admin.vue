<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 mt-6">
    <!-- Header -->
    <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">📋 Document Manager</h1>
          <p class="text-sm text-gray-500">Upload and manage medical equipment manuals</p>
        </div>
        <div class="flex gap-2">
          <UButton to="/" variant="ghost" icon="i-lucide-message-circle" size="sm">Chat</UButton>
          <UButton @click="handleLogout" variant="ghost" icon="i-lucide-log-out" size="sm" color="error">Logout</UButton>
        </div>
      </div>
    </header>

    <div class="max-w-4xl mx-auto p-6 space-y-6">

      <!-- Upload Section -->
      <UCard>
        <template #header>
          <h2 class="font-semibold text-gray-800 dark:text-gray-200">Upload new document</h2>
        </template>

        <form @submit.prevent="uploadFile" class="space-y-4">
          <UFormField label="Equipment name *">
            <UInput
              v-model="form.name"
              placeholder="e.g. Puritan Bennett 840 Ventilator"
              :disabled="uploading"
            />
          </UFormField>

          <UFormField label="Equipment type">
            <USelect
              v-model="form.equipmentType"
              :items="equipmentTypes"
              :disabled="uploading"
            />
          </UFormField>

          <UFormField label="PDF File *">
            <div
              class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
              :class="selectedFile
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400'"
              @click="fileInput?.click()"
            >
              <p v-if="!selectedFile" class="text-gray-400 text-sm">
                Click to select a PDF file
              </p>
              <p v-else class="text-blue-600 dark:text-blue-400 text-sm font-medium">
                📄 {{ selectedFile.name }} ({{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB)
              </p>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept=".pdf"
              class="hidden"
              @change="onFileSelect"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :disabled="!selectedFile || !form.name || uploading"
            :loading="uploading"
          >
            {{ uploading ? 'Processing...' : 'Upload and process document' }}
          </UButton>
        </form>
      </UCard>

      <!-- Learning Animation Overlay -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="uploading"
            class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
          >
            <div class="text-center max-w-md px-6">
              <!-- Animated icons -->
              <div class="relative h-32 mb-6">
                <!-- Brain -->
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-pulse">
                  🧠
                </div>
                <!-- Orbiting icons -->
                <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32">
                  <div class="absolute animate-spin" style="animation-duration: 3s;">
                    <span class="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">📄</span>
                  </div>
                  <div class="absolute animate-spin" style="animation-duration: 4s; animation-direction: reverse;">
                    <span class="absolute -bottom-4 left-1/2 -translate-x-1/2 text-2xl">📚</span>
                  </div>
                  <div class="absolute animate-spin" style="animation-duration: 5s;">
                    <span class="absolute top-1/2 -right-4 -translate-y-1/2 text-2xl">🔬</span>
                  </div>
                  <div class="absolute animate-spin" style="animation-duration: 3.5s; animation-direction: reverse;">
                    <span class="absolute top-1/2 -left-4 -translate-y-1/2 text-2xl">🩺</span>
                  </div>
                </div>
              </div>

              <h2 class="text-2xl font-bold text-white mb-2">Learning from document...</h2>
              <p class="text-gray-300 text-sm mb-4">
                {{ learningMessages[currentLearningMessage] }}
              </p>

              <!-- Progress dots -->
              <div class="flex justify-center gap-1.5">
                <span
                  v-for="i in 5"
                  :key="i"
                  class="w-2 h-2 rounded-full animate-bounce"
                  :class="i <= uploadProgress ? 'bg-blue-400' : 'bg-gray-600'"
                  :style="{ animationDelay: `${i * 150}ms` }"
                />
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Upload Result Toast -->
      <UCard v-if="uploadResult" :color="uploadResult.success ? 'green' : 'red'">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{{ uploadResult.success ? '✅' : '❌' }}</span>
          <div>
            <p class="font-medium">{{ uploadResult.message }}</p>
            <p v-if="uploadResult.details" class="text-sm text-gray-500">{{ uploadResult.details }}</p>
          </div>
        </div>
      </UCard>

      <!-- Documents List -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-gray-800 dark:text-gray-200">Uploaded documents</h2>
            <UBadge v-if="documents?.length" variant="subtle">{{ documents.length }}</UBadge>
          </div>
        </template>

        <div v-if="!documents?.length" class="text-center text-gray-400 py-8">
          <p class="text-4xl mb-2">📭</p>
          <p class="text-sm">No documents uploaded yet</p>
        </div>

        <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
          <div
            v-for="doc in documents"
            :key="doc.id"
            class="flex items-center justify-between py-3"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">
                {{ doc.name }}
              </p>
              <div class="flex items-center gap-2 mt-0.5">
                <UBadge size="xs" variant="subtle">{{ doc.equipment_type }}</UBadge>
                <span class="text-xs text-gray-400">
                  {{ doc.total_chunks }} chunks · {{ doc.total_pages }} pages
                </span>
                <span class="text-xs text-gray-400">
                  · {{ new Date(doc.created_at).toLocaleDateString('en') }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2 ml-4">
              <UBadge
                :color="doc.status === 'ready' ? 'success' : doc.status === 'error' ? 'error' : 'warning'"
                size="xs"
              >
                {{ doc.status }}
              </UBadge>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :loading="deletingId === doc.id"
                @click="confirmDelete(doc)"
              />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Delete Confirmation Modal -->
      <UModal v-model:open="showDeleteModal">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-2">Delete document?</h3>
            <p class="text-sm text-gray-500 mb-4">
              This will permanently delete <strong>{{ documentToDelete?.name }}</strong> and all
              its {{ documentToDelete?.total_chunks }} associated chunks. This action cannot be undone.
            </p>
            <div class="flex justify-end gap-2">
              <UButton variant="ghost" @click="showDeleteModal = false">Cancel</UButton>
              <UButton color="error" :loading="deletingId === documentToDelete?.id" @click="deleteDocument">
                Delete
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['admin']
})

const router = useRouter()

// --- Form state ---
const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadResult = ref<{ success: boolean, message: string, details?: string } | null>(null)
const uploadProgress = ref(0)
const currentLearningMessage = ref(0)

const form = reactive({
  name: '',
  equipmentType: 'ventilator'
})

const equipmentTypes = [
  { label: 'Ventilator', value: 'ventilator' },
  { label: 'Patient Monitor', value: 'monitor' },
  { label: 'Defibrillator', value: 'defibrillator' },
  { label: 'Infusion Pump', value: 'infusion_pump' },
  { label: 'Ultrasound', value: 'ultrasound' },
  { label: 'Other', value: 'other' }
]

const learningMessages = [
  'Extracting text from the PDF...',
  'Breaking the document into fragments...',
  'Converting text into vector representations...',
  'Storing knowledge in the vector database...',
  'Almost done — organizing the index...',
  'Calibrating semantic search parameters...',
  'Running final quality checks...'
]

// --- Documents list ---
const { data: documents, refresh } = await useFetch<any[]>('/api/admin/documents')

// --- Delete state ---
const showDeleteModal = ref(false)
const deletingId = ref<string | null>(null)
const documentToDelete = ref<any>(null)

// --- Rotating learning messages ---
let messageInterval: ReturnType<typeof setInterval> | null = null
let progressInterval: ReturnType<typeof setInterval> | null = null

function startLearningAnimation() {
  currentLearningMessage.value = 0
  uploadProgress.value = 1

  messageInterval = setInterval(() => {
    currentLearningMessage.value = (currentLearningMessage.value + 1) % learningMessages.length
  }, 3000)

  progressInterval = setInterval(() => {
    if (uploadProgress.value < 5) uploadProgress.value++
  }, 4000)
}

function stopLearningAnimation() {
  if (messageInterval) clearInterval(messageInterval)
  if (progressInterval) clearInterval(progressInterval)
  messageInterval = null
  progressInterval = null
}

// --- File handling ---
function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  selectedFile.value = input.files?.[0] || null
}

async function uploadFile() {
  if (!selectedFile.value || !form.name) return

  uploading.value = true
  uploadResult.value = null
  startLearningAnimation()

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('name', form.name)
  formData.append('equipment_type', form.equipmentType)

  try {
    const result = await $fetch<{ document: { totalChunks: number; totalPages: number } }>('/api/admin/upload', {
      method: 'POST',
      body: formData
    })

    uploadResult.value = {
      success: true,
      message: `Document processed successfully!`,
      details: `${result.document.totalChunks} fragments generated from ${result.document.totalPages} pages.`
    }

    selectedFile.value = null
    form.name = ''
    if (fileInput.value) fileInput.value.value = ''
    await refresh()
  }
  catch (error: any) {
    uploadResult.value = {
      success: false,
      message: 'Failed to process document',
      details: error.data?.message || 'An unexpected error occurred'
    }
  }
  finally {
    uploading.value = false
    stopLearningAnimation()
  }
}

// --- Delete ---
function confirmDelete(doc: any) {
  documentToDelete.value = doc
  showDeleteModal.value = true
}

async function deleteDocument() {
  if (!documentToDelete.value) return

  deletingId.value = documentToDelete.value.id

  try {
    await $fetch(`/api/admin/documents/${documentToDelete.value.id}`, {
      method: 'DELETE'
    })
    showDeleteModal.value = false
    await refresh()
  }
  catch (error: any) {
    console.error('Delete failed:', error)
  }
  finally {
    deletingId.value = null
    documentToDelete.value = null
  }
}

// --- Logout ---
async function handleLogout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
}
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>