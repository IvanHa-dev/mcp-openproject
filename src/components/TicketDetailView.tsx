import {
  Box,
  Button,
  Card,
  Collapsible,
  IconButton,
  Input,
  List,
  ListItem,
  Markdown,
  read,
  Row,
  Select,
  Separator,
  set,
  Stack,
  Text
} from 'orca'
import { createTranslator, type UiLocale } from '../i18n'
import {
  formatWorktreeBranchSlug,
  matchBestWorkspaceForTicket
} from '../openproject-api'
import type {
  DetectedAgentCli,
  OpenProjectActivity,
  OpenProjectWorkPackage,
  OpenProjectWorkspaceOption
} from '../protocol'
import {
  commentDraftAtom,
  configAgentDraftAtom,
  confirmTicketUpdate,
  descriptionOpenAtom,
  launchAgentForSelectedTicket,
  launchBranchDraftAtom,
  launchCreateWorktreeAtom,
  launchPanelOpenAtom,
  nextAssigneeDraftAtom,
  nextResponsibleDraftAtom,
  nextStatusDraftAtom,
  selectTicket,
  startCreatingSubtask,
  targetWorkspaceIdAtom,
  ticketDetailExpandedAtom
} from '../state/panel-state'
import {
  formatShortDate,
  formatWorkPackageRowMeta,
  getPriorityToneStyle,
  getStatusToneStyle,
  getTypeToneStyle
} from '../utils/openproject-tones'

export interface TicketDetailViewProps {
  locale: UiLocale
  ticket: OpenProjectWorkPackage
  allWorkPackages: OpenProjectWorkPackage[]
  canCreateSubtask?: boolean
  activities: OpenProjectActivity[]
  statusTransitionOptions: Array<{ value: string; label: string; color?: string }>
  memberOptions: Array<{ value: string; label: string }>
  workspaces?: OpenProjectWorkspaceOption[]
  detectedAgents?: DetectedAgentCli[]
}

