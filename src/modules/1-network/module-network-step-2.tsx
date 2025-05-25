import { FC, useCallback, useState, useEffect } from 'react';
import { useSpectreStore } from '../../core/spectre-store';
import { IGetBlockDagInfoResponse, IGetInfoResponse } from 'spectre-wasm';
import { parsePayload } from '../../core/components/bech32';
import { COLORS } from '../../core/components/colors';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type ModuleNetworkStep1Props = {};

export const ModuleNetworkStep2: FC<ModuleNetworkStep1Props> = ({}) => {
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [peerInfo, setPeerInfo] = useState<IGetInfoResponse | null>(null);
  const [dagInfo, setDagInfo] = useState<IGetBlockDagInfoResponse | null>(null);
  const [blueScore, setBlueScore] = useState<number | null>(null);
  const [daaScore, setDaaScore] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [isBlockAddedSubscribed, setIsBlockAddedSubscribed] = useState(false);
  const [sampledBlocksCount, setSampledBlocksCount] = useState(0);

  const [SpectredVersions, setNodeVersions] = useState<Record<string, number>>({});
  const [minerVersions, setMinerVersions] = useState<Record<string, number>>({});
  const [StratumBridgeVersions, setBridgeVersions] = useState<Record<string, number>>({});

  const init = useSpectreStore((state) => state.init);
  const rpc = useSpectreStore((state) => state.spectreClientInstance);

  const onConnectClicked = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);

    await init();

    setStep(1);

    setIsLoading(false);
  }, [isLoading]);

  const onNodeInfoClicked = useCallback(async () => {
    const [info, dagInfo] = await Promise.all([rpc.rpc?.getInfo(), rpc.rpc?.getBlockDagInfo()]);

    setPeerInfo(info!);
    setDagInfo(dagInfo!);

    //console.log('Server Info Response:', info);
    //console.log('DAG Info Response:', dagInfo);
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (rpc && isBlockAddedSubscribed) {
        rpc.unsubscribeFromBlockAdded();
        console.log('Unsubscribed from Block Added');
      }
    };
  }, [rpc, isBlockAddedSubscribed]);

  const formatChartData = (versionRecord: Record<string, number>) => {
    return Object.entries(versionRecord)
      .sort((a, b) => b[1] - a[1]) // descending order
      .map(([name, count], index) => ({
        name,
        value: count,
        fill: COLORS[index % COLORS.length],
      }));
  };

  const PieSliceLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
    value,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize="12"
      >
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  useEffect(() => {
    if (step === 1 && rpc && rpc.rpc && !isBlockAddedSubscribed) {
      const handleBlockAdded = (notification: {
        data: {
          block: {
            header: {
              hash: string;
              timestamp: bigint;
              blueScore: bigint;
              daaScore: bigint;
            };
            transactions: any[];
            verboseData: {
              difficulty: number;
              isChainBlock: boolean;
              mergeSetBluesHashes: string[];
              mergeSetRedsHashes: string[];
              payload: string[];
            };
          };
        };
      }) => {
        const block = notification.data.block;
        const header = block.header;
        const verboseData = block.verboseData;

        setBlueScore(Number(header.blueScore));
        setDaaScore(Number(header.daaScore));
        setDifficulty(verboseData.difficulty);
        setSampledBlocksCount((prevCount) => prevCount + 1);

        // decode the payload
        let decodedPayload = '';
        let decodedInfo = '';

        if (block.transactions.length > 0 && block.transactions[0]?.payload) {
          const payloadString = block.transactions[0].payload;
          const [decoded, info] = parsePayload(payloadString);
          decodedPayload = decoded;
          decodedInfo = info;

          //console.log("decoded payload:", decodedPayload);
          //console.log('decoded info:', decodedInfo);

          if (info) {
            let SpectredVersion, minerVersion, StratumBridgeVersion;

            // case where theres a slash followed by some content without quotes
            if (decodedInfo.includes('/') && !decodedInfo.includes("'")) {
              const parts = decodedInfo.split('/');
              SpectredVersion = parts[0];
              const minerText = parts[1].trim();
              minerVersion = minerText || 'unknown';
              StratumBridgeVersion = 'none';
            } else {
              // "SpectredVersion/'minerVersion' via StratumBridgeVersion"
              const regex = /^([^\/]+)\/(?:'([^']+)')?(?:\s+via\s+(.+))?$/;
              const match = decodedInfo.match(regex);

              if (!match) {
                SpectredVersion = decodedInfo; // If no match assume it's just node version
                minerVersion = 'unknown';
                StratumBridgeVersion = 'none';
              } else {
                SpectredVersion = match[1] || 'unknown';
                minerVersion = match[2] || 'unknown';
                StratumBridgeVersion = match[3] || 'none';
              }
            }

            console.log('Parsed payload:', { SpectredVersion, minerVersion, StratumBridgeVersion });

            // update counts for charts
            setNodeVersions((prev) => {
              const newCounts = { ...prev };
              newCounts[SpectredVersion] = (newCounts[SpectredVersion] || 0) + 1;
              return newCounts;
            });

            setMinerVersions((prev) => {
              const newCounts = { ...prev };
              newCounts[minerVersion] = (newCounts[minerVersion] || 0) + 1;
              return newCounts;
            });

            setBridgeVersions((prev) => {
              const newCounts = { ...prev };
              newCounts[StratumBridgeVersion] = (newCounts[StratumBridgeVersion] || 0) + 1;
              return newCounts;
            });
          }
        }

        //  console.log('Block Added:', {
        //    blockHash: header.hash,
        //    timestamp: new Date(Number(header.timestamp)).toISOString(),
        //    difficulty: verboseData.difficulty,
        //    blueScore: Number(header.blueScore),
        //    daaScore: Number(header.daaScore),
        //    txlen: block.transactions.length,
        //    //payload: block.transactions[0]?.payload,
        //    //decodedPayload,
        //    decodedInfo,
        //    isChainBlock: verboseData.isChainBlock,
        //    mergeSetBlues: verboseData.mergeSetBluesHashes,
        //    mergeSetReds: verboseData.mergeSetRedsHashes,
        //  });
      };

      const subscribeToBlockAdded = async () => {
        try {
          await rpc.subscribeToBlockAdded(handleBlockAdded);
          setIsBlockAddedSubscribed(true);
          console.log('subscribed to Block Added');
        } catch (error) {
          console.error('Failed to subscribed to Block Added:', error);
        }
      };

      subscribeToBlockAdded();
    }
  }, [step, rpc, isBlockAddedSubscribed]);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (step === 0) {
    return (
      <div className="flex items-center justify-center">
        <button onClick={onConnectClicked}>Connect to Devnet</button>
      </div>
    );
  }

  if (step === 1) {
    const SpectredVersionData = formatChartData(SpectredVersions);
    const minerVersionData = formatChartData(minerVersions);
    const StratumBridgeVersionData = formatChartData(StratumBridgeVersions);

    return (
      <div className="flex flex-col gap-4 items-center justify-center">
        <p>Connected.</p>

        {peerInfo !== null && dagInfo !== null ? (
          <div className="node-dashboard">
            <div className="dashboard-grid">
              {/* Node Status */}
              <div className="dashboard-section-header">NODE STATUS</div>

              <div className="dashboard-item">
                <div className="item-label">Network</div>
                <div className="item-value">{dagInfo.network}</div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Version</div>
                <div className="item-value">{peerInfo.serverVersion}</div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Sync Status</div>
                <div className="item-value">{peerInfo.isSynced ? 'Synced' : 'Syncing...'}</div>
              </div>

              {/* DAG Info */}
              <div className="dashboard-section-header">DAG INFO</div>

              <div className="dashboard-item">
                <div className="item-label">Header Count</div>
                <div className="item-value">{dagInfo.headerCount.toString()}</div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">DAA Score</div>
                <div className={`item-value ${daaScore !== null ? 'bg-secondary/60' : ''}`}>
                  {daaScore !== null ? daaScore.toString() : dagInfo.virtualDaaScore.toString()}
                </div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Blue Score</div>
                <div className={`item-value ${blueScore !== null ? 'bg-secondary/60' : ''}`}>
                  {blueScore !== null ? blueScore.toString() : 'Waiting...'}
                </div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Difficulty</div>
                <div className={`item-value ${difficulty !== null ? 'bg-secondary/60' : ''}`}>
                  {difficulty !== null ? difficulty.toFixed(2) : dagInfo.difficulty.toFixed(2)}
                </div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Mempool Size</div>
                <div className="item-value">{peerInfo.mempoolSize.toString()}</div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">UTXO Index</div>
                <div className="item-value">{peerInfo.isUtxoIndexed ? 'Yes' : 'No'}</div>
              </div>

              {/* Advanced Details */}
              <div className="dashboard-section-header">ADVANCED DETAILS</div>

              <div className="dashboard-item col-span-2 md:col-span-3">
                <div className="item-label">P2P ID</div>
                <div className="item-value">{peerInfo.p2pId}</div>
              </div>

              <div className="dashboard-item col-span-2 md:col-span-3">
                <div className="item-label">Pruning Point Hash</div>
                <div className="item-value smaller">{dagInfo.pruningPointHash}</div>
              </div>

              <div className="dashboard-item col-span-2 md:col-span-3">
                <div className="item-label">Sink</div>
                <div className="item-value smaller">{dagInfo.sink}</div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Sampled Blocks</div>
                <div className="item-value">{sampledBlocksCount}</div>
              </div>
            </div>

            {/* Mining Statistcs Section */}
            {sampledBlocksCount > 0 && (
              <div className="mt-8">
                <div className="dashboard-section-header mb-4">MINING STATISTICS</div>

                {/* Charts in vertical layout */}
                <div className="flex flex-col gap-8">
                  {/* Node Version Distribution */}
                  <div className="dashboard-chart-container">
                    <h3 className="text-center mb-2">Node Versions</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ left: 0, right: 0, bottom: 0, top: 0 }}>
                          <Tooltip
                            formatter={(value, name) => [
                              `${value} blocks (${(((value as number) / sampledBlocksCount) * 100).toFixed(1)}%)`,
                              name,
                            ]}
                          />
                          <Pie
                            dataKey="value"
                            className="focus:outline-none"
                            data={SpectredVersionData}
                            blendStroke
                            startAngle={90}
                            animationDuration={0}
                            isAnimationActive={false}
                            animationBegin={0}
                            animationEasing="ease-out"
                            label={PieSliceLabel}
                            labelLine={false}
                            endAngle={-270}
                            cx="50%"
                            cy="50%"
                            innerRadius="45%"
                            outerRadius="95%"
                          >
                            {SpectredVersionData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.fill}
                                style={{ outline: 'none' }}
                                className="origin-center transition-transform duration-200 hover:scale-105 focus:outline-none"
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Node Version Data Table */}
                    <div className="dashboard-grid mt-4">
                      <div className="dashboard-section-header">NODE VERSION DETAILS</div>
                      {SpectredVersionData.map((entry, index) => (
                        <div key={`node-version-${index}`} className="dashboard-item">
                          <div className="item-label" style={{ color: entry.fill }}>
                            ■ {entry.name}
                          </div>
                          <div className="item-value">
                            {entry.value} ({((entry.value / sampledBlocksCount) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Miner Version Distribution */}
                  <div className="dashboard-chart-container">
                    <h3 className="text-center mb-2">Miner Software</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ left: 0, right: 0, bottom: 0, top: 0 }}>
                          <Tooltip
                            formatter={(value, name) => [
                              `${value} blocks (${(((value as number) / sampledBlocksCount) * 100).toFixed(1)}%)`,
                              name,
                            ]}
                          />
                          <Pie
                            dataKey="value"
                            className="focus:outline-none"
                            data={minerVersionData}
                            blendStroke
                            startAngle={90}
                            animationDuration={0}
                            isAnimationActive={false}
                            animationBegin={0}
                            animationEasing="ease-out"
                            label={PieSliceLabel}
                            labelLine={false}
                            endAngle={-270}
                            cx="50%"
                            cy="50%"
                            innerRadius="45%"
                            outerRadius="95%"
                          >
                            {minerVersionData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.fill}
                                style={{ outline: 'none' }}
                                className="origin-center transition-transform duration-200 hover:scale-105 focus:outline-none"
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Miner Version Data Table */}
                    <div className="dashboard-grid mt-4">
                      <div className="dashboard-section-header">MINER SOFTWARE DETAILS</div>
                      {minerVersionData.map((entry, index) => (
                        <div key={`miner-version-${index}`} className="dashboard-item">
                          <div className="item-label" style={{ color: entry.fill }}>
                            ■ {entry.name}
                          </div>
                          <div className="item-value">
                            {entry.value} ({((entry.value / sampledBlocksCount) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bridge Version Distribution */}
                  <div className="dashboard-chart-container">
                    <h3 className="text-center mb-2">Stratum Bridges</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ left: 0, right: 0, bottom: 0, top: 0 }}>
                          <Tooltip
                            formatter={(value, name) => [
                              `${value} blocks (${(((value as number) / sampledBlocksCount) * 100).toFixed(1)}%)`,
                              name,
                            ]}
                          />
                          <Pie
                            dataKey="value"
                            className="focus:outline-none"
                            data={StratumBridgeVersionData}
                            blendStroke
                            startAngle={90}
                            animationDuration={0}
                            isAnimationActive={false}
                            animationBegin={0}
                            animationEasing="ease-out"
                            label={PieSliceLabel}
                            labelLine={false}
                            endAngle={-270}
                            cx="50%"
                            cy="50%"
                            innerRadius="45%"
                            outerRadius="95%"
                          >
                            {StratumBridgeVersionData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.fill}
                                style={{ outline: 'none' }}
                                className="origin-center transition-transform duration-200 hover:scale-105 focus:outline-none"
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Bridge Version Data Table */}
                    <div className="dashboard-grid mt-4">
                      <div className="dashboard-section-header">STRATUM BRIDGE DETAILS</div>
                      {StratumBridgeVersionData.map((entry, index) => (
                        <div key={`bridge-version-${index}`} className="dashboard-item">
                          <div className="item-label" style={{ color: entry.fill }}>
                            ■ {entry.name}
                          </div>
                          <div className="item-value">
                            {entry.value} ({((entry.value / sampledBlocksCount) * 100).toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <button onClick={onNodeInfoClicked}>Request Node Info</button>
      </div>
    );
  }
  return null;
};
