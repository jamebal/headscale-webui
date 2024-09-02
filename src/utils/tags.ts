export function handleTagCreate(label: string, tags: { value: Array<{ label: string, value: string }> }, t: (key: string) => string): { label: string, value: string } {
  const newValue = `tag:${label.trim().replace(/\s+/g, '')}`

  // 判断是否已经存在
  if (tags.value.find(tag => tag.label === newValue)) {
    // 显示成功消息并抛出异常
    window.$message.success(`${newValue} ${t('common.exists')}`)
    throw new Error(`Tag with label "${newValue}" already exists.`)
  }

  return { label: newValue, value: newValue }
}
