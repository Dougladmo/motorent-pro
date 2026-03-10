# Storage com formdata-io

## Por que formdata-io foi adotado

A SDK do Supabase exige três passos para fazer upload de um arquivo:
1. Converter base64 → Buffer manualmente
2. Chamar `.upload()` com `contentType` nos options
3. Chamar `.getPublicUrl()` separadamente para obter a URL pública

O `formdata-io/storage` unifica esses passos em uma única chamada `.upload()` que:
- Aceita Buffer **ou** base64 data URI diretamente (sem conversão manual)
- Detecta o MIME type automaticamente
- Retorna `{ url }` com a URL pública já resolvida

## Como criar uma instância de storage

```typescript
import { createStorage } from 'formdata-io/storage';

const storage = createStorage({
  provider: 'supabase',
  bucket: 'nome-do-bucket',
  url: process.env.SUPABASE_URL!,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  keyPrefix: 'subpasta',   // opcional
  publicBucket: true        // padrão: true
});
```

## Exemplos de uso no projeto

### Upload de imagem de moto (Buffer)

```typescript
// backend/src/services/uploadService.ts
const result = await this.motorcycleStorage.upload(fileBuffer, { filename: 'uuid.jpg' });
return result.url; // URL pública pronta
```

### Upload de QR Code PIX (base64)

```typescript
// backend/src/services/uploadService.ts
// worker/src/jobs/paymentCron.ts
const dataUri = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
const result = await this.qrStorage.upload(dataUri, { filename: `qrcode_${paymentId}.png` });
return result.url;
```

### Deleção por storage key

```typescript
await storage.delete(key); // key = caminho relativo dentro do bucket (sem o prefixo do bucket)
```

## Instâncias no projeto

| Instância | Bucket | Onde é criada |
|---|---|---|
| `motorcycleStorage` | `motorcycle-images` | `UploadService` constructor (backend) |
| `qrStorage` | `qr-codes` | `UploadService` constructor (backend) |
| `getQrStorage()` | `qr-codes` | função lazy no worker (`paymentCron.ts`) |

A função `getQrStorage()` no worker é lazy para evitar leitura das variáveis de ambiente antes do `dotenv` ser carregado.

## Variáveis de ambiente necessárias

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> Use a **service role key** (não a anon key) para contornar as políticas RLS e fazer uploads server-side.
