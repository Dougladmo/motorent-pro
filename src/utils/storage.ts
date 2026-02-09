const STORAGE_KEYS = {
  MOTORCYCLES: 'motorent_motorcycles',
  SUBSCRIBERS: 'motorent_subscribers',
  RENTALS: 'motorent_rentals',
  PAYMENTS: 'motorent_payments',
  LAST_SYNC: 'motorent_last_sync'
};

export const storage = {
  save: <T>(key: string, data: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  },

  load: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      console.error('Erro ao carregar do localStorage:', error);
      return fallback;
    }
  },

  clear: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Erro ao limpar localStorage:', error);
    }
  },

  export: (): string => {
    const data = {
      motorcycles: storage.load(STORAGE_KEYS.MOTORCYCLES, []),
      subscribers: storage.load(STORAGE_KEYS.SUBSCRIBERS, []),
      rentals: storage.load(STORAGE_KEYS.RENTALS, []),
      payments: storage.load(STORAGE_KEYS.PAYMENTS, []),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },

  import: (jsonData: string): boolean => {
    try {
      const data = JSON.parse(jsonData);
      storage.save(STORAGE_KEYS.MOTORCYCLES, data.motorcycles);
      storage.save(STORAGE_KEYS.SUBSCRIBERS, data.subscribers);
      storage.save(STORAGE_KEYS.RENTALS, data.rentals);
      storage.save(STORAGE_KEYS.PAYMENTS, data.payments);
      return true;
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      return false;
    }
  }
};

export const STORAGE_KEYS_EXPORT = STORAGE_KEYS;
