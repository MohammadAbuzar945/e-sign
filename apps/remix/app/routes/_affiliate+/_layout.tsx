import { Outlet } from 'react-router';

export default function AffiliateLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
