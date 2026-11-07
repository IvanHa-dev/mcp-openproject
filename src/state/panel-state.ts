import { atom, plugin, read, set } from 'orca'
import { t, type UiLocale } from '../i18n'
import {
  formatWorktreeBranchSlug,
  matchBestWorkspaceForTicket
} from '../openproject-api'
import type { OpenProjectStateSnapshot } from '../protocol'
import {
  isStatusClosedName,
  resolvePrincipalIdString
} from '../utils/openproject-tones'

export const localeAtom = atom<UiLocale>('openproject.locale', 'en', {
  persist: 'plugin'
})
export const pageSizeAtom = atom<string>('openproject.pageSize', '100', {
  persist: 'plugin'
})
export const stateAtom = atom<OpenProjectStateSnapshot | null>(null)
export const activeTabAtom = atom<string>('openproject.activeTab', 'tickets', {
  persist: 'plugin'
})
export const scopeModeAtom = atom<'all' | 'my_todos'>(
  'openproject.scopeMode',
  'all',
  { persist: 'plugin' }
)
export const projectFilterAtom = atom<string>(
  'openproject.projectFilter',
  'all',
  { persist: 'plugin' }
)
export const statusFilterAtom = atom<string>(
  'openproject.statusFilter',
  'all',
  { persist: 'plugin' }
)
export const priorityFilterAtom = atom<string>(
  'openproject.priorityFilter',
  'all',
  { persist: 'plugin' }
)
export const searchQueryAtom = atom<string>('openproject.searchQuery', '', {
  persist: 'plugin'
})
export const ticketDetailExpandedAtom = atom<boolean>(true)
export const descriptionOpenAtom = atom<boolean>(true)
export const focusAnchorTicketIdAtom = atom<number | null>(null)
export const targetWorkspaceIdAtom = atom<string>('')
export const launchPanelOpenAtom = atom<boolean>(false)
export const launchCreateWorktreeAtom = atom<boolean>(false)
export const launchBranchDraftAtom = atom<string>('')

export const nextStatusDraftAtom = atom<string>('')
export const nextAssigneeDraftAtom = atom<string>('0')
export const nextResponsibleDraftAtom = atom<string>('0')
export const commentDraftAtom = atom<string>('')
export const lastSyncedTicketIdAtom = atom<number | null>(null)
export const feedbackMessageAtom = atom<{
  tone: 'success' | 'warning' | 'danger' | 'accent'
  text: string
} | null>(null)

export const newTicketProjectAtom = atom<string>('')
export const newTicketParentAtom = atom<string>('0')
export const newTicketSubjectAtom = atom<string>('')
export const newTicketTypeAtom = atom<string>('Task')
export const newTicketPriorityAtom = atom<string>('Normal')
export const newTicketAssigneeAtom = atom<string>('0')
export const newTicketResponsibleAtom = atom<string>('0')
export const newTicketDescAtom = atom<string>('')
export const collapsedParentIdsAtom = atom<number[]>([])

export const configUrlDraftAtom = atom<string>('')
export const configTokenDraftAtom = atom<string>('')
export const configReadProjectsDraftAtom = atom<string>('*')
export const configWriteProjectsDraftAtom = atom<string>('*')
export const configAgentDraftAtom = atom<string>('codex')
export const configMcpBinDraftAtom = atom<string>('mcp-openproject')

