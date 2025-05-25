import { modules } from './modules/module';
import { ModuleCard } from './core/components/ModuleCard';
import sigma from '/sigma.png';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';
import useDarkMode from './core/hooks/use-darkmode';

function App() {
  const [darkMode, setDarkMode] = useDarkMode();
  return (
    <>
      <div>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-2 right-2 md:top-4 md:right-12 text-white hover:text-secondary transition-colors focus:outline-none"
          aria-label="Toggle Dark Mode"
        >
          {darkMode ? <SunIcon className="h-6 w-6" /> : <MoonIcon className="h-6 w-6" />}
        </button>
      </div>

      <div className="select-none flex flex-col items-center pt-2 pb-8">
        <header className="mt-12 2xl:mt-24 flex flex-col items-center">
          <div className="flex items-center font-rubik">
            <h1 className="inline flex items-center">
              Spectr
              <img className="inline w-6 h-6 md:w-16 md:h-16 mx-0.5" src={sigma} alt="e" />
              &nbsp;Dashboard
            </h1>
          </div>
          <h2 className="text-center mt-2 font-rubik">Some useful tools for Spectre</h2>
        </header>

        <nav className="mt-8 sm:mt-12 2xl:mt-24 flex flex-row justify-center gap-4 sm:gap-8 2xl:gap-16 w-100 sm:w-5/6 2xl:w-3/6 flex-wrap">
          {modules.map((m, i) => (
            <ModuleCard key={m.title} index={i} description={m.description} title={m.title} path={m.path} />
          ))}
        </nav>
      </div>
      <div className="mt-4 mb-4 px-2 text-center md:text-start md:mt-12 md:mb-8 md:px-0 mx-auto w-full flex flex-col items-center sm:w-5/6 2xl:w-3/6"></div>
    </>
  );
}

export default App;
