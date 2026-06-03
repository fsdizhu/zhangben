import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEntries, addEntry, updateEntry, deleteEntry } from '../api';
import type { Entry, EntryRequest } from '../types';

export function useEntries(sortBy: string, order: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['entries', sortBy, order, page, pageSize],
    queryFn: () => getEntries(sortBy, order, pageSize, (page - 1) * pageSize),
  });
}

export function useAddEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (entry: EntryRequest) => addEntry(entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, entry, password }: { id: number; entry: Partial<Entry>; password: string }) => 
      updateEntry(id, { ...entry, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => deleteEntry(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}
