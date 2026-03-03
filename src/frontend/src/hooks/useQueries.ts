import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalBlob, type PhotoMetadata } from "../backend";
import { useActor } from "./useActor";

export function useListAllPhotos() {
  const { actor, isFetching } = useActor();
  return useQuery<PhotoMetadata[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAllPhotos();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({
      adminId,
      password,
    }: {
      adminId: string;
      password: string;
    }) => {
      // We need actor for login; use a direct call via backend
      return { adminId, password };
    },
  });
}

export function useUploadPhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      file,
      onProgress,
    }: {
      id: string;
      title: string | null;
      file: File;
      onProgress?: (pct: number) => void;
    }) => {
      if (!actor) throw new Error("Not connected");
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let blob: ExternalBlob = ExternalBlob.fromBytes(bytes);
      if (onProgress) {
        blob = blob.withUploadProgress(onProgress);
      }
      await actor.uploadPhoto(id, title, blob);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

export function useDeletePhoto() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => {
      if (!actor) throw new Error("Not connected");
      await actor.deletePhoto(photoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}