export function syncDraftsFromSnapshot(
  snapshot: OpenProjectStateSnapshot,
  forceTicketDraftSync = false
): void {
  set(stateAtom, snapshot)
  const cleanUrl =
    snapshot.config.baseUrl &&
    snapshot.config.baseUrl.toLowerCase() !== 'https://openproject.example.com'
      ? snapshot.config.baseUrl
      : ''
  set(configUrlDraftAtom, cleanUrl)
  set(configReadProjectsDraftAtom, snapshot.config.readProjects || '*')
  set(configWriteProjectsDraftAtom, snapshot.config.writeProjects || '*')
  set(configAgentDraftAtom, snapshot.config.defaultAgent || 'codex')
  set(configMcpBinDraftAtom, snapshot.config.mcpBinaryPath || 'mcp-openproject')
  if (snapshot.config.pageSize) {
    set(pageSizeAtom, String(snapshot.config.pageSize))
  }

  const writableProjects = snapshot.projects.filter(
    (p) => p.canCreateWorkPackage !== false
  )
  const currentNewProj = read(newTicketProjectAtom)
  if (
    writableProjects.length > 0 &&
    (!currentNewProj ||
      !writableProjects.some((p) => p.identifier === currentNewProj))
  ) {
    set(newTicketProjectAtom, writableProjects[0].identifier)
  }

  if (snapshot.selectedTicket) {
    const prevSyncedId = read(lastSyncedTicketIdAtom)
    if (forceTicketDraftSync || prevSyncedId !== snapshot.selectedTicket.id) {
      const principals = snapshot.principals ?? []
      const bestWs = matchBestWorkspaceForTicket(
        snapshot.selectedTicket,
        snapshot.workspaces ?? []
      )
      set(lastSyncedTicketIdAtom, snapshot.selectedTicket.id)
      set(targetWorkspaceIdAtom, bestWs?.id ?? '')
      set(
        launchBranchDraftAtom,
        formatWorktreeBranchSlug(
          snapshot.selectedTicket.id,
          snapshot.selectedTicket.subject
        )
      )
      set(nextStatusDraftAtom, snapshot.selectedTicket.status)
      set(
        nextAssigneeDraftAtom,
        resolvePrincipalIdString(
          snapshot.selectedTicket.assigneeId,
          snapshot.selectedTicket.assignee,
          principals
        )
      )
      set(
        nextResponsibleDraftAtom,
        resolvePrincipalIdString(
          snapshot.selectedTicket.responsibleId,
          snapshot.selectedTicket.responsible,
          principals
        )
      )
    }
  } else {
    set(lastSyncedTicketIdAtom, null)
  }
}

