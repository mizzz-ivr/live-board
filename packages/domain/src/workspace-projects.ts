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

export function deleteWorkspaceProject(
  workspace: Workspace,
  projectId: ProjectId,
  updatedAt = new Date().toISOString(),
): Workspace {
  const projectIndex = workspace.projects.findIndex(
    (project) => project.id === projectId,
  );
  if (projectIndex < 0) findProject(workspace, projectId);
  if (workspace.projects.length <= 1) {
    throw new DomainError(
      'LAST_PROJECT_DELETE_FORBIDDEN',
      'Workspace must contain at least one project',
    );
  }

  const projects = workspace.projects.filter((project) => project.id !== projectId);
  const activeProjectId = workspace.activeProjectId === projectId
    ? projects[Math.min(projectIndex, projects.length - 1)]!.id
    : workspace.activeProjectId;
  const nextWorkspace: Workspace = {
    ...workspace,
    projects,
    activeProjectId,
    updatedAt,
  };
  assertWorkspaceIntegrity(nextWorkspace);
  return nextWorkspace;
}

export function restoreWorkspaceProject(
  workspace: Workspace,
  project: Project,
  projectIndex: number,
  activeProjectId: ProjectId,
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
  if (
    !Number.isInteger(projectIndex) ||
    projectIndex < 0 ||
    projectIndex > workspace.projects.length
  ) {
    throw new DomainError(
      'INVALID_PROJECT_INDEX',
      `Invalid project index: ${projectIndex}`,
    );
  }

  const projects = [...workspace.projects];
  projects.splice(projectIndex, 0, cloneProject(project));
  if (!projects.some((candidate) => candidate.id === activeProjectId)) {
    throw new DomainError(
      'PROJECT_NOT_FOUND',
      `Project not found: ${activeProjectId}`,
    );
  }

  const nextWorkspace: Workspace = {
    ...workspace,
    projects,
    activeProjectId,
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
