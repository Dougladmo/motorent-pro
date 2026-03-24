import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { router } from './app/router';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            success: { duration: 3000 },
            error: { duration: 5000 },
            style: {
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
            },
          }}
        />
        <RouterProvider router={router} />
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
