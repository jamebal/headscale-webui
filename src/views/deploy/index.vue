<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import type { TailscaleUpOption } from '@/views/deploy/command'
import { fetchRouteList } from '@/service'
import { local } from '@/utils'
import { handleTagCreate } from '@/utils/tags'
import AuthKeyCascader from '@/views/deploy/authKeyCascader.vue'
import BooleanOption from '@/views/deploy/BooleanOption.vue'
import { buildPersonalNodeRecoveryCommand, buildTailscaleUpCommand } from '@/views/deploy/command'

type NetfilterMode = 'on' | 'nodivert' | 'off'
type QrFormat = 'auto' | 'ascii' | 'large' | 'small'
type Scenario = 'deploy' | 'recover'

interface TagOption {
  label: string
  value: string
}

const { copy } = useClipboard()
const { t } = useI18n()

const serverUrl = ref(local.get('serverUrl') ?? '')
const scenario = ref<Scenario>('deploy')
const recoveryReset = ref(false)

const reset = ref<boolean | null>(true)
const shieldsUp = ref<boolean | null>(null)
const qr = ref<boolean | null>(null)
const forceReauth = ref<boolean | null>(null)
const ssh = ref<boolean | null>(null)
const acceptDns = ref<boolean | null>(true)
const acceptRoutes = ref<boolean | null>(true)
const exitNodeAllowLanAccess = ref<boolean | null>(null)
const advertiseConnector = ref<boolean | null>(null)
const advertiseExitNode = ref<boolean | null>(null)
const reportPosture = ref<boolean | null>(null)
const snatSubnetRoutes = ref<boolean | null>(null)
const statefulFiltering = ref<boolean | null>(null)
const json = ref<boolean | null>(null)

const operatorEnabled = ref(false)
const authKeyEnabled = ref(false)
const hostnameEnabled = ref(false)
const timeoutEnabled = ref(false)
const acceptRiskEnabled = ref(false)
const exitNodeEnabled = ref(false)
const advertiseTagsEnabled = ref(false)
const advertiseRoutesEnabled = ref(false)
const netfilterModeEnabled = ref(false)

const operator = ref('')
const authKey = ref('')
const hostname = ref('')
const timeout = ref('')
const acceptRisk = ref('')
const exitNode = ref<string | null>('')
const netfilterMode = ref<NetfilterMode>('on')
const qrFormat = ref<QrFormat>('auto')

const advertiseTags = ref<TagOption[]>([])
const advertiseRoutes = ref<TagOption[]>([])

const acceptRiskOptions = [
  { label: t('app.acceptRiskOptions.lose-ssh'), value: 'lose-ssh' },
  { label: t('app.acceptRiskOptions.mac-app-connector'), value: 'mac-app-connector' },
  { label: t('app.acceptRiskOptions.all'), value: 'all' },
]

const netfilterModeOptions: Array<{ label: NetfilterMode, value: NetfilterMode }> = [
  { label: 'on', value: 'on' },
  { label: 'nodivert', value: 'nodivert' },
  { label: 'off', value: 'off' },
]

const qrFormatOptions: Array<{ label: QrFormat, value: QrFormat }> = [
  { label: 'auto', value: 'auto' },
  { label: 'ascii', value: 'ascii' },
  { label: 'large', value: 'large' },
  { label: 'small', value: 'small' },
]

const exitNodeOptions = ref<Array<{ label: string, value: string }>>([])
const exitNodeOptionsLoaded = ref(false)
const exitNodeOptionsLoading = ref(false)

function pushBooleanOption(
  target: TailscaleUpOption[],
  name: TailscaleUpOption['name'],
  value: boolean | null,
) {
  if (value !== null)
    target.push({ name, value })
}

function pushRequiredStringOption(
  target: TailscaleUpOption[],
  name: TailscaleUpOption['name'],
  enabled: boolean,
  value: string,
) {
  if (enabled && value.trim() !== '')
    target.push({ name, value })
}

