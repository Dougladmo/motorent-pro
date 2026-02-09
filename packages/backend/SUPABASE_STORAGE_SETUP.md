# Configuração do Supabase Storage para Upload de Imagens

Este guia mostra como configurar o bucket no Supabase para armazenar imagens das motos.

## 1. Criar Bucket no Supabase Dashboard

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto **MotoRent Pro**
3. No menu lateral, clique em **Storage**
4. Clique em **Create a new bucket**
5. Preencha:
   - **Name**: `motorcycle-images`
   - **Public bucket**: ✅ **Marcado** (necessário para URLs públicas)
   - **File size limit**: `5242880` (5MB em bytes)
   - **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`

6. Clique em **Create bucket**

## 2. Configurar Políticas de Acesso (RLS)

### Política de Upload (INSERT)
```sql
-- Nome: "Permitir upload de imagens"
-- Operação: INSERT
-- Target roles: public

CREATE POLICY "Permitir upload de imagens"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'motorcycle-images'
  AND (storage.foldername(name))[1] = 'motorcycles'
);
```

### Política de Leitura (SELECT)
```sql
-- Nome: "Permitir leitura pública"
-- Operação: SELECT
-- Target roles: public

CREATE POLICY "Permitir leitura pública"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'motorcycle-images');
```

### Política de Deleção (DELETE)
```sql
-- Nome: "Permitir deleção de imagens"
-- Operação: DELETE
-- Target roles: authenticated

CREATE POLICY "Permitir deleção de imagens"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'motorcycle-images');
```

## 3. Estrutura de Pastas

O sistema organiza as imagens automaticamente:

```
motorcycle-images/
└── motorcycles/
    ├── uuid-1.jpg
    ├── uuid-2.png
    ├── uuid-3.webp
    └── ...
```

## 4. Variáveis de Ambiente

Certifique-se de que o arquivo `.env` no backend tem:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

⚠️ **Importante**: Use a **Service Role Key**, não a **Anon Key**, pois o backend precisa de permissões administrativas.

## 5. Verificar Configuração

### Método 1: Via Dashboard
1. Vá em **Storage** > **motorcycle-images**
2. Tente fazer upload manual de uma imagem de teste
3. Verifique se a URL pública é acessível

### Método 2: Via Backend (Recomendado)
O serviço `UploadService` tem um método para verificar/criar o bucket:

```typescript
import { UploadService } from './services/uploadService';

const uploadService = new UploadService();
await uploadService.ensureBucketExists();
```

Este método:
- ✅ Verifica se o bucket existe
- ✅ Cria automaticamente se não existir
- ✅ Configura como público com limite de 5MB

## 6. Testando Upload

### Via API REST (Postman/Thunder Client)

**Endpoint**: `POST http://localhost:3001/api/motorcycles/with-image`

**Headers**:
```
Content-Type: multipart/form-data
```

**Body** (form-data):
```
image: [arquivo de imagem]
plate: ABC-1234
model: Honda CG 160
year: 2024
status: Disponível
```

**Resposta esperada**:
```json
{
  "success": true,
  "data": {
    "id": "uuid-aqui",
    "plate": "ABC-1234",
    "model": "Honda CG 160",
    "year": 2024,
    "status": "Disponível",
    "image_url": "https://seu-projeto.supabase.co/storage/v1/object/public/motorcycle-images/motorcycles/uuid.jpg",
    "total_revenue": 0,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## 7. Limites e Restrições

- **Tamanho máximo por arquivo**: 5MB
- **Formatos permitidos**: JPEG, JPG, PNG, WEBP
- **Nome dos arquivos**: UUID único (evita conflitos)
- **Organização**: Pasta `motorcycles/` para todas as motos

## 8. Tratamento de Erros

### Erro: "Bucket não existe"
**Solução**: Execute `ensureBucketExists()` ou crie manualmente no dashboard

### Erro: "Unauthorized"
**Solução**: Verifique se está usando **Service Role Key** no backend

### Erro: "File too large"
**Solução**: Reduza o tamanho da imagem para menos de 5MB

### Erro: "Invalid file type"
**Solução**: Use apenas JPEG, PNG ou WEBP

## 9. Segurança

✅ **Implementado**:
- Validação de tipo MIME
- Validação de tamanho de arquivo
- Nomes únicos (UUID) para evitar sobrescrita
- Bucket público apenas para leitura

⚠️ **Recomendações**:
- Considere adicionar sanitização de imagens (detecção de malware)
- Implemente rate limiting no endpoint de upload
- Adicione compressão de imagens antes do upload (reduzir custos)

## 10. Manutenção

### Deletar Imagens Órfãs
Se deletar uma moto, a imagem é automaticamente removida via `deleteMotorcycleImage()`.

### Limpeza Manual
Vá em **Storage** > **motorcycle-images** > Selecione arquivos > **Delete**

### Monitoramento de Uso
Dashboard do Supabase mostra:
- Total de arquivos
- Espaço usado
- Tráfego mensal
