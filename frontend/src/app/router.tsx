import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { Payments } from '../pages/Payments';
import { Motorcycles } from '../pages/Motorcycles';
import { Subscribers } from '../pages/Subscribers';
import { Architecture } from '../pages/Architecture';
import { LoginPage } from '../pages/LoginPage';
import { UsersPage } from '../pages/UsersPage';
import { RootLayout } from '../layouts/RootLayout';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute><RootLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'payments', element: <Payments /> },
      { path: 'motorcycles', element: <Motorcycles /> },
      { path: 'subscribers', element: <Subscribers /> },
      { path: 'architecture', element: <Architecture /> },
      { path: 'users', element: <UsersPage /> }
    ]
  }
]);
