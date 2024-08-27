<script lang="ts" setup>
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { onMounted, ref, shallowRef } from 'vue'
import { fetchPolicy } from '@/service'

const monacoEditorOptions = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
}

const code = ref('{ }')
const editorRef = shallowRef()
const handleMount = (editor: any) => (editorRef.value = editor)

function getPolicyContent() {
  fetchPolicy().then((res) => {
    if (!res.isSuccess) {
      return
    }
    code.value = res.data.policy
  })
}

onMounted(() => {
  getPolicyContent()
})
</script>

<template>
  <VueMonacoEditor
    v-model:value="code"
    language="json"
    theme="vs-light"
    :options="monacoEditorOptions"
    @mount="handleMount"
  />
</template>
