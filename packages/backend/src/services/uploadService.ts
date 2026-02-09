import { getSupabaseClient } from '../config/supabase';
import { randomUUID } from 'crypto';

export class UploadService {
  private supabase = getSupabaseClient();
  private bucketName = 'motorcycle-images';

  // Tipos de imagem permitidos
  private allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  // Tamanho máximo: 5MB
  private maxFileSize = 5 * 1024 * 1024;

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

    // Gerar nome único para o arquivo
    const fileExtension = this.getFileExtension(originalName, mimeType);
    const fileName = `${randomUUID()}${fileExtension}`;
    const filePath = `motorcycles/${fileName}`;

    try {
      // Upload para o Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          contentType: mimeType,
          upsert: false
        });

      if (error) {
        console.error('[UploadService] Erro ao fazer upload:', error);
        throw new Error(`Erro ao fazer upload: ${error.message}`);
      }

      // Obter URL pública
      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
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
      // Extrair caminho do arquivo da URL
      const filePath = this.extractFilePathFromUrl(imageUrl);

      if (!filePath) {
        throw new Error('URL de imagem inválida');
      }

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('[UploadService] Erro ao deletar imagem:', error);
        throw new Error(`Erro ao deletar imagem: ${error.message}`);
      }
    } catch (error: any) {
      console.error('[UploadService] Erro ao deletar:', error);
      // Não lançar erro - a deleção de imagem é secundária
      console.warn('Imagem não foi deletada, mas operação continua');
    }
  }

  /**
   * Extrai o caminho do arquivo da URL pública do Supabase
   */
  private extractFilePathFromUrl(url: string): string | null {
    try {
      // Formato: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
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
    // Tentar extrair extensão do nome original
    const nameParts = originalName.split('.');
    if (nameParts.length > 1) {
      return `.${nameParts[nameParts.length - 1].toLowerCase()}`;
    }

    // Fallback para MIME type
    const extensionMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };

    return extensionMap[mimeType] || '.jpg';
  }

  /**
   * Verifica se o bucket existe, se não, cria
   */
  async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();

      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        const { error } = await this.supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: this.maxFileSize
        });

        if (error) {
          console.error('[UploadService] Erro ao criar bucket:', error);
        } else {
          console.log(`[UploadService] Bucket '${this.bucketName}' criado com sucesso`);
        }
      }
    } catch (error) {
      console.error('[UploadService] Erro ao verificar/criar bucket:', error);
    }
  }
}
