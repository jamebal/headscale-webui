<script setup lang="ts">
import { onMounted } from 'vue'
import { useClipboard } from '@vueuse/core'
import { local } from '@/utils'
import AuthKeyCascader from '@/views/deploy/authKeyCascader.vue'
import { fetchRouteList } from '@/service'
import { handleTagCreate } from '@/utils/tags'

const { copy } = useClipboard()

const { t } = useI18n()

const code = ref('tailscale up')

const options = ref<string[]>([
  '--reset',
  '--accept-dns',
  '--accept-routes',
])

const operator = ref('')
const hostname = ref('')
const timeout = ref('')
const authKey = ref('')
const acceptRisk = ref('')
const exitNode = ref('')

const advertiseTags = ref<{ label: string, value: string }[]>([])
const advertiseRoutes = ref<{ label: string, value: string }[]>([])

const advertiseTagsValues = ref('')
const advertiseRoutesValues = ref('')

const acceptRiskOptions = [
  { label: t('app.acceptRiskOptions.lose-ssh'), value: 'lose-ssh' },
  { label: t('app.acceptRiskOptions.all'), value: 'all' },
]

const exitNodeOptions = ref([
  { label: 'Node 1', value: 'node1' },
])

code.value += ` --login-server=${local.get('serverUrl')}`

function copyCode() {
  copy(code.value)
  window.$message.success(t('components.copyText.message'))
}

function renderCodeText() {
  const optionMap: Record<string, string | undefined> = {
    '--operator': operator.value,
    '--auth-key': authKey.value,
    '--hostname': hostname.value,
    '--timeout': timeout.value,
    '--accept-risk': acceptRisk.value,
    '--exit-node': exitNode.value,
    '--advertise-tags': advertiseTagsValues.value,
    '--advertise-routes': advertiseRoutesValues.value,
  }

  const baseCommand = 'tailscale up'
  const serverUrl = local.get('serverUrl')
  // 构建基础命令
  code.value = `${baseCommand} --login-server=${serverUrl}`

  // 遍历选项
  options.value.forEach((option) => {
    if (option in optionMap) {
      if (optionMap[option]) {
        code.value += ` ${option}=${optionMap[option]}`
      }
      return
    }
    code.value += ` ${option}`
  })
}

function renderExitNodeOptions() {
  exitNodeOptions.value = []
  fetchRouteList().then((res) => {
    if (!res.isSuccess) {
      return
    }
    res.data.routes.forEach((route) => {
      if (route.enabled && route.advertised && route.prefix === '0.0.0.0/0') {
        exitNodeOptions.value.push({
          label: route.node.givenName,
          value: route.node.givenName,
        })
      }
    })
  })
}

function changeOption(value: string[]) {
  options.value = value
  if (value.includes('--exit-node')) {
    renderExitNodeOptions()
  }
  if (!value.includes('--exit-node')) {
    // 去掉--exit-node-allow-lan-access
    options.value = options.value.filter(option => option !== '--exit-node-allow-lan-access')
  }
  renderCodeText()
}

function onOperatorUpdate(value: string) {
  operator.value = value
  renderCodeText()
}

function onHostnameUpdate(value: string) {
  hostname.value = value
  renderCodeText()
}

function onTimeoutUpdate(value: string) {
  timeout.value = value
  renderCodeText()
}

function onAuthKeyUpdate(value: string) {
  authKey.value = value
  renderCodeText()
}

function onAcceptRiskUpdate(value: string) {
  acceptRisk.value = value
  renderCodeText()
}

function onexitNodeUpdate(value: string) {
  exitNode.value = value
  renderCodeText()
}

const handleAdvertiseTagCreate: (label: string) => { label: string, value: string } = label => handleTagCreate(label, advertiseTags, t)

