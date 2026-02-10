import { createBrowserRouter } from 'react-router-dom';
import { Dashboard } from '../pages/Dashboard';
import { Payments } from '../pages/Payments';
import { Motorcycles } from '../pages/Motorcycles';
import { Subscribers } from '../pages/Subscribers';
import { Architecture } from '../pages/Architecture';
import { RootLayout } from '../layouts/RootLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'payments', element: <Payments /> },
      { path: 'motorcycles', element: <Motorcycles /> },
      { path: 'subscribers', element: <Subscribers /> },
      { path: 'architecture', element: <Architecture /> }
    ]
  }
]);