export function TicketDetailView({
  locale,
  ticket,
  allWorkPackages,
  canCreateSubtask,
  activities,
  statusTransitionOptions,
  memberOptions,
  workspaces = [],
  detectedAgents = []
}: TicketDetailViewProps) {
  const tr = createTranslator(locale)
  const assigneeDraft = read(nextAssigneeDraftAtom) || '0'
  const responsibleDraft = read(nextResponsibleDraftAtom) || '0'

  const ticketMemberOptions = [...memberOptions]
  if (
    ticket.assigneeId &&
    !ticketMemberOptions.some((o) => o.value === String(ticket.assigneeId))
  ) {
    ticketMemberOptions.push({
      value: String(ticket.assigneeId),
      label: ticket.assignee
    })
  }
  if (
    ticket.responsibleId &&
    !ticketMemberOptions.some((o) => o.value === String(ticket.responsibleId))
  ) {
    ticketMemberOptions.push({
      value: String(ticket.responsibleId),
      label: ticket.responsible || `User #${ticket.responsibleId}`
    })
  }

  const branchSlug = formatWorktreeBranchSlug(ticket.id, ticket.subject)
  const typeStyle = getTypeToneStyle(ticket.type, ticket.typeColor)
  const prioStyle = getPriorityToneStyle(ticket.priority, ticket.priorityColor)

  const bestMatchedWs = matchBestWorkspaceForTicket(ticket, workspaces)
  const selectedWsId =
    read(targetWorkspaceIdAtom) || bestMatchedWs?.id || workspaces[0]?.id || ''
  const selectedWsObj =
    workspaces.find((w) => w.id === selectedWsId) ?? bestMatchedWs
  const selectedWsLabel =
    selectedWsObj?.repoName &&
    selectedWsObj?.name &&
    selectedWsObj.name !== selectedWsObj.repoName
      ? `${selectedWsObj.repoName}/${selectedWsObj.name}`
      : selectedWsObj?.repoName || selectedWsObj?.name || 'default'

  const launchPanelOpen = read(launchPanelOpenAtom)
  const createWorktree = read(launchCreateWorktreeAtom)
  const branchDraft = read(launchBranchDraftAtom) || branchSlug
  const selectedAgent = read(configAgentDraftAtom) || 'codex'

  const existingWorkspaceOptions =
    workspaces.length > 0
      ? workspaces.map((ws) => {
          const baseName =
            ws.repoName && ws.name && ws.name !== ws.repoName
              ? `${ws.repoName} / ${ws.name}`
              : ws.repoName || ws.name
          const branchInfo =
            ws.branch && ws.branch !== ws.name ? ` (${ws.branch})` : ''
          const activeTag = ws.isFocused ? ' ★' : ''
          return {
            value: ws.id,
            label: `${baseName}${branchInfo}${activeTag}`
          }
        })
      : [{ value: selectedWsId || 'default-workspace', label: selectedWsLabel }]

  // Deduplicate by repository when creating a new worktree so the selector mirrors Orca's Repo picker
  const repoWorkspaceOptions = (() => {
    if (workspaces.length === 0) {
      return existingWorkspaceOptions
    }
    const byRepoKey = new Map<string, OpenProjectWorkspaceOption>()
    for (const ws of workspaces) {
      const repoKey = (ws.repoId || ws.repoName || ws.name).toLowerCase()
      const existing = byRepoKey.get(repoKey)
      if (
        !existing ||
        (ws.isMainWorktree && !existing.isMainWorktree) ||
        (ws.isFocused && !existing.isFocused && existing.isMainWorktree === ws.isMainWorktree)
      ) {
        byRepoKey.set(repoKey, ws)
      }
    }
    return Array.from(byRepoKey.values()).map((ws) => {
      const repoLabel = ws.repoName || ws.name
      const activeTag = ws.isFocused ? ' ★' : ''
      return {
        value: ws.id,
        label: `${repoLabel}${activeTag}`
      }
    })
  })()

  const activeTargetOptions = createWorktree
    ? repoWorkspaceOptions
    : existingWorkspaceOptions
  const effectiveSelectedWsId = activeTargetOptions.some(
    (o) => o.value === selectedWsId
  )
    ? selectedWsId
    : activeTargetOptions[0]?.value || selectedWsId

  const installedAgents = detectedAgents.filter((a) => a.installed)
  const agentSource =
    installedAgents.length > 0 ? installedAgents : detectedAgents
  const agentOptions =
    agentSource.length > 0
      ? agentSource.map((a) => ({
          value: a.id,
          label: a.installed
            ? a.label
            : `${a.label}${tr('agent.notDetectedSuffix')}`
        }))
      : [
          { value: 'antigravity', label: 'Antigravity (agy)' },
          { value: 'codex', label: 'OpenAI Codex (codex)' },
          { value: 'claude', label: 'Claude Code (claude)' },
          { value: 'gemini', label: 'Gemini CLI (gemini)' },
          { value: 'cursor-agent', label: 'Cursor Agent (cursor-agent)' },
          { value: 'opencode', label: 'OpenCode (opencode)' }
        ]

  const parentWp = ticket.parentId
    ? allWorkPackages.find((w) => w.id === ticket.parentId)
    : undefined
  const fullParentSubject =
    ticket.parentSubject || parentWp?.subject || ''
  const subtasks = allWorkPackages
    .filter((w) => w.parentId === ticket.id)
    .sort((a, b) => a.id - b.id)

  return (
    <Stack gap="md">
      <Separator />
      {/* Row 1: Launch Agent + Bordered Type Box + Bordered Priority Box + Pinned Collapse IconButton */}
      <Row justify="between" align="center" gap="xs">
        <Row gap="xs" align="center" wrap>
          <Button
            size="xs"
            tone="accent"
            variant={launchPanelOpen ? 'solid' : 'outline'}
            tooltip={tr('ticket.launchAgentTooltip', {
              branch: branchSlug,
              workspace: selectedWsLabel
            })}
            onPress={() => set(launchPanelOpenAtom, !launchPanelOpen)}
          >
            {tr('ticket.launchAgent')}
          </Button>
          <Box
            border={typeStyle.border}
            background={typeStyle.background}
            radius="sm"
            padding="xs"
          >
            <Text size="xs" tone={typeStyle.textTone}>
              {ticket.type}
            </Text>
          </Box>
          <Box
            border={prioStyle.border}
            background={prioStyle.background}
            radius="sm"
            padding="xs"
          >
            <Text size="xs" tone={prioStyle.textTone}>
              {tr('ticket.priorityBadge', { priority: ticket.priority })}
            </Text>
          </Box>
        </Row>
        <IconButton
          size="xs"
          variant="outline"
          icon="collapse"
          label={tr('ticket.close')}
          tooltip={tr('ticket.closeTooltip')}
          onPress={() => set(ticketDetailExpandedAtom, false)}
        />
      </Row>

      {/* Inline Launch Agent Configuration Drawer (Orca Native Worktree/Agent Flow) */}
      {launchPanelOpen ? (
        <Box
          border="accent"
          background="surface"
          radius="sm"
          padding="sm"
        >
          <Stack gap="xs">
            <Row gap="xs" align="center" wrap>
              <Button
                size="xs"
                tone={!createWorktree ? 'accent' : undefined}
                variant={!createWorktree ? 'solid' : 'outline'}
                onPress={() => set(launchCreateWorktreeAtom, false)}
              >
                {tr('ticket.launchModeExisting')}
              </Button>
              <Button
                size="xs"
                tone={createWorktree ? 'accent' : undefined}
                variant={createWorktree ? 'solid' : 'outline'}
                onPress={() => set(launchCreateWorktreeAtom, true)}
              >
                {tr('ticket.launchModeWorktree')}
              </Button>
            </Row>
            <Stack gap="xs">
              <Text size="xs" weight="medium">
                {createWorktree
                  ? tr('ticket.targetRepoLabel')
                  : tr('ticket.targetWorkspaceLabel')}
              </Text>
              <Select
                label={
                  createWorktree
                    ? tr('ticket.targetRepoLabel')
                    : tr('ticket.targetWorkspaceLabel')
                }
                value={effectiveSelectedWsId}
                options={activeTargetOptions}
                onChange={(v) => set(targetWorkspaceIdAtom, v)}
              />
            </Stack>
            {createWorktree ? (
              <Input
                label={tr('ticket.worktreeBranchLabel')}
                placeholder={branchSlug}
                value={branchDraft}
                onChange={(val) => set(launchBranchDraftAtom, val)}
              />
            ) : null}
            <Stack gap="xs">
              <Text size="xs" weight="medium">
                {tr('ticket.launchAgentSelectLabel')}
              </Text>
              <Select
                label={tr('ticket.launchAgentSelectLabel')}
                value={selectedAgent}
                options={agentOptions}
                onChange={(v) => set(configAgentDraftAtom, v)}
              />
            </Stack>
            <Row gap="xs" align="center">
              <Button
                size="xs"
                tone="accent"
                onPress={() => {
                  if (effectiveSelectedWsId !== selectedWsId) {
                    set(targetWorkspaceIdAtom, effectiveSelectedWsId)
                  }
                  void launchAgentForSelectedTicket(ticket.id)
                }}
              >
                {createWorktree
                  ? tr('ticket.createAndStartButton')
                  : tr('ticket.startAgentButton')}
              </Button>
              <Button
                size="xs"
                variant="outline"
                onPress={() => set(launchPanelOpenAtom, false)}
              >
                {tr('ticket.cancelLaunchButton')}
              </Button>
            </Row>
          </Stack>
        </Box>
      ) : null}

      {/* Row 2: Parent Jump + Add Subtask + Bordered Updated Date */}
      {ticket.parentId || canCreateSubtask || ticket.updatedAt ? (
        <Row justify="between" align="center" gap="xs" wrap>
          <Row gap="xs" align="center" wrap>
            {ticket.parentId ? (
              <Button
                size="xs"
                variant="outline"
                tooltip={
                  fullParentSubject
                    ? `#${ticket.parentId} ${fullParentSubject}`
                    : tr('ticket.parentTooltip', { id: ticket.parentId })
                }
                onPress={() => selectTicket(ticket.parentId!, ticket.id)}
              >
                {tr('ticket.parentButton', {
                  id: ticket.parentId
                })}
              </Button>
            ) : null}
            {canCreateSubtask ? (
              <Button
                size="xs"
                variant="outline"
                tooltip={tr('ticket.addSubtaskTooltip', { id: ticket.id })}
                onPress={() =>
                  startCreatingSubtask(ticket.projectIdentifier, ticket.id)
                }
              >
                {tr('ticket.addSubtask')}
              </Button>
            ) : null}
          </Row>
          {ticket.updatedAt ? (
            <Box
              border="neutral"
              background="card"
              radius="sm"
              padding="xs"
            >
              <Text size="xs" muted>
                {formatShortDate(ticket.updatedAt)}
              </Text>
            </Box>
          ) : null}
        </Row>
      ) : null}

      {subtasks.length > 0 ? (
        <Collapsible
          title={tr('ticket.subtasksTitle', { count: subtasks.length })}
          defaultOpen={true}
        >
          <Box
            width="100%"
            maxHeight={420}
            scroll="y"
            border="neutral"
            background="card"
            radius="sm"
            padding="xs"
          >
            <Stack gap="xs">
              {subtasks.map((child) => {
                const childStyle = getStatusToneStyle(
                  child.status,
                  child.statusColor
                )
                return (
                  <Box
                    key={String(child.id)}
                    border={childStyle.border}
                    background={childStyle.background}
                    radius="sm"
                  >
                    <List label={`Subtask #${child.id}`}>
                      <ListItem
                        key={String(child.id)}
                        title={`↳ #${child.id} ${child.subject}`}
                        description={formatWorkPackageRowMeta(child, locale)}
                        onPress={() => selectTicket(child.id, ticket.id)}
                      />
                    </List>
                  </Box>
                )
              })}
            </Stack>
          </Box>
        </Collapsible>
      ) : null}

      {ticket.description ? (
        <Stack gap="xs">
          <Collapsible
            title={tr('ticket.description')}
            open={read(descriptionOpenAtom)}
            onChange={(nextOpen) => set(descriptionOpenAtom, Boolean(nextOpen))}
          />
          {read(descriptionOpenAtom) ? (
            <Box
              width="100%"
              minHeight={140}
              maxHeight={190}
              scroll="y"
              border="neutral"
              background="card"
              radius="sm"
              padding="sm"
            >
              <Box padding="xs">
                <Markdown content={ticket.description} />
              </Box>
            </Box>
          ) : null}
        </Stack>
      ) : null}

      <Stack gap="sm">
        <Stack gap="xs">
          <Text size="xs" weight="medium">
            {tr('ticket.transitionStatus')}
          </Text>
          <Row gap="xs" align="center" wrap>
            {statusTransitionOptions.map((opt) => {
              const currentStatus = read(nextStatusDraftAtom) || ticket.status
              const isSelected =
                currentStatus.toLowerCase().trim() ===
                opt.value.toLowerCase().trim()
              const stStyle = getStatusToneStyle(opt.value, opt.color)
              return (
                <Box
                  key={opt.value}
                  border={stStyle.border}
                  background={stStyle.background}
                  radius="md"
                >
                  <Button
                    size="xs"
                    variant={isSelected ? 'solid' : 'ghost'}
                    tone={
                      isSelected
                        ? 'accent'
                        : stStyle.border === 'danger' &&
                            stStyle.background === 'danger'
                          ? 'danger'
                          : 'neutral'
                    }
                    onPress={() => set(nextStatusDraftAtom, opt.value)}
                  >
                    {opt.label}
                  </Button>
                </Box>
              )
            })}
          </Row>
        </Stack>
        <Select
          label={tr('ticket.assignee')}
          value={assigneeDraft}
          options={ticketMemberOptions}
          onChange={(val) => {
            set(nextAssigneeDraftAtom, val)
          }}
        />
        <Select
          label={tr('ticket.responsible')}
          value={responsibleDraft}
          options={ticketMemberOptions}
          onChange={(val) => {
            set(nextResponsibleDraftAtom, val)
          }}
        />
        <Input
          label={tr('ticket.comment')}
          placeholder={tr('ticket.commentPlaceholder')}
          value={read(commentDraftAtom)}
          onChange={(val) => {
            set(commentDraftAtom, val)
          }}
        />
      </Stack>

      <Row gap="xs" align="center" wrap>
        <Button
          size="xs"
          tone="accent"
          onPress={() => confirmTicketUpdate(ticket.id)}
        >
          {tr('ticket.update')}
        </Button>
      </Row>

      {activities.length > 0 ? (
        <Collapsible
          title={tr('ticket.commentsHistory', { count: activities.length })}
          defaultOpen={false}
        >
          <Stack gap="xs">
            {activities.map((act) => (
              <Card
                key={String(act.id)}
                title={act.user}
                description={formatShortDate(act.createdAt)}
              >
                <Text size="xs">{act.comment}</Text>
              </Card>
            ))}
          </Stack>
        </Collapsible>
      ) : null}
    </Stack>
  )
}
