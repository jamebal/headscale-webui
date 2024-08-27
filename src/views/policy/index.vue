<script lang="ts" setup>
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { onMounted, ref, shallowRef } from 'vue'
import { NButton } from 'naive-ui'
import { fetchPolicy, setPolicy } from '@/service'

const { t } = useI18n()

const monacoEditorOptions = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
}

const updateLoading = ref(false)

const updateTime = ref(0)

const code = ref('{ }')
const editorRef = shallowRef()
const handleMount = (editor: any) => (editorRef.value = editor)
const editorHeight = ref(window.innerHeight - 136)

function getPolicyContent() {
  fetchPolicy().then((res) => {
    if (!res.isSuccess) {
      return
    }
    code.value = res.data.policy
    updateTime.value = new Date(res.data.updatedAt).getTime()
  })
}

function updatePolicy() {
  updateLoading.value = true
  setPolicy(code.value).then((res) => {
    updateLoading.value = false
    if (!res.isSuccess) {
      return
    }
    window.$message.success(`${t('common.update')} ${t('common.success')}`)
    getPolicyContent()
  })
}

onMounted(() => {
  getPolicyContent()
})
</script>

<template>
  <n-space vertical justify="start">
    <n-space justify="space-between">
      <n-descriptions label-placement="left">
        <n-descriptions-item :label="t('app.updateTime')">
          <NTime v-show="updateTime > 0" :time="updateTime" />
        </n-descriptions-item>
      </n-descriptions>
      <div class="flex gap-4">
        <NSpace class="ml-a">
          <NButton strong type="primary" class="ml-a" :loading="updateLoading" @click="updatePolicy">
            {{ t('common.update') }}
          </NButton>
        </NSpace>
      </div>
    </n-space>
    <VueMonacoEditor
      v-model:value="code"
      :style="{ height: `${editorHeight}px` }"
      language="json"
      theme="vs-light"
      :options="monacoEditorOptions"
      @mount="handleMount"
    />
  </n-space>
</template>