const deployOptions = computed<TailscaleUpOption[]>(() => {
  const result: TailscaleUpOption[] = []

  pushBooleanOption(result, '--shields-up', shieldsUp.value)
  pushBooleanOption(result, '--qr', qr.value)
  if (qr.value === true)
    result.push({ name: '--qr-format', value: qrFormat.value })
  pushBooleanOption(result, '--reset', reset.value)
  pushRequiredStringOption(result, '--operator', operatorEnabled.value, operator.value)
  pushBooleanOption(result, '--force-reauth', forceReauth.value)
  pushBooleanOption(result, '--ssh', ssh.value)
  pushRequiredStringOption(result, '--auth-key', authKeyEnabled.value, authKey.value)
  pushRequiredStringOption(result, '--hostname', hostnameEnabled.value, hostname.value)
  pushRequiredStringOption(result, '--timeout', timeoutEnabled.value, timeout.value)

  pushBooleanOption(result, '--accept-dns', acceptDns.value)
  pushBooleanOption(result, '--accept-routes', acceptRoutes.value)
  pushRequiredStringOption(result, '--accept-risk', acceptRiskEnabled.value, acceptRisk.value)
  if (exitNodeEnabled.value) {
    result.push({ name: '--exit-node', value: exitNode.value ?? '' })
    if (exitNode.value)
      pushBooleanOption(result, '--exit-node-allow-lan-access', exitNodeAllowLanAccess.value)
  }

  pushBooleanOption(result, '--advertise-connector', advertiseConnector.value)
  pushBooleanOption(result, '--advertise-exit-node', advertiseExitNode.value)
  if (advertiseTagsEnabled.value) {
    result.push({
      name: '--advertise-tags',
      value: advertiseTags.value.map(tag => tag.value).join(','),
    })
  }
  if (advertiseRoutesEnabled.value) {
    result.push({
      name: '--advertise-routes',
      value: advertiseRoutes.value.map(route => route.value).join(','),
    })
  }

  pushRequiredStringOption(result, '--netfilter-mode', netfilterModeEnabled.value, netfilterMode.value)
  pushBooleanOption(result, '--report-posture', reportPosture.value)
  pushBooleanOption(result, '--snat-subnet-routes', snatSubnetRoutes.value)
  pushBooleanOption(result, '--stateful-filtering', statefulFiltering.value)
  pushBooleanOption(result, '--json', json.value)

  return result
})

const code = computed(() => scenario.value === 'recover'
  ? buildPersonalNodeRecoveryCommand(serverUrl.value, recoveryReset.value)
  : buildTailscaleUpCommand(serverUrl.value, deployOptions.value))

function isRequiredValueMissing(enabled: boolean, value: string) {
  return enabled && value.trim() === ''
}

async function copyCode() {
  try {
    await copy(code.value)
    window.$message.success(t('components.copyText.message'))
  }
  catch {
    window.$message.error(t('components.copyText.failed'))
  }
}

async function renderExitNodeOptions() {
  if (exitNodeOptionsLoaded.value || exitNodeOptionsLoading.value)
    return

  exitNodeOptionsLoading.value = true
  try {
    const res = await fetchRouteList()
    if (!res.isSuccess)
      return

    exitNodeOptions.value = res.data.routes
      .filter(route => route.enabled && route.advertised && route.prefix === '0.0.0.0/0')
      .map(route => ({
        label: route.node.givenName,
        value: route.node.givenName,
      }))
    exitNodeOptionsLoaded.value = true
  }
  catch {
    return
  }
  finally {
    exitNodeOptionsLoading.value = false
  }
}

watch(qr, (value) => {
  if (value !== true)
    qrFormat.value = 'auto'
})

watch([exitNodeEnabled, exitNode], ([enabled, node]) => {
  if (!enabled || !node)
    exitNodeAllowLanAccess.value = null
  if (enabled)
    void renderExitNodeOptions()
})

const handleAdvertiseTagCreate: (label: string) => TagOption = label => handleTagCreate(label, advertiseTags, t)

function isValidCIDR(cidr: string): boolean {
  const cidrRegex = /^(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})\/(?:\d|[12]\d|3[0-2])$/
  return cidrRegex.test(cidr)
}

const handleAdvertiseRoutesCreate: (label: string) => TagOption = (label) => {
  if (advertiseRoutes.value.find(route => route.label === label)) {
    window.$message.success(`${label} ${t('common.exists')}`)
    throw new Error(`Tag with label "${label}" already exists.`)
  }

  if (!isValidCIDR(label)) {
    window.$message.error(`${label} ${t('app.InvalidCIDR')}`)
    throw new Error(`Tag with label "${label}" is invalid.`)
  }

  return { label, value: label }
}

function downloadTailscale() {
  window.open('https://tailscale.com/download', '_blank')
}

