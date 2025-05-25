import { ArrowLongLeftIcon, ArrowLongRightIcon, SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import { FC, useMemo } from 'react';
import { modules } from './module';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import useDarkMode from '../core/hooks/use-darkmode';

export const ModuleLayout: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useDarkMode();

  const moduleName = useMemo(() => {
    return location.pathname.split('/').pop()?.toUpperCase()?.replaceAll('-', ' ');
  }, [location]);

  const currentIndex = modules.findIndex((module) => `/modules/${module.path}` === location.pathname);

  const handleNavigate = (direction: 'prev' | 'next') => {
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex >= 0 && targetIndex < modules.length) {
      navigate(`/modules/${modules[targetIndex].path}`);
    }
  };

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < modules.length - 1;

  const nextTitle = hasNext ? modules[currentIndex + 1].title : null;
  const prevTitle = hasPrev ? modules[currentIndex - 1].title : null;

  return (
    <div className="w-100 h-screen select-none relative">
      <nav className="h-16 w-full border-b border-white">
        {/* Back arrow */}
        <Link className="no-underline" to="/">
          <ArrowLongLeftIcon className="text-white size-14 absolute top-1 left-6 md:left-52 hover:text-secondary hover:cursor-pointer transition-colors" />
        </Link>

        {/* Module Title */}
        <h3 className="font-rubik inline absolute top-4 text-xl left-24 md:left-72">{moduleName ?? ''}</h3>

        {/* Dark/Light mode toggle button */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-2.5 right-2.5 md:right-12 text-white hover:text-secondary transition-colors focus:outline-none"
          aria-label="Toggle Dark Mode"
        >
          {darkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
        </button>
      </nav>

      <div className="pb-16 md:pt-20 w-full ">
        <Outlet />

        <div className="mt-16 max-w-2xl mx-auto px-4 flex justify-between items-center">
          {/* Previous */}
          {hasPrev ? (
            <div className="flex flex-col items-start">
              <button
                onClick={() => handleNavigate('prev')}
                className="flex items-center px-4 py-2 border border-white rounded-md hover:shadow-secondary hover:shadow-sm transition-shadow"
              >
                <ArrowLongLeftIcon className="size-5 mr-2" />
                Previous
              </button>
              <span className="text-sm mt-2 text-white/60">{prevTitle}</span>
            </div>
          ) : (
            <div />
          )}

          {/* Next */}
          {hasNext && (
            <div className="flex flex-col items-end">
              <button
                onClick={() => handleNavigate('next')}
                className="flex items-center px-4 py-2 border border-white rounded-md hover:shadow-secondary hover:shadow-sm transition-shadow"
              >
                Next
                <ArrowLongRightIcon className="size-5 ml-2" />
              </button>
              <span className="text-sm mt-2 text-white/60">{nextTitle}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
