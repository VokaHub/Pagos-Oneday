export const CLOUDINARY_CLOUD_NAME = 'uelrhbi7';
export const CLOUDINARY_UPLOAD_PRESET = 'oneday_comprobantes';
export const CLOUDINARY_FOLDER = 'Comprobantes';

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  publicId?: string;
  error?: string;
}

/**
 * Sube una imagen (Base64 o File) de forma segura y directa a Cloudinary
 * usando el preset no firmado (unsigned) 'oneday_comprobantes'.
 * Devuelve la URL HTTPS permanente del comprobante.
 */
export async function uploadReceiptToCloudinary(
  imageSource: string | File,
  clientName?: string,
  oficina?: string
): Promise<CloudinaryUploadResult> {
  if (!imageSource) {
    return { success: false, url: '', error: 'No se proporcionó imagen' };
  }

  // Si ya es una URL web completa (ej. ya alojada), no necesita re-subida
  if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
    return { success: true, url: imageSource };
  }

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append('file', imageSource);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    if (CLOUDINARY_FOLDER) {
      formData.append('folder', CLOUDINARY_FOLDER);
    }

    const cleanClient = (clientName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanOficina = (oficina || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    formData.append('context', `cliente=${cleanClient}|oficina=${cleanOficina}|fecha=${timestamp}`);

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Error ${res.status} al subir a Cloudinary`;
      console.warn('[Cloudinary] Falló la subida:', msg);
      return { success: false, url: '', error: msg };
    }

    const data = await res.json();
    if (data.secure_url) {
      console.log('[Cloudinary] Comprobante subido exitosamente:', data.secure_url);
      return {
        success: true,
        url: data.secure_url,
        publicId: data.public_id,
      };
    }

    return {
      success: false,
      url: '',
      error: 'Respuesta sin URL segura de Cloudinary',
    };
  } catch (err: any) {
    console.error('[Cloudinary] Error de conexión:', err);
    return {
      success: false,
      url: '',
      error: err?.message || 'Error de conexión con Cloudinary',
    };
  }
}
