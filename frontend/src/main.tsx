import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import './styles.css';
import { initTheme } from './theme';
import App from './App';
import DayListPage from './pages/DayListPage';
import DayCalendarPage from './pages/DayCalendarPage';

const today = new Date().toISOString().slice(0,10);
const router = createBrowserRouter([
  {
    path: '/', element: <App />,
    children: [
      { index: true, element: <Navigate to={`/calendar/${today}`} replace /> },
      { path: 'day/:date', element: <DayListPage /> },
      { path: 'calendar/:date', element: <DayCalendarPage /> },
    ]
  }
]);

initTheme();
const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
