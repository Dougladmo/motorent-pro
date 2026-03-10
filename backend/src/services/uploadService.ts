import { createStorage } from 'formdata-io/storage';
import { randomUUID } from 'crypto';

export class UploadService {
  private motorcycleStorage;
  private qrStorage;
  private bucketName = 'motorcycle-images';

  // Tipos de imagem permitidos
  private allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // Tamanho máximo: 5MB
  private maxFileSize = 5 * 1024 * 1024;

  constructor() {
    this.motorcycleStorage = createStorage({
      provider: 'supabase',
      bucket: 'motorcycle-images',
      url: process.env.SUPABASE_URL!,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      keyPrefix: 'motorcycles',
      publicBucket: true
    });

    this.qrStorage = createStorage({
      provider: 'supabase',
      bucket: 'qr-codes',
      url: process.env.SUPABASE_URL!,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      publicBucket: true
    });
  }

  /**
   * Faz upload de imagem para o Supabase Storage
   * @param file Buffer do arquivo
   * @param mimeType Tipo MIME do arquivo
   * @param originalName Nome original do arquivo
   * @returns URL pública da imagem
   */
  async uploadMotorcycleImage(
    file: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<string> {
    // Validar tipo de arquivo
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new Error(
        `Tipo de arquivo não permitido. Use: ${this.allowedMimeTypes.join(', ')}`
      );
    }

    // Validar tamanho
    if (file.length > this.maxFileSize) {
      throw new Error(
        `Arquivo muito grande. Tamanho máximo: ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    const fileExtension = this.getFileExtension(originalName, mimeType);
    const filename = `${randomUUID()}${fileExtension}`;

    try {
      const result = await this.motorcycleStorage.upload(file, { filename });
      return result.url;
    } catch (error: any) {
      console.error('[UploadService] Erro inesperado:', error);
      throw new Error(`Erro ao processar upload: ${error.message}`);
    }
  }

  /**
   * Deleta imagem do Supabase Storage
   * @param imageUrl URL da imagem a ser deletada
   */
  async deleteMotorcycleImage(imageUrl: string): Promise<void> {
    try {
      const key = this.extractKeyFromUrl(imageUrl);

      if (!key) {
        throw new Error('URL de imagem inválida');
      }

      await this.motorcycleStorage.delete(key);
    } catch (error: any) {
      console.error('[UploadService] Erro ao deletar:', error);
      // Não lançar erro - a deleção de imagem é secundária
      console.warn('Imagem não foi deletada, mas operação continua');
    }
  }

  /**
   * Extrai a storage key da URL pública do Supabase
   */
  private extractKeyFromUrl(url: string): string | null {
    try {
      // Formato: https://[project].supabase.co/storage/v1/object/public/[bucket]/[key]
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.indexOf(this.bucketName);

      if (bucketIndex === -1) {
        return null;
      }

      return pathParts.slice(bucketIndex + 1).join('/');
    } catch {
      return null;
    }
  }

  /**
   * Determina extensão do arquivo baseado no nome original e MIME type
   */
  private getFileExtension(originalName: string, mimeType: string): string {
    const nameParts = originalName.split('.');
    if (nameParts.length > 1) {
      return `.${nameParts[nameParts.length - 1].toLowerCase()}`;
    }

    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    return extensionMap[mimeType] || '.jpg';
  }

  /**
   * Faz upload de QR Code PIX (base64) para o Supabase Storage bucket 'qr-codes'
   * @param base64 String base64 do PNG (com ou sem prefixo data:image/png;base64,)
   * @param paymentId ID do pagamento (usado no nome do arquivo)
   * @returns URL pública da imagem
   */
  async uploadQrCodeToStorage(base64: string, paymentId: string): Promise<string> {
    const dataUri = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    const result = await this.qrStorage.upload(dataUri, { filename: `qrcode_${paymentId}.png` });
    return result.url;
  }
}
