import { supabase } from './supabase'

export async function uploadActivityImage(
  file: File,
  token: string,
  round: number,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${token}/activity_${round}.${ext}`
  const { error } = await supabase.storage
    .from('mentor-activity-images')
    .upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('mentor-activity-images').getPublicUrl(path).data.publicUrl
}

export async function uploadReceipt(
  file: File,
  token: string,
  monthIndex: number,
  round: number,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf'
  const path = `${token}/receipt_m${monthIndex}_r${round}.${ext}`
  const { error } = await supabase.storage
    .from('mentor-receipt-files')
    .upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from('mentor-receipt-files').getPublicUrl(path).data.publicUrl
}
