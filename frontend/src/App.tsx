import { Outlet } from 'react-router-dom';
import ThreeBg from './ThreeBg';

export default function App(){
  return (
    <>
      <div className="bg3d"><ThreeBg /></div>
      <Outlet />
    </>
  );
}
