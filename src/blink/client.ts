import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'cardscan-attendance-2cyquoxx',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_roO0Dyyw_EqoWrrIF3W27_376Kid9bOk',
  authRequired: false,
  auth: { mode: 'managed' },
})
