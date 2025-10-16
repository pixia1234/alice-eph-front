const DEFAULT_API_BASE = (import.meta.env?.DEV ? '/api' : 'https://app.alice.ws/cli/v1')
const ENV_API_BASE = import.meta.env?.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL = (ENV_API_BASE ? ENV_API_BASE : DEFAULT_API_BASE).replace(/\/$/, '')

export type ApiField = {
  key: string
  label: string
  helperText?: string
  required?: boolean
  defaultValue?: string
  placeholder?: string
  options?: { label: string; value: string }[]
  multiline?: boolean
  transform?: 'base64'
}

export type ApiEndpoint = {
  id: string
  name: string
  method: 'GET' | 'POST'
  path: string
  description?: string
  bodyFields?: ApiField[]
}

export const endpoints: ApiEndpoint[] = [
  {
    id: 'evo-instance-list',
    name: 'EVO Instance List',
    method: 'GET',
    path: '/Evo/Instance',
    description: 'Retrieve all EVO instances associated with the authenticated user.',
  },
  {
    id: 'evo-deploy',
    name: 'Deploy EVO Instance',
    method: 'POST',
    path: '/Evo/Deploy',
    description: 'Provision a new EVO instance using a plan, OS, and duration.',
    bodyFields: [
      {
        key: 'product_id',
        label: 'Plan ID',
        helperText: 'Use an ID from the plan list endpoint.',
        required: true,
      },
      {
        key: 'os_id',
        label: 'OS ID',
        helperText: 'Use an ID obtained from the OS list for the selected plan.',
        required: true,
      },
      {
        key: 'time',
        label: 'Duration (hours)',
        helperText: 'Number of hours the instance should run.',
        defaultValue: '24',
        required: true,
      },
      {
        key: 'bootScript',
        label: 'Boot Script',
        helperText: 'Optional script to run on first boot. Encoded as Base64 before submission.',
        multiline: true,
        transform: 'base64',
      },
      {
        key: 'sshKey',
        label: 'SSH Key ID',
        helperText: 'Optional SSH key ID associated with the account.',
      },
    ],
  },
  {
    id: 'evo-destroy',
    name: 'Destroy EVO Instance',
    method: 'POST',
    path: '/Evo/Destroy',
    description: 'Terminate a provisioned instance by its numeric ID.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        helperText: 'Instance identifier as returned by the instance list endpoint.',
        required: true,
      },
    ],
  },
  {
    id: 'evo-power',
    name: 'EVO Instance Power',
    method: 'POST',
    path: '/Evo/Power',
    description: 'Control the power state for an instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
      },
      {
        key: 'action',
        label: 'Action',
        helperText: 'Accepts boot, reboot, or shutdown.',
        defaultValue: 'reboot',
        required: true,
        options: [
          { label: 'Reboot', value: 'reboot' },
          { label: 'Boot', value: 'boot' },
          { label: 'Shutdown', value: 'shutdown' },
        ],
      },
    ],
  },
  {
    id: 'evo-rebuild',
    name: 'Rebuild EVO Instance',
    method: 'POST',
    path: '/Evo/Rebuild',
    description: 'Reinstall the operating system for an instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
      },
      {
        key: 'os',
        label: 'OS ID',
        helperText: 'Target operating system identifier.',
        required: true,
      },
      {
        key: 'bootScript',
        label: 'Boot Script',
        helperText: 'Optional script to run after rebuild. Encoded as Base64 before submission.',
        multiline: true,
        transform: 'base64',
      },
      {
        key: 'sshKey',
        label: 'SSH Key ID',
        helperText: 'Optional SSH key to inject during rebuild.',
      },
    ],
  },
  {
    id: 'evo-plan-list',
    name: 'EVO Plan List',
    method: 'GET',
    path: '/Evo/Plan',
    description: 'List available EVO compute plans.',
  },
  {
    id: 'evo-plan-os',
    name: 'EVO getOSByPlan',
    method: 'POST',
    path: '/Evo/getOSByPlan',
    description: 'Fetch operating systems supported by a specific plan.',
    bodyFields: [
      {
        key: 'plan_id',
        label: 'Plan ID',
        required: true,
      },
    ],
  },
  {
    id: 'evo-renewal',
    name: 'EVO Instance Renewal',
    method: 'POST',
    path: '/Evo/Renewal',
    description: 'Extend the runtime for an existing instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
      },
      {
        key: 'time',
        label: 'Additional Hours',
        helperText: 'Number of extra hours to add to the instance lifetime.',
        defaultValue: '1',
        required: true,
      },
    ],
  },
  {
    id: 'evo-instance-state',
    name: 'EVO Instance State',
    method: 'POST',
    path: '/Evo/State',
    description: 'Request a live status update for an instance.',
    bodyFields: [
      {
        key: 'id',
        label: 'Instance ID',
        required: true,
      },
    ],
  },
  {
    id: 'user-sshkeys',
    name: 'User SSH Keys',
    method: 'GET',
    path: '/User/SSHKey',
    description: 'Retrieve SSH keys stored for the authenticated user.',
  },
  {
    id: 'user-evo-permissions',
    name: 'User EVO Permissions',
    method: 'GET',
    path: '/User/EVOPermissions',
    description: 'Inspect the current user permissions for EVO actions.',
  },
  {
    id: 'user-info',
    name: 'User Info',
    method: 'GET',
    path: '/User/Info',
    description: 'Fetch basic account profile metadata.',
  },
  {
    id: 'command-execute-async',
    name: 'Execute Command (Async)',
    method: 'POST',
    path: '/Command/executeAsync',
    description: 'Run a shell command asynchronously on the selected instance.',
    bodyFields: [
      {
        key: 'server_id',
        label: 'Instance ID',
        helperText: 'Target instance identifier.',
        required: true,
      },
      {
        key: 'command',
        label: 'Command',
        helperText: 'Shell command to execute remotely. Encoded as Base64 when auto mode is enabled.',
        required: true,
        multiline: true,
        transform: 'base64',
      },
    ],
  },
  {
    id: 'command-get-result',
    name: 'Get Command Result',
    method: 'POST',
    path: '/Command/getResult',
    description: 'Fetch the execution result for a previously queued command.',
    bodyFields: [
      {
        key: 'command_uid',
        label: 'Command UID',
        helperText: 'Use the UID returned by executeAsync.',
        required: true,
      },
      {
        key: 'output_base64',
        label: 'Base64 Output',
        helperText: 'Return output encoded in Base64 when set to true.',
        defaultValue: 'false',
        options: [
          { label: 'false', value: 'false' },
          { label: 'true', value: 'true' },
        ],
      },
    ],
  },
]