export async function refreshAll(): Promise<void> {
  const locale = read(localeAtom)
  const currentProject = read(projectFilterAtom)
  const currentLimit = Number(read(pageSizeAtom) || '100')
  try {
    await plugin.request('openproject.projects.list', {
      refresh: true,
      project: currentProject,
      pageSize: currentLimit
    })
    const snapshot = await plugin.request('openproject.state.get')
    syncDraftsFromSnapshot(snapshot)
    if (!snapshot.config.baseUrl || !snapshot.config.hasToken) {
      set(activeTabAtom, 'setup')
      set(feedbackMessageAtom, {
        tone: 'warning',
        text: t(locale, 'feedback.missingCredentials')
      })
      return
    }
    set(feedbackMessageAtom, {
      tone: 'success',
      text: t(locale, 'feedback.syncedSummary', {
        taskCount: snapshot.workPackages.length,
        projectCount: snapshot.projects.length
      })
    })
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function changeProjectFilter(nextProject: string): Promise<void> {
  set(projectFilterAtom, nextProject)
  set(focusAnchorTicketIdAtom, null)
  const currentLimit = Number(read(pageSizeAtom) || '100')
  const currentStatus = read(statusFilterAtom)
  const wantClosed = isStatusClosedName(currentStatus)
  try {
    await plugin.request('openproject.workPackages.list', {
      project: nextProject || 'all',
      ...(wantClosed ? { status: 'closed' } : {}),
      limit: currentLimit
    })
    const snapshot = await plugin.request('openproject.state.get', {
      project: nextProject || 'all',
      pageSize: currentLimit
    })
    syncDraftsFromSnapshot(snapshot)
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function changeStatusFilter(nextStatus: string): Promise<void> {
  set(statusFilterAtom, nextStatus)
  set(focusAnchorTicketIdAtom, null)
  if (!isStatusClosedName(nextStatus)) {
    return
  }
  const currentProject = read(projectFilterAtom)
  const currentLimit = Number(read(pageSizeAtom) || '100')
  try {
    await plugin.request('openproject.workPackages.list', {
      project: currentProject || 'all',
      status: 'closed',
      limit: currentLimit
    })
    const snapshot = await plugin.request('openproject.state.get', {
      project: currentProject || 'all',
      pageSize: currentLimit
    })
    syncDraftsFromSnapshot(snapshot)
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function changePageSize(nextSizeStr: string): Promise<void> {
  set(pageSizeAtom, nextSizeStr)
  const nextLimit = Number(nextSizeStr) || 100
  const currentProject = read(projectFilterAtom)
  const currentStatus = read(statusFilterAtom)
  const wantClosed = isStatusClosedName(currentStatus)
  try {
    await plugin.request('openproject.workPackages.list', {
      project: currentProject,
      ...(wantClosed ? { status: 'closed' } : {}),
      limit: nextLimit
    })
    const snapshot = await plugin.request('openproject.state.get')
    syncDraftsFromSnapshot(snapshot)
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function selectTicket(
  id: number,
  fromAnchorId?: number
): Promise<void> {
  try {
    const currentSnapshot = read(stateAtom)
    if (
      fromAnchorId === undefined &&
      currentSnapshot?.selectedTicket?.id === id
    ) {
      const nextExpanded = !read(ticketDetailExpandedAtom)
      set(ticketDetailExpandedAtom, nextExpanded)
      return
    }

    if (fromAnchorId !== undefined) {
      set(focusAnchorTicketIdAtom, id)
      const timer = setTimeout(() => {
        if (read(focusAnchorTicketIdAtom) === id) {
          set(focusAnchorTicketIdAtom, null)
        }
      }, 65)
      ;(timer as unknown as { unref?: () => void })?.unref?.()
    } else {
      set(focusAnchorTicketIdAtom, null)
    }

    set(ticketDetailExpandedAtom, true)
    set(launchPanelOpenAtom, false)

    const cachedWp = currentSnapshot?.workPackages.find((wp) => wp.id === id)
    if (currentSnapshot && cachedWp) {
      const principals = currentSnapshot.principals ?? []
      const bestWs = matchBestWorkspaceForTicket(
        cachedWp,
        currentSnapshot.workspaces ?? []
      )
      set(lastSyncedTicketIdAtom, id)
      set(targetWorkspaceIdAtom, bestWs?.id ?? '')
      set(
        launchBranchDraftAtom,
        formatWorktreeBranchSlug(cachedWp.id, cachedWp.subject)
      )
      set(stateAtom, {
        ...currentSnapshot,
        selectedTicket: cachedWp,
        activities: []
      })
      set(nextStatusDraftAtom, cachedWp.status)
      set(
        nextAssigneeDraftAtom,
        resolvePrincipalIdString(
          cachedWp.assigneeId,
          cachedWp.assignee,
          principals
        )
      )
      set(
        nextResponsibleDraftAtom,
        resolvePrincipalIdString(
          cachedWp.responsibleId,
          cachedWp.responsible,
          principals
        )
      )
    }

    await plugin.request('openproject.workPackages.get', { id })
    const snapshot = await plugin.request('openproject.state.get')
    syncDraftsFromSnapshot(snapshot)
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export function buildUpdatePayload(
  ticketId: number,
  confirm: boolean
): {
  id: number
  status?: string
  assigneeId?: number | null
  responsibleId?: number | null
  comment?: string
  confirm: boolean
} {
  const snapshot = read(stateAtom)
  const currentTicket = snapshot?.selectedTicket
  const principals = snapshot?.principals ?? []
  const assigneeRaw = Number(read(nextAssigneeDraftAtom) || '0')
  const responsibleRaw = Number(read(nextResponsibleDraftAtom) || '0')
  const currentAssignee = Number(
    resolvePrincipalIdString(
      currentTicket?.assigneeId,
      currentTicket?.assignee,
      principals
    )
  )
  const currentResponsible = Number(
    resolvePrincipalIdString(
      currentTicket?.responsibleId,
      currentTicket?.responsible,
      principals
    )
  )

  const payload: {
    id: number
    status?: string
    assigneeId?: number | null
    responsibleId?: number | null
    comment?: string
    confirm: boolean
  } = {
    id: ticketId,
    status: read(nextStatusDraftAtom),
    comment: read(commentDraftAtom),
    confirm
  }
  if (assigneeRaw !== currentAssignee) {
    payload.assigneeId = assigneeRaw > 0 ? assigneeRaw : null
  }
  if (responsibleRaw !== currentResponsible) {
    payload.responsibleId = responsibleRaw > 0 ? responsibleRaw : null
  }
  return payload
}

export async function confirmTicketUpdate(ticketId: number): Promise<void> {
  const locale = read(localeAtom)
  try {
    const res = await plugin.request(
      'openproject.workPackages.update',
      buildUpdatePayload(ticketId, true)
    )
    set(commentDraftAtom, '')
    set(feedbackMessageAtom, {
      tone: 'success',
      text:
        locale === 'vi'
          ? t(locale, 'feedback.updatedTicket', { id: ticketId })
          : res.summary
    })
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export function toggleParentChildrenCollapsed(parentId: number): void {
  const current = read(collapsedParentIdsAtom)
  if (current.includes(parentId)) {
    set(
      collapsedParentIdsAtom,
      current.filter((id) => id !== parentId)
    )
  } else {
    set(collapsedParentIdsAtom, [...current, parentId])
  }
}

export function startCreatingSubtask(
  parentProjectIdentifier: string,
  parentId: number
): void {
  if (parentProjectIdentifier) {
    set(newTicketProjectAtom, parentProjectIdentifier)
  }
  set(newTicketParentAtom, String(parentId))
  set(activeTabAtom, 'create')
}

export async function createNewTicket(): Promise<void> {
  try {
    const project = read(newTicketProjectAtom)
    const parentId = Number(read(newTicketParentAtom) || '0')
    const subject = read(newTicketSubjectAtom).trim()
    const typeName = read(newTicketTypeAtom) || 'Task'
    const priorityName = read(newTicketPriorityAtom) || 'Normal'
    const assigneeId = Number(read(newTicketAssigneeAtom) || '0')
    const responsibleId = Number(read(newTicketResponsibleAtom) || '0')
    const description = read(newTicketDescAtom).trim()

    const res = await plugin.request('openproject.workPackages.create', {
      project,
      subject,
      typeName,
      priorityName,
      parentId: parentId > 0 ? parentId : null,
      assigneeId: assigneeId > 0 ? assigneeId : null,
      responsibleId: responsibleId > 0 ? responsibleId : null,
      description,
      confirm: true
    })

    set(newTicketSubjectAtom, '')
    set(newTicketDescAtom, '')
    set(newTicketParentAtom, '0')
    set(activeTabAtom, 'tickets')
    set(ticketDetailExpandedAtom, true)
    set(launchPanelOpenAtom, false)
    const snapshot = await plugin.request('openproject.state.get')
    syncDraftsFromSnapshot(snapshot, true)
    const locale = read(localeAtom)
    set(feedbackMessageAtom, {
      tone: 'success',
      text:
        locale === 'vi' && res.workPackage
          ? t(locale, 'feedback.createdTicket', {
              id: res.workPackage.id,
              subject: res.workPackage.subject
            })
          : res.summary
    })
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function launchAgentForSelectedTicket(
  ticketId: number
): Promise<void> {
  const locale = read(localeAtom)
  try {
    const selectedWsId = read(targetWorkspaceIdAtom).trim()
    const createWorktree = read(launchCreateWorktreeAtom)
    const branchName = read(launchBranchDraftAtom).trim()
    const res = await plugin.request('openproject.agent.launch', {
      ticketId,
      agent: read(configAgentDraftAtom),
      ...(selectedWsId ? { workspaceId: selectedWsId } : {}),
      createWorktree,
      ...(createWorktree && branchName ? { branchName } : {})
    })
    set(launchPanelOpenAtom, false)
    set(feedbackMessageAtom, {
      tone: 'accent',
      text: t(locale, 'feedback.launchedAgent', {
        agent: res.agent,
        workspace: res.workspaceName || res.workspaceId,
        branch: res.branchSlug,
        terminalId: res.terminalId
      })
    })
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function saveConfiguration(): Promise<void> {
  const locale = read(localeAtom)
  try {
    const tokenDraft = read(configTokenDraftAtom).trim()
    const payload: {
      baseUrl: string
      apiToken?: string
      readProjects: string
      writeProjects: string
      defaultAgent: string
      mcpBinaryPath: string
      pageSize: number
    } = {
      baseUrl: read(configUrlDraftAtom),
      readProjects: read(configReadProjectsDraftAtom),
      writeProjects: read(configWriteProjectsDraftAtom),
      defaultAgent: read(configAgentDraftAtom),
      mcpBinaryPath: read(configMcpBinDraftAtom),
      pageSize: Number(read(pageSizeAtom) || '100')
    }
    if (tokenDraft) {
      payload.apiToken = tokenDraft
    }
    const snapshot = await plugin.request('openproject.config.save', payload)
    set(configTokenDraftAtom, '')
    syncDraftsFromSnapshot(snapshot)
    set(feedbackMessageAtom, {
      tone: 'success',
      text: t(locale, 'feedback.savedConfig')
    })
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export async function registerMcpInSelectedAgent(): Promise<void> {
  const locale = read(localeAtom)
  try {
    const res = await plugin.request('openproject.mcp.register', {
      agent: read(configAgentDraftAtom)
    })
    set(feedbackMessageAtom, {
      tone: 'success',
      text:
        locale === 'vi'
          ? t(locale, 'feedback.registeredMcp', { configPath: res.configPath })
          : res.summary
    })
  } catch (err) {
    set(feedbackMessageAtom, {
      tone: 'danger',
      text: err instanceof Error ? err.message : String(err)
    })
  }
}

export function resetAllFilters(): void {
  const prevProject = read(projectFilterAtom)
  set(projectFilterAtom, 'all')
  set(scopeModeAtom, 'all')
  set(statusFilterAtom, 'all')
  set(priorityFilterAtom, 'all')
  set(searchQueryAtom, '')
  set(focusAnchorTicketIdAtom, null)
  if (prevProject && prevProject !== 'all') {
    void changeProjectFilter('all')
  }
}
