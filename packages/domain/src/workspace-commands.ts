import {
  DomainError,
  cloneProject,
  type Project,
  type Workspace,
  type WorkspaceId,
} from './model.js';
import { appendWorkspaceProject } from './workspace-projects.js';

export interface WorkspaceCommandMetadata {
  commandId: string;
  createdAt: string;
}

export interface AddProjectCommand extends WorkspaceCommandMetadata {
  type: 'workspace.project.add';
  workspaceId: WorkspaceId;
  project: Project;
}

export type WorkspaceCommand = AddProjectCommand;

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

  return {
    workspace: appendWorkspaceProject(workspace, command.project, command.createdAt),
    changed: true,
  };
}
