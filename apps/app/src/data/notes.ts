import type { NoteCreate, NoteUpdate } from "@app/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseResponse } from "hono/client";
import { api } from "../lib/api";

/**
 * WZORZEC DANYCH (TanStack Query): useQuery do odczytu, useMutation do zapisu.
 * Każda mutacja po sukcesie unieważnia klucz zasobu. parseResponse rzuca dla != 2xx.
 * Nowy zasób: skopiuj ten plik i zmień klucz + wywołania api.
 */
export const notesKey = ["notes"] as const;

export function useNotes() {
  return useQuery({ queryKey: notesKey, queryFn: () => parseResponse(api.api.notes.$get()) });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: notesKey });
}

export function useCreateNote() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: (input: NoteCreate) => parseResponse(api.api.notes.$post({ json: input })),
    onSuccess,
  });
}

export function useUpdateNote() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: NoteUpdate }) =>
      parseResponse(api.api.notes[":id"].$patch({ param: { id }, json: input })),
    onSuccess,
  });
}

export function useDeleteNote() {
  const onSuccess = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => parseResponse(api.api.notes[":id"].$delete({ param: { id } })),
    onSuccess,
  });
}
