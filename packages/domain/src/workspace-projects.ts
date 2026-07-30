import {
  DomainError,
  assertWorkspaceIntegrity,
  cloneProject,
  createProject,
  findProject,
  replaceProject,
  type Project,
  type ProjectId,
  type Workspace,
} from './model.js';

export function appendWorkspaceProject(
  workspace: Workspace,
  project: Project,
  updatedAt = new Date().toISOString(),
): Workspace {
  if (project.workspaceId !== workspace.id) {
    throw new DomainError(
      'PROJECT_NOT_FOUND',
      `Project ${project.id} does not belong to workspace ${workspace.id}`,
    );
  }
  if (workspace.projects.some((candidate) => candidate.id === project.id)) {
    throw new DomainError(
      'DUPLICATE_PROJECT_ID',
      `Duplicate project id: ${project.id}`,
    );
  }

  const nextWorkspace: Workspace = {
    ...workspace,
    projects: [...workspace.projects, cloneProject(project)],
    activeProjectId: project.id,
    updatedAt,
  };
  assertWorkspaceIntegrity(nextWorkspace);
  return nextWorkspace;
}

export function selectWorkspaceProject(
  workspace: Workspace,
  projectId: ProjectId,
  updatedAt = new Date().toISOString(),
): Workspace {
  findProject(workspace, projectId);
  if (workspace.activeProjectId === projectId) return workspace;

  const nextWorkspace: Workspace = {
    ...workspace,
    activeProjectId: projectId,
    updatedAt,
  };
  assertWorkspaceIntegrity(nextWorkspace);
  return nextWorkspace;
}

export function renameWorkspaceProject(
  workspace: Workspace,
  projectId: ProjectId,
  name: string,
  updatedAt = new Date().toISOString(),
): Workspace {
  const project = findProject(workspace, projectId);
  const normalizedName = name.trim();
  if (project.name === normalizedName) return workspace;

  const renamedProject = createProject({
    ...project,
    name: normalizedName,
    updatedAt,
  });
  return replaceProject(workspace, renamedProject, updatedAt);
}
