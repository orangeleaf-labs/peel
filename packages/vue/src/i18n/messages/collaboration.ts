import { params } from '@nanostores/i18n'

import { i18n } from '#vue/i18n/create'

export const collaborationMessageDefaults = {
  onThisPage: 'On this page',
  enterYourName: 'Enter your name',
  connected: 'Connected',
  follow: params('Follow {name}'),
  stopFollowing: params('Stop following {name}'),
  followingPerson: params('Following {name}'),
  stopFollowingShort: 'Stop following',
  renameAgent: params('Rename {name}'),
  agentName: 'Agent name',
  agentThinking: 'Thinking',
  agentEditing: 'Editing',
  agentIdle: 'Idle',
  nameSettingTitle: 'Your name',
  nameSettingDescription: 'Shown as the author of your comments.'
} as const

export const collaborationMessages = i18n('collaboration', collaborationMessageDefaults)
