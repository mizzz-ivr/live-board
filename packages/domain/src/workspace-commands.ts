import {
  DomainError,
  cloneProject,
  type Project,
  type ProjectId,
  type Workspace,
  type WorkspaceId,
} from './model.js';
import {
  appendWorkspaceProject,
  selectWorkspaceProject,
} from './workspace-projects.js';

export interface WorkspaceCommandMetadata {
  commandId: string;
  createdAt: string;
}

export interface AddProjectCommand extends WorkspaceCommandMetadata {
  type: 'workspace.project.add';
  workspaceId: WorkspaceId;
  project: Project;
}

export interface SelectProjectCommand extends WorkspaceCommandMetadata {
  type: 'workspace.project.select';
  workspaceId: WorkspaceId;
  projectId: ProjectId;
}

export type WorkspaceCommand = AddProjectCommand | SelectProjectCommand;

export interface WorkspaceCommandResult {
  workspace: Workspace;
  changed: boolean;
}

export function createAddProjectCommand(
  workspaceId: WorkspaceId,
  project: Project,
  metadata: WorkspaceCommandMetadata,
): AddProjectCommand {
  return {
    type: 'workspace.project.add',
    workspaceId,
    project: cloneProject(project),
    ...metadata,
  };
}

export function createSelectProjectCommand(
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  metadata: WorkspaceCommandMetadata,
): SelectProjectCommand {
  return {
    type: 'workspace.project.select',
    workspaceId,
    projectId,
    ...metadata,
  };
}

export function applyWorkspaceCommand(
  workspace: Workspace,
  command: WorkspaceCommand,
): WorkspaceCommandResult {
  if (workspace.id !== command.workspaceId) {
    throw new DomainError(
      'WORKSPACE_NOT_FOUND',
      `Workspace not found: ${command.workspaceId}`,
    );
  }

  if (command.type === 'workspace.project.add') {
    return {
      workspace: appendWorkspaceProject(workspace, command.project, command.createdAt),
      changed: true,
    };
  }

  const nextWorkspace = selectWorkspaceProject(
    workspace,
    command.projectId,
    command.createdAt,
  );
  return {
    workspace: nextWorkspace,
    changed: nextWorkspace !== workspace,
  };
}