function isValidCIDR(cidr: string): boolean {
  const cidrRegex = /^(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\/(?:\d|[12]\d|3[0-2])$/
  return cidrRegex.test(cidr)
}

const handleAdvertiseRoutesCreate: (label: string) => { label: string, value: string } = (label) => {
  // 判断是否已经存在
  if (advertiseRoutes.value.find(tag => tag.label === label)) {
    // 显示成功消息并抛出异常
    window.$message.success(`${label} ${t('common.exists')}`)
    throw new Error(`Tag with label "${label}" already exists.`)
  }

  // 判断是否是有效的CIDR
  if (!isValidCIDR(label)) {
    // 显示错误消息并抛出异常
    window.$message.error(`${label} ${t('app.InvalidCIDR')}`)
    throw new Error(`Tag with label "${label}" is invalid.`)
  }

  return { label, value: label }
}

function onAdvertiseTagsUpdate(value: { label: string, value: string }[]) {
  advertiseTags.value = value
  advertiseTagsValues.value = value.map(tag => tag.value).join(',')
  renderCodeText()
}

function onAdvertiseRoutesUpdate(value: { label: string, value: string }[]) {
  advertiseRoutes.value = value
  advertiseRoutesValues.value = value.map(tag => tag.label).join(',')
  renderCodeText()
}

function downloadTailscale() {
  window.open('https://tailscale.com/download', '_blank')
}

function downloadStatic() {
  window.open('https://pkgs.tailscale.com/stable/#static', '_blank')
}

onMounted(() => {
  renderCodeText()
})
</script>

<template>
  <n-space vertical>
    <n-flex>
      <n-flex class="ml-a download-text">
        <n-flex vertical justify="center">
          {{ `${t('common.download')} Tailscale:` }}
        </n-flex>
        <n-button secondary type="info" @click="downloadTailscale">
          <template #icon>
            <NovaIcon icon="icon-park-outline:arrow-right-up" />
          </template>
          {{ t('common.client') }}
        </n-button>
        <n-button secondary type="info" @click="downloadStatic">
          <template #icon>
            <NovaIcon icon="icon-park-outline:arrow-right-up" />
          </template>
          {{ t('common.staticBinaries') }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-card size="small" hoverable embedded style="cursor: pointer" @click="copyCode">
      <n-code :code="code" language="shell" class="code" word-wrap />
    </n-card>

    <n-card>
      <n-checkbox-group v-model:value="options" @update:value="changeOption">
        <n-space vertical>
          <div class="title">
            General:
          </div>

          <n-grid :y-gap="15" :cols="3">
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--shields-up">
                <div class="option-command">
                  Shields Up
                  <div class="help-footnote">
                    <help-info :message="`--shields-up, --shields-up=false \r\n   ${t('app.shieldsUp')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--qr">
                <div class="option-command">
                  Generate QR Code
                  <div class="help-footnote">
                    <help-info :message="`--qr, --qr=false \r\n   ${t('app.qr')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--reset">
                <div class="option-command">
                  Rest
                  <div class="help-footnote">
                    <help-info :message="`--reset, --reset=false \r\n   ${t('app.rest')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--operator">
                  <div class="option-command">
                    Operator
                    <div class="help-footnote">
                      <help-info :message="`--operator string \r\n   ${t('app.operator')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-input v-if="options.includes('--operator')" v-model:value="operator" @update-value="onOperatorUpdate" />
              </n-flex>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--force-reauth">
                <div class="option-command">
                  Force Reauthentication
                  <div class="help-footnote">
                    <help-info :message="`--force-reauth, --force-reauth=false \r\n   ${t('app.forceReauth')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--ssh">
                <div class="option-command">
                  SSH Server
                  <div class="help-footnote">
                    <help-info :message="`--ssh string \r\n   ${t('app.ssh')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex>
                <n-checkbox value="--auth-key">
                  <div class="option-command">
                    PreAuth Key
                    <div class="help-footnote">
                      <help-info :message="`--auth-key string \r\n   ${t('app.authKey')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <AuthKeyCascader v-if="options.includes('--auth-key')" v-model:value="authKey" @update-value="onAuthKeyUpdate" />
              </n-flex>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--hostname">
                  <div class="option-command">
                    Hostname
                    <div class="help-footnote">
                      <help-info :message="`--hostname string \r\n   ${t('app.hostname')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-input v-if="options.includes('--hostname')" v-model:value="hostname" @update-value="onHostnameUpdate" />
              </n-flex>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--timeout">
                  <div class="option-command">
                    Timeout
                    <div class="help-footnote">
                      <help-info :message="`--timeout string \r\n   ${t('app.timeout')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-input v-if="options.includes('--timeout')" v-model:value="timeout" @update-value="onTimeoutUpdate" />
              </n-flex>
            </n-gi>
          </n-grid>
        </n-space>

        <n-space vertical>
          <div class="title">
            Accept:
          </div>

          <n-grid :y-gap="15" :cols="3">
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--accept-dns">
                <div class="option-command">
                  Accept DNS
                  <div class="help-footnote">
                    <help-info :message="`--accept-dns, --accept-dns=false \r\n   ${t('app.acceptDns')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--accept-routes">
                <div class="option-command">
                  Accept Routes
                  <div class="help-footnote">
                    <help-info :message="`--accept-routes, --accept-routes=false \r\n   ${t('app.acceptRoutes')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--accept-risk">
                  <div class="option-command">
                    Accept Risk
                    <div class="help-footnote">
                      <help-info :message="`--accept-risk string \r\n   ${t('app.acceptRisk')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-select v-if="options.includes('--accept-risk')" v-model:value="acceptRisk" :options="acceptRiskOptions" @update-value="onAcceptRiskUpdate" />
              </n-flex>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--exit-node">
                  <div class="option-command">
                    Exit Node
                    <div class="help-footnote">
                      <help-info :message="`--exit-node string \r\n   ${t('app.exitNode')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-select v-if="options.includes('--exit-node')" v-model:value="exitNode" :options="exitNodeOptions" @update-value="onexitNodeUpdate" />
                <n-checkbox v-if="options.includes('--exit-node') && exitNode" value="--exit-node-allow-lan-access" class="pl-20">
                  <div class="option-command">
                    Allow LAN Access
                    <div class="help-footnote">
                      <help-info :message="`--exit-node-allow-lan-access, --exit-node-allow-lan-access=false \r\n   ${t('app.exitNodeAllowLanAccess')}`" />
                    </div>
                  </div>
                </n-checkbox>
              </n-flex>
            </n-gi>
          </n-grid>
        </n-space>

        <n-space vertical>
          <div class="title">
            Advertise:
          </div>

          <n-grid :y-gap="15" :cols="3">
            <n-gi class="pl-20 md-440">
              <n-checkbox value="--advertise-connector">
                <div class="option-command">
                  Advertise Connector
                  <div class="help-footnote">
                    <help-info :message="`--advertise-connector, --advertise-connector=false \r\n   ${t('app.advertiseConnector')}`" />
                  </div>
                </div>
              </n-checkbox>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--advertise-exit-node">
                  <div class="option-command">
                    Advertise Exit Node
                    <div class="help-footnote">
                      <help-info :message="`--advertise-exit-node, --advertise-exit-node=false \r\n   ${t('app.advertiseExitNode')}`" />
                    </div>
                  </div>
                </n-checkbox>
              </n-flex>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--advertise-tags">
                  <div class="option-command">
                    Advertise Tags
                    <div class="help-footnote">
                      <help-info :message="`--advertise-tags string \r\n   ${t('app.advertiseTags')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-dynamic-tags v-if="options.includes('--advertise-tags')" v-model:value="advertiseTags" type="info" @create="handleAdvertiseTagCreate" @update-value="onAdvertiseTagsUpdate" />
              </n-flex>
            </n-gi>
            <n-gi class="pl-20 md-440">
              <n-flex vertical>
                <n-checkbox value="--advertise-routes">
                  <div class="option-command">
                    Advertise Routes
                    <div class="help-footnote">
                      <help-info :message="`--advertise-routes string \r\n   ${t('app.advertiseRoutes')}`" />
                    </div>
                  </div>
                </n-checkbox>
                <n-dynamic-tags v-if="options.includes('--advertise-routes')" v-model:value="advertiseRoutes" type="info" input-style="width: 150px;" @create="handleAdvertiseRoutesCreate" @update-value="onAdvertiseRoutesUpdate" />
              </n-flex>
            </n-gi>
          </n-grid>
        </n-space>
      </n-checkbox-group>
    </n-card>
  </n-space>
</template>

<style scoped>
.download-text {
  font-size: 20px;
  font-weight: 500;
}
.code {
  font-size: 18px;
}
.title {
  font-size: 23px;
}
.pl-20 {
  padding-left: 20px;
}
.md-440 {
  max-width: 440px;
}
.option-command {
  display: flex;
  flex-flow: wrap;
  justify-content: flex-start;
  gap: 8px 12px;
  font-size: 16px;
}
.help-footnote {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
