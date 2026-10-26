// Shared contexts for the dashboard layout and the pages it renders.
// They live apart from DashboardLayout.jsx because react-refresh's
// only-export-components rule forbids mixing non-component exports
// (contexts, hooks) with a component in one file, and because pages can
// then import the contexts without pulling in the whole layout component.
import { createContext, useContext } from 'react';

export const YearContext = createContext();
export const useYear = () => useContext(YearContext);

// Shared view scope ("My Classes" vs "All School"). Lives at the layout level
// so the teacher's choice survives navigation between Dashboard, Reports and
// Compare Classes. Defaults: 'mine' for teachers, 'all' for admins.
export const ScopeContext = createContext();
export const useScope = () => useContext(ScopeContext);
