import { getSupabaseClient, isSupabaseConfigured } from '@/data/notifications/supabaseClient';
import type { PublicMediaCreator, PublicMediaCreatorOption } from '@/data/media/types';

export async function listPublicMediaCreators(): Promise<PublicMediaCreator[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.rpc('list_public_media_creators');
  if (error) {
    console.warn('[mediaPublicApi] list_public_media_creators failed:', error.message);
    return [];
  }

  return ((data ?? []) as PublicMediaCreator[]).map((row) => ({
    ...row,
    links: Array.isArray(row.links) ? row.links : [],
  }));
}

export async function listPublicMediaCreatorOptions(
  search?: string,
): Promise<PublicMediaCreatorOption[]> {
  if (!isSupabaseConfigured()) return [];
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.rpc('list_public_media_creator_options', {
    p_search: search?.trim() || null,
  });
  if (error) {
    console.warn('[mediaPublicApi] list_public_media_creator_options failed:', error.message);
    return [];
  }
  return (data ?? []) as PublicMediaCreatorOption[];
}

export async function getPublicMediaCreatorLinks(
  creatorId: string,
): Promise<PublicMediaCreator | null> {
  const creators = await listPublicMediaCreators();
  return creators.find((creator) => creator.id === creatorId) ?? null;
}
