export interface TailscaleUpOption {
  name: `--${string}`
  value: boolean | string
}

function quoteShellValue(value: string): string {
  if (value === '')
    return ''

  // eslint-disable-next-line regexp/prefer-w, regexp/use-ignore-case -- 保持参数白名单与命令规范完全一致
  if (/^[A-Za-z0-9_./:@%+,=-]+$/.test(value))
    return value

  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function serializeOption(option: TailscaleUpOption): string {
  if (option.value === true)
    return option.name

  if (option.value === false)
    return `${option.name}=false`

  return `${option.name}=${quoteShellValue(option.value)}`
}

export function buildTailscaleUpCommand(
  serverUrl: string,
  options: TailscaleUpOption[],
): string {
  return [
    'tailscale up',
    serializeOption({ name: '--login-server', value: serverUrl }),
    ...options.map(serializeOption),
  ].join(' ')
}

export function buildPersonalNodeRecoveryCommand(
  serverUrl: string,
  reset = false,
): string {
  const options: TailscaleUpOption[] = [
    { name: '--advertise-tags', value: '' },
    { name: '--force-reauth', value: true },
  ]

  if (reset)
    options.push({ name: '--reset', value: true })

  return buildTailscaleUpCommand(serverUrl, options)
}
