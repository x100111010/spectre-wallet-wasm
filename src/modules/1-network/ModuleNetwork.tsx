import { FC } from 'react';
import { ModuleNetworkStep2 } from './module-network-step-2';

export const ModuleNetwork: FC = () => {
  return (
    <div className="h-full flex flex-row">
      <div className="py-8 md:py-16 flex justify-center items-center mx-auto">
        <div className="max-w-5xl markdown">
          <h2>Network Dashboard</h2>

          <p>
            Connect to a public Spectre node via wRPC to monitor real-time DAG metrics and network state. The
            dashboard subscribes to block notifications and visualizes mining software distribution.
          </p>

          <div className="py-6 2xl:py-12">
            <ModuleNetworkStep2 />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleNetwork;
