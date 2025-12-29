import { supabase } from '@/integrations/supabase/client';

export const STORAGE_BUCKETS = {
  MEAL_IMAGES: 'Slike obroka',
  RESOURCES: 'Resursi'
} as const;

export async function uploadImage(file: File, bucket: string = STORAGE_BUCKETS.MEAL_IMAGES): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Use signed URL instead of public URL since bucket might not be public
    const { data, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

    if (urlError) throw urlError;
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

export async function deleteImage(imageUrl: string, bucket: string = STORAGE_BUCKETS.MEAL_IMAGES): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlParts = imageUrl.split('/');
    const filePath = urlParts[urlParts.length - 1].split('?')[0];
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}
