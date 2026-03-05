<template>
  <UDashboardPanel
    id="admin"
    class="min-h-0"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <DashboardNavbar />
    </template>

    <template #body>
      <UContainer class="flex-1 flex flex-col gap-6 py-8">
        <div class="space-y-1">
          <h1 class="text-2xl font-bold text-highlighted">📋 Document Manager</h1>
          <p class="text-sm text-muted">Upload and manage medication datasheets for the RAG knowledge base</p>
        </div>

        <!-- Upload Section -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Upload new document</h2>
          </template>

          <form @submit.prevent="uploadFile" class="space-y-4">
            <UFormField label="Medication / Document name *">
              <UInput
                class="w-full"
                v-model="form.name"
                placeholder="e.g. Paracetamol Kern Pharma 1g"
                :disabled="uploading"
              />
            </UFormField>

            <UFormField label="Category">
              <USelect
                class="w-full"
                v-model="form.equipmentType"
                :items="equipmentTypes"
                :disabled="uploading"
              />
            </UFormField>

            <UFormField label="PDF File *">
              <div
                class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors"
                :class="selectedFile
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-primary'"
                @click="fileInput?.click()"
              >
                <p v-if="!selectedFile" class="text-muted text-sm">
                  Click to select a PDF file
                </p>
                <p v-else class="text-primary text-sm font-medium">
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
                <div class="relative h-32 mb-6">
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-pulse">
                    🧠
                  </div>
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
                      <span class="absolute top-1/2 -left-4 -translate-y-1/2 text-2xl">💊</span>
                    </div>
                  </div>
                </div>

                <h2 class="text-2xl font-bold text-white mb-2">Learning from document...</h2>
                <p class="text-gray-300 text-sm mb-4">
                  {{ learningMessages[currentLearningMessage] }}
                </p>

                <div class="flex justify-center gap-1.5">
                  <span
                    v-for="i in 5"
                    :key="i"
                    class="w-2 h-2 rounded-full animate-bounce"
                    :class="i <= uploadProgress ? 'bg-primary' : 'bg-gray-600'"
                    :style="{ animationDelay: `${i * 150}ms` }"
                  />
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>

        <!-- Upload Result -->
        <UCard v-if="uploadResult">
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ uploadResult.success ? '✅' : '❌' }}</span>
            <div>
              <p class="font-medium">{{ uploadResult.message }}</p>
              <p v-if="uploadResult.details" class="text-sm text-muted">{{ uploadResult.details }}</p>
            </div>
          </div>
        </UCard>

        <!-- Documents List -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">Uploaded documents</h2>
              <UBadge v-if="documents?.length" variant="subtle">{{ documents.length }}</UBadge>
            </div>
          </template>

          <div v-if="!documents?.length" class="text-center text-muted py-8">
            <p class="text-4xl mb-2">📭</p>
            <p class="text-sm">No documents uploaded yet</p>
          </div>

          <div v-else class="divide-y divide-default">
            <div
              v-for="doc in documents"
              :key="doc.id"
              class="flex items-center justify-between py-3"
            >
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm text-highlighted truncate">
                  {{ doc.name }}
                </p>
                <div class="flex items-center gap-2 mt-0.5">
                  <UBadge size="xs" variant="subtle">{{ doc.equipment_type }}</UBadge>
                  <span class="text-xs text-dimmed">
                    {{ doc.total_chunks }} chunks · {{ doc.total_pages }} pages
                  </span>
                  <span class="text-xs text-dimmed">
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
              <p class="text-sm text-muted mb-4">
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
      </UContainer>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['admin']
})

// --- Form state ---
const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const uploadResult = ref<{ success: boolean, message: string, details?: string } | null>(null)
const uploadProgress = ref(0)
const currentLearningMessage = ref(0)

const form = reactive({
  name: '',
  equipmentType: 'pain_fever'
})

const equipmentTypes = [
  { label: 'Pain & Fever', value: 'pain_fever' },
  { label: 'Stomach & Digestive', value: 'digestive' },
  { label: 'Allergies', value: 'allergies' },
  { label: 'Antibiotics', value: 'antibiotics' },
  { label: 'Anxiety & Sleep', value: 'anxiety_sleep' },
  { label: 'Cholesterol & Heart', value: 'cardiovascular' },
  { label: 'Diabetes', value: 'diabetes' },
  { label: 'Respiratory', value: 'respiratory' },
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
    const result = await $fetch<{ document: { totalChunks: number, totalPages: number } }>('/api/admin/upload', {
      method: 'POST',
      body: formData
    })

    uploadResult.value = {
      success: true,
      message: 'Document processed successfully!',
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
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>