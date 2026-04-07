import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from './client.js';
import type {
  ContentPlan,
  UpsertContentPlanInput,
  ContentReference,
  CreateContentReferenceInput,
  PlanTemplate,
  CreatePlanTemplateInput,
} from '@contentflow/shared';

// ── Plan ────────────────────────────────────────────────────────────────────

export function useContentPlan(contentId: string) {
  return useQuery<ContentPlan | null, ApiError>({
    queryKey: ['content-plan', contentId],
    queryFn: () => apiFetch<ContentPlan | null>(`/api/contents/${contentId}/plan`),
    enabled: Boolean(contentId),
  });
}

export function useUpsertPlan(contentId: string) {
  const qc = useQueryClient();
  return useMutation<ContentPlan, ApiError, UpsertContentPlanInput>({
    mutationFn: (body) =>
      apiFetch<ContentPlan>(`/api/contents/${contentId}/plan`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['content-plan', contentId], data);
    },
  });
}

// ── References ───────────────────────────────────────────────────────────────

export function useContentReferences(contentId: string) {
  return useQuery<ContentReference[], ApiError>({
    queryKey: ['content-references', contentId],
    queryFn: () => apiFetch<ContentReference[]>(`/api/contents/${contentId}/references`),
    enabled: Boolean(contentId),
  });
}

export function useAddReference(contentId: string) {
  const qc = useQueryClient();
  return useMutation<ContentReference, ApiError, CreateContentReferenceInput>({
    mutationFn: (body) =>
      apiFetch<ContentReference>(`/api/contents/${contentId}/references`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content-references', contentId] });
    },
  });
}

export function useDeleteReference(contentId: string) {
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (refId) =>
      apiFetch<void>(`/api/contents/${contentId}/references/${refId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['content-references', contentId] });
    },
  });
}

// ── Plan Templates ────────────────────────────────────────────────────────────

export function usePlanTemplates(workspaceId: string) {
  return useQuery<PlanTemplate[], ApiError>({
    queryKey: ['plan-templates', workspaceId],
    queryFn: () => apiFetch<PlanTemplate[]>(`/api/workspaces/${workspaceId}/plan-templates`),
    enabled: Boolean(workspaceId),
  });
}

export function useCreatePlanTemplate(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation<PlanTemplate, ApiError, CreatePlanTemplateInput>({
    mutationFn: (body) =>
      apiFetch<PlanTemplate>(`/api/workspaces/${workspaceId}/plan-templates`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['plan-templates', workspaceId] });
    },
  });
}