function downloadStatic() {
  window.open('https://pkgs.tailscale.com/stable/#static', '_blank')
}
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

    <n-radio-group v-model:value="scenario" name="deploy-scenario">
      <n-radio-button
        value="deploy"
        data-testid="scenario-deploy"
        @click="scenario = 'deploy'"
      >
        {{ t('app.deployScenario.deploy') }}
      </n-radio-button>
      <n-radio-button
        value="recover"
        data-testid="scenario-recover"
        @click="scenario = 'recover'"
      >
        {{ t('app.deployScenario.recover') }}
      </n-radio-button>
    </n-radio-group>

    <n-card data-testid="command-card" size="small" hoverable embedded style="cursor: pointer" @click="copyCode">
      <n-code :code="code" language="shell" class="code" word-wrap />
    </n-card>

    <n-card v-if="scenario === 'deploy'">
      <n-space vertical>
        <div class="title">
          General:
        </div>

        <n-grid :y-gap="15" :cols="3">
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="shieldsUp" data-testid="shields-up" label="Shields Up" :help="`--shields-up, --shields-up=false \r\n   ${t('app.shieldsUp')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="qr" data-testid="qr" label="Generate QR Code" :help="`--qr, --qr=false \r\n   ${t('app.qr')}`" />
            <n-select
              v-if="qr === true"
              v-model:value="qrFormat"
              data-testid="qr-format-select"
              :options="qrFormatOptions"
            />
            <help-info v-if="qr === true" :message="t('app.deployOptions.qrFormat')" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="reset" data-testid="reset" label="Reset" :help="`--reset, --reset=false \r\n   ${t('app.rest')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="operatorEnabled" data-testid="operator-enable">
                Operator
              </n-checkbox>
              <template v-if="operatorEnabled">
                <n-input v-model:value="operator" :status="isRequiredValueMissing(operatorEnabled, operator) ? 'error' : undefined" />
                <div v-if="isRequiredValueMissing(operatorEnabled, operator)" class="validation-error">
                  {{ t('app.deployOptions.valueRequired') }}
                </div>
              </template>
            </n-flex>
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="forceReauth" data-testid="force-reauth" label="Force Reauthentication" :help="`--force-reauth, --force-reauth=false \r\n   ${t('app.forceReauth')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="ssh" data-testid="ssh" label="SSH Server" :help="`--ssh, --ssh=false \r\n   ${t('app.ssh')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="authKeyEnabled" data-testid="auth-key-enable">
                PreAuth Key
              </n-checkbox>
              <template v-if="authKeyEnabled">
                <AuthKeyCascader v-model:value="authKey" />
                <div v-if="isRequiredValueMissing(authKeyEnabled, authKey)" class="validation-error">
                  {{ t('app.deployOptions.valueRequired') }}
                </div>
              </template>
            </n-flex>
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="hostnameEnabled" data-testid="hostname-enable">
                Hostname
              </n-checkbox>
              <template v-if="hostnameEnabled">
                <n-input
                  v-model:value="hostname"
                  data-testid="hostname-input"
                  :status="isRequiredValueMissing(hostnameEnabled, hostname) ? 'error' : undefined"
                />
                <div v-if="isRequiredValueMissing(hostnameEnabled, hostname)" data-testid="hostname-error" class="validation-error">
                  {{ t('app.deployOptions.valueRequired') }}
                </div>
              </template>
            </n-flex>
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="timeoutEnabled" data-testid="timeout-enable">
                Timeout
              </n-checkbox>
              <template v-if="timeoutEnabled">
                <n-input v-model:value="timeout" :status="isRequiredValueMissing(timeoutEnabled, timeout) ? 'error' : undefined" />
                <div v-if="isRequiredValueMissing(timeoutEnabled, timeout)" class="validation-error">
                  {{ t('app.deployOptions.valueRequired') }}
                </div>
              </template>
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
            <BooleanOption v-model="acceptDns" data-testid="accept-dns" label="Accept DNS" :help="`--accept-dns, --accept-dns=false \r\n   ${t('app.acceptDns')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="acceptRoutes" data-testid="accept-routes" label="Accept Routes" :help="`--accept-routes, --accept-routes=false \r\n   ${t('app.acceptRoutes')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="acceptRiskEnabled" data-testid="accept-risk-enable">
                Accept Risk
              </n-checkbox>
              <template v-if="acceptRiskEnabled">
                <n-select v-model:value="acceptRisk" :options="acceptRiskOptions" :status="isRequiredValueMissing(acceptRiskEnabled, acceptRisk) ? 'error' : undefined" />
                <div v-if="isRequiredValueMissing(acceptRiskEnabled, acceptRisk)" class="validation-error">
                  {{ t('app.deployOptions.valueRequired') }}
                </div>
              </template>
            </n-flex>
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="exitNodeEnabled" data-testid="exit-node-enable">
                Exit Node
              </n-checkbox>
              <n-select v-if="exitNodeEnabled" v-model:value="exitNode" data-testid="exit-node-select" :options="exitNodeOptions" clearable filterable tag />
              <BooleanOption
                v-if="exitNodeEnabled && exitNode"
                v-model="exitNodeAllowLanAccess"
                data-testid="exit-node-allow-lan-access"
                label="Allow LAN Access"
                :help="`--exit-node-allow-lan-access, --exit-node-allow-lan-access=false \r\n   ${t('app.exitNodeAllowLanAccess')}`"
              />
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
            <BooleanOption v-model="advertiseConnector" data-testid="advertise-connector" label="Advertise Connector" :help="`--advertise-connector, --advertise-connector=false \r\n   ${t('app.advertiseConnector')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="advertiseExitNode" data-testid="advertise-exit-node" label="Advertise Exit Node" :help="`--advertise-exit-node, --advertise-exit-node=false \r\n   ${t('app.advertiseExitNode')}`" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="advertiseTagsEnabled" data-testid="advertise-tags-enable">
                Advertise Tags
              </n-checkbox>
              <n-dynamic-tags v-if="advertiseTagsEnabled" v-model:value="advertiseTags" type="info" @create="handleAdvertiseTagCreate" />
            </n-flex>
          </n-gi>
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-checkbox v-model:checked="advertiseRoutesEnabled" data-testid="advertise-routes-enable">
                Advertise Routes
              </n-checkbox>
              <n-dynamic-tags v-if="advertiseRoutesEnabled" v-model:value="advertiseRoutes" type="info" input-style="width: 150px;" @create="handleAdvertiseRoutesCreate" />
            </n-flex>
          </n-gi>
        </n-grid>
      </n-space>

      <n-space vertical>
        <div class="title">
          More:
        </div>

        <n-grid :y-gap="15" :cols="3">
          <n-gi class="pl-20 md-440">
            <n-flex vertical>
              <n-flex align="center">
                <n-checkbox v-model:checked="netfilterModeEnabled" data-testid="netfilter-mode-enable">
                  Netfilter Mode
                </n-checkbox>
                <help-info :message="t('app.deployOptions.netfilterMode')" />
              </n-flex>
              <n-select
                v-if="netfilterModeEnabled"
                v-model:value="netfilterMode"
                data-testid="netfilter-mode-select"
                :options="netfilterModeOptions"
              />
            </n-flex>
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="reportPosture" data-testid="report-posture" label="Report Posture" :help="t('app.deployOptions.reportPosture')" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="snatSubnetRoutes" data-testid="snat-subnet-routes" label="SNAT Subnet Routes" :help="t('app.deployOptions.snatSubnetRoutes')" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="statefulFiltering" data-testid="stateful-filtering" label="Stateful Filtering" :help="t('app.deployOptions.statefulFiltering')" />
          </n-gi>
          <n-gi class="pl-20 md-440">
            <BooleanOption v-model="json" data-testid="json" label="JSON Output" :help="t('app.deployOptions.json')" />
          </n-gi>
        </n-grid>
      </n-space>
    </n-card>

    <n-card v-else>
      <n-space vertical>
        <n-alert type="warning" :title="t('app.deployRecovery.disconnectTitle')">
          {{ t('app.deployRecovery.disconnectWarning') }}
        </n-alert>
        <p>{{ t('app.deployRecovery.clearTags') }}</p>
        <p>{{ t('app.deployRecovery.loginAsPersonalUser') }}</p>
        <p>{{ t('app.deployRecovery.verifyOwner') }}</p>
        <n-checkbox v-model:checked="recoveryReset" data-testid="recovery-reset">
          {{ t('app.deployRecovery.resetOtherSettings') }}
        </n-checkbox>
        <n-alert v-if="recoveryReset" type="error">
          {{ t('app.deployRecovery.resetWarning') }}
        </n-alert>
      </n-space>
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
.validation-error {
  color: var(--error-color, #d03050);
  font-size: 12px;
}
</style>
